import { useState } from 'react'
import { Plus, MessageSquare, Trash2, PenLine, X } from 'lucide-react'

interface SessionPreview {
  id: string
  title: string
  status: string
  lastMessage: string
  imageCount: number
  artifactCount: number
  createdAt: string
  updatedAt: string
}

interface SessionSidebarProps {
  sessions: SessionPreview[]
  activeId: string | null
  loading: boolean
  onCreate: () => void
  onSwitch: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function SessionSidebar({ sessions, activeId, loading, onCreate, onSwitch, onRename, onDelete, onClose }: SessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const confirmRename = (id: string) => {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim())
    }
    setEditingId(null)
  }

  const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return (
    <div className="w-72 shrink-0 border-r border-zinc-900 bg-zinc-950/95 backdrop-blur-md flex flex-col h-full absolute lg:relative z-30 lg:z-auto shadow-2xl lg:shadow-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
        <h2 className="text-sm font-bold text-zinc-200">Sessions</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreate}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="New session"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors lg:hidden"
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto session-sidebar-scroll">
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            No sessions yet. Click + to start.
          </div>
        )}

        {sorted.map(s => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => onSwitch(s.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitch(s.id) } }}
            className={`relative w-full text-left px-4 py-3 border-b border-zinc-900/50 transition-colors group cursor-pointer ${
              s.id === activeId
                ? 'bg-indigo-950/30 border-l-2 border-l-indigo-500'
                : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${s.id === activeId ? 'text-indigo-400' : 'text-zinc-500'}`} />
              {editingId === s.id ? (
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => confirmRename(s.id)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmRename(s.id); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                  autoFocus
                />
              ) : (
                <span className={`text-sm font-medium truncate ${s.id === activeId ? 'text-zinc-100' : 'text-zinc-300'}`}>
                  {s.title || 'New Chat'}
                </span>
              )}
            </div>

            <p className="mt-0.5 ml-5.5 text-xs text-zinc-500 truncate">
              {s.lastMessage || 'Empty conversation'}
            </p>

            <div className="mt-1 ml-5.5 flex items-center gap-2 text-xxs text-zinc-600">
              {s.status === 'generating' && <span className="text-indigo-400 animate-pulse">Generating...</span>}
              {s.imageCount > 0 && <span>{s.imageCount} images</span>}
              <span>{timeAgo(s.updatedAt)}</span>
            </div>

            <div className="absolute right-3 top-3 hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={e => { e.stopPropagation(); startRename(s.id, s.title) }}
                className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Rename"
              >
                <PenLine className="h-3 w-3" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                className="p-1 rounded hover:bg-red-950/50 text-zinc-500 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
