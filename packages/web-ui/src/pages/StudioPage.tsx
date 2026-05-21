import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { MessageSquare, Compass, History, Settings, Loader2 } from 'lucide-react'
import { getSkill, skills } from '../data'
import type { ConfigItem, SkillDefinition } from '../types/skills'
import { useSSE } from '../hooks/useSSE'
import { useProjectChat } from '../hooks/useProjectChat'
import Button from '../components/ui/Button'
import PlanConfirmation from '../components/project/PlanConfirmation'
import ProjectWorkspace from '../components/project/ProjectWorkspace'
import type { ProjectPlan } from '@happyimage/core'

interface PreferenceInfo {
  found: boolean
  path: string | null
  summary: Array<{ key: string; value: string }>
}

interface PublishingAccount {
  name: string
  alias: string
  isDefault: boolean
  method: string
  author: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  type?: 'text' | 'plan' | 'runner'
  planData?: ProjectPlan
  logData?: string[]
  sourceContent?: string
}

function encodeProjectId(path: string) {
  const bytes = new TextEncoder().encode(path)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function imageFor(skill: SkillDefinition, dimension: string, item: ConfigItem) {
  const dir = skill.screenshotDirs.find(s => s.dimension === dimension)
  return dir ? `/screenshots/${dir.path}/${item.id}.webp` : ''
}

function initialSelections(skill: SkillDefinition) {
  return Object.fromEntries(
    Object.entries(skill.dimensions)
      .map(([key, dim]) => [key, dim.defaultItem || dim.items[0]?.id || ''])
      .filter(([, value]) => Boolean(value)),
  )
}

function defaultImageCount(skill: SkillDefinition) {
  if (['cover', 'infographic', 'diagram'].includes(skill.category)) return 1
  if (skill.category === 'presentation') return 8
  return 4
}

export default function StudioPage() {
  const { id: urlProjectId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const chatThreadRef = useRef<HTMLDivElement>(null)


  // Core visual settings
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Skill & configuration states
  const defaultSkill = skills[0]
  const [skillId, setSkillId] = useState(defaultSkill.id)
  const skill = getSkill(skillId) || defaultSkill
  const [selections, setSelections] = useState<Record<string, string>>(() => initialSelections(defaultSkill))
  const [aspectRatio, setAspectRatio] = useState(defaultSkill.defaultAspectRatio)
  const [language, setLanguage] = useState('zh')
  const [imageCount, setImageCount] = useState(defaultImageCount(defaultSkill))

  const configSummary = useMemo(() => {
    const parts: string[] = [skill.nameZh]
    for (const [key, dim] of Object.entries(skill.dimensions)) {
      const selectedId = selections[key]
      const item = dim.items.find(i => i.id === selectedId)
      if (item) parts.push(item.name)
    }
    const langLabel = { zh: '中文', en: 'EN', ja: '日本語', ko: '한국어' }[language] || language
    parts.push(`${langLabel} · ${aspectRatio}`)
    if (imageCount > 1) parts.push(`${imageCount} pics`)
    return parts.join(' · ')
  }, [skill, selections, language, aspectRatio, imageCount])
  
  // Source context parameters
  const [sourceMode, setSourceMode] = useState('text')
  const [sourceRef, setSourceRef] = useState('')
  const [uploadedSourceName, setUploadedSourceName] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  // Preference status
  const [preferenceInfo, setPreferenceInfo] = useState<PreferenceInfo | null>(null)
  const [usePreferences, setUsePreferences] = useState(true)

  // Skip plan setting
  const [skipPlanConfirmation, setSkipPlanConfirmation] = useState(false)

  // Backend Project State
  const [projectData, setProjectData] = useState<any | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  // Publishing / Platform Preview states
  const [platform, setPlatform] = useState('xiaohongshu')
  const [caption, setCaption] = useState('')
  const [publishingAccounts, setPublishingAccounts] = useState<PublishingAccount[]>([])
  const [publishingAccount, setPublishingAccount] = useState('')
  const [xhsAvailable, setXhsAvailable] = useState<boolean | null>(null)
  
  // Tasks state
  const [isCaptioning, setIsCaptioning] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)
  const [isPackaging, setIsPackaging] = useState(false)
  const [packageResult, setPackageResult] = useState<{ packagePath: string; files: string[]; images: string[] } | null>(null)
  const [packageError, setPackageError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ pid: number; logPath: string; message: string } | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  // Chat message thread
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [pendingGenerationContent, setPendingGenerationContent] = useState('')

  // Generation stream hook (fresh creation)
  const sse = useSSE()

  // Project chat stream hook (incremental edits)
  const projectChat = useProjectChat(urlProjectId || '')

  // Load settings on mount to check skipPlanConfirmation
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && (data.SKIP_PLAN_CONFIRMATION === 'true' || data.SKIP_PLAN_CONFIRMATION === '1')) {
          setSkipPlanConfirmation(true)
        }
      })
      .catch(() => {})
  }, [])

  // 1. Load active project from URL if ID exists
  useEffect(() => {
    if (!urlProjectId) {
      setProjectData(null)
      setChatMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: 'Describe what you would like to design, or point to a local directory or GitHub repository. Choose a skill and styles below to begin.',
        },
      ])
      return
    }

    setLoadingProject(true)
    fetch(`/api/projects/${urlProjectId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (data.error) throw new Error(data.error)
        setProjectData(data)
        
        // Sync configuration states
        setSkillId(data.categoryDir || defaultSkill.id)
        if (data.files && data.files.length > 0) {
          const copyFile = data.files.find((f: any) => f.kind === 'copy')
          if (copyFile && copyFile.content) {
            setCaption(copyFile.content)
          }
        }

        // Build history thread from conversations
        const initialMsg: ChatMessage = {
          id: 'welcome',
          role: 'assistant',
          text: `Loaded project "${data.name}". You can now review files in the workspace on the right, or type modifications below (e.g. "make the 2nd image layout cleaner").`,
        }
        
        const historyMsgs: ChatMessage[] = (data.conversations || []).flatMap((c: any, index: number) => [
          {
            id: `usr-${index}`,
            role: 'user',
            text: c.message,
          },
          {
            id: `ast-${index}`,
            role: 'assistant',
            text: c.plan,
          }
        ])

        setChatMessages([initialMsg, ...historyMsgs])
      })
      .catch(err => {
        setChatMessages([{ id: 'error', role: 'system', text: err.message || 'Failed to load project' }])
      })
      .finally(() => setLoadingProject(false))
  }, [urlProjectId])

  useEffect(() => {
    if (urlProjectId) return
    const requestedSkillId = searchParams.get('skill')
    if (!requestedSkillId) return
    const requestedSkill = getSkill(requestedSkillId)
    if (!requestedSkill) return

    const nextSelections = initialSelections(requestedSkill)
    for (const key of Object.keys(requestedSkill.dimensions)) {
      const value = searchParams.get(key)
      if (value && requestedSkill.dimensions[key].items.some(item => item.id === value)) {
        nextSelections[key] = value
      }
    }

    setSkillId(requestedSkill.id)
    setSelections(nextSelections)
    setAspectRatio(searchParams.get('aspectRatio') || requestedSkill.defaultAspectRatio)
    setLanguage(searchParams.get('language') || 'zh')
    setImageCount(Number(searchParams.get('imageCount') || searchParams.get('pageCount') || searchParams.get('slides')) || defaultImageCount(requestedSkill))
    setIsSidebarOpen(searchParams.get('drawer') === '1')
    setChatMessages([
      {
        id: 'welcome-gallery',
        role: 'assistant',
        text: `Gallery selections are loaded for ${requestedSkill.nameZh}. Describe the topic, paste a GitHub repository, or tell me what you want to generate.`,
      },
    ])
  }, [searchParams, urlProjectId])

  // 2. Fetch skill preferences
  useEffect(() => {
    setPreferenceInfo(null)
    fetch(`/api/preferences/${skill.id}`)
      .then(res => res.json())
      .then(data => setPreferenceInfo(data))
      .catch(() => setPreferenceInfo(null))
  }, [skill.id])

  // 3. Fetch publish accounts & platform probes
  useEffect(() => {
    setXhsAvailable(null)
    fetch('/api/publish/probe?platform=xiaohongshu')
      .then(res => res.json())
      .then(data => setXhsAvailable(data.xiaohongshu?.available ?? false))
      .catch(() => setXhsAvailable(false))
  }, [])

  useEffect(() => {
    setPublishingAccounts([])
    setPublishingAccount('')
    if (!['wechat', 'weibo', 'x'].includes(platform)) return
    fetch(`/api/accounts/${platform}`)
      .then(res => res.json())
      .then(data => {
        const accounts = data.accounts || []
        setPublishingAccounts(accounts)
        const preferred = accounts.find((account: PublishingAccount) => account.isDefault) || accounts[0]
        setPublishingAccount(preferred?.alias || '')
      })
      .catch(() => {
        setPublishingAccounts([])
        setPublishingAccount('')
      })
  }, [platform])

  // 4. Scroll chat to bottom
  useEffect(() => {
    chatThreadRef.current?.scrollTo({
      top: chatThreadRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [chatMessages, sse.log, projectChat.logs])

  // Helpers
  const appendMessage = (role: ChatMessage['role'], text: string, type?: ChatMessage['type'], planData?: ProjectPlan, sourceContent?: string) => {
    const newMsg: ChatMessage = { id: `${Date.now()}-${chatMessages.length}`, role, text, type, planData, sourceContent }
    setChatMessages(prev => [...prev, newMsg])
    return newMsg.id
  }

  const selectSkill = (nextId: string) => {
    const nextSkill = getSkill(nextId)
    if (!nextSkill) return
    setSkillId(nextId)
    setSelections(initialSelections(nextSkill))
    setAspectRatio(nextSkill.defaultAspectRatio)
    setImageCount(defaultImageCount(nextSkill))
  }

  // --- Initial Generation Flow (SSE) ---
  const [planningMsgId, setPlanningMsgId] = useState<string | null>(null)
  const [disabledPlanPrompts, setDisabledPlanPrompts] = useState<Set<number>>(new Set())
  
  const handleStartGeneration = async () => {
    const query = chatInput.trim()
    const hasSource = sourceMode !== 'text' && Boolean(sourceRef.trim())
    if (!query && !hasSource) return
    const generationContent = query || ''
    setChatInput('')
    setPendingGenerationContent(generationContent)
    setDisabledPlanPrompts(new Set())

    appendMessage('user', query || `使用${uploadedSourceName ? `上传文件 ${uploadedSourceName}` : '已选择的内容源'}生成图片`)
    const payload = { ...selections, aspectRatio, language, imageCount: String(imageCount), usePreferences: String(usePreferences) }

    if (skipPlanConfirmation) {
      appendMessage('assistant', 'Launching generation process directly...', 'runner')
      sse.start(skill.id, generationContent, payload, {
        onDone: (doneImages) => {
          appendMessage('assistant', `Generation completed! Created ${doneImages.length} images.`)
        },
        onProject: (path) => {
          const encodedId = encodeProjectId(path)
          navigate(`/projects/${encodedId}`, { replace: true })
        }
      }, { sourceMode, sourceRef })
      return
    }

    const thinkingId = appendMessage('assistant', 'Thinking... Creating a structured generation plan.')
    setPlanningMsgId(thinkingId)

    try {
      const res = await fetch('/api/generate/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id, content: generationContent, selections: payload, sourceMode, sourceRef }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      
      // Update the thinking bubble to present the inline plan
      setChatMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
          ? { ...msg, text: `I have prepared a generation plan for you: **${data.title || 'Untitled Project'}**`, type: 'plan', planData: data, sourceContent: generationContent }
          : msg
      ))
    } catch (err: any) {
      setChatMessages(prev => prev.map(msg => 
        msg.id === thinkingId 
          ? { ...msg, text: `Failed to prepare plan: ${err.message || 'Error occurred.'}`, role: 'system' }
          : msg
      ))
    }
  }

  const confirmGeneratePlan = (confirmedPlan: ProjectPlan, disabledPrompts: Set<number>, sourceContent?: string) => {
    const content = (sourceContent || pendingGenerationContent || chatInput).trim()
    const payload = { ...selections, aspectRatio, language, imageCount: String(imageCount), usePreferences: String(usePreferences) }
    const activePrompts = confirmedPlan.prompts.filter((_, i) => !disabledPrompts.has(i))
    const adjustedPlan = { ...confirmedPlan, prompts: activePrompts }

    // Clear plan card state
    setChatMessages(prev => prev.filter(msg => msg.id !== planningMsgId))
    setPlanningMsgId(null)

    // Add runner message bubble
    appendMessage('assistant', 'Launching generation process...', 'runner')

    sse.start(skill.id, content, payload, {
      onDone: (doneImages) => {
        appendMessage('assistant', `Generation completed! Created ${doneImages.length} images.`)
      },
      onProject: (path) => {
        // Encode path and navigate to project view
        const encodedId = encodeProjectId(path)
        navigate(`/projects/${encodedId}`, { replace: true })
      }
    }, { sourceMode, sourceRef, prebuiltPlan: adjustedPlan as unknown as Record<string, unknown> })
    setPendingGenerationContent('')
  }

  const cancelGeneratePlan = () => {
    setChatMessages(prev => prev.filter(msg => msg.id !== planningMsgId))
    setPlanningMsgId(null)
    setPendingGenerationContent('')
    setDisabledPlanPrompts(new Set())
  }

  // --- Incremental Edit Chat Flow (useProjectChat) ---
  const handleSendProjectEdit = () => {
    const query = chatInput.trim()
    if (!query || projectChat.isStreaming) return
    setChatInput('')

    appendMessage('user', query)
    
    const target = selectedImage !== null ? { type: 'image', index: selectedImage } : undefined
    projectChat.sendMessage(query, target)
  }

  const handleSourceUpload = async (file: File | null) => {
    if (!file) return
    setUploadStatus('Uploading source file...')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/upload/source', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSourceMode('file')
      setSourceRef(data.path)
      setUploadedSourceName(data.name || file.name)
      setUploadStatus(`Loaded ${data.name || file.name}`)
    } catch (err: any) {
      setUploadStatus(err.message || 'Upload failed')
    }
  }

  const handleSourceModeChange = (mode: string) => {
    setSourceMode(mode)
    if (mode !== 'file') {
      setUploadedSourceName('')
      setUploadStatus('')
    }
    if (mode === 'text') setSourceRef('')
  }

  const canSubmit = projectData
    ? Boolean(chatInput.trim()) && !projectChat.isStreaming
    : (Boolean(chatInput.trim()) || (sourceMode !== 'text' && Boolean(sourceRef.trim()))) && !sse.isStreaming

  const sourceInputHint = sourceMode === 'github'
    ? 'https://github.com/owner/repo'
    : sourceMode === 'file'
      ? 'Upload a .md, .markdown, or .txt file'
      : '/Users/.../project'

  // Watch for finished incremental edit chat stream
  const prevStreaming = useRef(false)
  useEffect(() => {
    if (prevStreaming.current && !projectChat.isStreaming && urlProjectId) {
      // Re-fetch project contents to reflect the modified files & images
      fetch(`/api/projects/${urlProjectId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setProjectData(data)
        })
    }
    prevStreaming.current = projectChat.isStreaming
  }, [projectChat.isStreaming, urlProjectId])

  // --- Publishing Actions ---
  const generateCaption = async () => {
    setIsCaptioning(true)
    setCaptionError(null)
    try {
      const res = await fetch('/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: skill.id,
          content: projectData?.name || chatInput,
          selections,
          platform,
          imageCount: projectData?.images.length || imageCount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setCaption(data.caption || '')
    } catch (err: any) {
      setCaptionError(err.message || 'Caption generation failed')
    } finally {
      setIsCaptioning(false)
    }
  }

  const preparePackage = async () => {
    if (!projectData) return
    setIsPackaging(true)
    setPackageError(null)
    try {
      const res = await fetch('/api/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: projectData.path, platform, caption }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPackageResult(data)
    } catch (err: any) {
      setPackageError(err.message || 'Asset preparation failed')
    } finally {
      setIsPackaging(false)
    }
  }

  const openPublisher = async () => {
    if (!packageResult) return
    setIsPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packagePath: packageResult.packagePath, platform, accountAlias: publishingAccount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPublishResult(data)
    } catch (err: any) {
      setPublishError(err.message || 'Autofill start failed')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleSelectImage = (index: number | null) => {
    onSelectImage(index)
  }

  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const onSelectImage = (index: number | null) => {
    setSelectedImage(index)
  }

  // Selections Summary helper
  const selectionSummary = useMemo(() => {
    return Object.entries(selections).map(([key, itemId]) => {
      const item = skill.dimensions[key]?.items.find(i => i.id === itemId)
      return item ? `${skill.dimensions[key].label}: ${item.name}` : `${key}: ${itemId}`
    })
  }, [selections, skill])

  const renderParameters = (isInline: boolean) => {
    return (
      <div className={`flex flex-col gap-5 overflow-y-auto transition-all duration-300 ${
        isInline 
          ? 'w-72 shrink-0 border border-zinc-850 bg-zinc-900/60 backdrop-blur-md rounded-2xl p-4 h-full scrollbar-thin shadow-xl'
          : 'w-80 border-l border-zinc-850 bg-zinc-900/40 backdrop-blur-md p-5 h-full scrollbar-thin'
      }`}>
        <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
          <h3 className="text-zinc-300 font-bold text-xs uppercase tracking-wider">⚙ Visual Parameters</h3>
          {!isInline && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-zinc-500 hover:text-zinc-300 font-semibold p-1 text-sm transition-colors cursor-pointer"
            >
              ✕ Close
            </button>
          )}
        </div>

        {/* Skill Selector Strip */}
        <div className="flex flex-col gap-2">
          <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Active Skill</span>
          <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto border border-zinc-800 p-2 rounded-lg bg-zinc-950/40 scrollbar-thin">
            {skills.map(item => (
              <button
                key={item.id}
                onClick={() => selectSkill(item.id)}
                className={`flex items-center gap-2.5 p-2 rounded-lg text-left border transition-all cursor-pointer ${
                  item.id === skill.id 
                    ? 'bg-indigo-50 dark:bg-indigo-950/25 border-indigo-200/60 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm' 
                    : 'border-transparent hover:bg-zinc-950/20 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="text-lg">🎨</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{item.nameZh}</span>
                  <span className="text-[10px] text-zinc-550">{item.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings controls */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <label className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-zinc-400">
              Language
              <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <label className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-zinc-400">
              Aspect Ratio
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer">
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-zinc-400">
              Image Count
              <input min={1} max={10} type="number" value={imageCount} onChange={e => setImageCount(Number(e.target.value) || 1)} className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
            </label>
            <label className="flex-1 flex flex-col gap-1 text-[10px] font-semibold text-zinc-400">
              Context Mode
              <select value={sourceMode} onChange={e => handleSourceModeChange(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer">
                <option value="text">Natural Language</option>
                <option value="local">Local Directory</option>
                <option value="file">Upload Markdown / Text</option>
                <option value="github">GitHub Repo URL</option>
              </select>
            </label>
          </div>

          {sourceMode === 'file' ? (
            <label className="flex flex-col gap-2 text-[10px] font-semibold text-zinc-400">
              Source File
              <input
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={e => handleSourceUpload(e.target.files?.[0] || null)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs outline-none file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-indigo-700"
              />
              {sourceRef && (
                <code className="truncate rounded-lg border border-zinc-850 bg-zinc-950 px-2 py-1.5 text-[10px] font-mono text-zinc-400">
                  {uploadedSourceName || sourceRef}
                </code>
              )}
              {uploadStatus && (
                <span className={`text-[10px] ${uploadStatus.toLowerCase().includes('failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {uploadStatus}
                </span>
              )}
            </label>
          ) : sourceMode !== 'text' && (
            <label className="flex flex-col gap-1 text-[10px] font-semibold text-zinc-400">
              Context Path / URL
              <input
                value={sourceRef}
                onChange={e => setSourceRef(e.target.value)}
                placeholder={sourceInputHint}
                className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </label>
          )}

          {/* EXTEND.md Preferences */}
          <div className="border border-zinc-850 p-3 rounded-xl bg-zinc-950/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">EXTEND.md Preferences</span>
              <span className={`text-[9px] px-1.5 rounded font-bold uppercase ${preferenceInfo?.found ? 'bg-indigo-950 text-indigo-400 border border-indigo-900' : 'bg-zinc-900 text-zinc-550'}`}>
                {preferenceInfo?.found ? 'found' : 'none'}
              </span>
            </div>
            
            {preferenceInfo?.found ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-350 cursor-pointer">
                  <input type="checkbox" checked={usePreferences} onChange={e => setUsePreferences(e.target.checked)} className="rounded text-indigo-600 focus:ring-0 cursor-pointer" />
                  Apply EXTEND.md preferences
                </label>
                <code className="text-[10px] text-zinc-400 font-mono truncate bg-zinc-950 p-1.5 rounded border border-zinc-900">{preferenceInfo.path}</code>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400 leading-normal m-0">No custom skill settings found. Standard values will apply.</p>
            )}
          </div>
        </div>

        {/* Presets and choice grids */}
        <div className="flex flex-col gap-3 border-t border-zinc-850 pt-4">
          <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Style Dimensions</span>
          {Object.keys(skill.dimensions).map(dimension => {
            const dim = skill.dimensions[dimension]
            const activeVal = selections[dimension] || ''
            
            return (
              <div key={dimension} className="flex flex-col gap-1.5">
                <label className="text-zinc-400 text-xs font-semibold">{dim.label}</label>
                <select 
                   value={activeVal}
                   onChange={e => setSelections(prev => ({ ...prev, [dimension]: e.target.value }))}
                   className="bg-zinc-950 border border-zinc-800 text-zinc-150 p-2.5 rounded-lg text-xs outline-none cursor-pointer focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                >
                  {dim.items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.description}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return loadingProject ? (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
      Loading project...
    </div>
  ) : (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">
            
            {/* Left Column: Chat Stream */}
            <div className={`flex flex-col border-r border-zinc-900 bg-zinc-950 transition-all duration-300 ${
              (projectData || sse.isStreaming || sse.images.length > 0) ? 'w-[40%]' : 'flex-1 max-w-4xl mx-auto px-6'
            }`}>
              
              {/* Active project header bar */}
              <div className="px-5 py-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/85 backdrop-blur-md flex-shrink-0">
                <div className="flex items-center gap-2">
                  {projectData && (
                    <span className="text-zinc-400 text-xs font-semibold truncate max-w-[200px]">
                      Active Project: <strong className="text-zinc-200">{projectData.name}</strong>
                    </span>
                  )}
                </div>
                
                {projectData && (
                  <div className="flex items-center gap-2">
                    <span className="text-xxs px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold uppercase">{projectData.categoryDir}</span>
                    <Link to="/" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold no-underline transition-colors">
                      + New
                    </Link>
                  </div>
                )}
              </div>

              {/* Message thread container */}
              <div 
                ref={chatThreadRef}
                className="flex-1 overflow-auto p-5 flex flex-col gap-4 select-text"
              >
                {!projectData && !urlProjectId && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Link
                      to="/gallery"
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 no-underline shadow-lg transition hover:border-indigo-500/60 hover:bg-zinc-900"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Start here</div>
                      <div className="mt-2 text-sm font-bold text-zinc-100">Gallery Guide</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">Choose image type, styles, palettes, layout, aspect, text, and language before chatting.</p>
                    </Link>
                    <Link
                      to="/history"
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 no-underline shadow-lg transition hover:border-indigo-500/60 hover:bg-zinc-900"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Continue</div>
                      <div className="mt-2 text-sm font-bold text-zinc-100">Project History</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">Open previous projects, review generated files, and keep iterating in chat.</p>
                    </Link>
                    <Link
                      to="/settings"
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 no-underline shadow-lg transition hover:border-indigo-500/60 hover:bg-zinc-900"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">Setup</div>
                      <div className="mt-2 text-sm font-bold text-zinc-100">Settings</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">Manage API keys, preferences, and publishing account settings.</p>
                    </Link>
                  </div>
                )}

                {/* Greeting or project instructions */}
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col gap-1.5 max-w-[85%] ${
                    msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                  } animate-fade-in`}>
                    
                    {/* Speaker name */}
                    <span className="text-zinc-500 text-xxs font-bold uppercase tracking-wider">
                      {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Assistant'}
                    </span>

                    {/* Standard text bubble */}
                    <div className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed border transition-all ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                        : 'bg-zinc-900/60 border-zinc-850/80 text-zinc-150 rounded-tl-none backdrop-blur-sm'
                    }`}>
                      {msg.text}
                    </div>

                    {/* Custom planning confirmation card */}
                    {msg.type === 'plan' && msg.planData && (
                      <div className="mt-2.5 w-full max-w-md self-start border border-zinc-800 rounded-xl bg-zinc-900 shadow-xl overflow-hidden animate-scale-up">
                        <PlanConfirmation
                          plan={msg.planData}
                          imageCount={imageCount}
                          onConfirm={(plan) => confirmGeneratePlan(plan, disabledPlanPrompts, msg.sourceContent)}
                          onCancel={cancelGeneratePlan}
                          onTogglePrompt={(index) => {
                            setDisabledPlanPrompts(prev => {
                              const next = new Set(prev)
                              if (next.has(index)) next.delete(index)
                              else next.add(index)
                              return next
                            })
                          }}
                          disabledPrompts={disabledPlanPrompts}
                        />
                      </div>
                    )}

                    {/* Custom runner console card */}
                    {msg.type === 'runner' && (
                      <div className="mt-2.5 w-full max-w-md self-start border border-zinc-800 rounded-xl bg-zinc-950/80 p-3 shadow-xl flex flex-col gap-2 font-mono text-xxs text-emerald-400 max-h-[220px] overflow-auto select-text animate-scale-up">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 text-zinc-500">
                          <span>Terminal log</span>
                          {sse.isStreaming && (
                            <button onClick={sse.stop} className="text-red-400 hover:text-red-300 font-bold bg-red-950/30 px-2 py-0.5 rounded border border-red-900 transition-colors">
                              Cancel
                            </button>
                          )}
                        </div>
                        {sse.error && <div className="text-red-400">{sse.error}</div>}
                        <div className="whitespace-pre-wrap">{sse.log.join('')}</div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Incremental project chat logs / streams */}
                {projectChat.isStreaming && (
                  <div className="flex flex-col gap-1.5 max-w-[85%] self-start items-start animate-fade-in">
                    <span className="text-zinc-500 text-xxs font-bold uppercase tracking-wider">Assistant</span>
                    
                    {projectChat.plan && (
                      <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed border bg-zinc-900 border-zinc-850 text-zinc-150 rounded-tl-none">
                        <strong>Modification plan:</strong>
                        <p className="mt-1 text-zinc-300 leading-normal m-0">{projectChat.plan}</p>
                      </div>
                    )}

                    <div className="mt-2 w-full max-w-md self-start border border-zinc-800 rounded-xl bg-zinc-950/80 p-3 shadow-xl flex flex-col gap-2 font-mono text-xxs text-emerald-400 max-h-[160px] overflow-auto">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-1 text-zinc-500">
                        <span>Fine-tuning logs</span>
                        <button onClick={projectChat.stop} className="text-red-400 hover:text-red-300 font-bold bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900">
                          Cancel
                        </button>
                      </div>
                      <div className="whitespace-pre-wrap">
                        {projectChat.logs.join('\n')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat composer box */}
              <div className="p-5 bg-transparent flex-shrink-0">
                <div className="border border-zinc-800/80 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 bg-zinc-900/70 backdrop-blur-md rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-xl relative transition-all">

                  {/* Config summary bar — click to open drawer */}
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600/50 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                    title="View and modify visual parameters"
                  >
                    <span>⚙</span>
                    <span className="truncate">{configSummary}</span>
                    <span className={`ml-auto text-zinc-650 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`}>›</span>
                  </button>

                  {selectedImage !== null && (
                    <div className="flex items-center justify-between bg-indigo-950/30 border border-indigo-900/50 text-indigo-400 px-3 py-1.5 rounded-lg text-xs">
                      <span className="font-semibold">Targeting Image #{selectedImage + 1} for direct edits</span>
                      <button onClick={() => setSelectedImage(null)} className="text-indigo-400 hover:text-indigo-300 font-bold p-1">
                        ✕
                      </button>
                    </div>
                  )}

                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !e.metaKey &&
                        !e.ctrlKey &&
                        !chatInput.trim() &&
                        !projectData &&
                        sourceMode !== 'text' &&
                        Boolean(sourceRef.trim())
                      ) {
                        e.preventDefault()
                        handleStartGeneration()
                        return
                      }
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        projectData ? handleSendProjectEdit() : handleStartGeneration()
                      }
                    }}
                    placeholder={
                      projectData
                        ? selectedImage !== null
                          ? `Instruct edits for image #${selectedImage + 1} (e.g. "make background darker")...`
                          : "Describe changes for this project..."
                        : sourceMode !== 'text' && sourceRef
                          ? "Press Enter with an empty message to generate from the selected source, or add extra instructions..."
                          : "Describe the content details, characters, copy, and layout you want to design..."
                    }
                    className="w-full bg-transparent border-0 text-zinc-200 placeholder-zinc-550 font-sans text-sm focus:outline-none focus:ring-0 outline-none resize-none min-h-[72px]"
                  />

                  <div className="flex items-center justify-end border-t border-zinc-850 pt-2.5 mt-1">
                    <Button
                      onClick={projectData ? handleSendProjectEdit : handleStartGeneration}
                      disabled={!canSubmit}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shadow shadow-indigo-600/10 flex items-center gap-1 px-4 py-2"
                    >
                      <span>Send</span>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Inline Parameters Sidebar when NO project is active */}
            {!(projectData || sse.isStreaming || sse.images.length > 0) && isSidebarOpen && (
              renderParameters(false)
            )}

            {/* Right Column: Visual Sandbox Workspace + docked Parameters (when project active) */}
            {(projectData || sse.isStreaming || sse.images.length > 0) && (
              <div className="w-[60%] h-full p-4 flex gap-4 overflow-hidden">
                <div className="flex-1 h-full overflow-hidden">
                  <ProjectWorkspace
                    projectId={urlProjectId || ''}
                    projectPath={projectData?.path || sse.projectPath}
                    files={projectData?.files || []}
                    images={projectData?.images || []}
                    selectedImage={selectedImage}
                    onSelectImage={handleSelectImage}
                    newImages={projectData ? projectChat.newImages : sse.images}
                    newFiles={projectData ? projectChat.newFiles : sse.files}
                    logs={projectData ? projectChat.logs : sse.log}
                    isStreaming={sse.isStreaming || projectChat.isStreaming}
                    onRegenerateImage={projectChat.regenerate}
                    
                    // Publishing props
                    platform={platform}
                    onPlatformChange={setPlatform}
                    caption={caption}
                    onCaptionChange={setCaption}
                    isCaptioning={isCaptioning}
                    onGenerateCaption={generateCaption}
                    captionError={captionError}
                    isPackaging={isPackaging}
                    onPreparePackage={preparePackage}
                    packageResult={packageResult}
                    packageError={packageError}
                    isPublishing={isPublishing}
                    onOpenPublisher={openPublisher}
                    publishResult={publishResult}
                    publishError={publishError}
                    xhsAvailable={xhsAvailable}
                    publishingAccounts={publishingAccounts}
                    publishingAccount={publishingAccount}
                    onPublishingAccountChange={setPublishingAccount}
                  />
                </div>
                {isSidebarOpen && renderParameters(true)}
              </div>
            )}
            
          </div>
  );
}
