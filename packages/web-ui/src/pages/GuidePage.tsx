import { useEffect, useState, useMemo, useRef } from 'react'
import type { MouseEvent } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileText, Rocket, Settings, Share2, BookOpen, Copy, Check } from 'lucide-react'
import BackToStudioButton from '../components/ui/BackToStudioButton'
import Markdown from '../components/chat/Markdown'
import quickStartDoc from '../../../../docs/guides/zh/quick-start.md?raw'
import settingsDoc from '../../../../docs/guides/zh/settings-guide.md?raw'
import publishDoc from '../../../../docs/guides/zh/publish-guide.md?raw'
import quickStartDocEn from '../../../../docs/guides/en/quick-start.md?raw'
import settingsDocEn from '../../../../docs/guides/en/settings-guide.md?raw'
import publishDocEn from '../../../../docs/guides/en/publish-guide.md?raw'
import { t, useAppLanguage, type AppLanguage } from '../i18n/settings'

interface GuideDoc {
  slug: string
  api: string
  title: string
  eyebrow: string
  description: string
  icon: typeof Rocket
  meta: string
}



function getDocs(lang: AppLanguage): GuideDoc[] {
  return [
  {
    slug: 'quick-start',
    api: 'quick-start',
    title: t(lang, 'guide.quick_title'),
    eyebrow: t(lang, 'guide.quick_eyebrow'),
    description: t(lang, 'guide.quick_desc'),
    icon: Rocket,
    meta: t(lang, 'guide.quick_meta'),
  },
  {
    slug: 'settings',
    api: 'settings',
    title: t(lang, 'guide.settings_title'),
    eyebrow: t(lang, 'guide.settings_eyebrow'),
    description: t(lang, 'guide.settings_desc'),
    icon: Settings,
    meta: t(lang, 'guide.settings_meta'),
  },
  {
    slug: 'publish',
    api: 'publish',
    title: t(lang, 'guide.publish_title'),
    eyebrow: t(lang, 'guide.publish_eyebrow'),
    description: t(lang, 'guide.publish_desc'),
    icon: Share2,
    meta: t(lang, 'guide.publish_meta'),
  },
  ]
}

const embeddedDocs: Record<AppLanguage, Record<string, string>> = {
  zh: {
    'quick-start': quickStartDoc,
    settings: settingsDoc,
    publish: publishDoc,
  },
  en: {
    'quick-start': quickStartDocEn,
    settings: settingsDocEn,
    publish: publishDocEn,
  },
}

function normalizeLinks(markdown: string, lang: AppLanguage): string {
  const prefix = lang === 'en' ? 'en' : 'zh'
  return markdown
    .replace(/\]\(guides\/en\/quick-start\.md\)/g, '](/guide/quick-start)')
    .replace(/\]\(guides\/en\/settings-guide\.md\)/g, '](/guide/settings)')
    .replace(/\]\(guides\/en\/publish-guide\.md\)/g, '](/guide/publish)')
    .replace(/\]\(guides\/zh\/quick-start\.md\)/g, '](/guide/quick-start)')
    .replace(/\]\(guides\/zh\/settings-guide\.md\)/g, '](/guide/settings)')
    .replace(/\]\(guides\/zh\/publish-guide\.md\)/g, '](/guide/publish)')
    .replace(new RegExp(`\\]\\(guides\\/${prefix}\\/quick-start\\.md\\)`, 'g'), '](/guide/quick-start)')
    .replace(new RegExp(`\\]\\(guides\\/${prefix}\\/settings-guide\\.md\\)`, 'g'), '](/guide/settings)')
    .replace(new RegExp(`\\]\\(guides\\/${prefix}\\/publish-guide\\.md\\)`, 'g'), '](/guide/publish)')
    .replace(/\]\(quick-start\.md\)/g, '](/guide/quick-start)')
    .replace(/\]\(settings-guide\.md\)/g, '](/guide/settings)')
    .replace(/\]\(publish-guide\.md\)/g, '](/guide/publish)')
}

function cleanMarkdown(markdown: string, lang: AppLanguage): string {
  return normalizeLinks(markdown.replace(/^# .+\n+/, ''), lang)
}

function Skeleton() {
  return (
    <div className="space-y-6 py-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-48 rounded bg-zinc-800/80 animate-pulse" />
          <div className="h-3 w-full rounded bg-zinc-800/50 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-zinc-800/40 animate-pulse" />
          <div className="h-3 w-4/6 rounded bg-zinc-800/30 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function GuidePage() {
  const lang = useAppLanguage()
  const params = useParams()
  const navigate = useNavigate()
  const docs = useMemo(() => getDocs(lang), [lang])
  const docBySlug = useMemo(() => new Map(docs.map(doc => [doc.slug, doc])), [docs])
  const activeDoc = params.doc ? docBySlug.get(params.doc) || docs[0] : null
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const mainRef = useRef<HTMLElement>(null)

  // Reset scroll to top when navigation switches documents
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [activeDoc])

  useEffect(() => {
    if (params.doc && !docBySlug.has(params.doc)) {
      navigate('/guide/quick-start', { replace: true })
    }
  }, [navigate, params.doc])

  useEffect(() => {
    if (!activeDoc) {
      setContent('')
      return
    }
    setLoading(true)
    setError('')
    setContent('')
    if (lang === 'en') {
      setContent(cleanMarkdown(embeddedDocs.en[activeDoc.api] || '', lang))
      setLoading(false)
      return
    }
    fetch(`/api/docs/${activeDoc.api}`)
      .then(res => {
        if (!res.ok) throw new Error(t(lang, 'guide.load_error'))
        return res.json()
      })
      .then(data => setContent(cleanMarkdown(data.content || '', lang)))
      .catch(err => {
        const fallback = embeddedDocs[lang][activeDoc.api]
        if (fallback) {
          setContent(cleanMarkdown(fallback, lang))
          return
        }
        setError(err.message || t(lang, 'guide.load_error'))
      })
      .finally(() => setLoading(false))
  }, [activeDoc, lang])

  // Add Copy Button to Pre Code blocks inside the guide prose
  useEffect(() => {
    if (loading || !content) return

    const timer = setTimeout(() => {
      const article = document.querySelector('.guide-prose')
      if (!article) return

      const preElements = article.querySelectorAll('pre')
      preElements.forEach((pre) => {
        if (pre.querySelector('.copy-code-btn')) return

        pre.style.position = 'relative'

        const btn = document.createElement('button')
        btn.className = 'copy-code-btn'
        btn.type = 'button'
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          ${t(lang, 'guide.copy')}
        `

        btn.addEventListener('click', () => {
          const code = pre.querySelector('code')?.innerText || ''
          navigator.clipboard.writeText(code).then(() => {
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
              ${t(lang, 'guide.copied')}
            `
            btn.classList.add('success')
            setTimeout(() => {
              btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                ${t(lang, 'guide.copy')}
              `
              btn.classList.remove('success')
            }, 2000)
          })
        })

        pre.appendChild(btn)
      })
    }, 150)

    return () => clearTimeout(timer)
  }, [content, loading, lang])

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
      <div className="guide-page-container mx-auto flex h-full max-w-[1440px] w-full flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t(lang, 'guide.eyebrow')}</p>
            <h1 className="text-2xl font-extrabold text-zinc-100">{t(lang, 'guide.title')}</h1>
            <p className="mt-1 text-sm text-zinc-400">{t(lang, 'guide.subtitle')}</p>
          </div>
          <BackToStudioButton />
        </header>

        <div className="min-h-0 flex flex-1 gap-5">
          {/* Left Navigation Sidebar */}
          <aside className="w-48 shrink-0 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-sm">
            <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t(lang, 'guide.list')}</div>
            <nav className="flex flex-col gap-1">
              <NavLink
                to="/guide"
                end
                className={({ isActive }) => `guide-sidebar-link ${isActive ? 'active' : ''}`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>{t(lang, 'guide.overview')}</span>
              </NavLink>
              {docs.map(doc => {
                const Icon = doc.icon
                return (
                  <NavLink
                    key={doc.slug}
                    to={`/guide/${doc.slug}`}
                    className={({ isActive }) => `guide-sidebar-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{doc.title}</span>
                  </NavLink>
                )
              })}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col shadow-sm">
            {!activeDoc ? (
              /* Overview Screen */
              <div className="mx-auto max-w-4xl space-y-6 w-full">
                <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6 dark:border-indigo-950/40 dark:bg-indigo-950/10 shadow-sm">
                  <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                  
                  <div className="flex flex-wrap items-start justify-between gap-6 relative z-10">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                        <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{t(lang, 'guide.hero_eyebrow')}</p>
                      </div>
                      <h2 className="mt-2 mb-2 text-xl font-extrabold text-zinc-100">{t(lang, 'guide.hero_title')}</h2>
                      <p className="m-0 text-sm leading-relaxed text-zinc-400">
                        {t(lang, 'guide.hero_body')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/30 dark:bg-indigo-950/20 backdrop-blur-sm">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                        <CheckCircle2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        {t(lang, 'guide.ready')}
                      </div>
                      <p className="mt-1.5 mb-0 text-[11px] text-zinc-400">{t(lang, 'guide.ready_body')}</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4">
                  {docs.map(doc => {
                    const Icon = doc.icon
                    return (
                      <Link
                        key={doc.slug}
                        to={`/guide/${doc.slug}`}
                        className="group flex items-start gap-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 dark:bg-zinc-950/20 p-5 no-underline transition-all duration-300 hover:border-indigo-500/40 dark:hover:border-indigo-400/40 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/5 hover:translate-x-1 shadow-sm"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 transition-all duration-300 group-hover:border-indigo-500/30 group-hover:bg-indigo-50/50 dark:group-hover:bg-indigo-950/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="m-0 text-[9px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80">{doc.eyebrow}</p>
                            <span className="rounded-full bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-400 shadow-sm">{doc.meta}</span>
                          </div>
                          <h3 className="mb-2 mt-0 text-base font-extrabold text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">{doc.title}</h3>
                          <p className="m-0 text-xs leading-relaxed text-zinc-400">{doc.description}</p>
                        </div>
                        <span className="mt-1 flex shrink-0 items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {t(lang, 'guide.read')}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
                        </span>
                      </Link>
                    )
                  })}
                </section>
              </div>
            ) : (
              /* Documentation Detail Screen */
              <div className="mx-auto max-w-4xl w-full">
                {/* Article Content Viewer */}
                <article className="min-w-0">
                  <header className="mb-6 pb-6 border-b border-zinc-800 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                      <div>
                        <p className="m-0 text-[9px] font-bold uppercase tracking-widest text-zinc-400">{activeDoc.eyebrow}</p>
                        <h2 className="m-0 text-2xl font-extrabold text-zinc-100">{activeDoc.title}</h2>
                      </div>
                      <span className="rounded-full bg-zinc-950 border border-zinc-800 px-2.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400 ml-auto">{activeDoc.meta}</span>
                    </div>
                    <p className="mt-3 mb-0 max-w-2xl text-xs leading-relaxed text-zinc-400">{activeDoc.description}</p>
                  </header>

                  <div onClick={handleGuideLink}>
                    {loading ? (
                      <Skeleton />
                    ) : error ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg border border-red-900/40 bg-red-950/30">
                          <FileText className="h-6 w-6 text-red-400" />
                        </div>
                        <p className="mb-1 font-semibold text-red-400">{t(lang, 'guide.load_error')}</p>
                        <p className="text-sm text-zinc-400">{error}</p>
                      </div>
                    ) : (
                      <Markdown text={content} className="guide-prose" />
                    )}
                  </div>
                </article>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
