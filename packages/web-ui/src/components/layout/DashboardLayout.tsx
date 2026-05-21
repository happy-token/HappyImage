import { Link, Outlet, useLocation } from 'react-router-dom'
import { MessageSquare, Compass, History, Settings } from 'lucide-react'

export default function DashboardLayout() {
  const location = useLocation()

  const isSidebarActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/projects/')
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
      
      {/* 1. Left Navigation Sidebar */}
      <aside className="border-r border-zinc-850 bg-zinc-950/80 p-5 flex flex-col gap-6 h-screen sticky top-0 z-20 backdrop-blur-md shadow-lg">
        <Link to="/" className="flex items-center gap-2.5 px-2 no-underline group">
          <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-extrabold text-lg shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            H
          </span>
          <div className="flex flex-col">
            <span className="text-zinc-100 font-extrabold text-sm tracking-wide leading-none">HappyImage</span>
            <span className="text-zinc-400 text-[9px] font-extrabold uppercase tracking-widest mt-1">Workspace</span>
          </div>
        </Link>
        
        <nav className="flex flex-col gap-2 mt-2">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border no-underline group ${
              isSidebarActive('/')
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 dark:hover:bg-indigo-950/30 border-transparent'
            }`}
          >
            <MessageSquare className="w-5 h-5 transition-transform group-hover:scale-105 shrink-0" />
            <span>Chat Studio</span>
          </Link>
          <Link
            to="/gallery"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border no-underline group ${
              isSidebarActive('/gallery')
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 dark:hover:bg-indigo-950/30 border-transparent'
            }`}
          >
            <Compass className="w-5 h-5 transition-transform group-hover:scale-105 shrink-0" />
            <span>Styles Gallery</span>
          </Link>
          <Link
            to="/history"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border no-underline group ${
              isSidebarActive('/history')
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 dark:hover:bg-indigo-950/30 border-transparent'
            }`}
          >
            <History className="w-5 h-5 transition-transform group-hover:scale-105 shrink-0" />
            <span>Projects History</span>
          </Link>
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border no-underline group ${
              isSidebarActive('/settings')
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 dark:hover:bg-indigo-950/30 border-transparent'
            }`}
          >
            <Settings className="w-5 h-5 transition-transform group-hover:scale-105 shrink-0" />
            <span>Settings</span>
          </Link>
        </nav>
      </aside>

      {/* 2. Main content rendering container */}
      <main className="flex flex-col h-screen overflow-hidden relative bg-zinc-950 text-zinc-100">
        <Outlet />
      </main>
    </div>
  )
}
