import { contextBridge, ipcRenderer } from 'electron'

export interface HappyDesktopAPI {
  openProjectDialog(): Promise<string | null>
  revealInFinder(path: string): Promise<void>
  getRecentProjects(): Promise<string[]>
  notify(title: string, body: string): void
  getAppInfo(): Promise<{ version: string; platform: string; port: number }>
  checkUpdate(): Promise<{ version: string } | null>
  downloadUpdate(): Promise<void>
  installUpdate(): void
  onShortcut(action: string, callback: () => void): () => void
}

const api: HappyDesktopAPI = {
  openProjectDialog: () => ipcRenderer.invoke('dialog:openProject'),
  revealInFinder: (path: string) => ipcRenderer.invoke('shell:revealInFinder', path),
  getRecentProjects: () => ipcRenderer.invoke('app:getRecentProjects'),
  notify: (title: string, body: string) => ipcRenderer.send('notify:show', { title, body }),
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onShortcut: (action: string, callback: () => void) => {
    const handler = (_event: Electron.IpcRendererEvent, a: string) => {
      if (a === action) callback()
    }
    ipcRenderer.on('shortcut:trigger', handler)
    return () => ipcRenderer.removeListener('shortcut:trigger', handler)
  },
}

contextBridge.exposeInMainWorld('happyDesktop', api)
