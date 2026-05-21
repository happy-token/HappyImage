import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, basename } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { readApiKey, readBaseUrl, readModel, readSettings, PROJECT_ROOT } from './settings.js'
import { getPreferenceInfo } from './preferences.js'

export function resolveSkillDir(skillId: string): string | null {
  const settings = readSettings()
  const home = process.env.HOME || '/Users/forever'
  const customRoot = settings.BAOYU_SKILLS_ROOT || process.env.BAOYU_SKILLS_ROOT || ''

  const lookupDirs: string[] = []

  // 1. Working Dir
  lookupDirs.push(join(process.cwd(), 'skills'))

  // 2. BAOYU_SKILLS_ROOT environment setting
  if (customRoot) {
    lookupDirs.push(resolve(customRoot.replace('~', home)))
  }

  // 3. User level directory (~/.baoyu-skills)
  lookupDirs.push(join(home, '.baoyu-skills'))

  // 4. Fallback (Workspace level)
  lookupDirs.push(join(PROJECT_ROOT, 'skills'))

  const nameCandidates = [
    `baoyu-${skillId}`,
    skillId,
  ]

  for (const baseDir of lookupDirs) {
    for (const name of nameCandidates) {
      const p = join(baseDir, name)
      if (existsSync(p) && statSync(p).isDirectory()) {
        return p
      }
    }
  }

  return null
}

function readSkillMd(skillId: string): string | null {
  const skillDir = resolveSkillDir(skillId)
  if (!skillDir) return null
  const p = join(skillDir, 'SKILL.md')
  if (existsSync(p)) {
    let content = readFileSync(p, 'utf-8')

    // Strip YAML frontmatter
    content = content.replace(/^---[\s\S]*?---\n/, '')

    // Extract sections useful for non-interactive project generation.
    const keepSections = [
      'Dimensions', 'Styles', 'Layouts', 'Palettes', 'Presets',
      'Auto-Selection', 'Style × Layout Matrix',
      'Outline Strategies', 'Content Breakdown Principles',
      'File Layout', 'File Structure', 'Output Structure',
      'Workflow', 'Core Principles', 'Confirmation Policy',
    ]
    const parts: string[] = []
    for (const section of keepSections) {
      const re = new RegExp(`## ${section}[^#]*`, 'i')
      const m = content.match(re)
      if (m) parts.push(m[0].trim())
    }

    return parts.length > 0 ? parts.join('\n\n') : content.slice(0, 12000)
  }
  return null
}

interface ImagineInput {
  prompt: string
  aspect_ratio?: string
  backend?: string
  output_dir?: string
  output_file?: string
  signal?: AbortSignal
}

export function executeImagine(input: ImagineInput): Promise<string> {
  return new Promise((promiseResolve, promiseReject) => {
    if (input.signal?.aborted) {
      promiseReject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const imagineDir = resolveSkillDir('imagine')
    if (!imagineDir) {
      promiseReject(new Error('baoyu-imagine skill directory not found'))
      return
    }
    const scriptPath = join(imagineDir, 'scripts', 'main.ts')
    if (!existsSync(scriptPath)) {
      promiseReject(new Error('baoyu-imagine script not found'))
      return
    }

    const settings = readSettings()
    const outputDir = resolve(
      (input.output_dir || settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever')
    )
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const ts = Date.now()
    const safeFile = input.output_file ? basename(input.output_file).replace(/[^a-zA-Z0-9._-]/g, '-') : `image-${ts}.png`
    const outFile = join(outputDir, safeFile.endsWith('.png') ? safeFile : `${safeFile}.png`)

    const backend = input.backend || settings.IMAGE_BACKEND || 'auto'
    const args: string[] = ['run', scriptPath, '--prompt', input.prompt, '--image', outFile, '--json']
    if (input.aspect_ratio) args.push('--ar', input.aspect_ratio)
    if (backend && backend !== 'auto') args.push('--provider', backend)

    const proc = spawn('bun', args, {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'] as const,
      env: { ...process.env, ...settings },
    }) as ChildProcess

    let stdout = ''
    let stderr = ''

    proc.stdout!.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr!.on('data', (d: Buffer) => { stderr += d.toString() })

    const abort = () => {
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
      }, 1500)
      promiseReject(new DOMException('Aborted', 'AbortError'))
    }

    input.signal?.addEventListener('abort', abort, { once: true })

    proc.on('close', (code) => {
      input.signal?.removeEventListener('abort', abort)
      if (input.signal?.aborted) return
      if (code === 0) {
        if (existsSync(outFile)) {
          promiseResolve(outFile)
        } else {
          try {
            const parsed = JSON.parse(stdout)
            const imgPath = parsed.image || parsed.output || parsed.path || outFile
            promiseResolve(existsSync(imgPath) ? imgPath : outFile)
          } catch {
            promiseResolve(outFile)
          }
        }
      } else {
        promiseReject(new Error(stderr || stdout || `baoyu-imagine exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      input.signal?.removeEventListener('abort', abort)
      promiseReject(err)
    })
  })
}

function friendlyImageError(error: string): string {
  if (error.includes('Throttling.RateQuota') || error.includes('DashScope API error (429)')) {
    return [
      'DashScope 图片生成遇到速率限制（429 Throttling.RateQuota）。',
      '可以稍后重试，或到 Settings 把 IMAGE_BACKEND 改成 openai、google、openrouter、replicate 等已配置的供应商。',
      '',
      error,
    ].join('\n')
  }
  return error
}

interface GenerateOptions {
  skillId: string
  content: string
  selections: Record<string, string>
  prebuiltPlan?: ProjectPlan
  onText?: (text: string) => Promise<void> | void
  onToolUse?: (name: string, input: Record<string, unknown>) => Promise<void> | void
  onToolResult?: (result: string) => Promise<void> | void
  onImage?: (path: string) => Promise<void> | void
  onFile?: (path: string, kind: string) => Promise<void> | void
  onCaption?: (caption: string) => Promise<void> | void
  onProject?: (path: string) => Promise<void> | void
  onError?: (error: string) => Promise<void> | void
  onDone?: () => Promise<void> | void
  signal?: AbortSignal
}

export interface ProjectPrompt {
  fileName: string
  imageFileName: string
  markdown: string
  prompt: string
}

export interface ProjectPlan {
  title: string
  slug: string
  analysisMarkdown: string
  outlineMarkdown: string
  copyMarkdown: string
  prompts: ProjectPrompt[]
}

const categoryDirs: Record<string, string> = {
  'image-cards': 'image-cards',
  infographic: 'infographic',
  cover: 'cover-image',
  presentation: 'slide-deck',
  comic: 'comic',
  illustration: 'article-illustrator',
  diagram: 'diagram',
}

function slugify(value: string): string {
  const fallback = `project-${Date.now()}`
  return value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || fallback
}

function extractJson(text: string): ProjectPlan {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Claude did not return a project JSON plan')
  return JSON.parse(cleaned.slice(start, end + 1)) as ProjectPlan
}

function safeMarkdownName(name: string, fallback: string): string {
  const safe = basename(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '-')
  return safe.endsWith('.md') ? safe : `${safe}.md`
}

function safeImageName(name: string, fallback: string): string {
  const safe = basename(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '-')
  return safe.endsWith('.png') ? safe : `${safe}.png`
}

interface ProjectChatOptions {
  projectPath: string
  message: string
  target?: { type: string; index?: number }
  signal?: AbortSignal
  onPlan?: (plan: string) => Promise<void> | void
  onFile?: (path: string, kind: string) => Promise<void> | void
  onImage?: (path: string) => Promise<void> | void
  onError?: (error: string) => Promise<void> | void
  onDone?: () => Promise<void> | void
}

export async function streamProjectChat(opts: ProjectChatOptions): Promise<void> {
  const apiKey = readApiKey()
  if (!apiKey) { await opts.onError?.('ANTHROPIC_API_KEY not set'); return }
  if (opts.signal?.aborted) return

  const { projectPath, message, target } = opts
  const settings = readSettings()
  const model = readModel()
  const baseURL = readBaseUrl()

  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })

  const contextParts: string[] = []

  const analysisPath = join(projectPath, 'analysis.md')
  if (existsSync(analysisPath)) {
    const content = readFileSync(analysisPath, 'utf-8')
    contextParts.push(`## Analysis\n${content.slice(0, 3000)}`)
  }

  const outlinePath = join(projectPath, 'outline.md')
  if (existsSync(outlinePath)) {
    const content = readFileSync(outlinePath, 'utf-8')
    contextParts.push(`## Outline\n${content.slice(0, 3000)}`)
  }

  const copyPath = join(projectPath, 'copy.md')
  if (existsSync(copyPath)) {
    const content = readFileSync(copyPath, 'utf-8')
    contextParts.push(`## Copy\n${content.slice(0, 2000)}`)
  }

  const promptsDir = join(projectPath, 'prompts')
  const promptFiles = existsSync(promptsDir) && statSync(promptsDir).isDirectory()
    ? readdirSync(promptsDir).filter(n => n.endsWith('.md')).sort()
    : []

  if (target?.type === 'image' && typeof target.index === 'number' && target.index >= 0 && target.index < promptFiles.length) {
    const promptPath = join(promptsDir, promptFiles[target.index])
    const promptContent = readFileSync(promptPath, 'utf-8')
    contextParts.push(`## Target Prompt (${promptFiles[target.index]})\n${promptContent.slice(0, 4000)}`)
  } else {
    for (const pf of promptFiles.slice(0, 6)) {
      const pp = join(promptsDir, pf)
      const pc = readFileSync(pp, 'utf-8')
      contextParts.push(`## Prompt: ${pf}\n${pc.slice(0, 2000)}`)
    }
  }

  const imageFiles = existsSync(projectPath)
    ? readdirSync(projectPath).filter(n => /\.(png|jpe?g|webp|gif)$/i.test(n)).sort()
    : []

  const projectContext = contextParts.join('\n\n')

  const targetDesc = target?.type === 'image' && typeof target.index === 'number'
    ? `Target: image ${target.index + 1}${promptFiles[target.index] ? ` (${promptFiles[target.index]})` : ''}`
    : target?.type === 'text'
    ? 'Target: modify copy/text only'
    : 'Target: entire project'

  const userMessage = [
    'You are editing an existing project. Read the context below and respond to the modification request.',
    '',
    `## Modification Request`,
    message,
    '',
    targetDesc,
    '',
    `## Existing Images`,
    imageFiles.map((n, i) => `${i + 1}. ${n}`).join('\n'),
    '',
    `## Project Context`,
    projectContext,
    '',
    'Return a JSON modification plan:',
    '{',
    '  "plan": "Brief description of what will change",',
    '  "updatedPrompts": [{"index": 0, "markdown": "full updated prompt markdown", "prompt": "exact image gen prompt"}] (only for images being changed),',
    '  "updatedCopy": "updated copy text if applicable, or null"',
    '}',
    '',
    promptFiles.length > 0 ? `There are ${promptFiles.length} prompt files (indices 0-${promptFiles.length - 1}). Only include updatedPrompts for the ones that need regenerating.` : '',
    'If the request is about text/copy only, return an empty updatedPrompts array.',
  ].filter(Boolean).join('\n')

  const systemPrompt = [
    'You are a project editing assistant for a content generation Web UI.',
    'The user has already generated content and wants to modify it.',
    'Be precise about which images need regenerating — only include ones that truly need changes.',
    'Return only valid JSON. No markdown fences.',
  ].join('\n')

  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  }, { signal: opts.signal })

  if (opts.signal?.aborted) return

  const planText = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')

  const cleaned = planText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    await opts.onError?.('Failed to parse modification plan')
    return
  }

  const plan: { plan: string; updatedPrompts?: Array<{ index: number; markdown: string; prompt: string }>; updatedCopy?: string | null } = JSON.parse(cleaned.slice(start, end + 1))

  await opts.onPlan?.(plan.plan || 'Modifying project...')

  if (plan.updatedCopy) {
    const copyFilePath = join(projectPath, 'copy.md')
    writeFileSync(copyFilePath, plan.updatedCopy, 'utf-8')
    await opts.onFile?.(copyFilePath, 'copy')
  }

  const updatedPrompts = plan.updatedPrompts || []

  for (const up of updatedPrompts) {
    if (opts.signal?.aborted) return
    const idx = up.index
    if (idx < 0 || idx >= promptFiles.length) continue
    const promptPath = join(promptsDir, promptFiles[idx])
    writeFileSync(promptPath, up.markdown, 'utf-8')
    await opts.onFile?.(promptPath, 'prompt')

    const imageBase = promptFiles[idx].replace(/\.md$/, '')
    const existingVersions: string[] = []
    if (existsSync(projectPath)) {
      for (const n of readdirSync(projectPath)) {
        if (/\.(png|jpe?g|webp|gif)$/i.test(n)) {
          const fileBase = n.replace(/\.(png|jpe?g|webp|gif)$/i, '')
          if (fileBase === imageBase || fileBase.startsWith(imageBase.replace(/\.v\d+$/, '') + '.v')) {
            existingVersions.push(n)
          }
        }
      }
    }
    const versionSuffix = existingVersions.length > 0 ? `.v${existingVersions.length + 1}` : ''
    const outputFile = `${imageBase}${versionSuffix}.png`

    try {
      const imagePath = await executeImagine({
        prompt: up.prompt,
        aspect_ratio: '1:1',
        output_dir: projectPath,
        output_file: outputFile,
        signal: opts.signal,
      })
      await opts.onImage?.(imagePath)
    } catch (err: any) {
      await opts.onError?.(`Image generation failed: ${friendlyImageError(err.message || String(err))}`)
    }
  }

  await opts.onDone?.()
}

export async function generatePlan(opts: { skillId: string; content: string; selections: Record<string, string> }): Promise<ProjectPlan> {
  const apiKey = readApiKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const { getSkill } = await import('./data/index')
  const skill = getSkill(opts.skillId)
  if (!skill) throw new Error(`Unknown skill: ${opts.skillId}`)

  const skillMd = readSkillMd(opts.skillId)
  const systemParts: string[] = []

  if (skillMd) systemParts.push(skillMd)

  const usePreferences = opts.selections.usePreferences !== 'false'
  const preferences = usePreferences ? getPreferenceInfo(opts.skillId) : null
  if (preferences?.found && preferences.raw.trim()) {
    systemParts.push([
      `Saved user preferences from ${preferences.path}:`,
      preferences.raw.slice(0, 8000),
      'Treat these preferences as defaults. Explicit Web UI parameters in this run override saved preferences.',
    ].join('\n'))
  }
  systemParts.push(
    'You are an automated baoyu skills project planner for a Web UI.',
    'Return only the project plan. Images will be generated separately by a different step.',
    'Return only valid JSON. No markdown fences.',
  )

  const settings = readSettings()
  const model = readModel()
  const baseURL = readBaseUrl()

  const requestedCount = Math.max(1, Math.min(10, Number(opts.selections.imageCount || opts.selections.count || 4) || 4))
  const aspectRatio = opts.selections.aspectRatio || opts.selections.aspect || settings.DEFAULT_ASPECT_RATIO || skill?.defaultAspectRatio || '1:1'

  const userMessage = [
    `Generate content using the ${opts.skillId} skill.`,
    `Content: """${opts.content.slice(0, 4000)}"""`,
    `Requested image count: ${requestedCount}`,
    `Aspect ratio: ${aspectRatio}`,
    `Language: ${settings.DEFAULT_LANGUAGE || 'zh'}`,
    '',
    'Return this exact JSON shape:',
    '{',
    '  "title": "short project title",',
    '  "slug": "kebab-case-ascii-or-pinyin-project-slug",',
    '  "analysisMarkdown": "full markdown analysis with YAML frontmatter when useful",',
    '  "outlineMarkdown": "full markdown outline with page-by-page plan",',
    '  "copyMarkdown": "ready-to-edit publishing copy for the likely platform",',
    '  "prompts": [',
    '    { "fileName": "01-cover-topic.md", "imageFileName": "01-cover-topic.png", "markdown": "full prompt markdown with frontmatter and visible text rules", "prompt": "the exact image generation prompt text" }',
    '  ]',
    '}',
    `Create exactly ${requestedCount} prompt objects unless the skill strongly requires fewer.`,
  ].join('\n')

  const client = new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })

  const planMessage = await client.messages.create({
    model,
    max_tokens: 20000,
    system: systemParts.join('\n\n'),
    messages: [{ role: 'user', content: userMessage }],
  })

  const planText = planMessage.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')

  return extractJson(planText)
}

export async function streamGenerate(opts: GenerateOptions): Promise<void> {
  const apiKey = readApiKey()
  if (opts.signal?.aborted) {
    await opts.onDone?.()
    return
  }
  if (!apiKey) {
    await opts.onError?.('ANTHROPIC_API_KEY not set. Please configure it in Settings.')
    return
  }

  const skillMd = readSkillMd(opts.skillId)
  const systemParts: string[] = []

  if (skillMd) {
    systemParts.push(skillMd)
  }
  const usePreferences = opts.selections.usePreferences !== 'false'
  const preferences = usePreferences ? getPreferenceInfo(opts.skillId) : null
  if (preferences?.found && preferences.raw.trim()) {
    systemParts.push([
      `Saved user preferences from ${preferences.path}:`,
      preferences.raw.slice(0, 8000),
      'Treat these preferences as defaults. Explicit Web UI parameters in this run override saved preferences.',
    ].join('\n'))
  }
  systemParts.push(
    'You are an automated baoyu skills project runner in a Web UI.',
    'The user has already selected parameters in the UI, so do not ask follow-up questions.',
    'Create project artifacts first, then the server will generate images from the prompt files.',
  )

  const settings = readSettings()
  const { getSkill } = await import('./data/index')
  const skill = getSkill(opts.skillId)
  if (!skill) {
    await opts.onError?.(`Unknown skill: ${opts.skillId}`)
    return
  }

  const userMessage = [
    `Generate content using the ${opts.skillId} skill.`,
    `Content: """${opts.content.slice(0, 4000)}"""`,
  ]

  if (Object.keys(opts.selections).length > 0) {
    const selParts = Object.entries(opts.selections)
      .filter(([k]) => k !== 'usePreferences')
      .map(([k, v]) => `${k}: ${v}`)
    userMessage.push(`Parameters: ${selParts.join(', ')}`)
  }

  userMessage.push(`Language: ${settings.DEFAULT_LANGUAGE || 'zh'}`)

  const baseURL = readBaseUrl()
  const model = readModel()

  const client = new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })

  const requestedCount = Math.max(1, Math.min(10, Number(opts.selections.imageCount || opts.selections.count || 4) || 4))
  const aspectRatio = opts.selections.aspectRatio || opts.selections.aspect || settings.DEFAULT_ASPECT_RATIO || skill?.defaultAspectRatio || '1:1'
  const styleSummary = Object.entries(opts.selections)
    .filter(([key]) => !['aspectRatio', 'aspect', 'language', 'imageCount', 'count', 'backend', 'usePreferences'].includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

  await opts.onText?.('分析内容，生成项目文档...\n')
  if (opts.signal?.aborted) {
    await opts.onDone?.()
    return
  }

  let plan: ProjectPlan

  if (opts.prebuiltPlan) {
    plan = opts.prebuiltPlan
    await opts.onText?.('使用已确认的计划...\n')
  } else {
    const planMessage = await client.messages.create({
      model,
      max_tokens: 20000,
      system: [
        systemParts.join('\n\n'),
        'You are running a baoyu-skill project workflow for a Web UI.',
        'You must produce the same kinds of project artifacts that baoyu skills create: source markdown, analysis.md, outline.md, prompts/NN-*.md, copy.md, and images.',
        'Return only valid JSON. No markdown fences.',
      ].join('\n\n'),
      messages: [{
        role: 'user',
        content: [
          ...userMessage,
          '',
          `Requested image count: ${requestedCount}`,
          `Aspect ratio: ${aspectRatio}`,
          styleSummary ? `Selected visual parameters: ${styleSummary}` : '',
          '',
          'Return this exact JSON shape:',
          '{',
          '  "title": "short project title",',
          '  "slug": "kebab-case-ascii-or-pinyin-project-slug",',
          '  "analysisMarkdown": "full markdown analysis with YAML frontmatter when useful",',
          '  "outlineMarkdown": "full markdown outline with page-by-page plan",',
          '  "copyMarkdown": "ready-to-edit publishing copy for the likely platform, including title/body/hashtags where appropriate",',
          '  "prompts": [',
          '    { "fileName": "01-cover-topic.md", "imageFileName": "01-cover-topic.png", "markdown": "full prompt markdown with frontmatter and visible text rules", "prompt": "the exact image generation prompt text" }',
          '  ]',
          '}',
          '',
          `Create exactly ${requestedCount} prompt objects unless the skill strongly requires fewer.`,
        ].filter(Boolean).join('\n'),
      }],
    })

    const planText = planMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
    plan = extractJson(planText)
  }

  try {
    const outputRoot = resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
    const categoryDir = categoryDirs[skill?.category || ''] || opts.skillId
    const projectSlug = slugify(plan.slug || plan.title || opts.skillId)
    const projectDir = join(outputRoot, categoryDir, projectSlug)
    const promptsDir = join(projectDir, 'prompts')
    mkdirSync(promptsDir, { recursive: true })

    await opts.onProject?.(projectDir)
    await opts.onText?.(`项目目录: ${projectDir}\n`)

    const sourcePath = join(projectDir, `source-${projectSlug}.md`)
    writeFileSync(sourcePath, opts.content, 'utf-8')
    await opts.onFile?.(sourcePath, 'source')

    const analysisPath = join(projectDir, 'analysis.md')
    writeFileSync(analysisPath, plan.analysisMarkdown || '', 'utf-8')
    await opts.onFile?.(analysisPath, 'analysis')

    const outlinePath = join(projectDir, 'outline.md')
    writeFileSync(outlinePath, plan.outlineMarkdown || '', 'utf-8')
    await opts.onFile?.(outlinePath, 'outline')

    if (plan.copyMarkdown) {
      const copyPath = join(projectDir, 'copy.md')
      writeFileSync(copyPath, plan.copyMarkdown, 'utf-8')
      await opts.onFile?.(copyPath, 'copy')
      await opts.onCaption?.(plan.copyMarkdown)
    }

    const prompts = (plan.prompts || []).slice(0, requestedCount)
    for (let i = 0; i < prompts.length; i++) {
      if (opts.signal?.aborted) {
        await opts.onDone?.()
        return
      }
      const prompt = prompts[i]
      const promptName = safeMarkdownName(prompt.fileName, `${String(i + 1).padStart(2, '0')}-prompt.md`)
      const imageName = safeImageName(prompt.imageFileName, `${String(i + 1).padStart(2, '0')}-image.png`)
      const promptPath = join(promptsDir, promptName)
      writeFileSync(promptPath, prompt.markdown || prompt.prompt, 'utf-8')
      await opts.onFile?.(promptPath, 'prompt')
      await opts.onText?.(`生成图片 ${i + 1}/${prompts.length}: ${imageName}\n`)

      try {
        const imagePath = await executeImagine({
          prompt: prompt.prompt || prompt.markdown,
          aspect_ratio: aspectRatio,
          backend: opts.selections.backend || settings.IMAGE_BACKEND || 'auto',
          output_dir: projectDir,
          output_file: imageName,
          signal: opts.signal,
        })
        await opts.onImage?.(imagePath)
      } catch (err: any) {
        await opts.onError?.(`Image generation failed: ${friendlyImageError(err.message || String(err))}`)
      }
    }

    await opts.onDone?.()
  } catch (err: any) {
    if (err.name === 'AbortError' || opts.signal?.aborted) {
      await opts.onDone?.()
      return
    }
    await opts.onError?.(err.message || String(err))
  }
}
