import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  streamGenerate, generatePlan, type ProjectPlan, getSkill, resolveSourceContext,
  parseSlashCommand, resolveSkillDir, isVendorAvailable,
  createSkillSession, updateSkillSession, appendSessionEvent,
  appendSessionArtifact, updateSessionTask, createSessionTask,
  getSkillSession, createSessionStreamAdapter,
} from '@happytokenai/happyimage-core'

const generate = new Hono()

type GenerateBody = { skillId?: string; selections?: Record<string, string>; content?: string; sourceMode?: string; sourceRef?: string; prebuiltPlan?: ProjectPlan }

function normalizeGenerationRequest(body: GenerateBody): GenerateBody {
  const parsed = parseSlashCommand(body.content || '')
  if (!parsed) return body
  if (!parsed.command) throw new Error(`Unknown slash command: ${parsed.commandId}`)
  if (!isVendorAvailable() && !resolveSkillDir(parsed.command.requiredSkill)) {
    throw new Error(`Required skill not found: ${parsed.command.requiredSkill}. Configure BAOYU_SKILLS_ROOT or install baoyu-skills to the skills/ directory under the HappyImage config path.`)
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
    appendSessionEvent(session.id, { type: 'error', code: 'PLAN_FAILED', message: err.message || String(err), retryable: true, action: 'retry' })
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
    const adapter = createSessionStreamAdapter({ sessionId: session.id, taskId: task.id })

    try {
      await streamGenerate({
        skillId,
        content: resolvedContent,
        selections: selections || {},
        prebuiltPlan: body.prebuiltPlan,
        signal: c.req.raw.signal,
        onText: (text) => {
          adapter.callbacks.onText(text)
          return stream.writeSSE({ data: JSON.stringify({ type: 'text', text }) })
        },
        onToolUse: (name, input) => {
          adapter.callbacks.onToolUse(name, input)
          return stream.writeSSE({ data: JSON.stringify({ type: 'tool_use', name, input }) })
        },
        onProject: (path) => {
          adapter.callbacks.onProject(path)
          return stream.writeSSE({ data: JSON.stringify({ type: 'project', path }) })
        },
        onFile: (path, kind) => {
          adapter.callbacks.onFile(path, kind)
          return stream.writeSSE({ data: JSON.stringify({ type: 'file', path, kind }) })
        },
        onCaption: (caption) => stream.writeSSE({ data: JSON.stringify({ type: 'caption', caption }) }),
        onImage: (path) => {
          adapter.callbacks.onImage(path)
          return stream.writeSSE({ data: JSON.stringify({ type: 'image', path: `/api/image?path=${encodeURIComponent(path)}` }) })
        },
        onError: (error) => {
          adapter.callbacks.onError(error)
          return stream.writeSSE({ data: JSON.stringify({ type: 'error', error }) })
        },
        onDone: () => {
          adapter.callbacks.onDone()
          return stream.writeSSE({ data: JSON.stringify({ type: 'done', images: adapter.getImagePaths(), projectPath: adapter.getProjectPath(), sessionId: session.id }) })
        },
      })
    } catch (err: any) {
      updateSkillSession(session.id, { status: 'error' })
      updateSessionTask(session.id, task.id, { status: 'failed', error: err.message || 'Unexpected error' })
      appendSessionEvent(session.id, { type: 'error', code: 'UNEXPECTED_ERROR', message: err.message || 'Unexpected error', retryable: true, action: 'retry', details: `taskId: ${task.id}` })
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: err.message || 'Unexpected error' }) })
      await stream.writeSSE({ data: JSON.stringify({ type: 'done', images: adapter.getImagePaths(), sessionId: session.id }) })
    }
  })
})

export default generate
