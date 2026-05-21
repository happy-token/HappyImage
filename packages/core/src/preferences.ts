import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { PROJECT_ROOT, readSettings } from './settings.js'

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

export type PreferenceScope = 'project' | 'output' | 'xdg' | 'user'

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
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (top) {
      const [, key, value = ''] = top
      if (value === '') {
        values[key] = {}
        currentObject = key
      } else {
        values[key] = parseScalar(value)
        currentObject = null
      }
      continue
    }

    const nested = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/)
    if (nested && currentObject && typeof values[currentObject] === 'object' && values[currentObject]) {
      const [, key, value = ''] = nested
      ;(values[currentObject] as Record<string, unknown>)[key] = parseScalar(value)
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

function preferenceTargets(skillId: string): PreferenceTarget[] {
  const skillName = skillId.startsWith('baoyu-') ? skillId : `baoyu-${skillId}`
  const settings = readSettings()
  const outputRoot = resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
  const xdgRoot = process.env.XDG_CONFIG_HOME || join(process.env.HOME || '', '.config')
  const isPublishingSkill = skillName.startsWith('baoyu-post-to-')
  const targets: PreferenceTarget[] = [
    { scope: 'project', label: '当前项目', path: join(PROJECT_ROOT, '.baoyu-skills', skillName, 'EXTEND.md'), exists: false },
    ...(isPublishingSkill ? [] : [{ scope: 'output' as const, label: '输出目录', path: join(outputRoot, '.baoyu-skills', skillName, 'EXTEND.md'), exists: false }]),
    { scope: 'xdg', label: '系统配置', path: join(xdgRoot, 'baoyu-skills', skillName, 'EXTEND.md'), exists: false },
    { scope: 'user', label: '用户全局', path: join(process.env.HOME || '', '.baoyu-skills', skillName, 'EXTEND.md'), exists: false },
  ]
  return targets.map(target => ({ ...target, exists: existsSync(target.path) }))
}

function resolveTarget(skillId: string, scope?: PreferenceScope, fallbackPath?: string | null) {
  const targets = preferenceTargets(skillId)
  if (scope) return targets.find(target => target.scope === scope) || targets[1]
  if (fallbackPath) {
    const found = targets.find(target => target.path === fallbackPath)
    if (found) return found
  }
  return targets.find(target => target.exists) || targets[1]
}

export function getPreferenceInfo(skillId: string): PreferenceInfo {
  const targets = preferenceTargets(skillId)

  for (const target of targets) {
    const path = target.path
    if (!existsSync(path)) continue
    const raw = readFileSync(path, 'utf-8')
    const values = parseLooseYaml(raw)
    return {
      skillId,
      found: true,
      path,
      scope: target.scope,
      raw,
      values,
      summary: summarize(values),
      targets,
    }
  }

  return {
    skillId,
    found: false,
    path: null,
    scope: null,
    raw: '',
    values: {},
    summary: [],
    targets,
  }
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

export function writePreferenceInfo(skillId: string, values: Record<string, unknown>, scope?: PreferenceScope, currentPath?: string | null): PreferenceInfo {
  const target = resolveTarget(skillId, scope, currentPath)
  mkdirSync(dirname(target.path), { recursive: true })
  const lines = ['---', 'version: 1']
  for (const [key, value] of Object.entries(values)) {
    lines.push(...serializeValue(key, value))
  }
  lines.push('---', '')
  writeFileSync(target.path, lines.join('\n'), 'utf-8')
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
