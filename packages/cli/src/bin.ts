#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, resolve, dirname, basename } from 'path'
import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'
import { readSettings, PROJECT_ROOT } from '@happyimage/core'

// Resolve @happyimage/web root directory
const webUiEntryFile = fileURLToPath(import.meta.resolve('@happyimage/web'))
const webUiRoot = resolve(dirname(webUiEntryFile), '..')

function usage() {
  console.log(`HappyImage CLI

Usage:
  happyimage web [--port 3100] [--open]
  happyimage desktop [--port 3100]
  happyimage init [--force]
  happyimage config
  happyimage projects
  happyimage doctor
  happyimage build

Commands:
  web       Start the local API + production Web UI
  desktop   Start HappyImage in a desktop-style Chrome app window
  init      Check environment and generate .env template
  config    Show configuration file paths
  projects  List generated projects in the output directory
  doctor    Check Bun, Chrome, API keys, output directory, and built UI
  build     Build the Web UI assets
`)
}

function parseFlag(name: string, fallback?: string) {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1] : fallback
}

function run(cmd: string, args: string[], options: { cwd?: string; env?: Record<string, string>; inherit?: boolean } = {}) {
  return spawnSync(cmd, args, {
    cwd: options.cwd || webUiRoot,
    env: { ...process.env, ...options.env },
    stdio: options.inherit ? 'inherit' : 'pipe',
    encoding: 'utf-8',
  })
}

function launch(cmd: string, args: string[]) {
  const child = spawn(cmd, args, { cwd: webUiRoot, env: process.env, detached: true, stdio: 'ignore' })
  child.unref()
}

function commandExists(cmd: string) {
  return spawnSync('which', [cmd]).status === 0
}

function chromeCommand() {
  if (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
    return { cmd: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [] }
  }
  if (commandExists('google-chrome')) return { cmd: 'google-chrome', args: [] }
  if (commandExists('chromium')) return { cmd: 'chromium', args: [] }
  if (commandExists('chromium-browser')) return { cmd: 'chromium-browser', args: [] }
  return null
}

async function web() {
  const port = parseFlag('--port', process.env.PORT || '3100') || '3100'
  const shouldOpen = process.argv.includes('--open')
  process.env.NODE_ENV = 'production'
  process.env.PORT = port

  if (!existsSync(resolve(webUiRoot, 'dist', 'index.html'))) {
    console.log('Web UI not built. Building now...')
    const build = run('bun', ['run', 'build'], { inherit: true })
    if (build.status !== 0) process.exit(build.status || 1)
  }

  if (shouldOpen) {
    setTimeout(() => {
      const url = `http://localhost:${port}`
      if (process.platform === 'darwin') run('open', [url], { cwd: process.cwd() })
      else if (process.platform === 'win32') run('cmd', ['/c', 'start', url], { cwd: process.cwd() })
      else run('xdg-open', [url], { cwd: process.cwd() })
    }, 800)
  }

  console.log(`Starting HappyImage at http://localhost:${port}`)
  const serverModule = await import('@happyimage/web')
  Bun.serve(serverModule.default)
  await new Promise(() => undefined)
}

async function desktop() {
  const port = parseFlag('--port', process.env.PORT || '3100') || '3100'
  const chrome = chromeCommand()
  if (!chrome) {
    console.error('Chrome is required for desktop mode. Install Chrome or run: happyimage web --open')
    process.exit(1)
  }

  setTimeout(() => {
    const url = `http://localhost:${port}`
    const profileDir = resolve(webUiRoot, '.happyimage-desktop-profile')
    launch(chrome.cmd, [
      ...chrome.args,
      `--app=${url}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ])
  }, 1000)
  await web()
}

function doctor() {
  const settings = readSettings()
  const checks: Array<[string, boolean, string]> = []
  checks.push(['Bun runtime', commandExists('bun'), 'Install from https://bun.sh'])
  checks.push(['Git', commandExists('git'), 'Required for GitHub URL project context'])
  checks.push(['Chrome', Boolean(chromeCommand()), 'Required for desktop mode and WeChat/Weibo/X publishing'])
  checks.push(['Built Web UI', existsSync(resolve(webUiRoot, 'dist', 'index.html')), 'Run happyimage build'])
  checks.push(['Skills directory', existsSync(resolve(PROJECT_ROOT, 'skills')), 'Run from the baoyu-skills workspace or configure skills dir later'])
  checks.push(['ANTHROPIC key/token', Boolean(settings.ANTHROPIC_API_KEY || settings.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), 'Can also be configured in Settings UI'])
  checks.push(['Image backend key', Boolean(settings.OPENAI_API_KEY || settings.GOOGLE_API_KEY || settings.DASHSCOPE_API_KEY || settings.REPLICATE_API_TOKEN || settings.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.REPLICATE_API_TOKEN || process.env.OPENROUTER_API_KEY), 'Can also be configured in Settings UI'])

  let failed = 0
  for (const [name, ok, hint] of checks) {
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${hint}`}`)
    if (!ok) failed++
  }
  process.exitCode = failed > 0 ? 1 : 0
}

function init() {
  const force = process.argv.includes('--force')
  const home = process.env.HOME || '/tmp'

  console.log('HappyImage init — checking environment...\n')

  const checks: Array<[string, boolean]> = [
    ['Bun', commandExists('bun')],
    ['Git', commandExists('git')],
    ['Chrome', existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') || commandExists('google-chrome') || commandExists('chromium')],
  ]

  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  }

  const envPath = join(PROJECT_ROOT, '.env')
  if (existsSync(envPath) && !force) {
    console.log(`\n.env already exists at ${envPath}`)
    console.log('Use --force to overwrite')
  } else {
    const template = [
      '# HappyImage Configuration',
      '# Generated by: happyimage init',
      '',
      '# AI Model',
      'ANTHROPIC_API_KEY=',
      '# ANTHROPIC_BASE_URL=',
      'ANTHROPIC_MODEL=claude-sonnet-4-6',
      '',
      '# Image Generation Backends (at least one required)',
      'OPENAI_API_KEY=',
      '# GOOGLE_API_KEY=',
      '# DASHSCOPE_API_KEY=',
      '# OPENROUTER_API_KEY=',
      '# REPLICATE_API_TOKEN=',
      '# AZURE_OPENAI_API_KEY=',
      '# AZURE_OPENAI_ENDPOINT=',
      '',
      '# Output',
      `OUTPUT_DIR=~/output/happyimage`,
      '',
      '# Defaults',
      'DEFAULT_LANGUAGE=zh',
      'DEFAULT_ASPECT_RATIO=1:1',
      'IMAGE_BACKEND=auto',
      '',
      '# Publishing (Chrome profile for CDP)',
      '# BAOYU_CHROME_PROFILE_DIR=',
      '',
      '# Skills lookup (optional)',
      '# BAOYU_SKILLS_ROOT=',
    ].join('\n')
    writeFileSync(envPath, template, 'utf-8')
    console.log(`\n.env template written to ${envPath}`)
    console.log('Edit it with your API keys, then run: happyimage web')
  }

  const outputDir = resolve((process.env.HOME || '/tmp'), 'output', 'happyimage')
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
    console.log(`Created output directory: ${outputDir}`)
  }

  console.log('\nInit complete.')
}

function config() {
  const home = process.env.HOME || '/tmp'
  const xdgRoot = process.env.XDG_CONFIG_HOME || join(home, '.config')
  const settings = readSettings()
  const outputRoot = resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', home))

  console.log('HappyImage configuration paths:\n')
  const paths: Array<[string, string, boolean]> = [
    ['.env', join(PROJECT_ROOT, '.env'), false],
    ['User skills', join(home, '.baoyu-skills'), false],
    ['XDG config', join(xdgRoot, 'baoyu-skills'), false],
    ['Output dir', outputRoot, false],
    ['Project skills', join(PROJECT_ROOT, 'skills'), false],
  ]

  for (const [label, path, _exists] of paths) {
    const exists = existsSync(path)
    console.log(`  ${label}`)
    console.log(`    ${path}${exists ? '' : ' (not created yet)'}`)
  }

  console.log('\nTo edit settings via Web UI: happyimage web --open')
}

function projects() {
  const home = process.env.HOME || '/tmp'
  const settings = readSettings()
  const outputRoot = resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', home))

  if (!existsSync(outputRoot)) {
    console.log('No projects found. Output directory does not exist yet.')
    console.log(`Expected at: ${outputRoot}`)
    return
  }

  const found: Array<{ skillDir: string; name: string; path: string; updatedAt: Date; imageCount: number; fileCount: number }> = []

  for (const skillDir of readdirSync(outputRoot)) {
    const skillPath = join(outputRoot, skillDir)
    if (!statSync(skillPath).isDirectory() || skillDir.startsWith('.')) continue

    for (const projectDir of readdirSync(skillPath)) {
      const projectPath = join(skillPath, projectDir)
      if (!statSync(projectPath).isDirectory() || projectDir.startsWith('.')) continue

      const entries = readdirSync(projectPath)
      const files = entries.filter(n => statSync(join(projectPath, n)).isFile())
      const imageCount = files.filter(n => /\.(png|jpe?g|webp|gif)$/i.test(n)).length
      const updatedAt = new Date(Math.max(...entries.map(n => statSync(join(projectPath, n)).mtimeMs), statSync(projectPath).mtimeMs))

      found.push({ skillDir, name: projectDir, path: projectPath, updatedAt, imageCount, fileCount: files.length })
    }
  }

  found.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  if (found.length === 0) {
    console.log('No projects found in output directory.')
    console.log(`Output dir: ${outputRoot}`)
    return
  }

  console.log(`Projects (${found.length}):\n`)
  for (const p of found.slice(0, 20)) {
    const date = p.updatedAt.toISOString().slice(0, 10)
    console.log(`  [${p.skillDir}] ${p.name}`)
    console.log(`    ${date} · ${p.imageCount} images · ${p.fileCount} files`)
    console.log(`    ${p.path}\n`)
  }

  if (found.length > 20) {
    console.log(`  ... and ${found.length - 20} more`)
  }
}

const cmd = process.argv[2] || 'web'

if (cmd === 'web') await web()
else if (cmd === 'doctor') doctor()
else if (cmd === 'desktop') await desktop()
else if (cmd === 'build') {
  const result = run('bun', ['run', 'build'], { inherit: true })
  process.exit(result.status || 0)
} else if (cmd === 'init') init()
else if (cmd === 'config') config()
else if (cmd === 'projects') projects()
else {
  usage()
  process.exit(cmd === '--help' || cmd === '-h' ? 0 : 1)
}
