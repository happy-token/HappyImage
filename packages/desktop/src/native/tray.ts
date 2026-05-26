import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { getIconPath } from '../paths.js'

let tray: Tray | null = null
let isServerHealthy = true

export function setServerHealth(healthy: boolean): void {
  isServerHealthy = healthy
  if (tray) {
    tray.setToolTip(healthy ? 'HappyImage' : 'HappyImage (服务异常)')
  }
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = getIconPath('iconTemplate.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    icon.setTemplateImage(true)
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('HappyImage')

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示 HappyImage', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
    {
      label: '服务状态',
      enabled: false,
    },
    { type: 'separator' },
    { label: '退出 HappyImage', click: () => { app.quit() } },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
    }
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
