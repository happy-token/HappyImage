import { useEffect, useRef, useState } from 'react'
import Badge from '../ui/Badge'

interface PlatformViolation {
  field: string
  message: string
  current: string | number
  limit: string | number
  severity: 'error' | 'warning'
}

interface PlatformCheck {
  platform: string
  imageCount: number
  images: string[]
  title: string
  body: string
  hashtags: string[]
  violations: PlatformViolation[]
}

interface PlatformPreviewProps {
  platform: string
  projectPath: string | null
  images: string[]
  caption: string
  imageCount: number
  onCaptionChange?: (caption: string) => void
  showHeader?: boolean
  aspectRatio?: string
}

const platformNames: Record<string, string> = {
  xiaohongshu: '小红书 (Little Red Book)',
  wechat: '微信公众号 (WeChat Article)',
  weibo: '新浪微博 (Sina Weibo)',
  x: 'X (Twitter)',
}

const xiaohongshuAspectStyle = (aspectRatio: string = '1:1'): React.CSSProperties => {
  const [w, h] = aspectRatio.split(':').map(Number)
  if (w && h) return { aspectRatio: `${w}/${h}` }
  return { aspectRatio: '1/1' }
}

const getWeiboSingleAspectRatio = (aspectRatio: string = '1:1') => {
  if (aspectRatio === '16:9') return '16 / 9'
  if (aspectRatio === '4:3') return '4 / 3'
  if (aspectRatio === '3:4') return '3 / 4'
  if (aspectRatio === '9:16') return '9 / 16'
  return '1 / 1'
}

export default function PlatformPreview({ platform, projectPath, images, caption, imageCount, onCaptionChange, showHeader = true, aspectRatio = '1:1' }: PlatformPreviewProps) {
  const [check, setCheck] = useState<PlatformCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [wechatView, setWechatView] = useState<'feed' | 'detail'>('feed')

  // Reset active image index when images or platform change
  useEffect(() => {
    setActiveImageIndex(0)
  }, [images, platform])

  useEffect(() => {
    setLoading(true)
    const bodyText = extractBodyText(caption)
    const title = extractTitle(caption)
    const hashtags = extractHashtags(caption)

    fetch('/api/package/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, images, title, body: bodyText, hashtags }),
    })
      .then(res => res.json())
      .then(data => setCheck(data))
      .catch(() => setCheck(null))
      .finally(() => setLoading(false))
  }, [platform, images, caption])

  const errorCount = check?.violations.filter(v => v.severity === 'error').length ?? 0
  const warningCount = check?.violations.filter(v => v.severity === 'warning').length ?? 0

  const title = extractTitle(caption)
  const bodyText = extractBodyText(caption)
  const hashtags = extractHashtags(caption)

  // Render colored hashtag spans
  const formatBodyText = (text: string) => {
    if (!text) return <span className="text-zinc-500 italic">No text content provided</span>
    const parts = text.split(/(#\S+)/g)
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-indigo-400 font-medium hover:underline cursor-pointer">
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div className="platform-preview bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/40">
          <div>
            <p className="text-indigo-400 text-xxs font-bold uppercase tracking-wider">Publish Preview</p>
            <h3 className="text-zinc-150 font-bold text-sm">{platformNames[platform] || platform}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {loading && <Badge variant="outline">checking...</Badge>}
            {!loading && errorCount > 0 && <Badge variant="default">{errorCount} errors</Badge>}
            {!loading && warningCount > 0 && <Badge variant="outline">{warningCount} warnings</Badge>}
            {!loading && errorCount === 0 && warningCount === 0 && check && <Badge variant="accent">Ready</Badge>}
          </div>
        </div>
      )}

      {/* Violations Area */}
      {check && check.violations.length > 0 && (
        <div className="p-3 bg-zinc-950/20 border-b border-zinc-800 flex flex-col gap-2">
          {check.violations.map((v, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
              v.severity === 'error' 
                ? 'bg-red-950/20 border border-red-900/40 text-red-300' 
                : 'bg-amber-950/20 border border-amber-900/40 text-amber-300'
            }`}>
              <span>{v.severity === 'error' ? '❌' : '⚠️'}</span>
              <span className="flex-1 font-medium">{v.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mockup Canvas */}
      <div className="px-3 py-4 flex flex-col items-center bg-zinc-950/60 min-h-0">
        {/* Xiaohongshu Mockup */}
        {platform === 'xiaohongshu' && (
          <div className="w-full max-w-[340px] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col isolate">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-800/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-pink-500/10">HI</div>
                <div className="flex flex-col">
                  <span className="text-zinc-200 text-xs font-bold">Happy Creator</span>
                  <span className="text-zinc-500 text-[10px]">Xiaohongshu Feed</span>
                </div>
              </div>
              <button className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xxs font-bold transition-all shadow-md shadow-rose-600/10">Follow</button>
            </div>

            {/* Media Block / Carousel */}
            <div className="relative w-full flex-shrink-0 bg-zinc-950 overflow-hidden" style={xiaohongshuAspectStyle(aspectRatio)}>
              {images.length > 0 ? (
                <>
                  <img 
                    src={images[activeImageIndex]} 
                    alt={`Image ${activeImageIndex + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  {/* Left arrow */}
                  {images.length > 1 && activeImageIndex > 0 && (
                    <button 
                      onClick={() => setActiveImageIndex(prev => prev - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      ‹
                    </button>
                  )}
                  {/* Right arrow */}
                  {images.length > 1 && activeImageIndex < images.length - 1 && (
                    <button 
                      onClick={() => setActiveImageIndex(prev => prev + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      ›
                    </button>
                  )}
                  {/* Dots count */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/50 text-[10px] text-zinc-300 font-semibold tracking-wider backdrop-blur-sm">
                      {activeImageIndex + 1} / {images.length}
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-2">
                  <span className="text-3xl">🎨</span>
                  <span className="text-xs">No images generated</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-800/40">
              <div className="flex items-center gap-4 text-zinc-400">
                <span className="flex items-center gap-1 hover:text-rose-500 transition-colors cursor-pointer">❤️ <span className="text-xs">128</span></span>
                <span className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer">💬 <span className="text-xs">42</span></span>
                <span className="flex items-center gap-1 hover:text-amber-500 transition-colors cursor-pointer">⭐ <span className="text-xs">88</span></span>
              </div>
              <span className="text-zinc-500 text-[10px]">Just now</span>
            </div>

            {/* Content Area */}
            <div className="p-3 flex flex-col gap-1.5 overflow-auto max-h-[140px]">
              {title && (
                <EditableText
                  text={title}
                  onCommit={t => onCaptionChange?.(reconstructCaption(t, bodyText, hashtags))}
                  className="text-zinc-150 font-bold text-sm leading-snug"
                />
              )}
              <EditableText
                text={bodyText}
                onCommit={b => onCaptionChange?.(reconstructCaption(title, b, hashtags))}
                className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap"
              />
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {hashtags.map((tag, idx) => (
                    <span key={idx} className="text-indigo-400 text-xxs font-medium hover:underline cursor-pointer">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* WeChat Mockup */}
        {platform === 'wechat' && (
          <div className="w-full max-w-[340px] flex flex-col gap-3">
            {/* View Selector Tabs */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg self-center">
              <button 
                onClick={() => setWechatView('feed')}
                className={`px-3 py-1 rounded-md text-xxs font-semibold transition-all ${
                  wechatView === 'feed' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Feed Card Preview
              </button>
              <button 
                onClick={() => setWechatView('detail')}
                className={`px-3 py-1 rounded-md text-xxs font-semibold transition-all ${
                  wechatView === 'detail' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Article Detail Preview
              </button>
            </div>

            {/* Feed Card Card */}
            {wechatView === 'feed' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">公众号</div>
                  <span className="text-zinc-300 text-xs font-semibold">Happy Official Account</span>
                </div>
                
                <div className="relative border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 flex flex-col cursor-pointer group">
                  {images.length > 0 ? (
                    <div className="w-full relative" style={{ aspectRatio: '2.35 / 1' }}>
                      <img src={images[0]} alt="WeChat Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                        <h4 className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-md">
                          {title || 'WeChat Article Title Placeholder'}
                        </h4>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-600 gap-1.5 p-4">
                      <span className="text-xl">📰</span>
                      <h4 className="text-zinc-300 font-bold text-xs text-center">{title || 'WeChat Title Placeholder'}</h4>
                      <p className="text-[10px] text-zinc-500 text-center">No cover image available</p>
                    </div>
                  )}
                  {bodyText && (
                    <div className="p-3 border-t border-zinc-850 bg-zinc-900/30">
                      <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{bodyText}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Article Detail Detail */}
            {wechatView === 'detail' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 overflow-auto max-h-[380px] text-left">
                <EditableText
                  text={title || 'WeChat Article Title'}
                  onCommit={t => onCaptionChange?.(reconstructCaption(t, bodyText, hashtags))}
                  className="text-zinc-150 font-bold text-base leading-snug"
                />
                <div className="flex items-center gap-2 text-xxs text-zinc-500 border-b border-zinc-800/40 pb-2">
                  <span className="text-emerald-500 font-bold hover:underline cursor-pointer">Happy Brand</span>
                  <span>Just now</span>
                </div>

                <EditableText
                  text={bodyText}
                  onCommit={b => onCaptionChange?.(reconstructCaption(title, b, hashtags))}
                  className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans"
                />

                {images.map((src, idx) => (
                  <figure key={idx} className="my-2 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                    <img src={src} alt={`Illustration ${idx + 1}`} className="w-full h-auto block" />
                    <figcaption className="p-1.5 bg-zinc-950/60 text-center text-[10px] text-zinc-500">
                      Image #{idx + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weibo Mockup */}
        {platform === 'weibo' && (
          <div className="w-full max-w-[340px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-3.5 flex flex-col gap-3 text-left">
            {/* User Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-orange-500/10 relative">
                  HI
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-amber-500 border-2 border-zinc-900 flex items-center justify-center text-[8px] text-white">✓</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-200 text-xs font-bold flex items-center gap-1">
                    HappyImage AI 
                    <span className="text-orange-500 text-[10px]">⚡</span>
                  </span>
                  <span className="text-zinc-500 text-[9px]">Just now · Weibo Web Client</span>
                </div>
              </div>
              <button className="px-2.5 py-0.5 rounded border border-orange-500/30 hover:border-orange-500 text-orange-400 text-xxs font-bold transition-all">+ Follow</button>
            </div>

            {/* Weibo Text Body */}
            <div className="flex flex-col gap-1.5">
              {title && (
                <EditableText
                  text={`【${title}】`}
                  onCommit={t => {
                    const stripped = t.replace(/^【|】$/g, '')
                    onCaptionChange?.(reconstructCaption(stripped, bodyText, hashtags))
                  }}
                  className="text-zinc-200 font-bold text-xs"
                />
              )}
              <EditableText
                text={bodyText}
                onCommit={b => onCaptionChange?.(reconstructCaption(title, b, hashtags))}
                className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap"
              />
              {bodyText.length > 140 && (
                <span className="text-indigo-400 text-xxs font-bold cursor-pointer hover:underline">...展开全文</span>
              )}
            </div>

            {/* Images Grid */}
            {images.length > 0 && (
              <div className={`grid gap-1.5 ${
                images.length === 1 
                  ? 'grid-cols-1' 
                  : images.length === 2 || images.length === 4
                  ? 'grid-cols-2' 
                  : 'grid-cols-3'
              }`}>
                {images.slice(0, 9).map((src, idx) => {
                  const isNinth = idx === 8 && images.length > 9
                  return (
                    <div 
                      key={idx} 
                      className="bg-zinc-950 border border-zinc-800 rounded overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ aspectRatio: images.length === 1 ? getWeiboSingleAspectRatio(aspectRatio) : '1 / 1' }}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {isNinth && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                          +{images.length - 9}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-between border-t border-zinc-850 pt-2.5 text-zinc-500 text-xxs font-semibold">
              <span className="flex items-center gap-1 hover:text-zinc-350 cursor-pointer">🔄 15</span>
              <span className="flex items-center gap-1 hover:text-zinc-350 cursor-pointer">💬 28</span>
              <span className="flex items-center gap-1 hover:text-orange-500 cursor-pointer">👍 76</span>
            </div>
          </div>
        )}

        {/* X Mockup */}
        {platform === 'x' && (
          <div className="w-full max-w-[340px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-2.5 text-left font-sans">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-zinc-950 flex items-center justify-center text-zinc-200 border border-zinc-800 font-black text-sm">𝕏</div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-150 text-xs font-bold">HappyImage</span>
                    <span className="text-sky-500 text-[10px] select-none">✓</span>
                  </div>
                  <span className="text-zinc-500 text-[10px] leading-tight">@happy_image</span>
                </div>
              </div>
              <span className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-300">•••</span>
            </div>

            {/* Tweet content */}
            <div className="text-zinc-150 text-xs leading-normal flex flex-col gap-1">
              {title && (
                <EditableText
                  text={title}
                  onCommit={t => onCaptionChange?.(reconstructCaption(t, bodyText, hashtags))}
                  className="font-bold"
                />
              )}
              <EditableText
                text={bodyText}
                onCommit={b => onCaptionChange?.(reconstructCaption(title, b, hashtags))}
                className="whitespace-pre-wrap"
              />
            </div>

            {/* Image Grid */}
            {images.length > 0 && (
              <div className={`overflow-hidden border border-zinc-800 rounded-xl bg-zinc-950 grid gap-[1.5px] ${
                images.length === 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-2'
              }`}>
                {images.slice(0, 4).map((src, idx) => {
                  let cellRatio = '16 / 9'
                  if (images.length === 1) {
                    cellRatio = aspectRatio === '1:1' ? '1 / 1' :
                                aspectRatio === '3:4' ? '3 / 4' :
                                aspectRatio === '4:3' ? '4 / 3' :
                                aspectRatio === '9:16' ? '9 / 16' : '16 / 9'
                  } else if (images.length === 2) {
                    cellRatio = '8 / 9'
                  } else if (images.length === 3) {
                    cellRatio = idx === 0 ? '8 / 18' : '16 / 9'
                  } else {
                    cellRatio = '1 / 1'
                  }

                  const isFirstOfThree = images.length === 3 && idx === 0

                  return (
                    <div 
                      key={idx} 
                      className={`relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                        isFirstOfThree ? 'row-span-2 h-full' : ''
                      }`}
                      style={{ aspectRatio: isFirstOfThree ? undefined : cellRatio }}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-zinc-500 text-[10px] border-b border-zinc-850 pb-2">
              11:42 AM · May 20, 2026 · <span className="text-zinc-300 font-semibold">1,248</span> Views
            </div>

            {/* Tweet Action Icons */}
            <div className="flex items-center justify-between text-zinc-500 px-1 py-0.5 text-xs">
              <span className="hover:text-sky-500 transition-colors cursor-pointer">💬 <span className="text-[10px]">12</span></span>
              <span className="hover:text-emerald-500 transition-colors cursor-pointer">🔁 <span className="text-[10px]">3</span></span>
              <span className="hover:text-pink-500 transition-colors cursor-pointer">❤️ <span className="text-[10px]">54</span></span>
              <span className="hover:text-sky-500 transition-colors cursor-pointer">🔖 <span className="text-[10px]">9</span></span>
              <span className="hover:text-zinc-300 transition-colors cursor-pointer">📤</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Bottom bar */}
      {showHeader && (
        <div className="grid grid-cols-4 border-t border-zinc-800 bg-zinc-950/40">
          <div className="flex flex-col items-center justify-center p-2.5 border-r border-zinc-800">
            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Images</span>
            <span className="text-zinc-200 text-xs font-semibold mt-0.5">{imageCount}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2.5 border-r border-zinc-800">
            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Title</span>
            <span className="text-zinc-200 text-xs font-semibold mt-0.5">{title.length} chars</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2.5 border-r border-zinc-800">
            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Body</span>
            <span className="text-zinc-200 text-xs font-semibold mt-0.5">{bodyText.length} chars</span>
          </div>
          <div className="flex flex-col items-center justify-center p-2.5">
            <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Hashtags</span>
            <span className="text-zinc-200 text-xs font-semibold mt-0.5">{hashtags.length}</span>
          </div>
        </div>
      )}

      {/* Project Output Path */}
      {showHeader && projectPath && (
        <div className="px-3.5 py-2.5 border-t border-zinc-800 bg-zinc-950/20 text-left">
          <code className="text-zinc-500 text-xxs font-mono truncate block select-all">
            Output Path: {projectPath}
          </code>
        </div>
      )}
    </div>
  )
}

function EditableText({ text, onCommit, className }: {
  text: string
  onCommit: (s: string) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const focused = useRef(false)

  useEffect(() => {
    if (ref.current) ref.current.innerText = text
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focused.current && ref.current && ref.current.innerText !== text) {
      ref.current.innerText = text
    }
  }, [text])

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => { focused.current = true }}
      onBlur={e => { focused.current = false; onCommit(e.currentTarget.innerText) }}
      onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur(); e.stopPropagation() }}
      className={`outline-none rounded transition-colors hover:bg-white/[0.04] focus:bg-white/[0.06] focus:ring-1 focus:ring-inset focus:ring-indigo-400/40 px-0.5 -mx-0.5 cursor-text ${className ?? ''}`}
    />
  )
}

function reconstructCaption(title: string, body: string, hashtags: string[]): string {
  const parts: string[] = []
  if (title.trim()) parts.push(`Title: ${title.trim()}`)
  if (body.trim()) parts.push(body.trim())
  if (hashtags.length > 0) parts.push(hashtags.join(' '))
  return parts.filter(Boolean).join('\n')
}

function extractTitle(caption: string): string {
  const match = caption.match(/^(?:#+\s*)?(?:标题[：:]|Title:)\s*(.+)/im)
    || caption.match(/^\*\*(.+)\*\*/m)
  return match ? match[1].trim() : ''
}

function extractBodyText(caption: string): string {
  return caption
    .replace(/^(?:#+\s*)?(?:标题[：:]|Title:)\s*.+/im, '')
    .replace(/#\S+/g, '')
    .replace(/\*\*/g, '')
    .trim()
}

function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[\w一-鿿-]+/g)
  return matches || []
}
