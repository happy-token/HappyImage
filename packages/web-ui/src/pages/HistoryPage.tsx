import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, FolderOpen, Loader2, Image, Sparkles } from 'lucide-react'
import BackToStudioButton from '../components/ui/BackToStudioButton'

interface ProjectItem {
  id: string
  detailId?: string
  skillDir: string
  name: string
  path: string
  updatedAt: number
  images: string[]
  hasSource: boolean
  hasAnalysis: boolean
  hasOutline: boolean
  hasCopy: boolean
  promptCount: number
}

function encodeProjectId(id: string) {
  const bytes = new TextEncoder().encode(id)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  const deleteProject = async (project: ProjectItem) => {
    if (!window.confirm(`Delete project "${project.name}"? This removes the project folder from disk.`)) return

    setDeletingProjectId(project.id)
    setDeleteError('')
    try {
      const projectId = project.detailId || encodeProjectId(project.id)
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete project')
      setProjects(prev => prev.filter(item => item.id !== project.id))
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete project')
    } finally {
      setDeletingProjectId(null)
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-zinc-950 text-zinc-100 animate-fade-in">
      <div className="history-page p-6 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* Header section */}
      <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">History Dashboard</p>
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-zinc-50 via-zinc-250 to-zinc-400 bg-clip-text text-transparent">Generated Projects</h1>
        </div>
        <BackToStudioButton />
      </header>

      {/* Main layout grids */}
      <div className="flex flex-col gap-8">
        
        {/* Section 1: Disk Projects (Hono Backend Saved) */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-5">
            <div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Disk Repository</p>
              <h2 className="text-lg font-bold text-zinc-250">Active Workspaces</h2>
            </div>
            <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {projects.length} Found
            </span>
          </div>
          {deleteError && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {deleteError}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
              Scanning output repository...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500">
              <FolderOpen className="w-12 h-12 mb-3 text-zinc-650 mx-auto" />
              <p className="text-sm font-medium">No saved projects found in output directory.</p>
              <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold text-xs mt-2 inline-block">
                Start new creation →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map(project => (
                <article
                  key={project.id} 
                  className="history-project group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10"
                >
                  <Link
                    to={`/projects/${project.detailId || encodeProjectId(project.id)}`}
                    className="flex h-full flex-col no-underline"
                  >
                    
                    {/* Visual Preview Banner */}
                    <div className="history-project-images aspect-[16/9] bg-zinc-950 flex gap-0.5 p-1 border-b border-zinc-800 overflow-hidden">
                      {project.images.length > 0 ? (
                        project.images.slice(0, 3).map((src, i) => (
                          <img 
                            key={`${src}-${i}`} 
                            src={src} 
                            alt="" 
                            className="flex-1 object-cover h-full min-w-0 transition-transform group-hover:scale-[1.02]" 
                            loading="lazy" 
                          />
                        ))
                      ) : (
                        <div className="flex-grow flex items-center justify-center text-zinc-500 text-xs gap-1.5 bg-zinc-900/40">
                          <Image className="w-4 h-4 opacity-70" />
                          <span>No Image Assets</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata body */}
                    <div className="p-4 pb-12 flex-grow flex flex-col justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-550 font-bold uppercase w-fit tracking-wider">
                            {project.skillDir}
                          </span>
                        </div>
                        <h3 className="text-zinc-200 font-bold text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                        <code className="text-[10px] text-zinc-550 truncate font-mono mt-1">{project.path}</code>
                      </div>

                      {/* File types indicators & triggers count */}
                      <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 pt-3">
                        {project.hasAnalysis && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">Analysis</span>
                        )}
                        {project.hasOutline && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">Outline</span>
                        )}
                        {project.hasCopy && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">Copy</span>
                        )}
                        {project.hasSource && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Source</span>
                        )}
                        <span className="text-[10px] font-bold text-zinc-500 ml-auto self-center">
                          {project.promptCount} Prompts
                        </span>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    disabled={deletingProjectId === project.id}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      deleteProject(project)
                    }}
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                    className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-850 bg-zinc-900 text-zinc-500 shadow-sm transition hover:border-red-500/50 dark:hover:border-red-900/70 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-300 disabled:cursor-wait disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  </div>
  )
}
