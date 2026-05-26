import { spawn } from 'child_process'
import { delimiter, join, resolve } from 'path'
import { existsSync } from 'fs'
import { PROJECT_ROOT, readSettings } from './settings.js'

export interface ClaudeSession {
  id: string
  status: 'running' | 'done' | 'error'
  images: string[]
  output: string
  error?: string
}

const sessions = new Map<string, ClaudeSession>()

export function createSession(): ClaudeSession {
  const id = crypto.randomUUID()
  const s: ClaudeSession = { id, status: 'running', images: [], output: '' }
  sessions.set(id, s)
  return s
}

export function getSession(id: string): ClaudeSession | undefined {
  return sessions.get(id)
}

function findImagesInOutput(output: string): string[] {
  const found = new Set<string>()
  const lines = output.split('\n')
  for (const line of lines) {
    const m = line.match(/(\S+\.png)/g)
    if (!m) continue
    for (const p of m) {
      const cleaned = p.replace(/[`|*'"()]/g, '').trim()
      if (!cleaned.endsWith('.png') || cleaned.length < 5) continue
      const abs = resolve(PROJECT_ROOT, cleaned)
      if (existsSync(abs)) found.add(abs)
    }
  }
  return [...found]
}

function augmentedPath(): string {
  const home = process.env.HOME || ''
  return [
    process.env.PATH || '',
    home ? join(home, '.local', 'bin') : '',
    home ? join(home, '.bun', 'bin') : '',
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter(Boolean).join(delimiter)
}

function resolveClaudeCommand(): string {
  const configured = readSettings().CLAUDE_CODE_COMMAND || process.env.CLAUDE_CODE_COMMAND || ''
  if (configured) return configured
  const home = process.env.HOME || ''
  const candidates = [
    home ? join(home, '.local', 'bin', 'claude') : '',
    home ? join(home, '.bun', 'bin', 'claude') : '',
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ].filter(Boolean)
  return candidates.find(candidate => existsSync(candidate)) || 'claude'
}

export function runSkill(
  session: ClaudeSession,
  skillId: string,
  content: string,
  flags: Record<string, string>
): void {
  const flagStr = Object.entries(flags).map(([k, v]) => `--${k} ${v}`).join(' ')

  const prompt = [
    `请执行 baoyu-${skillId} 技能。`,
    `内容："""${content.slice(0, 2000)}"""`,
    flagStr ? `参数：${flagStr}` : '',
    '不要交互确认，直接分析内容、写prompt、生成图片。',
  ].filter(Boolean).join('\n')

  const proc = spawn(resolveClaudeCommand(), ['-p', prompt], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: augmentedPath(), NO_COLOR: '1' },
  })

  proc.stdout?.on('data', (d: Buffer) => { session.output += d.toString() })
  proc.stderr?.on('data', (d: Buffer) => { session.output += d.toString() })

  proc.on('close', () => {
    const images = findImagesInOutput(session.output)
    if (images.length > 0) {
      session.status = 'done'
      session.images = images
    } else {
      session.status = 'error'
      session.error = session.output.slice(-1000) || 'No output from Claude Code'
    }
  })

  proc.on('error', (err) => {
    session.status = 'error'
    session.error = err.message
  })
}
