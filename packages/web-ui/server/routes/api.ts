import { Hono } from 'hono'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { skills, getSkill, readSettings, PROJECT_ROOT } from '@happyimage/core'

const api = new Hono()

function encodeProjectId(id: string) {
  return Buffer.from(id, 'utf-8').toString('base64url')
}

function commandExists(command: string) {
  const lookup = process.platform === 'win32' ? 'where' : 'which'
  return spawnSync(lookup, [command], { stdio: 'ignore' }).status === 0
}

function canRunBunScripts() {
  return commandExists('bun') || commandExists('npx')
}

function chromeExists(settings: Record<string, string>) {
  const configured = settings.BAOYU_CHROME_PATH
    || settings.WECHAT_BROWSER_CHROME_PATH
    || settings.WEIBO_BROWSER_CHROME_PATH
    || settings.X_BROWSER_CHROME_PATH
  if (configured && existsSync(configured)) return true
  if (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) return true
  return commandExists('google-chrome') || commandExists('chromium') || commandExists('chromium-browser')
}

function hasAnyImageBackend(settings: Record<string, string>) {
  return Boolean(
    settings.OPENAI_API_KEY
    || settings.GOOGLE_API_KEY
    || settings.GEMINI_API_KEY
    || settings.OPENROUTER_API_KEY
    || settings.DASHSCOPE_API_KEY
    || settings.REPLICATE_API_TOKEN
    || settings.AZURE_OPENAI_API_KEY
    || settings.ZAI_API_KEY
    || settings.BIGMODEL_API_KEY
    || settings.MINIMAX_API_KEY
    || settings.ARK_API_KEY
    || (settings.JIMENG_ACCESS_KEY_ID && settings.JIMENG_SECRET_ACCESS_KEY)
    || process.env.OPENAI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.OPENROUTER_API_KEY
    || process.env.DASHSCOPE_API_KEY
    || process.env.REPLICATE_API_TOKEN
    || process.env.AZURE_OPENAI_API_KEY
    || process.env.ZAI_API_KEY
    || process.env.BIGMODEL_API_KEY
    || process.env.MINIMAX_API_KEY
    || process.env.ARK_API_KEY
    || (process.env.JIMENG_ACCESS_KEY_ID && process.env.JIMENG_SECRET_ACCESS_KEY)
  )
}

function hasBaoyuSkills() {
  const skillsDir = resolve(PROJECT_ROOT, 'skills')
  const required = [
    'baoyu-image-cards',
    'baoyu-imagine',
    'baoyu-post-to-wechat',
    'baoyu-post-to-weibo',
    'baoyu-post-to-x',
  ]
  return existsSync(skillsDir) && required.every(name => existsSync(join(skillsDir, name, 'SKILL.md')))
}

api.get('/dependencies', (c) => {
  const settings = readSettings()
  const checks = [
    {
      id: 'baoyu-skills',
      label: 'baoyu-skills',
      ok: hasBaoyuSkills(),
      required: true,
      description: 'HappyImage 的生成能力来自 baoyu-skills。未安装时，请先安装完整技能集。',
      installLabel: '安装 baoyu-skills',
      installUrl: 'https://github.com/JimLiu/baoyu-skills#安装',
    },
    {
      id: 'skill-runner',
      label: 'Skill 脚本运行能力',
      ok: canRunBunScripts(),
      required: true,
      description: 'baoyu-skills 需要 Node.js/npx 来运行内部脚本；通常安装 Node.js 后即可。',
      installLabel: '安装 Node.js',
      installUrl: 'https://nodejs.org/',
    },
    {
      id: 'claude-code',
      label: 'Claude Code CLI',
      ok: commandExists(settings.CLAUDE_CODE_COMMAND || 'claude'),
      required: false,
      description: '可选：如果希望完全复用 Claude Code 的技能运行体验，请安装或登录 Claude Code。',
      installLabel: '安装 Claude Code',
      installUrl: 'https://docs.anthropic.com/en/docs/claude-code/setup',
    },
    {
      id: 'git',
      label: 'Git',
      ok: commandExists('git'),
      required: false,
      description: '用于读取 GitHub/本地项目上下文。',
      installLabel: '安装 Git',
      installUrl: 'https://git-scm.com/downloads',
    },
    {
      id: 'chrome',
      label: 'Chrome',
      ok: chromeExists(settings),
      required: false,
      description: '用于桌面模式、微信/微博/X 发稿登录态和 CDP 自动化。',
      installLabel: '安装 Chrome',
      installUrl: 'https://www.google.com/chrome/',
    },
    {
      id: 'anthropic-auth',
      label: 'Anthropic API Key / Auth Token',
      ok: Boolean(settings.ANTHROPIC_API_KEY || settings.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
      required: false,
      description: '如果不用 Claude Code CLI 登录态，则需要在 Settings 配置 API Key。',
      installLabel: '打开 Settings',
      installUrl: '/settings',
    },
    {
      id: 'image-backend',
      label: 'Image backend key',
      ok: hasAnyImageBackend(settings),
      required: false,
      description: '生成图片需要至少配置一个 baoyu-imagine 支持的供应商。',
      installLabel: '配置生图模型',
      installUrl: '/settings',
    },
  ]
  return c.json({
    ok: checks.filter(check => check.required).every(check => check.ok),
    checks,
  })
})

api.get('/skills', (c) => {
  return c.json(skills.map(s => ({
    id: s.id,
    name: s.name,
    nameZh: s.nameZh,
    description: s.description,
    category: s.category,
    styleType: s.styleType,
    dimensionCount: Object.keys(s.dimensions).length,
    presetCount: s.presets.length,
    bestFor: s.bestFor,
    hasCLI: s.hasCLI,
    outputType: s.outputType,
    defaultAspectRatio: s.defaultAspectRatio,
  })))
})

api.get('/skills/:id', (c) => {
  const id = c.req.param('id')
  const skill = getSkill(id)
  if (!skill) return c.json({ error: 'Skill not found' }, 404)
  return c.json(skill)
})

api.get('/projects', (c) => {
  const settings = readSettings()
  const outputRoot = resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
  if (!existsSync(outputRoot)) return c.json([])

  const projects = []
  for (const skillDir of readdirSync(outputRoot)) {
    const skillPath = join(outputRoot, skillDir)
    if (!statSync(skillPath).isDirectory() || skillDir.startsWith('.')) continue

    for (const projectDir of readdirSync(skillPath)) {
      const projectPath = join(skillPath, projectDir)
      if (!statSync(projectPath).isDirectory() || projectDir.startsWith('.')) continue
      const entries = readdirSync(projectPath)
      const files = entries.filter(name => statSync(join(projectPath, name)).isFile())
      const hasSource = files.some(name => name.startsWith('source-') && name.endsWith('.md'))
      const images = files
        .filter(name => /\.(png|jpe?g|webp|gif)$/i.test(name))
        .map(name => `/api/image?path=${encodeURIComponent(join(projectPath, name))}`)
      const promptsPath = join(projectPath, 'prompts')
      const promptCount = existsSync(promptsPath) && statSync(promptsPath).isDirectory()
        ? readdirSync(promptsPath).filter(name => name.endsWith('.md')).length
        : 0
      const updatedAt = Math.max(...entries.map(name => statSync(join(projectPath, name)).mtimeMs), statSync(projectPath).mtimeMs)
      const looksLikeBaoyuProject = hasSource
        || files.includes('analysis.md')
        || files.includes('outline.md')
        || files.includes('copy.md')
        || promptCount > 0
        || images.length > 0
      if (!looksLikeBaoyuProject) continue

      projects.push({
        id: `${skillDir}/${projectDir}`,
        detailId: encodeProjectId(`${skillDir}/${projectDir}`),
        skillDir,
        name: projectDir,
        path: projectPath,
        updatedAt,
        images,
        hasSource,
        hasAnalysis: files.includes('analysis.md'),
        hasOutline: files.includes('outline.md'),
        hasCopy: files.includes('copy.md'),
        promptCount,
      })
    }
  }

  projects.sort((a, b) => b.updatedAt - a.updatedAt)
  return c.json(projects.slice(0, 100))
})

export default api
