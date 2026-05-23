import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import { Settings, ArrowUp, Square, Plus, FolderOpen, FileText, Link2, Check, X } from 'lucide-react'

interface ChatComposerProps {
  chatInput: string
  onInputChange: (value: string) => void
  onSend: () => void
  canSubmit: boolean
  isStreaming: boolean
  isPlanning: boolean
  onStop: () => void
  projectData: any | null
  selectedImage: number | null
  onClearTarget: () => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  configSummary: string
  sourceMode: string
  onSourceModeChange: (mode: string) => void
  sourceRef: string
  onSourceRefChange: (value: string) => void
  uploadedSourceName: string
  uploadStatus: string
  onSourceUpload: (file: File | null) => void
  onGithubVerify?: (url: string) => void
}

export interface ChatComposerHandle {
  focus: () => void
}

const sourceOptions = [
  { mode: 'local', label: '项目文件夹', icon: FolderOpen, hint: '浏览项目目录，传递路径作为生成参考' },
  { mode: 'file', label: '文件', icon: FileText, hint: '上传 .md 文件，基于内容生成图片' },
  { mode: 'github', label: 'GitHub', icon: Link2, hint: '输入仓库链接，解析内容生成图片' },
] as const

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer({
  chatInput, onInputChange, onSend, canSubmit, isStreaming, isPlanning, onStop, projectData,
  selectedImage, onClearTarget,
  isSidebarOpen, onToggleSidebar, configSummary,
  sourceMode, onSourceModeChange, sourceRef, onSourceRefChange,
  uploadedSourceName, uploadStatus, onSourceUpload,
  onGithubVerify,
}, ref) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [githubUrl, setGithubUrl] = useState(sourceRef || '')
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  useEffect(() => {
    if (sourceMode === 'github') setGithubUrl(sourceRef || '')
  }, [sourceMode, sourceRef])

  const hasSource = sourceMode !== 'text'

  const selectMode = (mode: string) => {
    if (sourceMode === mode) {
      onSourceModeChange('text')
      setMenuOpen(false)
    } else {
      onSourceModeChange(mode)
      setMenuOpen(false)
      if (mode === 'file') setTimeout(() => fileInputRef.current?.click(), 100)
      if (mode === 'local') setTimeout(() => dirInputRef.current?.click(), 100)
    }
  }

  const handleDirPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const first = files[0] as any
    const relPath: string = first.webkitRelativePath || first.name || ''
    const dirName = relPath.split('/')[0]
    if (dirName) onSourceRefChange(dirName)
  }

  const handleGithubVerify = async () => {
    if (!githubUrl.trim()) return
    setVerifyStatus('checking')
    onSourceRefChange(githubUrl.trim())
    if (onGithubVerify) {
      onGithubVerify(githubUrl.trim())
      setVerifyStatus('ok')
    } else {
      const valid = /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(githubUrl.trim())
      setVerifyStatus(valid ? 'ok' : 'fail')
    }
  }

  return (
    <div className="px-5 pb-5 pt-2 bg-transparent flex-shrink-0">
      <div className="border border-zinc-700/50 bg-zinc-800/80 backdrop-blur-md rounded-3xl shadow-lg">

        {selectedImage !== null && (
          <div className="flex items-center justify-between bg-indigo-950/40 border-b border-indigo-900/40 text-indigo-400 px-4 py-2 rounded-t-3xl text-xs">
            <span className="font-medium">针对图片 #{selectedImage + 1} 进行修改</span>
            <button onClick={onClearTarget} className="text-indigo-400 hover:text-indigo-300 p-0.5">
              ✕
            </button>
          </div>
        )}

        <textarea
          ref={inputRef}
          value={chatInput}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
              e.preventDefault()
              if (!canSubmit) return
              onSend()
            }
          }}
          placeholder={
            projectData
              ? selectedImage !== null
                ? `描述对图片 #${selectedImage + 1} 的修改要求…`
                : '要求后续变更…'
              : '描述你想设计的内容、人物、文案和布局…'
          }
          className="w-full bg-transparent border-0 text-zinc-100 placeholder-zinc-500 font-sans text-sm focus:outline-none focus-visible:outline-none focus:ring-0 outline-none resize-none min-h-[72px] px-4 pt-4 pb-2"
          aria-label="Chat message input"
        />

        {/* Expanded source input area */}
        {hasSource && (
          <div className="px-4 pb-3 flex flex-col gap-1.5 border-t border-zinc-700/20 pt-3">
            {sourceMode === 'local' && (
              <div className="flex items-center gap-2">
                <input
                  ref={dirInputRef}
                  type="file"
                  // @ts-ignore webkitdirectory is supported in Chrome
                  webkitdirectory=""
                  directory=""
                  onChange={handleDirPick}
                  className="hidden"
                />
                <input
                  type="text"
                  value={sourceRef}
                  onChange={e => onSourceRefChange(e.target.value)}
                  placeholder="输入项目文件夹路径，或通过 + → 项目文件夹 浏览选择…"
                  className="bg-zinc-900/60 border border-zinc-700/60 text-zinc-150 p-2 px-3 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors flex-1"
                />
              </div>
            )}

            {sourceMode === 'file' && (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  onChange={e => onSourceUpload(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {sourceRef && (
                  <div className="flex items-center gap-2">
                    <code className="truncate rounded-xl border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-mono text-zinc-400 max-w-[200px]" title={uploadedSourceName || sourceRef}>
                      {uploadedSourceName || sourceRef}
                    </code>
                    <button
                      onClick={() => { onSourceUpload(null); onSourceRefChange('') }}
                      className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {uploadStatus && (
                  <span className={`text-[10px] ${uploadStatus.toLowerCase().includes('failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {uploadStatus}
                  </span>
                )}
              </div>
            )}

            {sourceMode === 'github' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={e => { setGithubUrl(e.target.value); setVerifyStatus('idle') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleGithubVerify() }}
                  placeholder="https://github.com/owner/repo"
                  className="bg-zinc-900/60 border border-zinc-700/60 text-zinc-150 p-2 px-3 rounded-xl text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors flex-1"
                />
                <button
                  onClick={handleGithubVerify}
                  disabled={verifyStatus === 'checking' || !githubUrl.trim()}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-colors shrink-0 ${
                    verifyStatus === 'ok'
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-600/40'
                      : verifyStatus === 'fail'
                        ? 'bg-red-600/30 text-red-300 border border-red-600/40'
                        : 'bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 hover:text-zinc-100'
                  }`}
                >
                  {verifyStatus === 'checking' ? '检测中…' : verifyStatus === 'ok' ? <Check className="h-3 w-3" /> : verifyStatus === 'fail' ? <X className="h-3 w-3" /> : '检测'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-3 pb-3 pt-2">
          <div className="flex items-center gap-2">
            {/* + button with popup menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center justify-center w-7 h-7 rounded-xl transition-colors ${
                  hasSource
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                    : 'bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40'
                }`}
                title="添加内容源"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 mb-2 z-20 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
                    {sourceOptions.map(opt => {
                      const Icon = opt.icon
                      const active = sourceMode === opt.mode
                      return (
                        <button
                          key={opt.mode}
                          onClick={() => selectMode(opt.mode)}
                          className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-xs transition-colors ${
                            active
                              ? 'bg-indigo-600/20 text-indigo-300'
                              : 'text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-[10px] text-zinc-500">{opt.hint}</span>
                          </div>
                          {active && <Check className="h-3 w-3 ml-auto text-indigo-400" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Settings button */}
            <button
              onClick={onToggleSidebar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
              title="调整生成参数"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{configSummary}</span>
              <span className={`text-zinc-550 text-[10px] transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
          </div>

          {isStreaming || isPlanning ? (
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-red-500 hover:bg-red-400 text-white shadow-sm cursor-pointer"
              aria-label="停止生成"
            >
              <Square className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!canSubmit}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                canSubmit
                  ? 'bg-zinc-100 hover:bg-white text-zinc-900 shadow-sm cursor-pointer'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              }`}
              aria-label="发送"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default ChatComposer
