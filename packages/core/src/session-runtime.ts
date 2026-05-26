import { mkdirSync } from 'fs'
import { join, resolve, basename } from 'path'
import { Database } from 'bun:sqlite'
import type { CommandRequest } from './commands.js'
import type { ProjectPlan } from './anthropic.js'

export type SessionStatus =
  | 'idle'
  | 'collecting'
  | 'asking'
  | 'planning'
  | 'awaiting-confirmation'
  | 'generating'
  | 'reviewing'
  | 'revising'
  | 'packaging'
  | 'publishing'
  | 'done'
  | 'error'

export type StructuredQuestionControl =
  | 'text'
  | 'single-choice'
  | 'multi-choice'
  | 'image-card-choice'
  | 'file-upload'
  | 'confirm'

export interface QuestionOption {
  id: string
  label: string
  description?: string
  image?: string
}

export interface StructuredQuestion {
  id: string
  title: string
  description?: string
  control: StructuredQuestionControl
  options?: QuestionOption[]
  defaultValue?: unknown
  required: boolean
}

export interface SessionArtifact {
  id: string
  type: 'image' | 'file' | 'prompt' | 'copy' | 'project' | 'package' | 'publish-result'
  path?: string
  url?: string
  title?: string
  version: number
  parentArtifactId?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface SessionTask {
  id: string
  sessionId: string
  kind: 'plan' | 'generate' | 'revise' | 'regenerate' | 'package' | 'publish'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  commandId?: string
  projectPath?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  targetImageIndex?: number
  targetImageName?: string
  createdAt: string
}

export type SessionEvent =
  | { id: string; seq?: number; createdAt: string; type: 'message'; role: 'user' | 'assistant' | 'system'; content: string }
  | { id: string; seq?: number; createdAt: string; type: 'command'; commandRequest: CommandRequest }
  | { id: string; seq?: number; createdAt: string; type: 'question'; question: StructuredQuestion }
  | { id: string; seq?: number; createdAt: string; type: 'answer'; questionId: string; answer: unknown }
  | { id: string; seq?: number; createdAt: string; type: 'plan'; plan: ProjectPlan }
  | { id: string; seq?: number; createdAt: string; type: 'tool'; name: string; status: 'started' | 'progress' | 'succeeded' | 'failed'; input?: unknown; message?: string }
  | { id: string; seq?: number; createdAt: string; type: 'task'; task: SessionTask }
  | { id: string; seq?: number; createdAt: string; type: 'retry'; attempt: number; delayMs: number; provider?: string; reason: string }
  | { id: string; seq?: number; createdAt: string; type: 'artifact'; artifact: SessionArtifact }
  | { id: string; seq?: number; createdAt: string; type: 'project'; path: string }
  | { id: string; seq?: number; createdAt: string; type: 'publish'; platform: string; status: string; message?: string }
  | { id: string; seq?: number; createdAt: string; type: 'progress'; message: string }
  | { id: string; seq?: number; createdAt: string; type: 'review'; artifacts: SessionArtifact[] }
  | { id: string; seq?: number; createdAt: string; type: 'revision-requested'; target: RevisionRequest['target']; instruction: string }
  | { id: string; seq?: number; createdAt: string; type: 'publish-status'; platform: string; status: string; message?: string }
  | { id: string; seq?: number; createdAt: string; type: 'error'; message: string; code?: string; retryable?: boolean; action?: string; details?: string }
  | { id: string; seq?: number; createdAt: string; type: 'done' }

export interface RevisionRequest {
  target:
    | { type: 'artifact'; artifactId: string }
    | { type: 'project'; projectPath: string }
    | { type: 'session' }
  instruction: string
  preserve?: string[]
}

export interface SkillSession {
  id: string
  title?: string
  status: SessionStatus
  commandRequest?: CommandRequest
  messages: SessionMessage[]
  answers: Record<string, unknown>
  artifacts: SessionArtifact[]
  tasks: SessionTask[]
  projectPath?: string
  activeProjectPath?: string
  events: SessionEvent[]
  createdAt: string
  updatedAt: string
}

type SessionRow = {
  id: string
  title: string | null
  status: SessionStatus
  commandRequestJson: string | null
  answersJson: string
  activeProjectPath: string | null
  createdAt: string
  updatedAt: string
}

type EventRow = { id: string; seq: number; sessionId: string; type: SessionEvent['type']; payloadJson: string; createdAt: string }
type ArtifactRow = { id: string; sessionId: string; type: SessionArtifact['type']; path: string | null; url: string | null; title: string | null; version: number; parentArtifactId: string | null; metadataJson: string; createdAt: string }
type TaskRow = { id: string; sessionId: string; kind: SessionTask['kind']; status: SessionTask['status']; commandId: string | null; projectPath: string | null; error: string | null; createdAt: string; updatedAt: string }

let db: Database | null = null

function now() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function happyImageDataDir() {
  const home = process.env.HOME || '/tmp'
  return resolve((process.env.HAPPYIMAGE_DATA_DIR || '~/.happyimage').replace(/^~/, home))
}

export function sessionDatabasePath() {
  return process.env.HAPPYIMAGE_SESSION_DB || join(happyImageDataDir(), 'happyimage.sqlite')
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function getDb() {
  if (db) return db
  mkdirSync(happyImageDataDir(), { recursive: true })
  const dbPath = sessionDatabasePath()

  function openDb() {
    const database = new Database(dbPath)
    database.exec('PRAGMA journal_mode = WAL')
    return database
  }

  function runMigrations(database: Database) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        appliedAt TEXT NOT NULL
      );
    `)
    const currentVersion = database.query('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null } | null
    const v = currentVersion?.v || 0
    const migrations: Array<[number, string]> = [
      [1, `
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT,
          status TEXT NOT NULL,
          commandRequestJson TEXT,
          answersJson TEXT NOT NULL DEFAULT '{}',
          activeProjectPath TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          sessionId TEXT NOT NULL,
          type TEXT NOT NULL,
          payloadJson TEXT NOT NULL,
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS events_session_seq_idx ON events(sessionId, seq);
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          type TEXT NOT NULL,
          path TEXT,
          url TEXT,
          title TEXT,
          version INTEGER NOT NULL,
          parentArtifactId TEXT,
          metadataJson TEXT NOT NULL DEFAULT '{}',
          createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS artifacts_session_idx ON artifacts(sessionId, createdAt);
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          sessionId TEXT NOT NULL,
          kind TEXT NOT NULL,
          status TEXT NOT NULL,
          commandId TEXT,
          projectPath TEXT,
          error TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS tasks_session_idx ON tasks(sessionId, updatedAt);
      `],
    ]
    for (const [version, sql] of migrations) {
      if (version > v) {
        database.exec(sql)
        database.query('INSERT INTO schema_version (version, appliedAt) VALUES (?, ?)').run(version, now())
      }
    }
  }

  try {
    db = openDb()
    runMigrations(db)
    return db
  } catch (err: any) {
    // Auto-recover from database corruption
    if (err?.code === 'SQLITE_NOTADB' || err?.code === 'SQLITE_CORRUPT' || err?.message?.includes('file is not a database')) {
      const corruptPath = `${dbPath}.corrupt.${Date.now()}`
      try { require('fs').renameSync(dbPath, corruptPath) } catch { require('fs').unlinkSync(dbPath) }
      db = openDb()
      runMigrations(db)
      return db
    }
    throw err
  }
}

function rowToEvent(row: EventRow): SessionEvent {
  return { ...parseJson<Record<string, unknown>>(row.payloadJson, {}), id: row.id, seq: row.seq, type: row.type, createdAt: row.createdAt } as SessionEvent
}

function rowToArtifact(row: ArtifactRow): SessionArtifact {
  return {
    id: row.id,
    type: row.type,
    path: row.path || undefined,
    url: row.url || undefined,
    title: row.title || undefined,
    version: row.version,
    parentArtifactId: row.parentArtifactId || undefined,
    metadata: parseJson(row.metadataJson, {}),
    createdAt: row.createdAt,
  }
}

function rowToTask(row: TaskRow): SessionTask {
  return {
    id: row.id,
    sessionId: row.sessionId,
    kind: row.kind,
    status: row.status,
    commandId: row.commandId || undefined,
    projectPath: row.projectPath || undefined,
    error: row.error || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function loadSession(row: SessionRow): SkillSession {
  const database = getDb()
  const events = database.query('SELECT * FROM events WHERE sessionId = ? ORDER BY seq ASC').all(row.id) as EventRow[]
  const artifacts = database.query('SELECT * FROM artifacts WHERE sessionId = ? ORDER BY createdAt ASC').all(row.id) as ArtifactRow[]
  const tasks = database.query('SELECT * FROM tasks WHERE sessionId = ? ORDER BY createdAt ASC').all(row.id) as TaskRow[]
  const messages = events.map(rowToEvent).filter((event): event is Extract<SessionEvent, { type: 'message' }> => event.type === 'message').map(event => ({
    id: event.id,
    role: event.role,
    content: event.content,
    targetImageIndex: (event as any).targetImageIndex,
    targetImageName: (event as any).targetImageName,
    createdAt: event.createdAt,
  }))
  return {
    id: row.id,
    title: (row.title && !row.title.startsWith('New Chat')) ? row.title : (row.activeProjectPath ? basename(row.activeProjectPath) : row.title || undefined),
    status: row.status,
    commandRequest: parseJson<CommandRequest | undefined>(row.commandRequestJson, undefined),
    answers: parseJson(row.answersJson, {}),
    artifacts: artifacts.map(rowToArtifact),
    tasks: tasks.map(rowToTask),
    projectPath: row.activeProjectPath || undefined,
    activeProjectPath: row.activeProjectPath || undefined,
    events: events.map(rowToEvent),
    messages,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listSessionEvents(sessionId: string, afterSeq = 0) {
  const rows = getDb().query('SELECT * FROM events WHERE sessionId = ? AND seq > ? ORDER BY seq ASC').all(sessionId, afterSeq) as EventRow[]
  return rows.map(rowToEvent)
}

export function createSessionTask(sessionId: string, task: Omit<SessionTask, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const database = getDb()
  const createdAt = now()
  const next: SessionTask = {
    id: task.id || id('task'),
    sessionId,
    kind: task.kind,
    status: task.status,
    commandId: task.commandId,
    projectPath: task.projectPath,
    error: task.error,
    createdAt,
    updatedAt: createdAt,
  }
  database.query('INSERT INTO tasks (id, sessionId, kind, status, commandId, projectPath, error, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(next.id, next.sessionId, next.kind, next.status, next.commandId || null, next.projectPath || null, next.error || null, next.createdAt, next.updatedAt)
  appendSessionEvent(sessionId, { type: 'task', task: next })
  return next
}

export function updateSessionTask(sessionId: string, taskId: string, patch: Partial<Pick<SessionTask, 'status' | 'projectPath' | 'error'>>) {
  const database = getDb()
  const row = database.query('SELECT * FROM tasks WHERE id = ? AND sessionId = ?').get(taskId, sessionId) as TaskRow | null
  if (!row) return null
  const updated = { ...rowToTask(row), ...patch, updatedAt: now() }
  database.query('UPDATE tasks SET status = ?, projectPath = ?, error = ?, updatedAt = ? WHERE id = ? AND sessionId = ?')
    .run(updated.status, updated.projectPath || null, updated.error || null, updated.updatedAt, taskId, sessionId)
  appendSessionEvent(sessionId, { type: 'task', task: updated })
  return updated
}

export function getActiveSessionTask(sessionId: string) {
  const row = getDb().query("SELECT * FROM tasks WHERE sessionId = ? AND status IN ('queued', 'running') ORDER BY createdAt DESC LIMIT 1").get(sessionId) as TaskRow | null
  return row ? rowToTask(row) : null
}

export function createSkillSession(initial?: { message?: string; commandRequest?: CommandRequest; title?: string }): SkillSession {
  const database = getDb()
  const createdAt = now()
  const session: SkillSession = {
    id: id('ses'),
    title: initial?.title || initial?.message?.slice(0, 80),
    status: initial?.commandRequest ? 'collecting' : 'idle',
    commandRequest: initial?.commandRequest,
    messages: [],
    answers: {},
    artifacts: [],
    tasks: [],
    events: [],
    createdAt,
    updatedAt: createdAt,
  }
  database.query('INSERT INTO sessions (id, title, status, commandRequestJson, answersJson, activeProjectPath, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(session.id, session.title || null, session.status, session.commandRequest ? JSON.stringify(session.commandRequest) : null, '{}', null, session.createdAt, session.updatedAt)
  if (initial?.message) appendSessionMessage(session.id, 'user', initial.message)
  if (initial?.commandRequest) {
    appendSessionEvent(session.id, { type: 'command', commandRequest: initial.commandRequest })
    appendSessionEvent(session.id, { type: 'progress', message: `Command request created: ${initial.commandRequest.commandId}` })
  }
  return getSkillSession(session.id) || session
}

export function listSkillSessions(limit?: number, offset?: number) {
  if (limit && limit > 0) {
    const rows = getDb().query('SELECT * FROM sessions ORDER BY updatedAt DESC LIMIT ? OFFSET ?').all(limit, offset || 0) as SessionRow[]
    return rows.map(loadSession)
  }
  const rows = getDb().query('SELECT * FROM sessions ORDER BY updatedAt DESC').all() as SessionRow[]
  return rows.map(loadSession)
}

export function getSkillSession(sessionId: string) {
  const row = getDb().query('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | null
  return row ? loadSession(row) : null
}

export function updateSkillSession(sessionId: string, patch: Partial<Pick<SkillSession, 'status' | 'commandRequest' | 'projectPath' | 'activeProjectPath' | 'title'>>) {
  const session = getSkillSession(sessionId)
  if (!session) return null
  const status = patch.status || session.status
  const title = patch.title !== undefined ? patch.title : session.title
  const commandRequest = patch.commandRequest !== undefined ? patch.commandRequest : session.commandRequest
  const activeProjectPath = patch.activeProjectPath || patch.projectPath || session.activeProjectPath || null
  getDb().query('UPDATE sessions SET title = ?, status = ?, commandRequestJson = ?, activeProjectPath = ?, updatedAt = ? WHERE id = ?')
    .run(title || null, status, commandRequest ? JSON.stringify(commandRequest) : null, activeProjectPath, now(), sessionId)
  if (patch.commandRequest) appendSessionEvent(sessionId, { type: 'command', commandRequest: patch.commandRequest })
  if (patch.projectPath || patch.activeProjectPath) appendSessionEvent(sessionId, { type: 'project', path: activeProjectPath })
  return getSkillSession(sessionId)
}

export function deleteSkillSession(sessionId: string): boolean {
  const session = getSkillSession(sessionId)
  if (!session) return false
  const db = getDb()
  db.query('DELETE FROM events WHERE sessionId = ?').run(sessionId)
  db.query('DELETE FROM artifacts WHERE sessionId = ?').run(sessionId)
  db.query('DELETE FROM tasks WHERE sessionId = ?').run(sessionId)
  db.query('DELETE FROM sessions WHERE id = ?').run(sessionId)
  return true
}

export function getSessionPreview(sessionId: string) {
  const session = getSkillSession(sessionId)
  if (!session) return null
  const lastMsg = [...session.messages].reverse().find(m => m.role === 'user')
  const imageCount = session.artifacts.filter(a => a.type === 'image').length
  return {
    id: session.id,
    title: (session.title && !session.title.startsWith('New Chat')) ? session.title : (session.activeProjectPath || session.projectPath ? basename(session.activeProjectPath || session.projectPath!) : lastMsg?.content?.slice(0, 60) || 'New Chat'),
    status: session.status,
    lastMessage: lastMsg?.content?.slice(0, 100) || '',
    imageCount,
    artifactCount: session.artifacts.length,
    projectPath: session.projectPath || session.activeProjectPath || undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

export function appendSessionMessage(sessionId: string, role: SessionMessage['role'], content: string, extra?: Record<string, unknown>) {
  const message: SessionMessage = { id: id('msg'), role, content, createdAt: now(), ...extra }
  appendSessionEvent(sessionId, { type: 'message', role, content, ...extra })
  return message
}

export function syncSessionMessages(sessionId: string, messages: Array<{ role: string; content: string }>) {
  const session = getSkillSession(sessionId)
  if (!session) return null
  const hasMessages = session.messages.length > 0
  if (hasMessages) return session
  const imported: SessionMessage[] = []
  for (const m of messages) {
    if (!m.content?.trim()) continue
    const role = m.role === 'assistant' || m.role === 'system' ? m.role : 'user'
    const msg = appendSessionMessage(sessionId, role as SessionMessage['role'], m.content)
    imported.push(msg)
  }
  return { ...getSkillSession(sessionId)!, messages: imported }
}

export function appendSessionArtifact(sessionId: string, artifact: Omit<SessionArtifact, 'id' | 'createdAt' | 'version'> & { id?: string; version?: number }) {
  const next: SessionArtifact = {
    id: artifact.id || id('art'),
    createdAt: now(),
    version: artifact.version || 1,
    ...artifact,
  }
  getDb().query('INSERT INTO artifacts (id, sessionId, type, path, url, title, version, parentArtifactId, metadataJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(next.id, sessionId, next.type, next.path || null, next.url || null, next.title || null, next.version, next.parentArtifactId || null, JSON.stringify(next.metadata || {}), next.createdAt)
  appendSessionEvent(sessionId, { type: 'artifact', artifact: next })
  return next
}

export function appendSessionEvent(sessionId: string, event: Record<string, unknown> & { type: SessionEvent['type'] }) {
  const session = getDb().query('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!session) return null
  const createdAt = now()
  const eventId = id('evt')
  const { type, ...payload } = event
  getDb().query('INSERT INTO events (id, sessionId, type, payloadJson, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(eventId, sessionId, type, JSON.stringify(payload), createdAt)
  getDb().query('UPDATE sessions SET updatedAt = ? WHERE id = ?').run(createdAt, sessionId)
  const row = getDb().query('SELECT * FROM events WHERE id = ?').get(eventId) as EventRow
  return rowToEvent(row)
}

export function answerSessionQuestion(sessionId: string, questionId: string, answer: unknown) {
  const session = getSkillSession(sessionId)
  if (!session) return null
  const answers = { ...session.answers, [questionId]: answer }
  const updatedAt = now()
  getDb().query('UPDATE sessions SET answersJson = ?, status = ?, updatedAt = ? WHERE id = ?')
    .run(JSON.stringify(answers), 'collecting', updatedAt, sessionId)
  appendSessionEvent(sessionId, { type: 'answer', questionId, answer })
  appendSessionEvent(sessionId, { type: 'progress', message: `Answered ${questionId}` })
  return getSkillSession(sessionId)
}

export function requestSessionRevision(sessionId: string, request: RevisionRequest) {
  const session = getSkillSession(sessionId)
  if (!session) return null
  getDb().query('UPDATE sessions SET status = ?, updatedAt = ? WHERE id = ?').run('revising', now(), sessionId)
  const lastMsg = session.messages[session.messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== request.instruction) {
    appendSessionMessage(sessionId, 'user', request.instruction)
  }
  appendSessionEvent(sessionId, { type: 'revision-requested', target: request.target, instruction: request.instruction })
  return getSkillSession(sessionId)
}

export interface SessionStreamAdapter {
  sessionId: string
  taskId: string
}

export function createSessionStreamAdapter(opts: SessionStreamAdapter) {
  let projectPath = ''
  const imagePaths: string[] = []

  return {
    getImagePaths: () => imagePaths,
    getProjectPath: () => projectPath,
    callbacks: {
      onText: (text: string) => {
        appendSessionEvent(opts.sessionId, { type: 'progress', message: text })
        return Promise.resolve()
      },
      onToolUse: (name: string, input: Record<string, unknown>) => {
        appendSessionEvent(opts.sessionId, { type: 'tool', name, status: 'started', input })
        return Promise.resolve()
      },
      onRetry: (retry: { attempt: number; delayMs: number; provider?: string; reason: string }) => {
        appendSessionEvent(opts.sessionId, { type: 'retry', attempt: retry.attempt, delayMs: retry.delayMs, provider: retry.provider, reason: retry.reason })
        return Promise.resolve()
      },
      onProject: (path: string) => {
        projectPath = path
        updateSkillSession(opts.sessionId, { projectPath: path })
        updateSessionTask(opts.sessionId, opts.taskId, { projectPath: path })
        appendSessionArtifact(opts.sessionId, { type: 'project', path, title: 'Project' })
        return Promise.resolve()
      },
      onFile: (path: string, kind: string) => {
        const artifactType = kind === 'prompt' ? 'prompt' as const : 'file' as const
        appendSessionArtifact(opts.sessionId, { type: artifactType, path, title: kind })
        return Promise.resolve()
      },
      onCaption: (caption: string) => {
        return Promise.resolve()
      },
      onImage: (path: string) => {
        const url = `/api/image?path=${encodeURIComponent(path)}`
        imagePaths.push(url)
        appendSessionArtifact(opts.sessionId, { type: 'image', path, url, title: 'Generated image' })
        return Promise.resolve()
      },
      onError: (error: string) => {
        updateSkillSession(opts.sessionId, { status: 'error' })
        updateSessionTask(opts.sessionId, opts.taskId, { status: 'failed', error })
        appendSessionEvent(opts.sessionId, { type: 'error', code: 'GENERATION_ERROR', message: error, retryable: true, action: 'retry', details: `taskId: ${opts.taskId}` })
        return Promise.resolve()
      },
      onDone: () => {
        updateSkillSession(opts.sessionId, { status: 'reviewing', projectPath })
        updateSessionTask(opts.sessionId, opts.taskId, { status: 'succeeded', projectPath })
        appendSessionEvent(opts.sessionId, { type: 'review', artifacts: getSkillSession(opts.sessionId)?.artifacts || [] })
        appendSessionEvent(opts.sessionId, { type: 'done' })
        return Promise.resolve()
      },
    },
  }
}
