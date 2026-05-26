import { ipcMain, dialog, shell, app, Notification } from 'electron'
import type { BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { checkForUpdates, downloadUpdate, installUpdate } from './native/updater.js'

const RECENT_PROJECTS_PATH = join(app.getPath('userData'), 'recent-projects.json')

function readRecentProjects(): string[] {
  try {
    if (existsSync(RECENT_PROJECTS_PATH)) {
      return JSON.parse(readFileSync(RECENT_PROJECTS_PATH, 'utf-8'))
    }
  } catch { /* corrupt file, start fresh */ }
  return []
}

function addRecentProject(projectPath: string): void {
  const recent = readRecentProjects().filter(p => p !== projectPath)
  recent.unshift(projectPath)
  writeFileSync(RECENT_PROJECTS_PATH, JSON.stringify(recent.slice(0, 20)), 'utf-8')
}

export function registerIpcHandlers(mainWindow: BrowserWindow, port: number): void {
  ipcMain.handle('dialog:openProject', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '打开项目',
    })
    if (result.canceled || !result.filePaths[0]) return null
    addRecentProject(result.filePaths[0])
    return result.filePaths[0]
  })

  ipcMain.handle('shell:revealInFinder', (_event, filePath: string) => {
    const resolved = resolve(filePath)
    if (!resolved.startsWith(app.getPath('home'))) return
    shell.showItemInFolder(resolved)
  })

  ipcMain.handle('app:getRecentProjects', () => {
    return readRecentProjects()
  })

  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    port,
  }))

  ipcMain.on('notify:show', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const n = new Notification({ title, body })
      n.show()
    }
  })

  ipcMain.handle('update:check', async () => {
    checkForUpdates()
    return null
  })

  ipcMain.handle('update:download', async () => {
    downloadUpdate()
  })

  ipcMain.on('update:install', () => {
    installUpdate()
  })
}
