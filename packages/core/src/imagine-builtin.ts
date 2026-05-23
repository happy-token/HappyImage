import { existsSync, mkdirSync } from 'fs'
import { resolve, join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { readSettings, PROJECT_ROOT } from './settings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Path to the vendored baoyu-imagine scripts (copied from ~/.baoyu-skills/baoyu-imagine/scripts)
const VENDOR_DIR = resolve(__dirname, '..', 'vendor', 'baoyu-imagine')
const VENDOR_MAIN = join(VENDOR_DIR, 'main.ts')

export interface BuiltinImagineInput {
  prompt: string
  aspect_ratio?: string
  backend?: string
  output_dir?: string
  output_file?: string
  signal?: AbortSignal
}

export function isVendorAvailable(): boolean {
  return existsSync(VENDOR_MAIN)
}

/**
 * Check which image backend API keys are configured.
 */
export function detectAvailableBackend(settings: Record<string, string>): string {
  const env = process.env
  if (settings.DASHSCOPE_API_KEY || env.DASHSCOPE_API_KEY) return 'dashscope'
  if (settings.OPENAI_API_KEY || env.OPENAI_API_KEY) return 'openai'
  if (settings.GOOGLE_API_KEY || settings.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GEMINI_API_KEY) return 'google'
  if (settings.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY) return 'openrouter'
  if (settings.ZAI_API_KEY || settings.BIGMODEL_API_KEY || env.ZAI_API_KEY || env.BIGMODEL_API_KEY) return 'zai'
  if (settings.MINIMAX_API_KEY || env.MINIMAX_API_KEY) return 'minimax'
  if (settings.REPLICATE_API_TOKEN || env.REPLICATE_API_TOKEN) return 'replicate'
  if (settings.ARK_API_KEY || env.ARK_API_KEY) return 'seedream'
  if ((settings.JIMENG_ACCESS_KEY_ID || env.JIMENG_ACCESS_KEY_ID) &&
      (settings.JIMENG_SECRET_ACCESS_KEY || env.JIMENG_SECRET_ACCESS_KEY)) return 'jimeng'
  if (settings.AZURE_OPENAI_API_KEY || env.AZURE_OPENAI_API_KEY) return 'azure'
  return 'none'
}

/**
 * Run the vendored baoyu-imagine script via bun subprocess.
 * Unlike the external-skill path, this uses the vendor scripts bundled with HappyImage,
 * so it does NOT require an external baoyu-skills installation.
 */
export function executeImagineVendored(input: BuiltinImagineInput): Promise<string> {
  return new Promise((promiseResolve, reject) => {
    if (input.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    if (!isVendorAvailable()) {
      reject(new Error('Vendored baoyu-imagine not found at ' + VENDOR_MAIN))
      return
    }

    const settings = readSettings()
    const outputDir = resolve(
      (input.output_dir || settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever')
    )
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const ts = Date.now()
    const safeFile = input.output_file
      ? basename(input.output_file).replace(/[^a-zA-Z0-9._-]/g, '-')
      : `image-${ts}.png`
    const outFile = join(outputDir, safeFile.endsWith('.png') ? safeFile : `${safeFile}.png`)

    const backend = input.backend || settings.IMAGE_BACKEND || 'auto'
    const args = ['run', VENDOR_MAIN, '--prompt', input.prompt, '--image', outFile, '--json']
    if (input.aspect_ratio) args.push('--ar', input.aspect_ratio)
    if (backend && backend !== 'auto') args.push('--provider', backend)

    const bunPath = findBunExecutable()

    const proc = spawn(bunPath, args, {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'] as const,
      env: { ...process.env, ...settings },
    })

    let stdout = ''
    let stderr = ''
    proc.stdout!.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr!.on('data', (d: Buffer) => { stderr += d.toString() })

    const abort = () => {
      proc.kill('SIGTERM')
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL') }, 1500)
      reject(new DOMException('Aborted', 'AbortError'))
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
        reject(new Error(stderr || stdout || `baoyu-imagine exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      input.signal?.removeEventListener('abort', abort)
      reject(err)
    })
  })
}


/**
 * Find the bun executable path, checking common install locations.
 */
export function findBunExecutable(): string {
  const home = process.env.HOME || '/Users/forever'
  const candidates = [
    process.execPath, // If running under bun, this IS bun
    `${home}/.bun/bin/bun`,
    '/usr/local/bin/bun',
    '/opt/homebrew/bin/bun',
    'bun', // fallback to PATH lookup
  ]

  // If running under bun, process.execPath is bun itself
  if (process.versions?.bun) return process.execPath

  for (const p of candidates.slice(1)) {
    if (p === 'bun') return 'bun' // fallback
    if (existsSync(p)) return p
  }
  return 'bun'
}

/**
 * Check whether the image generation environment is functional.
 * Returns detailed status.
 */
export function checkImagineEnvironment(): {
  vendorAvailable: boolean
  bunAvailable: boolean
  backendAvailable: boolean
  backend: string
  issues: string[]
} {
  const settings = readSettings()
  const vendorAvailable = isVendorAvailable()
  const bunAvailable = (() => {
    if (process.versions?.bun) return true
    const home = process.env.HOME || '/Users/forever'
    return existsSync(`${home}/.bun/bin/bun`) || existsSync('/usr/local/bin/bun') || existsSync('/opt/homebrew/bin/bun')
  })()
  const backend = detectAvailableBackend(settings)
  const backendAvailable = backend !== 'none'
  const issues: string[] = []
  if (!vendorAvailable) issues.push('内置 baoyu-imagine 不可用')
  if (!bunAvailable) issues.push('未找到 bun 运行时')
  if (!backendAvailable) issues.push('未配置任何图片生成 API Key')
  return { vendorAvailable, bunAvailable, backendAvailable, backend, issues }
}
