import { useEffect, useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import BackToStudioButton from '../components/ui/BackToStudioButton'
import { skills } from '../data'
import type { PreferenceSchema, SchemaField } from '../data/preference-schemas'
import { applyAccent } from '../lib/accent'
import { applyTheme } from '../lib/theme'

type GroupItem = [string, string, 'text' | 'password' | 'boolean' | 'select'] | [string, string, 'select', Array<{ value: string; label: string }>]
type PreferenceDraft = Record<string, string | number | boolean>
type ProviderKind = 'execution' | 'image'
type ProviderField = { key: string; label: string; type?: 'text' | 'password' | 'select'; placeholder?: string; options?: Array<{ value: string; label: string }> }
type ProviderDefinition = {
  id: string
  name: string
  description: string
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

const groups: Array<{ title: string; items: GroupItem[] }> = [
  {
    title: '外观',
    items: [
      ['THEME_MODE', '深浅主题', 'select', [
        { value: 'dark', label: '深色 (默认)' },
        { value: 'light', label: '浅色' },
        { value: 'system', label: '跟随系统' },
      ]],
      ['THEME_COLOR', '主题颜色', 'select', [
        { value: 'indigo', label: '靛青 (默认)' },
        { value: 'emerald', label: '翡翠绿' },
        { value: 'rose', label: '玫红' },
        { value: 'amber', label: '琥珀黄' },
        { value: 'cyan', label: '青蓝' },
        { value: 'violet', label: '紫罗兰' },
      ]],
      ['DEFAULT_LANGUAGE', '界面语言', 'select', [
        { value: 'zh', label: '中文' },
        { value: 'en', label: 'English' },
        { value: 'ja', label: '日本語' },
      ]],
    ],
  },
  {
    title: '执行模型',
    items: [
      ['ANTHROPIC_API_KEY', 'Anthropic API Key', 'password'],
      ['ANTHROPIC_BASE_URL', 'Anthropic Base URL', 'text'],
      ['ANTHROPIC_MODEL', 'Model', 'text'],
    ],
  },
  {
    title: '图片后端',
    items: [
      ['OPENAI_API_KEY', 'OpenAI', 'password'],
      ['GOOGLE_API_KEY', 'Google', 'password'],
      ['OPENROUTER_API_KEY', 'OpenRouter', 'password'],
      ['DASHSCOPE_API_KEY', 'DashScope', 'password'],
      ['REPLICATE_API_TOKEN', 'Replicate', 'password'],
      ['AZURE_OPENAI_API_KEY', 'Azure OpenAI', 'password'],
      ['AZURE_OPENAI_ENDPOINT', 'Azure Endpoint', 'text'],
    ],
  },
  {
    title: '默认偏好',
    items: [
      ['OUTPUT_DIR', '输出目录', 'text'],
      ['DEFAULT_ASPECT_RATIO', '默认比例', 'select', [
        { value: '1:1', label: '1:1 方形' },
        { value: '16:9', label: '16:9 宽屏' },
        { value: '9:16', label: '9:16 竖屏' },
        { value: '4:3', label: '4:3 标准' },
        { value: '3:4', label: '3:4 竖版' },
      ]],
      ['IMAGE_BACKEND', '图片后端', 'text'],
      ['SKIP_PLAN_CONFIRMATION', '直接开始生成（跳过计划确认阶段）', 'boolean'],
    ],
  },
  {
    title: '发布账号与浏览器',
    items: [
      ['BAOYU_CHROME_PROFILE_DIR', '共用 Chrome Profile', 'text'],
      ['WECHAT_BROWSER_PROFILE_DIR', '微信 Profile 覆盖', 'text'],
      ['WEIBO_BROWSER_PROFILE_DIR', '微博 Profile 覆盖', 'text'],
      ['X_BROWSER_PROFILE_DIR', 'X Profile 覆盖', 'text'],
      ['WECHAT_APP_ID', '微信 App ID', 'text'],
      ['WECHAT_APP_SECRET', '微信 App Secret', 'password'],
      ['WECHAT_BROWSER_CHROME_PATH', '微信 Chrome 路径', 'text'],
      ['WEIBO_BROWSER_CHROME_PATH', '微博 Chrome 路径', 'text'],
      ['X_BROWSER_CHROME_PATH', 'X Chrome 路径', 'text'],
    ],
  },
]

const settingSections = [
  { id: 'environment', label: '环境依赖', hint: '安装与运行状态' },
  { id: 'model', label: '执行模型', hint: 'Claude / Anthropic' },
  { id: 'image', label: '生图模型', hint: '供应商与默认模型' },
  { id: 'preferences', label: 'Skill 偏好', hint: '默认风格与偏好' },
  { id: 'account', label: '发布账号', hint: '公众号账号向导' },
  { id: 'sessions', label: '平台登录态', hint: '微信 / 微博 / X' },
  { id: 'defaults', label: '默认配置', hint: '输出目录与流程' },
  { id: 'appearance', label: '外观', hint: '主题和语言' },
  { id: 'publishing', label: '发布环境', hint: 'Chrome 与账号变量' },
  { id: 'backup', label: '备份导入', hint: '导出 / 还原设置' },
]

const executionProviders: ProviderDefinition[] = [
  {
    id: 'anthropic',
    name: 'Anthropic / Claude',
    description: '用于计划生成、文案整理和多轮修改。HappyImage 当前执行模型走 Anthropic 兼容接口。',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
    modelKey: 'ANTHROPIC_MODEL',
    defaultKey: 'ANTHROPIC_MODEL',
    defaultValue: 'claude-sonnet-4-6',
    extraFields: [{ key: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: '可选，Claude Code 登录态或兼容 token' }],
  },
  {
    id: 'anthropic-compatible',
    name: 'Anthropic-compatible',
    description: '第三方 Anthropic 兼容网关。保存后仍写入 ANTHROPIC_*，供现有执行链路读取。',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
    modelKey: 'ANTHROPIC_MODEL',
    defaultKey: 'ANTHROPIC_MODEL',
    defaultValue: 'claude-sonnet-4-6',
    extraFields: [{ key: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: '可选，Claude Code 登录态或兼容 token' }],
  },
  {
    id: 'custom-anthropic',
    name: '自定义执行模型',
    description: '自定义 Anthropic-compatible 网关名称、Base URL 和模型。',
    nameKey: 'CUSTOM_EXECUTION_PROVIDER_NAME',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-6',
    apiKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'ANTHROPIC_BASE_URL',
    modelKey: 'ANTHROPIC_MODEL',
    defaultKey: 'ANTHROPIC_MODEL',
    defaultValue: 'claude-sonnet-4-6',
    extraFields: [{ key: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: '可选，Claude Code 登录态或兼容 token' }],
  },
]

const imageProviders: ProviderDefinition[] = [
  { id: 'google', name: 'Google Gemini', description: '支持 Gemini 图像模型和参考图工作流。', defaultBaseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-3-pro-image-preview', apiKey: 'GOOGLE_API_KEY', baseUrl: 'GOOGLE_BASE_URL', modelKey: 'GOOGLE_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'google' },
  { id: 'openai', name: 'OpenAI Images', description: '支持 GPT Image 生成与编辑，可配置 OpenAI 兼容网关。', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-2', apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', modelKey: 'OPENAI_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openai', extraFields: [{ key: 'OPENAI_IMAGE_API_DIALECT', label: 'API Dialect', type: 'select', options: [{ value: '', label: '默认' }, { value: 'openai-native', label: 'openai-native' }, { value: 'ratio-metadata', label: 'ratio-metadata' }] }] },
  { id: 'custom-openai', name: '自定义生图模型', description: '自定义 OpenAI-compatible 图片网关名称、Base URL 和模型。保存后通过 OpenAI provider 执行。', nameKey: 'CUSTOM_IMAGE_PROVIDER_NAME', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-2', apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', modelKey: 'OPENAI_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openai', extraFields: [{ key: 'OPENAI_IMAGE_API_DIALECT', label: 'API Dialect', type: 'select', options: [{ value: '', label: '默认' }, { value: 'openai-native', label: 'openai-native' }, { value: 'ratio-metadata', label: 'ratio-metadata' }] }, { key: 'OPENAI_IMAGE_USE_CHAT', label: 'Use Chat Completions', type: 'select', options: [{ value: '', label: '默认' }, { value: 'true', label: 'true' }, { value: 'false', label: 'false' }] }] },
  { id: 'azure', name: 'Azure OpenAI', description: '使用 Azure deployment name 作为模型名。', defaultBaseUrl: 'https://your-resource.openai.azure.com', defaultModel: 'gpt-image-2', apiKey: 'AZURE_OPENAI_API_KEY', baseUrl: 'AZURE_OPENAI_BASE_URL', modelKey: 'AZURE_OPENAI_DEPLOYMENT', defaultKey: 'IMAGE_BACKEND', defaultValue: 'azure', extraFields: [{ key: 'AZURE_API_VERSION', label: 'API Version', placeholder: '2025-04-01-preview' }] },
  { id: 'openrouter', name: 'OpenRouter', description: '通过 OpenRouter 调用 Gemini/FLUX 等图像模型。', defaultBaseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-3.1-flash-image-preview', apiKey: 'OPENROUTER_API_KEY', baseUrl: 'OPENROUTER_BASE_URL', modelKey: 'OPENROUTER_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openrouter', extraFields: [{ key: 'OPENROUTER_HTTP_REFERER', label: 'HTTP Referer' }, { key: 'OPENROUTER_TITLE', label: 'App Title' }] },
  { id: 'dashscope', name: 'DashScope / Qwen', description: '阿里云 DashScope，适合中文海报和文字渲染。', defaultBaseUrl: 'https://dashscope.aliyuncs.com', defaultModel: 'qwen-image-2.0-pro', apiKey: 'DASHSCOPE_API_KEY', baseUrl: 'DASHSCOPE_BASE_URL', modelKey: 'DASHSCOPE_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'dashscope' },
  { id: 'zai', name: 'Z.AI / BigModel', description: '智谱图像模型，支持 ZAI_* 和 BIGMODEL_* 兼容变量。', defaultBaseUrl: 'https://api.z.ai/api/paas/v4', defaultModel: 'glm-image', apiKey: 'ZAI_API_KEY', baseUrl: 'ZAI_BASE_URL', modelKey: 'ZAI_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'zai' },
  { id: 'minimax', name: 'MiniMax', description: 'MiniMax image-01 系列，支持自定义尺寸和 subject reference。', defaultBaseUrl: 'https://api.minimaxi.com', defaultModel: 'image-01', apiKey: 'MINIMAX_API_KEY', baseUrl: 'MINIMAX_BASE_URL', modelKey: 'MINIMAX_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'minimax' },
  { id: 'replicate', name: 'Replicate', description: '社区模型托管，适合快速切换不同图片模型。', defaultBaseUrl: 'https://api.replicate.com', defaultModel: 'google/nano-banana-2', apiKey: 'REPLICATE_API_TOKEN', baseUrl: 'REPLICATE_BASE_URL', modelKey: 'REPLICATE_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'replicate' },
  { id: 'seedream', name: 'Seedream / Ark', description: '火山方舟 Seedream 模型，使用 ARK_API_KEY。', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seedream-5-0-260128', apiKey: 'ARK_API_KEY', baseUrl: 'SEEDREAM_BASE_URL', modelKey: 'SEEDREAM_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'seedream' },
  { id: 'jimeng', name: 'Jimeng', description: '火山即梦模型，需要 Access Key 和 Secret Key。', defaultBaseUrl: 'https://visual.volcengineapi.com', defaultModel: 'jimeng_t2i_v40', baseUrl: 'JIMENG_BASE_URL', modelKey: 'JIMENG_IMAGE_MODEL', defaultKey: 'IMAGE_BACKEND', defaultValue: 'jimeng', extraFields: [{ key: 'JIMENG_ACCESS_KEY_ID', label: 'Access Key ID', type: 'password' }, { key: 'JIMENG_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'password' }, { key: 'JIMENG_REGION', label: 'Region', placeholder: 'cn-north-1' }] },
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

interface AccountDraft {
  scope: string
  defaultTheme: string
  defaultColor: string
  accountName: string
  alias: string
  method: string
  author: string
  appId: string
  appSecret: string
  openComments: boolean
  fansOnly: boolean
}

interface DependencyCheck {
  id: string
  label: string
  ok: boolean
  required: boolean
  description: string
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
    ...(provider.nameKey ? [{ key: provider.nameKey, label: '显示名称', placeholder: provider.name }] : []),
    ...(provider.apiKey ? [{ key: provider.apiKey, label: 'API Key', type: 'password' as const }] : []),
    ...(provider.baseUrl ? [{ key: provider.baseUrl, label: 'Base URL', placeholder: provider.defaultBaseUrl }] : []),
    { key: provider.modelKey, label: provider.id === 'azure' ? 'Deployment / Model' : 'Model', placeholder: provider.defaultModel },
    ...(provider.extraFields || []),
  ]
}

function providerTitle(provider: ProviderDefinition, settings: Record<string, string>, drafts: Record<string, string>) {
  return provider.nameKey ? (settingDisplay(settings, drafts, provider.nameKey) || provider.name) : provider.name
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
  if (!field) return { label: provider.apiKey ? 'API Key' : 'Credential', value: '未配置' }
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
  const draft: PreferenceDraft = { scope: info?.scope || 'output' }
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

function PreferenceField({ field, value, onChange }: { field: SchemaField; value: string | number | boolean | undefined; onChange: (value: string | number | boolean) => void }) {
  if (field.type === 'boolean') {
    return (
      <label className="studio-toggle-row">
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
        {field.labelZh}
      </label>
    )
  }

  return (
    <label>
      {field.labelZh}
      {field.type === 'select' ? (
        <select value={String(value ?? field.defaultValue ?? '')} onChange={e => onChange(e.target.value)}>
          {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea value={String(value ?? '')} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
      ) : (
        <input
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          min={field.min}
          max={field.max}
          step={field.step}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )}
      {field.hint && <small>{field.hint}</small>}
    </label>
  )
}

function accountValues(draft: AccountDraft) {
  return {
    default_theme: draft.defaultTheme || 'default',
    default_color: draft.defaultColor,
    accounts: [{
      name: draft.accountName || draft.author || 'WeChat Account',
      alias: draft.alias || 'default',
      default: true,
      default_publish_method: draft.method || 'browser',
      default_author: draft.author,
      need_open_comment: draft.openComments ? 1 : 0,
      only_fans_can_comment: draft.fansOnly ? 1 : 0,
      app_id: draft.appId,
      app_secret: draft.appSecret,
    }],
  }
}

function DependencyAction({ check }: { check: DependencyCheck }) {
  const className = 'inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 no-underline transition hover:border-indigo-500 hover:text-white'
  if (check.installUrl.startsWith('/')) return <a href={check.installUrl} className={className}>{check.installLabel}</a>
  return <a href={check.installUrl} target="_blank" rel="noreferrer" className={className}>{check.installLabel}</a>
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
  const [accountDraft, setAccountDraft] = useState<AccountDraft>({
    scope: 'project',
    defaultTheme: 'default',
    defaultColor: '',
    accountName: '',
    alias: '',
    method: 'browser',
    author: '',
    appId: '',
    appSecret: '',
    openComments: true,
    fansOnly: false,
  })
  const [accountStatus, setAccountStatus] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [providerDialog, setProviderDialog] = useState<ProviderDialog | null>(null)
  const [providerDraft, setProviderDraft] = useState<Record<string, string>>({})
  const [providerStatus, setProviderStatus] = useState<string | null>(null)
  const [skillsRootStatus, setSkillsRootStatus] = useState<string | null>(null)
  const [isInstallingSkills, setIsInstallingSkills] = useState(false)
  const groupsByTitle = useMemo(() => Object.fromEntries(groups.map(group => [group.title, group])), [])

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
        setAccountDraft(prev => ({
          ...prev,
          accountName: account.name || '',
          alias: account.alias === 'default' ? '' : account.alias || '',
          method: account.method || prev.method,
          author: account.author || '',
        }))
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
      if (key === 'BAOYU_SKILLS_ROOT') {
        refreshDependencies()
      }
      window.setTimeout(() => setSaved(null), 1800)
    }
  }

  const useSkillsRoot = async (root?: string) => {
    const value = root || drafts.BAOYU_SKILLS_ROOT || '~/.baoyu-skills'
    setSkillsRootStatus('正在保存技能目录...')
    const res = await fetch('/api/skills-root/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: value }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSkillsRootStatus(data.error || '保存技能目录失败')
      return
    }
    setSettings(data.settings)
    setDrafts(Object.fromEntries(
      Object.entries(data.settings).map(([key, value]) => [key, isMasked(String(value)) ? '' : String(value)]),
    ))
    setDependencies(prev => prev ? { ...prev, skillsRoot: data.skillsRoot } : prev)
    await refreshDependencies()
    setSkillsRootStatus(`已使用技能目录：${data.skillsRoot.root}`)
  }

  const installSkillsRoot = async () => {
    const root = drafts.BAOYU_SKILLS_ROOT || '~/.baoyu-skills'
    setIsInstallingSkills(true)
    setSkillsRootStatus(`正在安装 baoyu-skills 到 ${root}...`)
    const res = await fetch('/api/skills-root/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root }),
    })
    const data = await res.json()
    setIsInstallingSkills(false)
    if (!res.ok) {
      setSkillsRootStatus(data.error || '安装失败')
      return
    }
    setSettings(data.settings)
    setDrafts(Object.fromEntries(
      Object.entries(data.settings).map(([key, value]) => [key, isMasked(String(value)) ? '' : String(value)]),
    ))
    await refreshDependencies()
    setSkillsRootStatus(`安装完成：${data.root}`)
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
      if (!res.ok || !data.success) throw new Error(data.error || `保存 ${key} 失败`)
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
    setProviderStatus('正在保存供应商配置...')
    try {
      await saveMany(values)
      setProviderStatus('供应商配置已保存')
      window.setTimeout(() => closeProviderDialog(), 600)
    } catch (err: any) {
      setProviderStatus(err.message || '保存失败')
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
    setProviderStatus(`${provider.name} 已设为默认`)
    window.setTimeout(() => setProviderStatus(null), 1800)
  }

  const openSession = async (platform: string, accountAlias = '') => {
    setSessionStatus(`正在打开 ${platform} 登录页...`)
    const res = await fetch('/api/session/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, accountAlias }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSessionStatus(data.error || '打开失败')
      return
    }
    setSessionStatus(`${platform} 已打开，登录态会保存到 ${data.profileDir}`)
  }

  const savePreference = async () => {
    setPreferenceStatus('正在保存偏好...')
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
      setPreferenceStatus(data.error || '保存失败')
      return
    }
    setPreferenceInfo(data)
    setPreferenceStatus(`已保存到 ${data.path}`)
  }

  const saveWechatAccount = async () => {
    setAccountStatus('正在保存公众号账号...')
    const res = await fetch('/api/preferences/post-to-wechat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: accountDraft.scope,
        values: accountValues(accountDraft),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAccountStatus(data.error || '保存失败')
      return
    }
    setAccountStatus(`公众号配置已保存到 ${data.path}`)
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
      setImportStatus('配置导出成功！已保存为 json 文件。')
      setTimeout(() => setImportStatus(null), 3000)
    } catch {
      setImportStatus('配置导出失败')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('正在导入配置...')
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
        setImportStatus('配置一键导入成功！页面参数已刷新')
        setTimeout(() => setImportStatus(null), 3000)
      } else {
        setImportStatus(data.error || '导入失败，请检查文件格式')
      }
    } catch {
      setImportStatus('解析 JSON 失败，请确保上传有效的配置文件')
    }
  }

  const renderSettingsGroup = (groupTitle: string) => {
    const group = groupsByTitle[groupTitle]
    if (!group) return null
    return (
      <section className="studio-panel">
        <h2>{group.title}</h2>
        <div className="settings-fields">
          {group.items.map((item) => {
            const [key, label, type, options] = item
            const isBoolean = type === 'boolean'
            const isSelect = type === 'select'
            const isChecked = drafts[key] === 'true' || drafts[key] === '1'
            return (
              <label key={key} className={isBoolean ? 'studio-toggle-row' : ''}>
                <span>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isBoolean ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        const val = e.target.checked ? 'true' : 'false'
                        setDrafts(prev => ({ ...prev, [key]: val }))
                        save(key, val)
                      }}
                      style={{ margin: 0, width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  ) : key === 'THEME_COLOR' ? (
                    <div className="flex items-center gap-2.5 py-1 flex-wrap">
                      {options?.map((opt: { value: string; label: string }) => {
                        const bgColors: Record<string, string> = {
                          indigo: '#6366f1',
                          emerald: '#10b981',
                          rose: '#f43f5e',
                          amber: '#f59e0b',
                          cyan: '#06b6d4',
                          violet: '#8b5cf6',
                        }
                        const isSelected = (drafts[key] || settings[key]) === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.label}
                            onClick={() => {
                              setDrafts(prev => ({ ...prev, [key]: opt.value }))
                              save(key, opt.value)
                            }}
                            className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer relative flex items-center justify-center hover:scale-105 active:scale-95"
                            style={{
                              backgroundColor: bgColors[opt.value] || '#6366f1',
                              borderColor: isSelected ? 'white' : 'transparent',
                              boxShadow: isSelected ? '0 0 0 2px var(--color-indigo-600), 0 2px 4px rgba(0,0,0,0.15)' : 'none',
                            }}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full bg-white block" />}
                          </button>
                        )
                      })}
                    </div>
                  ) : key === 'THEME_MODE' ? (
                    <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 w-fit">
                      {options?.map((opt: { value: string; label: string }) => {
                        const isSelected = (drafts[key] || settings[key]) === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setDrafts(prev => ({ ...prev, [key]: opt.value }))
                              save(key, opt.value)
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-850 text-zinc-100 shadow-sm border border-zinc-700/30'
                                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                            }`}
                          >
                            {opt.label.split(' ')[0]}
                          </button>
                        )
                      })}
                    </div>
                  ) : isSelect && options ? (
                    <select
                      value={drafts[key] || settings[key] || ''}
                      onChange={e => {
                        const val = e.target.value
                        setDrafts(prev => ({ ...prev, [key]: val }))
                        save(key, val)
                      }}
                      style={{ flex: 1 }}
                    >
                      {options.map((opt: { value: string; label: string }) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type}
                      value={drafts[key] || ''}
                      placeholder={settings[key] || ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                  {!(isSelect || isBoolean || key === 'THEME_COLOR' || key === 'THEME_MODE') ? (
                    <Button size="sm" disabled={!drafts[key] && isMasked(settings[key])} onClick={() => save(key)}>
                      {saved === key ? '已保存' : '保存'}
                    </Button>
                  ) : (saved === key && key !== 'THEME_COLOR' && key !== 'THEME_MODE') ? (
                    <span className="text-xs text-emerald-400 font-semibold px-2 animate-fade-in whitespace-nowrap">✓ 已保存</span>
                  ) : null}
                </div>
              </label>
            )
          })}
        </div>
      </section>
    )
  }

  const renderEnvironment = () => (
    <section className="studio-panel">
      <div className="studio-panel-head">
        <div>
          <p className="studio-eyebrow">environment</p>
          <h2>环境依赖状态</h2>
        </div>
        <span>{dependencies?.ok ? 'ready' : 'check'}</span>
      </div>
      <p className="text-sm leading-relaxed text-zinc-500">
        HappyImage 主要依赖外部 baoyu-skills。请安装到 ~/.baoyu-skills，或在这里配置 BAOYU_SKILLS_ROOT 指向完整技能目录。
      </p>
      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="studio-eyebrow">baoyu-skills root</p>
            <h3 className="text-sm font-bold text-zinc-100">{dependencies?.skillsRoot?.ready ? '技能目录已就绪' : '技能目录未就绪'}</h3>
            <p className="mt-1 break-all text-xs leading-relaxed text-zinc-500">{dependencies?.skillsRoot?.root || '~/.baoyu-skills'}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${dependencies?.skillsRoot?.ready ? 'bg-emerald-950/30 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
            {dependencies?.skillsRoot?.ready ? 'ready' : 'missing'}
          </span>
        </div>
        {dependencies?.skillsRoot?.missing?.length ? (
          <p className="mt-3 text-xs leading-relaxed text-red-300">
            缺少核心技能：{dependencies.skillsRoot.missing.join(', ')}
          </p>
        ) : null}
        <label className="mt-4 grid gap-1 text-xs font-bold text-zinc-400">
          BAOYU_SKILLS_ROOT
          <div className="flex gap-2">
            <input
              value={drafts.BAOYU_SKILLS_ROOT || ''}
              placeholder="~/.baoyu-skills"
              onChange={e => setDrafts(prev => ({ ...prev, BAOYU_SKILLS_ROOT: e.target.value }))}
            />
            <Button size="sm" onClick={() => useSkillsRoot()}>{saved === 'BAOYU_SKILLS_ROOT' ? '已保存' : '使用目录'}</Button>
          </div>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => {
            setDrafts(prev => ({ ...prev, BAOYU_SKILLS_ROOT: '~/.baoyu-skills' }))
            useSkillsRoot('~/.baoyu-skills')
          }}>
            使用默认目录
          </Button>
          <Button size="sm" onClick={installSkillsRoot} disabled={isInstallingSkills}>
            {isInstallingSkills ? '安装中...' : '安装到当前目录'}
          </Button>
          <a
            href="https://github.com/JimLiu/baoyu-skills"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 no-underline transition hover:border-indigo-500 hover:text-white"
          >
            查看安装说明
          </a>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          如果你已经安装在其他位置，请把包含 baoyu-* 技能目录的路径填到上面；如果还没安装，可以直接安装到默认目录 ~/.baoyu-skills。
        </p>
        {skillsRootStatus && <div className="studio-project-path mt-3">{skillsRootStatus}</div>}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {(dependencies?.checks || []).map(check => (
          <div key={check.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${check.ok ? 'bg-emerald-400' : check.required ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <h3 className="text-sm font-bold text-zinc-100">{check.label}</h3>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{check.description}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${check.ok ? 'bg-emerald-950/30 text-emerald-300' : check.required ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'}`}>
                {check.ok ? 'ok' : check.required ? 'required' : 'optional'}
              </span>
            </div>
            {!check.ok && (
              <div className="mt-3">
                <DependencyAction check={check} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )

  const renderPreferences = () => (
    <section className="studio-panel settings-preference-panel">
      <div className="studio-panel-head">
        <div>
          <p className="studio-eyebrow">skill preferences</p>
          <h2>Skill 偏好编辑</h2>
        </div>
        <span>{preferenceInfo?.found ? 'found' : 'new'}</span>
      </div>
      <div className="settings-form-grid">
        <label>
          Skill
          <select value={prefSkillId} onChange={e => setPrefSkillId(e.target.value)}>
            {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.nameZh}</option>)}
          </select>
        </label>
        <label>
          保存位置
          <select value={String(preferenceDraft.scope || 'output')} onChange={e => setPreferenceDraft(prev => ({ ...prev, scope: e.target.value }))}>
            {(preferenceInfo?.targets || []).filter(target => target.scope !== 'xdg').map(target => (
              <option key={target.scope} value={target.scope}>{target.label}{target.exists ? ' · 已有' : ''}</option>
            ))}
          </select>
        </label>
        {(preferenceSchema?.fields || []).filter(field => field.type !== 'boolean').map(field => (
          <PreferenceField
            key={field.key}
            field={field}
            value={preferenceDraft[field.key]}
            onChange={value => setPreferenceDraft(prev => ({ ...prev, [field.key]: value }))}
          />
        ))}
      </div>
      {(preferenceSchema?.fields || []).filter(field => field.type === 'boolean').map(field => (
        <PreferenceField
          key={field.key}
          field={field}
          value={preferenceDraft[field.key]}
          onChange={value => setPreferenceDraft(prev => ({ ...prev, [field.key]: value }))}
        />
      ))}
      <div className="settings-inline-actions">
        <Button onClick={savePreference}>保存 Skill 偏好</Button>
        {preferenceInfo?.path && <code>{preferenceInfo.path}</code>}
      </div>
      {preferenceStatus && <div className="studio-project-path">{preferenceStatus}</div>}
    </section>
  )

  const renderAccount = () => (
    <section className="studio-panel settings-preference-panel">
      <div className="studio-panel-head">
        <div>
          <p className="studio-eyebrow">publishing account</p>
          <h2>公众号账号向导</h2>
        </div>
        <span>wechat</span>
      </div>
      <div className="settings-form-grid">
        <label>
          保存位置
          <select value={accountDraft.scope} onChange={e => setAccountDraft(prev => ({ ...prev, scope: e.target.value }))}>
            <option value="project">当前项目</option>
            <option value="user">用户全局</option>
          </select>
        </label>
        <label>账号名称<input value={accountDraft.accountName} onChange={e => setAccountDraft(prev => ({ ...prev, accountName: e.target.value }))} /></label>
        <label>别名<input value={accountDraft.alias} placeholder="baoyu" onChange={e => setAccountDraft(prev => ({ ...prev, alias: e.target.value }))} /></label>
        <label>默认作者<input value={accountDraft.author} onChange={e => setAccountDraft(prev => ({ ...prev, author: e.target.value }))} /></label>
        <label>
          默认主题
          <select value={accountDraft.defaultTheme} onChange={e => setAccountDraft(prev => ({ ...prev, defaultTheme: e.target.value }))}>
            <option value="default">default</option>
            <option value="grace">grace</option>
            <option value="simple">simple</option>
            <option value="modern">modern</option>
          </select>
        </label>
        <label>默认颜色<input value={accountDraft.defaultColor} placeholder="blue / #0F4C81" onChange={e => setAccountDraft(prev => ({ ...prev, defaultColor: e.target.value }))} /></label>
        <label>
          发布方式
          <select value={accountDraft.method} onChange={e => setAccountDraft(prev => ({ ...prev, method: e.target.value }))}>
            <option value="browser">browser</option>
            <option value="api">api</option>
          </select>
        </label>
        <label>App ID<input value={accountDraft.appId} onChange={e => setAccountDraft(prev => ({ ...prev, appId: e.target.value }))} /></label>
        <label>App Secret<input type="password" value={accountDraft.appSecret} onChange={e => setAccountDraft(prev => ({ ...prev, appSecret: e.target.value }))} /></label>
      </div>
      <label className="studio-toggle-row">
        <input type="checkbox" checked={accountDraft.openComments} onChange={e => setAccountDraft(prev => ({ ...prev, openComments: e.target.checked }))} />
        默认开启评论
      </label>
      <label className="studio-toggle-row">
        <input type="checkbox" checked={accountDraft.fansOnly} onChange={e => setAccountDraft(prev => ({ ...prev, fansOnly: e.target.checked }))} />
        仅粉丝可评论
      </label>
      <div className="settings-inline-actions">
        <Button onClick={saveWechatAccount}>保存公众号账号</Button>
        <Button variant="secondary" onClick={() => openSession('wechat', accountDraft.alias)}>打开微信登录</Button>
      </div>
      {accountStatus && <div className="studio-project-path">{accountStatus}</div>}
    </section>
  )

  const renderSessions = () => (
    <section className="studio-panel settings-session-panel">
      <h2>平台登录态</h2>
      <p>使用 baoyu skills 的 Chrome Profile 打开平台页面，登录一次后发稿流程会复用同一份会话。</p>
      <div className="settings-session-actions">
        <Button size="sm" onClick={() => openSession('wechat')}>打开微信登录</Button>
        <Button size="sm" onClick={() => openSession('weibo')}>打开微博登录</Button>
        <Button size="sm" onClick={() => openSession('x')}>打开 X 登录</Button>
      </div>
      {sessionStatus && <code>{sessionStatus}</code>}
    </section>
  )

  const renderBackup = () => (
    <section className="studio-panel settings-session-panel">
      <h2>配置导出与导入</h2>
      <p>打包当前的所有 API 密钥及偏好设置，保存为本地备份 JSON，或从备份中还原全部配置。</p>
      <div className="settings-session-actions flex items-center gap-2">
        <Button size="sm" onClick={handleExport}>导出配置 JSON</Button>
        <label className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg cursor-pointer transition-all border border-zinc-700/80 inline-flex items-center justify-center">
          导入配置 JSON
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>
      {importStatus && <code className="block mt-2 text-indigo-400">{importStatus}</code>}
    </section>
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

    return (
      <div key={provider.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${configured ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              <h3 className="text-sm font-bold text-zinc-100">{providerTitle(provider, settings, drafts)}</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{provider.description}</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isDefault ? 'bg-indigo-950/60 text-indigo-300' : 'bg-zinc-900 text-zinc-500'}`}>
            {isDefault ? 'default' : configured ? 'saved' : 'empty'}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-zinc-400">
          {provider.baseUrl && <div className="truncate">Base URL: <span className="text-zinc-200">{settingDisplay(settings, drafts, provider.baseUrl) || provider.defaultBaseUrl}</span></div>}
          <div className="truncate">Model: <span className="text-zinc-200">{settingDisplay(settings, drafts, provider.modelKey) || provider.defaultModel}</span></div>
          {credentialFields(provider).length > 0 && <div>{credential.label}: <span className="text-zinc-200">{credential.value}</span></div>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openProviderDialog(kind, provider.id)}>配置</Button>
          <Button size="sm" variant={isDefault ? 'ghost' : 'primary'} onClick={() => setDefaultProvider(provider, kind)}>
            {isDefault ? '当前默认' : '设为默认'}
          </Button>
        </div>
      </div>
    )
  }

  const renderProviderSection = (kind: ProviderKind) => {
    const providers = kind === 'image' ? imageProviders : executionProviders
    const configuredProviders = providers.filter(provider => isProviderConfigured(provider, kind))
    const title = kind === 'image' ? '生图模型' : '执行模型'
    const eyebrow = kind === 'image' ? 'image providers' : 'runtime model'
    const note = kind === 'image'
      ? '这里配置 baoyu-imagine 实际读取的 API Key、Base URL 和默认模型。默认供应商会写入 IMAGE_BACKEND。'
      : '这里配置 HappyImage 计划、文案和多轮修改使用的执行模型。当前链路支持 Anthropic/Claude 兼容接口。'

    return (
      <section className="studio-panel settings-preference-panel">
        <div className="studio-panel-head">
          <div>
            <p className="studio-eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <select
            className="max-w-[220px]"
            value=""
            onChange={e => {
              if (e.target.value) openProviderDialog(kind, e.target.value)
            }}
          >
            <option value="">添加供应商</option>
            {providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </div>
        <p className="text-sm leading-relaxed text-zinc-500">{note}</p>
        {providerStatus && <div className="studio-project-path">{providerStatus}</div>}
        {configuredProviders.length > 0 ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {configuredProviders.map(provider => renderProviderCard(provider, kind))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/35 p-5 text-sm text-zinc-500">
            还没有添加供应商。点击右上角“添加供应商”开始配置。
          </div>
        )}
      </section>
    )
  }

  const renderProviderDialog = () => {
    if (!providerDialog) return null
    const provider = (providerDialog.kind === 'image' ? imageProviders : executionProviders).find(item => item.id === providerDialog.providerId)
    if (!provider) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-850 pb-4">
            <div>
              <p className="studio-eyebrow">provider setup</p>
              <h2 className="text-xl font-extrabold text-zinc-100">{provider.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{provider.description}</p>
            </div>
            <button type="button" className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100" onClick={closeProviderDialog}>✕</button>
          </div>
          <div className="settings-form-grid mt-4">
            {providerFields(provider).map(field => (
              <label key={field.key}>
                {field.label}
                {field.type === 'select' ? (
                  <select value={providerDraft[field.key] || ''} onChange={e => setProviderDraft(prev => ({ ...prev, [field.key]: e.target.value }))}>
                    {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={providerDraft[field.key] || ''}
                    placeholder={isMasked(settings[field.key]) ? settings[field.key] : field.placeholder}
                    onChange={e => setProviderDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
                <small>{field.key}</small>
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              Base URL 已按 baoyu-skills 默认值预填；只在使用代理或第三方兼容网关时修改。
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={closeProviderDialog}>取消</Button>
              <Button onClick={saveProvider}>保存并设为默认</Button>
            </div>
          </div>
          {providerStatus && <div className="studio-project-path mt-4">{providerStatus}</div>}
        </div>
      </div>
    )
  }

  const renderActiveSection = () => {
    if (activeSection === 'environment') return renderEnvironment()
    if (activeSection === 'model') return renderProviderSection('execution')
    if (activeSection === 'image') return renderProviderSection('image')
    if (activeSection === 'preferences') return renderPreferences()
    if (activeSection === 'account') return renderAccount()
    if (activeSection === 'sessions') return renderSessions()
    if (activeSection === 'defaults') return renderSettingsGroup('默认偏好')
    if (activeSection === 'appearance') return renderSettingsGroup('外观')
    if (activeSection === 'publishing') return renderSettingsGroup('发布账号与浏览器')
    if (activeSection === 'backup') return renderBackup()
    return renderEnvironment()
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 animate-fade-in">
      <div className="settings-page mx-auto flex h-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">settings</p>
            <h1 className="text-2xl font-extrabold text-zinc-100">配置生成环境</h1>
            <p className="mt-1 text-sm text-zinc-500">先检查运行环境，再配置模型、图片后端、偏好和发布账号。</p>
          </div>
          <BackToStudioButton />
        </header>

        <div className="min-h-0 flex flex-1 gap-5">
          <aside className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Settings</div>
            <nav className="flex flex-col gap-1">
              {settingSections.map(section => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    activeSection === section.id
                      ? 'border-indigo-500/60 bg-indigo-600/15 text-zinc-50'
                      : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-950/50 hover:text-zinc-100'
                  }`}
                >
                  <div className="text-sm font-bold">{section.label}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{section.hint}</div>
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5">
            {renderActiveSection()}
          </main>
        </div>
      </div>
      {renderProviderDialog()}
    </div>
  )
}
