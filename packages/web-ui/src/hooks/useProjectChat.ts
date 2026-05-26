import { useState, useCallback, useRef } from 'react'
import { parseSSEStream } from '../lib/sse'

interface ChatMessage {
  type: 'plan' | 'file' | 'image' | 'error' | 'done'
  plan?: string
  path?: string
  kind?: string
  error?: string
}

interface ChatTarget {
  type: string
  index?: number
}

interface LastSendParams {
  message: string
  target?: ChatTarget
  sessionId?: string | null
}

export function useProjectChat(projectId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [plan, setPlan] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [newImages, setNewImages] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<{ path: string; kind: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastSendRef = useRef<LastSendParams | null>(null)

  const sendMessage = useCallback(async (message: string, target?: ChatTarget, sessionId?: string | null) => {
    setIsStreaming(true)
    setPlan(null)
    setLogs([])
    setNewImages([])
    setNewFiles([])
    setError(null)

    lastSendRef.current = { message, target, sessionId }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, target, sessionId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setError(err.error || `HTTP ${res.status}`)
        setIsStreaming(false)
        return
      }

      await parseSSEStream<ChatMessage>(res, (msg) => {
        switch (msg.type) {
          case 'plan':
            setPlan(msg.plan || null)
            setLogs(prev => [...prev, `Plan: ${msg.plan || ''}`])
            break
          case 'file': {
            const fpath = msg.path
            if (fpath) {
              setNewFiles(prev => [...prev, { path: fpath, kind: msg.kind || 'file' }])
              setLogs(prev => [...prev, `Updated: ${fpath}`])
            }
            break
          }
          case 'image': {
            const ipath = msg.path
            if (ipath) setNewImages(prev => [...prev, ipath])
            break
          }
          case 'error':
            setError(msg.error!)
            break
          case 'done':
            break
        }
      }, controller.signal)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Chat connection failed')
    } finally {
      setIsStreaming(false)
    }
  }, [projectId])

  const retrySend = useCallback(() => {
    const last = lastSendRef.current
    if (!last) return
    sendMessage(last.message, last.target, last.sessionId)
  }, [sendMessage])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const regenerate = useCallback(async (index: number, promptOverride?: string) => {
    const res = await fetch(`/api/projects/${projectId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: { type: 'image', index }, ...(promptOverride ? { promptOverride } : {}) }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<{ image: string; path: string; version: number }>
  }, [projectId])

  const clear = useCallback(() => {
    setPlan(null)
    setLogs([])
    setNewImages([])
    setNewFiles([])
    setError(null)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPlan(null)
    setLogs([])
    setNewImages([])
    setNewFiles([])
    setError(null)
    setIsStreaming(false)
  }, [])

  return { sendMessage, retrySend, stop, regenerate, clear, reset, isStreaming, plan, logs, newImages, newFiles, error }
}
