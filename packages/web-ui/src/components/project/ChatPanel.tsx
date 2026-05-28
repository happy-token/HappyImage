import { useState } from 'react'
import Button from '../ui/Button'
import { useAppLanguage, type AppLanguage } from '../../i18n/settings'

interface ChatTarget {
  type: string
  index?: number
}

interface ChatPanelProps {
  onSend: (message: string, target?: ChatTarget) => void
  onStop: () => void
  isStreaming: boolean
  plan: string | null
  logs: string[]
  error: string | null
  selectedImage: number | null
  disabled: boolean
}

function L(lang: AppLanguage, zh: string, en: string) {
  return lang === 'en' ? en : zh
}

export default function ChatPanel({ onSend, onStop, isStreaming, plan, logs, error, selectedImage, disabled }: ChatPanelProps) {
  const lang = useAppLanguage()
  const [input, setInput] = useState('')

  const handleSend = () => {
    const msg = input.trim()
    if (!msg) return
    onSend(msg, selectedImage !== null ? { type: 'image', index: selectedImage } : { type: 'all' })
    setInput('')
  }

  return (
    <div className="project-chat">
      <div className="studio-panel-head">
        <div>
          <p className="studio-eyebrow">chat</p>
          <h2>{L(lang, '修改与迭代', 'Revise and Iterate')}</h2>
        </div>
        {isStreaming && <span>{L(lang, '生成中...', 'Generating...')}</span>}
      </div>

      <div className="project-chat-log">
        {selectedImage !== null && (
          <div className="project-chat-target">
            {L(lang, `目标: 第 ${selectedImage + 1} 张图`, `Target: Image ${selectedImage + 1}`)} {isStreaming ? '' : L(lang, '— 输入修改要求', '- enter revision request')}
          </div>
        )}
        {selectedImage === null && !isStreaming && (
          <div className="project-chat-target">{L(lang, '选择一张图片或输入全局修改要求', 'Select an image or enter a global revision request')}</div>
        )}

        {plan && (
          <div className="project-chat-plan">
            <strong>{L(lang, '修改计划', 'Revision Plan')}</strong>
            <p>{plan}</p>
          </div>
        )}

        {logs.filter(l => l.startsWith('Updated:')).map((l, i) => (
          <code key={i} className="project-chat-update">{l}</code>
        ))}

        {error && <div className="studio-error">{error}</div>}
      </div>

      <div className="project-chat-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder={
            selectedImage !== null
              ? L(lang, `修改第 ${selectedImage + 1} 张图...`, `Revise image ${selectedImage + 1}...`)
              : L(lang, '输入修改要求，如：整体换成蓝色科技风...', 'Enter a revision request, e.g. make it a blue tech style...')
          }
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button variant="secondary" onClick={onStop}>{L(lang, '停止', 'Stop')}</Button>
        ) : (
          <Button onClick={handleSend} disabled={disabled || !input.trim()}>{L(lang, '发送', 'Send')}</Button>
        )}
      </div>
    </div>
  )
}
