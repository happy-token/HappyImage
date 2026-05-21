import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface DependencyCheck {
  id: string
  label: string
  ok: boolean
  required: boolean
  description: string
  installLabel: string
  installUrl: string
}

interface DependencyResponse {
  ok: boolean
  checks: DependencyCheck[]
}

function ActionLink({ check }: { check: DependencyCheck }) {
  const className = 'inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 no-underline transition hover:border-indigo-500 hover:text-white'
  if (check.installUrl.startsWith('/')) {
    return <Link to={check.installUrl} className={className}>{check.installLabel}</Link>
  }
  return <a href={check.installUrl} target="_blank" rel="noreferrer" className={className}>{check.installLabel}</a>
}

export default function DependencyStatus() {
  const location = useLocation()
  const [data, setData] = useState<DependencyResponse | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/dependencies')
      .then(res => res.json())
      .then(setData)
      .catch(() => setData(null))
  }, [location.pathname])

  const missing = useMemo(() => data?.checks.filter(check => !check.ok) || [], [data])
  const missingRequired = missing.filter(check => check.required)

  if (!data || missing.length === 0 || collapsed) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-900/40 bg-zinc-950/95 px-4 py-3 text-zinc-100 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${missingRequired.length > 0 ? 'bg-red-400' : 'bg-amber-400'}`} />
            <p className="text-sm font-bold">
              {missingRequired.length > 0 ? '运行环境未完成，部分功能不可用' : '建议补全运行环境'}
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            HappyImage Web UI 主要依赖 baoyu-skills。缺少必需项时，请先安装 baoyu-skills 或补齐它需要的 Node.js 运行能力。
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {missing.map(check => (
              <div key={check.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-zinc-100">{check.label}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${check.required ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'}`}>
                    {check.required ? 'required' : 'optional'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{check.description}</p>
                <div className="mt-2">
                  <ActionLink check={check} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
        >
          暂时隐藏
        </button>
      </div>
    </div>
  )
}
