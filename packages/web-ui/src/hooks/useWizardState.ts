import { useState, useCallback, useMemo } from 'react'
import type { WizardState } from '../types/skills'
import { getSkill } from '../data'
import type { SkillDefinition } from '../types/skills'

const STEPS = ['Skill', 'Content', 'Style', 'Review', 'Export']

interface SelectionState {
  step: number
  skillId: string | null
  selections: Record<string, string>
  content: string
  aspectRatio: string
  language: string
  imageCount: number
}

export function useWizardSteps() {
  return STEPS
}

export function useWizardState(preselectSkill?: string) {
  const initSkill = preselectSkill ? getSkill(preselectSkill) : null
  const [s, setS] = useState<SelectionState>({
    step: preselectSkill ? 2 : 1,
    skillId: preselectSkill || null,
    selections: {},
    content: '',
    aspectRatio: initSkill?.defaultAspectRatio || '16:9',
    language: 'zh',
    imageCount: 4,
  })

  const skill = useMemo(() => s.skillId ? getSkill(s.skillId) : null, [s.skillId])

  const setStep = useCallback((step: number) => {
    setS(prev => ({ ...prev, step: Math.min(Math.max(step, 1), STEPS.length) }))
  }, [])

  const setSkill = useCallback((id: string) => {
    const sk = getSkill(id)
    setS(prev => ({
      ...prev,
      skillId: id,
      step: 2,
      selections: {},
      aspectRatio: sk?.defaultAspectRatio || prev.aspectRatio,
    }))
  }, [])

  const setSelection = useCallback((dim: string, value: string) => {
    setS(prev => ({ ...prev, selections: { ...prev.selections, [dim]: value } }))
  }, [])

  const setAllSelections = useCallback((dims: Record<string, string>) => {
    setS(prev => ({ ...prev, selections: { ...prev.selections, ...dims } }))
  }, [])

  const setContent = useCallback((content: string) => {
    setS(prev => ({ ...prev, content }))
  }, [])

  const setParam = useCallback((key: string, value: string) => {
    setS(prev => {
      if (key === 'lang') return { ...prev, language: value }
      if (key === 'aspect') return { ...prev, aspectRatio: value }
      if (key === 'count') return { ...prev, imageCount: Number(value) || 4 }
      return prev
    })
  }, [])

  const state: WizardState = useMemo(() => ({
    step: s.step,
    skillId: s.skillId,
    selections: s.selections,
    content: s.content,
    aspectRatio: s.aspectRatio,
    language: s.language,
    imageCount: s.imageCount,
    refImages: [],
  }), [s])

  return {
    state,
    skill,
    setStep,
    setSkill,
    setSelection,
    setAllSelections,
    setContent,
    setParam,
    canNext: s.step < STEPS.length && (s.step !== 1 || s.skillId !== null),
    canPrev: s.step > 1,
  }
}
