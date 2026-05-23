import { Hono } from 'hono'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join, relative, resolve } from 'path'
import { spawn } from 'child_process'
import { PROJECT_ROOT, readSettings, resolveSkillDir } from '@happyimage/core'

const publishRoute = new Hono()

function outputRoot() {
  const settings = readSettings()
  return resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
}

function isInside(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

function imagesIn(dir: string, limit?: number) {
  if (!existsSync(dir)) return []
  const images = readdirSync(dir)
    .filter(name => /\.(png|jpe?g|webp|gif)$/i.test(name))
    .sort()
    .map(name => join(dir, name))
  return typeof limit === 'number' ? images.slice(0, limit) : images
}

function expandHome(value: string) {
  return value.replace(/^~(?=\/|$)/, process.env.HOME || '')
}

function platformProfile(platform: string, settings: Record<string, string>) {
  const key = 
    platform === 'weibo' ? 'WEIBO_BROWSER_PROFILE_DIR' : 
    platform === 'x' ? 'X_BROWSER_PROFILE_DIR' : 
    platform === 'xiaohongshu' ? 'XHS_BROWSER_PROFILE_DIR' : ''
  const value = key ? settings[key] : ''
  return value ? resolve(expandHome(value)) : ''
}

function requiredSkillDir(skillId: string) {
  const skillDir = resolveSkillDir(skillId)
  if (!skillDir) {
    throw new Error(`Required skill not found: baoyu-${skillId}. Configure BAOYU_SKILLS_ROOT or install baoyu-skills to ~/.baoyu-skills.`)
  }
  return skillDir
}

function buildCommand(platform: string, packagePath: string, settings: Record<string, string>, accountAlias?: string) {
  if (platform === 'x') {
    const postPath = join(packagePath, 'x-post.md')
    const text = existsSync(postPath) ? readFileSync(postPath, 'utf-8') : ''
    const images = imagesIn(join(packagePath, 'images'), 4)
    const profile = platformProfile(platform, settings)
    const args = [text, ...images.flatMap(path => ['--image', path])]
    if (profile) args.push('--profile', profile)
    const skillDir = requiredSkillDir('post-to-x')
    return {
      script: join(skillDir, 'scripts/x-browser.ts'),
      args,
    }
  }

  if (platform === 'weibo') {
    const postPath = join(packagePath, 'weibo-post.md')
    const text = existsSync(postPath) ? readFileSync(postPath, 'utf-8') : ''
    const images = imagesIn(join(packagePath, 'images'), 18)
    const profile = platformProfile(platform, settings)
    const args = [text, ...images.flatMap(path => ['--image', path])]
    if (profile) args.push('--profile', profile)
    const skillDir = requiredSkillDir('post-to-weibo')
    return {
      script: join(skillDir, 'scripts/weibo-post.ts'),
      args,
    }
  }

  if (platform === 'wechat') {
    const markdownPath = join(packagePath, 'wechat-article.md')
    const imagesDir = join(packagePath, 'imgs')
    const args = ['--markdown', markdownPath, '--images', imagesDir]
    if (accountAlias && accountAlias !== 'default') args.push('--account', accountAlias)
    const skillDir = requiredSkillDir('post-to-wechat')
    return {
      script: join(skillDir, 'scripts/wechat-browser.ts'),
      args,
    }
  }

  if (platform === 'xiaohongshu') {
    const postPath = join(packagePath, 'xhs-post.md')
    const text = existsSync(postPath) ? readFileSync(postPath, 'utf-8') : ''
    const images = imagesIn(join(packagePath, 'images'), 18)
    const profile = platformProfile(platform, settings)
    const args = [text, ...images.flatMap(path => ['--image', path])]
    if (profile) args.push('--profile', profile)
    const skillDir = requiredSkillDir('post-to-xiaohongshu')
    return {
      script: join(skillDir, 'scripts/xhs-browser.ts'),
      args,
    }
  }

  throw new Error(`Unsupported publishing platform: ${platform}`)
}

publishRoute.get('/probe', (c) => {
  const settings = readSettings()
  const platform = c.req.query('platform') || 'xiaohongshu'
  const probeResults: Record<string, { available: boolean; reason: string; scriptPath?: string }> = {}

  const probeList = platform === 'all' ? ['xiaohongshu', 'wechat', 'weibo', 'x'] : [platform]

  for (const plat of probeList) {
    let available = false
    let reason = ''
    let scriptPath = ''

    if (['wechat', 'weibo', 'x'].includes(plat)) {
      const skillMap: Record<string, string> = { wechat: 'post-to-wechat', weibo: 'post-to-weibo', x: 'post-to-x' }
      const scriptFileMap: Record<string, string> = { wechat: 'wechat-browser.ts', weibo: 'weibo-post.ts', x: 'x-browser.ts' }
      const skillDir = resolveSkillDir(skillMap[plat])
      if (!skillDir) {
        probeResults[plat] = { available: false, reason: `Post skill not found: baoyu-${skillMap[plat]}` }
        continue
      }
      const script = join(skillDir, 'scripts', scriptFileMap[plat])
      scriptPath = script
      available = existsSync(script)
      reason = available ? 'available' : `Post skill script not found at ${script}`
    } else if (plat === 'xiaohongshu') {
      const skillDir = resolveSkillDir('post-to-xiaohongshu')
      if (!skillDir) {
        probeResults[plat] = { available: false, reason: 'Xiaohongshu publish skill not installed. Only material packaging is available.' }
        continue
      }
      const xhsScript = join(skillDir, 'scripts', 'xhs-browser.ts')
      scriptPath = xhsScript
      available = existsSync(xhsScript)
      reason = available ? 'available' : 'Xiaohongshu publish skill not installed. Only material packaging is available.'
    }

    probeResults[plat] = { available, reason, ...(scriptPath ? { scriptPath } : {}) }
  }

  return c.json(probeResults)
})

publishRoute.post('/', async (c) => {
  let body: { packagePath?: string; platform?: string; accountAlias?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const platform = body.platform || ''
  if (!['wechat', 'weibo', 'x', 'xiaohongshu'].includes(platform)) {
    return c.json({ error: 'Only wechat, weibo, x, and xiaohongshu publishing are currently supported' }, 400)
  }

  const root = outputRoot()
  const packagePath = body.packagePath ? resolve(body.packagePath) : ''
  if (!packagePath || !isInside(root, packagePath) || !existsSync(packagePath) || !statSync(packagePath).isDirectory()) {
    return c.json({ error: 'Valid packagePath required' }, 400)
  }

  const settings = readSettings()
  const accountAlias = body.accountAlias ? String(body.accountAlias).replace(/[^a-zA-Z0-9_-]/g, '') : ''
  let command: { script: string; args: string[] }
  try {
    command = buildCommand(platform, packagePath, settings, accountAlias)
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 500)
  }
  const { script, args } = command
  if (!existsSync(script)) return c.json({ error: `Publish script not found: ${script}` }, 500)

  const logsDir = join(root, '.happyimage-logs')
  mkdirSync(logsDir, { recursive: true })
  const logPath = join(logsDir, `${platform}-${Date.now()}.log`)
  writeFileSync(logPath, [`script: ${script}`, `args: ${JSON.stringify(args)}`, ''].join('\n'), 'utf-8')

  const proc = spawn('bun', ['run', script, ...args], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...settings },
  })

  proc.stdout.on('data', chunk => writeFileSync(logPath, chunk.toString(), { flag: 'a' }))
  proc.stderr.on('data', chunk => writeFileSync(logPath, chunk.toString(), { flag: 'a' }))
  proc.on('close', code => writeFileSync(logPath, `\n[exit ${code}]\n`, { flag: 'a' }))
  proc.unref()

  return c.json({
    started: true,
    platform,
    accountAlias: accountAlias || null,
    pid: proc.pid,
    logPath,
    message: 'Browser publishing flow started. Review the platform draft before publishing.',
  })
})

export default publishRoute
