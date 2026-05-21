import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Check, ArrowRight, Compass, Image } from 'lucide-react'
import { skills } from '../data'
import type { ConfigItem, SkillDefinition, SkillParameter } from '../types/skills'
import { getStyleGradient } from '../lib/screenshots'
import BackToStudioButton from '../components/ui/BackToStudioButton'

type WizardStep =
  | { kind: 'skill'; key: 'skill'; label: string; description: string }
  | { kind: 'dimension'; key: string; label: string; description: string; items: ConfigItem[] }
  | { kind: 'parameter'; key: string; label: string; description: string; parameter: SkillParameter }
  | { kind: 'review'; key: 'review'; label: string; description: string }

const parameterNames = new Set(['language', 'aspectRatio', 'imageCount', 'pageCount', 'slides', 'audience', 'density', 'scale'])

const skillPreviewImages: Record<string, string> = {
  'image-cards': '/screenshots/gallery-types/image-cards.png?v=type-2',
  'xhs-images': '/screenshots/gallery-types/xhs-images.png?v=type-2',
  infographic: '/screenshots/gallery-types/infographic.png?v=type-2',
  'cover-image': '/screenshots/gallery-types/cover-image.png?v=type-2',
  'slide-deck': '/screenshots/gallery-types/slide-deck.png?v=type-2',
  comic: '/screenshots/gallery-types/comic.png?v=type-2',
  'article-illustrator': '/screenshots/gallery-types/article-illustrator.png?v=type-2',
  diagram: '/screenshots/gallery-types/diagram.png?v=type-2',
}

const skillUseCases: Record<string, string> = {
  'image-cards': '把文章、观点、项目介绍拆成多张社媒图文卡片',
  'xhs-images': '生成小红书风格封面和多图笔记',
  infographic: '把数据、流程、框架做成信息图',
  'cover-image': '生成文章封面、博客头图、社媒 Banner',
  'slide-deck': '把内容生成演示文稿和 PPT 风格页面',
  comic: '把知识点、故事、教程做成漫画',
  'article-illustrator': '给文章段落生成配图',
  diagram: '生成技术架构图、流程图、时序图等 SVG 图表',
}

const generatedOptionPreviews: Record<string, Set<string>> = {
  'image-cards.style': new Set(['study-notes', 'screen-print', 'sketch-notes']),
  'image-cards.layout': new Set(['mindmap', 'quadrant']),
  'image-cards.palette': new Set(['macaron', 'warm', 'neon']),
  'xhs-images.style': new Set(['study-notes', 'screen-print', 'sketch-notes']),
  'xhs-images.layout': new Set(['mindmap', 'quadrant']),
  'xhs-images.palette': new Set(['macaron', 'warm', 'neon']),
  'infographic.style': new Set(['pop-laboratory', 'morandi-journal', 'retro-pop-grid', 'hand-drawn-edu', 'retro-popup-pop']),
  'infographic.layout': new Set([
    'linear-progression',
    'binary-comparison',
    'comparison-matrix',
    'hierarchical-layers',
    'tree-branching',
    'hub-spoke',
    'structural-breakdown',
    'bento-grid',
    'isometric-map',
    'dashboard',
    'periodic-table',
    'comic-strip',
    'story-mountain',
    'jigsaw',
    'venn-diagram',
    'winding-roadmap',
    'dense-modules',
  ]),
  'cover-image.text': new Set(['none', 'title-only', 'title-subtitle', 'text-rich']),
  'cover-image.mood': new Set(['subtle', 'balanced', 'bold']),
  'slide-deck.style': new Set(['hand-drawn-edu']),
  'slide-deck.texture': new Set(['clean', 'grid', 'organic', 'pixel', 'paper']),
  'slide-deck.typography': new Set(['geometric', 'humanist', 'handwritten', 'editorial', 'technical']),
  'comic.art': new Set(['ligne-claire', 'manga', 'ink-brush', 'chalk', 'minimalist']),
  'comic.tone': new Set(['neutral', 'warm', 'dramatic', 'romantic', 'energetic', 'vintage', 'action']),
  'comic.layout': new Set(['four-panel']),
  'article-illustrator.type': new Set(['infographic', 'scene', 'flowchart', 'comparison', 'framework', 'timeline']),
  'article-illustrator.palette': new Set(['default', 'macaron', 'warm', 'neon']),
  'diagram.type': new Set(['architecture', 'flowchart', 'sequence', 'structural', 'mindmap', 'timeline', 'illustrative', 'state-machine', 'dataflow']),
}

const optionPreviewOverrides: Record<string, string> = {
  'slide-deck.mood.professional': '/screenshots/slide-deck-styles/corporate.webp',
  'slide-deck.mood.warm': '/screenshots/cover-image-palettes/warm.webp',
  'slide-deck.mood.cool': '/screenshots/cover-image-palettes/cool.webp',
  'slide-deck.mood.vibrant': '/screenshots/cover-image-palettes/vivid.webp',
  'slide-deck.mood.dark': '/screenshots/cover-image-palettes/dark.webp',
  'slide-deck.mood.neutral': '/screenshots/cover-image-palettes/mono.webp',
  'slide-deck.mood.macaron': '/screenshots/cover-image-palettes/macaron.webp',
  'slide-deck.density.minimal': '/screenshots/xhs-images-layouts/sparse.webp',
  'slide-deck.density.balanced': '/screenshots/xhs-images-layouts/balanced.webp',
  'slide-deck.density.dense': '/screenshots/xhs-images-layouts/dense.webp',
}

function buildStudioUrl(skill: SkillDefinition, selections: Record<string, string>, parameters: Record<string, string>) {
  const params = new URLSearchParams()
  params.set('skill', skill.id)
  params.set('drawer', '1')
  for (const [key, value] of Object.entries(selections)) if (value) params.set(key, value)
  for (const [key, value] of Object.entries(parameters)) if (value) params.set(key, value)
  return `/?${params.toString()}`
}

function initialSelections(skill: SkillDefinition) {
  return Object.fromEntries(
    Object.entries(skill.dimensions).map(([key, dim]) => [key, dim.defaultItem || dim.items[0]?.id || '']),
  )
}

function initialParameters(skill: SkillDefinition) {
  return Object.fromEntries(
    skill.parameters
      .filter(param => parameterNames.has(param.name))
      .map(param => [param.name, String(param.defaultValue ?? '')]),
  )
}

function previewForItem(skill: SkillDefinition, dimension: string, item: ConfigItem) {
  const override = optionPreviewOverrides[`${skill.id}.${dimension}.${item.id}`]
  if (override) return override
  if (generatedOptionPreviews[`${skill.id}.${dimension}`]?.has(item.id)) {
    return `/screenshots/gallery-options/${skill.id}/${dimension}/${item.id}.png?v=option-5`
  }
  const dir = skill.screenshotDirs.find(d => d.dimension === dimension)
  return dir ? `/screenshots/${dir.path}/${item.id}.webp` : ''
}

function previewForSkill(skill: SkillDefinition) {
  if (skillPreviewImages[skill.id]) return skillPreviewImages[skill.id]
  const preferred = ['style', 'art', 'layout', 'type'].find(key => skill.dimensions[key])
  if (!preferred) return ''
  const itemId = skill.dimensions[preferred].defaultItem || skill.dimensions[preferred].items[0]?.id
  const item = skill.dimensions[preferred].items.find(i => i.id === itemId) || skill.dimensions[preferred].items[0]
  return item ? previewForItem(skill, preferred, item) : ''
}

function optionsForParameter(parameter: SkillParameter): ConfigItem[] {
  if (parameter.options) {
    return parameter.options.map(option => ({
      id: option.value,
      name: option.label,
      description: option.value,
      tags: [],
    }))
  }
  const defaults: Record<string, ConfigItem[]> = {
    imageCount: [1, 2, 4, 6, 8].map(count => ({ id: String(count), name: `${count}`, description: `${count} images`, tags: [] })),
    pageCount: [1, 2, 4, 6, 8].map(count => ({ id: String(count), name: `${count}`, description: `${count} pages`, tags: [] })),
    slides: [6, 8, 10, 12, 16].map(count => ({ id: String(count), name: `${count}`, description: `${count} slides`, tags: [] })),
  }
  return defaults[parameter.name] || [{ id: String(parameter.defaultValue || ''), name: String(parameter.defaultValue || 'Default'), description: 'Default value', tags: [] }]
}

function stepDescription(key: string) {
  const descriptions: Record<string, string> = {
    style: 'Select the visual style that controls overall look and feel.',
    art: 'Select the comic drawing style.',
    layout: 'Select how information is arranged on the image.',
    palette: 'Select the color system.',
    rendering: 'Select the rendering technique.',
    text: 'Select how much text should appear inside the image.',
    mood: 'Select the emotional tone.',
    tone: 'Select the story mood.',
    typography: 'Select typography style.',
    texture: 'Select surface texture.',
    density: 'Select information density.',
    type: 'Select the concrete image subtype.',
    aspectRatio: 'Select the output shape.',
    language: 'Select the output language.',
  }
  return descriptions[key] || 'Select the option that best matches the content.'
}

function TextChoiceCard({
  item,
  active,
  onClick,
}: {
  item: ConfigItem
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-sm transition-all duration-200 ${
        active 
          ? 'border-indigo-500 bg-indigo-950/10 ring-2 ring-indigo-500/20' 
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:shadow-md cursor-pointer'
      }`}
    >
      <div className="text-lg font-semibold text-zinc-100">{item.name}</div>
      {item.description && item.description !== item.name && (
        <p className="mt-1 text-xs text-zinc-400">{item.description}</p>
      )}
      {active && (
        <span className="mt-2 inline-flex items-center rounded-full bg-indigo-950/30 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-400 border border-indigo-900/30">
          <Check className="w-2.5 h-2.5 mr-1 stroke-[3]" /> Selected
        </span>
      )}
    </button>
  )
}

function StepCard({
  item,
  active,
  preview,
  onClick,
}: {
  item: ConfigItem
  active: boolean
  preview?: string
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const fallback = getStyleGradient(item.id)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all duration-300 ${
        active 
          ? 'border-indigo-500 bg-indigo-950/10 ring-2 ring-indigo-500/20' 
          : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:shadow-md cursor-pointer'
      }`}
    >
      <div className="aspect-[16/10] bg-zinc-950/50 w-full overflow-hidden border-b border-zinc-900">
        {preview && !imgError ? (
          <img src={preview} alt={item.name} onError={() => setImgError(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center p-5 text-center text-sm font-semibold text-white/85" style={{ background: fallback }}>
            Preview
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-100">{item.name}</div>
            {active && (
              <span className="inline-flex items-center rounded-full bg-indigo-950/30 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-400 border border-indigo-900/30">
                <Check className="w-2.5 h-2.5 mr-1 stroke-[3]" /> Selected
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">{item.description}</p>
        </div>
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="rounded-full bg-zinc-850 px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-800/30">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

export default function GalleryPage() {
  const navigate = useNavigate()
  const [guideSkillId, setGuideSkillId] = useState(skills[0].id)
  const [guideSelections, setGuideSelections] = useState<Record<string, string>>(() => initialSelections(skills[0]))
  const [guideParameters, setGuideParameters] = useState<Record<string, string>>(() => initialParameters(skills[0]))
  const [stepIndex, setStepIndex] = useState(0)

  const guideSkill = skills.find(s => s.id === guideSkillId) || skills[0]

  const steps = useMemo<WizardStep[]>(() => {
    const dimensionSteps = Object.entries(guideSkill.dimensions).map(([key, dim]) => ({
      kind: 'dimension' as const,
      key,
      label: dim.label || dim.name,
      description: stepDescription(key),
      items: dim.items,
    }))
    const parameterSteps = guideSkill.parameters
      .filter(param => parameterNames.has(param.name))
      .map(param => ({
        kind: 'parameter' as const,
        key: param.name,
        label: param.label,
        description: stepDescription(param.name),
        parameter: param,
      }))
    return [
      { kind: 'skill', key: 'skill', label: '选择生成类型', description: '' },
      ...dimensionSteps,
      ...parameterSteps,
      { kind: 'review', key: 'review', label: 'Ready for Chat', description: 'Review choices and continue into the chat workflow.' },
    ]
  }, [guideSkill])

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]

  const selectGuideSkill = (skillId: string) => {
    const skill = skills.find(s => s.id === skillId)
    if (!skill) return
    setGuideSkillId(skill.id)
    setGuideSelections(initialSelections(skill))
    setGuideParameters(initialParameters(skill))
    setStepIndex(0)
  }

  const selectGuideItem = (skillId: string, dimension: string, itemId: string) => {
    const skill = skills.find(s => s.id === skillId)
    if (!skill) return
    if (skillId !== guideSkillId) {
      setGuideSkillId(skill.id)
      setGuideSelections({ ...initialSelections(skill), [dimension]: itemId })
      setGuideParameters(initialParameters(skill))
      setStepIndex(Math.max(1, Object.keys(skill.dimensions).indexOf(dimension) + 1))
      return
    }
    setGuideSelections(prev => ({ ...prev, [dimension]: itemId }))
  }
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100)

  const selectedSummary = useMemo(() => {
    const dimensionSummary = Object.entries(guideSkill.dimensions).map(([key, dim]) => {
      const item = dim.items.find(i => i.id === guideSelections[key])
      return { key, label: dim.label || dim.name, value: item?.name || 'Auto' }
    })
    const parameterSummary = guideSkill.parameters
      .filter(param => parameterNames.has(param.name))
      .map(param => {
        const value = guideParameters[param.name] || String(param.defaultValue || '')
        const label = param.options?.find(option => option.value === value)?.label || value
        return { key: param.name, label: param.label, value: label }
      })
    return [...dimensionSummary, ...parameterSummary]
  }, [guideSkill, guideSelections, guideParameters])

  const goNext = () => setStepIndex(prev => Math.min(steps.length - 1, prev + 1))
  const goBack = () => setStepIndex(prev => Math.max(0, prev - 1))
  const skipCurrentStep = () => {
    if (currentStep.kind === 'dimension') {
      const dim = guideSkill.dimensions[currentStep.key]
      const fallback = dim.defaultItem || dim.items[0]?.id || ''
      setGuideSelections(prev => ({ ...prev, [currentStep.key]: fallback }))
    }
    if (currentStep.kind === 'parameter') {
      const fallback = String(currentStep.parameter.defaultValue || optionsForParameter(currentStep.parameter)[0]?.id || '')
      setGuideParameters(prev => ({ ...prev, [currentStep.key]: fallback }))
    }
    goNext()
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-zinc-950 text-zinc-100 transition-colors duration-200">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mb-5 pr-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950/20 text-indigo-400">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Visual setup wizard</p>
              <h1 className="text-2xl md:text-3xl font-display font-semibold text-zinc-100">Gallery Wizard</h1>
            </div>
          </div>
          <BackToStudioButton className="absolute right-0 top-1/2 -translate-y-1/2" />
        </div>

        <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-sm flex flex-col">
          {/* Thin progress bar at the very top */}
          <div className="w-full h-1 bg-zinc-950 overflow-hidden shrink-0">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          <div className="flex h-full flex-col min-h-0">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-850 text-zinc-400">
                    第 {stepIndex + 1} 步 / 共 {steps.length} 步
                  </span>
                  {currentStep.label}
                </h2>
                {currentStep.description && <p className="mt-1 text-xs text-zinc-400">{currentStep.description}</p>}
              </div>
              {currentStep.kind === 'skill' && (
                <span className="text-xs text-indigo-400 font-medium">当前选择：{guideSkill.nameZh}</span>
              )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {currentStep.kind === 'skill' && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {skills.map(skill => (
                    <StepCard
                      key={skill.id}
                      active={skill.id === guideSkill.id}
                      preview={previewForSkill(skill)}
                      onClick={() => selectGuideSkill(skill.id)}
                      item={{
                        id: skill.id,
                        name: skill.nameZh,
                        description: skillUseCases[skill.id] || skill.description,
                        tags: [skill.outputType, ...skill.bestFor.slice(0, 2)],
                      }}
                    />
                  ))}
                </div>
              )}

              {currentStep.kind === 'dimension' && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {currentStep.items.map(item => (
                    <StepCard
                      key={item.id}
                      item={item}
                      active={guideSelections[currentStep.key] === item.id}
                      preview={previewForItem(guideSkill, currentStep.key, item)}
                      onClick={() => selectGuideItem(guideSkill.id, currentStep.key, item.id)}
                    />
                  ))}
                </div>
              )}

              {currentStep.kind === 'parameter' && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {optionsForParameter(currentStep.parameter).map(item => (
                    <TextChoiceCard
                      key={item.id}
                      item={item}
                      active={(guideParameters[currentStep.key] || String(currentStep.parameter.defaultValue || '')) === item.id}
                      onClick={() => setGuideParameters(prev => ({ ...prev, [currentStep.key]: item.id }))}
                    />
                  ))}
                </div>
              )}

              {currentStep.kind === 'review' && (
                <div className="max-w-2xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 w-full">
                  <h3 className="text-sm font-bold text-zinc-150 mb-4 border-b border-zinc-800 pb-3">配置确认</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedSummary.map(item => (
                      <div key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-550">{item.label}</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-200">{item.value || '自动'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
              <div>
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  onClick={goBack}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 shadow-sm hover:bg-zinc-850 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> 上一步
                </button>
              </div>

              <div className="flex items-center gap-3">
                {currentStep.kind !== 'review' && (
                  <button
                    type="button"
                    onClick={skipCurrentStep}
                    className="rounded-lg border border-zinc-850 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 cursor-pointer transition-colors"
                  >
                    使用默认
                  </button>
                )}
                {currentStep.kind === 'review' ? (
                  <button
                    type="button"
                    onClick={() => navigate(buildStudioUrl(guideSkill, guideSelections, guideParameters))}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-850 cursor-pointer inline-flex items-center gap-1 transition-all"
                  >
                    开始创作 <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-850 cursor-pointer inline-flex items-center gap-1 transition-all"
                  >
                    下一步 <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
