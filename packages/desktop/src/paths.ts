import { app } from 'electron'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function isDev(): boolean {
  return !app.isPackaged
}

export function getAppDir(): string {
  return app.isPackaged ? dirname(app.getPath('exe')) : resolve(__dirname, '..')
}

export function getStaticDir(): string {
  return app.isPackaged ? join(getAppDir(), 'static') : join(getAppDir(), 'build')
}

export function getIconPath(name: string): string {
  return join(getStaticDir(), name)
}

export function getPreloadPath(): string {
  return app.isPackaged
    ? join(getAppDir(), 'dist', 'preload.js')
    : join(__dirname, 'preload.js')
}
