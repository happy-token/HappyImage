import { dialog, shell, app, BrowserWindow } from 'electron'
import { resolve } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

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

export async function openProjectDialog(mainWindow: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '打开项目',
    message: '选择 HappyImage 项目目录',
  })
  if (result.canceled || !result.filePaths[0]) return null
  addRecentProject(result.filePaths[0])
  return result.filePaths[0]
}

export function revealInFinder(filePath: string): void {
  const resolved = resolve(filePath)
  if (!resolved.startsWith(app.getPath('home'))) return
  shell.showItemInFolder(resolved)
}

export function getRecentProjects(): string[] {
  return readRecentProjects()
}
