import { useState, useCallback, useRef } from 'react'
import { parseSSEStream } from '../lib/sse'

interface SSEMessage {
  type: 'text' | 'tool_use' | 'retry' | 'image' | 'error' | 'done' | 'file' | 'caption' | 'project'
  text?: string
  name?: string
  input?: Record<string, unknown>
  attempt?: number
  delayMs?: number
  provider?: string
  reason?: string
  path?: string
  kind?: string
  caption?: string
  error?: string
  images?: string[]
  projectPath?: string
  sessionId?: string
}

interface UseSSEOptions {
  onText?: (text: string) => void
  onToolUse?: (name: string, input: Record<string, unknown>) => void
  onRetry?: (retry: { attempt: number; delayMs: number; provider?: string; reason: string }) => void
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
  sessionId?: string
  commandRequest?: Record<string, unknown>
}

function handleSSEMessage(
  msg: SSEMessage,
  setLog: React.Dispatch<React.SetStateAction<string[]>>,
  setImages: React.Dispatch<React.SetStateAction<string[]>>,
  setFiles: React.Dispatch<React.SetStateAction<{ path: string; kind: string }[]>>,
  setProjectPath: React.Dispatch<React.SetStateAction<string | null>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  opts: UseSSEOptions,
) {
  switch (msg.type) {
    case 'text':
      setLog(prev => [...prev, msg.text!])
      opts.onText?.(msg.text!)
      break
    case 'tool_use':
      setLog(prev => [...prev, `Calling ${msg.name}...`])
      opts.onToolUse?.(msg.name!, msg.input || {})
      break
    case 'retry': {
      const retry = {
        attempt: msg.attempt || 1,
        delayMs: msg.delayMs || 0,
        provider: msg.provider,
        reason: msg.reason || 'Retrying after a temporary failure',
      }
      setLog(prev => [...prev, `Retry ${retry.attempt}: waiting ${Math.round(retry.delayMs / 1000)}s (${retry.reason})\n`])
      opts.onRetry?.(retry)
      break
    }
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
}

interface LastCallParams {
  skillId: string
  content: string
  selections: Record<string, string>
  opts: UseSSEOptions
  extra: GenerateBodyExtra
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [files, setFiles] = useState<{ path: string; kind: string }[]>([])
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastCallRef = useRef<LastCallParams | null>(null)

  const start = useCallback(async (skillId: string, content: string, selections: Record<string, string>, opts: UseSSEOptions = {}, extra: GenerateBodyExtra = {}) => {
    setIsStreaming(true)
    setLog([])
    setImages([])
    setFiles([])
    setProjectPath(null)
    setError(null)

    lastCallRef.current = { skillId, content, selections, opts, extra }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const runRequest = (endpoint: string, bodyExtra: GenerateBodyExtra) => fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, content, selections, ...bodyExtra, prebuiltPlan: bodyExtra.prebuiltPlan }),
        signal: controller.signal,
      })

      const endpoint = extra.sessionId ? `/api/sessions/${extra.sessionId}/run` : '/api/generate'
      let res = await runRequest(endpoint, extra)

      if (res.status === 404 && extra.sessionId) {
        setLog(prev => [...prev, 'Session was not found on the server. Falling back to a fresh generation request...\n'])
        const { sessionId: _sessionId, ...fallbackExtra } = extra
        lastCallRef.current = { skillId, content, selections, opts, extra: fallbackExtra }
        res = await runRequest('/api/generate', fallbackExtra)
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        const msg = err.error || `HTTP ${res.status}`
        setError(msg)
        opts.onError?.(msg)
        setIsStreaming(false)
        return
      }

      await parseSSEStream<SSEMessage>(res, (msg) => {
        handleSSEMessage(msg, setLog, setImages, setFiles, setProjectPath, setError, opts)
      }, controller.signal)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      const msg = err.message || 'Connection failed'
      setError(msg)
      opts.onError?.(msg)
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const retry = useCallback(() => {
    const last = lastCallRef.current
    if (!last) return
    start(last.skillId, last.content, last.selections, last.opts, last.extra)
  }, [start])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { start, stop, retry, isStreaming, log, images, files, projectPath, error }
}
