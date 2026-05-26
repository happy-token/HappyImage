import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import { fileURLToPath } from 'url'

const MAX_RETRIES = 5
const HEALTH_TIMEOUT_MS = 30_000

export function calculateBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 32000)
}

export function findAvailablePort(ports: number[]): number {
  return ports[0]
}

function resolveCliEntry(): string {
  try {
    return fileURLToPath(import.meta.resolve('@happyimage/cli'))
  } catch {
    return join(process.resourcesPath, 'cli', 'dist', 'bin.js')
  }
}

export interface SidecarConfig {
  port: number
  onError?: (msg: string) => void
  onCrash?: (attempt: number) => void
  onRestartExhausted?: () => void
}

export interface SidecarInstance {
  url: string
  start(): Promise<boolean>
  stop(): void
}

export function createSidecar(config: SidecarConfig): SidecarInstance {
  let serverProcess: ChildProcess | null = null
  let restartAttempt = 0
  let intentionallyStopped = false
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  const url = `http://localhost:${config.port}`

  function startProcess(): ChildProcess {
    const cliEntry = resolveCliEntry()
    return spawn('bun', [cliEntry, 'web', '--port', String(config.port)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    })
  }

  function attachHandlers(proc: ChildProcess): void {
    proc.on('exit', () => {
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
      const res = await fetch(`${url}/api/health`)
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
    serverProcess = startProcess()
    attachHandlers(serverProcess)
    return waitForReady()
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

  return { url, start, stop }
}
