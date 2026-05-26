import { Notification } from 'electron'

export function initNotifications(): void {
  // Notification.isSupported() is checked per-call in ipc.ts
}

export function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: false })
    n.on('click', () => {
      // Focus the app when notification is clicked
    })
    n.show()
  }
}

export function destroyNotifications(): void {
  // Electron notifications are ephemeral, no cleanup needed
}
