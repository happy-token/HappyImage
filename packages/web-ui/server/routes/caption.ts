import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import { getSkill, readApiKey, readBaseUrl, readModel } from '@happytokenai/happyimage-core'

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
      'Return only the publish copy in the exact format specified below. No explanation, no markdown fences.',
      'Use Chinese by default unless the source content is clearly another language.',
      '',
      '## REQUIRED OUTPUT FORMAT — follow exactly per platform:',
      '',
      '### Xiaohongshu (小红书):',
      'Title: <catchy title, max 20 Chinese characters>',
      '',
      '<body: 2-3 short paragraphs with emoji, practical tips, 100-500 chars>',
      '',
      '#tag1 #tag2 #tag3 #tag4',
      '',
      '### Weibo (微博):',
      'Title: <concise hook, 10-20 chars>',
      '',
      '<body: readable post text, use #话题格式# (double-hash wrapping) for 2-5 hashtags INLINE in the body>',
      'Do NOT put hashtags on a separate line. They must be part of the body text in #thisFormat#.',
      '',
      '### WeChat (微信公众号):',
      'Title: <article-style title, max 64 chars>',
      '',
      '<body: polished intro / short summary, 80-200 chars>',
      'CRITICAL: WeChat articles do NOT use hashtags. Do NOT output any #hashtag.',
      '',
      '### X / Twitter:',
      '<body: concise post under 280 chars, emoji OK, hashtags like #AIart INLINE in the text>',
      'Do NOT output a "Title:" line. Do NOT put hashtags on a separate line.',
      'The entire output for X should be just the tweet text, nothing else.',
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
        'Write a ready-to-edit publishing caption/post following the exact format for this platform.',
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
