import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackToStudioButtonProps {
  className?: string
}

export default function BackToStudioButton({ className = '' }: BackToStudioButtonProps) {
  return (
    <Link
      to="/"
      aria-label="Back to Chat Studio"
      title="Back to Chat Studio"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/70 text-slate-600 dark:text-zinc-400 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${className}`}
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  )
}
