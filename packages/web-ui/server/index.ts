import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { extname, relative, resolve } from 'path'
import { existsSync } from 'fs'
import api from './routes/api'
import generate from './routes/generate'
import exportRoute from './routes/export'
import settingsRoute from './routes/settings'
import captionRoute from './routes/caption'
import packageRoute from './routes/package'
import publishRoute from './routes/publish'
import preferencesRoute from './routes/preferences'
import sessionRoute from './routes/session'
import sessionsRoute from './routes/sessions'
import accountsRoute from './routes/accounts'
import projectsRoute from './routes/projects'
import uploadRoute from './routes/upload'
import skillsRootRoute from './routes/skills-root'
import { readSettings, PROJECT_ROOT } from '@happyimage/core'

const app = new Hono()
const webUiRoot = resolve(import.meta.dirname, '..')
app.use('*', cors())
app.route('/api', api)
app.route('/api/generate', generate)
app.route('/api/caption', captionRoute)
app.route('/api/package', packageRoute)
app.route('/api/publish', publishRoute)
app.route('/api/preferences', preferencesRoute)
app.route('/api/session', sessionRoute)
app.route('/api/sessions', sessionsRoute)
app.route('/api/chat', sessionsRoute)
app.route('/api/accounts', accountsRoute)
app.route('/api/projects', projectsRoute)
app.route('/api/upload', uploadRoute)
app.route('/api/settings', settingsRoute)
app.route('/api/skills-root', skillsRootRoute)
app.route('/api/export', exportRoute)
app.get('/api/health', (c) => c.json({ status: 'ok' }))
app.get('/api/image', async (c) => {
  const rawPath = c.req.query('path')
  if (!rawPath) return c.text('Not found', 404)
  const path = resolve(rawPath)
  const settings = readSettings()
  const outputRoot = resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
  const isAllowedRoot = [outputRoot, PROJECT_ROOT].some(root => {
    const rel = relative(root, path)
    return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
  })
  const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extname(path).toLowerCase())
  if (!isAllowedRoot || !isImage || !existsSync(path)) return c.text('Not found', 404)
  const file = Bun.file(path)
  return new Response(file, {
    headers: {
      'Content-Type': file.type || 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})
app.use('/api/images/*', serveStatic({
  root: resolve(import.meta.dirname, '..', '..'),
  rewriteRequestPath: (p) => p.replace('/api/images', ''),
}))
app.use('/screenshots/*', serveStatic({ root: '.' }))

const isDev = process.env.NODE_ENV !== 'production'
if (!isDev) {
  app.use('/assets/*', serveStatic({ root: resolve(webUiRoot, 'dist') }))
  app.use('/screenshots/*', serveStatic({ root: resolve(webUiRoot, 'dist') }))
  app.get('/logo.svg', async (c) => {
    const logo = Bun.file(resolve(webUiRoot, 'dist', 'logo.svg'))
    if (!(await logo.exists())) return c.text('Not found', 404)
    return new Response(logo, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  })
  app.get('/favicon.ico', async (c) => {
    const logo = Bun.file(resolve(webUiRoot, 'dist', 'logo.svg'))
    if (!(await logo.exists())) return c.text('Not found', 404)
    return new Response(logo, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  })
  app.get('*', async (c) => {
    const index = Bun.file(resolve(webUiRoot, 'dist', 'index.html'))
    if (!(await index.exists())) return c.text('Web UI has not been built. Run `happyimage build` or `bun run build`.', 500)
    return new Response(index, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  })
}

const port = Number(process.env.PORT) || 3100
console.log(`HappyImage API → http://localhost:${port}${isDev ? ' (dev: use Vite at :5173)' : ''}`)

export default { port, fetch: app.fetch, idleTimeout: 120 }
