import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'

const BASE = 'http://localhost:3199'

let serverPid: number | null = null
let skillsRoot = ''
let sessionDb = ''
const envPath = resolve(import.meta.dir, '..', '.env')
let originalEnv: string | null = null

const coreSkills = [
  'baoyu-image-cards',
  'baoyu-cover-image',
  'baoyu-infographic',
  'baoyu-article-illustrator',
  'baoyu-comic',
  'baoyu-slide-deck',
  'baoyu-diagram',
  'baoyu-imagine',
  'baoyu-post-to-wechat',
  'baoyu-post-to-weibo',
  'baoyu-post-to-x',
  'baoyu-post-to-xiaohongshu',
]

const logFilePath = join(tmpdir(), 'happyimage-test-server.log')

beforeAll(async () => {
  originalEnv = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : null
  skillsRoot = mkdtempSync(join(tmpdir(), 'happyimage-skills-'))
  for (const skill of coreSkills) {
    const dir = join(skillsRoot, skill)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${skill}\n---\n\n# ${skill}\n`, 'utf-8')

    // Mock the browser scripts for post skills so that the probe check resolves to available: true
    if (skill === 'baoyu-post-to-xiaohongshu') {
      const scriptsDir = join(dir, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })
      writeFileSync(join(scriptsDir, 'xhs-browser.ts'), 'console.log("mock xhs script")', 'utf-8')
    }
    if (skill === 'baoyu-post-to-wechat') {
      const scriptsDir = join(dir, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })
      writeFileSync(join(scriptsDir, 'wechat-browser.ts'), 'console.log("mock wechat script")', 'utf-8')
    }
    if (skill === 'baoyu-post-to-weibo') {
      const scriptsDir = join(dir, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })
      writeFileSync(join(scriptsDir, 'weibo-post.ts'), 'console.log("mock weibo script")', 'utf-8')
    }
    if (skill === 'baoyu-post-to-x') {
      const scriptsDir = join(dir, 'scripts')
      mkdirSync(scriptsDir, { recursive: true })
      writeFileSync(join(scriptsDir, 'x-browser.ts'), 'console.log("mock x script")', 'utf-8')
    }
  }
  sessionDb = join(mkdtempSync(join(tmpdir(), 'happyimage-session-')), 'sessions.sqlite')
  if (existsSync(logFilePath)) rmSync(logFilePath, { force: true })
  const logFile = Bun.file(logFilePath)
  const proc = Bun.spawn(['bun', 'run', 'server/index.ts'], {
    env: { ...process.env, PORT: '3199', NODE_ENV: 'development', BAOYU_SKILLS_ROOT: skillsRoot, HAPPYIMAGE_SESSION_DB: sessionDb },
    stdout: logFile,
    stderr: logFile,
  })
  serverPid = proc.pid
  await new Promise(resolve => setTimeout(resolve, 2000))
})

afterAll(() => {
  if (serverPid) {
    try { process.kill(serverPid, 'SIGTERM') } catch {}
  }
  if (originalEnv === null) rmSync(envPath, { force: true })
  else writeFileSync(envPath, originalEnv, 'utf-8')
  if (sessionDb) rmSync(resolve(sessionDb, '..'), { recursive: true, force: true })
})

describe('API Health', () => {
  test('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
  })

  test('GET /api/dependencies returns environment checks', async () => {
    const res = await fetch(`${BASE}/api/dependencies`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('ok')
    expect(data.skillsRoot.ready).toBe(true)
    expect(data.skillsRoot.root).toBe(skillsRoot)
    expect(Array.isArray(data.checks)).toBe(true)
    expect(data.checks.some((check: any) => check.id === 'baoyu-skills')).toBe(true)
    expect(data.checks.some((check: any) => check.id === 'skill-runner')).toBe(true)
  })
})

describe('Commands API', () => {
  test('GET /api/commands returns core command registry', async () => {
    const res = await fetch(`${BASE}/api/commands`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((command: any) => command.id === 'baoyu-image-cards')).toBe(true)
    expect(data.some((command: any) => command.id === 'baoyu-post-to-wechat')).toBe(true)
  })

  test('POST /api/commands/parse parses slash commands', async () => {
    const res = await fetch(`${BASE}/api/commands/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '/baoyu-image-cards posts/ai-future/article.md' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.commandId).toBe('baoyu-image-cards')
    expect(data.args[0]).toBe('posts/ai-future/article.md')
    expect(data.command.skillId).toBe('image-cards')
  })

  test('POST /api/commands/parse maps deprecated xhs command to image cards', async () => {
    const res = await fetch(`${BASE}/api/commands/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '/baoyu-xhs-images posts/a.md' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.commandId).toBe('baoyu-image-cards')
    expect(data.command.requiredSkill).toBe('baoyu-image-cards')
  })

  test('POST /api/commands/parse rejects unknown slash commands', async () => {
    const res = await fetch(`${BASE}/api/commands/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '/baoyu-not-real' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('Skills Root API', () => {
  test('POST /api/skills-root/use saves an existing skills root', async () => {
    const res = await fetch(`${BASE}/api/skills-root/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: skillsRoot }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.skillsRoot.root).toBe(skillsRoot)
    expect(data.skillsRoot.ready).toBe(true)
  })

  test('POST /api/skills-root/install installs skills root', async () => {
    const tempTargetRoot = join(tmpdir(), `happyimage-test-install-${Date.now()}`)
    const res = await fetch(`${BASE}/api/skills-root/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: tempTargetRoot }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.root).toBe(tempTargetRoot)
    expect(existsSync(join(tempTargetRoot, 'baoyu-image-cards', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(tempTargetRoot, 'baoyu-post-to-xiaohongshu', 'scripts', 'xhs-browser.ts'))).toBe(true)
    rmSync(tempTargetRoot, { recursive: true, force: true })
  }, 120_000)
})

describe('Sessions API', () => {
  test('POST /api/sessions creates an interactive session with command request', async () => {
    const res = await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Gallery preset',
        commandRequest: {
          commandId: 'baoyu-image-cards',
          source: { type: 'text', value: 'AI future' },
          options: { style: 'study-notes' },
        },
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.id).toBeDefined()
    expect(data.session.commandRequest.commandId).toBe('baoyu-image-cards')
    expect(data.session.events.some((event: any) => event.type === 'message')).toBe(true)
  })

  test('POST /api/sessions/:id/messages converts slash commands to command requests', async () => {
    const create = await fetch(`${BASE}/api/sessions`, { method: 'POST' })
    const { session } = await create.json()
    const res = await fetch(`${BASE}/api/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/baoyu-image-cards posts/a.md make it concise' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.commandRequest.commandId).toBe('baoyu-image-cards')
    expect(data.session.commandRequest.source.type).toBe('file')
    expect(data.session.commandRequest.source.value).toBe('posts/a.md')
  })

  test('POST /api/sessions/:id/messages asks a structured question for natural language', async () => {
    const create = await fetch(`${BASE}/api/sessions`, { method: 'POST' })
    const { session } = await create.json()
    const res = await fetch(`${BASE}/api/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '帮我做一组小红书图片' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('asking')
    expect(data.session.events.some((event: any) => event.type === 'question' && event.question.control === 'single-choice')).toBe(true)
  })
})

describe('Chat Session API', () => {
  test('POST /api/sessions creates a persisted chat session', async () => {
    const res = await fetch(`${BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Chat runtime test',
        message: 'Start from gallery',
        commandRequest: {
          commandId: 'baoyu-image-cards',
          source: { type: 'text', value: 'AI launch' },
          options: { style: 'fresh' },
        },
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.id).toBeDefined()
    expect(data.session.events.some((event: any) => event.type === 'command')).toBe(true)

    const loaded = await fetch(`${BASE}/api/sessions/${data.session.id}`).then(res => res.json())
    expect(loaded.session.id).toBe(data.session.id)
    expect(loaded.session.commandRequest.commandId).toBe('baoyu-image-cards')
  })

  test('GET /api/sessions/:id/events supports seq resume', async () => {
    const created = await fetch(`${BASE}/api/sessions`, { method: 'POST' }).then(res => res.json())
    await fetch(`${BASE}/api/sessions/${created.session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/baoyu-xhs-images posts/a.md' }),
    })
    const all = await fetch(`${BASE}/api/sessions/${created.session.id}/events`).then(res => res.json())
    expect(all.events.length).toBeGreaterThan(0)
    const firstSeq = all.events[0].seq
    const resumed = await fetch(`${BASE}/api/sessions/${created.session.id}/events?after=${firstSeq}`).then(res => res.json())
    expect(resumed.events.every((event: any) => event.seq > firstSeq)).toBe(true)
  })

  test('POST /api/sessions/:id/messages asks structured question for natural language', async () => {
    const created = await fetch(`${BASE}/api/sessions`, { method: 'POST' }).then(res => res.json())
    const res = await fetch(`${BASE}/api/sessions/${created.session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '帮我生成一张封面图' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('asking')
    expect(data.session.events.some((event: any) => event.type === 'question')).toBe(true)
  })
  test('GET /api/sessions/:id/stream replays missed events', async () => {
    const create = await fetch(`${BASE}/api/sessions`, { method: 'POST' }).then(res => res.json())
    await fetch(`${BASE}/api/sessions/${create.session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/baoyu-image-cards posts/test.md' }),
    })
    const res = await fetch(`${BASE}/api/sessions/${create.session.id}/stream?after=0`)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('replay')
  })

  test('GET /api/sessions/:id/stream returns 404 for unknown sessions', async () => {
    const res = await fetch(`${BASE}/api/sessions/nonexistent/stream?after=0`)
    expect(res.status).toBe(404)
  })

  test('PATCH /api/sessions/:id updates session title', async () => {
    const create = await fetch(`${BASE}/api/sessions`, { method: 'POST' }).then(res => res.json())
    const res = await fetch(`${BASE}/api/sessions/${create.session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Renamed session' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.title).toBe('Renamed session')
  })

  test('DELETE /api/sessions/:id removes session and returns ok', async () => {
    const create = await fetch(`${BASE}/api/sessions`, { method: 'POST' }).then(res => res.json())
    const res = await fetch(`${BASE}/api/sessions/${create.session.id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    const reload = await fetch(`${BASE}/api/sessions/${create.session.id}`)
    expect(reload.status).toBe(404)
  })

  test('DELETE /api/sessions/:id returns 404 for unknown session', async () => {
    const res = await fetch(`${BASE}/api/sessions/nonexistent-session`, { method: 'DELETE' })
    expect(res.status).toBe(404)
  })

  test('error events use structured fields (code, retryable, action)', async () => {
    const create = await fetch(`${BASE}/api/sessions`, { method: 'POST' }).then(res => res.json())
    const res = await fetch(`${BASE}/api/sessions/${create.session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/nonexistent-command' }),
    })
    expect(res.status).toBe(404)
    const session = await fetch(`${BASE}/api/sessions/${create.session.id}`).then(res => res.json())
    const errorEvent = session.session.events.find((e: any) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent.code).toBe('UNKNOWN_COMMAND')
    expect(errorEvent.retryable).toBe(true)
    expect(errorEvent.action).toBeDefined()
  })

  test('POST /api/generate returns sessionId in done event', async () => {
    const res = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: 'image-cards', content: '/baoyu-image-cards test prompt', selections: { style: 'fresh', layout: 'single' } }),
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('sessionId')
  }, 120_000)

  test('GET /api/sessions/:id returns 404 with error for missing session', async () => {
    const res = await fetch(`${BASE}/api/sessions/nonexistent-session-id`)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})

describe('Upload API', () => {
  test('POST /api/upload/source accepts markdown files', async () => {
    const form = new FormData()
    form.append('file', new File(['# Article\n\nAI image brief.'], 'article.md', { type: 'text/markdown' }))

    const res = await fetch(`${BASE}/api/upload/source`, { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('article.md')
    expect(data.path).toContain('happyimage-uploads')
    expect(data.size).toBeGreaterThan(0)
  })

  test('POST /api/upload/source rejects unsupported files', async () => {
    const form = new FormData()
    form.append('file', new File(['bad'], 'article.pdf', { type: 'application/pdf' }))

    const res = await fetch(`${BASE}/api/upload/source`, { method: 'POST', body: form })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})

describe('Skills API', () => {
  test('GET /api/skills returns list', async () => {
    const res = await fetch(`${BASE}/api/skills`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('name')
  })

  test('GET /api/skills/:id returns skill detail', async () => {
    const res = await fetch(`${BASE}/api/skills/image-cards`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('image-cards')
    expect(data.dimensions).toBeDefined()
  })

  test('GET /api/skills/:id returns 404 for unknown', async () => {
    const res = await fetch(`${BASE}/api/skills/nonexistent`)
    expect(res.status).toBe(404)
  })
})

describe('Projects API', () => {
  test('GET /api/projects returns array', async () => {
    const res = await fetch(`${BASE}/api/projects`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  test('GET /api/projects/:id returns 404 for nonexistent', async () => {
    const res = await fetch(`${BASE}/api/projects/nonexistent`)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  test('DELETE /api/projects/:id returns 404 for nonexistent', async () => {
    const res = await fetch(`${BASE}/api/projects/nonexistent`, { method: 'DELETE' })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})

describe('Preferences API', () => {
  test('GET /api/preferences/:skillId returns info', async () => {
    const res = await fetch(`${BASE}/api/preferences/image-cards`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('found')
    expect(data).toHaveProperty('targets')
  })

  test('GET /api/preferences/image-cards falls back to baoyu-xhs-images', async () => {
    const res = await fetch(`${BASE}/api/preferences/image-cards`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.found).toBe(true)
    expect((data.values.watermark as Record<string, unknown>)?.content).toBe('@happytoken')
  })

  test('GET /api/preferences/:skillId/schema returns editable fields', async () => {
    const res = await fetch(`${BASE}/api/preferences/image-cards/schema`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.skillId).toBe('image-cards')
    expect(Array.isArray(data.fields)).toBe(true)
    expect(data.fields.some((field: any) => field.key === 'preferred_image_backend')).toBe(true)
  })

  test('GET /api/preferences/:skillId returns 404 for unknown', async () => {
    const res = await fetch(`${BASE}/api/preferences/unknown-skill`)
    expect(res.status).toBe(404)
  })

  test('POST /api/preferences/:skillId rejects missing values', async () => {
    const res = await fetch(`${BASE}/api/preferences/image-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('Package API', () => {
  test('POST /api/package rejects missing projectPath', async () => {
    const res = await fetch(`${BASE}/api/package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/package rejects illegal path traversal', async () => {
    const res = await fetch(`${BASE}/api/package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: '/etc/passwd', platform: 'xiaohongshu' }),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/package/check validates platform rules', async () => {
    const res = await fetch(`${BASE}/api/package/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'x', images: Array(5).fill('/test.png') }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.violations.length).toBeGreaterThan(0)
    expect(data.violations[0].field).toBe('images')
  })

  test('GET /api/package/rules returns all platform rules', async () => {
    const res = await fetch(`${BASE}/api/package/rules`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Publish API', () => {
  test('POST /api/publish rejects unsupported platform', async () => {
    const res = await fetch(`${BASE}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'instagram', packagePath: '/tmp/test' }),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/publish rejects missing packagePath', async () => {
    const res = await fetch(`${BASE}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'wechat' }),
    })
    expect(res.status).toBe(400)
  })

  test('GET /api/publish/probe returns platform availability', async () => {
    const res = await fetch(`${BASE}/api/publish/probe?platform=xiaohongshu`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.xiaohongshu).toBeDefined()
    expect(data.xiaohongshu).toHaveProperty('available')
  })
})

describe('Generate API', () => {
  test('POST /api/generate rejects missing skillId', async () => {
    const res = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/generate returns 404 for unknown skill', async () => {
    const res = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: 'nonexistent' }),
    })
    expect(res.status).toBe(404)
  })

  test('POST /api/generate/plan requires skillId', async () => {
    const res = await fetch(`${BASE}/api/generate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/generate/plan rejects unknown slash command', async () => {
    const res = await fetch(`${BASE}/api/generate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: 'image-cards', content: '/baoyu-nope test' }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Unknown slash command')
  })
})

describe('Accounts API', () => {
  test('GET /api/accounts/wechat returns accounts structure', async () => {
    const res = await fetch(`${BASE}/api/accounts/wechat`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('platform')
    expect(data).toHaveProperty('accounts')
  })

  test('GET /api/accounts/weibo returns accounts structure', async () => {
    const res = await fetch(`${BASE}/api/accounts/weibo`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('accounts')
  })
})

describe('Docs API', () => {
  test('GET /api/docs/user-guide returns the user guide content', async () => {
    const res = await fetch(`${BASE}/api/docs/user-guide`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('content')
    expect(typeof data.content).toBe('string')
    expect(data.content).toContain('HappyImage 用户与多平台发布配置指南')
  })
})

