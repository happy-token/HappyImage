import { BrowserWindow } from 'electron'
import { getPreloadPath } from './paths.js'

export function createMainWindow(preloadPath?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#09090b',
    title: 'HappyImage',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath ?? getPreloadPath(),
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  return win
}

export function loadApp(win: BrowserWindow, url: string): void {
  win.loadURL(url).catch(() => {
    const errorHtml = `<html><body style="background:#09090b;color:#ef4444;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="font-size:24px;font-weight:600;">无法连接服务</h1><p style="color:#a1a1aa;margin-top:8px;">HappyImage 后端服务未启动，请重启应用。</p></div></body></html>`
    win.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`)
  })
}
