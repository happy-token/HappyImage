import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { PROJECT_ROOT, resolveUserConfigRoot } from './settings.js'

export interface PreferenceInfo {
  skillId: string
  found: boolean
  path: string | null
  scope: PreferenceScope | null
  raw: string
  values: Record<string, unknown>
  summary: Array<{ key: string; value: string }>
  targets: PreferenceTarget[]
}

export type PreferenceScope = 'config' | 'project'

export interface PreferenceTarget {
  scope: PreferenceScope
  label: string
  path: string
  exists: boolean
}

export interface PublishingAccount {
  name: string
  alias: string
  isDefault: boolean
  method: string
  author: string
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === 'null' || trimmed === '~') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return trimmed.replace(/^["']|["']$/g, '')
}

function parseLooseYaml(raw: string): Record<string, unknown> {
  const body = raw.replace(/^---\s*/, '').replace(/\s*---\s*$/, '')
  const values: Record<string, unknown> = {}
  let currentObject: string | null = null

  for (const line of body.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const top = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/)
    if (top) {
      const [, fullKey, value = ''] = top
      const parsedVal = value === '' ? {} : parseScalar(value)

      if (fullKey.includes('.')) {
        const parts = fullKey.split('.')
        let current: any = values
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {}
          }
          current = current[part]
        }
        current[parts[parts.length - 1]] = parsedVal
      } else {
        values[fullKey] = parsedVal
        if (value === '') {
          currentObject = fullKey
        } else {
          currentObject = null
        }
      }
      continue
    }

    const nested = line.match(/^\s+([A-Za-z0-9_.-]+):\s*(.*)$/)
    if (nested && currentObject && typeof values[currentObject] === 'object' && values[currentObject]) {
      const [, fullKey, value = ''] = nested
      const parsedVal = parseScalar(value)
      const parts = fullKey.split('.')
      let current: any = values[currentObject]
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {}
        }
        current = current[part]
      }
      current[parts[parts.length - 1]] = parsedVal
    }
  }

  return values
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'unset'
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${String(v)}`)
    return entries.length ? entries.join(', ') : 'configured'
  }
  return String(value)
}

function summarize(values: Record<string, unknown>) {
  const keys = [
    'watermark',
    'preferred_style',
    'preferred_layout',
    'preferred_palette',
    'preferred_type',
    'preferred_rendering',
    'preferred_mood',
    'default_aspect',
    'language',
    'preferred_image_backend',
    'default_provider',
    'default_model',
    'default_author',
    'default_theme',
    'default_color',
    'default_publish_method',
  ]

  return keys
    .filter(key => key in values)
    .map(key => ({ key, value: formatValue(values[key]) }))
}

function sharedPreferencePath() {
  return join(resolveUserConfigRoot(), 'EXTEND.md')
}

function preferenceTargets(_skillId: string): PreferenceTarget[] {
  const path = sharedPreferencePath()
  return [{ scope: 'config', label: '配置目录', path, exists: existsSync(path) }]
}

export function getPreferenceInfo(skillId: string): PreferenceInfo {
  const mainPath = sharedPreferencePath()
  const targets = preferenceTargets(skillId)

  // On first access, scan all old per-skill locations and migrate into shared file
  if (!existsSync(mainPath)) migrateAllOldPreferences(mainPath)

  if (existsSync(mainPath)) {
    const raw = readFileSync(mainPath, 'utf-8')
    const values = parseLooseYaml(raw)
    return {
      skillId,
      found: true,
      path: mainPath,
      scope: 'config',
      raw,
      values,
      summary: summarize(values),
      targets,
    }
  }

  return {
    skillId,
    found: false,
    path: mainPath,
    scope: 'config',
    raw: '',
    values: {},
    summary: [],
    targets,
  }
}

function collectOldPreferencePaths(): string[] {
  const paths: string[] = []
  const userConfigRoot = resolveUserConfigRoot()

  const scanDirs = [
    join(userConfigRoot, 'skills'),
  ]
  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue
    try {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (entry.endsWith('.md') && !entry.startsWith('.')) {
          paths.push(full)
        } else if (existsSync(join(full, 'EXTEND.md'))) {
          paths.push(join(full, 'EXTEND.md'))
        }
      }
    } catch { /* skip */ }
  }

  // Also scan PROJECT_ROOT/skills/ for legacy .md files
  const devSkillsDir = join(PROJECT_ROOT, 'skills')
  if (existsSync(devSkillsDir)) {
    try {
      for (const entry of readdirSync(devSkillsDir)) {
        if (entry.endsWith('.md') && !entry.startsWith('.')) {
          paths.push(join(devSkillsDir, entry))
        }
      }
    } catch { /* skip */ }
  }

  return paths
}

function migrateAllOldPreferences(mainPath: string) {
  const merged: Record<string, unknown> = {}
  const oldPaths = collectOldPreferencePaths()

  for (const oldPath of oldPaths) {
    try {
      const oldRaw = readFileSync(oldPath, 'utf-8')
      const oldValues = parseLooseYaml(oldRaw)
      delete oldValues.version
      Object.assign(merged, oldValues)
    } catch { /* ignore */ }
  }

  if (Object.keys(merged).length === 0) return

  mkdirSync(dirname(mainPath), { recursive: true })
  const lines = ['---', 'version: 1']
  for (const [key, value] of Object.entries(merged)) {
    lines.push(...serializeValue(key, value))
  }
  lines.push('---', '')
  writeFileSync(mainPath, lines.join('\n'), 'utf-8')
}

function serializeValue(key: string, value: unknown, indent = ''): string[] {
  if (value === undefined || value === '') return []
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${indent}${key}: []`]
    const lines = [`${indent}${key}:`]
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        const entries = Object.entries(item as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== '')
        if (entries.length === 0) continue
        lines.push(`${indent}  - ${entries[0][0]}: ${formatYamlScalar(entries[0][1])}`)
        for (const [childKey, childValue] of entries.slice(1)) {
          lines.push(`${indent}    ${childKey}: ${formatYamlScalar(childValue)}`)
        }
      } else {
        lines.push(`${indent}  - ${formatYamlScalar(item)}`)
      }
    }
    return lines
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== '')
    if (entries.length === 0) return []
    return [`${indent}${key}:`, ...entries.flatMap(([childKey, childValue]) => serializeValue(childKey, childValue, `${indent}  `))]
  }
  return [`${indent}${key}: ${formatYamlScalar(value)}`]
}

function formatYamlScalar(value: unknown) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  const text = String(value)
  if (!text) return '""'
  if (/^[A-Za-z0-9_./@:#-]+$/.test(text)) return text
  return JSON.stringify(text)
}

export function writePreferenceInfo(skillId: string, values: Record<string, unknown>, _scope?: PreferenceScope, _currentPath?: string | null): PreferenceInfo {
  const targetPath = sharedPreferencePath()
  mkdirSync(dirname(targetPath), { recursive: true })
  const existing: Record<string, unknown> = existsSync(targetPath)
    ? parseLooseYaml(readFileSync(targetPath, 'utf-8'))
    : {}
  const merged = { ...existing, ...values }
  delete merged.version
  const lines = ['---', 'version: 1']
  for (const [key, value] of Object.entries(merged)) {
    lines.push(...serializeValue(key, value))
  }
  lines.push('---', '')
  writeFileSync(targetPath, lines.join('\n'), 'utf-8')
  return getPreferenceInfo(skillId)
}

export function getPublishingAccounts(platform: string): { platform: string; preference: PreferenceInfo; accounts: PublishingAccount[] } {
  const preference = getPreferenceInfo(`post-to-${platform}`)
  const accounts = parsePublishingAccounts(preference)
  return { platform, preference, accounts }
}

function parsePublishingAccounts(preference: PreferenceInfo): PublishingAccount[] {
  const values = preference.values
  const raw = preference.raw
  const accountBlock = raw.match(/^accounts:\s*\n([\s\S]*?)(?=\n[A-Za-z0-9_-]+:|\s*$)/m)?.[1] || ''
  const blocks = accountBlock
    .split(/\n\s*-\s+/)
    .map((block, index) => index === 0 ? block.replace(/^\s*-\s+/, '') : block)
    .map(block => block.trim())
    .filter(Boolean)

  const accounts = blocks.map(block => {
    const data: Record<string, string> = {}
    for (const line of block.split('\n')) {
      const match = line.match(/^\s*([A-Za-z0-9_-]+):\s*(.*)$/)
      if (!match) continue
      data[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
    return {
      name: data.name || data.alias || 'WeChat Account',
      alias: data.alias || data.name || 'default',
      isDefault: boolFromUnknown(data.default),
      method: data.default_publish_method || '',
      author: data.default_author || '',
    }
  })

  if (accounts.length > 0) return accounts
  if (!preference.found) return []

  return [{
    name: String(values.default_author || '默认账号'),
    alias: 'default',
    isDefault: true,
    method: String(values.default_publish_method || ''),
    author: String(values.default_author || ''),
  }]
}

function boolFromUnknown(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true'
}
