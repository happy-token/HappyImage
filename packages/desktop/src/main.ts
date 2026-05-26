import { app, BrowserWindow } from 'electron'
import { createLifecycle } from './lifecycle.js'
import { createSidecar } from './sidecar.js'
import { createMainWindow, loadApp } from './window.js'
import { registerIpcHandlers } from './ipc.js'
import { initNotifications, destroyNotifications } from './native/notifications.js'
import { initShortcuts, destroyShortcuts } from './native/shortcuts.js'
import { initUpdater, destroyUpdater } from './native/updater.js'
import { createTray, destroyTray, setServerHealth } from './native/tray.js'
import { createAppMenu } from './native/menu.js'

let mainWindow: BrowserWindow | null = null
let sidecar: ReturnType<typeof createSidecar> | null = null
const port = Number(process.env.PORT) || 3100

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

createLifecycle(app, {
  onReady: async () => {
    initNotifications()

    mainWindow = createMainWindow()
    createAppMenu(mainWindow)
    registerIpcHandlers(mainWindow, port)
    initShortcuts(mainWindow)
    initUpdater(mainWindow)
    createTray(mainWindow)

    sidecar = createSidecar({
      port,
      onCrash: (attempt) => {
        console.error(`[Desktop] Server crashed, restart attempt ${attempt}`)
        setServerHealth(false)
      },
      onRestartExhausted: () => {
        const errorHtml = `<html><body style="background:#09090b;color:#ef4444;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="font-size:24px;font-weight:600;">服务异常</h1><p style="color:#a1a1aa;margin-top:8px;">HappyImage 服务多次重启失败，请重启应用。</p></div></body></html>`
        mainWindow?.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`)
      },
    })

    const ready = await sidecar.start()
    if (ready) {
      setServerHealth(true)
      loadApp(mainWindow!, sidecar.url)
    } else {
      const errorHtml = `<html><body style="background:#09090b;color:#ef4444;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="font-size:24px;font-weight:600;">无法启动服务</h1><p style="color:#a1a1aa;margin-top:8px;">后端服务无法在端口 ${port} 启动，请检查端口是否被占用。</p></div></body></html>`
      mainWindow!.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`)
    }
  },

  onActivate: () => {
    if (!mainWindow) {
      mainWindow = createMainWindow()
      mainWindow.on('closed', () => { mainWindow = null })
    }
  },

  onWillQuit: () => {
    destroyShortcuts()
    destroyTray()
    destroyUpdater()
    destroyNotifications()
    sidecar?.stop()
  },

  getMainWindow,
})
