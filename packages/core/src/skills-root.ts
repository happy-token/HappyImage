import { existsSync, statSync } from 'fs'
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
  // 1. Explicit BAOYU_SKILLS_ROOT env/setting override (highest priority)
  const settings = readSettings()
  const envRoot = process.env.BAOYU_SKILLS_ROOT || settings.BAOYU_SKILLS_ROOT || ''
  if (envRoot) {
    const path = resolve(expandHome(envRoot))
    const status = inspectRoot(path, 'BAOYU_SKILLS_ROOT')
    if (status.ready) return status
  }

  // 2. User-installed skills in config root
  const configSkills = join(resolveConfigRoot(), 'skills')
  const configStatus = inspectRoot(configSkills, 'home')
  if (configStatus.ready) return configStatus

  // 3. Project-bundled skills
  const projectSkills = join(PROJECT_ROOT, 'skills')
  const projectStatus = inspectRoot(projectSkills, 'home')
  if (projectStatus.ready) return projectStatus

  // Return the best available status for diagnostics
  return projectStatus.exists ? projectStatus
    : configStatus.exists ? configStatus
    : envRoot ? inspectRoot(resolve(expandHome(envRoot)), 'BAOYU_SKILLS_ROOT')
    : configStatus
}

function addCandidate(candidates: SkillsRootCandidate[], label: string, root: string, source: SkillsRootStatus['source']) {
  const normalized = resolve(expandHome(root))
  if (candidates.some(candidate => candidate.root === normalized)) return
  candidates.push({ label, ...inspectRoot(normalized, source) })
}

export function discoverSkillsRoots(): SkillsRootCandidate[] {
  const settings = readSettings()
  const candidates: SkillsRootCandidate[] = []

  addCandidate(candidates, '项目内嵌技能', join(PROJECT_ROOT, 'skills'), 'home')
  addCandidate(candidates, '用户配置技能', join(resolveConfigRoot(), 'skills'), 'home')

  const envRoot = process.env.BAOYU_SKILLS_ROOT || settings.BAOYU_SKILLS_ROOT || ''
  if (envRoot) {
    addCandidate(candidates, 'BAOYU_SKILLS_ROOT', envRoot, 'BAOYU_SKILLS_ROOT')
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
