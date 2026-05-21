import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProjectChat } from '../hooks/useProjectChat'
import ChatPanel from '../components/project/ChatPanel'
import ImageCompare from '../components/project/ImageCompare'
import ProjectFileList from '../components/project/ProjectFileList'
import Button from '../components/ui/Button'
import BackToStudioButton from '../components/ui/BackToStudioButton'

interface ProjectFile {
  name: string
  path: string
  kind: string
  size: number
  content?: string
}

interface ProjectImage {
  name: string
  path: string
  versions: string[]
}

interface ConversationSession {
  timestamp: string
  message: string
  target: { type: string; index?: number } | null
  plan: string
  changes: Array<{ file: string; kind: string; image?: string; version?: number }>
}

interface ProjectData {
  id: string
  name: string
  path: string
  categoryDir: string
  files: ProjectFile[]
  images: ProjectImage[]
  conversations: ConversationSession[]
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)

  const { sendMessage, stop, isStreaming, plan, logs, newImages, newFiles, error } = useProjectChat(id || '')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    fetch(`/api/projects/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (data.error) throw new Error(data.error)
        setProject(data)
      })
      .catch(err => setLoadError(err.message || 'Failed to load project'))
      .finally(() => setLoading(false))
  }, [id])

  const handleChatSend = useCallback((message: string, target?: { type: string; index?: number }) => {
    sendMessage(message, target)
  }, [sendMessage])

  if (loading) {
    return (
      <div className="project-detail">
        <div className="project-detail-loading">
          <p>Loading project...</p>
        </div>
      </div>
    )
  }

  if (loadError || !project) {
    return (
      <div className="project-detail">
        <div className="studio-error">{loadError || 'Project not found'}</div>
        <Link to="/history" className="no-underline">
          <Button variant="ghost">Back to History</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="project-detail">
      <header className="project-detail-header">
        <div>
          <Link to="/history" className="project-back-link">&larr; 历史</Link>
          <p className="studio-eyebrow">{project.categoryDir}</p>
          <h1>{project.name}</h1>
          <code>{project.path}</code>
        </div>
        <div className="project-meta">
          <span>{project.images.length} images</span>
          <span>{project.files.length} files</span>
          <span>{project.conversations.length} chats</span>
        </div>
        <BackToStudioButton />
      </header>

      <div className="project-detail-body">
        <aside className="project-detail-sidebar">
          <ProjectFileList
            files={project.files}
            onSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
        </aside>

        <main className="project-detail-main">
          <section className="studio-panel">
            <div className="studio-panel-head">
              <div>
                <p className="studio-eyebrow">images</p>
                <h2>
                  图片
                  {selectedImage !== null && (
                    <span className="project-selected-label"> · 选中第 {selectedImage + 1} 张</span>
                  )}
                </h2>
              </div>
              <span>{project.images.length}</span>
            </div>
            <ImageCompare
              images={project.images}
              newImages={newImages}
              selectedImage={selectedImage}
              onSelect={setSelectedImage}
            />
          </section>

          <ChatPanel
            onSend={handleChatSend}
            onStop={stop}
            isStreaming={isStreaming}
            plan={plan}
            logs={logs}
            error={error}
            selectedImage={selectedImage}
            disabled={project.images.length === 0 && project.files.length === 0}
          />

          {selectedFile?.content && (
            <section className="studio-panel">
              <div className="studio-panel-head">
                <div>
                  <p className="studio-eyebrow">file preview</p>
                  <h2>{selectedFile.name}</h2>
                </div>
                <span>{selectedFile.kind}</span>
              </div>
              <pre className="project-file-preview">{selectedFile.content}</pre>
            </section>
          )}

          {project.conversations.length > 0 && (
            <section className="studio-panel">
              <div className="studio-panel-head">
                <div>
                  <p className="studio-eyebrow">conversation history</p>
                  <h2>修改记录</h2>
                </div>
                <span>{project.conversations.length}</span>
              </div>
              <div className="project-conversation-list">
                {project.conversations.slice().reverse().map((conv, i) => (
                  <article key={i} className="project-conversation-item">
                    <div className="project-conversation-meta">
                      <strong>{conv.message}</strong>
                      <time>{new Date(conv.timestamp).toLocaleString()}</time>
                    </div>
                    <p>{conv.plan}</p>
                    <div className="project-conversation-changes">
                      {conv.changes.map((c, j) => (
                        <span key={j}>{c.kind}: {c.file}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
