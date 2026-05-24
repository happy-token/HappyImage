import { Hono } from 'hono'
import { getSkill, getPreferenceSchema, publishSchemas, getPreferenceInfo, writePreferenceInfo, type PreferenceScope } from '@happyimage/core'

const preferences = new Hono()
const extraPreferenceSkills = new Set([
  'post-to-wechat',
  'baoyu-post-to-wechat',
  'post-to-weibo',
  'baoyu-post-to-weibo',
  'post-to-x',
  'baoyu-post-to-x',
])

function isAllowedPreferenceSkill(skillId: string) {
  return Boolean(getSkill(skillId)) || extraPreferenceSkills.has(skillId)
}

preferences.get('/:skillId', (c) => {
  const skillId = c.req.param('skillId')
  if (!isAllowedPreferenceSkill(skillId)) return c.json({ error: 'Skill not found' }, 404)
  return c.json(getPreferenceInfo(skillId))
})

preferences.get('/:skillId/schema', (c) => {
  const skillId = c.req.param('skillId')
  if (!isAllowedPreferenceSkill(skillId)) return c.json({ error: 'Skill not found' }, 404)
  const publishKey = skillId.replace(/^baoyu-/, '')
  return c.json(publishSchemas[publishKey] || getPreferenceSchema(skillId))
})

preferences.post('/:skillId', async (c) => {
  const skillId = c.req.param('skillId')
  if (!isAllowedPreferenceSkill(skillId)) return c.json({ error: 'Skill not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const values = body.values
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return c.json({ error: 'values object required' }, 400)
  }
  const scope = body.scope ? String(body.scope) as PreferenceScope : undefined
  if (scope && !['config', 'legacy', 'project'].includes(scope)) {
    return c.json({ error: 'Invalid preference scope' }, 400)
  }
  return c.json(writePreferenceInfo(skillId, values, scope, body.currentPath ? String(body.currentPath) : null))
})

export default preferences
