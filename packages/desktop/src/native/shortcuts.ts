import { globalShortcut, BrowserWindow } from 'electron'

const defaultShortcuts: Record<string, string> = {
  'toggle-dev-tools': 'CmdOrCtrl+Shift+I',
}

export function initShortcuts(mainWindow: BrowserWindow): void {
  for (const [action, accelerator] of Object.entries(defaultShortcuts)) {
    const registered = globalShortcut.register(accelerator, () => {
      mainWindow.webContents.send('shortcut:trigger', action)
      if (action === 'toggle-dev-tools') {
        mainWindow.webContents.toggleDevTools()
      }
    })
    if (!registered) {
      console.warn(`[Desktop] Failed to register shortcut: ${accelerator}`)
    }
  }
}

export function registerShortcut(accelerator: string, action: string, mainWindow: BrowserWindow): boolean {
  return globalShortcut.register(accelerator, () => {
    mainWindow.webContents.send('shortcut:trigger', action)
  })
}

export function unregisterShortcut(accelerator: string): void {
  globalShortcut.unregister(accelerator)
}

export function destroyShortcuts(): void {
  globalShortcut.unregisterAll()
}
