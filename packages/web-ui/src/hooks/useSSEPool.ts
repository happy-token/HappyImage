import { useState, useEffect, useRef, useCallback } from 'react'
import { parseSSEStream } from '../lib/sse'

interface SSEMessage {
  type: string
  text?: string
  path?: string
  name?: string
  input?: Record<string, unknown>
  error?: string
  images?: string[]
  projectPath?: string
  sessionId?: string
}

interface StreamState {
  controller: AbortController
  isStreaming: boolean
  images: string[]
  projectPath: string | null
  log: string[]
  error: string | null
  onEvent?: (msg: SSEMessage) => void
}

const pool = new Map<string, StreamState>()

const MAX_POOL_SIZE = 20

function getOrCreate(sessionId: string): StreamState {
  if (!pool.has(sessionId)) {
    // Evict oldest inactive entries if pool is full
    if (pool.size >= MAX_POOL_SIZE) {
      let oldestKey = ''
      for (const [key, state] of pool) {
        if (!state.isStreaming) { oldestKey = key; break }
      }
      if (oldestKey) pool.delete(oldestKey)
    }
    pool.set(sessionId, {
      controller: new AbortController(),
      isStreaming: false,
      images: [],
      projectPath: null,
      log: [],
      error: null,
    })
  }
  return pool.get(sessionId)!
}

export function useSSEPool(sessionId: string | null) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const lastSessionRef = useRef<string | null>(null)

  // Sync state from pool when session changes
  useEffect(() => {
    if (!sessionId) return
    const state = getOrCreate(sessionId)
    setIsStreaming(state.isStreaming)
    setImages(state.images)
    setProjectPath(state.projectPath)
    setLog(state.log)
    setError(state.error)
    lastSessionRef.current = sessionId

    // Subscribe to future events
    state.onEvent = (msg) => {
      switch (msg.type) {
        case 'text': setLog(prev => [...prev, msg.text!]); break
        case 'image': { const p = msg.path; if (p) setImages(prev => [...prev, p]); break }
        case 'project': { const p = msg.path; if (p) setProjectPath(p); break }
        case 'error': setError(msg.error!); break
      }
    }
    return () => { state.onEvent = undefined }
  }, [sessionId])

  const start = useCallback(async (skillId: string, content: string, selections: Record<string, string>, extra: Record<string, unknown> = {}) => {
    if (!sessionId) return
    const state = getOrCreate(sessionId)
    state.controller = new AbortController()
    state.isStreaming = true
    state.images = []
    state.projectPath = null
    state.log = []
    state.error = null
    setIsStreaming(true)
    setImages([])
    setProjectPath(null)
    setLog([])
    setError(null)
    lastSessionRef.current = sessionId

    try {
      const res = await fetch(`/api/sessions/${sessionId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, content, selections, ...extra }),
        signal: state.controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        state.error = err.error
        setError(err.error)
        state.isStreaming = false; setIsStreaming(false)
        return
      }

      await parseSSEStream<SSEMessage>(res, (msg) => {
        if (msg.type === 'done') {
          state.isStreaming = false
          if (lastSessionRef.current === sessionId) setIsStreaming(false)
          if (msg.images) { state.images = msg.images; if (lastSessionRef.current === sessionId) setImages(msg.images) }
          if (msg.projectPath) { state.projectPath = msg.projectPath; if (lastSessionRef.current === sessionId) setProjectPath(msg.projectPath) }
        }
        state.onEvent?.(msg)
      }, state.controller.signal)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      state.error = err.message; setError(err.message)
      state.isStreaming = false; setIsStreaming(false)
    }
  }, [sessionId])

  const stop = useCallback(() => {
    if (!sessionId) return
    const state = pool.get(sessionId)
    if (state) {
      state.controller.abort()
      state.isStreaming = false
      setIsStreaming(false)
    }
  }, [sessionId])

  const retry = useCallback(() => {
    // Re-use last params — caller must pass them explicitly for now
  }, [])

  return { start, stop, retry, isStreaming, images, projectPath, log, error }
}

export function getPoolState(sessionId: string): StreamState | undefined {
  return pool.get(sessionId)
}
