import { app } from 'electron'
import { existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function isDev(): boolean {
  return !app.isPackaged
}

export function getAppDir(): string {
  return app.isPackaged ? process.resourcesPath : resolve(__dirname, '..')
}

export function getStaticDir(): string {
  return app.isPackaged ? getAppDir() : join(getAppDir(), 'build')
}

export function getIconPath(name: string): string {
  return join(getStaticDir(), name)
}

export function getPreloadPath(): string {
  if (!app.isPackaged) return join(__dirname, 'preload.js')
  const unpacked = join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'preload.js')
  if (existsSync(unpacked)) return unpacked
  return join(process.resourcesPath, 'app.asar', 'dist', 'preload.js')
}
