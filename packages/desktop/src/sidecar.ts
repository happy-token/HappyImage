import { spawn, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const MAX_RETRIES = 5
const HEALTH_TIMEOUT_MS = 30_000

export function calculateBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 32000)
}

export function findAvailablePort(ports: number[]): number {
  return ports[0]
}

export interface SidecarConfig {
  port: number
  onError?: (msg: string) => void
  onCrash?: (attempt: number) => void
  onRestartExhausted?: () => void
}

export interface SidecarInstance {
  process: ChildProcess | null
  url: string
  start(): Promise<boolean>
  stop(): void
}

export function createSidecar(config: SidecarConfig): SidecarInstance {
  let serverProcess: ChildProcess | null = null
  let restartAttempt = 0
  const url = `http://localhost:${config.port}`

  function startProcess(): ChildProcess {
    const cliEntry = fileURLToPath(import.meta.resolve('@happyimage/cli'))
    return spawn('bun', [cliEntry, 'web', '--port', String(config.port)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
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
    serverProcess = startProcess()

    serverProcess.on('exit', (code) => {
      if (restartAttempt < MAX_RETRIES) {
        const delay = calculateBackoff(restartAttempt)
        restartAttempt++
        config.onCrash?.(restartAttempt)
        setTimeout(async () => {
          serverProcess = startProcess()
          await waitForReady()
        }, delay)
      } else {
        config.onRestartExhausted?.()
      }
    })

    serverProcess.on('error', () => {
      config.onError?.('Failed to start server sidecar')
    })

    return waitForReady()
  }

  function stop(): void {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      serverProcess = null
    }
  }

  return { process: serverProcess, url, start, stop }
}
