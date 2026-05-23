import { describe, test, expect } from 'bun:test'
import { parseSSEStream } from '../src/lib/sse'

function sseResponse(lines: string[]): Response {
  const body = lines.map(l => `data: ${l}\n`).join('')
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}

describe('parseSSEStream', () => {
  test('parses single message', async () => {
    const messages: any[] = []
    const res = sseResponse([JSON.stringify({ type: 'text', text: 'hello' })])
    await parseSSEStream(res, (msg) => messages.push(msg))
    expect(messages).toEqual([{ type: 'text', text: 'hello' }])
  })

  test('parses multiple messages', async () => {
    const messages: any[] = []
    const res = sseResponse([
      JSON.stringify({ type: 'text', text: 'first' }),
      JSON.stringify({ type: 'text', text: 'second' }),
      JSON.stringify({ type: 'done' }),
    ])
    await parseSSEStream(res, (msg) => messages.push(msg))
    expect(messages).toHaveLength(3)
    expect(messages[0].text).toBe('first')
    expect(messages[1].text).toBe('second')
    expect(messages[2].type).toBe('done')
  })

  test('skips non-data lines', async () => {
    const messages: any[] = []
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: ping\ndata: {"type":"text","text":"ok"}\n\n'))
        controller.close()
      },
    })
    const res = new Response(stream)
    await parseSSEStream(res, (msg) => messages.push(msg))
    expect(messages).toHaveLength(1)
    expect(messages[0].text).toBe('ok')
  })

  test('handles chunked delivery', async () => {
    const messages: any[] = []
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"text","text":"part'))
        await new Promise(r => setTimeout(r, 10))
        controller.enqueue(new TextEncoder().encode('ial"}\ndata: {"type":"done"}\n'))
        controller.close()
      },
    })
    const res = new Response(stream)
    await parseSSEStream(res, (msg) => messages.push(msg))
    expect(messages).toHaveLength(2)
    expect(messages[0].text).toBe('partial')
    expect(messages[1].type).toBe('done')
  })

  test('skips empty lines', async () => {
    const messages: any[] = []
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('\n\ndata: {"type":"text","text":"ok"}\n\n'))
        controller.close()
      },
    })
    const res = new Response(stream)
    await parseSSEStream(res, (msg) => messages.push(msg))
    expect(messages).toHaveLength(1)
  })

  test('handles malformed JSON gracefully', async () => {
    const messages: any[] = []
    const res = sseResponse(['not json', JSON.stringify({ type: 'text', text: 'ok' })])
    await parseSSEStream(res, (msg) => messages.push(msg))
    expect(messages).toHaveLength(1)
    expect(messages[0].text).toBe('ok')
  })

  test('throws on unreadable body', async () => {
    const res = new Response(null, { status: 204 })
    await expect(parseSSEStream(res, () => {})).rejects.toThrow('not readable')
  })

  test('stops on abort signal', async () => {
    const messages: any[] = []
    const controller = new AbortController()
    const stream = new ReadableStream({
      async start(ctr) {
        ctr.enqueue(new TextEncoder().encode('data: {"type":"text","text":"first"}\n'))
        controller.abort()
        ctr.enqueue(new TextEncoder().encode('data: {"type":"text","text":"second"}\n'))
        ctr.close()
      },
    })
    const res = new Response(stream)
    await parseSSEStream(res, (msg) => messages.push(msg), controller.signal)
    expect(messages.length).toBeLessThanOrEqual(1)
  })
})
