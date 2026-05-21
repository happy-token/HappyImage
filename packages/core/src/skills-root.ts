import { existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { readSettings } from './settings.js'

export const CORE_SKILL_NAMES = [
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

export interface SkillsRootStatus {
  root: string
  source: 'BAOYU_SKILLS_ROOT' | 'home'
  exists: boolean
  missing: string[]
  ready: boolean
}

function expandHome(value: string) {
  return value.replace(/^~(?=\/|$)/, process.env.HOME || '')
}

function hasSkill(root: string, skillName: string) {
  const path = join(root, skillName, 'SKILL.md')
  return existsSync(path)
}

export function resolveSkillsRoot(): SkillsRootStatus {
  const settings = readSettings()
  const configured = settings.BAOYU_SKILLS_ROOT || process.env.BAOYU_SKILLS_ROOT || ''
  const root = configured
    ? resolve(expandHome(configured))
    : resolve(process.env.HOME || '/tmp', '.baoyu-skills')
  const exists = existsSync(root) && statSync(root).isDirectory()
  const missing = exists ? CORE_SKILL_NAMES.filter(name => !hasSkill(root, name)) : CORE_SKILL_NAMES
  return {
    root,
    source: configured ? 'BAOYU_SKILLS_ROOT' : 'home',
    exists,
    missing,
    ready: exists && missing.length === 0,
  }
}

export function resolveSkillDir(skillId: string): string | null {
  const status = resolveSkillsRoot()
  if (!status.exists) return null

  const nameCandidates = [
    skillId.startsWith('baoyu-') ? skillId : `baoyu-${skillId}`,
    skillId,
  ]

  for (const name of nameCandidates) {
    const path = join(status.root, name)
    if (existsSync(path) && statSync(path).isDirectory() && existsSync(join(path, 'SKILL.md'))) {
      return path
    }
  }

  return null
}
