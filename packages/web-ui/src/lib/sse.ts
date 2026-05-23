export async function parseSSEStream<T>(
  response: Response,
  onMessage: (msg: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const msg: T = JSON.parse(trimmed.slice(6))
          onMessage(msg)
        } catch (e) {
          console.warn('SSE parse error:', trimmed.slice(0, 80), e)
        }
      }
    }
  } finally {
    reader.cancel()
  }
}
