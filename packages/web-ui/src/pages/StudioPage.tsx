import { useEffect, useMemo, useState, useRef, useReducer } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Compass, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { getSkill, skills } from '../data'
import type { ConfigItem, SkillDefinition, SkillParameter } from '../types/skills'
import { useSSE } from '../hooks/useSSE'
import { useProjectChat } from '../hooks/useProjectChat'
import ProjectWorkspace from '../components/project/ProjectWorkspace'
import ChatThread from '../components/chat/ChatThread'
import ChatComposer, { type ChatComposerHandle } from '../components/chat/ChatComposer'
import type { CommandRequest, ProjectPlan } from '@happytokenai/happyimage-core'
import { chatReducer, makeMessage } from '../lib/chat-reducer'
import { parseSSEStream } from '../lib/sse'
import type { ChatMessage } from '../lib/chat-reducer'
import { previewForItem, previewForSkill, getStyleGradient, getPaletteGradient } from '../lib/screenshots'
import { encodeProjectId } from '../lib/project'

interface PreferenceInfo {
  found: boolean
  path: string | null
  summary: Array<{ key: string; value: string }>
  targets?: Array<{ scope: string; label: string; path: string; exists: boolean }>
}

interface SchemaField {
  key: string
  label: string
  labelZh: string
  type: 'text' | 'select' | 'number' | 'boolean' | 'password' | 'textarea' | 'object'
  defaultValue?: string | number | boolean
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  sensitive?: boolean
  hint?: string
  min?: number
  max?: number
  step?: number
}

interface PreferenceSchema {
  skillId: string
  name: string
  nameZh: string
  fields: SchemaField[]
}

interface PublishingAccount {
  name: string
  alias: string
  isDefault: boolean
  method: string
  author: string
}

function CompactStyleCard({
  item,
  active,
  preview,
  onClick,
}: {
  item: ConfigItem
  active: boolean
  preview?: string
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const fallback = getStyleGradient(item.id) || getPaletteGradient(item.id)

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.name}: ${item.description}`}
      className={`group flex flex-col w-24 shrink-0 rounded-xl overflow-hidden border text-left cursor-pointer transition-all duration-300 ${
        active 
          ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/20' 
          : 'border-zinc-850 bg-zinc-950 hover:border-zinc-700 hover:scale-[1.02]'
      }`}
    >
      <div className="w-full aspect-[4/3] bg-zinc-950/50 overflow-hidden relative border-b border-zinc-900/40">
        {preview && !imgError ? (
          <img 
            src={preview} 
            alt={item.name} 
            onError={() => setImgError(true)} 
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" 
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] font-bold text-white/90 leading-tight" 
            style={{ background: fallback }}
          >
            {item.name}
          </div>
        )}

        {/* Selected checkmark top-right */}
        {active && (
          <div className="absolute top-1 right-1 bg-indigo-650 text-white rounded-full p-0.5 shadow-md z-10 animate-scale-in">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        )}
      </div>

      {/* Label area below the image */}
      <div className="w-full px-1.5 py-1.5 text-[9px] font-semibold text-zinc-300 truncate text-center bg-zinc-900/50 leading-none">
        {item.name}
      </div>
    </button>
  )
}

function parseAnalysisFrontMatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (key && val && !val.startsWith('{') && !val.startsWith('[')) result[key] = val
  }
  return result
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

const parameterNames = new Set(['language', 'aspectRatio', 'imageCount', 'pageCount', 'slides', 'audience', 'density', 'scale'])

function optionsForParameter(parameter: SkillParameter): ConfigItem[] {
  if (parameter.options) {
    return parameter.options.map(option => ({
      id: option.value,
      name: option.label,
      description: option.value,
      tags: [],
    }))
  }
  const defaults: Record<string, ConfigItem[]> = {
    imageCount: [1, 2, 4, 6, 8].map(count => ({ id: String(count), name: `${count}`, description: `${count} images`, tags: [] })),
    pageCount: [1, 2, 4, 6, 8].map(count => ({ id: String(count), name: `${count}`, description: `${count} pages`, tags: [] })),
    slides: [6, 8, 10, 12, 16].map(count => ({ id: String(count), name: `${count}`, description: `${count} slides`, tags: [] })),
  }
  return defaults[parameter.name] || [{ id: String(parameter.defaultValue || ''), name: String(parameter.defaultValue || 'Default'), description: 'Default value', tags: [] }]
}

function parsePublishSlash(input: string) {
  const match = input.trim().match(/^\/baoyu-post-to-(wechat|weibo|x)(?:\s+(.+))?$/)
  if (!match) return null
  return { platform: match[1], packagePath: (match[2] || '').trim() }
}

function parseContentSlashSkill(input: string) {
  const command = input.trim().split(/\s+/, 1)[0]?.replace(/^\//, '')
  const map: Record<string, string> = {
    'baoyu-image-cards': 'image-cards',
    'baoyu-xhs-images': 'image-cards',
    'baoyu-cover-image': 'cover-image',
    'baoyu-infographic': 'infographic',
    'baoyu-article-illustrator': 'article-illustrator',
    'baoyu-comic': 'comic',
    'baoyu-slide-deck': 'slide-deck',
    'baoyu-diagram': 'diagram',
  }
  return command ? map[command] : undefined
}

function commandIdForSkill(skillId: string) {
  const map: Record<string, string> = {
    'image-cards': 'baoyu-image-cards',
    'xhs-images': 'baoyu-image-cards',
    'cover-image': 'baoyu-cover-image',
    infographic: 'baoyu-infographic',
    'article-illustrator': 'baoyu-article-illustrator',
    comic: 'baoyu-comic',
    'slide-deck': 'baoyu-slide-deck',
    diagram: 'baoyu-diagram',
  }
  return map[skillId] || `baoyu-${skillId}`
}

const welcomeMsg = makeMessage('assistant', 'Describe what you would like to design, or point to a local directory or GitHub repository. Choose a skill and styles below to begin.')

export default function StudioPage() {
  const { id: urlProjectId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const chatThreadRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const sendingRef = useRef(false)
  const composerRef = useRef<ChatComposerHandle>(null)

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [workspaceWidth, setWorkspaceWidth] = useState(560)
  const workspaceDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const defaultSkill = skills[0]
  const [skillId, setSkillId] = useState(defaultSkill.id)
  const skill = getSkill(skillId) || defaultSkill
  const [selections, setSelections] = useState<Record<string, string>>(() => initialSelections(defaultSkill))
  const [aspectRatio, setAspectRatio] = useState(defaultSkill.defaultAspectRatio)
  const [language, setLanguage] = useState('zh')
  const [imageCount, setImageCount] = useState(defaultImageCount(defaultSkill))

  const [extraParams, setExtraParams] = useState<Record<string, string>>(() => {
    const nextSkill = skills[0]
    return Object.fromEntries(
      nextSkill.parameters
        .filter(param => parameterNames.has(param.name) && !['language', 'aspectRatio', 'imageCount', 'pageCount', 'slides'].includes(param.name))
        .map(param => [param.name, String(param.defaultValue ?? '')])
    )
  })

  const buildPayload = (
    currentSkill: SkillDefinition,
    currentSelections: Record<string, string>,
    currentAspectRatio: string,
    currentLanguage: string,
    currentImageCount: number,
    currentExtraParams: Record<string, string>,
    currentUsePreferences: boolean,
  ) => {
    const payload: Record<string, string> = { ...currentSelections, usePreferences: String(currentUsePreferences) }
    
    if (currentSkill.parameters.some(p => p.name === 'language')) {
      payload.language = currentLanguage
    }
    if (currentSkill.parameters.some(p => p.name === 'aspectRatio')) {
      payload.aspectRatio = currentAspectRatio
    }
    const countParam = currentSkill.parameters.find(p => ['imageCount', 'pageCount', 'slides'].includes(p.name))
    if (countParam) {
      payload[countParam.name] = String(currentImageCount)
    }
    for (const [k, v] of Object.entries(currentExtraParams)) {
      payload[k] = v
    }
    return payload
  }

  const configSummary = useMemo(() => {
    const parts: string[] = [skill.nameZh]
    if (imageCount > 1) parts.push(`${imageCount} 张`)
    return parts.join(' · ')
  }, [skill, imageCount])

  const [sourceMode, setSourceMode] = useState('text')
  const [sourceRef, setSourceRef] = useState('')
  const [uploadedSourceName, setUploadedSourceName] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  const [preferenceInfo, setPreferenceInfo] = useState<PreferenceInfo | null>(null)
  const [preferenceSchema, setPreferenceSchema] = useState<PreferenceSchema | null>(null)
  const [prefFormValues, setPrefFormValues] = useState<Record<string, unknown>>({})
  const [prefSaving, setPrefSaving] = useState(false)
  const [prefScope, setPrefScope] = useState<string>('config')
  const [usePreferences, setUsePreferences] = useState(true)
  const [skipPlanConfirmation, setSkipPlanConfirmation] = useState(false)

  const [projectData, setProjectData] = useState<any | null>(null)
  const [loadingProject, setLoadingProject] = useState(false)

  const [platform, setPlatform] = useState('xiaohongshu')
  const [caption, setCaption] = useState('')
  const [publishingAccounts, setPublishingAccounts] = useState<PublishingAccount[]>([])
  const [publishingAccount, setPublishingAccount] = useState('')
  const [xhsAvailable, setXhsAvailable] = useState<boolean | null>(null)

  const [isCaptioning, setIsCaptioning] = useState(false)
  const [captionError, setCaptionError] = useState<string | null>(null)
  const [isPackaging, setIsPackaging] = useState(false)
  const [packageResult, setPackageResult] = useState<{ packagePath: string; files: string[]; images: string[] } | null>(null)
  const [packageError, setPackageError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ pid: number; logPath: string; message: string } | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const [chat, dispatch] = useReducer(chatReducer, { messages: [welcomeMsg], streamingMsgId: null, planningMsgId: null })
  const [chatInput, setChatInput] = useState('')
  const [pendingGenerationContent, setPendingGenerationContent] = useState('')
  const [pendingGenerationSkillId, setPendingGenerationSkillId] = useState(skill.id)
  const [pendingCommandRequest, setPendingCommandRequest] = useState<CommandRequest | null>(null)
  const activeSessionId = searchParams.get('session')
  const setActiveSessionId = (id: string | null) => {
    const params = new URLSearchParams(searchParams)
    if (id) { params.set('session', id) } else { params.delete('session') }
    const basePath = urlProjectId ? `/projects/${urlProjectId}` : '/'
    navigate(`${basePath}?${params.toString()}`, { replace: true })
  }
  const [disabledPlanPrompts, setDisabledPlanPrompts] = useState<Set<number>>(new Set())
  const [isSending, setIsSending] = useState(false)

  const sse = useSSE()
  const projectChat = useProjectChat(urlProjectId || '')
  const isStreaming = sse.isStreaming || projectChat.isStreaming || chat.streamingMsgId !== null

  const hasWorkspaceContent = !!(projectData || sse.isStreaming || sse.images.length > 0)
  useEffect(() => {
    if (hasWorkspaceContent) setWorkspaceOpen(true)
    else setWorkspaceOpen(false)
  }, [hasWorkspaceContent])

  const appendMessage = (role: ChatMessage['role'], text: string, type?: ChatMessage['type'], extra?: Partial<ChatMessage>) => {
    const msg = makeMessage(role, text, type, extra)
    dispatch({ type: 'ADD_MESSAGE', message: msg })
    return msg.id
  }

  // Load settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && (data.SKIP_PLAN_CONFIRMATION === 'true' || data.SKIP_PLAN_CONFIRMATION === '1')) {
          setSkipPlanConfirmation(true)
        }
      })
      .catch(err => console.warn('Failed to load settings:', err))
  }, [])

  // Set to true before navigating to project page after generation, so the project
  // loading effect doesn't reset the in-memory chat messages.
  const justNavigatedFromGenerationRef = useRef(false)

  // Auto-create session on first visit if none in URL
  // Reuses an existing blank session to prevent accumulation of empty New Chat entries
  const autoCreateRef = useRef(false)
  useEffect(() => {
    if (urlProjectId || activeSessionId) return
    if (autoCreateRef.current) return
    autoCreateRef.current = true
    let cancelled = false
    fetch('/api/sessions')
      .then(res => res.json())
      .then(async (sessions: any[]) => {
        if (cancelled) return
        const blank = Array.isArray(sessions)
          ? sessions.find(s => !s.projectPath && !s.lastMessage && s.imageCount === 0)
          : null
        if (blank) { setActiveSessionId(blank.id); return }
        const data = await fetch('/api/sessions', { method: 'POST' }).then(r => r.json())
        if (!cancelled && data.session?.id) setActiveSessionId(data.session.id)
      })
      .catch(() => {})
    return () => { cancelled = true; autoCreateRef.current = false }
  }, [urlProjectId])

  // Load active project from URL
  const projectLoading = useRef(false)
  useEffect(() => {
    if (!urlProjectId) {
      setProjectData(null)
      dispatch({ type: 'RESET_MESSAGES', messages: [welcomeMsg] })
      sse.reset()
      projectChat.reset()
      setSkillId(defaultSkill.id)
      setSelections(initialSelections(defaultSkill))
      setAspectRatio(defaultSkill.defaultAspectRatio)
      setImageCount(defaultImageCount(defaultSkill))
      setExtraParams({})
      setLanguage('zh')
      setSourceMode('text')
      setSourceRef('')
      setUploadedSourceName('')
      setCaption('')
      setPackageResult(null)
      setPublishResult(null)
      return
    }

    let cancelled = false
    if (projectLoading.current) return
    projectLoading.current = true
    setLoadingProject(true)
    fetch(`/api/projects/${urlProjectId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setProjectData(data)

        const loadedSkillId = data.categoryDir || defaultSkill.id
        const loadedSkill = getSkill(loadedSkillId) || defaultSkill
        setSkillId(loadedSkillId)

        // Restore imageCount from actual images, aspectRatio/language/selections from analysis
        if (data.images && data.images.length > 0) setImageCount(data.images.length)
        const analysisFile = data.files?.find((f: any) => f.kind === 'analysis')
        if (analysisFile?.content) {
          const fm = parseAnalysisFrontMatter(analysisFile.content)
          if (fm.aspectRatio) setAspectRatio(fm.aspectRatio)
          if (fm.language) setLanguage(fm.language)
          const restoredSelections: Record<string, string> = {}
          for (const dimKey of Object.keys(loadedSkill.dimensions)) {
            if (fm[dimKey]) restoredSelections[dimKey] = fm[dimKey]
          }
          if (Object.keys(restoredSelections).length > 0) setSelections(restoredSelections)

          const extras: Record<string, string> = {}
          for (const param of loadedSkill.parameters) {
            if (parameterNames.has(param.name) && !['language', 'aspectRatio', 'imageCount', 'pageCount', 'slides'].includes(param.name)) {
              if (fm[param.name]) extras[param.name] = fm[param.name]
            }
          }
          if (Object.keys(extras).length > 0) setExtraParams(extras)
        }

        if (data.files && data.files.length > 0) {
          const copyFile = data.files.find((f: any) => f.kind === 'copy')
          if (copyFile && copyFile.content) setCaption(copyFile.content)
        }

        const initialMsg = makeMessage('assistant', `Loaded project "${data.name}". You can now review files in the workspace on the right, or type modifications below (e.g. "make the 2nd image layout cleaner").`)

        // Only reset messages if we didn't just navigate here from a live generation
        // (in that case the in-memory chat already has the full generation history)
        if (!justNavigatedFromGenerationRef.current) {
          const historyMsgs: ChatMessage[] = (data.conversations || []).flatMap((c: any) => [
            makeMessage('user', c.message),
            makeMessage('assistant', c.plan),
          ])
          dispatch({ type: 'RESET_MESSAGES', messages: [initialMsg, ...historyMsgs] })
        }

        fetch(`/api/sessions?projectPath=${encodeURIComponent(data.path)}`)
          .then(res => res.json())
          .then(async (sessions) => {
            if (cancelled) return
            const existing = Array.isArray(sessions) ? sessions[0] : null
            let sessionId = existing?.id || null
            if (!sessionId) {
              const created = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: data.name, projectPath: data.path }),
              }).then(res => res.json())
              sessionId = created.session?.id || null
            }
            if (sessionId && data.conversations?.length) {
              const syncMessages: Array<{ role: string; content: string }> = []
              for (const c of data.conversations) {
                if (c.message) syncMessages.push({ role: 'user', content: c.message })
                if (c.plan) syncMessages.push({ role: 'assistant', content: c.plan })
              }
              if (syncMessages.length > 0) {
                fetch(`/api/sessions/${sessionId}/sync`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messages: syncMessages }),
                }).catch(() => {})
              }
            }

            // On page reload (not navigating from generation), load session events for history
            const fromGeneration = justNavigatedFromGenerationRef.current
            justNavigatedFromGenerationRef.current = false
            if (sessionId && !fromGeneration && !cancelled) {
              try {
                const evData = await fetch(`/api/sessions/${sessionId}/events`).then(r => r.json())
                const sessionMessages: ChatMessage[] = []
                for (const msg of (evData?.session?.messages || [])) {
                  if (msg.role && msg.content) {
                    sessionMessages.push(makeMessage(msg.role as 'user' | 'assistant', msg.content))
                  }
                }
                const evts: any[] = evData?.events || []
                const planEvt = [...evts].reverse().find((e: any) => e.type === 'plan')
                if (planEvt?.plan) {
                  sessionMessages.push(makeMessage('assistant', `Plan: ${planEvt.plan.title || ''}`, 'plan', { planData: planEvt.plan }))
                }
                if (evts.some((e: any) => e.type === 'done')) {
                  sessionMessages.push(makeMessage('assistant', 'Generation completed.'))
                }
                if (sessionMessages.length > 0 && !cancelled) {
                  dispatch({ type: 'RESET_MESSAGES', messages: [initialMsg, ...sessionMessages] })
                }
              } catch { /* keep historyMsgs */ }
            } else {
              justNavigatedFromGenerationRef.current = false
            }

            if (sessionId) setActiveSessionId(sessionId)
          })
          .catch(err => { if (!cancelled) console.warn('Failed to fetch/create chat session:', err) })
      })
      .catch(err => {
        if (cancelled) return
        dispatch({ type: 'RESET_MESSAGES', messages: [makeMessage('system', err.message || 'Failed to load project')] })
      })
      .finally(() => { if (!cancelled) setLoadingProject(false) })

    return () => { cancelled = true; projectLoading.current = false }
  }, [urlProjectId])

  // Handle gallery/skill query params
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
    
    // Set extraParams from query params
    const extras: Record<string, string> = {}
    for (const param of requestedSkill.parameters) {
      if (parameterNames.has(param.name) && !['language', 'aspectRatio', 'imageCount', 'pageCount', 'slides'].includes(param.name)) {
        const val = searchParams.get(param.name) || String(param.defaultValue ?? '')
        extras[param.name] = val
      }
    }
    setExtraParams(extras)

    setIsSidebarOpen(searchParams.get('drawer') === '1')
    const requestedSessionId = searchParams.get('session')
    if (requestedSessionId) setActiveSessionId(requestedSessionId)
    dispatch({ type: 'RESET_MESSAGES', messages: [
      makeMessage('assistant', `Gallery selections are loaded for ${requestedSkill.nameZh}${requestedSessionId ? ` in session ${requestedSessionId.slice(0, 8)}` : ''}. Describe the topic, paste a GitHub repository, or tell me what you want to generate.`),
    ]})
  }, [searchParams, urlProjectId])

  // Load session history when switching sessions
  useEffect(() => {
    if (!activeSessionId || urlProjectId) return
    fetch(`/api/sessions/${activeSessionId}/events`)
      .then(res => res.json())
      .then(data => {
        const session = data.session
        if (!session) return
        const events = data.events || []
        const msgs: ChatMessage[] = [makeMessage('assistant', `Session: ${session.title || 'New Chat'}`)]
        for (const evt of events) {
          if (evt.type === 'message') {
            msgs.push(makeMessage(evt.role || 'user', evt.content || ''))
          } else if (evt.type === 'plan' && evt.plan) {
            msgs.push(makeMessage('assistant', `Plan: ${evt.plan.title || ''}`, 'plan', { planData: evt.plan }))
          } else if (evt.type === 'done') {
            msgs.push(makeMessage('assistant', 'Generation completed.'))
          } else if (evt.type === 'error' && evt.message) {
            msgs.push(makeMessage('system', evt.message))
          }
        }

        // If task is still running, show a runner message and connect to stream
        if (data.activeTask?.status === 'running') {
          const runnerId = makeMessage('assistant', 'Task is still running... Reconnecting...', 'runner').id
          msgs.push({ id: runnerId, role: 'assistant', text: '', type: 'runner' })
          dispatch({ type: 'RESET_MESSAGES', messages: msgs })
          dispatch({ type: 'SET_STREAMING', messageId: runnerId })

          // Connect to stream for live updates
          const lastSeq = events.length > 0 ? events[events.length - 1].seq : 0
          fetch(`/api/sessions/${activeSessionId}/stream?after=${lastSeq}`)
            .then(res => {
              if (!res.ok) return
              return parseSSEStream(res, (msg: any) => {
                if (msg.type === 'replay' && msg.event) {
                  // Skip replays, they're historical
                } else if (msg.type === 'text') {
                  dispatch({ type: 'APPEND_TEXT', messageId: runnerId, text: msg.text || '' })
                } else if (msg.type === 'done') {
                  dispatch({ type: 'SET_MESSAGE', messageId: runnerId, patch: { text: 'Task completed.', type: 'text' } })
                  dispatch({ type: 'SET_STREAMING', messageId: null })
                }
              })
            })
            .catch(() => {
              dispatch({ type: 'SET_STREAMING', messageId: null })
            })
          return
        }

        dispatch({ type: 'RESET_MESSAGES', messages: msgs })
      })
      .catch(() => {})
  }, [activeSessionId])

  // Fetch skill preferences
  useEffect(() => {
    setPreferenceInfo(null)
    setPreferenceSchema(null)
    setPrefFormValues({})
    fetch(`/api/preferences/${skill.id}`)
      .then(res => res.json())
      .then(data => {
        setPreferenceInfo(data)
        if (data.found) setPrefFormValues(data.values || {})
      })
      .catch(() => setPreferenceInfo(null))
    fetch(`/api/preferences/${skill.id}/schema`)
      .then(res => res.json())
      .then(data => setPreferenceSchema(data))
      .catch(() => setPreferenceSchema(null))
  }, [skill.id])

  const handleSavePreferences = async () => {
    setPrefSaving(true)
    try {
      const res = await fetch(`/api/preferences/${skill.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: prefFormValues, scope: prefScope }),
      })
      const data = await res.json()
      if (res.ok) setPreferenceInfo(data)
    } catch { /* ignore */ }
    setPrefSaving(false)
  }

  const checkXhsAvailable = () => {
    fetch('/api/publish/probe?platform=xiaohongshu')
      .then(res => res.json())
      .then(data => setXhsAvailable(data.xiaohongshu?.available ?? false))
      .catch(() => setXhsAvailable(false))
  }

  // Fetch publish accounts
  useEffect(() => {
    setXhsAvailable(null)
    checkXhsAvailable()
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
      .catch(() => { setPublishingAccounts([]); setPublishingAccount('') })
  }, [platform])

  // Smart scroll
  useEffect(() => {
    if (!nearBottomRef.current) return
    const el = chatThreadRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'instant' : 'smooth' })
  }, [chat.messages, sse.log, projectChat.logs, isStreaming])

  // Reset sending guard when streaming stops
  useEffect(() => {
    if (!isStreaming) sendingRef.current = false
  }, [isStreaming])

  const selectSkill = (nextId: string) => {
    const nextSkill = getSkill(nextId)
    if (!nextSkill) return
    setSkillId(nextId)
    setSelections(initialSelections(nextSkill))
    
    const langParam = nextSkill.parameters.find(p => p.name === 'language')
    if (langParam) {
      setLanguage(String(langParam.defaultValue ?? 'zh'))
    } else {
      setLanguage('zh')
    }
    
    const aspectParam = nextSkill.parameters.find(p => p.name === 'aspectRatio')
    if (aspectParam) {
      setAspectRatio(String(aspectParam.defaultValue ?? nextSkill.defaultAspectRatio))
    } else {
      setAspectRatio(nextSkill.defaultAspectRatio)
    }

    const countParam = nextSkill.parameters.find(p => ['imageCount', 'pageCount', 'slides'].includes(p.name))
    if (countParam) {
      setImageCount(Number(countParam.defaultValue ?? defaultImageCount(nextSkill)))
    } else {
      setImageCount(defaultImageCount(nextSkill))
    }

    const extras = Object.fromEntries(
      nextSkill.parameters
        .filter(param => parameterNames.has(param.name) && !['language', 'aspectRatio', 'imageCount', 'pageCount', 'slides'].includes(param.name))
        .map(param => [param.name, String(param.defaultValue ?? '')])
    )
    setExtraParams(extras)
  }

  // --- Initial Generation Flow (SSE) ---

  const handleStartGeneration = async () => {
    if (sendingRef.current) return
    const query = chatInput.trim()
    const publishCommand = parsePublishSlash(query)
    if (publishCommand) {
      sendingRef.current = true
      setIsSending(true)
      await runPublishSlash(publishCommand.platform, publishCommand.packagePath)
      sendingRef.current = false
      setIsSending(false)
      return
    }
    const hasSource = sourceMode !== 'text' && Boolean(sourceRef.trim())
    if (!query && !hasSource) return
    sendingRef.current = true
    setIsSending(true)
    const generationContent = query || ''
    const activeSkillId = parseContentSlashSkill(query) || skill.id
    setChatInput('')
    setPendingGenerationContent(generationContent)
    setPendingGenerationSkillId(activeSkillId)
    setDisabledPlanPrompts(new Set())

    const payload = buildPayload(skill, selections, aspectRatio, language, imageCount, extraParams, usePreferences)
    const commandRequest: CommandRequest = {
      commandId: commandIdForSkill(activeSkillId),
      source: sourceMode === 'file' && sourceRef
        ? { type: 'file', value: sourceRef }
        : { type: 'text', value: generationContent },
      options: sourceMode === 'file' && generationContent
        ? { ...payload, prompt: generationContent }
        : payload,
    }
    setPendingCommandRequest(commandRequest)

    let sessionId = activeSessionId
    if (!sessionId) {
      try {
        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query || generationContent || uploadedSourceName, commandRequest }),
        })
        const sessionData = await sessionRes.json()
        if (sessionRes.ok && sessionData.session?.id) {
          sessionId = sessionData.session.id
          setActiveSessionId(sessionData.session.id)
        }
      } catch (err) {
        console.warn('Failed to create session, falling back to activeSessionId:', err)
        sessionId = activeSessionId
      }
    }

    // Update session title and persist user message to session history
    const userMessage = query || generationContent || uploadedSourceName
    const titleFromInput = userMessage.slice(0, 60)
    if (sessionId && titleFromInput) {
      fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleFromInput }),
      }).catch(() => {})
      fetch(`/api/sessions/${sessionId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: userMessage }] }),
      }).catch(() => {})
    }

    appendMessage('user', query || `使用${uploadedSourceName ? `上传文件 ${uploadedSourceName}` : '已选择的内容源'}生成图片`)

    if (skipPlanConfirmation) {
      const streamId = appendMessage('assistant', '', 'runner')
      dispatch({ type: 'SET_STREAMING', messageId: streamId })
      setIsSending(false)
      let capturedPath = ''
      sse.start(activeSkillId, generationContent, payload, {
        onText: (text) => dispatch({ type: 'APPEND_TEXT', messageId: streamId, text }),
        onToolUse: (name, input) => {
          const toolId = `tool-${name}-${Date.now()}`
          dispatch({ type: 'UPSERT_TOOL', messageId: toolId, name, status: 'started', input })
        },
        onError: (errMsg) => {
          dispatch({ type: 'SET_MESSAGE', messageId: streamId, patch: { text: `Generation failed: ${errMsg}`, type: 'error', retryFn: () => sse.retry() } })
          dispatch({ type: 'SET_STREAMING', messageId: null })
        },
        onDone: (doneImages) => {
          dispatch({ type: 'APPEND_TEXT', messageId: streamId, text: doneImages.length > 0 ? `\n\n✓ Generated ${doneImages.length} images.` : '\n\n⚠ No images returned.' })
          dispatch({ type: 'SET_STREAMING', messageId: null })
          if (capturedPath) {
            justNavigatedFromGenerationRef.current = true
            navigate(`/projects/${encodeProjectId(capturedPath)}${sessionId ? `?session=${sessionId}` : ''}`)
          }
        },
        onProject: (path) => {
          capturedPath = path
          dispatch({ type: 'APPEND_TEXT', messageId: streamId, text: `\n\n[→ Open project workspace](/projects/${encodeProjectId(path)})` })
        },
      }, { sourceMode, sourceRef, sessionId: sessionId || undefined, commandRequest: commandRequest as unknown as Record<string, unknown> })
      return
    }

    const thinkingId = appendMessage('assistant', '', 'thinking')
    dispatch({ type: 'SET_PLANNING', messageId: thinkingId })

    try {
      const res = sessionId
        ? await fetch(`/api/sessions/${sessionId}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandRequest }),
        })
        : await fetch('/api/generate/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: activeSkillId, content: generationContent, selections: payload, sourceMode, sourceRef }),
        })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const plan = data.plan || data

      dispatch({ type: 'SET_MESSAGE', messageId: thinkingId, patch: {
        text: `I have prepared a generation plan for you: **${plan.title || 'Untitled Project'}**`,
        type: 'plan',
        planData: plan,
        sourceContent: generationContent,
      }})
    } catch (err: any) {
      dispatch({ type: 'SET_MESSAGE', messageId: thinkingId, patch: {
        text: `Failed to prepare plan: ${err.message || 'Error occurred.'}`,
        role: 'system',
        type: 'error',
      }})
      dispatch({ type: 'CLEAR_PLANNING' })
    } finally {
      setIsSending(false)
    }
  }

  const confirmGeneratePlan = (confirmedPlan: ProjectPlan, disabledPrompts: Set<number>, sourceContent?: string) => {
    const content = (sourceContent || pendingGenerationContent || chatInput).trim()
    const payload = buildPayload(skill, selections, aspectRatio, language, imageCount, extraParams, usePreferences)
    const activePrompts = confirmedPlan.prompts.filter((_, i) => !disabledPrompts.has(i))
    const adjustedPlan = { ...confirmedPlan, prompts: activePrompts }

    if (chat.planningMsgId) {
      dispatch({ type: 'SET_MESSAGE', messageId: chat.planningMsgId, patch: { confirmed: true } })
    }
    dispatch({ type: 'CLEAR_PLANNING' })

    const streamId = appendMessage('assistant', '', 'runner')
    dispatch({ type: 'SET_STREAMING', messageId: streamId })

    let capturedPath = ''
    sse.start(pendingGenerationSkillId || skill.id, content, payload, {
      onText: (text) => dispatch({ type: 'APPEND_TEXT', messageId: streamId, text }),
      onToolUse: (name, input) => {
        const toolId = `tool-${name}-${Date.now()}`
        dispatch({ type: 'UPSERT_TOOL', messageId: toolId, name, status: 'started', input })
      },
      onError: (errMsg) => {
        dispatch({ type: 'SET_MESSAGE', messageId: streamId, patch: { text: `Generation failed: ${errMsg}`, type: 'error', retryFn: () => sse.retry() } })
        dispatch({ type: 'SET_STREAMING', messageId: null })
      },
      onDone: (doneImages) => {
        dispatch({ type: 'APPEND_TEXT', messageId: streamId, text: doneImages.length > 0 ? `\n\n✓ Generated ${doneImages.length} images.` : '\n\n⚠ No images returned.' })
        dispatch({ type: 'SET_STREAMING', messageId: null })
        if (capturedPath) {
          justNavigatedFromGenerationRef.current = true
          navigate(`/projects/${encodeProjectId(capturedPath)}${activeSessionId ? `?session=${activeSessionId}` : ''}`)
        }
      },
      onProject: (path) => {
        capturedPath = path
        dispatch({ type: 'APPEND_TEXT', messageId: streamId, text: `\n\n[→ Open project workspace](/projects/${encodeProjectId(path)})` })
      },
    }, {
      sourceMode, sourceRef,
      prebuiltPlan: adjustedPlan as unknown as Record<string, unknown>,
      sessionId: activeSessionId || undefined,
      commandRequest: pendingCommandRequest as unknown as Record<string, unknown> | undefined,
    })
    setPendingGenerationContent('')
    setPendingGenerationSkillId(skill.id)
    setPendingCommandRequest(null)
  }

  const cancelGeneratePlan = () => {
    dispatch({ type: 'REMOVE_MESSAGE', messageId: chat.planningMsgId! })
    dispatch({ type: 'CLEAR_PLANNING' })
    setPendingGenerationContent('')
    setPendingGenerationSkillId(skill.id)
    setPendingCommandRequest(null)
    setDisabledPlanPrompts(new Set())
  }

  // --- Incremental Edit Chat Flow ---

  const handleSendProjectEdit = async () => {
    if (sendingRef.current) return
    const query = chatInput.trim()
    if (!query || projectChat.isStreaming) return
    const publishCommand = parsePublishSlash(query)
    if (publishCommand) {
      sendingRef.current = true
      setIsSending(true)
      await runPublishSlash(publishCommand.platform, publishCommand.packagePath)
      sendingRef.current = false
      setIsSending(false)
      return
    }
    sendingRef.current = true
    setIsSending(true)
    setChatInput('')

    const targetImageIndex = selectedImage !== null ? selectedImage : undefined
    const targetImageName = (selectedImage !== null && projectData?.images?.[selectedImage])
      ? projectData.images[selectedImage].name
      : undefined

    appendMessage('user', query, undefined, { targetImageIndex, targetImageName })
    if (activeSessionId) {
      fetch(`/api/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          targetArtifactId: selectedImage !== null ? `image-${selectedImage}` : undefined,
          targetImageIndex,
          targetImageName,
        }),
      }).catch(err => console.warn('Failed to post session message:', err))
    }

    const target = selectedImage !== null ? { type: 'image', index: selectedImage } : undefined
    try {
      await projectChat.sendMessage(query, target)
    } finally {
      setIsSending(false)
    }
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
    if (mode !== 'file') { setUploadedSourceName(''); setUploadStatus('') }
    if (mode === 'text') setSourceRef('')
  }

  const canSubmit = projectData
    ? Boolean(chatInput.trim()) && !projectChat.isStreaming && !sendingRef.current
    : (Boolean(chatInput.trim()) || (sourceMode !== 'text' && Boolean(sourceRef.trim()))) && !sse.isStreaming && !sendingRef.current

  const runPublishSlash = async (targetPlatform: string, explicitPackagePath = '') => {
    const packagePath = explicitPackagePath || packageResult?.packagePath || ''
    setChatInput('')
    appendMessage('user', explicitPackagePath ? `/baoyu-post-to-${targetPlatform} ${explicitPackagePath}` : `/baoyu-post-to-${targetPlatform}`)
    if (!packagePath) {
      appendMessage('system', 'Publishing slash command needs a prepared package path. Run Asset Pack first, or pass a package path after the command.')
      return
    }
    appendMessage('assistant', `Starting ${targetPlatform} publishing flow...`)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: targetPlatform, packagePath, accountAlias: publishingAccount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      appendMessage('assistant', data.message || `${targetPlatform} publishing flow started.`)
    } catch (err: any) {
      appendMessage('system', err.message || 'Publishing command failed')
    }
  }

  const sourceInputHint = sourceMode === 'github'
    ? 'https://github.com/owner/repo'
    : sourceMode === 'file'
      ? 'Upload a .md, .markdown, or .txt file'
      : '/Users/.../project'

  // Watch for finished project chat stream
  const prevStreaming = useRef(false)
  const chatErrorRef = useRef<string | null>(null)
  useEffect(() => {
    chatErrorRef.current = projectChat.error
  }, [projectChat.error])
  useEffect(() => {
    if (prevStreaming.current && !projectChat.isStreaming && urlProjectId) {
      const capturedError = chatErrorRef.current
      fetch(`/api/projects/${urlProjectId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setProjectData(data)
            const lastConv = data.conversations?.[data.conversations.length - 1]
            if (lastConv && lastConv.plan) {
              appendMessage('assistant', lastConv.plan)
            } else if (capturedError) {
              appendMessage('assistant', `Error: ${capturedError}`)
            }
          } else if (capturedError) {
            appendMessage('assistant', `Error: ${capturedError}`)
          }
        })
        .catch(() => {
          if (capturedError) appendMessage('assistant', `Error: ${capturedError}`)
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
        body: JSON.stringify({ skillId: skill.id, content: projectData?.name || chatInput, selections, platform, imageCount: projectData?.images.length || imageCount }),
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
    if (!projectData) return
    setIsPublishing(true)
    setPublishError(null)
    try {
      // Automatically prepare package first to capture latest caption & images
      const resPack = await fetch('/api/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: projectData.path, platform, caption }),
      })
      const dataPack = await resPack.json()
      if (!resPack.ok) throw new Error(dataPack.error || `HTTP ${resPack.status}`)
      setPackageResult(dataPack)

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packagePath: dataPack.packagePath, platform, accountAlias: publishingAccount }),
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

  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  useEffect(() => {
    if (selectedImage !== null) composerRef.current?.focus()
  }, [selectedImage])

  const selectionSummary = useMemo(() => {
    return Object.entries(selections).map(([key, itemId]) => {
      const item = skill.dimensions[key]?.items.find(i => i.id === itemId)
      return item ? `${skill.dimensions[key].label}: ${item.name}` : `${key}: ${itemId}`
    })
  }, [selections, skill])

  const renderParameters = () => (
    <div className="flex flex-col gap-5 overflow-y-auto w-full h-full p-5 scrollbar-thin">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 border border-indigo-500 rounded px-2.5 py-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
        >
          <Compass className="h-3 w-3" /> Styles Gallery
        </button>
        <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-300 font-semibold p-1 text-sm transition-colors cursor-pointer">
          ✕ Close
        </button>
      </div>

      {/* Active Skill Selector with Previews */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center px-1">
          <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">生成类型 Active Skill</span>
          <span className="text-[9px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/30 rounded px-1.5 py-0.5">
            {skill.nameZh}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {skills.map(item => {
            const active = item.id === skill.id
            const preview = previewForSkill(item)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSkill(item.id)}
                title={`${item.nameZh}: ${item.description}`}
                className={`group flex flex-col w-28 shrink-0 rounded-xl overflow-hidden border text-left cursor-pointer transition-all duration-300 ${
                  active 
                    ? 'border-indigo-500 bg-indigo-950/20 ring-2 ring-indigo-500/20' 
                    : 'border-zinc-850 bg-zinc-950 hover:border-zinc-700 hover:scale-[1.02]'
                }`}
              >
                <div className="w-full aspect-[16/10] bg-zinc-950/50 overflow-hidden relative border-b border-zinc-900/40">
                  {preview ? (
                    <img 
                      src={preview} 
                      alt={item.nameZh} 
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" 
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center p-2 text-center text-[10px] font-bold text-white/90 leading-tight bg-gradient-to-br from-indigo-900 to-zinc-900"
                    >
                      {item.nameZh}
                    </div>
                  )}

                  {/* Selected checkmark top-right */}
                  {active && (
                    <div className="absolute top-1 right-1 bg-indigo-650 text-white rounded-full p-0.5 shadow-md z-10 animate-scale-in">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Label area below the image */}
                <div className="w-full px-1.5 py-1.5 text-[9px] font-semibold text-zinc-300 truncate text-center bg-zinc-900/50 leading-none">
                  {item.nameZh}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Style Dimensions */}
      <div className="flex flex-col gap-4 border-t border-zinc-850 pt-4">
        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Style Dimensions</span>
        {Object.keys(skill.dimensions).map(dimension => {
          const dim = skill.dimensions[dimension]
          const selectedItemId = selections[dimension] || ''
          const selectedItem = dim.items.find(item => item.id === selectedItemId)
          return (
            <div key={dimension} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-zinc-400 text-xs font-semibold">{dim.label}</label>
                {selectedItem && (
                  <span className="text-[9px] text-indigo-400 font-bold bg-indigo-950/40 border border-indigo-900/30 rounded px-1.5 py-0.5 max-w-[150px] truncate" title={selectedItem.description}>
                    {selectedItem.name}
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {dim.items.map(item => (
                  <CompactStyleCard
                    key={item.id}
                    item={item}
                    active={selectedItemId === item.id}
                    preview={previewForItem(skill, dimension, item)}
                    onClick={() => setSelections(prev => ({ ...prev, [dimension]: item.id }))}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Output Parameters */}
      <div className="flex flex-col gap-4 border-t border-zinc-850 pt-4">
        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Output Parameters</span>
        {skill.parameters
          .filter(param => parameterNames.has(param.name))
          .map(param => {
            const options = optionsForParameter(param)
            
            // Get current active value
            let currentValue: string
            let onChange: (val: string) => void
            
            if (param.name === 'language') {
              currentValue = language
              onChange = setLanguage
            } else if (param.name === 'aspectRatio') {
              currentValue = aspectRatio
              onChange = setAspectRatio
            } else if (['imageCount', 'pageCount', 'slides'].includes(param.name)) {
              currentValue = String(imageCount)
              onChange = (val) => setImageCount(Number(val))
            } else {
              currentValue = extraParams[param.name] || String(param.defaultValue ?? '')
              onChange = (val) => setExtraParams(prev => ({ ...prev, [param.name]: val }))
            }
            
            const isCountParam = ['imageCount', 'pageCount', 'slides'].includes(param.name)

            return (
              <div key={param.name} className="flex flex-col gap-1.5">
                <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                  {param.label}
                </span>
                {isCountParam ? (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={currentValue}
                    onChange={e => {
                      const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                      onChange(String(v))
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {options.map(opt => {
                      const active = currentValue === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onChange(opt.id)}
                          className={`flex-grow py-1.5 px-2.5 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer min-w-[60px] ${
                            active
                              ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 font-bold'
                              : 'border-zinc-850 bg-zinc-950 text-zinc-405 hover:text-zinc-200 hover:border-zinc-700'
                          }`}
                        >
                          {opt.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* EXTEND.md Preferences */}
      <div className="flex flex-col gap-4 border-t border-zinc-850 pt-4">
        <div className="border border-zinc-850 p-3 rounded-xl bg-zinc-950/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase">EXTEND.md Preferences</span>
            <span className={`text-[9px] px-1.5 rounded font-bold uppercase ${preferenceInfo?.found ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-zinc-900 text-zinc-550'}`}>{preferenceInfo?.found ? 'found' : 'none'}</span>
          </div>
          {preferenceInfo?.found ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-350 cursor-pointer">
                <input type="checkbox" checked={usePreferences} onChange={e => setUsePreferences(e.target.checked)} className="rounded text-indigo-600 focus:ring-0 cursor-pointer" />
                Apply EXTEND.md preferences
              </label>
            </div>
          ) : preferenceSchema && preferenceSchema.fields.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {preferenceSchema.fields.map(field => {
                const val = prefFormValues[field.key] ?? field.defaultValue ?? ''
                return (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="text-[10px] text-zinc-400 w-24 shrink-0 truncate" title={field.labelZh || field.label}>{field.labelZh || field.label}</label>
                    {field.type === 'boolean' ? (
                      <label className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!val}
                          onChange={e => setPrefFormValues(prev => ({ ...prev, [field.key]: e.target.checked }))}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        {field.hint || (field.labelZh || field.label)}
                      </label>
                    ) : field.type === 'select' && field.options ? (
                      <select
                        value={String(val)}
                        onChange={e => setPrefFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="flex-1 text-[10px] bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 outline-none focus:border-indigo-500"
                      >
                        {field.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={String(val)}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        onChange={e => setPrefFormValues(prev => ({ ...prev, [field.key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))}
                        className="flex-1 text-[10px] bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 outline-none focus:border-indigo-500"
                        placeholder={field.placeholder}
                      />
                    ) : field.type === 'text' || field.type === 'password' ? (
                      <input
                        type={field.type}
                        value={String(val)}
                        onChange={e => setPrefFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="flex-1 text-[10px] bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 outline-none focus:border-indigo-500"
                        placeholder={field.placeholder}
                      />
                    ) : null}
                  </div>
                )
              })}
              <button
                onClick={handleSavePreferences}
                disabled={prefSaving}
                className="mt-1.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {prefSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-400 leading-normal m-0">No custom skill settings found. Standard values will apply.</p>
          )}
        </div>
      </div>
    </div>
  )

  const handleWorkspaceDragStart = (e: React.MouseEvent) => {
    workspaceDragRef.current = { startX: e.clientX, startWidth: workspaceWidth }
    const onMove = (ev: MouseEvent) => {
      if (!workspaceDragRef.current) return
      const delta = workspaceDragRef.current.startX - ev.clientX
      const newWidth = Math.max(300, Math.min(workspaceDragRef.current.startWidth + delta, window.innerWidth * 0.8))
      setWorkspaceWidth(newWidth)
    }
    const onUp = () => {
      workspaceDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleSidebarDragStart = (e: React.MouseEvent) => {
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth }
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragRef.current) return
      const delta = sidebarDragRef.current.startX - ev.clientX
      const newWidth = Math.max(260, Math.min(sidebarDragRef.current.startWidth + delta, window.innerWidth * 0.8))
      setSidebarWidth(newWidth)
    }
    const onUp = () => {
      sidebarDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  if (loadingProject) {
    return (
      <div role="status" aria-label="Loading project" className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" aria-hidden="true" />
        Loading project...
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-zinc-950">

      {/* Chat column — right edge pulls left when workspace is open */}
      <div
        className="absolute inset-0 flex flex-col border-r border-zinc-900 bg-zinc-950 transition-[right] duration-300 ease-out"
        style={{ right: (workspaceOpen ? workspaceWidth : 0) + (isSidebarOpen ? sidebarWidth : 0) }}
      >

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
            </div>
          )}
        </div>

        {/* Chat Thread */}
        <ChatThread
          messages={chat.messages}
          streamingMsgId={chat.streamingMsgId}
          isStreaming={isStreaming}
          projectData={projectData}
          urlProjectId={urlProjectId}
          imageCount={imageCount}
          disabledPlanPrompts={disabledPlanPrompts}
          debugLog={sse.log}
          onConfirmPlan={confirmGeneratePlan}
          onCancelPlan={cancelGeneratePlan}
          onTogglePrompt={(index) => {
            setDisabledPlanPrompts(prev => {
              const next = new Set(prev)
              if (next.has(index)) next.delete(index); else next.add(index)
              return next
            })
          }}
        />

        {/* Project chat streaming */}
        {projectChat.isStreaming && (
          <div className="flex flex-col gap-1.5 max-w-[85%] self-start items-start px-5 animate-fade-in">
            <span className="text-zinc-500 text-xxs font-bold uppercase tracking-wider">Assistant</span>
            {projectChat.plan && (
              <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed border bg-zinc-900 border-zinc-850 text-zinc-150 rounded-tl-none">
                <strong>Modification plan:</strong>
                <p className="mt-1 text-zinc-300 leading-normal m-0">{projectChat.plan}</p>
              </div>
            )}
            {projectChat.error && (
              <div className="px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/40 text-sm text-red-400 flex items-center gap-2">
                <span>{projectChat.error}</span>
                <button onClick={projectChat.retrySend} className="text-xs text-amber-400 hover:text-amber-300 font-semibold bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50 transition-colors">Retry</button>
              </div>
            )}
            <details className="mt-2 w-full max-w-md self-start border border-zinc-850 rounded-xl bg-zinc-950/50 overflow-hidden">
              <summary className="px-3 py-1.5 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none">Edit log ({projectChat.logs.length} entries)</summary>
              <div className="px-3 pb-2 font-mono text-xxs text-emerald-400/70 max-h-[160px] overflow-auto select-text whitespace-pre-wrap border-t border-zinc-900 pt-1.5">
                {projectChat.logs.join('\n') || 'No log entries yet.'}
              </div>
            </details>
          </div>
        )}

        {/* Chat Composer */}
        <ChatComposer
          ref={composerRef}
          chatInput={chatInput}
          onInputChange={setChatInput}
          onSend={projectData ? handleSendProjectEdit : handleStartGeneration}
          canSubmit={canSubmit}
          isStreaming={isStreaming || isSending}
          isPlanning={chat.planningMsgId !== null}
          onStop={() => { sse.stop(); projectChat.stop(); cancelGeneratePlan() }}
          projectData={projectData}
          selectedImage={selectedImage}
          onClearTarget={() => setSelectedImage(null)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          configSummary={configSummary}
          sourceMode={sourceMode}
          onSourceModeChange={handleSourceModeChange}
          sourceRef={sourceRef}
          onSourceRefChange={setSourceRef}
          uploadedSourceName={uploadedSourceName}
          uploadStatus={uploadStatus}
          onSourceUpload={handleSourceUpload}
        />
      </div>



      {/* Collapse/expand toggle — always visible at the workspace edge when content exists */}
      {hasWorkspaceContent && (
        <button
          className="absolute top-1/2 -translate-y-1/2 z-20 w-5 h-16 bg-zinc-800/90 border border-zinc-700/80 border-r-0 rounded-l-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all cursor-pointer backdrop-blur-sm shadow-lg"
          style={{ right: (workspaceOpen ? workspaceWidth : 0) + (isSidebarOpen ? sidebarWidth : 0) }}
          onClick={() => setWorkspaceOpen(v => !v)}
          aria-label={workspaceOpen ? 'Collapse workspace' : 'Expand workspace'}
        >
          {workspaceOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Workspace panel — slides in from right, width draggable */}
      <div
        className="absolute top-0 bottom-0 transition-[transform,right] duration-300 ease-out z-20"
        style={{
          width: workspaceWidth,
          right: isSidebarOpen ? sidebarWidth : 0,
          transform: workspaceOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Drag-to-resize handle on left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500/80 transition-colors z-10 group"
          onMouseDown={handleWorkspaceDragStart}
        >
          <div className="absolute -left-2 top-0 bottom-0 w-5" />
        </div>

        <div className="h-full pl-2 pr-4 py-4 flex gap-4 overflow-hidden">
          <div className="flex-1 h-full overflow-hidden">
            <ProjectWorkspace
              projectId={urlProjectId || ''}
              projectPath={projectData?.path || sse.projectPath}
              files={projectData?.files || []}
              images={projectData?.images || []}
              selectedImage={selectedImage}
              onSelectImage={setSelectedImage}
              newImages={projectData ? projectChat.newImages : sse.images}
              newFiles={projectData ? projectChat.newFiles : sse.files}
              logs={projectData ? projectChat.logs : sse.log}
              isStreaming={sse.isStreaming || projectChat.isStreaming}
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
              aspectRatio={aspectRatio}
              onInstallXhsSuccess={checkXhsAvailable}
            />
          </div>
        </div>
      </div>

      {/* Parameters sidebar — slides in from right, width draggable */}
      <div
        className="absolute right-0 top-0 bottom-0 transition-transform duration-300 ease-out z-30 flex bg-zinc-950 border-l border-zinc-900"
        style={{
          width: sidebarWidth,
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Drag-to-resize handle on left edge */}
        <div
          className="w-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500/80 transition-colors z-40 relative flex-shrink-0"
          onMouseDown={handleSidebarDragStart}
        >
          <div className="absolute -left-2 top-0 bottom-0 w-5" />
        </div>

        <div className="flex-1 h-full overflow-hidden">
          {renderParameters()}
        </div>
      </div>

    </div>
  )
}
