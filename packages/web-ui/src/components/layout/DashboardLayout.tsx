import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MessageSquare, Compass, History, Settings, PanelLeftClose, PanelLeftOpen, Plus, Trash2, PenLine } from 'lucide-react'

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

interface ProjectSummary {
  id: string
  detailId?: string
  name: string
  path: string
  images: string[]
  updatedAt: number
}

function projectToSessionItem(p: ProjectSummary): SessionPreview {
  return {
    id: `proj-${p.path}`,
    title: p.name,
    status: 'done',
    lastMessage: '',
    imageCount: p.images?.length || 0,
    artifactCount: 0,
    projectPath: p.path,
    createdAt: new Date(p.updatedAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
  }
}

function mergeSessionsAndProjects(sessions: SessionPreview[], projects: ProjectSummary[]): SessionPreview[] {
  const sessionProjectPaths = new Set(
    sessions
      .filter(s => s.projectPath)
      .map(s => s.projectPath!.replace(/\/+$/, ''))
  )
  const merged = [...sessions]
  for (const p of projects) {
    const normalizedPath = p.path.replace(/\/+$/, '')
    if (!sessionProjectPaths.has(normalizedPath)) {
      merged.push(projectToSessionItem(p))
    }
  }
  return merged
}

function encodeProjectId(path: string) {
  const bytes = new TextEncoder().encode(path)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export default function DashboardLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('happyimage-sidebar-collapsed') === 'true'
  })
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => {
    window.localStorage.setItem('happyimage-sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  const fetchSessions = () => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setSessions(data) })
      .catch(() => {})
  }

  const fetchProjects = () => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setProjects(data) })
      .catch(() => {})
  }

  useEffect(() => { fetchSessions(); fetchProjects() }, [])
  useEffect(() => { fetchSessions(); fetchProjects() }, [location.search])
  useEffect(() => {
    const onFocus = () => { fetchSessions(); fetchProjects() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const handleNewChat = async () => {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      const data = await res.json()
      if (data.session?.id) {
        await fetchSessions()
        navigate(`/?session=${data.session.id}`)
      }
    } catch { navigate('/') }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const startRename = (id: string, title: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(id)
    setEditTitle(title)
  }

  const confirmRename = async (id: string) => {
    if (editTitle.trim()) {
      await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      })
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s))
    }
    setEditingId(null)
  }

  const isSidebarActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname.startsWith('/projects/')
    return location.pathname.startsWith(path)
  }

  const activeSessionId = new URLSearchParams(location.search).get('session')

  const merged = mergeSessionsAndProjects(sessions, projects)
  const sorted = [...merged].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const isProjectEntry = (s: SessionPreview) => s.id.startsWith('proj-')

  return (
    <div className={`min-h-screen grid ${isCollapsed ? 'grid-cols-[64px_1fr]' : 'grid-cols-[260px_1fr]'} bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden transition-[grid-template-columns] duration-200`}>

      <aside className="p-4 border-r border-zinc-850 bg-zinc-950/80 flex flex-col gap-4 h-screen sticky top-0 z-20 backdrop-blur-md shadow-lg transition-all duration-200">
        {/* Logo */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          <Link to="/" className={`flex items-center no-underline group ${isCollapsed ? 'w-8 h-8 justify-center p-0' : 'gap-2.5 px-2'}`} title="HappyImage">
            <img src="/logo.svg" className="w-8 h-8 object-contain group-hover:scale-105 transition-transform" alt="HappyImage Logo" />
            {!isCollapsed && <div className="flex flex-col">
              <span className="text-zinc-100 font-extrabold text-sm tracking-wide leading-none">HappyImage</span>
              <span className="text-zinc-400 text-[9px] font-extrabold uppercase tracking-widest mt-1">Workspace</span>
            </div>}
          </Link>
          {!isCollapsed && (
            <button type="button" onClick={() => setIsCollapsed(true)} title="折叠侧边栏" className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button type="button" onClick={() => setIsCollapsed(false)} title="展开侧边栏" className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* New Chat button */}
        <button
          onClick={handleNewChat}
          className={`flex items-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 border border-zinc-700/50 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 ${isCollapsed ? 'w-8 h-8 justify-center p-0' : 'px-3 py-2'}`}
          title="+ New Chat"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>New Chat</span>}
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1">
          {[
            { to: '/gallery', label: 'Styles Gallery', icon: Compass },
            { to: '/history', label: 'Projects History', icon: History },
            { to: '/settings', label: 'Settings', icon: Settings },
          ].map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-all duration-200 border no-underline group ${
                  isCollapsed ? 'w-8 h-8 justify-center p-0' : 'gap-3 px-3 py-2'
                } ${
                  isSidebarActive(item.to)
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 transition-transform group-hover:scale-105 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Session list */}
        {!isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5 shrink-0">
              All Projects
            </div>
            <div className="flex-1 overflow-y-auto session-sidebar-scroll space-y-0.5">
              {sorted.length === 0 && (
                <p className="text-xs text-zinc-600 px-2 py-4 text-center">No chats yet</p>
              )}
              {sorted.map(s => (
                <Link
                  key={s.id}
                  to={s.projectPath
                    ? isProjectEntry(s)
                      ? `/projects/${encodeProjectId(s.projectPath)}`
                      : `/projects/${encodeProjectId(s.projectPath)}?session=${s.id}`
                    : `/?session=${s.id}`}
                  className={`group flex flex-col px-2 py-1.5 rounded-lg text-left transition-colors no-underline relative ${
                    activeSessionId === s.id || (isProjectEntry(s) && location.pathname.startsWith('/projects/'))
                      ? 'bg-indigo-950/30 border-l-2 border-l-indigo-500'
                      : 'hover:bg-zinc-800/50 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {editingId === s.id ? (
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => confirmRename(s.id)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmRename(s.id); if (e.key === 'Escape') setEditingId(null) }}
                        onClick={e => e.preventDefault()}
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                        autoFocus
                      />
                    ) : (
                      <span className={`text-xs font-medium truncate flex-1 ${activeSessionId === s.id ? 'text-zinc-100' : 'text-zinc-300'}`}>
                        {s.title || 'New Chat'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500 truncate flex-1">
                      {s.lastMessage || (s.title ? '' : 'New Chat')}
                    </span>
                    {s.status === 'generating' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />}
                    {s.imageCount > 0 && <span className="text-[9px] text-zinc-600 shrink-0">{s.imageCount} img</span>}
                  </div>
                  {!isProjectEntry(s) && (
                  <div className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => startRename(s.id, s.title, e)}
                      className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Rename"
                    >
                      <PenLine className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(s.id, e)}
                      className="p-0.5 rounded hover:bg-red-950/50 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex flex-col h-screen overflow-hidden relative bg-zinc-950 text-zinc-100">
        <Outlet />
      </main>
    </div>
  )
}
