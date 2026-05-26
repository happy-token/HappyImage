import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

let _db: Database | null = null

export function getSettingsDb(configRoot: string, projectRoot?: string): Database {
  if (_db) return _db
  mkdirSync(configRoot, { recursive: true })
  const dbPath = join(configRoot, 'settings.db')
  _db = new Database(dbPath)
  _db.run('PRAGMA journal_mode=WAL')
  _db.run('PRAGMA busy_timeout=5000')
  _db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  migrateFromEnv(_db, configRoot, projectRoot)
  return _db
}

function migrateFromEnv(db: Database, configRoot: string, projectRoot?: string): void {
  const existing = db.query('SELECT count(*) as c FROM settings').get() as { c: number }
  if (existing.c > 0) return

  const candidates = [join(configRoot, '.env')]
  if (projectRoot) candidates.push(join(projectRoot, '.env'))

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue
    const content = readFileSync(envPath, 'utf-8')
    const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    let count = 0
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key && value) { insert.run(key, value); count++ }
    }
    if (count > 0) return
  }
}

export function readAllSettings(db: Database): Record<string, string> {
  const rows = db.query('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

export function writeSettingToDb(db: Database, key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

export function closeSettingsDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
