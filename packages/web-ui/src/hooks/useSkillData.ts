import { useMemo } from 'react'
import { skills, getSkill } from '../data'

export function useSkillData(skillId?: string) {
  return useMemo(() => {
    if (skillId) return getSkill(skillId)
    return undefined
  }, [skillId])
}

export function useAllSkills() {
  return skills
}
