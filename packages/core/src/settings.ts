import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { getSettingsDb, readAllSettings, writeSettingToDb } from './settings-db.js'

// In dev:  packages/core/dist → 3 levels up = project root
// In app:  Resources/node_modules/@happytokenai/happyimage-core/dist → 4 levels up = Resources
let PROJECT_ROOT = resolve(import.meta.dirname, '..', '..', '..')
const IS_DEV = existsSync(join(PROJECT_ROOT, '.git'))
if (!IS_DEV) {
  const alt = resolve(import.meta.dirname, '..', '..', '..', '..')
  if (existsSync(join(alt, 'skills')) || existsSync(join(alt, 'cli'))) {
    PROJECT_ROOT = alt
  }
}

export function resolveConfigRoot(): string {
  if (IS_DEV) return PROJECT_ROOT
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  switch (process.platform) {
    case 'win32': {
      const appData = process.env.APPDATA || join(process.env.USERPROFILE || home, 'AppData', 'Roaming')
      return join(appData, 'HappyImage')
    }
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'HappyImage')
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'happyimage')
  }
}

// Always resolves to the user's home-based config directory, ignoring IS_DEV.
export function resolveUserConfigRoot(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  switch (process.platform) {
    case 'win32': {
      const appData = process.env.APPDATA || join(process.env.USERPROFILE || home, 'AppData', 'Roaming')
      return join(appData, 'HappyImage')
    }
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'HappyImage')
    default:
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'happyimage')
  }
}

interface EnvMap {
  ANTHROPIC_API_KEY: string
  ANTHROPIC_BASE_URL: string
  ANTHROPIC_AUTH_TOKEN: string
  ANTHROPIC_MODEL: string
  OPENAI_API_KEY: string
  AZURE_OPENAI_API_KEY: string
  AZURE_OPENAI_ENDPOINT: string
  GOOGLE_API_KEY: string
  OPENROUTER_API_KEY: string
  DASHSCOPE_API_KEY: string
  REPLICATE_API_TOKEN: string
  ZAI_API_KEY: string
  BIGMODEL_API_KEY: string
  MINIMAX_API_KEY: string
  ARK_API_KEY: string
  JIMENG_ACCESS_KEY_ID: string
  JIMENG_SECRET_ACCESS_KEY: string
  CUSTOM_IMAGE_PROVIDER_NAME: string
  CUSTOM_EXECUTION_PROVIDER_NAME: string
  BAOYU_SKILLS_ROOT: string
  OUTPUT_DIR: string
  DEFAULT_LANGUAGE: string
  DEFAULT_ASPECT_RATIO: string
  DEFAULT_SKILL: string
  IMAGE_BACKEND: string
  SKIP_PLAN_CONFIRMATION: string
  [key: string]: string
}

export function readSettings(): EnvMap {
  const configRoot = resolveConfigRoot()
  const defaults: EnvMap = {
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_BASE_URL: '',
    ANTHROPIC_AUTH_TOKEN: '',
    ANTHROPIC_MODEL: '',
    OPENAI_API_KEY: '',
    AZURE_OPENAI_API_KEY: '',
    AZURE_OPENAI_ENDPOINT: '',
    GOOGLE_API_KEY: '',
    OPENROUTER_API_KEY: '',
    DASHSCOPE_API_KEY: '',
    REPLICATE_API_TOKEN: '',
    ZAI_API_KEY: '',
    BIGMODEL_API_KEY: '',
    MINIMAX_API_KEY: '',
    ARK_API_KEY: '',
    JIMENG_ACCESS_KEY_ID: '',
    JIMENG_SECRET_ACCESS_KEY: '',
    CUSTOM_IMAGE_PROVIDER_NAME: '',
    CUSTOM_EXECUTION_PROVIDER_NAME: '',
    BAOYU_SKILLS_ROOT: '',
    OUTPUT_DIR: '~/output/happyimage',
    DEFAULT_LANGUAGE: 'zh',
    DEFAULT_ASPECT_RATIO: '1:1',
    DEFAULT_SKILL: 'image-cards',
    IMAGE_BACKEND: 'auto',
    SKIP_PLAN_CONFIRMATION: 'false',
    THEME_MODE: 'dark',
    THEME_COLOR: 'indigo',
  }

  // Production: read from SQLite
  if (!IS_DEV) {
    try {
      const db = getSettingsDb(configRoot, PROJECT_ROOT)
      const dbSettings = readAllSettings(db)
      return { ...defaults, ...dbSettings }
    } catch {}
  }

  // Dev fallback: read from .env in config root or project root
  const envPath = join(configRoot, '.env')
  if (existsSync(envPath)) {
    const fileVars = parseEnv(readFileSync(envPath, 'utf-8'))
    return { ...defaults, ...fileVars }
  }

  const projectEnv = join(PROJECT_ROOT, '.env')
  if (existsSync(projectEnv)) {
    const fileVars = parseEnv(readFileSync(projectEnv, 'utf-8'))
    return { ...defaults, ...fileVars }
  }

  return defaults
}

function parseEnv(content: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

export function readApiKey(): string {
  const settings = readSettings()
  return settings.ANTHROPIC_API_KEY
    || settings.ANTHROPIC_AUTH_TOKEN
    || process.env.ANTHROPIC_AUTH_TOKEN
    || process.env.ANTHROPIC_API_KEY
    || ''
}

export function readBaseUrl(): string {
  const settings = readSettings()
  return settings.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL || ''
}

export function readModel(): string {
  const settings = readSettings()
  return settings.ANTHROPIC_MODEL
    || process.env.ANTHROPIC_MODEL
    || process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    || 'claude-sonnet-4-6'
}

export function readSettingsSanitized(): EnvMap {
  const settings = readSettings()
  const sanitized = { ...settings }
  const keys = [
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'OPENAI_API_KEY',
    'AZURE_OPENAI_API_KEY', 'GOOGLE_API_KEY', 'OPENROUTER_API_KEY',
    'DASHSCOPE_API_KEY', 'REPLICATE_API_TOKEN', 'ZAI_API_KEY',
    'BIGMODEL_API_KEY', 'MINIMAX_API_KEY', 'ARK_API_KEY',
    'JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY',
  ]
  for (const key of keys) {
    const val = sanitized[key]
    if (val && val.length > 4) {
      sanitized[key] = '••••••••' + val.slice(-4)
    }
  }
  return sanitized
}

export function writeSetting(key: string, value: string): void {
  const configRoot = resolveConfigRoot()

  if (!IS_DEV) {
    const db = getSettingsDb(configRoot, PROJECT_ROOT)
    writeSettingToDb(db, key, value)
    return
  }

  // Dev: write to .env file
  const envPath = join(configRoot, '.env')
  mkdirSync(configRoot, { recursive: true })

  let content = ''
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf-8')
  }

  const lines = content.split('\n')
  let found = false
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    if (k === key) {
      lines[i] = `${key}=${value}`
      found = true
      break
    }
  }

  if (!found) {
    if (content && !content.endsWith('\n')) lines.push('')
    lines.push(`${key}=${value}`)
  }

  writeFileSync(envPath, lines.join('\n') + '\n')
}

export function getDataDir(): string {
  return resolveConfigRoot()
}

export { PROJECT_ROOT }
