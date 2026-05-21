import { Hono } from 'hono'
import { getSkill } from '../../src/data/index'

const exportRoute = new Hono()

exportRoute.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { skillId, selections, content, language, aspectRatio, imageCount } = body

    const skill = skillId ? getSkill(skillId) : undefined

    const cliArgs = Object.entries(selections || {})
      .map(([k, v]) => `--${k} ${v}`)
      .join(' ')

    const contentArg = content ? `"${content.slice(0, 80)}..."` : '<content>'
    const command = skill
      ? `/baoyu-${skill.id} ${contentArg} ${cliArgs} --lang ${language || 'zh'}`.replace(/\s+/g, ' ').trim()
      : ''

    const selectedItems: string[] = []
    if (skill && selections) {
      for (const [dim, itemId] of Object.entries(selections)) {
        const dimension = skill.dimensions[dim]
        if (dimension) {
          const item = dimension.items.find(i => i.id === itemId)
          if (item) selectedItems.push(`${dimension.label}: ${item.name}`)
        }
      }
    }

    return c.json({
      skillId: skill?.id || 'unknown',
      skillName: skill?.name || 'Unknown',
      selections: selections || {},
      parameters: { language, aspectRatio, imageCount },
      content: content || '',
      claudeCommand: command,
      promptPreview: [
        `Skill: ${skill?.name || 'Unknown'}`,
        `Selections: ${selectedItems.join(', ') || 'Auto'}`,
        `Language: ${language || 'zh'}`,
        `Aspect Ratio: ${aspectRatio || '16:9'}`,
      ].join('\n'),
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

export default exportRoute
