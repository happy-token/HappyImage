interface TagProps {
  children: string
  active?: boolean
  onClick?: () => void
}

export default function Tag({ children, active = false, onClick }: TagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer ${
        active
          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/10'
          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/50 dark:border-zinc-700/50'
      }`}
    >
      {children}
    </button>
  )
}
