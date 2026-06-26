/**
 * Service Worker for happyimage-web
 * Handles caching and automatic updates of static resources
 */

const CACHE_VERSION = '1.0.0'
const CACHE_NAMES = {
  assets: `happy-assets-${CACHE_VERSION}`,
  gallery: `happy-gallery-${CACHE_VERSION}`,
  pages: `happy-pages-${CACHE_VERSION}`,
}

// Resources to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/icon.png',
  '/apple-icon.png',
  '/happy-token-logo.svg',
  '/happyimage-logo.svg',
  '/next.svg',
  '/openai.svg',
]

/**
 * Install event - pre-cache essential assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker')
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAMES.assets).then((cache) => {
        console.log('[SW] Pre-caching static assets')
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.warn('[SW] Some assets failed to cache:', error)
        })
      }),
    ]).then(() => {
      console.log('[SW] Service Worker installed')
      // Force the waiting service worker to become active
      self.skipWaiting()
    })
  )
})

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker')
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Delete caches that are not in current CACHE_NAMES
          const isOldCache = !Object.values(CACHE_NAMES).includes(name)
          if (isOldCache) {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          }
        })
      )
    }).then(() => {
      console.log('[SW] Service Worker activated')
      // Take control of all pages immediately
      return self.clients.claim()
    })
  )
})

/**
 * Fetch event - implement caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and non-same-origin requests
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return
  }

  // Skip API requests - always fetch from network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Gallery resources - cache first with network fallback
  if (url.pathname.startsWith('/seed-gallery/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          console.log('[SW] Serving from cache:', url.pathname)
          return cached
        }

        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.ok && response.status === 200) {
            const cache = caches.open(CACHE_NAMES.gallery)
            cache.then((c) => c.put(request, response.clone()))
          }
          return response
        }).catch((error) => {
          console.error('[SW] Fetch failed for gallery:', url.pathname, error)
          // Return a 404 response if offline
          return new Response('Not found', { status: 404 })
        })
      })
    )
    return
  }

  // Next.js static assets - cache first with network fallback
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached
        }

        return fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const cache = caches.open(CACHE_NAMES.assets)
            cache.then((c) => c.put(request, response.clone()))
          }
          return response
        }).catch((error) => {
          console.error('[SW] Fetch failed for static:', url.pathname, error)
          return new Response('Not found', { status: 404 })
        })
      })
    )
    return
  }

  // Other resources - network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          const responseToCache = response.clone()
          const cacheName = url.pathname.startsWith('/') ? CACHE_NAMES.pages : CACHE_NAMES.assets
          caches.open(cacheName).then((cache) => {
            cache.put(request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        // Try cache as fallback
        return caches.match(request).then((cached) => {
          if (cached) {
            return cached
          }
          // Return a basic offline page if available
          return new Response('Offline - service unavailable', { status: 503 })
        })
      })
  )
})

/**
 * Message event - handle commands from client
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data

  if (type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received')
    self.skipWaiting()
  }

  if (type === 'CLEAR_CACHE') {
    console.log('[SW] CLEAR_CACHE received')
    const cacheNames = payload?.names || Object.values(CACHE_NAMES)
    event.waitUntil(
      Promise.all(cacheNames.map((name) => caches.delete(name))).then(() => {
        console.log('[SW] Caches cleared:', cacheNames)
        event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' })
      })
    )
  }

  if (type === 'GET_CACHE_STATUS') {
    event.waitUntil(
      Promise.all([
        caches.keys(),
        Promise.all(
          Object.entries(CACHE_NAMES).map(([key, name]) =>
            caches.open(name).then((cache) =>
              cache.keys().then((keys) => ({ [key]: keys.length }))
            )
          )
        ).then((stats) => Object.assign({}, ...stats)),
      ]).then(([cacheNames, cacheStats]) => {
        event.ports[0]?.postMessage({
          type: 'CACHE_STATUS',
          payload: { cacheNames, cacheStats },
        })
      })
    )
  }
})
