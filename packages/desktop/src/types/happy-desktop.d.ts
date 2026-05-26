import type { HappyDesktopAPI } from '../preload.js'

declare global {
  interface Window {
    happyDesktop: HappyDesktopAPI
  }
}

export {}
