import { Hono } from 'hono'
import { readSettingsSanitized, writeSetting, readSettings } from '@happyimage/core'

const settingsRoute = new Hono()

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
