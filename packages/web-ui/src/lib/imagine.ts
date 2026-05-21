interface GenResponse {
  sessionId?: string
  status: string
  images?: string[]
  output?: string
  error?: string
}

export async function triggerGenerate(params: {
  skillId: string
  selections: Record<string, string>
  content: string
}): Promise<GenResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    return { status: 'error', error: err.error }
  }
  return res.json()
}

export async function pollStatus(sessionId: string): Promise<GenResponse> {
  const res = await fetch(`/api/generate/${sessionId}`)
  if (!res.ok) return { status: 'error', error: res.statusText }
  return res.json()
}
