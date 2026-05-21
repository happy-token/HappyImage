import { useState, useCallback, useRef } from 'react'

interface SSEMessage {
  type: 'text' | 'tool_use' | 'image' | 'error' | 'done' | 'file' | 'caption' | 'project'
  text?: string
  name?: string
  input?: Record<string, unknown>
  path?: string
  kind?: string
  caption?: string
  error?: string
  images?: string[]
  projectPath?: string
}

interface UseSSEOptions {
  onText?: (text: string) => void
  onToolUse?: (name: string, input: Record<string, unknown>) => void
  onImage?: (path: string) => void
  onFile?: (path: string, kind: string) => void
  onCaption?: (caption: string) => void
  onProject?: (path: string) => void
  onError?: (error: string) => void
  onDone?: (images: string[]) => void
}

interface GenerateBodyExtra {
  sourceMode?: string
  sourceRef?: string
  prebuiltPlan?: Record<string, unknown>
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [files, setFiles] = useState<{ path: string; kind: string }[]>([])
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async (skillId: string, content: string, selections: Record<string, string>, opts: UseSSEOptions = {}, extra: GenerateBodyExtra = {}) => {
    setIsStreaming(true)
    setLog([])
    setImages([])
    setFiles([])
    setProjectPath(null)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, content, selections, ...extra, prebuiltPlan: extra.prebuiltPlan }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        const msg = err.error || `HTTP ${res.status}`
        setError(msg)
        opts.onError?.(msg)
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        const msg = 'Response body is not readable'
        setError(msg)
        opts.onError?.(msg)
        setIsStreaming(false)
        return
      }

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
            const msg: SSEMessage = JSON.parse(trimmed.slice(6))

            switch (msg.type) {
              case 'text':
                setLog(prev => [...prev, msg.text!])
                opts.onText?.(msg.text!)
                break
              case 'tool_use':
                setLog(prev => [...prev, `Calling ${msg.name}...`])
                opts.onToolUse?.(msg.name!, msg.input || {})
                break
              case 'image':
                if (msg.path) {
                  setImages(prev => [...prev, msg.path!])
                  opts.onImage?.(msg.path!)
                }
                break
              case 'file':
                if (msg.path) {
                  const kind = msg.kind || 'file'
                  setFiles(prev => [...prev, { path: msg.path!, kind }])
                  opts.onFile?.(msg.path, kind)
                }
                break
              case 'caption':
                if (msg.caption) opts.onCaption?.(msg.caption)
                break
              case 'project':
                if (msg.path) {
                  setProjectPath(msg.path)
                  opts.onProject?.(msg.path)
                }
                break
              case 'error':
                setError(msg.error!)
                opts.onError?.(msg.error!)
                break
              case 'done':
                opts.onDone?.(msg.images || [])
                break
            }
          } catch {
            // skip parse errors for non-JSON SSE lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      const msg = err.message || 'Connection failed'
      setError(msg)
      opts.onError?.(msg)
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { start, stop, isStreaming, log, images, files, projectPath, error }
}
