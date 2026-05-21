export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-cream-100/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Powered by <a href="https://github.com/JimLiu/baoyu-skills" className="text-slate-700 hover:text-slate-800 underline underline-offset-2">baoyu-skills</a>
        </p>
        <p className="text-xs text-slate-400">
          AI-powered content generation studio
        </p>
      </div>
    </footer>
  )
}
