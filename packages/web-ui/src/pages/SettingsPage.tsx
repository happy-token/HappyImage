import { useEffect, useMemo, useState } from 'react'
import {
  Terminal,
  Cpu,
  Sliders,
  Share2,
  HardDrive,
  Info,
  ExternalLink,
  FileText,
  Mail,
  Globe2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Check,
  Download,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Settings as SettingsIcon,
  Palette,
  Lock,
  RefreshCw
} from 'lucide-react'
import webPackage from '../../package.json'
import Button from '../components/ui/Button'
import BackToStudioButton from '../components/ui/BackToStudioButton'
import { skills } from '../data'
import type { PreferenceSchema, SchemaField } from '../data/preference-schemas'
import { applyAccent } from '../lib/accent'
import { applyTheme } from '../lib/theme'
import { normalizeLanguage, setAppLanguage, t, type AppLanguage } from '../i18n/settings'

type PreferenceDraft = Record<string, string | number | boolean>
type ProviderKind = 'execution' | 'image'
type ProviderField = { key: string; label: string; type?: 'text' | 'password' | 'select'; placeholder?: string; options?: Array<{ value: string; label: string }> }
type ProviderDefinition = {
  id: string
  name: string
  nameEn?: string
  description: string
  descriptionEn?: string
  nameKey?: string
  defaultBaseUrl?: string
  defaultModel: string
  apiKey?: string
  baseUrl?: string
  modelKey: string
  defaultKey: string
  defaultValue: string
  extraFields?: ProviderField[]
}

function L(lang: AppLanguage, zh: string, en: string) {
  return lang === 'en' ? en : zh
}

const settingSections = [
  { id: 'environment', labelKey: 'section.environment', hintKey: 'section.environment_hint', icon: Terminal },
  { id: 'models', labelKey: 'section.models', hintKey: 'section.models_hint', icon: Cpu },
  { id: 'preferences', labelKey: 'section.preferences', hintKey: 'section.preferences_hint', icon: Sliders },
  { id: 'publish', labelKey: 'section.publish', hintKey: 'section.publish_hint', icon: Share2 },
  { id: 'backup', labelKey: 'section.backup', hintKey: 'section.backup_hint', icon: HardDrive },
  { id: 'about', labelKey: 'section.about', hintKey: 'section.about_hint', icon: Info },
]

const APP_VERSION = webPackage.version || '0.2.3'
const HAPPYIMAGE_SITE = 'https://happy-image.cn'
const HAPPYIMAGE_REPO = 'https://github.com/happy-token/HappyImage'
const HAPPYIMAGE_RELEASES = 'https://github.com/happy-token/HappyImage/releases'

const executionProviders: ProviderDefinition[] = [
  {
    id: 'anthropic',
    name: 'Anthropic / Claude',
    description: '用于计划生成、文案整理和多轮修改。HappyImage 当前执行模型走 Anthropic 兼容接口。',
    descriptionEn: 'Used for planning, copywriting, and multi-turn editing. HappyImage currently uses Anthropic-compatible execution APIs.',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
    modelKey: 'ANTHROPIC_MODEL',
    defaultKey: 'ANTHROPIC_MODEL',
    defaultValue: 'claude-sonnet-4-6',
    extraFields: [{ key: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: 'Optional Claude Code session or compatible token' }],
  },
  {
    id: 'anthropic-compatible',
    name: 'Anthropic-compatible',
    description: '第三方 Anthropic 兼容网关。保存后仍写入 ANTHROPIC_*，供现有执行链路读取。',
    descriptionEn: 'Third-party Anthropic-compatible gateway. Values are saved to ANTHROPIC_* for the existing execution pipeline.',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
    modelKey: 'ANTHROPIC_MODEL',
    defaultKey: 'ANTHROPIC_MODEL',
    defaultValue: 'claude-sonnet-4-6',
    extraFields: [{ key: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: 'Optional Claude Code session or compatible token' }],
  },
  {
    id: 'custom-anthropic',
    name: '自定义执行模型',
    nameEn: 'Custom Execution Model',
    description: '自定义 Anthropic-compatible 网关名称、Base URL 和模型。',
    descriptionEn: 'Customize the Anthropic-compatible gateway name, Base URL, and model.',
    nameKey: 'CUSTOM_EXECUTION_PROVIDER_NAME',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
    modelKey: 'ANTHROPIC_MODEL',
    defaultKey: 'ANTHROPIC_MODEL',
    defaultValue: 'claude-sonnet-4-6',
    extraFields: [{ key: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: 'Optional Claude Code session or compatible token' }],
  },
]

const imageProviders: ProviderDefinition[] = [
  { id: 'google', name: 'Google Gemini', description: '支持 Gemini 图像模型和参考图工作流。', descriptionEn: 'Supports Gemini image models and reference-image workflows.', defaultBaseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-3-pro-image-preview', apiKey: 'GOOGLE_API_KEY', baseUrl: 'GOOGLE_BASE_URL', modelKey: 'GOOGLE_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'google' },
  { id: 'openai', name: 'OpenAI Images', description: '支持 GPT Image 生成与编辑，可配置 OpenAI 兼容网关。', descriptionEn: 'Supports GPT Image generation and editing with configurable OpenAI-compatible gateways.', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-2', apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', modelKey: 'OPENAI_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openai', extraFields: [{ key: 'OPENAI_IMAGE_API_DIALECT', label: 'API Dialect', type: 'select', options: [{ value: '', label: 'Default' }, { value: 'openai-native', label: 'openai-native' }, { value: 'ratio-metadata', label: 'ratio-metadata' }] }] },
  { id: 'custom-openai', name: '自定义生图模型', nameEn: 'Custom Image Model', description: '自定义 OpenAI-compatible 图片网关名称、Base URL 和模型。保存后通过 OpenAI provider 执行。', descriptionEn: 'Customize the OpenAI-compatible image gateway name, Base URL, and model. It still runs through the OpenAI provider.', nameKey: 'CUSTOM_IMAGE_PROVIDER_NAME', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-2', apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', modelKey: 'OPENAI_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openai', extraFields: [{ key: 'OPENAI_IMAGE_API_DIALECT', label: 'API Dialect', type: 'select', options: [{ value: '', label: 'Default' }, { value: 'openai-native', label: 'openai-native' }, { value: 'ratio-metadata', label: 'ratio-metadata' }] }, { key: 'OPENAI_IMAGE_USE_CHAT', label: 'Use Chat Completions', type: 'select', options: [{ value: '', label: 'Default' }, { value: 'true', label: 'true' }, { value: 'false', label: 'false' }] }] },
  { id: 'azure', name: 'Azure OpenAI', description: '使用 Azure deployment name 作为模型名。', descriptionEn: 'Uses the Azure deployment name as the model name.', defaultBaseUrl: 'https://your-resource.openai.azure.com', defaultModel: 'gpt-image-2', apiKey: 'AZURE_OPENAI_API_KEY', baseUrl: 'AZURE_OPENAI_BASE_URL', modelKey: 'AZURE_OPENAI_DEPLOYMENT', defaultKey: 'IMAGE_BACKEND', defaultValue: 'azure', extraFields: [{ key: 'AZURE_API_VERSION', label: 'API Version', placeholder: '2025-04-01-preview' }] },
  { id: 'openrouter', name: 'OpenRouter', description: '通过 OpenRouter 调用 Gemini/FLUX 等图像模型。', descriptionEn: 'Calls Gemini, FLUX, and other image models through OpenRouter.', defaultBaseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-3.1-flash-image-preview', apiKey: 'OPENROUTER_API_KEY', baseUrl: 'OPENROUTER_BASE_URL', modelKey: 'OPENROUTER_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openrouter', extraFields: [{ key: 'OPENROUTER_HTTP_REFERER', label: 'HTTP Referer' }, { key: 'OPENROUTER_TITLE', label: 'App Title' }] },
  { id: 'dashscope', name: 'DashScope / Qwen', description: '阿里云 DashScope，适合中文海报和文字渲染。', descriptionEn: 'Alibaba Cloud DashScope, useful for poster-style generation and text rendering.', defaultBaseUrl: 'https://dashscope.aliyuncs.com', defaultModel: 'qwen-image-2.0-pro', apiKey: 'DASHSCOPE_API_KEY', baseUrl: 'DASHSCOPE_BASE_URL', modelKey: 'DASHSCOPE_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'dashscope' },
  { id: 'zai', name: 'Z.AI / BigModel', description: '智谱图像模型，支持 ZAI_* 和 BIGMODEL_* 兼容变量。', descriptionEn: 'Zhipu image models with ZAI_* and BIGMODEL_* compatible variables.', defaultBaseUrl: 'https://api.z.ai/api/paas/v4', defaultModel: 'glm-image', apiKey: 'ZAI_API_KEY', baseUrl: 'ZAI_BASE_URL', modelKey: 'ZAI_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'zai' },
  { id: 'minimax', name: 'MiniMax', description: 'MiniMax image-01 系列，支持自定义尺寸和 subject reference。', descriptionEn: 'MiniMax image-01 family with custom sizes and subject references.', defaultBaseUrl: 'https://api.minimaxi.com', defaultModel: 'image-01', apiKey: 'MINIMAX_API_KEY', baseUrl: 'MINIMAX_BASE_URL', modelKey: 'MINIMAX_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'minimax' },
  { id: 'replicate', name: 'Replicate', description: '社区模型托管，适合快速切换不同图片模型。', descriptionEn: 'Community model hosting, useful for quickly switching between image models.', defaultBaseUrl: 'https://api.replicate.com', defaultModel: 'google/nano-banana-2', apiKey: 'REPLICATE_API_TOKEN', baseUrl: 'REPLICATE_BASE_URL', modelKey: 'REPLICATE_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'replicate' },
  { id: 'seedream', name: 'Seedream / Ark', description: '火山方舟 Seedream 模型，使用 ARK_API_KEY。', descriptionEn: 'Volcengine Ark Seedream models using ARK_API_KEY.', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seedream-5-0-260128', apiKey: 'ARK_API_KEY', baseUrl: 'SEEDREAM_BASE_URL', modelKey: 'SEEDREAM_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'seedream' },
  { id: 'jimeng', name: 'Jimeng', description: '火山即梦模型，需要 Access Key 和 Secret Key。', descriptionEn: 'Volcengine Jimeng models requiring Access Key and Secret Key.', defaultBaseUrl: 'https://visual.volcengineapi.com', defaultModel: 'jimeng_t2i_v40', baseUrl: 'JIMENG_BASE_URL', modelKey: 'JIMENG_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'jimeng', extraFields: [{ key: 'JIMENG_ACCESS_KEY_ID', label: 'Access Key ID', type: 'password' }, { key: 'JIMENG_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'password' }, { key: 'JIMENG_REGION', label: 'Region', placeholder: 'cn-north-1' }] },
]

interface PreferenceTarget {
  scope: string
  label: string
  path: string
  exists: boolean
}

interface PreferenceInfo {
  found: boolean
  path: string | null
  scope: string | null
  values: Record<string, any>
  summary: Array<{ key: string; value: string }>
  targets: PreferenceTarget[]
}

interface DependencyCheck {
  id: string
  label: string
  ok: boolean
  required: boolean
  description: string
  hint?: string
  installLabel: string
  installUrl: string
}

interface DependencyResponse {
  ok: boolean
  skillsRoot?: {
    root: string
    source: string
    exists: boolean
    missing: string[]
    ready: boolean
  }
  checks: DependencyCheck[]
}

interface ProviderDialog {
  kind: ProviderKind
  providerId: string
}

function isMasked(value: string | undefined) {
  return Boolean(value?.startsWith('••••••••'))
}

function hasValue(settings: Record<string, string>, key?: string) {
  if (!key) return false
  const value = settings[key]
  return Boolean(value && String(value).trim())
}

function settingDisplay(settings: Record<string, string>, drafts: Record<string, string>, key?: string) {
  if (!key) return ''
  return drafts[key] || settings[key] || ''
}

function providerFields(provider: ProviderDefinition): ProviderField[] {
  return [
    ...(provider.nameKey ? [{ key: provider.nameKey, label: 'Display Name', placeholder: provider.nameEn || provider.name }] : []),
    ...(provider.apiKey ? [{ key: provider.apiKey, label: 'API Key', type: 'password' as const }] : []),
    ...(provider.baseUrl ? [{ key: provider.baseUrl, label: 'Base URL', placeholder: provider.defaultBaseUrl }] : []),
    { key: provider.modelKey, label: provider.id === 'azure' ? 'Deployment / Model' : 'Model', placeholder: provider.defaultModel },
    ...(provider.extraFields || []),
  ]
}

function providerTitle(provider: ProviderDefinition, settings: Record<string, string>, drafts: Record<string, string>) {
  return provider.nameKey ? (settingDisplay(settings, drafts, provider.nameKey) || provider.name) : provider.name
}

function localizedProviderTitle(provider: ProviderDefinition, settings: Record<string, string>, drafts: Record<string, string>, lang: AppLanguage) {
  const title = providerTitle(provider, settings, drafts)
  if (lang === 'en' && title === provider.name) return provider.nameEn || provider.name
  return title
}

function localizedProviderDescription(provider: ProviderDefinition, lang: AppLanguage) {
  return lang === 'en' ? provider.descriptionEn || provider.description : provider.description
}

function credentialFields(provider: ProviderDefinition) {
  return [
    ...(provider.apiKey ? [{ key: provider.apiKey, label: 'API Key' }] : []),
    ...(provider.extraFields || [])
      .filter(field => field.type === 'password')
      .map(field => ({ key: field.key, label: field.label })),
  ]
}

function credentialDisplay(provider: ProviderDefinition, settings: Record<string, string>) {
  const field = credentialFields(provider).find(item => hasValue(settings, item.key))
  if (!field) return { label: provider.apiKey ? 'API Key' : 'Credential', value: 'Not set' }
  return { label: field.label, value: settings[field.key] }
}

function getNested(value: any, path: string) {
  return path.split('.').reduce((acc, key) => acc?.[key], value)
}

function setNested(target: Record<string, any>, path: string, value: unknown) {
  const parts = path.split('.')
  let cursor = target
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {}
    cursor = cursor[part]
  }
  cursor[parts[parts.length - 1]] = value
}

function nestedName(value: any) {
  if (!value) return ''
  if (typeof value === 'object') return String(value.name || '')
  return String(value)
}

function boolFrom(value: any, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return value === true || value === 1 || value === '1' || value === 'true'
}

function draftFromPreference(info: PreferenceInfo | null, schema: PreferenceSchema | null): PreferenceDraft {
  const values = info?.values || {}
  const draft: PreferenceDraft = { scope: 'config' }
  for (const field of schema?.fields || []) {
    const current = getNested(values, field.skillPath)
    if (field.type === 'boolean') draft[field.key] = boolFrom(current, Boolean(field.defaultValue))
    else if (field.type === 'number') draft[field.key] = String(current ?? field.defaultValue ?? '')
    else draft[field.key] = nestedName(current ?? field.defaultValue ?? '')
  }
  return draft
}

function valuesFromPreferenceDraft(draft: PreferenceDraft, schema: PreferenceSchema | null) {
  const values: Record<string, any> = {}
  for (const field of schema?.fields || []) {
    const raw = draft[field.key]
    if (raw === '' || raw === undefined) continue
    const value = field.type === 'number' ? Number(raw) : raw
    setNested(values, field.skillPath, value)
  }
  return values
}

const getProviderLogo = (id: string, name: string) => {
  let gradient = 'from-zinc-700 to-zinc-900'
  let text = name.substring(0, 2).toUpperCase()
  
  if (id.includes('openai')) {
    gradient = 'from-emerald-600 to-teal-800 animate-shimmer'
    text = 'AI'
  } else if (id.includes('anthropic')) {
    gradient = 'from-orange-500 to-amber-700'
    text = 'CL'
  } else if (id === 'google') {
    gradient = 'from-blue-500 via-red-500 to-yellow-500'
    text = 'GE'
  } else if (id === 'azure') {
    gradient = 'from-sky-500 to-indigo-650'
    text = 'AZ'
  } else if (id === 'openrouter') {
    gradient = 'from-purple-650 to-indigo-850'
    text = 'OR'
  } else if (id === 'dashscope') {
    gradient = 'from-teal-600 to-cyan-700'
    text = 'QS'
  } else if (id === 'minimax') {
    gradient = 'from-pink-500 to-rose-700'
    text = 'MM'
  } else if (id === 'jimeng') {
    gradient = 'from-red-500 to-orange-600'
    text = 'JM'
  } else if (id === 'seedream') {
    gradient = 'from-emerald-500 to-teal-600'
    text = 'SD'
  } else if (id === 'zai') {
    gradient = 'from-violet-500 to-fuchsia-600'
    text = 'GL'
  }
  
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-extrabold text-xs text-white shadow-md shrink-0`}>
      {text}
    </div>
  )
}

function PreferenceField({ field, value, onChange, layout = 'col' }: { field: SchemaField; value: string | number | boolean | undefined; onChange: (value: string | number | boolean) => void; layout?: 'row' | 'col' }) {
  if (layout === 'row') {
    if (field.type === 'boolean') {
      return (
        <div className="settings-row-item">
          <div className="settings-row-info">
            <span className="settings-row-title">{field.labelZh}</span>
            {field.hint && <span className="settings-row-desc">{field.hint}</span>}
          </div>
          <div className="settings-row-control">
            <label className="custom-toggle">
              <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
              <div className="custom-toggle-track">
                <div className="custom-toggle-thumb" />
              </div>
            </label>
          </div>
        </div>
      )
    }

    return (
      <div className="settings-row-item">
        <div className="settings-row-info">
          <span className="settings-row-title">{field.labelZh}</span>
          {field.hint && <span className="settings-row-desc">{field.hint}</span>}
        </div>
        <div className="settings-row-control w-full max-w-[240px]">
          {field.type === 'select' ? (
            <div className="settings-select-wrapper">
              <select
                value={String(value ?? field.defaultValue ?? '')}
                onChange={e => onChange(e.target.value)}
                className="settings-select-premium"
              >
                {(field.options || []).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="settings-select-arrow">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          ) : field.type === 'textarea' ? (
            <textarea
              value={String(value ?? '')}
              placeholder={field.placeholder}
              onChange={e => onChange(e.target.value)}
              rows={2}
              className="settings-input-premium w-full resize-y font-mono"
            />
          ) : (
            <input
              type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
              min={field.min}
              max={field.max}
              step={field.step}
              value={String(value ?? '')}
              placeholder={field.placeholder}
              onChange={e => onChange(e.target.value)}
              className="settings-input-premium"
            />
          )}
        </div>
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center py-2 shrink-0">
        <label className="custom-toggle">
          <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
          <div className="custom-toggle-track">
            <div className="custom-toggle-thumb" />
          </div>
          <span className="ml-3 text-xs font-semibold text-zinc-200">{field.labelZh}</span>
        </label>
        {field.hint && <span className="ml-2.5 text-[10px] text-zinc-500">({field.hint})</span>}
      </div>
    )
  }

  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
      <span className="text-zinc-300">{field.labelZh}</span>
      {field.type === 'select' ? (
        <div className="settings-select-wrapper">
          <select value={String(value ?? field.defaultValue ?? '')} onChange={e => onChange(e.target.value)} className="settings-select-premium">
            {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="settings-select-arrow">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      ) : field.type === 'textarea' ? (
        <textarea value={String(value ?? '')} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} rows={3} className="settings-input-premium w-full resize-y font-mono" />
      ) : (
        <input
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          min={field.min}
          max={field.max}
          step={field.step}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          className="settings-input-premium"
        />
      )}
      {field.hint && <small className="mt-0.5 text-[10px] font-normal text-zinc-500 leading-normal">{field.hint}</small>}
    </label>
  )
}

function DependencyAction({ check }: { check: DependencyCheck }) {
  const className = 'inline-flex max-w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 no-underline transition hover:border-indigo-500 hover:text-white'
  if (check.installUrl.startsWith('/')) return <a href={check.installUrl} className={className}>{check.installLabel}</a>
  return <a href={check.installUrl} target="_blank" rel="noreferrer" className={className}>{check.installLabel}</a>
}

function localizedDependency(check: DependencyCheck, lang: AppLanguage) {
  if (lang !== 'en') return check
  const map: Record<string, Partial<DependencyCheck>> = {
    'baoyu-skills': {
      label: 'Built-in Skills',
      description: check.ok ? 'Project-bundled skills are ready.' : 'Project-bundled skills are incomplete.',
      installLabel: 'View Environment Status',
    },
    'script-runtime': {
      label: 'Skill Script Runtime',
      description: 'baoyu-skills needs Node.js or npx to run internal scripts. Installing Node.js is usually enough.',
      installLabel: 'Install Node.js',
    },
    claude: {
      label: 'Claude Code CLI',
      description: 'Optional: install or sign in to Claude Code if you want to reuse the full Claude Code skill workflow.',
      installLabel: 'Install Claude Code',
    },
    git: {
      label: 'Git',
      description: 'Used to read GitHub and local project context.',
      installLabel: 'Install Git',
    },
    chrome: {
      label: 'Chrome',
      description: 'Used for desktop mode, WeChat/Weibo/X publishing sessions, and CDP automation.',
      installLabel: 'Install Chrome',
    },
    anthropic: {
      label: 'Anthropic API Key / Auth Token',
      description: 'If you do not use Claude Code CLI auth, configure an API key in Settings.',
      installLabel: 'Open Settings',
    },
    'image-backend': {
      label: 'Image Backend Key',
      description: 'Image generation requires at least one provider supported by baoyu-imagine.',
      installLabel: 'Configure Image Model',
    },
  }
  return { ...check, ...(map[check.id] || {}) }
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('environment')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [dependencies, setDependencies] = useState<DependencyResponse | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [prefSkillId, setPrefSkillId] = useState(skills[0].id)
  const [preferenceSchema, setPreferenceSchema] = useState<PreferenceSchema | null>(null)
  const [preferenceInfo, setPreferenceInfo] = useState<PreferenceInfo | null>(null)
  const [preferenceDraft, setPreferenceDraft] = useState<PreferenceDraft>(() => draftFromPreference(null, null))
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null)
  const [publishScope, setPublishScope] = useState('project')
  const [publishAccountName, setPublishAccountName] = useState('')
  const [publishAccountAlias, setPublishAccountAlias] = useState('')
  const [publishSchema, setPublishSchema] = useState<PreferenceSchema | null>(null)
  const [publishPreferenceDraft, setPublishPreferenceDraft] = useState<PreferenceDraft>({})
  const [publishStatus, setPublishStatus] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [providerDialog, setProviderDialog] = useState<ProviderDialog | null>(null)
  const [providerDraft, setProviderDraft] = useState<Record<string, string>>({})
  const [providerStatus, setProviderStatus] = useState<string | null>(null)
  const [providerTestStatus, setProviderTestStatus] = useState<Record<string, { ok?: boolean; text: string; loading?: boolean }>>({})
  const [modelTab, setModelTab] = useState<'execution' | 'image'>('execution')
  
  // Custom states
  const [isBrowserExpanded, setIsBrowserExpanded] = useState(false)

  const lang = useMemo(() => {
    return normalizeLanguage(settings.DEFAULT_LANGUAGE || drafts.DEFAULT_LANGUAGE)
  }, [settings.DEFAULT_LANGUAGE, drafts.DEFAULT_LANGUAGE])

  const refreshDependencies = () => {
    return fetch('/api/dependencies')
      .then(r => r.json())
      .then(data => {
        setDependencies(data)
        return data
      })
      .catch(() => {
        setDependencies(null)
        return null
      })
  }

  useEffect(() => {
    refreshDependencies()

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data)
        setDrafts(Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, isMasked(String(value)) ? '' : String(value)]),
        ))
      })
      .catch(() => undefined)

    fetch('/api/accounts/wechat')
      .then(r => r.json())
      .then(data => {
        const account = data.accounts?.find((item: any) => item.isDefault) || data.accounts?.[0]
        if (!account) return
        setPublishAccountName(account.name || '')
        setPublishAccountAlias(account.alias === 'default' ? '' : account.alias || '')
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/preferences/${prefSkillId}`).then(r => r.json()),
      fetch(`/api/preferences/${prefSkillId}/schema`).then(r => r.json()),
    ])
      .then(([info, schema]) => {
        setPreferenceInfo(info)
        setPreferenceSchema(schema)
        setPreferenceDraft(draftFromPreference(info, schema))
      })
      .catch(() => {
        setPreferenceInfo(null)
        setPreferenceSchema(null)
        setPreferenceDraft(draftFromPreference(null, null))
      })
  }, [prefSkillId])

  useEffect(() => {
    const skillId = 'post-to-wechat'
    Promise.all([
      fetch(`/api/preferences/${skillId}`).then(r => r.json()),
      fetch(`/api/preferences/${skillId}/schema`).then(r => r.json()),
    ])
      .then(([info, schema]) => {
        if (info.error) { setPublishSchema(null); setPublishPreferenceDraft({}); return }
        setPublishSchema(schema)
        setPublishPreferenceDraft(draftFromPreference(info, schema))
        const account = (info.values?.accounts as any[])?.[0]
        if (account) {
          setPublishAccountName(account.name || '')
          setPublishAccountAlias(account.alias === 'default' ? '' : account.alias || '')
        }
      })
      .catch(() => {
        setPublishSchema(null)
        setPublishPreferenceDraft({})
      })
  }, [])

  const save = async (key: string, overrideValue?: string) => {
    const value = overrideValue !== undefined ? overrideValue : (drafts[key] ?? '')
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    const data = await res.json()
    if (data.success) {
      setSettings(prev => ({ ...prev, [key]: data.display }))
      setDrafts(prev => ({ ...prev, [key]: data.display }))
      setSaved(key)
      if (key === 'THEME_COLOR') applyAccent(value)
      if (key === 'THEME_MODE') applyTheme(value)
      if (key === 'DEFAULT_LANGUAGE') setAppLanguage(value)
      window.setTimeout(() => setSaved(null), 1800)
    }
  }

  const saveMany = async (values: Record<string, string>) => {
    const nextSettings: Record<string, string> = {}
    const nextDrafts: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || `Failed to save ${key}`)
      nextSettings[key] = data.display
      nextDrafts[key] = data.display
    }
    setSettings(prev => ({ ...prev, ...nextSettings }))
    setDrafts(prev => ({ ...prev, ...nextDrafts }))
  }

  const openProviderDialog = (kind: ProviderKind, providerId: string) => {
    const provider = (kind === 'image' ? imageProviders : executionProviders).find(item => item.id === providerId)
    if (!provider) return
    const draft: Record<string, string> = {}
    for (const field of providerFields(provider)) {
      const current = settings[field.key]
      draft[field.key] = isMasked(current) ? '' : (drafts[field.key] || current || field.placeholder || '')
    }
    setProviderDraft(draft)
    setProviderStatus(null)
    setProviderDialog({ kind, providerId })
  }

  const closeProviderDialog = () => {
    setProviderDialog(null)
    setProviderDraft({})
  }

  const saveProvider = async () => {
    if (!providerDialog) return
    const provider = (providerDialog.kind === 'image' ? imageProviders : executionProviders).find(item => item.id === providerDialog.providerId)
    if (!provider) return
    const values: Record<string, string> = {}
    for (const field of providerFields(provider)) {
      const value = (providerDraft[field.key] ?? '').trim()
      if (!value && isMasked(settings[field.key])) continue
      if (value) values[field.key] = value
    }
    if (providerDialog.kind === 'image') {
      values[provider.defaultKey] = provider.defaultValue
      if (!values[provider.modelKey]) values[provider.modelKey] = provider.defaultModel
      if (provider.baseUrl && !values[provider.baseUrl]) values[provider.baseUrl] = provider.defaultBaseUrl || ''
    } else {
      if (!values[provider.modelKey]) values[provider.modelKey] = provider.defaultModel
      if (provider.baseUrl && !values[provider.baseUrl]) values[provider.baseUrl] = provider.defaultBaseUrl || ''
    }
    setProviderStatus(t(lang, 'provider.saving'))
    try {
      await saveMany(values)
      setProviderStatus(t(lang, 'provider.saved'))
      window.setTimeout(() => closeProviderDialog(), 600)
    } catch (err: any) {
      setProviderStatus(err.message || L(lang, '保存失败', 'Save failed'))
    }
  }

  const setDefaultProvider = async (provider: ProviderDefinition, kind: ProviderKind) => {
    const values: Record<string, string> = {}
    if (kind === 'image') {
      values.IMAGE_BACKEND = provider.defaultValue
      const model = settingDisplay(settings, drafts, provider.modelKey) || provider.defaultModel
      values[provider.modelKey] = model
    } else {
      values.ANTHROPIC_MODEL = settingDisplay(settings, drafts, provider.modelKey) || provider.defaultModel
    }
    await saveMany(values)
    setProviderStatus(`${localizedProviderTitle(provider, settings, drafts, lang)}${t(lang, 'provider.set_default_done')}`)
    window.setTimeout(() => setProviderStatus(null), 1800)
  }

  const testProvider = async (provider: ProviderDefinition, kind: ProviderKind) => {
    const key = `${kind}:${provider.id}`
    setProviderTestStatus(prev => ({ ...prev, [key]: { loading: true, text: t(lang, 'models.testing') } }))
    try {
      const res = await fetch('/api/settings/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, providerId: provider.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || t(lang, 'models.test_failed'))
      setProviderTestStatus(prev => ({ ...prev, [key]: { ok: true, text: data.message || t(lang, 'models.test_success') } }))
    } catch (err: any) {
      setProviderTestStatus(prev => ({ ...prev, [key]: { ok: false, text: err.message || t(lang, 'models.test_failed') } }))
    }
  }

  const openSession = async (platform: string, accountAlias = '') => {
    setSessionStatus(t(lang, 'session.opening', { platform }))
    const res = await fetch('/api/session/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, accountAlias }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSessionStatus(data.error || t(lang, 'session.open_failed'))
      return
    }
    setSessionStatus(t(lang, 'session.opened', { platform, dir: data.profileDir }))
  }

  const savePreference = async () => {
    setPreferenceStatus(t(lang, 'prefs.saving'))
    const res = await fetch(`/api/preferences/${prefSkillId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: preferenceDraft.scope,
        currentPath: preferenceInfo?.path,
        values: valuesFromPreferenceDraft(preferenceDraft, preferenceSchema),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPreferenceStatus(data.error || L(lang, '保存失败', 'Save failed'))
      return
    }
    setPreferenceInfo(data)
    setPreferenceStatus(`${t(lang, 'prefs.saved_to')} ${data.path}`)
  }

  const savePublishAccount = async () => {
    setPublishStatus(L(lang, '正在保存公众号账号...', 'Saving WeChat account...'))
    const schemaFields = publishSchema?.fields || []
    const accountConfig: Record<string, any> = {
      name: publishAccountName || L(lang, '公众号账号', 'WeChat Account'),
      alias: publishAccountAlias || 'default',
      default: true,
    }
    for (const field of schemaFields) {
      const raw = publishPreferenceDraft[field.key]
      if (raw === '' || raw === undefined || raw === null) continue
      const key = field.skillPath.split('.').pop()!
      if (field.type === 'boolean') accountConfig[key] = raw === true || raw === 'true' ? 1 : 0
      else if (field.type === 'number') accountConfig[key] = Number(raw)
      else accountConfig[key] = raw
    }
    const res = await fetch('/api/preferences/post-to-wechat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: publishScope,
        values: { accounts: [accountConfig] },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setPublishStatus(data.error || L(lang, '保存失败', 'Save failed'))
      return
    }
    setPublishStatus(L(lang, `公众号配置已保存到 ${data.path}`, `WeChat config saved to ${data.path}`))
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/settings/raw')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'happyimage-settings-backup.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setImportStatus(t(lang, 'backup.export_success'))
      setTimeout(() => setImportStatus(null), 3000)
    } catch {
      setImportStatus(t(lang, 'backup.export_fail'))
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus(t(lang, 'backup.importing'))
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSettings(data.settings)
        setDrafts(Object.fromEntries(
          Object.entries(data.settings).map(([key, value]) => [key, isMasked(String(value)) ? '' : String(value)]),
        ))
        setImportStatus(t(lang, 'backup.import_success'))
        setTimeout(() => setImportStatus(null), 3000)
      } else {
        setImportStatus(data.error || t(lang, 'backup.import_fail'))
      }
    } catch {
      setImportStatus(t(lang, 'backup.import_parse_fail'))
    }
  }

  // Dashboard state summary for environment
  const checkSummary = useMemo(() => {
    if (!dependencies) return { status: 'loading', text: L(lang, '正在检查环境...', 'Checking environment...'), icon: RefreshCw, color: 'indigo' }
    const totalRequired = dependencies.checks.filter(c => c.required).length
    const okRequired = dependencies.checks.filter(c => c.required && c.ok).length
    const skillsRootReady = dependencies.skillsRoot?.ready || false
    
    if (okRequired === totalRequired && skillsRootReady) {
      return { status: 'success', text: L(lang, '系统依赖与内置技能均已就绪', 'System dependencies and built-in skills are ready'), icon: CheckCircle2, color: 'emerald' }
    } else if (okRequired === totalRequired) {
      return { status: 'warning', text: L(lang, '运行环境就绪，但内置技能不完整', 'Runtime is ready, but built-in skills are incomplete'), icon: AlertTriangle, color: 'amber' }
    } else {
      return { status: 'error', text: L(lang, '缺少运行 HappyImage 所需的关键依赖', 'Missing required dependencies for HappyImage'), icon: XCircle, color: 'red' }
    }
  }, [dependencies, lang])

  const themeModes = [
    { value: 'dark', label: L(lang, '深色 (默认)', 'Dark (Default)') },
    { value: 'light', label: L(lang, '浅色', 'Light') },
    { value: 'system', label: L(lang, '跟随系统', 'System') },
  ]
  const themeColors = [
    { value: 'indigo', label: L(lang, '靛青 (默认)', 'Indigo (Default)') },
    { value: 'emerald', label: L(lang, '翡翠绿', 'Emerald') },
    { value: 'rose', label: L(lang, '玫红', 'Rose') },
    { value: 'amber', label: L(lang, '琥珀黄', 'Amber') },
    { value: 'cyan', label: L(lang, '青蓝', 'Cyan') },
    { value: 'violet', label: L(lang, '紫罗兰', 'Violet') },
  ]
  const aspectRatios = [
    { value: '1:1', label: L(lang, '1:1 方形', '1:1 Square') },
    { value: '16:9', label: L(lang, '16:9 宽屏', '16:9 Widescreen') },
    { value: '9:16', label: L(lang, '9:16 竖屏', '9:16 Vertical') },
    { value: '4:3', label: L(lang, '4:3 标准', '4:3 Standard') },
    { value: '3:4', label: L(lang, '3:4 竖版', '3:4 Portrait') },
  ]
  const languages = [
    { value: 'zh', label: L(lang, '中文', 'Chinese') },
    { value: 'en', label: 'English' },
    { value: 'ja', label: L(lang, '日本語', 'Japanese') },
  ]
  const bgColorMap: Record<string, string> = {
    indigo: '#6366f1', emerald: '#10b981', rose: '#f43f5e',
    amber: '#f59e0b', cyan: '#06b6d4', violet: '#8b5cf6',
  }

  const renderPreferencesSection = () => (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Appearance Group */}
      <section className="studio-panel">
        <h2>{t(lang, 'prefs.appearance_title')}</h2>
        <div className="mt-4 flex flex-col">
          {/* Theme Mode Row */}
          <div className="settings-row-item">
            <div className="settings-row-info">
              <span className="settings-row-title">{t(lang, 'prefs.theme_mode')}</span>
              <span className="settings-row-desc">{L(lang, '选择界面的显示主题模式', 'Select the display theme mode for the interface')}</span>
            </div>
            <div className="settings-row-control">
              <div className="flex rounded-lg bg-zinc-950 border border-zinc-850 p-0.5 w-fit">
                {themeModes.map(opt => {
                  const isSelected = (drafts.THEME_MODE || settings.THEME_MODE) === opt.value
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => { setDrafts(prev => ({ ...prev, THEME_MODE: opt.value })); save('THEME_MODE', opt.value) }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${isSelected ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'}`}>
                      {opt.label.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Theme Color Row */}
          <div className="settings-row-item">
            <div className="settings-row-info">
              <span className="settings-row-title">{t(lang, 'prefs.theme_color')}</span>
              <span className="settings-row-desc">{L(lang, '配置界面的高亮颜色主题', 'Configure the accent color for the interface')}</span>
            </div>
            <div className="settings-row-control">
              <div className="flex items-center gap-2.5 py-1 flex-wrap">
                {themeColors.map(opt => {
                  const isSelected = (drafts.THEME_COLOR || settings.THEME_COLOR) === opt.value
                  const colorValue = bgColorMap[opt.value] || '#6366f1'
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      onClick={() => {
                        setDrafts(prev => ({ ...prev, THEME_COLOR: opt.value }))
                        save('THEME_COLOR', opt.value)
                      }}
                      className={`theme-swatch-btn ${isSelected ? 'active' : ''}`}
                      style={{
                        backgroundColor: colorValue,
                        '--swatch-color': colorValue,
                      } as React.CSSProperties}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Language Row */}
          <div className="settings-row-item">
            <div className="settings-row-info">
              <span className="settings-row-title">{t(lang, 'prefs.language')}</span>
              <span className="settings-row-desc">{L(lang, '设置系统的默认显示语言', 'Set the default display language for the system')}</span>
            </div>
            <div className="settings-row-control w-full max-w-[200px]">
              <div className="settings-select-wrapper">
                <select value={drafts.DEFAULT_LANGUAGE || settings.DEFAULT_LANGUAGE || ''}
                  onChange={e => { const v = e.target.value; setDrafts(prev => ({ ...prev, DEFAULT_LANGUAGE: v })); save('DEFAULT_LANGUAGE', v) }}
                  className="settings-select-premium">
                  {languages.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className="settings-select-arrow">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Defaults Group */}
      <section className="studio-panel">
        <h2>{t(lang, 'prefs.defaults_title')}</h2>
        <div className="mt-4 flex flex-col">
          {/* Output Directory Row */}
          <div className="settings-row-item">
            <div className="settings-row-info">
              <span className="settings-row-title">{t(lang, 'prefs.output_dir')}</span>
              <span className="settings-row-desc">{L(lang, '文件和生成的图片保存的默认本地路径', 'Default local path where generated files and images are saved')}</span>
            </div>
            <div className="settings-row-control flex-1 max-w-md gap-2">
              <input type="text" value={drafts.OUTPUT_DIR || ''} placeholder={settings.OUTPUT_DIR || ''}
                onChange={e => setDrafts(prev => ({ ...prev, OUTPUT_DIR: e.target.value }))}
                className="settings-input-premium" />
              <Button size="sm" disabled={!drafts.OUTPUT_DIR && isMasked(settings.OUTPUT_DIR)} onClick={() => save('OUTPUT_DIR')}>
                {saved === 'OUTPUT_DIR' ? t(lang, 'btn.saved') : t(lang, 'btn.save')}
              </Button>
            </div>
          </div>

          {/* Aspect Ratio Row */}
          <div className="settings-row-item">
            <div className="settings-row-info">
              <span className="settings-row-title">{t(lang, 'prefs.aspect_ratio')}</span>
              <span className="settings-row-desc">{L(lang, '在创作台中新建任务时的默认宽高比例', 'Default aspect ratio when creating new tasks in the studio')}</span>
            </div>
            <div className="settings-row-control w-full max-w-[200px]">
              <div className="settings-select-wrapper">
                <select value={drafts.DEFAULT_ASPECT_RATIO || settings.DEFAULT_ASPECT_RATIO || ''}
                  onChange={e => { const v = e.target.value; setDrafts(prev => ({ ...prev, DEFAULT_ASPECT_RATIO: v })); save('DEFAULT_ASPECT_RATIO', v) }}
                  className="settings-select-premium">
                  {aspectRatios.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className="settings-select-arrow">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Skip Plan Confirmation Row */}
          <div className="settings-row-item">
            <div className="settings-row-info">
              <span className="settings-row-title">{t(lang, 'prefs.skip_plan')}</span>
              <span className="settings-row-desc">{t(lang, 'prefs.skip_plan_hint')}</span>
            </div>
            <div className="settings-row-control">
              <label className="custom-toggle">
                <input type="checkbox" checked={drafts.SKIP_PLAN_CONFIRMATION === 'true' || drafts.SKIP_PLAN_CONFIRMATION === '1'}
                  onChange={e => { const v = e.target.checked ? 'true' : 'false'; setDrafts(prev => ({ ...prev, SKIP_PLAN_CONFIRMATION: v })); save('SKIP_PLAN_CONFIRMATION', v) }} />
                <div className="custom-toggle-track">
                  <div className="custom-toggle-thumb" />
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Skill specific Preferences */}
      <section className="studio-panel settings-preference-panel">
        <div className="studio-panel-head">
          <div>
            <p className="studio-eyebrow">{t(lang, 'prefs.skill_eyebrow')}</p>
            <h2>{t(lang, 'prefs.skill_title')}</h2>
          </div>
          <span className="text-xs bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 font-semibold shadow-sm">
            {preferenceInfo?.found ? t(lang, 'env.status_found') : t(lang, 'env.status_new')}
          </span>
        </div>
        <div className="settings-form-grid mt-4">
          <div className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
            <span className="text-zinc-300">{t(lang, 'prefs.skill_select')}</span>
            <div className="settings-select-wrapper">
              <select value={prefSkillId} onChange={e => setPrefSkillId(e.target.value)} className="settings-select-premium">
                {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.nameZh}</option>)}
              </select>
              <div className="settings-select-arrow">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          {(preferenceSchema?.fields || []).filter(field => field.type !== 'boolean').map(field => (
            <PreferenceField key={field.key} field={field} value={preferenceDraft[field.key]} layout="col"
              onChange={value => setPreferenceDraft(prev => ({ ...prev, [field.key]: value }))} />
          ))}
        </div>
        <div className="mt-6 border-t border-zinc-850/50 pt-4 flex flex-wrap gap-x-6 gap-y-2">
          {(preferenceSchema?.fields || []).filter(field => field.type === 'boolean').map(field => (
            <PreferenceField key={field.key} field={field} value={preferenceDraft[field.key]} layout="col"
              onChange={value => setPreferenceDraft(prev => ({ ...prev, [field.key]: value }))} />
          ))}
        </div>
        <div className="settings-inline-actions mt-4 flex items-center justify-between gap-4">
          <Button onClick={savePreference}>{t(lang, 'prefs.save_skill')}</Button>
          {preferenceStatus && <div className="text-xs text-indigo-400 truncate max-w-md">{preferenceStatus}</div>}
        </div>
      </section>
    </div>
  )

  const renderEnvironment = () => {
    return (
      <div className="flex flex-col gap-6">
        <section className="relative overflow-hidden rounded-2xl border border-zinc-850 bg-gradient-to-br from-zinc-900/80 to-indigo-950/10 p-5 shadow-xl">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className={`p-3 rounded-2xl bg-zinc-950/80 border border-zinc-850 flex items-center justify-center ${checkSummary.color === 'emerald' ? 'text-emerald-400' : checkSummary.color === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
              <checkSummary.icon className={`h-6 w-6 ${checkSummary.status === 'loading' ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{t(lang, 'env.eyebrow')}</p>
              <h2 className="mt-1 text-base font-extrabold text-zinc-100">{checkSummary.text}</h2>
              <p className="text-xs text-zinc-400 mt-1">
                {dependencies?.skillsRoot?.ready ? t(lang, 'env.project_skills_ready') : t(lang, 'env.need_skills_dir')}
              </p>
            </div>
          </div>
        </section>

        <section className="studio-panel">
          <h2>{L(lang, '系统诊断检查', 'System Diagnostic Checks')}</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(dependencies?.checks || []).map(check => (
              <div key={check.id} className="min-w-0 rounded-2xl border border-zinc-850 bg-zinc-950/15 p-4 flex flex-col justify-between hover:bg-zinc-950/30 transition-all duration-200">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${check.ok ? 'glowing-dot-green' : check.required ? 'glowing-dot-red' : 'glowing-dot-amber'}`} style={{ backgroundColor: 'currentColor' }} />
                      <h3 className="min-w-0 break-words text-sm font-bold text-zinc-200">{localizedDependency(check, lang).label}</h3>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase border shadow-sm ${
                      check.ok 
                        ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40' 
                        : check.required 
                          ? 'bg-red-950/20 text-red-400 border-red-900/40' 
                          : 'bg-amber-950/20 text-amber-400 border-amber-900/40'
                    }`}>
                      {check.ok ? t(lang, 'env.status_ok') : check.required ? t(lang, 'env.status_required') : t(lang, 'env.status_optional')}
                    </span>
                  </div>
                  <p className="mt-2 min-w-0 break-words text-xs leading-normal text-zinc-400 [overflow-wrap:anywhere]">{localizedDependency(check, lang).description}</p>
                  {check.hint ? <p className="mt-1.5 min-w-0 break-words text-[10px] leading-relaxed text-emerald-400/90 font-medium [overflow-wrap:anywhere]">{check.hint}</p> : null}
                </div>
                {!check.ok && (
                  <div className="mt-4 min-w-0 pt-3 border-t border-zinc-850/40">
                    <DependencyAction check={localizedDependency(check, lang)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  const renderSocialPublish = () => {
    const chromeProfileFields = [
      ['BAOYU_CHROME_PROFILE_DIR', L(lang, '共用 Chrome Profile', 'Shared Chrome Profile'), 'text'],
      ['WECHAT_BROWSER_PROFILE_DIR', L(lang, '微信 Profile 覆盖', 'WeChat Profile Override'), 'text'],
      ['WEIBO_BROWSER_PROFILE_DIR', L(lang, '微博 Profile 覆盖', 'Weibo Profile Override'), 'text'],
      ['X_BROWSER_PROFILE_DIR', L(lang, 'X Profile 覆盖', 'X Profile Override'), 'text'],
      ['XHS_BROWSER_PROFILE_DIR', L(lang, '小红书 Profile 覆盖', 'Xiaohongshu Profile Override'), 'text'],
      ['WECHAT_APP_ID', '微信 App ID', 'text'],
      ['WECHAT_APP_SECRET', '微信 App Secret', 'password'],
      ['WECHAT_BROWSER_CHROME_PATH', L(lang, '微信 Chrome 路径', 'WeChat Chrome Path'), 'text'],
      ['WEIBO_BROWSER_CHROME_PATH', L(lang, '微博 Chrome 路径', 'Weibo Chrome Path'), 'text'],
      ['X_BROWSER_CHROME_PATH', L(lang, 'X Chrome 路径', 'X Chrome Path'), 'text'],
      ['XHS_BROWSER_CHROME_PATH', L(lang, '小红书 Chrome 路径', 'Xiaohongshu Chrome Path'), 'text'],
    ] as const

    const platforms = [
      { id: 'wechat', name: L(lang, '微信公众号', 'WeChat Official Account'), class: 'platform-card-wechat', icon: 'WX', color: '#07c160', desc: L(lang, '支持 API 发送草稿箱或浏览器自动登录填稿', 'Supports API draft sending or browser-based auto-fill publishing') },
      { id: 'weibo', name: L(lang, '新浪微博', 'Sina Weibo'), class: 'platform-card-weibo', icon: 'WB', color: '#e6162d', desc: L(lang, '模拟浏览器进行图片上传与正文配图自动填充', 'Uses browser automation to upload images and fill post content') },
      { id: 'x', name: 'X / Twitter', class: 'platform-card-x', icon: 'X', color: '#18181b', desc: L(lang, '智能防检测剪贴板模拟粘贴快速完成图文发稿', 'Uses clipboard-based paste automation for image and text posting') },
      { id: 'xiaohongshu', name: L(lang, '小红书', 'Xiaohongshu'), class: 'platform-card-xhs', icon: 'RED', color: '#ff2442', desc: L(lang, '自动进入图文上传选项卡，适配 3:4 比例发布', 'Opens the image-post upload tab and supports 3:4 publishing') },
    ]

    return (
      <div className="flex flex-col gap-6">
        {/* Platform logins (Platform Sessions) */}
        <section className="studio-panel settings-session-panel">
          <div className="studio-panel-head">
            <div>
              <p className="studio-eyebrow">{t(lang, 'publish.sessions_eyebrow')}</p>
              <h2>{t(lang, 'publish.sessions_title')}</h2>
            </div>
            <span>sessions</span>
          </div>
          <p className="text-xs leading-normal text-zinc-400 mt-1">
            {t(lang, 'publish.sessions_note')}
          </p>
          
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            {platforms.map(p => (
              <div key={p.id} className={`platform-card ${p.class} rounded-2xl border p-4 flex items-center justify-between gap-4 bg-zinc-950/20`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-[11px] shadow-sm shrink-0" style={{ backgroundColor: p.color, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {p.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-200">{p.name}</h3>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{p.desc}</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openSession(p.id)} className="shrink-0">
                  {L(lang, '扫码登录', 'QR Login')}
                </Button>
              </div>
            ))}
          </div>
          {sessionStatus && <code className="block mt-4 text-xs text-indigo-400 p-2.5 rounded bg-zinc-950 border border-zinc-850 font-mono break-all">{sessionStatus}</code>}
        </section>

        {/* WeChat Account wizard */}
        <section className="studio-panel settings-preference-panel">
          <div className="studio-panel-head">
            <div>
              <p className="studio-eyebrow">{t(lang, 'publish.wechat_account_eyebrow')}</p>
              <h2>{t(lang, 'publish.wechat_account_title')}</h2>
            </div>
            <span>wechat</span>
          </div>
          <p className="text-xs leading-normal text-zinc-400 mt-1">
            {t(lang, 'publish.wechat_account_note')}
          </p>

          <div className="settings-form-grid mt-4">
            <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
              {t(lang, 'publish.save_scope')}
              <select value={publishScope} onChange={e => setPublishScope(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-zinc-250">
                <option value="project">{t(lang, 'publish.scope_project')}</option>
                <option value="config">{t(lang, 'publish.scope_global')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
              {t(lang, 'publish.account_name')}
              <input value={publishAccountName} placeholder={L(lang, '默认账号', 'Default account')} onChange={e => setPublishAccountName(e.target.value)} className="bg-zinc-950 border border-zinc-800" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
              {t(lang, 'publish.account_alias')}
              <input value={publishAccountAlias} placeholder="default" onChange={e => setPublishAccountAlias(e.target.value)} className="bg-zinc-950 border border-zinc-800" />
            </label>
            {(publishSchema?.fields || []).filter(field => field.type !== 'boolean').map(field => (
              <PreferenceField
                key={field.key}
                field={field}
                value={publishPreferenceDraft[field.key]}
                onChange={value => setPublishPreferenceDraft(prev => ({ ...prev, [field.key]: value }))}
              />
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-zinc-850/50 pt-4">
            {(publishSchema?.fields || []).filter(field => field.type === 'boolean').map(field => (
              <PreferenceField
                key={field.key}
                field={field}
                value={publishPreferenceDraft[field.key]}
                onChange={value => setPublishPreferenceDraft(prev => ({ ...prev, [field.key]: value }))}
              />
            ))}
          </div>
          <div className="settings-inline-actions mt-4 flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex gap-2">
              <Button onClick={savePublishAccount}>{t(lang, 'publish.save_account')}</Button>
              <Button variant="secondary" onClick={() => openSession('wechat', publishAccountAlias)}>
                {t(lang, 'publish.open_wechat_login')}
              </Button>
            </div>
            {publishStatus && <div className="text-xs text-indigo-400 truncate max-w-sm font-semibold">{publishStatus}</div>}
          </div>
        </section>

        {/* Collapsible Advanced Browser Configuration */}
        <section className="border border-zinc-800 bg-zinc-900/10 rounded-2xl p-4 transition-all">
          <button
            type="button"
            onClick={() => setIsBrowserExpanded(!isBrowserExpanded)}
            className="w-full flex items-center justify-between text-left focus:outline-none"
          >
            <span className="text-xs font-extrabold text-zinc-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
              {t(lang, 'publish.advanced_title')}
            </span>
            <span className="text-zinc-500 flex items-center gap-1 text-[10px] font-bold">
              {isBrowserExpanded ? (
                <>
                  {t(lang, 'publish.advanced_collapse')}
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  {t(lang, 'publish.advanced_expand')}
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </span>
          </button>

          {isBrowserExpanded && (
            <div className="mt-4 pt-4 border-t border-zinc-850/60 animate-scale-up">
              <p className="text-[10px] leading-relaxed text-zinc-500 mb-4">
                {t(lang, 'publish.advanced_note')}
              </p>
              <div className="settings-fields space-y-4">
                {chromeProfileFields
                  .filter(([key]) => key !== 'WECHAT_APP_ID' && key !== 'WECHAT_APP_SECRET')
                  .map(([key, label, type]) => (
                    <label key={key} className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
                      <span>{label}</span>
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type={type}
                          value={drafts[key] || ''}
                          placeholder={settings[key] || ''}
                          onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs"
                        />
                        <Button size="sm" disabled={!drafts[key] && isMasked(settings[key])} onClick={() => save(key)}>
                          {saved === key ? t(lang, 'btn.saved') : t(lang, 'btn.save')}
                        </Button>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  const renderBackup = () => (
    <section className="studio-panel settings-session-panel">
      <h2>{t(lang, 'backup.title')}</h2>
      <p className="text-xs text-zinc-400 mt-1">{t(lang, 'backup.description')}</p>
      
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {/* Export card */}
        <div className="backup-card border border-zinc-850 rounded-2xl p-5 bg-zinc-950/20 flex flex-col items-center justify-between text-center gap-4">
          <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 text-indigo-400 rounded-2xl">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-200">{t(lang, 'backup.export_title')}</h3>
            <p className="text-[10px] text-zinc-500 mt-1 max-w-xs leading-normal">{t(lang, 'backup.export_body')}</p>
          </div>
          <Button size="sm" onClick={handleExport}>{t(lang, 'backup.export')}</Button>
        </div>

        {/* Import card */}
        <div className="backup-card border border-zinc-850 rounded-2xl p-5 bg-zinc-950/20 flex flex-col items-center justify-between text-center gap-4">
          <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 rounded-2xl">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-200">{t(lang, 'backup.import_title')}</h3>
            <p className="text-[10px] text-zinc-500 mt-1 max-w-xs leading-normal">{t(lang, 'backup.import_body')}</p>
          </div>
          <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer transition-all border border-zinc-750 inline-flex items-center justify-center">
            {t(lang, 'backup.import')}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>
      {importStatus && <code className="block mt-4 text-xs text-indigo-450 text-indigo-400 p-2.5 rounded bg-zinc-950 border border-zinc-850 font-mono">{importStatus}</code>}
    </section>
  )

  const aboutLinks = [
    {
      icon: FileText,
      title: t(lang, 'about.release_notes'),
      body: t(lang, 'about.release_notes_body'),
      href: HAPPYIMAGE_RELEASES,
      action: t(lang, 'about.view_releases'),
    },
    {
      icon: RefreshCw,
      title: t(lang, 'about.check_updates'),
      body: t(lang, 'about.check_updates_body'),
      href: HAPPYIMAGE_RELEASES,
      action: t(lang, 'about.check_now'),
    },
    {
      icon: Globe2,
      title: t(lang, 'about.website'),
      body: HAPPYIMAGE_SITE,
      href: HAPPYIMAGE_SITE,
      action: t(lang, 'about.open_website'),
    },
    {
      icon: Mail,
      title: t(lang, 'about.contact'),
      body: t(lang, 'about.contact_body'),
      href: HAPPYIMAGE_SITE,
      action: t(lang, 'about.open_website'),
    },
    {
      icon: ExternalLink,
      title: t(lang, 'about.github'),
      body: HAPPYIMAGE_REPO,
      href: HAPPYIMAGE_REPO,
      action: t(lang, 'about.github'),
    },
  ]

  const renderAbout = () => (
    <div className="flex flex-col gap-5 animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-850 bg-gradient-to-br from-zinc-900/90 via-zinc-950/60 to-indigo-950/20 p-6 shadow-xl">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="studio-eyebrow">{t(lang, 'about.eyebrow')}</p>
            <h2 className="mt-1 text-xl font-extrabold text-zinc-100">HappyImage</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{t(lang, 'about.description')}</p>
          </div>
          <div className="rounded-2xl border border-indigo-400/50 bg-indigo-500/15 px-4 py-3 text-left shadow-sm md:min-w-48">
            <div className="text-[10px] font-extrabold tracking-widest text-indigo-200">{t(lang, 'about.version')}</div>
            <div className="mt-1 text-lg font-extrabold text-zinc-50">v{APP_VERSION}</div>
            <div className="mt-0.5 text-[10px] font-semibold text-zinc-300">{t(lang, 'about.version_note')}</div>
          </div>
        </div>
      </section>

      <section className="studio-panel border-zinc-750 bg-zinc-950/35">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/15 p-3 text-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="studio-eyebrow">{t(lang, 'about.ownership')}</p>
            <h2>HappyToken</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">{t(lang, 'about.ownership_body')}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {aboutLinks.map(item => {
          const Icon = item.icon
          return (
            <a
              key={item.title}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-zinc-750 bg-zinc-950/35 p-5 text-left no-underline shadow-sm transition hover:border-indigo-400/70 hover:bg-zinc-950/55"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-zinc-200 transition group-hover:border-indigo-400/60 group-hover:text-indigo-200">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-zinc-100">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300 [overflow-wrap:anywhere]">{item.body}</p>
                  </div>
                </div>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-indigo-200" />
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-100 transition group-hover:border-indigo-400/70 group-hover:bg-indigo-500/15 group-hover:text-white">
                {item.action}
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )

  const isProviderConfigured = (provider: ProviderDefinition, kind: ProviderKind) => {
    if (provider.nameKey && hasValue(settings, provider.nameKey)) return true
    if (kind === 'execution') {
      const baseUrl = settingDisplay(settings, drafts, provider.baseUrl)
      const hasRuntime = hasValue(settings, provider.apiKey)
        || hasValue(settings, provider.modelKey)
        || hasValue(settings, provider.baseUrl)
        || Boolean(provider.extraFields?.some(field => hasValue(settings, field.key)))
      if (provider.id === 'custom-anthropic') return hasValue(settings, provider.nameKey)
      if (provider.id === 'anthropic-compatible') return hasRuntime && Boolean(baseUrl && baseUrl !== provider.defaultBaseUrl) && !hasValue(settings, 'CUSTOM_EXECUTION_PROVIDER_NAME')
      return hasRuntime && (!baseUrl || baseUrl === provider.defaultBaseUrl) && !hasValue(settings, 'CUSTOM_EXECUTION_PROVIDER_NAME')
    }
    if (provider.id === 'custom-openai') return hasValue(settings, provider.nameKey)
    if (provider.id === 'openai' && hasValue(settings, 'CUSTOM_IMAGE_PROVIDER_NAME')) return false
    return hasValue(settings, provider.apiKey)
      || hasValue(settings, provider.modelKey)
      || hasValue(settings, provider.baseUrl)
      || Boolean(provider.extraFields?.some(field => hasValue(settings, field.key)))
  }

  const renderProviderCard = (provider: ProviderDefinition, kind: ProviderKind) => {
    const baseUrl = settingDisplay(settings, drafts, provider.baseUrl)
    const credential = credentialDisplay(provider, settings)
    const isDefault = kind === 'image'
      ? (settings.IMAGE_BACKEND || drafts.IMAGE_BACKEND || 'auto') === provider.defaultValue
      : provider.id === 'anthropic-compatible'
        ? Boolean(baseUrl && baseUrl !== provider.defaultBaseUrl)
        : !baseUrl || baseUrl === provider.defaultBaseUrl
    const configured = isProviderConfigured(provider, kind)
    const testStatus = providerTestStatus[`${kind}:${provider.id}`]

    return (
      <div
        key={provider.id}
        className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 relative bg-zinc-900/20 hover:bg-zinc-900/40 ${
          isDefault ? 'provider-card-default' : configured ? 'provider-card-active' : 'border-zinc-800'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {getProviderLogo(provider.id, localizedProviderTitle(provider, settings, drafts, lang))}
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  {localizedProviderTitle(provider, settings, drafts, lang)}
                  <span className={`h-1.5 w-1.5 rounded-full ${configured ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-zinc-600'}`} />
                </h3>
                <p className="text-[10px] text-zinc-500 mt-1 leading-normal max-w-sm">{localizedProviderDescription(provider, lang)}</p>
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase border shadow-sm ${
              isDefault 
                ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/40 shadow-indigo-900/10' 
                : configured 
                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40' 
                  : 'bg-zinc-900 text-zinc-500 border-zinc-850'
            }`}>
              {isDefault ? t(lang, 'models.status_default') : configured ? t(lang, 'models.status_saved') : t(lang, 'models.status_empty')}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800/40 flex flex-col gap-2 text-[11px] font-mono">
            {provider.baseUrl && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Base URL</span>
                <span className="text-zinc-300 font-semibold truncate max-w-[200px]" title={settingDisplay(settings, drafts, provider.baseUrl) || provider.defaultBaseUrl}>
                  {settingDisplay(settings, drafts, provider.baseUrl) || provider.defaultBaseUrl}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Model</span>
              <span className="text-zinc-300 font-semibold truncate max-w-[200px]" title={settingDisplay(settings, drafts, provider.modelKey) || provider.defaultModel}>
                {settingDisplay(settings, drafts, provider.modelKey) || provider.defaultModel}
              </span>
            </div>
            {credentialFields(provider).length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{credential.label}</span>
                <span className="text-zinc-400 font-semibold truncate max-w-[200px]" title={credential.value}>
                  {credential.value}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 pt-2 border-t border-zinc-850/30">
          <Button size="sm" variant="secondary" onClick={() => openProviderDialog(kind, provider.id)}>{t(lang, 'models.edit_config')}</Button>
          <Button size="sm" variant="secondary" disabled={testStatus?.loading} onClick={() => testProvider(provider, kind)}>
            {testStatus?.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
            {testStatus?.loading ? t(lang, 'models.testing') : t(lang, 'models.test_config')}
          </Button>
          <Button size="sm" variant={isDefault ? 'ghost' : 'primary'} onClick={() => setDefaultProvider(provider, kind)}>
            {isDefault ? t(lang, 'models.current_default') : t(lang, 'models.set_default')}
          </Button>
        </div>
        {testStatus && !testStatus.loading && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${
            testStatus.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}>
            {testStatus.ok ? t(lang, 'models.test_success') : t(lang, 'models.test_failed')}：{testStatus.text}
          </div>
        )}
      </div>
    )
  }

  const renderProviderSection = (kind: ProviderKind) => {
    const providers = kind === 'image' ? imageProviders : executionProviders
    const configuredProviders = providers.filter(provider => isProviderConfigured(provider, kind))
    const note = kind === 'image'
      ? t(lang, 'models.image_note')
      : t(lang, 'models.execution_note')

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs leading-normal text-zinc-400 max-w-xl">{note}</p>
          <div className="settings-select-wrapper max-w-[200px] w-full shrink-0">
            <select
              className="settings-select-premium"
              value=""
              onChange={e => {
                if (e.target.value) openProviderDialog(kind, e.target.value)
              }}
            >
              <option value="">+ {t(lang, 'models.add_service')}</option>
              {providers.map(provider => <option key={provider.id} value={provider.id}>{localizedProviderTitle(provider, settings, drafts, lang)}</option>)}
            </select>
            <div className="settings-select-arrow">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
        {providerStatus && <div className="text-xs text-indigo-400 font-semibold p-2.5 rounded bg-zinc-950 border border-zinc-850">{providerStatus}</div>}
        {configuredProviders.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 mt-4">
            {configuredProviders.map(provider => renderProviderCard(provider, kind))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-850 bg-zinc-950/20 p-8 text-center text-xs text-zinc-500">
            {t(lang, 'models.no_provider')}
          </div>
        )}
      </div>
    )
  }

  const renderProviderDialog = () => {
    if (!providerDialog) return null
    const provider = (providerDialog.kind === 'image' ? imageProviders : executionProviders).find(item => item.id === providerDialog.providerId)
    if (!provider) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-md animate-scale-up">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-850 pb-4">
            <div className="flex items-center gap-3">
              {getProviderLogo(provider.id, localizedProviderTitle(provider, settings, drafts, lang))}
              <div>
                <p className="studio-eyebrow">{t(lang, 'provider.dialog_title')}</p>
                <h2 className="text-base font-extrabold text-zinc-100">{localizedProviderTitle(provider, settings, drafts, lang)}</h2>
              </div>
            </div>
            <button type="button" className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 transition-colors" onClick={closeProviderDialog}>✕</button>
          </div>
          
          <div className="mt-2 py-2">
            <p className="text-xs text-zinc-400 leading-normal">{localizedProviderDescription(provider, lang)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 max-h-[350px] overflow-y-auto pr-1">
            {providerFields(provider).map(field => (
              <label key={field.key} className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
                <span className="text-zinc-300">{field.label}</span>
                {field.type === 'select' ? (
                  <div className="settings-select-wrapper">
                    <select value={providerDraft[field.key] || ''} onChange={e => setProviderDraft(prev => ({ ...prev, [field.key]: e.target.value }))} className="settings-select-premium">
                      {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <div className="settings-select-arrow">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={providerDraft[field.key] || ''}
                    placeholder={isMasked(settings[field.key]) ? settings[field.key] : field.placeholder}
                    onChange={e => setProviderDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="settings-input-premium"
                  />
                )}
                <code className="text-[9px] font-normal text-zinc-550 font-mono mt-0.5">{field.key}</code>
              </label>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-850 flex flex-wrap items-center justify-between gap-4">
            <div className="text-[10px] text-zinc-500 max-w-sm leading-normal">
              {t(lang, 'provider.base_url_note')}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={closeProviderDialog}>{t(lang, 'provider.cancel')}</Button>
              <Button variant="secondary" onClick={saveProvider}>{t(lang, 'provider.save')}</Button>
              <Button onClick={async () => { await saveProvider(); if (providerDialog) { const provider = (providerDialog.kind === 'image' ? imageProviders : executionProviders).find(item => item.id === providerDialog.providerId); if (provider) setDefaultProvider(provider, providerDialog.kind); } }}>{t(lang, 'provider.save_default')}</Button>
            </div>
          </div>
          {providerStatus && <div className="text-xs text-indigo-400 font-semibold p-2.5 rounded bg-zinc-900 border border-zinc-850 mt-4">{providerStatus}</div>}
        </div>
      </div>
    )
  }

  const renderModelsSection = () => (
    <section className="studio-panel settings-preference-panel">
      <div className="studio-panel-head">
        <div>
          <p className="studio-eyebrow">{t(lang, 'models.eyebrow')}</p>
          <h2>{t(lang, 'models.title')}</h2>
        </div>
      </div>
      <div className="flex rounded-lg bg-zinc-950 border border-zinc-850 p-0.5 w-fit mb-4">
        <button type="button"
          onClick={() => setModelTab('execution')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${modelTab === 'execution' ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'}`}>
          {t(lang, 'models.tab_execution')}
        </button>
        <button type="button"
          onClick={() => setModelTab('image')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${modelTab === 'image' ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/30' : 'text-zinc-400 hover:text-zinc-200 border border-transparent'}`}>
          {t(lang, 'models.tab_image')}
        </button>
      </div>
      <div className="animate-fade-in mt-4">
        {modelTab === 'execution' ? renderProviderSection('execution') : renderProviderSection('image')}
      </div>
    </section>
  )

  const renderActiveSection = () => {
    if (activeSection === 'environment') return renderEnvironment()
    if (activeSection === 'models') return renderModelsSection()
    if (activeSection === 'preferences') return renderPreferencesSection()
    if (activeSection === 'publish') return renderSocialPublish()
    if (activeSection === 'backup') return renderBackup()
    if (activeSection === 'about') return renderAbout()
    return renderEnvironment()
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 animate-fade-in">
      <div className="settings-page mx-auto flex h-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t(lang, 'settings.sidebar_title')}</p>
            <h1 className="text-2xl font-extrabold text-zinc-100">{t(lang, 'settings.title')}</h1>
            <p className="mt-1 text-sm text-zinc-400">{t(lang, 'settings.subtitle')}</p>
          </div>
          <BackToStudioButton />
        </header>

        <div className="min-h-0 flex flex-1 gap-5">
          {/* Left Navigation Sidebar */}
          <aside className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t(lang, 'settings.sidebar_title')}</div>
            <nav className="flex flex-col gap-1">
              {settingSections.map(section => {
                const Icon = section.icon
                const label = t(lang, section.labelKey)
                const hint = t(lang, section.hintKey)
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      activeSection === section.id
                        ? 'border-indigo-500/60 bg-indigo-600/15 text-zinc-50'
                        : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-950/50 hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0 mt-0.5 text-zinc-400 group-hover:text-zinc-200" />
                    <div>
                      <div className="text-xs font-extrabold">{label}</div>
                      <div className="mt-0.5 text-[10px] text-zinc-500 leading-normal font-normal">{hint}</div>
                    </div>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main settings options panels */}
          <main className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5">
            {renderActiveSection()}
          </main>
        </div>
      </div>
      {renderProviderDialog()}
    </div>
  )
}
