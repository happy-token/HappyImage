import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'fs'
import fs from 'node:fs'
import { tmpdir } from 'os'
import { basename, isAbsolute, join, relative, resolve } from 'path'
import { spawnSync } from 'child_process'
import { PROJECT_ROOT } from './settings.js'

const WORKSPACE_ROOT = resolve(PROJECT_ROOT, '..')
const CACHE_ROOT = join(tmpdir(), 'happyimage-github-cache')
const UPLOAD_ROOT = join(tmpdir(), 'happyimage-uploads')
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage', 'target', '.venv', 'venv'])
const IMPORTANT_NAMES = new Set([
  'README.md',
  'README.zh.md',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'AGENTS.md',
  'CLAUDE.md',
])

export interface SourceInput {
  mode?: string
  ref?: string
}

function isInside(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

function walk(dir: string, root: string, acc: string[] = []) {
  if (acc.length >= 240) return acc
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name) || name.startsWith('.DS_Store')) continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      acc.push(`${relative(root, path)}/`)
      walk(path, root, acc)
    } else {
      acc.push(relative(root, path))
    }
    if (acc.length >= 240) break
  }
  return acc
}

function readImportantFiles(root: string) {
  const files: string[] = []
  const visit = (dir: string, depth: number) => {
    if (depth > 3 || files.length >= 16) return
    for (const name of readdirSync(dir).sort()) {
      if (SKIP_DIRS.has(name)) continue
      const path = join(dir, name)
      const st = statSync(path)
      if (st.isDirectory()) visit(path, depth + 1)
      else if (IMPORTANT_NAMES.has(name) || (name.endsWith('.md') && relative(root, path).split('/').length <= 2)) {
        files.push(path)
      }
      if (files.length >= 16) break
    }
  }
  visit(root, 0)

  return files.map(path => {
    const text = readFileSync(path, 'utf-8').slice(0, 6000)
    return `## ${relative(root, path)}\n\n${text}`
  }).join('\n\n')
}

function summarizeProject(root: string, label: string) {
  const tree = walk(root, root).slice(0, 240).join('\n')
  const important = readImportantFiles(root)
  return [
    `# Project Context: ${label}`,
    '',
    `Path: ${root}`,
    '',
    '## File Tree',
    '```',
    tree,
    '```',
    '',
    '## Important Files',
    important || '(No important files found.)',
  ].join('\n')
}

function cloneGithub(url: string) {
  mkdirSync(CACHE_ROOT, { recursive: true })
  const match = url.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i)
  if (!match) throw new Error('GitHub URL must look like https://github.com/owner/repo')
  const owner = match[1]!
  const repo = match[2]!
  const target = join(CACHE_ROOT, `${owner}-${repo}`)
  if (existsSync(target)) fs.rmSync(target, { recursive: true, force: true })

  const result = spawnSync('git', ['clone', '--depth', '1', `https://github.com/${owner}/${repo}.git`, target], {
    encoding: 'utf-8',
    timeout: 60_000,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git clone failed for ${url}`)
  }
  return target
}

export function resolveSourceContext(input: SourceInput): string {
  const mode = input.mode || 'text'
  const ref = (input.ref || '').trim()
  if (!ref || mode === 'text') return ''

  if (mode === 'local') {
    const expanded = ref.replace('~', process.env.HOME || '')
    const path = isAbsolute(expanded) ? resolve(expanded) : resolve(PROJECT_ROOT, expanded)
    if (!isInside(WORKSPACE_ROOT, path)) throw new Error(`Project path must be inside ${WORKSPACE_ROOT}`)
    if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`Project path not found: ${path}`)
    return summarizeProject(path, basename(path))
  }

  if (mode === 'file') {
    const expanded = ref.replace('~', process.env.HOME || '')
    const path = isAbsolute(expanded) ? resolve(expanded) : resolve(PROJECT_ROOT, expanded)
    const allowed = isInside(WORKSPACE_ROOT, path) || isInside(UPLOAD_ROOT, path)
    if (!allowed) throw new Error(`Source file must be inside ${WORKSPACE_ROOT} or ${UPLOAD_ROOT}`)
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`Source file not found: ${path}`)
    if (!/\.(md|markdown|txt)$/i.test(path)) throw new Error('Source file must be .md, .markdown, or .txt')
    const text = readFileSync(path, 'utf-8').slice(0, 40000)
    return [
      `# Uploaded Source: ${basename(path)}`,
      '',
      `Path: ${path}`,
      '',
      text,
    ].join('\n')
  }

  if (mode === 'github') {
    const path = cloneGithub(ref)
    return summarizeProject(path, ref)
  }

  return ''
}
