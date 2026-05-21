import { Check } from 'lucide-react'

interface StepperProps {
  steps: string[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export default function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <nav aria-label="Progress" className="flex items-center gap-1">
      {steps.map((label, i) => {
        const isActive = i === currentStep
        const isDone = i < currentStep
        return (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`w-6 h-0.5 rounded-full ${isDone ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-700'}`} />
            )}
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              disabled={!isDone && !isActive}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' :
                isDone ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 cursor-pointer' :
                'bg-slate-100 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-500 border border-slate-200/30 dark:border-zinc-800/30 cursor-default'
              }`}
            >
              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs transition-all duration-200 ${
                isActive ? 'bg-white text-indigo-600 font-bold' :
                isDone ? 'bg-indigo-600 text-white' :
                'bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-zinc-550'
              }`}>
                {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
