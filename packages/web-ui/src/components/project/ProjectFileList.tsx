interface ProjectFile {
  name: string
  path: string
  kind: string
  size: number
  content?: string
}

interface ProjectFileListProps {
  files: ProjectFile[]
  onSelect: (file: ProjectFile) => void
  selectedFile: ProjectFile | null
}

const kindLabels: Record<string, string> = {
  source: 'Source',
  analysis: 'Analysis',
  outline: 'Outline',
  copy: 'Copy',
  prompt: 'Prompt',
  conversation: 'History',
  file: 'File',
}

export default function ProjectFileList({ files, onSelect, selectedFile }: ProjectFileListProps) {
  const promptFiles = files.filter(f => f.kind === 'prompt')
  const docFiles = files.filter(f => f.kind !== 'prompt')

  return (
    <div className="project-files">
      {docFiles.length > 0 && (
        <div className="project-files-section">
          <p className="studio-eyebrow">documents</p>
          {docFiles.map(f => (
            <button
              key={f.path}
              type="button"
              className={`project-file-item ${selectedFile?.path === f.path ? 'project-file-active' : ''}`}
              onClick={() => onSelect(f)}
            >
              <strong>{kindLabels[f.kind] || f.kind}</strong>
              <code>{f.name}</code>
            </button>
          ))}
        </div>
      )}

      {promptFiles.length > 0 && (
        <div className="project-files-section">
          <p className="studio-eyebrow">prompts</p>
          {promptFiles.map(f => (
            <button
              key={f.path}
              type="button"
              className={`project-file-item ${selectedFile?.path === f.path ? 'project-file-active' : ''}`}
              onClick={() => onSelect(f)}
            >
              <code>{f.name}</code>
            </button>
          ))}
        </div>
      )}

      {files.length === 0 && <div className="studio-empty">No files found</div>}
    </div>
  )
}
