import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const BASE = 'http://localhost:3199'

let serverPid: number | null = null
let skillsRoot = ''

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
]

beforeAll(async () => {
  skillsRoot = mkdtempSync(join(tmpdir(), 'happyimage-skills-'))
  for (const skill of coreSkills) {
    const dir = join(skillsRoot, skill)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${skill}\n---\n\n# ${skill}\n`, 'utf-8')
  }
  const proc = Bun.spawn(['bun', 'run', 'server/index.ts'], {
    env: { ...process.env, PORT: '3199', NODE_ENV: 'development', BAOYU_SKILLS_ROOT: skillsRoot },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  serverPid = proc.pid
  await new Promise(resolve => setTimeout(resolve, 2000))
})

afterAll(() => {
  if (serverPid) process.kill(serverPid, 'SIGTERM')
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

  test('POST /api/commands/parse rejects unknown slash commands', async () => {
    const res = await fetch(`${BASE}/api/commands/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '/baoyu-not-real' }),
    })
    expect(res.status).toBe(404)
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
      body: JSON.stringify({ platform: 'xiaohongshu', packagePath: '/tmp/test' }),
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
