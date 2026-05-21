import { useState } from 'react'
import Button from '../ui/Button'

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

export default function ChatPanel({ onSend, onStop, isStreaming, plan, logs, error, selectedImage, disabled }: ChatPanelProps) {
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
          <h2>修改与迭代</h2>
        </div>
        {isStreaming && <span>生成中...</span>}
      </div>

      <div className="project-chat-log">
        {selectedImage !== null && (
          <div className="project-chat-target">
            目标: 第 {selectedImage + 1} 张图 {isStreaming ? '' : '— 输入修改要求'}
          </div>
        )}
        {selectedImage === null && !isStreaming && (
          <div className="project-chat-target">选择一张图片或输入全局修改要求</div>
        )}

        {plan && (
          <div className="project-chat-plan">
            <strong>修改计划</strong>
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
              ? `修改第 ${selectedImage + 1} 张图...`
              : '输入修改要求，如：整体换成蓝色科技风...'
          }
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button variant="secondary" onClick={onStop}>停止</Button>
        ) : (
          <Button onClick={handleSend} disabled={disabled || !input.trim()}>发送</Button>
        )}
      </div>
    </div>
  )
}
