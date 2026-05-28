import { Hono } from 'hono'
import { readSettingsSanitized, writeSetting, readSettings } from '@happytokenai/happyimage-core'

const settingsRoute = new Hono()
const DEFAULT_TIMEOUT_MS = 8000

type ProviderSpec = {
  apiKey?: string
  authToken?: string
  baseUrl?: string
  modelKey: string
  defaultBaseUrl: string
  defaultModel: string
  defaultKey?: string
  defaultValue?: string
  extraKeys?: string[]
  mode: 'anthropic' | 'openai' | 'google' | 'replicate' | 'presence'
}

const providerSpecs: Record<string, ProviderSpec> = {
  anthropic: { apiKey: 'ANTHROPIC_API_KEY', authToken: 'ANTHROPIC_AUTH_TOKEN', baseUrl: 'ANTHROPIC_BASE_URL', modelKey: 'ANTHROPIC_MODEL', defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', mode: 'anthropic' },
  'anthropic-compatible': { apiKey: 'ANTHROPIC_API_KEY', authToken: 'ANTHROPIC_AUTH_TOKEN', baseUrl: 'ANTHROPIC_BASE_URL', modelKey: 'ANTHROPIC_MODEL', defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', mode: 'anthropic' },
  'custom-anthropic': { apiKey: 'ANTHROPIC_API_KEY', authToken: 'ANTHROPIC_AUTH_TOKEN', baseUrl: 'ANTHROPIC_BASE_URL', modelKey: 'ANTHROPIC_MODEL', defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-6', mode: 'anthropic' },
  google: { apiKey: 'GOOGLE_API_KEY', baseUrl: 'GOOGLE_BASE_URL', modelKey: 'GOOGLE_IMAGE_MODEL', defaultBaseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-3-pro-image-preview', defaultKey: 'IMAGE_BACKEND', defaultValue: 'google', mode: 'google' },
  openai: { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', modelKey: 'OPENAI_IMAGE_MODEL', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-2', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openai', mode: 'openai' },
  'custom-openai': { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', modelKey: 'OPENAI_IMAGE_MODEL', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-2', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openai', mode: 'openai' },
  azure: { apiKey: 'AZURE_OPENAI_API_KEY', baseUrl: 'AZURE_OPENAI_BASE_URL', modelKey: 'AZURE_OPENAI_DEPLOYMENT', defaultBaseUrl: 'https://your-resource.openai.azure.com', defaultModel: 'gpt-image-2', defaultKey: 'IMAGE_BACKEND', defaultValue: 'azure', mode: 'presence' },
  openrouter: { apiKey: 'OPENROUTER_API_KEY', baseUrl: 'OPENROUTER_BASE_URL', modelKey: 'OPENROUTER_IMAGE_MODEL', defaultBaseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'google/gemini-3.1-flash-image-preview', defaultKey: 'IMAGE_BACKEND', defaultValue: 'openrouter', extraKeys: ['OPENROUTER_HTTP_REFERER', 'OPENROUTER_TITLE'], mode: 'openai' },
  dashscope: { apiKey: 'DASHSCOPE_API_KEY', baseUrl: 'DASHSCOPE_BASE_URL', modelKey: 'DASHSCOPE_IMAGE_MODEL', defaultBaseUrl: 'https://dashscope.aliyuncs.com', defaultModel: 'qwen-image-2.0-pro', defaultKey: 'IMAGE_BACKEND', defaultValue: 'dashscope', mode: 'presence' },
  zai: { apiKey: 'ZAI_API_KEY', baseUrl: 'ZAI_BASE_URL', modelKey: 'ZAI_IMAGE_MODEL', defaultBaseUrl: 'https://api.z.ai/api/paas/v4', defaultModel: 'glm-image', defaultKey: 'IMAGE_BACKEND', defaultValue: 'zai', mode: 'openai' },
  minimax: { apiKey: 'MINIMAX_API_KEY', baseUrl: 'MINIMAX_BASE_URL', modelKey: 'MINIMAX_IMAGE_MODEL', defaultBaseUrl: 'https://api.minimaxi.com', defaultModel: 'image-01', defaultKey: 'IMAGE_BACKEND', defaultValue: 'minimax', mode: 'presence' },
  replicate: { apiKey: 'REPLICATE_API_TOKEN', baseUrl: 'REPLICATE_BASE_URL', modelKey: 'REPLICATE_IMAGE_MODEL', defaultBaseUrl: 'https://api.replicate.com', defaultModel: 'google/nano-banana-2', defaultKey: 'IMAGE_BACKEND', defaultValue: 'replicate', mode: 'replicate' },
  seedream: { apiKey: 'ARK_API_KEY', baseUrl: 'SEEDREAM_BASE_URL', modelKey: 'SEEDREAM_IMAGE_MODEL', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seedream-5-0-260128', defaultKey: 'IMAGE_BACKEND', defaultValue: 'seedream', mode: 'presence' },
  jimeng: { baseUrl: 'JIMENG_BASE_URL', modelKey: 'JIMENG_IMAGE_MODEL', defaultBaseUrl: 'https://visual.volcengineapi.com', defaultModel: 'jimeng_t2i_v40', defaultKey: 'IMAGE_BACKEND', defaultValue: 'jimeng', extraKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'], mode: 'presence' },
}

function cleanUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function getValue(settings: Record<string, string>, key?: string) {
  return key ? String(settings[key] || '').trim() : ''
}

async function fetchJsonish(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 300) || res.statusText }
  }
  return { ok: true, status: res.status, message: text.slice(0, 300) }
}

settingsRoute.get('/', (c) => {
  return c.json(readSettingsSanitized())
})

settingsRoute.get('/raw', (c) => {
  return c.json(readSettings())
})

settingsRoute.post('/import', async (c) => {
  const values = await c.req.json()
  if (typeof values !== 'object' || values === null) {
    return c.json({ error: 'object required' }, 400)
  }

  for (const [key, val] of Object.entries(values)) {
    if (val === undefined || val === null) continue
    // Skip placeholder masked values to prevent overwriting active secrets with dots
    if (typeof val === 'string' && val.startsWith('••••••••')) {
      continue
    }
    writeSetting(key, String(val))
  }

  return c.json({ success: true, settings: readSettingsSanitized() })
})

settingsRoute.post('/test-provider', async (c) => {
  const { providerId } = await c.req.json()
  const spec = providerSpecs[String(providerId || '')]
  if (!spec) return c.json({ success: false, error: 'unknown provider' }, 400)

  const settings = readSettings()
  const apiKey = getValue(settings, spec.apiKey)
  const authToken = getValue(settings, spec.authToken)
  const baseUrl = cleanUrl(getValue(settings, spec.baseUrl) || spec.defaultBaseUrl)
  const model = getValue(settings, spec.modelKey) || spec.defaultModel
  const missing = [
    ...(spec.apiKey && !apiKey && !authToken ? [spec.apiKey] : []),
    ...(spec.extraKeys || []).filter(key => !getValue(settings, key)),
  ]

  if (missing.length) {
    return c.json({ success: false, error: `missing settings: ${missing.join(', ')}` }, 400)
  }

  if (spec.mode === 'presence') {
    return c.json({ success: true, message: `configuration present: ${model}` })
  }

  try {
    if (spec.mode === 'anthropic') {
      const headers: Record<string, string> = { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
      if (apiKey) headers['x-api-key'] = apiKey
      if (authToken) headers.authorization = `Bearer ${authToken}`
      const result = await fetchJsonish(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      if (!result.ok) return c.json({ success: false, error: result.message, status: result.status }, 400)
      return c.json({ success: true, message: `connection ok: ${model}` })
    }

    if (spec.mode === 'google') {
      const result = await fetchJsonish(`${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`, {})
      if (!result.ok) return c.json({ success: false, error: result.message, status: result.status }, 400)
      return c.json({ success: true, message: `connection ok: ${model}` })
    }

    if (spec.mode === 'replicate') {
      const result = await fetchJsonish(`${baseUrl}/v1/models`, { headers: { authorization: `Bearer ${apiKey}` } })
      if (!result.ok) return c.json({ success: false, error: result.message, status: result.status }, 400)
      return c.json({ success: true, message: `connection ok: ${model}` })
    }

    const headers: Record<string, string> = { authorization: `Bearer ${apiKey}` }
    const referer = getValue(settings, 'OPENROUTER_HTTP_REFERER')
    const title = getValue(settings, 'OPENROUTER_TITLE')
    if (referer) headers['HTTP-Referer'] = referer
    if (title) headers['X-Title'] = title
    const result = await fetchJsonish(`${baseUrl}/models`, { headers })
    if (!result.ok) return c.json({ success: false, error: result.message, status: result.status }, 400)
    return c.json({ success: true, message: `connection ok: ${model}` })
  } catch (err: any) {
    return c.json({ success: false, error: err?.message || 'test failed' }, 400)
  }
})

settingsRoute.post('/', async (c) => {
  const { key, value } = await c.req.json()
  if (!key || value === undefined) {
    return c.json({ error: 'key and value required' }, 400)
  }
  writeSetting(key, String(value))

  const settings = readSettings()
  const sanitized = readSettingsSanitized()
  return c.json({ success: true, value: settings[key], display: sanitized[key] })
})

export default settingsRoute
