import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import { getSkill, readApiKey, readBaseUrl, readModel } from '@happyimage/core'

const caption = new Hono()

const platformNames: Record<string, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  weibo: '微博',
  x: 'X / Twitter',
}

caption.post('/', async (c) => {
  let body: {
    skillId?: string
    content?: string
    selections?: Record<string, string>
    platform?: string
    imageCount?: number
  }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const apiKey = readApiKey()
  if (!apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not set. Please configure it in Settings.' }, 400)

  const skill = body.skillId ? getSkill(body.skillId) : null
  if (!skill) return c.json({ error: 'Skill not found' }, 404)

  const platform = platformNames[body.platform || 'xiaohongshu'] || body.platform || '小红书'
  const selectionText = Object.entries(body.selections || {})
    .map(([key, value]) => {
      const item = skill.dimensions[key]?.items.find(i => i.id === value)
      return `${skill.dimensions[key]?.label || key}: ${item?.name || value}`
    })
    .join('\n')

  const client = new Anthropic({
    apiKey,
    ...(readBaseUrl() ? { baseURL: readBaseUrl() } : {}),
  })

  const message = await client.messages.create({
    model: readModel(),
    max_tokens: 1200,
    system: [
      'You write polished social publishing copy for AI-generated visual content.',
      'Return only the publish copy, no explanation.',
      'Use Chinese by default unless the source content is clearly another language.',
      'For Xiaohongshu: catchy title, short paragraphs, practical value, 4-8 hashtags.',
      'For Weibo: concise hook, readable body, 2-5 hashtags.',
      'For WeChat: article-style title, short summary, polished intro.',
      'For X/Twitter: concise post, no more than 280 characters unless the content requires a thread.',
    ].join('\n'),
    messages: [{
      role: 'user',
      content: [
        `Platform: ${platform}`,
        `Visual skill: ${skill.nameZh} / ${skill.name}`,
        `Images generated: ${body.imageCount || 0}`,
        selectionText ? `Selected style settings:\n${selectionText}` : '',
        `Source content:\n"""${(body.content || '').slice(0, 4000)}"""`,
        '',
        'Write a ready-to-edit publishing caption/post for this generated visual asset.',
      ].filter(Boolean).join('\n\n'),
    }],
  })

  const text = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim()

  return c.json({ caption: text })
})

export default caption
