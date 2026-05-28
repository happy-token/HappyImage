import Button from '../ui/Button'
import Markdown from '../chat/Markdown'
import type { ProjectPlan } from '@happytokenai/happyimage-core'
import { t, useAppLanguage } from '../../i18n/settings'

interface PlanConfirmationProps {
  plan: ProjectPlan
  imageCount: number
  onConfirm: (plan: ProjectPlan) => void
  onCancel: () => void
  onTogglePrompt: (index: number) => void
  disabledPrompts: Set<number>
  confirmed?: boolean
}

export default function PlanConfirmation({ plan, imageCount, onConfirm, onCancel, onTogglePrompt, disabledPrompts, confirmed }: PlanConfirmationProps) {
  const lang = useAppLanguage()
  const firstPrompt = plan.prompts[0]?.prompt || ''
  const previewText = firstPrompt.length > 200 ? firstPrompt.slice(0, 200) + '...' : firstPrompt
  const activeCount = plan.prompts.length - disabledPrompts.size

  return (
    <div className="plan-confirm">
      <div className="plan-confirm-header">
        <div>
          <p className="studio-eyebrow">{t(lang, 'plan.eyebrow')}</p>
          <h2>{t(lang, 'plan.title')}</h2>
        </div>
        <span>{plan.prompts.length}/{imageCount} {t(lang, 'plan.cards')}</span>
      </div>

      <div className="plan-confirm-body">
        <div className="plan-confirm-field">
          <strong>{t(lang, 'plan.field_title')}</strong>
          <span>{plan.title}</span>
        </div>
        <div className="plan-confirm-field">
          <strong>{t(lang, 'plan.slug')}</strong>
          <code>{plan.slug}</code>
        </div>

        <div className="plan-confirm-outline">
          <strong>{t(lang, 'plan.outline')}</strong>
          <Markdown text={plan.outlineMarkdown} />
        </div>

        <div className="plan-confirm-prompts">
          <strong>{t(lang, 'plan.card_list')} ({plan.prompts.length})</strong>
          <div className="plan-confirm-prompt-list">
            {plan.prompts.map((p, i) => (
              <label key={i} className={`plan-confirm-prompt-item ${disabledPrompts.has(i) ? 'plan-confirm-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={!disabledPrompts.has(i)}
                  onChange={() => onTogglePrompt(i)}
                  disabled={confirmed}
                />
                <code>{p.fileName}</code>
                <span>{p.prompt.slice(0, 60)}{p.prompt.length > 60 ? '...' : ''}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="plan-confirm-preview">
          <strong>{t(lang, 'plan.preview')}</strong>
          <Markdown text={firstPrompt.slice(0, 400)} />
        </div>
      </div>

      <div className="plan-confirm-actions">
        {confirmed ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 select-none">
              ✓ {t(lang, 'plan.confirmed')}
            </span>
            <Button variant="ghost" disabled>{t(lang, 'plan.generated')}</Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={onCancel}>{t(lang, 'plan.cancel')}</Button>
            <Button onClick={() => onConfirm(plan)}>
              {t(lang, 'plan.confirm', { count: String(activeCount) })}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
