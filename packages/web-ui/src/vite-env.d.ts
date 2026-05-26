/// <reference types="vite/client" />

interface HappyDesktop {
  openProjectDialog(): Promise<string | null>
  revealInFinder(path: string): Promise<void>
  notify(title: string, body: string): void
  getAppInfo(): Promise<{ version: string; platform: string; port: number }>
  onShortcut(action: string, callback: () => void): () => void
}

declare global {
  interface Window {
    happyDesktop?: HappyDesktop
  }
}
