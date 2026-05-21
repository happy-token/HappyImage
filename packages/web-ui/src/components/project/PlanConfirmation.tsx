import Button from '../ui/Button'
import type { ProjectPlan } from '@happyimage/core'

interface PlanConfirmationProps {
  plan: ProjectPlan
  imageCount: number
  onConfirm: (plan: ProjectPlan) => void
  onCancel: () => void
  onTogglePrompt: (index: number) => void
  disabledPrompts: Set<number>
}

export default function PlanConfirmation({ plan, imageCount, onConfirm, onCancel, onTogglePrompt, disabledPrompts }: PlanConfirmationProps) {
  const firstPrompt = plan.prompts[0]?.prompt || ''
  const previewText = firstPrompt.length > 200 ? firstPrompt.slice(0, 200) + '...' : firstPrompt
  const activeCount = plan.prompts.length - disabledPrompts.size

  return (
    <div className="plan-confirm">
      <div className="plan-confirm-header">
        <div>
          <p className="studio-eyebrow">confirmation</p>
          <h2>确认生成计划</h2>
        </div>
        <span>{plan.prompts.length}/{imageCount} cards</span>
      </div>

      <div className="plan-confirm-body">
        <div className="plan-confirm-field">
          <strong>Title</strong>
          <span>{plan.title}</span>
        </div>
        <div className="plan-confirm-field">
          <strong>Slug</strong>
          <code>{plan.slug}</code>
        </div>

        <div className="plan-confirm-outline">
          <strong>Outline</strong>
          <p>{plan.outlineMarkdown.slice(0, 400)}{plan.outlineMarkdown.length > 400 ? '...' : ''}</p>
        </div>

        <div className="plan-confirm-prompts">
          <strong>Cards ({plan.prompts.length})</strong>
          <div className="plan-confirm-prompt-list">
            {plan.prompts.map((p, i) => (
              <label key={i} className={`plan-confirm-prompt-item ${disabledPrompts.has(i) ? 'plan-confirm-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={!disabledPrompts.has(i)}
                  onChange={() => onTogglePrompt(i)}
                />
                <code>{p.fileName}</code>
                <span>{p.prompt.slice(0, 60)}{p.prompt.length > 60 ? '...' : ''}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="plan-confirm-preview">
          <strong>Style Preview</strong>
          <p>{previewText}</p>
        </div>
      </div>

      <div className="plan-confirm-actions">
        <Button variant="ghost" onClick={onCancel}>取消</Button>
        <Button onClick={() => onConfirm(plan)}>
          确认生成 {activeCount} 张
        </Button>
      </div>
    </div>
  )
}
