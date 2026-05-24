import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, basename } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { readApiKey, readBaseUrl, readModel, readSettings, PROJECT_ROOT } from './settings.js'
import { getPreferenceInfo } from './preferences.js'
import { resolveSkillDir } from './skills-root.js'
import { isVendorAvailable, executeImagineVendored, findBunExecutable } from './imagine-builtin.js'

function parseYamlFrontMatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()
    if (key && val) result[key] = val
  }
  return result
}

export function extractPromptFromMarkdown(markdown: string): string {
  if (!markdown) return ''

  // 1. Try matching code block
  const codeBlockMatch = markdown.match(/```[\s\S]*?\n([\s\S]*?)```/)
  if (codeBlockMatch && codeBlockMatch[1].trim()) {
    return codeBlockMatch[1].trim()
  }

  // 2. Try matching front-matter prompt: key
  const frontMatterMatch = markdown.match(/^prompt:\s*(.+)/im)
  if (frontMatterMatch && frontMatterMatch[1].trim()) {
    return frontMatterMatch[1].trim()
  }

  // 3. Try matching everything after "# Prompt" or "# prompt" or "# PROMPT"
  const promptHeaderMatch = markdown.match(/#+\s+Prompt\b([\s\S]*)/i)
  if (promptHeaderMatch && promptHeaderMatch[1].trim()) {
    return promptHeaderMatch[1].trim()
  }

  // 4. Fallback: if there is front-matter, strip it and return the rest
  let cleaned = markdown.replace(/^---[\s\S]*?---\n/, '').trim()
  if (cleaned.startsWith('#')) {
    // If it starts with headers, strip the first header
    cleaned = cleaned.replace(/^#+.*?\n/, '').trim()
  }
  return cleaned || markdown
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
      // Match the section heading and everything up to the next ## heading (but not ### sub-headings)
      const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`## ${escaped}[\\s\\S]*?(?=\\n## |$)`, 'i')
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

export async function executeImagine(input: ImagineInput): Promise<string> {
  // 1. Try vendored built-in implementation (no external skills root required)
  if (isVendorAvailable()) {
    return executeImagineVendored(input)
  }

  // 2. Fallback: try external baoyu-imagine skill directory
  return executeImagineExternal(input)
}

function executeImagineExternal(input: ImagineInput): Promise<string> {
  return new Promise((promiseResolve, promiseReject) => {
    if (input.signal?.aborted) {
      promiseReject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const imagineDir = resolveSkillDir('imagine')
    if (!imagineDir) {
      promiseReject(new Error('baoyu-imagine 未找到。请安装 baoyu-skills 或检查 BAOYU_SKILLS_ROOT 配置。'))
      return
    }
    const scriptPath = join(imagineDir, 'scripts', 'main.ts')
    if (!existsSync(scriptPath)) {
      promiseReject(new Error('baoyu-imagine script not found at: ' + scriptPath))
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

    const bunExec = findBunExecutable()
    const proc = spawn(bunExec, args, {
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
            const imgPath = parsed.savedImage || parsed.image || parsed.output || parsed.path || outFile
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

export function friendlyImageError(error: string): string {
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

function isRateLimitError(error: string) {
  return error.includes('Throttling.RateQuota')
    || error.includes('DashScope API error (429)')
    || error.includes('Requests rate limit exceeded')
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolveSleep, rejectSleep) => {
    if (signal?.aborted) {
      rejectSleep(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolveSleep, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      rejectSleep(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

export async function executeImagineWithRateLimitRetry(
  input: ImagineInput,
  onText?: (text: string) => Promise<void> | void,
  onRetry?: (retry: { attempt: number; delayMs: number; provider?: string; reason: string }) => Promise<void> | void,
) {
  const delays = [5000, 10000, 60000]
  let lastError = ''

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      if (attempt > 0) await onText?.(`重试生图 ${attempt}/${delays.length}...\n`)
      return await executeImagine(input)
    } catch (err: any) {
      const message = err.message || String(err)
      lastError = message
      if (!isRateLimitError(message) || attempt >= delays.length) throw err

      const delay = delays[attempt]
      await onRetry?.({ attempt: attempt + 1, delayMs: delay, provider: input.backend || 'auto', reason: message })
      await onText?.(`生图服务限流，${Math.round(delay / 1000)} 秒后重试 ${attempt + 1}/${delays.length}。\n`)
      await sleep(delay, input.signal)
    }
  }

  throw new Error(lastError || 'Image generation failed')
}

interface GenerateOptions {
  skillId: string
  content: string
  selections: Record<string, string>
  prebuiltPlan?: ProjectPlan
  onText?: (text: string) => Promise<void> | void
  onToolUse?: (name: string, input: Record<string, unknown>) => Promise<void> | void
  onRetry?: (retry: { attempt: number; delayMs: number; provider?: string; reason: string }) => Promise<void> | void
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
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as ProjectPlan
  } catch {
    throw new Error('Claude returned an invalid project plan. Please try again.')
  }
}

function safeMarkdownName(name: string, fallback: string): string {
  const safe = basename(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '-')
  return safe.endsWith('.md') ? safe : `${safe}.md`
}

function safeImageName(name: string, fallback: string): string {
  const safe = basename(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '-')
  return safe.endsWith('.png') ? safe : `${safe}.png`
}

export function applyWatermark(prompt: string, preferences: { found: boolean; values: Record<string, unknown> } | null): string {
  if (!preferences?.found) return prompt
  const wm = preferences.values.watermark as Record<string, unknown> | undefined
  if (!wm || !wm.enabled) return prompt
  const content = ((wm.content as string) || '').trim()
  if (!content) return prompt
  const position = (wm.position as string) || 'bottom-right'
  const opacity = typeof wm.opacity === 'number' ? wm.opacity : 0.7
  return `${prompt}\n\nWatermark requirement: Add a subtle text watermark "${content}" at ${position} with ${Math.round(opacity * 100)}% opacity.`
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

  const metadataPath = join(opts.projectPath, 'metadata.json')
  let projectPreferences = null
  let skillId = ''
  if (existsSync(metadataPath)) {
    try {
      const meta = JSON.parse(readFileSync(metadataPath, 'utf-8'))
      skillId = meta.skillId || ''
      if (meta.skillId) projectPreferences = getPreferenceInfo(meta.skillId)
    } catch { /* ignore */ }
  }
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

  const systemParts: string[] = [
    'You are a project editing assistant for a content generation Web UI.',
    'The user has already generated content and wants to modify it.',
    'Be precise about which images need regenerating — only include ones that truly need changes.',
    'When generating "updatedPrompts", you MUST base the updated prompt and markdown on the existing "Target Prompt" or original prompt content, and update it incrementally on top of the original text to incorporate the user\'s modification request. Do NOT rewrite the prompt from scratch or discard existing style definitions, page outline context, or structure unless explicitly requested.',
    'Return only valid JSON. No markdown fences.',
  ]

  if (skillId) {
    const skillMd = readSkillMd(skillId)
    if (skillMd) {
      systemParts.push(`Here are the rules and documentation for the skill being used (${skillId}):\n\n${skillMd}`)
    }
  }

  if (projectPreferences?.found && projectPreferences.raw.trim()) {
    systemParts.push([
      `Saved user preferences from ${projectPreferences.path}:`,
      projectPreferences.raw.slice(0, 8000),
      'Ensure modifications respect these preferences and constraints.',
    ].join('\n'))
  }

  const systemPrompt = systemParts.join('\n\n')

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

    // Parse the aspect ratio from the updated prompt front-matter
    const fm = parseYamlFrontMatter(up.markdown || '')
    let promptAspectRatio = fm.aspectRatio || fm.aspect_ratio || ''

    // If not in the updated prompt, check the existing prompt file
    if (!promptAspectRatio && existsSync(promptPath)) {
      try {
        const existingContent = readFileSync(promptPath, 'utf-8')
        const existingFm = parseYamlFrontMatter(existingContent)
        promptAspectRatio = existingFm.aspectRatio || existingFm.aspect_ratio || ''
      } catch (err) {
        // Ignore
      }
    }

    // If still not found, check analysis.md front-matter
    if (!promptAspectRatio) {
      const analysisFilePath = join(projectPath, 'analysis.md')
      if (existsSync(analysisFilePath)) {
        try {
          const analysisContent = readFileSync(analysisFilePath, 'utf-8')
          const analysisFm = parseYamlFrontMatter(analysisContent)
          promptAspectRatio = analysisFm.aspectRatio || analysisFm.aspect_ratio || ''
        } catch (err) {
          // Ignore
        }
      }
    }

    // Fall back to default '1:1' if none found
    if (!promptAspectRatio) {
      promptAspectRatio = '1:1'
    }

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
      const promptToUse = up.prompt?.trim() || extractPromptFromMarkdown(up.markdown)
      const imagePath = await executeImagineWithRateLimitRetry({
        prompt: applyWatermark(promptToUse, projectPreferences),
        aspect_ratio: promptAspectRatio,
        backend: (projectPreferences?.values?.preferred_image_backend as string) || settings.IMAGE_BACKEND || 'auto',
        output_dir: projectPath,
        output_file: outputFile,
        signal: opts.signal,
      }, opts.onPlan)
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
  const selectedParameters = Object.entries(opts.selections)
    .filter(([key]) => !['usePreferences', 'imageCount', 'count'].includes(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

  const userMessage = [
    `Generate content using the ${opts.skillId} skill.`,
    `Content: """${opts.content.slice(0, 4000)}"""`,
    `Requested image count: ${requestedCount}`,
    `Aspect ratio: ${aspectRatio}`,
    `Language: ${opts.selections.language || settings.DEFAULT_LANGUAGE || 'zh'}`,
    selectedParameters ? `Selected Web UI parameters: ${selectedParameters}` : '',
    selectedParameters ? 'Respect these selected parameters exactly unless they conflict with safety or platform constraints.' : '',
    selectedParameters ? 'Do not replace selected style, layout, palette, language, aspectRatio, or imageCount with defaults. Every outline page and every prompt frontmatter must keep the selected values.' : '',
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

  const planSystem = systemParts.join('\n\n')
  const planMessage = await client.messages.create({
    model,
    max_tokens: 20000,
    system: planSystem,
    messages: [{ role: 'user', content: userMessage }],
  })

  const planText = planMessage.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')

  try {
    return extractJson(planText)
  } catch {
    const retryMessage = await client.messages.create({
      model,
      max_tokens: 20000,
      system: planSystem + '\nCRITICAL: You MUST return ONLY valid RFC 8259 JSON. Every string value must be enclosed in double quotes. No unquoted values, no trailing commas, no comments.',
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' },
      ],
    })
    const retryText = '{' + retryMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
    return extractJson(retryText)
  }
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

  userMessage.push(`Language: ${opts.selections.language || settings.DEFAULT_LANGUAGE || 'zh'}`)

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
    const streamPlanSystem = [
      systemParts.join('\n\n'),
      'You are running a baoyu-skill project workflow for a Web UI.',
      'You must produce the same kinds of project artifacts that baoyu skills create: source markdown, analysis.md, outline.md, prompts/NN-*.md, copy.md, and images.',
      'Return only valid JSON. No markdown fences.',
    ].join('\n\n')
    const streamPlanUserContent = [
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
    ].filter(Boolean).join('\n')
    const planMessage = await client.messages.create({
      model,
      max_tokens: 20000,
      system: streamPlanSystem,
      messages: [{ role: 'user', content: streamPlanUserContent }],
    })

    const planText = planMessage.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
    try {
      plan = extractJson(planText)
    } catch {
      const retryMessage = await client.messages.create({
        model,
        max_tokens: 20000,
        system: streamPlanSystem + '\nCRITICAL: You MUST return ONLY valid RFC 8259 JSON. Every string value must be enclosed in double quotes. No unquoted values, no trailing commas, no comments.',
        messages: [
          { role: 'user', content: streamPlanUserContent },
          { role: 'assistant', content: '{' },
        ],
      })
      const retryText = '{' + retryMessage.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
      plan = extractJson(retryText)
    }
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

    writeFileSync(join(projectDir, 'metadata.json'), JSON.stringify({ skillId: opts.skillId }), 'utf-8')

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
        const imagePath = await executeImagineWithRateLimitRetry({
          prompt: applyWatermark(prompt.prompt || prompt.markdown, preferences),
          aspect_ratio: aspectRatio,
          backend: opts.selections.backend || settings.IMAGE_BACKEND || 'auto',
          output_dir: projectDir,
          output_file: imageName,
          signal: opts.signal,
        }, opts.onText, opts.onRetry)
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
