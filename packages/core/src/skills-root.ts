import { existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { readSettings, PROJECT_ROOT, resolveConfigRoot } from './settings.js'

export const CORE_SKILL_NAMES = [
  'baoyu-image-cards',
  'baoyu-cover-image',
  'baoyu-infographic',
  'baoyu-article-illustrator',
  'baoyu-comic',
  'baoyu-slide-deck',
  'baoyu-diagram',
  // Note: baoyu-imagine is now vendored in core/vendor/baoyu-imagine
  // Note: publishing skills (post-to-wechat/weibo/x) are optional
]


export interface SkillsRootStatus {
  root: string
  source: 'BAOYU_SKILLS_ROOT' | 'home'
  exists: boolean
  missing: string[]
  ready: boolean
}

export interface SkillsRootCandidate extends SkillsRootStatus {
  label: string
}

function expandHome(value: string) {
  return value.replace(/^~(?=\/|$)/, process.env.HOME || '')
}

function hasSkill(root: string, skillName: string) {
  const path = join(root, skillName, 'SKILL.md')
  return existsSync(path)
}

function isDirectory(path: string) {
  return existsSync(path) && statSync(path).isDirectory()
}

function inspectRoot(root: string, source: SkillsRootStatus['source']): SkillsRootStatus {
  const exists = isDirectory(root)
  const missing = exists ? CORE_SKILL_NAMES.filter(name => !hasSkill(root, name)) : CORE_SKILL_NAMES
  return {
    root,
    source,
    exists,
    missing,
    ready: exists && missing.length === 0,
  }
}

export function resolveSkillsRoot(): SkillsRootStatus {
  // 1. Project-embedded skills (dev monorepo)
  const projectSkills = join(PROJECT_ROOT, 'skills')
  const projectStatus = inspectRoot(projectSkills, 'home')
  if (projectStatus.ready) return projectStatus

  // 2. Installed context: user config dir skills
  const configSkills = join(resolveConfigRoot(), 'skills')
  const configStatus = inspectRoot(configSkills, 'home')
  if (configStatus.ready) return configStatus

  const settings = readSettings()
  const envRoot = process.env.BAOYU_SKILLS_ROOT || ''
  const settingsRoot = settings.BAOYU_SKILLS_ROOT || ''
  const envPath = envRoot ? resolve(expandHome(envRoot)) : ''
  const settingsPath = settingsRoot ? resolve(expandHome(settingsRoot)) : ''

  if (envPath && settingsPath && !isDirectory(envPath) && isDirectory(settingsPath)) {
    const result = inspectRoot(settingsPath, 'BAOYU_SKILLS_ROOT')
    if (result.ready) return result
  }

  const configured = envRoot || settingsRoot || ''
  const root = configured
    ? resolve(expandHome(configured))
    : resolve(process.env.HOME || '/tmp', '.baoyu-skills')
  const primary = inspectRoot(root, configured ? 'BAOYU_SKILLS_ROOT' : 'home')

  // If the configured path doesn't exist or isn't ready, fallback to discovered candidates
  if (!primary.ready) {
    const home = process.env.HOME || '/tmp'
    const fallbackRoots = [
      join(home, '.baoyu-skills'),
      join(home, '.baoyu-skills', 'skills'),
      join(home, '.claude', 'plugins', 'marketplaces', 'baoyu-skills', 'skills'),
    ]
    const cacheBase = join(home, '.claude', 'plugins', 'cache', 'baoyu-skills', 'baoyu-skills')
    if (isDirectory(cacheBase)) {
      try {
        for (const entry of readdirSync(cacheBase)) {
          fallbackRoots.push(join(cacheBase, entry, 'skills'))
        }
      } catch { /* ignore */ }
    }
    for (const candidate of fallbackRoots) {
      const normalized = resolve(candidate)
      if (normalized === primary.root) continue
      const status = inspectRoot(normalized, 'home')
      if (status.ready) return status
    }
  }

  return primary
}

function addCandidate(candidates: SkillsRootCandidate[], label: string, root: string, source: SkillsRootStatus['source']) {
  const normalized = resolve(expandHome(root))
  if (candidates.some(candidate => candidate.root === normalized)) return
  candidates.push({ label, ...inspectRoot(normalized, source) })
}

export function discoverSkillsRoots(): SkillsRootCandidate[] {
  const home = process.env.HOME || '/tmp'
  const settings = readSettings()
  const envRoot = process.env.BAOYU_SKILLS_ROOT || ''
  const settingsRoot = settings.BAOYU_SKILLS_ROOT || ''
  const envPath = envRoot ? resolve(expandHome(envRoot)) : ''
  const settingsPath = settingsRoot ? resolve(expandHome(settingsRoot)) : ''
  const configured = envRoot || settingsRoot || ''
  const candidates: SkillsRootCandidate[] = []

  // Project-embedded skills listed first
  addCandidate(candidates, '项目内嵌技能目录', join(PROJECT_ROOT, 'skills'), 'home')
  addCandidate(candidates, '用户配置技能目录', join(resolveConfigRoot(), 'skills'), 'home')

  if (envPath && settingsPath && !isDirectory(envPath) && isDirectory(settingsPath)) {
    addCandidate(candidates, '当前配置', settingsRoot, 'BAOYU_SKILLS_ROOT')
  } else if (configured) {
    addCandidate(candidates, '当前配置', configured, 'BAOYU_SKILLS_ROOT')
  }
  addCandidate(candidates, '默认技能目录', join(home, '.baoyu-skills'), 'home')
  addCandidate(candidates, '默认目录下的 skills 子目录', join(home, '.baoyu-skills', 'skills'), 'home')
  addCandidate(candidates, 'Claude 插件安装目录', join(home, '.claude', 'plugins', 'marketplaces', 'baoyu-skills', 'skills'), 'home')

  const cacheRoot = join(home, '.claude', 'plugins', 'cache', 'baoyu-skills', 'baoyu-skills')
  if (isDirectory(cacheRoot)) {
    for (const entry of readdirSync(cacheRoot)) {
      addCandidate(candidates, 'Claude 插件缓存目录', join(cacheRoot, entry, 'skills'), 'home')
    }
  }

  return candidates
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
