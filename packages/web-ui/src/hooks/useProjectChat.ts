import { useState, useCallback, useRef } from 'react'

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

export function useProjectChat(projectId: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [plan, setPlan] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [newImages, setNewImages] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<{ path: string; kind: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (message: string, target?: ChatTarget) => {
    setIsStreaming(true)
    setPlan(null)
    setLogs([])
    setNewImages([])
    setNewFiles([])
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, target }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setError(err.error || `HTTP ${res.status}`)
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setError('Response body not readable'); setIsStreaming(false); return }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          try {
            const msg: ChatMessage = JSON.parse(trimmed.slice(6))

            switch (msg.type) {
              case 'plan':
                setPlan(msg.plan || null)
                setLogs(prev => [...prev, `Plan: ${msg.plan || ''}`])
                break
              case 'file':
                if (msg.path) {
                  const fpath = msg.path
                  const fkind = msg.kind || 'file'
                  setNewFiles(prev => [...prev, { path: fpath, kind: fkind }])
                  setLogs(prev => [...prev, `Updated: ${fpath}`])
                }
                break
              case 'image':
                if (msg.path) {
                  const ipath = msg.path
                  setNewImages(prev => [...prev, ipath])
                }
                break
              case 'error':
                setError(msg.error!)
                break
              case 'done':
                break
            }
          } catch { /* skip parse errors */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Chat connection failed')
    } finally {
      setIsStreaming(false)
    }
  }, [projectId])

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

  return { sendMessage, stop, regenerate, clear, isStreaming, plan, logs, newImages, newFiles, error }
}
