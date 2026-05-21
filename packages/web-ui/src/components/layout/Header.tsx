import { Link, useLocation } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export default function Header() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  const linkClass = (active: boolean) => 
    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
      active 
        ? 'bg-indigo-50 dark:bg-indigo-950/15 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/10' 
        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-150 hover:bg-slate-100 dark:hover:bg-zinc-800/40 border-transparent'
    }`

  return (
    <header className="border-b border-slate-200 dark:border-zinc-850 bg-slate-50/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 no-underline group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-600/10 group-hover:bg-indigo-700 transition-colors">
            <span className="text-white text-sm font-semibold font-display">H</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-semibold text-slate-800 dark:text-zinc-100 transition-colors">
              HappyImage
            </span>
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
          </div>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <Link
            to="/"
            className={linkClass(isActive('/') && !isActive('/gallery') && !isActive('/wizard'))}
          >
            Home
          </Link>
          <Link
            to="/gallery"
            className={linkClass(isActive('/gallery'))}
          >
            Gallery
          </Link>
          <Link
            to="/wizard"
            className="ml-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-all duration-200 shadow-sm shadow-indigo-600/10 hover:shadow-indigo-600/20"
          >
            Start Creating
          </Link>
        </nav>
      </div>
    </header>
  )
}
