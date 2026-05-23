import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  streamGenerate, generatePlan, type ProjectPlan, getSkill, resolveSourceContext,
  parseSlashCommand, resolveSkillDir, isVendorAvailable,
  createSkillSession, updateSkillSession, appendSessionEvent,
  appendSessionArtifact, updateSessionTask, createSessionTask,
  getSkillSession,
} from '@happyimage/core'

const generate = new Hono()

type GenerateBody = { skillId?: string; selections?: Record<string, string>; content?: string; sourceMode?: string; sourceRef?: string; prebuiltPlan?: ProjectPlan }

function normalizeGenerationRequest(body: GenerateBody): GenerateBody {
  const parsed = parseSlashCommand(body.content || '')
  if (!parsed) return body
  if (!parsed.command) throw new Error(`Unknown slash command: ${parsed.commandId}`)
  if (!isVendorAvailable() && !resolveSkillDir(parsed.command.requiredSkill)) {
    throw new Error(`Required skill not found: ${parsed.command.requiredSkill}. Configure BAOYU_SKILLS_ROOT or install baoyu-skills to ~/.baoyu-skills.`)
  }
  if (parsed.command.category !== 'content' || !parsed.command.skillId) {
    throw new Error(`${parsed.commandId} is registered, but this chat flow currently supports content generation commands only.`)
  }

  const [firstArg, ...restArgs] = parsed.args
  const next: GenerateBody = { ...body, skillId: parsed.command.skillId }
  if (firstArg && /\.(md|markdown|txt)$/i.test(firstArg) && !body.sourceRef) {
    next.sourceMode = 'file'
    next.sourceRef = firstArg
    next.content = restArgs.join(' ')
  } else {
    next.content = parsed.rest
  }
  return next
}

generate.post('/plan', async (c) => {
  let body: GenerateBody
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  try { body = normalizeGenerationRequest(body) } catch (err: any) { return c.json({ error: err.message || String(err) }, 400) }

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

  // Auto-create session for backward compat
  const session = createSkillSession({ message: content || '' })
  appendSessionEvent(session.id, { type: 'progress', message: 'Planning via legacy /api/generate/plan' })

  try {
    const plan = await generatePlan({ skillId, content: resolvedContent, selections: selections || {} })
    updateSkillSession(session.id, { status: 'awaiting-confirmation' })
    appendSessionEvent(session.id, { type: 'plan', plan })
    return c.json({ ...plan, sessionId: session.id })
  } catch (err: any) {
    updateSkillSession(session.id, { status: 'error' })
    appendSessionEvent(session.id, { type: 'error', message: err.message || String(err) })
    return c.json({ error: err.message || String(err), sessionId: session.id }, 500)
  }
})

generate.post('/', async (c) => {
  let body: GenerateBody
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }
  try { body = normalizeGenerationRequest(body) } catch (err: any) { return c.json({ error: err.message || String(err) }, 400) }

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

  // Auto-create session and task for backward compat
  const session = createSkillSession({ message: content || '' })
  updateSkillSession(session.id, { status: 'generating' })
  const task = createSessionTask(session.id, { kind: 'generate', status: 'running' })

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
        onText: (text) => {
          appendSessionEvent(session.id, { type: 'progress', message: text })
          return stream.writeSSE({ data: JSON.stringify({ type: 'text', text }) })
        },
        onToolUse: (name, input) => {
          appendSessionEvent(session.id, { type: 'tool', name, status: 'started', input })
          return stream.writeSSE({ data: JSON.stringify({ type: 'tool_use', name, input }) })
        },
        onProject: (path) => {
          projectPath = path
          updateSkillSession(session.id, { projectPath: path })
          updateSessionTask(session.id, task.id, { projectPath: path })
          appendSessionArtifact(session.id, { type: 'project', path, title: 'Project' })
          return stream.writeSSE({ data: JSON.stringify({ type: 'project', path }) })
        },
        onFile: (path, kind) => {
          appendSessionArtifact(session.id, { type: kind === 'prompt' ? 'prompt' : 'file', path, title: kind })
          return stream.writeSSE({ data: JSON.stringify({ type: 'file', path, kind }) })
        },
        onCaption: (caption) => stream.writeSSE({ data: JSON.stringify({ type: 'caption', caption }) }),
        onImage: (path) => {
          const url = `/api/image?path=${encodeURIComponent(path)}`
          imagePaths.push(url)
          appendSessionArtifact(session.id, { type: 'image', path, url, title: 'Generated image' })
          return stream.writeSSE({ data: JSON.stringify({ type: 'image', path: url }) })
        },
        onError: (error) => {
          updateSkillSession(session.id, { status: 'error' })
          updateSessionTask(session.id, task.id, { status: 'failed', error })
          appendSessionEvent(session.id, { type: 'error', message: error })
          return stream.writeSSE({ data: JSON.stringify({ type: 'error', error }) })
        },
        onDone: () => {
          updateSkillSession(session.id, { status: 'reviewing', projectPath })
          updateSessionTask(session.id, task.id, { status: 'succeeded', projectPath })
          appendSessionEvent(session.id, { type: 'review', artifacts: getSkillSession(session.id)?.artifacts || [] })
          return stream.writeSSE({ data: JSON.stringify({ type: 'done', images: imagePaths, projectPath, sessionId: session.id }) })
        },
      })
    } catch (err: any) {
      updateSkillSession(session.id, { status: 'error' })
      updateSessionTask(session.id, task.id, { status: 'failed', error: err.message || 'Unexpected error' })
      appendSessionEvent(session.id, { type: 'error', message: err.message || 'Unexpected error' })
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: err.message || 'Unexpected error' }) })
      await stream.writeSSE({ data: JSON.stringify({ type: 'done', images: imagePaths, sessionId: session.id }) })
    }
  })
})

export default generate
