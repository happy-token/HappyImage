import { Hono } from 'hono'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const upload = new Hono()
const uploadRoot = join(tmpdir(), 'happyimage-uploads')

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+/, '') || 'source.md'
}

upload.post('/source', async (c) => {
  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return c.json({ error: 'file required' }, 400)
  if (!/\.(md|markdown|txt)$/i.test(file.name)) return c.json({ error: 'Only .md, .markdown, and .txt files are supported' }, 400)
  if (file.size > 2 * 1024 * 1024) return c.json({ error: 'File must be smaller than 2MB' }, 400)

  if (!existsSync(uploadRoot)) mkdirSync(uploadRoot, { recursive: true })
  const name = `${Date.now()}-${safeName(file.name)}`
  const path = join(uploadRoot, name)
  const text = await file.text()
  writeFileSync(path, text, 'utf-8')

  return c.json({ path, name: file.name, size: file.size })
})

export default upload
