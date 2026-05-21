import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200/60 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/40 p-5 shadow-sm transition-all duration-300 ${
        hover ? 'hover:shadow-lg hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 hover:-translate-y-0.5 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
