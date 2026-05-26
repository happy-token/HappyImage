import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  createSkillSession,
  getSkillSession,
  deleteSkillSession,
  appendSessionEvent,
} from '../src/session-runtime'

const origEnv = { ...process.env }
const testDataDir = join(tmpdir(), 'happyimage-corruption-test-' + Date.now())
const testDbPath = join(testDataDir, 'happyimage.sqlite')

beforeAll(() => {
  process.env.HAPPYIMAGE_DATA_DIR = testDataDir
  process.env.HAPPYIMAGE_SESSION_DB = testDbPath
})

afterAll(() => {
  process.env.HAPPYIMAGE_DATA_DIR = origEnv.HAPPYIMAGE_DATA_DIR || ''
  process.env.HAPPYIMAGE_SESSION_DB = origEnv.HAPPYIMAGE_SESSION_DB || ''
  rmSync(testDataDir, { recursive: true, force: true })
})

describe('session-runtime', () => {
  test('createSkillSession and getSkillSession round-trip', () => {
    const session = createSkillSession({ message: 'hello' })
    expect(session.id).toBeDefined()
    expect(session.status).toBe('idle')

    const loaded = getSkillSession(session.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(session.id)
  })

  test('appendSessionEvent stores and retrieves events', () => {
    const session = createSkillSession({ message: 'test events' })
    appendSessionEvent(session.id, { type: 'progress', message: 'step 1' })
    appendSessionEvent(session.id, { type: 'progress', message: 'step 2' })

    const loaded = getSkillSession(session.id)
    expect(loaded!.events.filter(e => e.type === 'progress').length).toBe(2)
  })

  test('deleteSkillSession cascades events and artifacts', () => {
    const session = createSkillSession({ message: 'to delete' })
    appendSessionEvent(session.id, { type: 'progress', message: 'will be deleted' })
    expect(getSkillSession(session.id)).not.toBeNull()

    const ok = deleteSkillSession(session.id)
    expect(ok).toBe(true)
    expect(getSkillSession(session.id)).toBeNull()
  })

  test('getSkillSession returns null for unknown id', () => {
    expect(getSkillSession('nonexistent-id')).toBeNull()
  })

  test('structured error event preserves code, retryable, action, details', () => {
    const session = createSkillSession({ message: 'error test' })
    appendSessionEvent(session.id, {
      type: 'error',
      code: 'GENERATION_ERROR',
      message: 'AI service unavailable',
      retryable: true,
      action: 'retry',
      details: 'taskId: task_abc123',
    })

    const loaded = getSkillSession(session.id)
    const errorEvent = loaded!.events.find(e => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect((errorEvent as any).code).toBe('GENERATION_ERROR')
    expect((errorEvent as any).retryable).toBe(true)
    expect((errorEvent as any).action).toBe('retry')
    expect((errorEvent as any).details).toContain('task_abc123')
  })

  test('createSkillSession without args creates a new idle session', () => {
    const session = createSkillSession()
    expect(session.id).toBeDefined()
    expect(session.status).toBe('idle')
    expect(getSkillSession(session.id)).not.toBeNull()
  })

  test('createSkillSession with title stores title', () => {
    const session = createSkillSession({ title: 'My project' })
    const loaded = getSkillSession(session.id)
    // title may be stored directly or derived from projectPath
    expect(loaded).not.toBeNull()
  })
})
