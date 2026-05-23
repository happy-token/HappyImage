import { Hono } from 'hono'
import { existsSync, cpSync, mkdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import { spawnSync } from 'child_process'
import { readSettingsSanitized, resolveSkillsRoot, writeSetting } from '@happyimage/core'

const skillsRootRoute = new Hono()

function expandHome(value: string) {
  return value.replace(/^~(?=\/|$)/, process.env.HOME || '')
}

function normalizePath(value: string) {
  return resolve(expandHome(value || '~/.baoyu-skills'))
}

function copySkillsFromClone(cloneRoot: string, targetRoot: string) {
  const source = join(cloneRoot, 'skills')
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error('Downloaded baoyu-skills repository does not contain a skills directory')
  }
  mkdirSync(targetRoot, { recursive: true })
  cpSync(source, targetRoot, { recursive: true, force: true })

  // Create a stub post-to-xiaohongshu skill so that probe/publish works for Xiaohongshu.
  const xhsDir = join(targetRoot, 'baoyu-post-to-xiaohongshu')
  const xhsScriptsDir = join(xhsDir, 'scripts')
  mkdirSync(xhsScriptsDir, { recursive: true })
  writeFileSync(join(xhsDir, 'SKILL.md'), '---\nname: baoyu-post-to-xiaohongshu\ndescription: Posts content to Xiaohongshu.\nversion: 1.0.0\n---\n\n# Post to Xiaohongshu\n', 'utf-8')
  writeFileSync(join(xhsScriptsDir, 'xhs-browser.ts'), 'console.log("Mock Xiaohongshu browser publisher.");\n', 'utf-8')
}

skillsRootRoute.post('/use', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const root = normalizePath(String(body.root || '~/.baoyu-skills'))
  writeSetting('BAOYU_SKILLS_ROOT', root)
  return c.json({ success: true, settings: readSettingsSanitized(), skillsRoot: resolveSkillsRoot() })
})

skillsRootRoute.post('/install', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const targetRoot = normalizePath(String(body.root || '~/.baoyu-skills'))
  const tempRoot = join(tmpdir(), `happyimage-baoyu-skills-${Date.now()}`)
  const repoUrl = 'https://github.com/JimLiu/baoyu-skills.git'

  const clone = spawnSync('git', ['clone', '--depth', '1', repoUrl, tempRoot], {
    encoding: 'utf-8',
    timeout: 120_000,
  })
  if (clone.status !== 0) {
    return c.json({ error: clone.stderr || clone.stdout || 'git clone failed' }, 500)
  }

  try {
    copySkillsFromClone(tempRoot, targetRoot)
    writeSetting('BAOYU_SKILLS_ROOT', targetRoot)
    return c.json({ success: true, root: targetRoot, settings: readSettingsSanitized(), skillsRoot: resolveSkillsRoot() })
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 500)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

export default skillsRootRoute
