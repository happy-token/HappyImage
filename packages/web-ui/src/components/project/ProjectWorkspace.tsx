import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Share2, MoreHorizontal, Folder, Terminal, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import Button from '../ui/Button'
import PlatformPreview from './PlatformPreview'
import { useAppLanguage, type AppLanguage } from '../../i18n/settings'

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
  aspectRatio?: string
}

function L(lang: AppLanguage, zh: string, en: string) {
  return lang === 'en' ? en : zh
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
  aspectRatio = '1:1',
}: ProjectWorkspaceProps) {
  const lang = useAppLanguage()
  const [activeTab, setActiveTab] = useState<'gallery' | 'publish'>('gallery')
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)

  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [moreView, setMoreView] = useState<'off' | 'files' | 'logs'>('off')
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!showMoreMenu) return
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMoreMenu])
  
  // Track selected versions for each image index
  const [imageVersions, setImageVersions] = useState<Record<number, number>>({})

  // Automatically select first file when switching to 'copy' or 'files'
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      const copyFile = files.find(f => f.kind === 'copy') || files[0]
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

  return (
    <div className="bg-zinc-900/60 border border-zinc-850/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full backdrop-blur-md">

      {/* === Gallery view === */}
      {activeTab === 'gallery' && moreView === 'off' && (
        <div className="flex flex-col h-full animate-fade-in">
          {/* Action row */}
          <div className="flex items-center justify-end gap-1.5 px-3 py-2 flex-shrink-0 border-b border-zinc-850/50">
            <button
              onClick={() => setActiveTab('publish')}
              disabled={images.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                images.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              {L(lang, '发布', 'Publish')}
            </button>
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(v => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                  showMoreMenu
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-800/60'
                }`}
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden min-w-[120px] animate-fade-in">
                  <button
                    onClick={() => { setMoreView('files'); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-150 hover:bg-zinc-800 transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {L(lang, '文件', 'Files')}
                  </button>
                  <button
                    onClick={() => { setMoreView('logs'); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-150 hover:bg-zinc-800 transition-colors border-t border-zinc-800/60"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    {L(lang, '日志', 'Logs')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Image grid */}
          <div className="flex-1 overflow-auto p-3">
            {images.length === 0 && newImages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                <svg className="w-12 h-12 mb-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">{L(lang, '生成的图片将显示在这里', 'Generated images will appear here')}</p>
                <p className="text-xs text-zinc-600 mt-1">{L(lang, '发送提示词开始生成', 'Send a prompt to start generating')}</p>
              </div>
            )}

            {(images.length > 0 || newImages.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {images.map((img, i) => {
                  const hasVersions = img.versions.length > 1
                  const currentVerIdx = imageVersions[i] ?? (img.versions.length - 1)
                  const displayPath = getVersionPath(img, i)

                  return (
                    <div
                      key={img.name}
                      className="group relative border border-zinc-850 bg-zinc-950/30 hover:bg-zinc-950/50 hover:border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 backdrop-blur-sm shadow-sm"
                    >
                      <div
                        className="bg-zinc-950 flex items-center justify-center relative overflow-hidden cursor-zoom-in"
                        onClick={() => setLightboxIdx(i)}
                      >
                        <img
                          src={displayPath}
                          alt={img.name}
                          className="w-full h-auto block transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 z-10 bg-black/40 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-8 h-8 text-white/70" />
                        </div>
                      </div>

                      <div className="px-2.5 py-2 flex items-center justify-between text-xs border-t border-zinc-850 bg-zinc-950/40 gap-1" onClick={e => e.stopPropagation()}>
                        <span className="text-zinc-400 font-semibold truncate flex-1 min-w-0">{img.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => onSelectImage(i)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-150 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors"
                            title={L(lang, '修改', 'Edit')}
                          >
                            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          {hasVersions && (
                            <select
                              value={currentVerIdx}
                              onChange={e => setImageVersions(prev => ({ ...prev, [i]: Number(e.target.value) }))}
                              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-1 py-0.5 outline-none cursor-pointer font-semibold"
                            >
                              {img.versions.map((v, vIdx) => (
                                <option key={v} value={vIdx} className="bg-zinc-950 text-zinc-300">
                                  v{vIdx + 1}
                                </option>
                              ))}
                            </select>
                          )}
                          <a
                            href={displayPath}
                            download
                            className="p-1 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors"
                            title={L(lang, '下载', 'Download')}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {newImages.map((src, idx) => (
                  <div key={`new-${idx}`} className="border border-dashed border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/20 opacity-80">
                    <div className="bg-zinc-950 flex items-center justify-center relative">
                      <img src={src} alt="New Generation" className="w-full h-auto block" />
                      <div className="absolute top-3 left-3 bg-indigo-600 text-white text-xxs font-bold px-2 py-0.5 rounded-full">
                        {L(lang, '新生成', 'New')}
                      </div>
                    </div>
                    <div className="px-2.5 py-2 text-xs bg-zinc-950/40">
                      <span className={`text-indigo-400 font-semibold ${isStreaming ? 'animate-pulse' : ''}`}>
                        {isStreaming ? L(lang, '生成中...', 'Generating...') : L(lang, `图片 #${idx + 1}`, `Image #${idx + 1}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Inline files view === */}
      {moreView === 'files' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="h-full flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                {L(lang, '项目文件', 'Project Files')}
              </span>
              <button
                onClick={() => setMoreView('off')}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {projectPath && (
              <div className="bg-zinc-950 border border-zinc-850 px-3 py-1.5 rounded-lg text-zinc-500 text-xxs font-mono truncate select-all">
                {projectPath}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start flex-1 min-h-[300px]">
              <div className="md:col-span-1 border border-zinc-850 rounded-2xl bg-zinc-950/40 p-3 flex flex-col gap-1 max-h-[350px] overflow-auto backdrop-blur-sm">
                <span className="text-zinc-500 text-xxs font-bold uppercase px-2.5 py-1.5 tracking-wider">{L(lang, '全部输出文件', 'All Output Files')}</span>
                {files.map(f => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFile(f)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all ${
                      selectedFile?.path === f.path
                        ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/20 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-150 hover:bg-zinc-900/40 border-transparent'
                    }`}
                  >
                    <span className="truncate pr-2">{f.name}</span>
                    <span className="text-xxs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-bold uppercase">{f.kind}</span>
                  </button>
                ))}
                {files.length === 0 && (
                  <span className="text-zinc-600 text-xs px-2.5">{L(lang, '暂无文件', 'No files yet')}</span>
                )}
              </div>

              <div className="md:col-span-3 border border-zinc-850 rounded-2xl bg-zinc-950/20 p-4 flex flex-col gap-2 flex-grow min-h-[220px] backdrop-blur-sm">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                      <div>
                        <h4 className="text-zinc-350 font-bold text-xs">{selectedFile.name}</h4>
                        <span className="text-zinc-500 text-xxs uppercase">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                      </div>
                    </div>
                    <pre className="flex-1 w-full bg-zinc-950/40 p-3 rounded-lg font-mono text-zinc-300 text-xs leading-relaxed overflow-auto max-h-[400px]">
                      {selectedFile.content || 'Binary or empty file.'}
                    </pre>
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-zinc-500 text-sm">{L(lang, '选择左侧文件查看内容', 'Select a file on the left to preview it')}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Inline logs view === */}
      {moreView === 'logs' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="h-full flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                {L(lang, '运行日志', 'Run Logs')}
              </span>
              <div className="flex items-center gap-2">
                {isStreaming && (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-400 animate-pulse font-semibold">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow shadow-indigo-500/50"></span>
                    {L(lang, '运行中...', 'Running...')}
                  </span>
                )}
                <button
                  onClick={() => setMoreView('off')}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-950/85 border border-zinc-850 rounded-2xl p-4 font-mono text-xs text-zinc-300 leading-relaxed overflow-auto min-h-[300px] max-h-[450px] shadow-inner select-text backdrop-blur-sm">
              {logs.length === 0 ? (
                <span className="text-zinc-650 italic">{L(lang, '暂无日志，运行生成后这里会显示终端输出', 'No logs yet. Terminal output will appear here after generation starts.')}</span>
              ) : (
                <div className="whitespace-pre-wrap">{logs.join('')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === Publish view === */}
      {activeTab === 'publish' && (
        <div className="flex flex-col h-full animate-fade-in">
          {/* Platform pills header */}
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 border-b border-zinc-850/50 overflow-x-auto">
            {([
              { id: 'xiaohongshu', label: L(lang, '小红书', 'Xiaohongshu') },
              { id: 'wechat', label: L(lang, '微信', 'WeChat') },
              { id: 'weibo', label: L(lang, '微博', 'Weibo') },
              { id: 'x', label: 'X' },
            ] as const).map(p => (
              <button
                key={p.id}
                onClick={() => onPlatformChange(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  platform === p.id
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex-1 min-w-[8px]" />
            <button
              onClick={() => setActiveTab('gallery')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors whitespace-nowrap cursor-pointer flex-shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {L(lang, '返回', 'Back')}
            </button>
          </div>

          {/* Scrollable content: preview + caption editor */}
          <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
            <PlatformPreview
              platform={platform}
              projectPath={projectPath}
              images={images.map((img, i) => getVersionPath(img, i))}
              caption={caption}
              imageCount={images.length || 1}
              onCaptionChange={onCaptionChange}
              showHeader={false}
              aspectRatio={aspectRatio}
            />



            {packageResult && (
              <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-xl text-xs">
                <span className="text-zinc-500 font-bold uppercase block">{L(lang, '素材包已就绪', 'Asset Package Ready')}</span>
                <code className="text-emerald-400 truncate block mt-0.5">{packageResult.packagePath}</code>
                <span className="text-zinc-400">{packageResult.images.length} images · {packageResult.files.length} texts</span>
              </div>
            )}

            {publishResult && (
              <div className="bg-emerald-950/20 border border-emerald-900/50 p-2.5 rounded-xl text-xs text-emerald-400">
                <span className="font-bold uppercase block">{L(lang, '浏览器已启动', 'Browser Started')}</span>
                <code className="truncate block">{publishResult.logPath}</code>
                <span>PID: {publishResult.pid}</span>
              </div>
            )}

            {publishError && <div className="text-red-400 text-xs border border-red-950 bg-red-950/20 p-2.5 rounded-xl">{publishError}</div>}
            {packageError && <div className="text-red-400 text-xs border border-red-950 bg-red-950/20 p-2.5 rounded-xl">{packageError}</div>}

            {platform === 'xiaohongshu' && xhsAvailable === false && (
              <div className="flex flex-col gap-2">
                <div className="bg-amber-950/20 border border-amber-900/60 p-3 rounded-xl text-amber-500 text-xs flex items-center justify-between gap-4">
                  <div className="flex gap-2 items-center">
                    <span>⚠️</span>
                    <span>{L(lang, '未安装小红书发布技能，仍可打包素材后手动上传', 'Xiaohongshu publishing skill is not installed. You can still package assets and upload manually.')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex-shrink-0 border-t border-zinc-850/50 p-3 flex flex-col gap-2">
            {platform === 'wechat' && (
              <div>
                {publishingAccounts.length > 0 ? (
                  <select
                    value={publishingAccount}
                    onChange={e => onPublishingAccountChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {publishingAccounts.map(account => (
                      <option key={account.alias} value={account.alias}>
                        {account.name}{account.isDefault ? L(lang, ' (默认)', ' (Default)') : ''} {account.method ? `· ${account.method}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-amber-500 text-xs border border-amber-950 bg-amber-950/20 p-2 rounded-lg flex items-center justify-between gap-3">
                    <span>{L(lang, '未配置微信账号，请前往设置页面添加', 'No WeChat account configured. Add one in Settings.')}</span>
                    <Link
                      to="/settings"
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xxs transition-all shadow-md shadow-amber-600/10 whitespace-nowrap cursor-pointer shrink-0"
                    >
                      {L(lang, '立即配置', 'Configure')}
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                onClick={onPreparePackage}
                disabled={!projectPath || images.length === 0 || isPackaging}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                {isPackaging ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    {L(lang, '打包中...', 'Packaging...')}
                  </span>
                ) : L(lang, '打包素材', 'Package Assets')}
              </Button>
              <Button
                onClick={onOpenPublisher}
                disabled={!projectPath || images.length === 0 || (platform === 'xiaohongshu' && !xhsAvailable) || isPublishing || isPackaging}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
              >
                {isPublishing ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    {L(lang, '启动中...', 'Starting...')}
                  </span>
                ) : platform === 'xiaohongshu' && xhsAvailable === false ? L(lang, '仅打包', 'Package Only') : L(lang, '自动填写发布', 'Auto-fill Publisher')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox modal */}
      {lightboxIdx !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800/80 transition-colors"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {lightboxIdx > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-3 rounded-full hover:bg-zinc-800/80 transition-colors"
              onClick={e => { e.stopPropagation(); setLightboxIdx(prev => prev !== null ? prev - 1 : null) }}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}

          {lightboxIdx < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-3 rounded-full hover:bg-zinc-800/80 transition-colors"
              onClick={e => { e.stopPropagation(); setLightboxIdx(prev => prev !== null ? prev + 1 : null) }}
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          )}

          <div
            className="max-w-5xl max-h-[90vh] mx-auto px-16 flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={getVersionPath(images[lightboxIdx], lightboxIdx)}
              alt={images[lightboxIdx].name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="font-semibold">{images[lightboxIdx].name}</span>
              <span>·</span>
              <span>{lightboxIdx + 1} / {images.length}</span>
              <a
                href={getVersionPath(images[lightboxIdx], lightboxIdx)}
                download
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {L(lang, '下载', 'Download')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
