import { app, BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null
const port = process.env.PORT || '3100'
const serverUrl = `http://localhost:${port}`
const healthUrl = `${serverUrl}/api/health`

async function checkServerReady(url: string): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        if (json.status === 'ok') {
          return true
        }
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}

function startServer() {
  try {
    const cliEntry = fileURLToPath(import.meta.resolve('@happyimage/cli'))
    console.log(`[Desktop] Spawning server sidecar via CLI: ${cliEntry}`)
    
    serverProcess = spawn('bun', [cliEntry, 'web', '--port', port], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    })

    serverProcess.on('error', (err) => {
      console.error('[Desktop] Failed to start server sidecar:', err)
    })

    serverProcess.on('exit', (code) => {
      console.log(`[Desktop] Server sidecar exited with code ${code}`)
    })
  } catch (err) {
    console.error('[Desktop] Error resolving CLI package:', err)
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#09090b', // match zinc-950
    title: 'HappyImage Workspace',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Start checking server health
  const ready = await checkServerReady(healthUrl)
  if (ready) {
    console.log(`[Desktop] Server is ready, loading page: ${serverUrl}`)
    mainWindow.loadURL(serverUrl)
  } else {
    console.error('[Desktop] Server failed to start or respond in time.')
    mainWindow.loadURL(`data:text/html,<html><body style="background:#09090b;color:#ef4444;font-family:sans-serif;padding:40px;"><h1>Server Error</h1><p>The HappyImage backend server failed to start. Review console logs for details.</p></body></html>`)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Ensure single instance lock
const doubleInstanceLock = app.requestSingleInstanceLock()
if (!doubleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('ready', () => {
    startServer()
    createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow()
    }
  })

  app.on('will-quit', () => {
    if (serverProcess) {
      console.log('[Desktop] Stopping server sidecar process...')
      serverProcess.kill('SIGTERM')
    }
  })
}
