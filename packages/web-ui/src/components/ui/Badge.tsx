import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'accent' | 'outline'
}

const variantStyles: Record<string, string> = {
  default: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300',
  accent: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30',
  outline: 'border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400',
}

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}>
      {children}
    </span>
  )
}
