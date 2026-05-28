import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PlanConfirmation from '../project/PlanConfirmation'
import Markdown from './Markdown'
import ToolCard from './ToolCard'
import type { ChatMessage } from '../../lib/chat-reducer'
import { t, useAppLanguage } from '../../i18n/settings'

interface ChatThreadProps {
  messages: ChatMessage[]
  streamingMsgId: string | null
  isStreaming: boolean
  projectData: any | null
  urlProjectId: string | undefined
  imageCount: number
  disabledPlanPrompts: Set<number>
  debugLog: string[]
  onConfirmPlan: (plan: any, disabledPrompts: Set<number>, sourceContent?: string) => void
  onCancelPlan: () => void
  onTogglePrompt: (index: number) => void
}

export default function ChatThread({
  messages, streamingMsgId, isStreaming, projectData, urlProjectId,
  imageCount, disabledPlanPrompts, debugLog,
  onConfirmPlan, onCancelPlan, onTogglePrompt,
}: ChatThreadProps) {
  const lang = useAppLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)

  useEffect(() => {
    if (!nearBottomRef.current) return
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'instant' : 'smooth' })
  }, [messages, debugLog, isStreaming])

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      onScroll={() => {
        const el = ref.current
        if (!el) return
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150
      }}
      className="flex-1 overflow-auto p-5 flex flex-col gap-4 select-text"
    >
      {!projectData && !urlProjectId && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/gallery" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 no-underline shadow-lg transition hover:border-indigo-500/60 hover:bg-zinc-900">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">{t(lang, 'chat.start_eyebrow')}</div>
            <div className="mt-2 text-sm font-bold text-zinc-100">{t(lang, 'chat.gallery_title')}</div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t(lang, 'chat.gallery_desc')}</p>
          </Link>
          <Link to="/history" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 no-underline shadow-lg transition hover:border-indigo-500/60 hover:bg-zinc-900">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{t(lang, 'chat.continue_eyebrow')}</div>
            <div className="mt-2 text-sm font-bold text-zinc-100">{t(lang, 'chat.history_title')}</div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t(lang, 'chat.history_desc')}</p>
          </Link>
          <Link to="/settings" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 no-underline shadow-lg transition hover:border-indigo-500/60 hover:bg-zinc-900">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">{t(lang, 'chat.setup_eyebrow')}</div>
            <div className="mt-2 text-sm font-bold text-zinc-100">{t(lang, 'chat.settings_title')}</div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t(lang, 'chat.settings_desc')}</p>
          </Link>
        </div>
      )}

      {messages.map(msg => (
        <div key={msg.id} className={`flex flex-col gap-1.5 max-w-[92%] lg:max-w-[85%] ${
          msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
        } animate-fade-in`}>

          <span className="text-zinc-500 text-xxs font-bold uppercase tracking-wider">
            {msg.role === 'user' ? t(lang, 'chat.you') : msg.role === 'system' ? t(lang, 'chat.system') : t(lang, 'chat.assistant')}
          </span>

          <div className={`px-4 py-3.5 rounded-2xl text-sm leading-relaxed border transition-all ${
            msg.role === 'user'
              ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
              : 'bg-zinc-900/60 border-zinc-850/80 text-zinc-150 rounded-tl-none backdrop-blur-sm'
          }`}>
            {msg.type === 'tool' && msg.toolName && msg.toolStatus ? (
              <ToolCard
                name={msg.toolName}
                status={msg.toolStatus}
                message={msg.text}
                input={msg.toolInput}
              />
            ) : msg.type === 'thinking' ? (
              <span className="inline-flex items-center gap-1">
                {t(lang, 'chat.thinking')}
                <span className="inline-flex gap-0.5 ml-0.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            ) : msg.role === 'user' ? (
              <div className="flex flex-col gap-1.5">
                <div>{msg.text}</div>
                {typeof msg.targetImageIndex === 'number' && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/20 text-xxs tracking-wide text-indigo-100/90 flex items-center gap-1 select-none">
                    <span>{t(lang, 'chat.target_image', { index: String(msg.targetImageIndex + 1), name: msg.targetImageName || '-' })}</span>
                  </div>
                )}
              </div>
            ) : (
              <Markdown text={msg.text} />
            )}
          </div>

          {msg.type === 'plan' && msg.planData && (
            <div className="mt-2.5 w-full max-w-md self-start border border-zinc-800 rounded-xl bg-zinc-900 shadow-xl overflow-hidden animate-scale-up">
              <PlanConfirmation
                plan={msg.planData}
                imageCount={imageCount}
                onConfirm={(plan) => onConfirmPlan(plan, disabledPlanPrompts, msg.sourceContent)}
                onCancel={onCancelPlan}
                onTogglePrompt={onTogglePrompt}
                disabledPrompts={disabledPlanPrompts}
                confirmed={msg.confirmed || messages.indexOf(msg) < messages.length - 1 || !!projectData}
              />
            </div>
          )}

          {msg.id === streamingMsgId && isStreaming && (
            <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse rounded-sm ml-0.5 align-text-bottom" />
          )}

          {msg.type === 'error' && msg.retryFn && (
            <button onClick={msg.retryFn} className="text-xs text-amber-400 hover:text-amber-300 font-semibold bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-900/50 transition-colors mt-1">
              {t(lang, 'chat.retry')}
            </button>
          )}

          {msg.type === 'runner' && (
            <details className="mt-2 w-full max-w-md self-start border border-zinc-850 rounded-xl bg-zinc-950/50 overflow-hidden animate-scale-up">
              <summary className="px-3 py-1.5 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none">
                {t(lang, 'chat.debug_log')} ({debugLog.length} lines)
              </summary>
              <div className="px-3 pb-2 font-mono text-xxs text-emerald-400/70 max-h-[160px] overflow-auto select-text whitespace-pre-wrap border-t border-zinc-900 pt-1.5">
                {debugLog.join('') || t(lang, 'chat.no_log')}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}
