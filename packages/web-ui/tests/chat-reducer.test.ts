import { describe, test, expect } from 'bun:test'
import { chatReducer, makeMessage } from '../src/lib/chat-reducer'

const empty = { messages: [], streamingMsgId: null, planningMsgId: null }

describe('chatReducer', () => {
  test('ADD_MESSAGE appends to messages', () => {
    const msg = makeMessage('user', 'hello')
    const state = chatReducer(empty, { type: 'ADD_MESSAGE', message: msg })
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].text).toBe('hello')
    expect(state.messages[0].role).toBe('user')
  })

  test('APPEND_TEXT extends existing message text', () => {
    const msg = makeMessage('assistant', 'foo')
    const state = chatReducer(
      { ...empty, messages: [msg] },
      { type: 'APPEND_TEXT', messageId: msg.id, text: 'bar' },
    )
    expect(state.messages[0].text).toBe('foobar')
  })

  test('APPEND_TEXT does nothing for unknown id', () => {
    const state = chatReducer(empty, { type: 'APPEND_TEXT', messageId: 'nonexistent', text: 'x' })
    expect(state.messages).toHaveLength(0)
  })

  test('SET_MESSAGE patches specific fields', () => {
    const msg = makeMessage('assistant', '', 'runner')
    const state = chatReducer(
      { ...empty, messages: [msg] },
      { type: 'SET_MESSAGE', messageId: msg.id, patch: { type: 'error', retryFn: () => {} } },
    )
    expect(state.messages[0].type).toBe('error')
    expect(state.messages[0].retryFn).toBeDefined()
  })

  test('REMOVE_MESSAGE deletes by id', () => {
    const msg1 = makeMessage('user', 'a')
    const msg2 = makeMessage('assistant', 'b')
    const state = chatReducer(
      { ...empty, messages: [msg1, msg2] },
      { type: 'REMOVE_MESSAGE', messageId: msg1.id },
    )
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].id).toBe(msg2.id)
  })

  test('SET_STREAMING sets streamingMsgId', () => {
    const state = chatReducer(empty, { type: 'SET_STREAMING', messageId: 'abc' })
    expect(state.streamingMsgId).toBe('abc')
  })

  test('SET_STREAMING null clears streaming', () => {
    const state = chatReducer(
      { ...empty, streamingMsgId: 'abc' },
      { type: 'SET_STREAMING', messageId: null },
    )
    expect(state.streamingMsgId).toBeNull()
  })

  test('SET_PLANNING sets planningMsgId', () => {
    const state = chatReducer(empty, { type: 'SET_PLANNING', messageId: 'plan-1' })
    expect(state.planningMsgId).toBe('plan-1')
  })

  test('CLEAR_PLANNING resets planningMsgId', () => {
    const state = chatReducer(
      { ...empty, planningMsgId: 'plan-1' },
      { type: 'CLEAR_PLANNING' },
    )
    expect(state.planningMsgId).toBeNull()
  })

  test('RESET_MESSAGES replaces all messages', () => {
    const old = makeMessage('user', 'old')
    const new1 = makeMessage('assistant', 'fresh')
    const new2 = makeMessage('user', 'new')
    const state = chatReducer(
      { ...empty, messages: [old], streamingMsgId: 'abc', planningMsgId: 'xyz' },
      { type: 'RESET_MESSAGES', messages: [new1, new2] },
    )
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].text).toBe('fresh')
    expect(state.streamingMsgId).toBeNull()
    expect(state.planningMsgId).toBeNull()
  })

  test('handles multiple rapid APPEND_TEXT calls correctly', () => {
    const msg = makeMessage('assistant', '')
    let state = { ...empty, messages: [msg] }
    state = chatReducer(state, { type: 'APPEND_TEXT', messageId: msg.id, text: 'Hello' })
    state = chatReducer(state, { type: 'APPEND_TEXT', messageId: msg.id, text: ' ' })
    state = chatReducer(state, { type: 'APPEND_TEXT', messageId: msg.id, text: 'World' })
    expect(state.messages[0].text).toBe('Hello World')
  })
})

describe('makeMessage', () => {
  test('generates unique IDs', () => {
    const a = makeMessage('user', 'a')
    const b = makeMessage('user', 'b')
    expect(a.id).not.toBe(b.id)
  })

  test('sets role and text', () => {
    const msg = makeMessage('assistant', 'hello', 'plan')
    expect(msg.role).toBe('assistant')
    expect(msg.text).toBe('hello')
    expect(msg.type).toBe('plan')
  })

  test('merges extra fields', () => {
    const msg = makeMessage('assistant', 'err', 'error', { retryFn: () => {} })
    expect(msg.type).toBe('error')
    expect(msg.retryFn).toBeDefined()
  })
})
