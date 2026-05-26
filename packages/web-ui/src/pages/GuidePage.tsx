import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileText, Rocket, Settings, Share2 } from 'lucide-react'
import BackToStudioButton from '../components/ui/BackToStudioButton'
import Markdown from '../components/chat/Markdown'
import quickStartDoc from '../../../../docs/guides/zh/quick-start.md?raw'
import settingsDoc from '../../../../docs/guides/zh/settings-guide.md?raw'
import publishDoc from '../../../../docs/guides/zh/publish-guide.md?raw'

interface GuideDoc {
  slug: string
  api: string
  title: string
  eyebrow: string
  description: string
  icon: typeof Rocket
  meta: string
}

const docs: GuideDoc[] = [
  {
    slug: 'quick-start',
    api: 'quick-start',
    title: '快速开始',
    eyebrow: '入门',
    description: '从安装、配置密钥到生成第一张图，适合第一次打开 HappyImage 的用户。',
    icon: Rocket,
    meta: '2 分钟上手',
  },
  {
    slug: 'settings',
    api: 'settings',
    title: '设置指南',
    eyebrow: '配置',
    description: '逐项说明运行环境、模型、偏好、平台发布、备份恢复等设置。',
    icon: Settings,
    meta: '5 个配置区',
  },
  {
    slug: 'publish',
    api: 'publish',
    title: '发布指南',
    eyebrow: '发布',
    description: '了解小红书、微博、X、微信公众号的规则、登录态和常见排查。',
    icon: Share2,
    meta: '4 个平台',
  },
]

const docBySlug = new Map(docs.map(doc => [doc.slug, doc]))
const embeddedDocs: Record<string, string> = {
  'quick-start': quickStartDoc,
  settings: settingsDoc,
  publish: publishDoc,
}

function normalizeLinks(markdown: string): string {
  return markdown
    .replace(/\]\(guides\/zh\/quick-start\.md\)/g, '](/guide/quick-start)')
    .replace(/\]\(guides\/zh\/settings-guide\.md\)/g, '](/guide/settings)')
    .replace(/\]\(guides\/zh\/publish-guide\.md\)/g, '](/guide/publish)')
    .replace(/\]\(quick-start\.md\)/g, '](/guide/quick-start)')
    .replace(/\]\(settings-guide\.md\)/g, '](/guide/settings)')
    .replace(/\]\(publish-guide\.md\)/g, '](/guide/publish)')
}

function cleanMarkdown(markdown: string): string {
  return normalizeLinks(markdown.replace(/^# .+\n+/, ''))
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4">
          <div className="h-4 w-48 rounded bg-zinc-800 animate-pulse" />
          <div className="mt-3 h-3 w-full rounded bg-zinc-800/70 animate-pulse" />
          <div className="mt-2 h-3 w-5/6 rounded bg-zinc-800/50 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function GuidePage() {
  const params = useParams()
  const navigate = useNavigate()
  const activeDoc = params.doc ? docBySlug.get(params.doc) || docs[0] : null
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!params.doc) return
    if (!docBySlug.has(params.doc)) navigate('/guide/quick-start', { replace: true })
  }, [navigate, params.doc])

  useEffect(() => {
    if (!activeDoc) return
    setLoading(true)
    setError('')
    setContent('')
    fetch(`/api/docs/${activeDoc.api}`)
      .then(res => {
        if (!res.ok) throw new Error('无法加载用户指南')
        return res.json()
      })
      .then(data => setContent(cleanMarkdown(data.content || '')))
      .catch(err => {
        const fallback = embeddedDocs[activeDoc.api]
        if (fallback) {
          setContent(cleanMarkdown(fallback))
          return
        }
        setError(err.message || '加载失败')
      })
      .finally(() => setLoading(false))
  }, [activeDoc])

  const handleGuideLink = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    const href = link.getAttribute('href') || ''
    if (href.startsWith('/guide/')) {
      event.preventDefault()
      navigate(href)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 animate-fade-in">
      <div className="settings-page mx-auto flex h-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">使用文档</p>
            <h1 className="text-2xl font-extrabold text-zinc-100">用户指南</h1>
            <p className="mt-1 text-sm text-zinc-400">快速开始、设置说明与多平台发布规则</p>
          </div>
          <BackToStudioButton />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/35">
          <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-5 py-3 backdrop-blur">
            <nav className="flex flex-wrap gap-2">
              <NavLink
                to="/guide"
                end
                className={({ isActive }) => `rounded-lg border px-3 py-1.5 text-xs font-bold no-underline transition ${
                  isActive
                    ? 'border-indigo-500/60 bg-indigo-600/15 text-zinc-50'
                    : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
                }`}
              >
                总览
              </NavLink>
              {docs.map(doc => (
                <NavLink
                  key={doc.slug}
                  to={`/guide/${doc.slug}`}
                  className={({ isActive }) => `rounded-lg border px-3 py-1.5 text-xs font-bold no-underline transition ${
                    isActive
                      ? 'border-indigo-500/60 bg-indigo-600/15 text-zinc-50'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
                  }`}
                >
                  {doc.title}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="p-5">
            {!activeDoc ? (
              <div className="mx-auto grid max-w-4xl gap-4">
                <section className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="max-w-2xl">
                      <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">HappyImage 文档</p>
                      <h2 className="mt-1 mb-2 text-lg font-extrabold text-zinc-100">把创作、配置和发布放进一条清晰路径</h2>
                      <p className="m-0 text-sm leading-6 text-zinc-400">
                        从第一张图到多平台发布，指南拆成三个入口。按当前任务进入对应页面，少翻文档，多做作品。
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        中文指南已就绪
                      </div>
                      <p className="mt-2 mb-0 text-xs text-zinc-400">包含快速开始、设置指南、发布指南</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3">
                  {docs.map(doc => {
                    const Icon = doc.icon
                    return (
                      <Link key={doc.slug} to={`/guide/${doc.slug}`} className="group flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 no-underline transition hover:border-indigo-500/50 hover:bg-zinc-950/70">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition group-hover:border-indigo-500/50 group-hover:text-indigo-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{doc.eyebrow}</p>
                            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">{doc.meta}</span>
                          </div>
                          <h3 className="mb-1.5 mt-0 text-base font-extrabold text-zinc-100">{doc.title}</h3>
                          <p className="m-0 text-sm leading-6 text-zinc-400">{doc.description}</p>
                        </div>
                        <span className="mt-1 flex shrink-0 items-center gap-2 text-xs font-bold text-indigo-300">
                          打开
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </Link>
                    )
                  })}
                </section>
              </div>
            ) : (
              <article className="mx-auto max-w-4xl">
                <header className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                    <div>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{activeDoc.eyebrow}</p>
                      <h2 className="m-0 text-lg font-extrabold text-zinc-100">{activeDoc.title}</h2>
                    </div>
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400">{activeDoc.meta}</span>
                  </div>
                  <p className="mt-3 mb-0 max-w-2xl text-sm leading-6 text-zinc-400">{activeDoc.description}</p>
                </header>

                <div onClick={handleGuideLink} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-6 md:px-7">
                  {loading ? (
                    <Skeleton />
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-red-900/40 bg-red-950/30">
                        <FileText className="h-6 w-6 text-red-400" />
                      </div>
                      <p className="mb-1 font-semibold text-red-400">无法加载文档</p>
                      <p className="text-sm text-zinc-400">{error}</p>
                    </div>
                  ) : (
                    <Markdown text={content} className="guide-prose" />
                  )}
                </div>
              </article>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
