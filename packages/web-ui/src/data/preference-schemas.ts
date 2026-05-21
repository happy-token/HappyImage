import { getSkill } from './index'

export interface SchemaField {
  key: string
  label: string
  labelZh: string
  type: 'text' | 'select' | 'number' | 'boolean' | 'password' | 'textarea' | 'object'
  defaultValue?: string | number | boolean
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  sensitive?: boolean
  skillPath: string
  hint?: string
  min?: number
  max?: number
  step?: number
}

export interface PreferenceSchema {
  skillId: string
  name: string
  nameZh: string
  fields: SchemaField[]
}

const baseFields: SchemaField[] = [
  { key: 'language', label: 'Language', labelZh: '默认语言', type: 'select', defaultValue: '', options: [{ value: '', label: '自动' }, { value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }], skillPath: 'language' },
  { key: 'default_aspect', label: 'Default Aspect', labelZh: '默认比例', type: 'select', defaultValue: '', options: [{ value: '', label: '跟随 skill' }, { value: '1:1', label: '1:1' }, { value: '3:4', label: '3:4' }, { value: '4:3', label: '4:3' }, { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }], skillPath: 'default_aspect' },
  { key: 'preferred_image_backend', label: 'Image Backend', labelZh: '图片后端', type: 'select', defaultValue: 'auto', options: [{ value: 'auto', label: 'auto' }, { value: 'ask', label: 'ask' }, { value: 'baoyu-imagine', label: 'baoyu-imagine' }, { value: 'dashscope', label: 'dashscope' }, { value: 'openai', label: 'openai' }, { value: 'google', label: 'google' }, { value: 'openrouter', label: 'openrouter' }, { value: 'replicate', label: 'replicate' }], skillPath: 'preferred_image_backend' },
  { key: 'generation_batch_size', label: 'Batch Size', labelZh: '并发张数', type: 'number', defaultValue: 1, min: 1, max: 8, skillPath: 'generation_batch_size' },
  { key: 'quick_mode', label: 'Quick Mode', labelZh: '快速模式', type: 'boolean', defaultValue: false, skillPath: 'quick_mode', hint: '自然语言输入时跳过固定选项确认' },
]

const watermarkFields: SchemaField[] = [
  { key: 'watermark.content', label: 'Watermark Text', labelZh: '水印内容', type: 'text', defaultValue: '', placeholder: '@yourname', skillPath: 'watermark.content' },
  { key: 'watermark.position', label: 'Watermark Position', labelZh: '水印位置', type: 'select', defaultValue: 'bottom-right', options: [{ value: 'bottom-right', label: '右下' }, { value: 'bottom-left', label: '左下' }, { value: 'top-right', label: '右上' }, { value: 'top-left', label: '左上' }], skillPath: 'watermark.position' },
  { key: 'watermark.opacity', label: 'Watermark Opacity', labelZh: '水印透明度', type: 'number', defaultValue: 0.7, min: 0.1, max: 1, step: 0.1, skillPath: 'watermark.opacity' },
  { key: 'watermark.enabled', label: 'Enable Watermark', labelZh: '启用水印', type: 'boolean', defaultValue: false, skillPath: 'watermark.enabled' },
]

function styleOptions(skillId: string, dimensionKey: string): Array<{ value: string; label: string }> {
  const skill = getSkill(skillId)
  if (!skill) return []
  const dim = skill.dimensions[dimensionKey]
  if (!dim) return []
  return dim.items.map(item => ({ value: item.id, label: item.name }))
}

export function getPreferenceSchema(skillId: string): PreferenceSchema {
  const skill = getSkill(skillId)
  if (!skill) {
    return { skillId, name: skillId, nameZh: skillId, fields: [...baseFields, ...watermarkFields] }
  }

  const fields: SchemaField[] = [...baseFields]

  const styleDims: Array<{ dimKey: string; label: string; labelZh: string }> = []
  for (const [key, dim] of Object.entries(skill.dimensions)) {
    const lower = key.toLowerCase()
    if (lower.includes('style')) styleDims.push({ dimKey: key, label: 'Style', labelZh: '风格' })
    else if (lower.includes('layout')) styleDims.push({ dimKey: key, label: 'Layout', labelZh: '布局' })
    else if (lower.includes('palette') || lower.includes('color')) styleDims.push({ dimKey: key, label: 'Palette', labelZh: '配色' })
    else if (lower.includes('type')) styleDims.push({ dimKey: key, label: 'Type', labelZh: '类型' })
    else if (lower.includes('rendering')) styleDims.push({ dimKey: key, label: 'Rendering', labelZh: '渲染' })
    else if (lower.includes('mood')) styleDims.push({ dimKey: key, label: 'Mood', labelZh: '氛围' })
  }

  for (const dim of styleDims) {
    const options = styleOptions(skillId, dim.dimKey)
    if (options.length === 0) continue
    fields.push({
      key: `preferred_${dim.dimKey}`,
      label: dim.label,
      labelZh: dim.labelZh,
      type: 'select',
      defaultValue: '',
      options: [{ value: '', label: '自动' }, ...options],
      skillPath: `preferred_${dim.dimKey}`,
    })
  }

  fields.push(...watermarkFields)
  return { skillId, name: skill.name, nameZh: skill.nameZh, fields }
}

export const publishSchemas: Record<string, PreferenceSchema> = {
  'post-to-wechat': {
    skillId: 'post-to-wechat',
    name: 'WeChat',
    nameZh: '微信公众号',
    fields: [
      { key: 'default_author', label: 'Author', labelZh: '默认作者', type: 'text', defaultValue: '', placeholder: '作者名', skillPath: 'default_author' },
      { key: 'default_theme', label: 'Theme', labelZh: '默认主题', type: 'select', defaultValue: 'default', options: [{ value: 'default', label: 'default' }, { value: 'grace', label: 'grace' }, { value: 'simple', label: 'simple' }, { value: 'modern', label: 'modern' }], skillPath: 'default_theme' },
      { key: 'default_color', label: 'Color', labelZh: '默认颜色', type: 'text', defaultValue: '', placeholder: 'blue / #0F4C81', skillPath: 'default_color' },
      { key: 'default_publish_method', label: 'Method', labelZh: '发布方式', type: 'select', defaultValue: 'browser', options: [{ value: 'browser', label: 'browser' }, { value: 'api', label: 'api' }], skillPath: 'default_publish_method' },
      { key: 'app_id', label: 'App ID', labelZh: 'App ID', type: 'text', defaultValue: '', skillPath: 'app_id', sensitive: true },
      { key: 'app_secret', label: 'App Secret', labelZh: 'App Secret', type: 'password', defaultValue: '', skillPath: 'app_secret', sensitive: true },
      { key: 'need_open_comment', label: 'Open Comments', labelZh: '开启评论', type: 'boolean', defaultValue: true, skillPath: 'need_open_comment' },
      { key: 'only_fans_can_comment', label: 'Fans Only', labelZh: '仅粉丝可评论', type: 'boolean', defaultValue: false, skillPath: 'only_fans_can_comment' },
    ],
  },
  'post-to-weibo': {
    skillId: 'post-to-weibo',
    name: 'Weibo',
    nameZh: '微博',
    fields: [
      { key: 'default_author', label: 'Author', labelZh: '默认作者', type: 'text', defaultValue: '', skillPath: 'default_author' },
      { key: 'long_post_mode', label: 'Long Post', labelZh: '长文模式', type: 'boolean', defaultValue: false, skillPath: 'long_post_mode' },
    ],
  },
  'post-to-x': {
    skillId: 'post-to-x',
    name: 'X',
    nameZh: 'X',
    fields: [
      { key: 'default_author', label: 'Author', labelZh: '默认作者', type: 'text', defaultValue: '', skillPath: 'default_author' },
      { key: 'long_post_mode', label: 'Long Post', labelZh: '长文模式', type: 'boolean', defaultValue: false, skillPath: 'long_post_mode' },
    ],
  },
}
