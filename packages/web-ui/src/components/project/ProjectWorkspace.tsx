import { useState, useEffect, useMemo } from 'react'
import { Image, FileText, Share2, Folder, Terminal, FolderOpen } from 'lucide-react'
import Button from '../ui/Button'
import PlatformPreview from './PlatformPreview'

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

interface ProjectWorkspaceProps {
  projectId: string
  projectPath: string | null
  files: ProjectFile[]
  images: ProjectImage[]
  selectedImage: number | null
  onSelectImage: (index: number | null) => void
  newImages: string[]
  newFiles: Array<{ path: string; kind: string }>
  logs: string[]
  isStreaming: boolean
  onRegenerateImage: (index: number, promptOverride?: string) => Promise<any>
  
  // Platform & publishing state
  platform: string
  onPlatformChange: (platform: string) => void
  caption: string
  onCaptionChange: (caption: string) => void
  isCaptioning: boolean
  onGenerateCaption: () => void
  captionError: string | null
  isPackaging: boolean
  onPreparePackage: () => void
  packageResult: { packagePath: string; files: string[]; images: string[] } | null
  packageError: string | null
  isPublishing: boolean
  onOpenPublisher: () => void
  publishResult: { pid: number; logPath: string; message: string } | null
  publishError: string | null
  xhsAvailable: boolean | null
  publishingAccounts: Array<{ name: string; alias: string; isDefault: boolean; method?: string }>
  publishingAccount: string
  onPublishingAccountChange: (account: string) => void
}

export default function ProjectWorkspace({
  projectId,
  projectPath,
  files,
  images,
  selectedImage,
  onSelectImage,
  newImages,
  newFiles,
  logs,
  isStreaming,
  onRegenerateImage,
  platform,
  onPlatformChange,
  caption,
  onCaptionChange,
  isCaptioning,
  onGenerateCaption,
  captionError,
  isPackaging,
  onPreparePackage,
  packageResult,
  packageError,
  isPublishing,
  onOpenPublisher,
  publishResult,
  publishError,
  xhsAvailable,
  publishingAccounts,
  publishingAccount,
  onPublishingAccountChange,
}: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'gallery' | 'copy' | 'publish' | 'files' | 'logs'>('gallery')
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)
  
  // Track selected versions for each image index
  const [imageVersions, setImageVersions] = useState<Record<number, number>>({})

  // Automatically select first file when switching to 'copy' or 'files'
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      const copyFile = files.find(f => f.kind === 'copy' || f.name === 'copy.md') || files[0]
      setSelectedFile(copyFile)
    }
  }, [files])

  // Get image path for a specific version
  const getVersionPath = (img: ProjectImage, index: number) => {
    const versionIndex = imageVersions[index] ?? (img.versions.length - 1)
    const versionName = img.versions[versionIndex]
    if (!versionName) return img.path

    const url = new URL(img.path, window.location.origin)
    const rawPath = url.searchParams.get('path') || ''
    if (rawPath) {
      const slashIdx = rawPath.lastIndexOf('/')
      const parentDir = slashIdx !== -1 ? rawPath.substring(0, slashIdx) : ''
      const newPath = parentDir ? `${parentDir}/${versionName}` : versionName
      url.searchParams.set('path', newPath)
      return url.pathname + url.search
    }
    return img.path
  }

  // Handle manual single image prompt edit & regeneration
  const [editingImageIdx, setEditingImageIdx] = useState<number | null>(null)
  const [imagePromptOverride, setImagePromptOverride] = useState('')
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false)
  const [singleRegenError, setSingleRegenError] = useState<string | null>(null)

  const handleStartEditPrompt = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingImageIdx(index)
    
    // Find prompt file matching this image number
    const imgNumStr = String(index + 1).padStart(2, '0')
    const promptFile = files.find(f => f.name.includes(`/prompts/${imgNumStr}-`) || f.name.includes(`${imgNumStr}-`))
    if (promptFile && promptFile.content) {
      // Extract prompt content
      const raw = promptFile.content
      const promptMatch = raw.match(/^prompt:\s*(.+)/im) || raw.match(/```[\s\S]*?\n([\s\S]*?)```/)
      setImagePromptOverride(promptMatch ? promptMatch[1].trim() : raw.trim())
    } else {
      setImagePromptOverride('')
    }
    setSingleRegenError(null)
  }

  const handleRunRegenerate = async (index: number) => {
    setIsRegeneratingSingle(true)
    setSingleRegenError(null)
    try {
      const result = await onRegenerateImage(index, imagePromptOverride)
      setEditingImageIdx(null)
      // Update local version index to the newly created version
      setImageVersions(prev => ({
        ...prev,
        [index]: result.version
      }))
    } catch (err: any) {
      setSingleRegenError(err.message || 'Regeneration failed')
    } finally {
      setIsRegeneratingSingle(false)
    }
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-850/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full backdrop-blur-md">
      {/* Workspace Tabs Header */}
      <div className="flex items-center justify-between border-b border-zinc-850 bg-zinc-950/40 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-indigo-400" />
          <span className="text-zinc-300 font-semibold text-sm tracking-wide">Sandbox Workspace</span>
        </div>
        <div className="flex items-center bg-zinc-950/40 border border-zinc-850 p-1 rounded-xl gap-1">
          {[
            { id: 'gallery', label: 'Gallery', icon: Image },
            { id: 'copy', label: 'Copy', icon: FileText },
            { id: 'publish', label: 'Publish', icon: Share2 },
            { id: 'files', label: 'Files', icon: Folder },
            { id: 'logs', label: 'Logs', icon: Terminal },
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/15'
                    : 'text-zinc-400 hover:text-zinc-150 border-transparent hover:bg-zinc-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Workspace Body */}
      <div className="flex-1 overflow-auto p-4">
        
        {/* Tab 1: Gallery */}
        {activeTab === 'gallery' && (
          <div className="h-full flex flex-col gap-4 animate-fade-in">
            {images.length === 0 && newImages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                <svg className="w-12 h-12 mb-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Generated images will appear here.</p>
                <p className="text-xs text-zinc-600 mt-1">Start by sending a prompt to create a plan.</p>
              </div>
            )}
            
            {(images.length > 0 || newImages.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {images.map((img, i) => {
                  const isSelected = selectedImage === i
                  const hasVersions = img.versions.length > 1
                  const currentVerIdx = imageVersions[i] ?? (img.versions.length - 1)
                  const displayPath = getVersionPath(img, i)

                  return (
                    <div
                      key={img.name}
                      onClick={() => onSelectImage(isSelected ? null : i)}
                      className={`group relative border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                        isSelected 
                          ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-zinc-900/60 backdrop-blur-md shadow-lg' 
                          : 'border-zinc-850 bg-zinc-950/30 hover:bg-zinc-950/50 hover:border-zinc-800 backdrop-blur-sm shadow-sm'
                      }`}
                    >
                      {/* Image Viewer */}
                      <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                        <img 
                          src={displayPath} 
                          alt={img.name} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy" 
                        />
                        {/* Selector indicator */}
                        <div className={`absolute top-3 left-3 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black/40 border-white/20 text-transparent'
                        }`}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>

                        {/* Top bar controls: Versions dropdown */}
                        {hasVersions && (
                          <div 
                            className="absolute top-3 right-3 bg-zinc-950/80 border border-zinc-800 text-zinc-300 text-xxs font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1.5"
                            onClick={e => e.stopPropagation()}
                          >
                            <span>Version:</span>
                            <select 
                              value={currentVerIdx} 
                              onChange={e => setImageVersions(prev => ({ ...prev, [i]: Number(e.target.value) }))}
                              className="bg-transparent border-none text-zinc-200 outline-none text-xxs cursor-pointer font-bold"
                            >
                              {img.versions.map((v, vIdx) => (
                                <option key={v} value={vIdx} className="bg-zinc-950 text-zinc-300">
                                  v{vIdx + 1}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Hover Overlay: Modify/Edit buttons */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                          <button
                            type="button"
                            onClick={(e) => handleStartEditPrompt(i, e)}
                            className="bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-700 hover:border-zinc-650 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg flex items-center gap-1.5 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            Fine-tune Prompt
                          </button>
                        </div>
                      </div>

                      {/* Info bar */}
                      <div className="px-3 py-2.5 flex items-center justify-between text-xs border-t border-zinc-850 bg-zinc-950/40 backdrop-blur-sm">
                        <span className="text-zinc-400 font-semibold">{img.name}</span>
                        <a 
                          href={displayPath} 
                          download 
                          onClick={e => e.stopPropagation()} 
                          className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      </div>
                    </div>
                  )
                })}

                {/* Inline loading or incoming image placeholders */}
                {newImages.map((src, idx) => (
                  <div key={`new-${idx}`} className="border border-dashed border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/20 opacity-80">
                    <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center relative">
                      <img src={src} alt="New Generation" className="w-full h-full object-cover" />
                      <div className="absolute top-3 left-3 bg-indigo-600 text-white text-xxs font-bold px-2 py-0.5 rounded-full">
                        Fresh
                      </div>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between text-xs bg-zinc-950/40">
                      <span className={`text-indigo-400 font-semibold ${isStreaming ? 'animate-pulse' : ''}`}>
                        {isStreaming ? 'Incoming image...' : `Image #${idx + 1}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Edit Modal Inline overlay */}
            {editingImageIdx !== null && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-xl w-full overflow-hidden shadow-2xl animate-scale-up">
                  <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-zinc-200 font-semibold text-sm">Fine-tune Prompt for Image #{editingImageIdx + 1}</h3>
                    <button 
                      onClick={() => setEditingImageIdx(null)}
                      className="text-zinc-400 hover:text-zinc-200 font-semibold text-sm p-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <label className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Prompt Override</label>
                    <textarea
                      value={imagePromptOverride}
                      onChange={e => setImagePromptOverride(e.target.value)}
                      placeholder="Write style descriptions, characters, layouts..."
                      className="w-full min-height-[180px] bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-150 p-3 rounded-lg font-sans text-sm focus:border-indigo-500 focus:outline-none resize-y"
                    />
                    {singleRegenError && (
                      <div className="bg-red-950/30 border border-red-800/80 text-red-400 p-2.5 rounded-lg text-xs">
                        {singleRegenError}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 bg-zinc-950/40 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                    <Button 
                      variant="secondary" 
                      onClick={() => setEditingImageIdx(null)}
                      disabled={isRegeneratingSingle}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => handleRunRegenerate(editingImageIdx)}
                      disabled={isRegeneratingSingle}
                    >
                      {isRegeneratingSingle ? 'Regenerating...' : 'Regenerate Single'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Copywriting documents */}
        {activeTab === 'copy' && (
          <div className="h-full grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
            {/* File List Side Column */}
            <div className="md:col-span-1 border border-zinc-850 rounded-2xl bg-zinc-950/40 p-3 flex flex-col gap-1 overflow-auto max-h-[350px] md:max-h-none backdrop-blur-sm">
              <span className="text-zinc-500 text-xxs font-bold uppercase px-2.5 py-1.5 tracking-wider">Project Documents</span>
              {files.filter(f => f.kind !== 'prompt').map(f => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelectedFile(f)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex flex-col gap-0.5 transition-all border ${
                    selectedFile?.path === f.path
                      ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/20 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-150 hover:bg-slate-100 dark:hover:bg-zinc-900/40 border-transparent'
                  }`}
                >
                  <span className="text-zinc-500 text-xxs font-bold uppercase">{f.kind}</span>
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
              {files.filter(f => f.kind !== 'prompt').length === 0 && (
                <span className="text-zinc-600 text-xs px-2.5">No copy files loaded.</span>
              )}
            </div>

            {/* Document preview column */}
            <div className="md:col-span-3 border border-zinc-850 rounded-2xl bg-zinc-950/20 p-4 flex flex-col gap-3 min-h-[300px] backdrop-blur-sm">
              {selectedFile ? (
                <>
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-2.5">
                    <div>
                      <h4 className="text-zinc-250 font-bold text-sm">{selectedFile.name}</h4>
                      <span className="text-zinc-500 text-xxs font-bold uppercase tracking-wider">{selectedFile.kind} · {(selectedFile.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedFile.content) navigator.clipboard.writeText(selectedFile.content)
                      }}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-650 text-zinc-350 hover:text-white text-xs transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-5 4h5m-5 4h5m-2 4h2" />
                      </svg>
                      Copy File
                    </button>
                  </div>
                  <textarea
                    value={selectedFile.content || ''}
                    readOnly
                    className="flex-1 w-full bg-transparent border-0 font-mono text-zinc-300 text-xs leading-relaxed outline-none resize-none focus:ring-0 focus:outline-none min-h-[220px]"
                  />
                </>
              ) : (
                <div className="flex-grow flex items-center justify-center text-zinc-500 text-sm">
                  Select a document on the left to preview.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Publish */}
        {activeTab === 'publish' && (
          <div className="h-full flex flex-col gap-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              
              {/* Controls Column */}
              <div className="border border-zinc-850 rounded-2xl bg-zinc-950/40 p-4 flex flex-col gap-4 backdrop-blur-sm shadow-sm">
                <h4 className="text-zinc-300 font-bold text-xs uppercase tracking-wider border-b border-zinc-900 pb-2">Publish Settings</h4>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-400 text-xs font-bold">Target Platform</label>
                  <select 
                    value={platform} 
                    onChange={e => onPlatformChange(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-150 p-2.5 rounded-lg text-sm focus:border-indigo-500 focus:outline-none outline-none cursor-pointer font-semibold"
                  >
                    <option value="xiaohongshu">Little Red Book (小红书)</option>
                    <option value="wechat">WeChat Official Account (微信公众号)</option>
                    <option value="weibo">Sina Weibo (微博)</option>
                    <option value="x">X / Twitter</option>
                  </select>
                </div>

                {platform === 'wechat' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-400 text-xs font-bold">Publishing Account</label>
                    {publishingAccounts.length > 0 ? (
                      <select 
                        value={publishingAccount} 
                        onChange={e => onPublishingAccountChange(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-150 p-2.5 rounded-lg text-sm focus:border-indigo-500 focus:outline-none outline-none cursor-pointer"
                      >
                        {publishingAccounts.map(account => (
                          <option key={account.alias} value={account.alias}>
                            {account.name}{account.isDefault ? ' (Default)' : ''} {account.method ? `· ${account.method}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-amber-500 text-xs border border-amber-950 bg-amber-950/20 p-2.5 rounded-lg">
                        No WeChat Accounts configured. Go to <strong>Settings</strong> to configure.
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-400 text-xs font-bold">Share Text / Caption</label>
                    <Button 
                      disabled={isCaptioning}
                      onClick={onGenerateCaption}
                      className="px-2 py-0.5 text-xxs font-bold uppercase text-indigo-400 bg-indigo-950 border border-indigo-900 hover:bg-indigo-900 transition-colors rounded"
                    >
                      {isCaptioning ? 'Generating...' : '✨ Generate Caption'}
                    </Button>
                  </div>
                  <textarea
                    value={caption}
                    onChange={e => onCaptionChange(e.target.value)}
                    placeholder="Provide hashtags, title, description..."
                    className="w-full min-height-[120px] bg-zinc-900 border border-zinc-800 text-zinc-150 p-3 rounded-lg text-sm resize-y focus:border-indigo-500 focus:outline-none"
                  />
                  {captionError && <div className="text-red-400 text-xs">{captionError}</div>}
                </div>

                <div className="flex items-center gap-2.5 border-t border-zinc-900 pt-3">
                  <Button
                    onClick={onPreparePackage}
                    disabled={!projectPath || images.length === 0 || isPackaging}
                    className="flex-1 flex items-center justify-center gap-1.5"
                  >
                    {isPackaging ? (
                      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Preparing...</span>
                    ) : (
                      '📦 Prepare Assets'
                    )}
                  </Button>
                  <Button
                    onClick={onOpenPublisher}
                    disabled={!packageResult || (platform === 'xiaohongshu' && !xhsAvailable) || isPublishing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                  >
                    {isPublishing ? (
                      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Opening...</span>
                    ) : platform === 'xiaohongshu' && xhsAvailable === false ? (
                      '❌ Package Only'
                    ) : (
                      '🌐 Autofill in Browser'
                    )}
                  </Button>
                </div>

                {packageResult && (
                  <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-lg flex flex-col gap-1 text-xs">
                    <span className="text-zinc-500 font-bold uppercase">Asset Bundle Ready</span>
                    <code className="text-emerald-400 truncate">{packageResult.packagePath}</code>
                    <span className="text-zinc-400">{packageResult.images.length} images · {packageResult.files.length} texts</span>
                  </div>
                )}

                {publishResult && (
                  <div className="bg-emerald-950/20 border border-emerald-900/50 p-2.5 rounded-lg flex flex-col gap-1 text-xs text-emerald-400">
                    <span className="font-bold uppercase text-emerald-400">Autofill Browser Spawned</span>
                    <code className="truncate">{publishResult.logPath}</code>
                    <span>PID: {publishResult.pid} · Please check and submit in the opened Chrome window.</span>
                  </div>
                )}

                {publishError && <div className="text-red-400 text-xs border border-red-950 bg-red-950/20 p-2.5 rounded-lg">{publishError}</div>}
                {packageError && <div className="text-red-400 text-xs border border-red-950 bg-red-950/20 p-2.5 rounded-lg">{packageError}</div>}
              </div>

              {/* Preview Column */}
              <div className="flex flex-col gap-4">
                <PlatformPreview
                  platform={platform}
                  projectPath={projectPath}
                  images={images.map(img => getVersionPath(img, images.indexOf(img)))}
                  caption={caption}
                  imageCount={images.length || 1}
                />
                
                {platform === 'xiaohongshu' && xhsAvailable === false && (
                  <div className="bg-amber-950/20 border border-amber-900/60 p-3 rounded-lg text-amber-500 text-xs flex gap-2">
                    <span>⚠️</span>
                    <span>Little Red Book posting skill is not installed. You can still prepare asset bundles and upload them manually.</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Tab 4: File Explorer */}
        {activeTab === 'files' && (
          <div className="h-full flex flex-col gap-4 animate-fade-in">
            {projectPath && (
              <div className="bg-zinc-950 border border-zinc-850 px-3 py-1.5 rounded-lg text-zinc-500 text-xxs font-mono truncate select-all">
                Directory: {projectPath}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start flex-1 min-h-[300px]">
              {/* File tree browser */}
              <div className="md:col-span-1 border border-zinc-850 rounded-2xl bg-zinc-950/40 p-3 flex flex-col gap-1 max-h-[350px] md:max-h-none overflow-auto backdrop-blur-sm">
                <span className="text-zinc-500 text-xxs font-bold uppercase px-2.5 py-1.5 tracking-wider">All Project Outputs</span>
                {files.map(f => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFile(f)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                      selectedFile?.path === f.path
                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/20 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-150 hover:bg-slate-100 dark:hover:bg-zinc-900/40 border-transparent'
                    }`}
                  >
                    <span className="truncate pr-2">{f.name}</span>
                    <span className="text-xxs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold uppercase">{f.kind}</span>
                  </button>
                ))}
                {files.length === 0 && (
                  <span className="text-zinc-600 text-xs px-2.5">No files found.</span>
                )}
              </div>

              {/* Raw contents preview */}
              <div className="md:col-span-3 border border-zinc-850 rounded-2xl bg-zinc-950/20 p-4 flex flex-col gap-2 flex-grow min-h-[220px] backdrop-blur-sm">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                      <div>
                        <h4 className="text-zinc-350 font-bold text-xs">{selectedFile.name}</h4>
                        <span className="text-zinc-500 text-xxs uppercase">{(selectedFile.size / 1024).toFixed(2)} KB · Path: {selectedFile.path}</span>
                      </div>
                    </div>
                    <pre className="flex-1 w-full bg-zinc-950/40 p-3 rounded-lg font-mono text-zinc-300 text-xs leading-relaxed overflow-auto max-h-[400px]">
                      {selectedFile.content || 'Binary or empty file.'}
                    </pre>
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-zinc-500 text-sm">
                    Select any output file on the left to inspect its contents.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Logs */}
        {activeTab === 'logs' && (
          <div className="h-full flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">CLI execution output log</span>
              {isStreaming && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-400 animate-pulse font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow shadow-indigo-500/50"></span>
                  Active Process Running...
                </span>
              )}
            </div>
            
            <div className="bg-zinc-950/85 border border-zinc-850 rounded-2xl p-4 font-mono text-xs text-zinc-300 leading-relaxed overflow-auto min-h-[300px] max-h-[450px] shadow-inner select-text backdrop-blur-sm">
              {logs.length === 0 ? (
                <span className="text-zinc-650 italic">Logs are empty. Run generation to stream terminal logs.</span>
              ) : (
                <div className="whitespace-pre-wrap">{logs.join('')}</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
