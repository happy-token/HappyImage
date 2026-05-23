import { useState, useEffect, useCallback, useRef } from 'react'

interface SessionPreview {
  id: string
  title: string
  status: string
  lastMessage: string
  imageCount: number
  artifactCount: number
  projectPath?: string
  createdAt: string
  updatedAt: string
}

export function useSessionManager() {
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const creatingRef = useRef(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      if (Array.isArray(data)) setSessions(data)
    } catch { /* ignore fetch errors */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const createSession = useCallback(async (): Promise<string | null> => {
    if (creatingRef.current) return null
    creatingRef.current = true
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      const data = await res.json()
      const id = data.session?.id
      if (id) {
        await fetchSessions()
        setActiveId(id)
        return id
      }
    } catch { /* ignore */ }
    finally { creatingRef.current = false }
    return null
  }, [fetchSessions])

  const switchSession = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const renameSession = useCallback(async (id: string, title: string) => {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeId === id) setActiveId(null)
  }, [activeId])

  return { sessions, activeId, setActiveId, loading, createSession, switchSession, renameSession, deleteSession, refreshSessions: fetchSessions }
}
