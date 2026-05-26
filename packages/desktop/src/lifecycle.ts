import { type App, type BrowserWindow } from 'electron'

export interface LifecycleHooks {
  onReady?: () => void
  onSecondInstance?: () => void
  onActivate?: () => void
  onWillQuit?: () => void
  getMainWindow?: () => BrowserWindow | null
}

export function createLifecycle(app: App, hooks: LifecycleHooks): void {
  const doubleInstanceLock = app.requestSingleInstanceLock()

  if (!doubleInstanceLock) {
    app.quit()
    return
  }

  app.on('second-instance', () => {
    const win = hooks.getMainWindow?.()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    hooks.onSecondInstance?.()
  })

  app.on('ready', () => {
    hooks.onReady?.()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    hooks.onActivate?.()
  })

  app.on('will-quit', () => {
    hooks.onWillQuit?.()
  })
}
