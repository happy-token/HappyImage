import type { ReactNode } from 'react'
import Stepper from '../ui/Stepper'
import Button from '../ui/Button'

interface WizardShellProps {
  steps: string[]
  currentStep: number
  onStepClick: (step: number) => void
  onNext?: () => void
  onPrev?: () => void
  canNext: boolean
  canPrev: boolean
  nextLabel?: string
  children: ReactNode
}

export default function WizardShell({ steps, currentStep, onStepClick, onNext, onPrev, canNext, canPrev, nextLabel = 'Next', children }: WizardShellProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-center mb-10 overflow-x-auto pb-2">
        <Stepper steps={steps} currentStep={currentStep - 1} onStepClick={(s) => onStepClick(s + 1)} />
      </div>

      <div className="min-h-[400px]">{children}</div>

      <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-200">
        <div>
          {canPrev && onPrev && (
            <Button variant="ghost" onClick={onPrev}>Back</Button>
          )}
        </div>
        <div>
          {canNext && onNext && (
            <Button onClick={onNext} size="lg">{nextLabel}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
