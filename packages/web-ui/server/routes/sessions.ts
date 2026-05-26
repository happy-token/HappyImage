import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import {
  CORE_COMMANDS,
  appendSessionArtifact,
  appendSessionEvent,
  appendSessionMessage,
  answerSessionQuestion,
  commandRequestFromSlash,
  createSkillSession,
  createSessionTask,
  deleteSkillSession,
  generatePlan,
  getActiveSessionTask,
  getCoreCommand,
  getSessionPreview,
  getSkillSession,
  listSkillSessions,
  listSessionEvents,
  parseSlashCommand,
  requestSessionRevision,
  syncSessionMessages,
  resolveSkillDir,
  resolveSourceContext,
  streamGenerate,
  updateSessionTask,
  updateSkillSession,
  validateCommandRequest,
  isVendorAvailable,
  createSessionStreamAdapter,
  type CommandRequest,
  type ProjectPlan,
} from '@happytokenai/happyimage-core'

const sessionsRoute = new Hono()

// Skills that are handled by the vendored built-in implementation
const VENDOR_SKILLS = new Set(['baoyu-imagine'])

function skillInstalled(skillName: string) {
  // If the vendored baoyu-imagine is available, treat all content skills as installed
  // because they all ultimately delegate to baoyu-imagine for image generation.
  // The SKILL.md files are used for prompt guidance only, and we have built-in fallbacks.
  if (isVendorAvailable()) return true
  return Boolean(resolveSkillDir(skillName))
}

function commandToSkillId(commandId: string) {
  return getCoreCommand(commandId)?.skillId || ''
}

function contentFromRequest(request: CommandRequest) {
  const prompt = typeof request.options.prompt === 'string' ? request.options.prompt : ''
  if (request.source.type === 'text') return request.source.value
  if (request.source.type === 'file') {
    const sourceContext = resolveSourceContext({ mode: 'file', ref: request.source.value })
    return [
      prompt ? `# User Request\n\n${prompt}` : '# User Request\n\n请基于以下文档生成适合社交传播的内容。',
      '',
      sourceContext,
    ].join('\n\n')
  }
  return request.source.value
}

function optionsFromRequest(request: CommandRequest) {
  return Object.fromEntries(
    Object.entries(request.options || {})
      .filter(([key]) => key !== 'prompt')
      .map(([key, value]) => [key, String(value)]),
  )
}

function sessionResponse(sessionId: string) {
  const session = getSkillSession(sessionId)
  if (!session) return null
  return { session, activeTask: getActiveSessionTask(sessionId) }
}

// --- Collection routes ---

sessionsRoute.get('/', (c) => {
  const projectPath = c.req.query('projectPath')
  const limit = Number(c.req.query('limit')) || 0
  const offset = Number(c.req.query('offset')) || 0
  const sessions = listSkillSessions(limit || 0, offset)
  const filtered = projectPath
    ? sessions.filter(s => s.activeProjectPath === projectPath || s.projectPath === projectPath)
    : sessions
  return c.json(filtered.map(s => getSessionPreview(s.id)).filter(Boolean))
})

sessionsRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const hasProjectPath = typeof body.projectPath === 'string' && body.projectPath.trim()
  const hasTitle = typeof body.title === 'string' && body.title.trim()
  const hasMessage = typeof body.message === 'string' && body.message.trim()
  const hasCommandRequest = !!body.commandRequest

  // For blank session requests (no content), reuse existing blank to prevent race-condition duplicates
  if (!hasProjectPath && !hasTitle && !hasMessage && !hasCommandRequest) {
    const blank = listSkillSessions().find(s => {
      const lastMsg = s.messages.slice().reverse().find(m => m.role === 'user')
      const imageCount = s.artifacts.filter(a => a.type === 'image').length
      return !s.projectPath && !s.activeProjectPath && !lastMsg && imageCount === 0
    })
    if (blank) return c.json(sessionResponse(blank.id) || blank)
  }

  const session = createSkillSession({
    title: hasTitle ? body.title : undefined,
    message: hasMessage ? body.message : undefined,
    commandRequest: body.commandRequest as CommandRequest | undefined,
  })
  if (hasProjectPath) {
    updateSkillSession(session.id, { status: 'reviewing', projectPath: body.projectPath.trim() })
  }
  return c.json(sessionResponse(session.id) || session)
})

// --- Single session routes ---

sessionsRoute.get('/:id', (c) => {
  const result = sessionResponse(c.req.param('id'))
  if (!result) return c.json({ error: 'Session not found' }, 404)
  return c.json(result)
})

sessionsRoute.get('/:id/events', (c) => {
  const sessionId = c.req.param('id')
  const result = sessionResponse(sessionId)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  const after = Number(c.req.query('after') || 0)
  return c.json({
    ...result,
    events: listSessionEvents(sessionId, Number.isFinite(after) ? after : 0),
  })
})

// --- Session management ---

sessionsRoute.patch('/:id', async (c) => {
  const sessionId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const result = sessionResponse(sessionId)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  const patch: Record<string, string | undefined> = {}
  if (typeof body.title === 'string') patch.title = body.title.trim() || undefined
  if (typeof body.projectPath === 'string') patch.projectPath = body.projectPath.trim() || undefined
  if (Object.keys(patch).length > 0) updateSkillSession(sessionId, patch)
  return c.json(sessionResponse(sessionId))
})

sessionsRoute.delete('/:id', (c) => {
  const sessionId = c.req.param('id')
  const ok = deleteSkillSession(sessionId)
  if (!ok) return c.json({ error: 'Session not found' }, 404)
  return c.json({ ok: true })
})

// --- Message posting ---

sessionsRoute.post('/:id/messages', async (c) => {
  const sessionId = c.req.param('id')
  const session = getSkillSession(sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const message = String(body.message || '').trim()
  if (!message) return c.json({ error: 'message required' }, 400)

  const extra: Record<string, any> = {}
  if (typeof body.targetImageIndex === 'number') {
    extra.targetImageIndex = body.targetImageIndex
  }
  if (body.targetImageName) {
    extra.targetImageName = String(body.targetImageName)
  }

  appendSessionMessage(sessionId, 'user', message, extra)

  const parsed = parseSlashCommand(message)
  if (parsed) {
    const request = commandRequestFromSlash(message)
    if (!request) {
      appendSessionEvent(sessionId, { type: 'error', code: 'UNKNOWN_COMMAND', message: `Unknown command: ${parsed.commandId}`, retryable: true, action: 'check_command' })
      return c.json({ error: `Unknown command: ${parsed.commandId}` }, 404)
    }
    updateSkillSession(sessionId, { status: 'collecting', commandRequest: request })
    appendSessionEvent(sessionId, { type: 'progress', message: `Parsed ${request.commandId}` })
    return c.json(sessionResponse(sessionId))
  }

  if (body.targetArtifactId || session.projectPath || session.artifacts.length) {
    requestSessionRevision(sessionId, {
      target: body.targetArtifactId
        ? { type: 'artifact', artifactId: String(body.targetArtifactId) }
        : session.projectPath
          ? { type: 'project', projectPath: session.projectPath }
          : { type: 'session' },
      instruction: message,
    })
    const task = createSessionTask(sessionId, {
      kind: 'revise',
      status: 'queued',
      commandId: session.commandRequest?.commandId,
      projectPath: session.projectPath,
    })
    appendSessionMessage(sessionId, 'assistant', '已记录修改要求，并加入当前 session 的修改任务队列。')
    return c.json({ session: getSkillSession(sessionId), activeTask: task })
  }

  updateSkillSession(sessionId, { status: 'asking' })
  appendSessionEvent(sessionId, {
    type: 'question',
    question: {
      id: 'commandId',
      title: '选择要使用的 baoyu skill',
      description: '我会把你的自然语言需求转换成对应的 slash command request。',
      control: 'single-choice',
      required: true,
      options: CORE_COMMANDS.filter(cmd => cmd.category === 'content').map(cmd => ({
        id: cmd.id,
        label: cmd.displayName,
        description: cmd.description,
      })),
      defaultValue: 'baoyu-image-cards',
    },
  })
  return c.json(sessionResponse(sessionId))
})

// --- Sync conversation history ---

sessionsRoute.post('/:id/sync', async (c) => {
  const sessionId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const messages = Array.isArray(body.messages) ? body.messages : []
  const result = syncSessionMessages(sessionId, messages)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  return c.json({ imported: result.messages.length })
})

// --- Answer session questions ---

sessionsRoute.post('/:id/answers', async (c) => {
  const sessionId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const session = answerSessionQuestion(sessionId, String(body.questionId || ''), body.answer)
  if (!session) return c.json({ error: 'Session not found' }, 404)
  if (body.questionId === 'commandId') {
    const lastUser = [...session.messages].reverse().find(m => m.role === 'user')?.content || ''
    const request: CommandRequest = {
      commandId: String(body.answer || 'baoyu-image-cards'),
      source: { type: 'text', value: lastUser },
      options: {},
    }
    updateSkillSession(sessionId, { status: 'collecting', commandRequest: request })
  }
  return c.json(sessionResponse(sessionId))
})

// --- Plan generation from command ---

sessionsRoute.post('/:id/command', async (c) => {
  const sessionId = c.req.param('id')
  const result = sessionResponse(sessionId)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const request = (body.commandRequest || result.session.commandRequest) as CommandRequest | undefined
  if (!request) return c.json({ error: 'commandRequest required' }, 400)

  const validation = validateCommandRequest(request, skillInstalled)
  if (!validation.ok || !validation.command) {
    updateSkillSession(sessionId, { status: 'error' })
    appendSessionEvent(sessionId, { type: 'error', code: 'INVALID_COMMAND', message: validation.error || 'Invalid command request', retryable: true, action: 'check_settings' })
    return c.json({ error: validation.error || 'Invalid command request' }, 400)
  }
  if (validation.command.category !== 'content' || !validation.command.skillId) {
    updateSkillSession(sessionId, { status: 'collecting', commandRequest: request })
    appendSessionEvent(sessionId, { type: 'progress', message: `${validation.command.id} is ready.` })
    return c.json(sessionResponse(sessionId))
  }

  updateSkillSession(sessionId, { status: 'planning', commandRequest: request })
  appendSessionEvent(sessionId, { type: 'progress', message: `Planning ${validation.command.id}...` })

  try {
    const plan = await generatePlan({
      skillId: validation.command.skillId,
      content: contentFromRequest(request),
      selections: optionsFromRequest(request),
    })
    updateSkillSession(sessionId, { status: 'awaiting-confirmation' })
    appendSessionEvent(sessionId, { type: 'plan', plan })
    return c.json({ ...sessionResponse(sessionId), plan })
  } catch (err: any) {
    updateSkillSession(sessionId, { status: 'error' })
    appendSessionEvent(sessionId, { type: 'error', code: 'PLAN_FAILED', message: err.message || String(err), retryable: true, action: 'retry' })
    return c.json({ error: err.message || String(err) }, 500)
  }
})

// --- Revision ---

sessionsRoute.post('/:id/revise', async (c) => {
  const sessionId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const session = requestSessionRevision(sessionId, {
    target: body.artifactId ? { type: 'artifact', artifactId: String(body.artifactId) } : { type: 'session' },
    instruction: String(body.instruction || ''),
    preserve: Array.isArray(body.preserve) ? body.preserve.map(String) : undefined,
  })
  if (!session) return c.json({ error: 'Session not found' }, 404)
  return c.json(sessionResponse(sessionId))
})

// --- Task management ---

sessionsRoute.post('/:id/tasks/:taskId/cancel', (c) => {
  const sessionId = c.req.param('id')
  const taskId = c.req.param('taskId')
  const result = sessionResponse(sessionId)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  const task = updateSessionTask(sessionId, taskId, { status: 'cancelled', error: 'Cancelled by user' })
  if (!task) return c.json({ error: 'Task not found' }, 404)
  appendSessionEvent(sessionId, { type: 'progress', message: `Cancelled task ${taskId}` })
  return c.json(sessionResponse(sessionId))
})

// --- SSE Streaming ---

sessionsRoute.post('/:id/run', async (c) => {
  const sessionId = c.req.param('id')
  const result = sessionResponse(sessionId)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const request = (body.commandRequest || result.session.commandRequest) as CommandRequest | undefined
  if (!request) return c.json({ error: 'commandRequest required' }, 400)
  const validation = validateCommandRequest(request, skillInstalled)
  if (!validation.ok || !validation.command?.skillId) return c.json({ error: validation.error || 'Invalid command request' }, 400)

  updateSkillSession(sessionId, { status: 'generating', commandRequest: request })
  appendSessionEvent(sessionId, { type: 'progress', message: `Running ${request.commandId}...` })
  const task = createSessionTask(sessionId, {
    kind: 'generate',
    status: 'running',
    commandId: request.commandId,
  })

  return streamSSE(c, async (stream) => {
    const skillId = commandToSkillId(request.commandId)
    const adapter = createSessionStreamAdapter({ sessionId, taskId: task.id })

    try {
      await streamGenerate({
        skillId,
        content: contentFromRequest(request),
        selections: optionsFromRequest(request),
        prebuiltPlan: body.prebuiltPlan as ProjectPlan | undefined,
        signal: c.req.raw.signal,
        onText: (text) => {
          adapter.callbacks.onText(text)
          return stream.writeSSE({ data: JSON.stringify({ type: 'text', text }) })
        },
        onToolUse: (name, input) => {
          adapter.callbacks.onToolUse(name, input)
          return stream.writeSSE({ data: JSON.stringify({ type: 'tool_use', name, input }) })
        },
        onRetry: (retry: any) => {
          adapter.callbacks.onRetry(retry)
          return stream.writeSSE({ data: JSON.stringify({ type: 'retry', ...retry }) })
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
          return stream.writeSSE({ data: JSON.stringify({ type: 'done', images: adapter.getImagePaths(), projectPath: adapter.getProjectPath(), sessionId }) })
        },
      })
    } catch (err: any) {
      updateSkillSession(sessionId, { status: 'error' })
      updateSessionTask(sessionId, task.id, { status: 'failed', error: err.message || 'Unexpected error' })
      appendSessionEvent(sessionId, { type: 'error', code: 'UNEXPECTED_ERROR', message: err.message || 'Unexpected error', retryable: true, action: 'retry', details: `taskId: ${task.id}` })
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', error: err.message || 'Unexpected error' }) })
      await stream.writeSSE({ data: JSON.stringify({ type: 'done', images: adapter.getImagePaths(), sessionId }) })
    }
  })
})

// --- Resume / replay stream ---

sessionsRoute.get('/:id/stream', async (c) => {
  const sessionId = c.req.param('id')
  const result = sessionResponse(sessionId)
  if (!result) return c.json({ error: 'Session not found' }, 404)
  const after = Number(c.req.query('after') || 0)

  return streamSSE(c, async (stream) => {
    const missedEvents = listSessionEvents(sessionId, Number.isFinite(after) ? after : 0)
    for (const event of missedEvents) {
      await stream.writeSSE({ data: JSON.stringify({ type: 'replay', event }) })
    }

    const currentTask = result.activeTask
    if (currentTask && currentTask.status === 'running') {
      await stream.writeSSE({ data: JSON.stringify({ type: 'resume', taskId: currentTask.id, status: 'running' }) })
    } else {
      const session = getSkillSession(sessionId)
      await stream.writeSSE({ data: JSON.stringify({
        type: 'done',
        status: session?.status,
        projectPath: session?.projectPath,
        artifacts: session?.artifacts || [],
        sessionId,
      })})
    }
  })
})

export default sessionsRoute
