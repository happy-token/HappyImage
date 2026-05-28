import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { PROJECT_ROOT, resolveConfigRoot } from './settings.js'

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
  source: 'project' | 'config'
  exists: boolean
  missing: string[]
  ready: boolean
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
  const projectSkills = join(PROJECT_ROOT, 'skills')
  const projectStatus = inspectRoot(projectSkills, 'project')
  if (projectStatus.ready) return projectStatus

  const configSkills = join(resolveConfigRoot(), 'skills')
  const configStatus = inspectRoot(configSkills, 'config')
  if (configStatus.ready) return configStatus

  return projectStatus.exists ? projectStatus : configStatus
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
