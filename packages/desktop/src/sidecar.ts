import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { createServer } from 'net'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const MAX_RETRIES = 5
const HEALTH_TIMEOUT_MS = 30_000

export function calculateBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 32000)
}

export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port)
  })
}

export function findAvailablePort(ports: number[]): number {
  return ports.find(port => port > 0 && port < 65536) ?? 3100
}

async function resolveAvailablePort(preferredPort: number): Promise<number> {
  const candidates = [preferredPort]
  for (let offset = 1; offset <= 20; offset++) {
    candidates.push(preferredPort + offset)
  }
  for (const candidate of candidates) {
    if (await isPortAvailable(candidate)) return candidate
  }
  return preferredPort
}

export function resolveBunCommand(): string | null {
  const candidates = [
    process.env.BUN_PATH,
    'bun',
    '/opt/homebrew/bin/bun',
    '/usr/local/bin/bun',
    join(process.env.HOME || '', '.bun', 'bin', 'bun'),
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      if (existsSync(candidate)) return candidate
      continue
    }
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' })
    if (result.status === 0) return candidate
  }
  return null
}

export function resolveCliEntry(): string {
  const resourcesPath = process.resourcesPath || ''
  if (resourcesPath) {
    return join(resourcesPath, 'cli', 'dist', 'bin.js')
  }
  const devEntry = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cli', 'dist', 'bin.js')
  if (existsSync(devEntry)) return devEntry
  throw new Error('Cannot resolve CLI entry path')
}

export interface SidecarConfig {
  port: number
  onError?: (msg: string) => void
  onCrash?: (attempt: number) => void
  onRestartExhausted?: () => void
}

export interface SidecarInstance {
  url: string
  port: number
  start(): Promise<boolean>
  stop(): void
}

export function createSidecar(config: SidecarConfig): SidecarInstance {
  let serverProcess: ChildProcess | null = null
  let restartAttempt = 0
  let intentionallyStopped = false
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let activePort = config.port

  function getUrl(): string {
    return `http://localhost:${activePort}`
  }

  function startProcess(): ChildProcess {
    const cliEntry = resolveCliEntry()
    const bun = resolveBunCommand()
    if (!bun) {
      throw new Error('Bun runtime not found. Install Bun or set BUN_PATH.')
    }
    const resourcesPath = process.resourcesPath || ''
    return spawn(bun, [cliEntry, 'web', '--port', String(activePort)], {
      stdio: 'inherit',
      cwd: resourcesPath || dirname(cliEntry),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: undefined,
      },
    })
  }

  function attachHandlers(proc: ChildProcess): void {
    proc.on('exit', (code) => {
      if (intentionallyStopped) return
      if (restartAttempt < MAX_RETRIES) {
        const delay = calculateBackoff(restartAttempt)
        restartAttempt++
        config.onCrash?.(restartAttempt)
        restartTimer = setTimeout(async () => {
          const newProc = startProcess()
          attachHandlers(newProc)
          serverProcess = newProc
          try {
            const ready = await waitForReady()
            if (ready) restartAttempt = 0
            else config.onError?.('Server restart failed health check')
          } catch (err) {
            config.onError?.(`Restart wait failed: ${err}`)
          }
        }, delay)
      } else {
        config.onRestartExhausted?.()
      }
    })

    proc.on('error', () => {
      config.onError?.('Failed to start server sidecar')
    })
  }

  async function checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${getUrl()}/api/health`)
      if (res.ok) {
        const json = await res.json() as { status: string }
        return json.status === 'ok'
      }
      return false
    } catch {
      return false
    }
  }

  async function waitForReady(timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await checkHealth()) return true
      await new Promise(r => setTimeout(r, 100))
    }
    return false
  }

  async function start(): Promise<boolean> {
    intentionallyStopped = false
    restartAttempt = 0
    try {
      activePort = await resolveAvailablePort(config.port)
      if (activePort !== config.port) {
        config.onError?.(`Port ${config.port} is in use, using ${activePort}`)
      }
      const cliEntry = resolveCliEntry()
      const bun = resolveBunCommand()
      if (!bun) {
        throw new Error('Bun runtime not found. Install Bun or set BUN_PATH.')
      }
      serverProcess = startProcess()
      attachHandlers(serverProcess)
      const ready = await waitForReady()
      return ready
    } catch (err) {
      console.error('[Sidecar] Start error:', err)
      config.onError?.(err instanceof Error ? err.message : String(err))
      return false
    }
  }

  function stop(): void {
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
    if (serverProcess) {
      intentionallyStopped = true
      serverProcess.kill('SIGTERM')
      serverProcess = null
    }
  }

  return {
    get url() { return getUrl() },
    get port() { return activePort },
    start,
    stop,
  }
}
