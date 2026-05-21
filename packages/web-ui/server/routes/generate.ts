import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { streamGenerate, generatePlan, type ProjectPlan, getSkill, resolveSourceContext } from '@happyimage/core'

const generate = new Hono()

generate.post('/plan', async (c) => {
  let body: { skillId?: string; selections?: Record<string, string>; content?: string; sourceMode?: string; sourceRef?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const { skillId, selections, content } = body
  if (!skillId) return c.json({ error: 'skillId required' }, 400)
  if (!getSkill(skillId)) return c.json({ error: 'Skill not found' }, 404)

  let resolvedContent = content || ''
  try {
    const sourceContext = resolveSourceContext({ mode: body.sourceMode, ref: body.sourceRef })
    if (sourceContext) {
      resolvedContent = [
        resolvedContent ? `# User Request\n\n${resolvedContent}` : '# User Request\n\n请基于以下项目生成适合社交传播的内容。',
        '',
        sourceContext,
      ].join('\n\n')
    }
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 400)
  }

  try {
    const plan = await generatePlan({ skillId, content: resolvedContent, selections: selections || {} })
    return c.json(plan)
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 500)
  }
})

generate.post('/', async (c) => {
  let body: { skillId?: string; selections?: Record<string, string>; content?: string; sourceMode?: string; sourceRef?: string; prebuiltPlan?: ProjectPlan }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { skillId, selections, content } = body
  if (!skillId) return c.json({ error: 'skillId required' }, 400)
  if (!getSkill(skillId)) return c.json({ error: 'Skill not found' }, 404)

  let resolvedContent = content || ''
  try {
    const sourceContext = resolveSourceContext({ mode: body.sourceMode, ref: body.sourceRef })
    if (sourceContext) {
      resolvedContent = [
        resolvedContent ? `# User Request\n\n${resolvedContent}` : '# User Request\n\n请基于以下项目生成适合社交传播的内容。',
        '',
        sourceContext,
      ].join('\n\n')
    }
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 400)
  }

  return streamSSE(c, async (stream) => {
    let imagePaths: string[] = []
    let projectPath = ''

    try {
      await streamGenerate({
        skillId,
        content: resolvedContent,
        selections: selections || {},
        prebuiltPlan: body.prebuiltPlan,
        signal: c.req.raw.signal,
        onText: (text) => stream.writeSSE({ data: JSON.stringify({ type: 'text', text }) }),
        onToolUse: (name, input) => stream.writeSSE({ data: JSON.stringify({ type: 'tool_use', name, input }) }),
        onProject: (path) => {
          projectPath = path
          return stream.writeSSE({ data: JSON.stringify({ type: 'project', path }) })
        },
        onFile: (path, kind) => stream.writeSSE({ data: JSON.stringify({ type: 'file', path, kind }) }),
        onCaption: (caption) => stream.writeSSE({ data: JSON.stringify({ type: 'caption', caption }) }),
        onImage: (path) => {
          const url = `/api/image?path=${encodeURIComponent(path)}`
          imagePaths.push(url)
          return stream.writeSSE({ data: JSON.stringify({ type: 'image', path: url }) })
        },
        onError: (error) => stream.writeSSE({ data: JSON.stringify({ type: 'error', error }) }),
        onDone: () => stream.writeSSE({ data: JSON.stringify({ type: 'done', images: imagePaths, projectPath }) }),
      })
    } catch (err: any) {
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: err.message || 'Unexpected error' }) })
      await stream.writeSSE({ data: JSON.stringify({ type: 'done', images: imagePaths }) })
    }
  })
})

export default generate
