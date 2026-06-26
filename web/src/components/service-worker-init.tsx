'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * Service Worker initialization and update management component
 * Handles registration, updates, and cache management
 */

interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  isUpdateAvailable: boolean
  updateProgress: number
}

export function ServiceWorkerInit() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    updateProgress: 0,
  })

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const updateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastVersionRef = useRef<string>('')

  // Check for Service Worker support
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator
    setState((prev) => ({ ...prev, isSupported }))

    if (!isSupported) {
      console.log('[SW Init] Service Workers not supported')
      return
    }

    // Register Service Worker
    registerServiceWorker()

    // Check for updates periodically (every hour)
    updateCheckIntervalRef.current = setInterval(() => {
      checkForUpdates()
    }, 60 * 60 * 1000)

    // Cleanup
    return () => {
      if (updateCheckIntervalRef.current) {
        clearInterval(updateCheckIntervalRef.current)
      }
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })

      registrationRef.current = registration
      setState((prev) => ({ ...prev, isRegistered: true }))

      console.log('[SW Init] Service Worker registered successfully')

      // Listen for updates
      registration.addEventListener('updatefound', handleUpdateFound)

      // Initial update check
      await registration.update()

      // Get initial app version
      lastVersionRef.current = document.documentElement.getAttribute('data-app-version') || ''
    } catch (error) {
      console.error('[SW Init] Service Worker registration failed:', error)
      // Silently fail - app still works without SW
    }
  }

  const handleUpdateFound = () => {
    const registration = registrationRef.current
    if (!registration) return

    const newWorker = registration.installing
    if (!newWorker) return

    console.log('[SW Init] Service Worker update found')

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New Service Worker installed and there's an active controller
        setState((prev) => ({ ...prev, isUpdateAvailable: true }))

        // Notify user of available update
        toast.info('应用已更新，点击这里刷新', {
          duration: 10000,
          action: {
            label: '刷新',
            onClick: () => {
              // Tell the new worker to skip waiting
              newWorker.postMessage({ type: 'SKIP_WAITING' })
              // After skip waiting, reload the page
              setTimeout(() => {
                window.location.reload()
              }, 500)
            },
          },
        })
      }
    })
  }

  const checkForUpdates = async () => {
    if (!registrationRef.current) return

    try {
      console.log('[SW Init] Checking for updates...')
      await registrationRef.current.update()
    } catch (error) {
      console.error('[SW Init] Update check failed:', error)
    }
  }

  const clearCache = async () => {
    const controller = navigator.serviceWorker.controller
    if (!controller) {
      toast.error('Service Worker 不活跃')
      return
    }

    const channel = new MessageChannel()
    const promise = new Promise<void>((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === 'CACHE_CLEARED') {
          channel.port1.removeEventListener('message', listener)
          resolve()
        }
      }
      channel.port1.addEventListener('message', listener)
      channel.port1.start()
    })

    controller.postMessage(
      {
        type: 'CLEAR_CACHE',
        payload: { names: ['happy-assets-1.0.0', 'happy-gallery-1.0.0', 'happy-pages-1.0.0'] },
      },
      [channel.port2]
    )

    await promise
    toast.success('缓存已清除')
  }

  const getCacheStatus = async () => {
    const controller = navigator.serviceWorker.controller
    if (!controller) {
      toast.error('Service Worker 不活跃')
      return
    }

    const channel = new MessageChannel()
    const promise = new Promise<void>((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data.type === 'CACHE_STATUS') {
          const { payload } = event.data
          console.log('[SW Init] Cache status:', payload)
          toast.success(
            `缓存统计: ` +
              Object.entries(payload.cacheStats)
                .map(([key, count]) => `${key}: ${count}`)
                .join(', ')
          )
          channel.port1.removeEventListener('message', listener)
          resolve()
        }
      }
      channel.port1.addEventListener('message', listener)
      channel.port1.start()
    })

    controller.postMessage({ type: 'GET_CACHE_STATUS' }, [channel.port2])

    await promise
  }

  // Listen for controller changes (new SW activated)
  useEffect(() => {
    const handleControllerChange = () => {
      console.log('[SW Init] Service Worker controller changed')
      // Optionally reload to get the latest code
      // window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  // Expose methods to window for debugging (dev tools)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).swDebug = {
        state,
        checkForUpdates,
        clearCache,
        getCacheStatus,
        registration: registrationRef.current,
      }
    }
  }, [state])

  return null // This component doesn't render anything
}
