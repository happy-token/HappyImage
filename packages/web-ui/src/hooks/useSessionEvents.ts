import { useState, useEffect, useRef, useCallback } from 'react'
import { parseSSEStream } from '../lib/sse'

interface SessionArtifact {
  id: string
  type: string
  path: string
  url?: string
  title?: string
  version?: number
}

interface SessionTask {
  id: string
  kind: string
  status: string
  commandId?: string
  projectPath?: string
  error?: string
}

interface SessionEvent {
  seq: number
  type: string
  [key: string]: unknown
}

interface SessionState {
  id: string
  status: string
  projectPath?: string
  activeProjectPath?: string
  commandRequest?: { commandId: string; source: { type: string; value: string }; options: Record<string, string> }
}

interface SessionData {
  session: SessionState
  activeTask: SessionTask | null
  events: SessionEvent[]
  artifacts?: SessionArtifact[]
}

export function useSessionEvents(sessionId: string | null) {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [artifacts, setArtifacts] = useState<SessionArtifact[]>([])
  const [activeTask, setActiveTask] = useState<SessionTask | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSeqRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const fetchInitial = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/events`)
      if (res.status === 404) {
        setError('session_not_found')
        return
      }
      const data: SessionData = await res.json()
      setSession(data.session)
      setActiveTask(data.activeTask)
      if (data.events) {
        setEvents(data.events)
        if (data.events.length > 0) {
          lastSeqRef.current = data.events[data.events.length - 1].seq
        }
      }
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load session')
    }
  }, [sessionId])

  const connectStream = useCallback(async () => {
    if (!sessionId) return
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/sessions/${sessionId}/stream?after=${lastSeqRef.current}`, {
        signal: controller.signal,
      })
      if (!res.ok) return

      setIsStreaming(true)
      await parseSSEStream(res, (msg: any) => {
        switch (msg.type) {
          case 'replay':
            if (msg.event) {
              setEvents(prev => [...prev, msg.event])
              lastSeqRef.current = Math.max(lastSeqRef.current, msg.event.seq || 0)
            }
            break
          case 'text':
          case 'tool_use':
          case 'image':
          case 'file':
          case 'retry':
          case 'error':
          case 'project':
            setEvents(prev => [...prev, msg])
            break
          case 'resume':
            setActiveTask(prev => prev ? { ...prev, status: 'running' } : null)
            break
          case 'done':
            if (msg.artifacts) setArtifacts(msg.artifacts)
            if (msg.status) setSession(prev => prev ? { ...prev, status: msg.status } : null)
            setActiveTask(null)
            setIsStreaming(false)
            break
        }
      }, controller.signal)
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Stream connection failed')
    } finally {
      setIsStreaming(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  useEffect(() => {
    if (!session || !activeTask) return
    if (activeTask.status === 'running') {
      connectStream()
    }
    return () => { abortRef.current?.abort() }
  }, [session?.id, activeTask?.id, activeTask?.status, connectStream])

  const disconnect = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { session, events, artifacts, activeTask, isStreaming, error, refetch: fetchInitial, disconnect }
}
