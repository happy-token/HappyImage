export interface ConfigItem {
  id: string
  name: string
  description: string
  tags: string[]
  previewImage?: string
  compatibility?: string[]
  contentHints?: string
}

export interface SkillDimension {
  name: string
  label: string
  items: ConfigItem[]
  isRequired: boolean
  defaultItem: string | null
}

export interface PresetConfig {
  id: string
  name: string
  description: string
  dimensionMap: Record<string, string>
  bestFor: string
}

export interface RecommendedCombo {
  content: string
  dimensionMap: Record<string, string>
}

export interface SkillParameter {
  name: string
  label: string
  type: 'text' | 'select' | 'number' | 'textarea'
  options?: { value: string; label: string }[]
  defaultValue: string | number
  placeholder?: string
}

export type StyleType = 'styles_and_layouts' | 'multidimensional' | 'presets'

export interface SkillDefinition {
  id: string
  name: string
  nameZh: string
  description: string
  longDescription: string
  category: 'image-cards' | 'infographic' | 'cover' | 'presentation' | 'comic' | 'illustration' | 'diagram'
  styleType: StyleType
  dimensions: Record<string, SkillDimension>
  presets: PresetConfig[]
  recommendations: RecommendedCombo[]
  parameters: SkillParameter[]
  bestFor: string[]
  hasCLI: boolean
  outputType: 'images' | 'svg' | 'pptx'
  defaultAspectRatio: string
  screenshotDirs: { dimension: string; path: string }[]
}

export interface WizardState {
  step: number
  skillId: string | null
  selections: Record<string, string>
  content: string
  aspectRatio: string
  language: string
  imageCount: number
  refImages: string[]
}

export interface ExportConfig {
  skillId: string
  skillName: string
  selections: Record<string, string>
  presetId: string | null
  parameters: Record<string, string | number>
  content: string
  contentSummary: string
  aspectRatio: string
  language: string
  imageCount: number
  claudeCommand: string
  promptPreview: string
}
