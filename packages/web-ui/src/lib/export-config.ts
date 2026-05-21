import type { WizardState, ExportConfig } from '../types/skills'
import { getSkill } from '../data'

function buildCommand(skillId: string, state: WizardState): string {
  const flags = Object.entries(state.selections)
    .map(([k, v]) => `--${k} ${v}`)
    .join(' ')

  const parts = [`/baoyu-${skillId}`]

  if (state.content) {
    const clean = state.content.replace(/\n/g, ' ').trim()
    parts.push(`"${clean.slice(0, 200)}${clean.length > 200 ? '...' : ''}"`)
  }

  if (flags) parts.push(flags)

  return parts.join(' ')
}

export function buildExportConfig(state: WizardState): ExportConfig | null {
  const skill = state.skillId ? getSkill(state.skillId) : null
  if (!skill) return null

  const selectedItems: string[] = []
  for (const [dim, itemId] of Object.entries(state.selections)) {
    const dimension = skill.dimensions[dim]
    if (dimension) {
      const item = dimension.items.find(i => i.id === itemId)
      if (item) selectedItems.push(`${dimension.label}: ${item.name}`)
    }
  }

  const command = buildCommand(skill.id, state)

  const promptPreview = [
    `Skill: ${skill.name}`,
    `Selections: ${selectedItems.join(', ') || 'Auto'}`,
    `Language: ${state.language}`,
    `Aspect Ratio: ${state.aspectRatio}`,
    `Content: ${state.content.slice(0, 300)}${state.content.length > 300 ? '...' : ''}`,
  ].join('\n')

  return {
    skillId: skill.id,
    skillName: skill.name,
    selections: state.selections,
    presetId: null,
    parameters: {
      language: state.language,
      aspectRatio: state.aspectRatio,
      imageCount: state.imageCount,
    },
    content: state.content,
    contentSummary: state.content.slice(0, 150) + (state.content.length > 150 ? '...' : ''),
    aspectRatio: state.aspectRatio,
    language: state.language,
    imageCount: state.imageCount,
    claudeCommand: command,
    promptPreview,
  }
}

export function downloadConfig(config: ExportConfig): void {
  const json = JSON.stringify(config, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.skillId}-config.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadMarkdown(config: ExportConfig): void {
  const selectedList = Object.entries(config.selections)
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n')

  const md = [
    `# ${config.skillName} Configuration`,
    '',
    '## Selections',
    selectedList || '- Auto-detect',
    '',
    '## Parameters',
    `- Language: ${config.language}`,
    `- Aspect Ratio: ${config.aspectRatio}`,
    `- Image Count: ${config.imageCount}`,
    '',
    '## Content',
    config.content || '(No content provided)',
    '',
    '## Run with Claude Code',
    '```',
    config.claudeCommand,
    '```',
  ].join('\n')

  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.skillId}-prompt.md`
  a.click()
  URL.revokeObjectURL(url)
}
