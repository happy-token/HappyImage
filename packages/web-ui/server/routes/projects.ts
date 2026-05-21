import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { basename, join, relative, resolve } from 'path'
import { readSettings, streamProjectChat } from '@happyimage/core'

const projects = new Hono()

function outputRoot() {
  const settings = readSettings()
  return resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
}

function isInside(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

interface ConversationSession {
  timestamp: string
  message: string
  target: { type: string; index?: number } | null
  plan: string
  changes: Array<{ file: string; kind: string; image?: string; version?: number }>
}

interface ConversationFile {
  sessions: ConversationSession[]
}

function loadConversation(projectPath: string): ConversationFile {
  const convPath = join(projectPath, 'conversation.json')
  if (existsSync(convPath)) {
    try { return JSON.parse(readFileSync(convPath, 'utf-8')) }
    catch { /* fall through */ }
  }
  return { sessions: [] }
}

function saveConversation(projectPath: string, conv: ConversationFile) {
  mkdirSync(projectPath, { recursive: true })
  writeFileSync(join(projectPath, 'conversation.json'), JSON.stringify(conv, null, 2), 'utf-8')
}

function imageVersions(projectPath: string, baseName: string): string[] {
  if (!existsSync(projectPath)) return []
  const base = baseName.replace(/\.(png|jpe?g|webp|gif)$/i, '')
  const ext = baseName.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || '.png'
  const versions: string[] = []
  for (const name of readdirSync(projectPath)) {
    if (!statSync(join(projectPath, name)).isFile()) continue
    if (!/\.(png|jpe?g|webp|gif)$/i.test(name)) continue
    const fileBase = name.replace(/\.(png|jpe?g|webp|gif)$/i, '')
    if (fileBase === base || fileBase.startsWith(base.replace(/\.v\d+$/, '') + '.v')) {
      versions.push(name)
    }
  }
  return versions.sort()
}

function decodeProjectId(encoded: string): string | null {
  let decoded = decodeURIComponent(encoded)
  try {
    const base64Decoded = Buffer.from(encoded, 'base64url').toString('utf-8')
    if (base64Decoded.includes('/')) decoded = base64Decoded
  } catch { /* keep legacy decoded value */ }
  const root = outputRoot()
  const resolved = resolve(root, decoded)
  if (!isInside(root, resolved) || !existsSync(resolved) || !statSync(resolved).isDirectory()) return null
  return resolved
}

projects.get('/:encodedId', (c) => {
  const projectPath = decodeProjectId(c.req.param('encodedId'))
  if (!projectPath) return c.json({ error: 'Project not found' }, 404)

  const entries = readdirSync(projectPath)
  const files: Array<{ name: string; path: string; kind: string; size: number; content?: string }> = []
  const images: Array<{ name: string; path: string; versions: string[] }> = []
  const seenImageBases = new Set<string>()

  for (const name of entries.sort()) {
    const fullPath = join(projectPath, name)
    if (!statSync(fullPath).isFile()) continue
    const size = statSync(fullPath).size

    if (/\.(png|jpe?g|webp|gif)$/i.test(name)) {
      const ext = name.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || ''
      const base = name.replace(ext, '').replace(/\.v\d+$/, '')
      if (seenImageBases.has(base)) continue
      seenImageBases.add(base)
      images.push({
        name: base + ext,
        path: `/api/image?path=${encodeURIComponent(fullPath)}`,
        versions: imageVersions(projectPath, name),
      })
    }

    if (/\.(md|json|txt)$/i.test(name)) {
      const kind = name.startsWith('source-') ? 'source'
        : name === 'analysis.md' ? 'analysis'
        : name === 'outline.md' ? 'outline'
        : name === 'copy.md' ? 'copy'
        : name === 'conversation.json' ? 'conversation'
        : name.startsWith('prompts') || name.endsWith('.md') ? 'prompt' : 'file'

      let content: string | undefined
      try {
        const raw = readFileSync(fullPath, 'utf-8')
        content = raw.length > 4000 ? raw.slice(0, 4000) + '\n...' : raw
      } catch { /* binary */ }

      files.push({ name, path: fullPath, kind, size, content })
    }
  }

  const promptsDir = join(projectPath, 'prompts')
  if (existsSync(promptsDir) && statSync(promptsDir).isDirectory()) {
    for (const name of readdirSync(promptsDir).sort()) {
      if (!name.endsWith('.md')) continue
      const fullPath = join(promptsDir, name)
      let content: string | undefined
      try {
        const raw = readFileSync(fullPath, 'utf-8')
        content = raw.length > 4000 ? raw.slice(0, 4000) + '\n...' : raw
      } catch { /* skip */ }
      files.push({ name: `prompts/${name}`, path: fullPath, kind: 'prompt', size: statSync(fullPath).size, content })
    }
  }

  const conv = loadConversation(projectPath)
  const parts = relative(outputRoot(), projectPath).split('/')
  const categoryDir = parts.length >= 2 ? parts[0] : 'unknown'

  return c.json({
    id: c.req.param('encodedId'),
    name: basename(projectPath),
    path: projectPath,
    categoryDir,
    files,
    images,
    conversations: conv.sessions,
  })
})

projects.delete('/:encodedId', (c) => {
  const projectPath = decodeProjectId(c.req.param('encodedId'))
  if (!projectPath) return c.json({ error: 'Project not found' }, 404)

  try {
    rmSync(projectPath, { recursive: true, force: true })
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to delete project' }, 500)
  }
})

projects.post('/:encodedId/chat', async (c) => {
  const projectPath = decodeProjectId(c.req.param('encodedId'))
  if (!projectPath) return c.json({ error: 'Project not found' }, 404)

  let body: { message?: string; target?: { type: string; index?: number } }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const chatMessage = (body.message || '').trim()
  if (!chatMessage) return c.json({ error: 'message required' }, 400)

  return streamSSE(c, async (stream) => {
    const conv = loadConversation(projectPath)
    const session: ConversationSession = {
      timestamp: new Date().toISOString(),
      message: chatMessage,
      target: body.target || null,
      plan: '',
      changes: [],
    }

    try {
      await streamProjectChat({
        projectPath,
        message: chatMessage,
        target: body.target,
        signal: c.req.raw.signal,
        onPlan: async (plan) => {
          session.plan = plan
          await stream.writeSSE({ data: JSON.stringify({ type: 'plan', plan }) })
        },
        onFile: async (path, kind) => {
          session.changes.push({ file: path, kind })
          await stream.writeSSE({ data: JSON.stringify({ type: 'file', path, kind }) })
        },
        onImage: async (path) => {
          const url = `/api/image?path=${encodeURIComponent(path)}`
          session.changes.push({ file: path, kind: 'image' })
          await stream.writeSSE({ data: JSON.stringify({ type: 'image', path: url }) })
        },
        onError: async (error) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'error', error }) })
        },
        onDone: async () => {
          conv.sessions.push(session)
          saveConversation(projectPath, conv)
          await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) })
        },
      })
    } catch (err: any) {
      conv.sessions.push(session)
      saveConversation(projectPath, conv)
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: err.message || 'Chat failed' }) })
      await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) })
    }
  })
})

projects.post('/:encodedId/regenerate', async (c) => {
  const projectPath = decodeProjectId(c.req.param('encodedId'))
  if (!projectPath) return c.json({ error: 'Project not found' }, 404)

  let body: { target?: { type: string; index: number }; promptOverride?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  if (!body.target || typeof body.target.index !== 'number') {
    return c.json({ error: 'target with numeric index required' }, 400)
  }

  try {
    const { executeImagine } = await import('@happyimage/core')
    const promptsDir = join(projectPath, 'prompts')
    const promptFiles = existsSync(promptsDir)
      ? readdirSync(promptsDir).filter(n => n.endsWith('.md')).sort()
      : []

    const idx = body.target.index
    if (idx < 0 || idx >= promptFiles.length) {
      return c.json({ error: `Image index ${idx} out of range (0-${promptFiles.length - 1})` }, 400)
    }

    let prompt = body.promptOverride || ''
    if (!prompt) {
      const promptPath = join(promptsDir, promptFiles[idx])
      const raw = readFileSync(promptPath, 'utf-8')
      const promptMatch = raw.match(/^prompt:\s*(.+)/im) || raw.match(/```[\s\S]*?\n([\s\S]*?)```/)
      prompt = promptMatch ? promptMatch[1].trim() : raw.trim().slice(0, 2000)
    }

    const imageBase = promptFiles[idx].replace(/\.md$/, '')
    const existingVersions = imageVersions(projectPath, imageBase + '.png')
    const versionSuffix = existingVersions.length > 0 ? `.v${existingVersions.length + 1}` : ''
    const outputFile = `${imageBase}${versionSuffix}.png`

    const imagePath = await executeImagine({
      prompt,
      aspect_ratio: '1:1',
      output_dir: projectPath,
      output_file: outputFile,
    })

    const conv = loadConversation(projectPath)
    conv.sessions.push({
      timestamp: new Date().toISOString(),
      message: body.promptOverride ? 'Manual prompt override' : `Regenerate image ${idx + 1}`,
      target: body.target,
      plan: `Regenerated image ${idx + 1}`,
      changes: [{ file: `prompts/${promptFiles[idx]}`, kind: 'prompt' }, { file: imagePath, kind: 'image' }],
    })
    saveConversation(projectPath, conv)

    return c.json({
      image: `/api/image?path=${encodeURIComponent(imagePath)}`,
      path: imagePath,
      version: existingVersions.length + 1,
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Regeneration failed' }, 500)
  }
})

export default projects
