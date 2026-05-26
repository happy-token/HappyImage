import { Hono } from 'hono'
import { existsSync, mkdirSync } from 'fs'
import { spawn } from 'child_process'
import { join, resolve } from 'path'
import { readSettings, resolveConfigRoot } from '@happytokenai/happyimage-core'

const sessionRoute = new Hono()

const platformUrls: Record<string, string> = {
  wechat: 'https://mp.weixin.qq.com/',
  weibo: 'https://weibo.com/',
  x: 'https://x.com/',
  xiaohongshu: 'https://creator.xiaohongshu.com/',
}

const chromeEnvKeys: Record<string, string> = {
  wechat: 'WECHAT_BROWSER_CHROME_PATH',
  weibo: 'WEIBO_BROWSER_CHROME_PATH',
  x: 'X_BROWSER_CHROME_PATH',
  xiaohongshu: 'XHS_BROWSER_CHROME_PATH',
}

const profileEnvKeys: Record<string, string> = {
  wechat: 'WECHAT_BROWSER_PROFILE_DIR',
  weibo: 'WEIBO_BROWSER_PROFILE_DIR',
  x: 'X_BROWSER_PROFILE_DIR',
  xiaohongshu: 'XHS_BROWSER_PROFILE_DIR',
}

function expandHome(value: string) {
  return value.replace(/^~(?=\/|$)/, process.env.HOME || '')
}

function defaultChromePath(settings: Record<string, string>, platform: string) {
  const configured = settings[chromeEnvKeys[platform]]
  if (configured) return expandHome(configured)
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return existsSync(mac) ? mac : 'google-chrome'
}

function defaultProfileDir(settings: Record<string, string>, platform: string, accountAlias?: string) {
  const specific = settings[profileEnvKeys[platform]]
  const shared = settings.BAOYU_CHROME_PROFILE_DIR
  const base = resolve(expandHome(specific || shared || join(resolveConfigRoot(), 'chrome-profile')))
  if (platform === 'wechat' && accountAlias && accountAlias !== 'default') {
    return resolve(base, `wechat-${accountAlias}`)
  }
  return base
}

sessionRoute.post('/open', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const platform = String(body.platform || '')
  const accountAlias = body.accountAlias ? String(body.accountAlias).replace(/[^a-zA-Z0-9_-]/g, '') : ''
  const url = platformUrls[platform]
  if (!url) return c.json({ error: 'Unsupported platform' }, 400)

  const settings = readSettings()
  const profileDir = defaultProfileDir(settings, platform, accountAlias)
  const chromePath = defaultChromePath(settings, platform)
  mkdirSync(profileDir, { recursive: true })

  const proc = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    url,
  ], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...settings },
  })
  proc.unref()

  return c.json({
    success: true,
    platform,
    accountAlias: accountAlias || null,
    url,
    profileDir,
    pid: proc.pid,
  })
})

export default sessionRoute
