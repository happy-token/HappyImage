import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export function initUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:download-progress', progress)
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('[Desktop] Update error:', err.message)
  })
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Desktop] Update check failed:', err.message)
  })
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('[Desktop] Update download failed:', err.message)
  })
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}

export function destroyUpdater(): void {
  autoUpdater.removeAllListeners()
}
