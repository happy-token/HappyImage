import { Hono } from 'hono'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { basename, join, relative, resolve } from 'path'
import { readSettings, checkPlatform, platformRules, type PlatformRule } from '@happytokenai/happyimage-core'

const packageRoute = new Hono()

packageRoute.get('/rules', (c) => {
  return c.json(Object.values(platformRules).map(r => ({
    platform: r.platform,
    name: r.name,
    nameZh: r.nameZh,
    maxImages: r.maxImages,
    maxTitleLength: r.maxTitleLength,
    maxBodyLength: r.maxBodyLength,
    maxHashtags: r.maxHashtags,
    supportedAspectRatios: r.supportedAspectRatios,
    notes: r.notes,
  })))
})

packageRoute.post('/check', async (c) => {
  let body: { platform?: string; images?: string[]; title?: string; body?: string; hashtags?: string[] }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const platform = body.platform || 'xiaohongshu'
  const result = checkPlatform(platform, {
    images: body.images || [],
    title: body.title,
    body: body.body,
    hashtags: body.hashtags,
  })
  return c.json(result)
})

const packageDirs: Record<string, string> = {
  xiaohongshu: 'social-package',
  weibo: 'social-package',
  x: 'x-package',
  wechat: 'wechat-package',
}

const postFiles: Record<string, string> = {
  xiaohongshu: 'xhs-post.md',
  weibo: 'weibo-post.md',
  x: 'x-post.md',
  wechat: 'wechat-article.md',
}

function outputRoot() {
  const settings = readSettings()
  return resolve((settings.OUTPUT_DIR || '~/output/happyimage').replace('~', process.env.HOME || '/Users/forever'))
}

function isInside(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
}

packageRoute.post('/', async (c) => {
  let body: { projectPath?: string; platform?: string; caption?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const root = outputRoot()
  const projectPath = body.projectPath ? resolve(body.projectPath) : ''
  if (!projectPath || !isInside(root, projectPath) || !existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
    return c.json({ error: 'Valid projectPath required' }, 400)
  }

  const platform = body.platform || 'xiaohongshu'
  const packageDirName = packageDirs[platform] || 'social-package'
  const slug = basename(projectPath)
  const pkgPath = join(root, packageDirName, slug)
  const imageDir = join(pkgPath, platform === 'wechat' ? 'imgs' : 'images')
  mkdirSync(imageDir, { recursive: true })

  const imageNames = readdirSync(projectPath)
    .filter(name => /\.(png|jpe?g|webp|gif)$/i.test(name))
    .sort()

  const copiedImages = imageNames.map(name => {
    const source = join(projectPath, name)
    const target = join(imageDir, name)
    copyFileSync(source, target)
    return target
  })

  const files: string[] = []
  const manifestPath = join(pkgPath, 'image-manifest.md')
  writeFileSync(
    manifestPath,
    [
      `# ${slug} Image Manifest`,
      '',
      `Source project: ${projectPath}`,
      `Platform: ${platform}`,
      '',
      ...copiedImages.map((path, index) => `${index + 1}. ${path}`),
      '',
    ].join('\n'),
    'utf-8',
  )
  files.push(manifestPath)

  const postPath = join(pkgPath, postFiles[platform] || 'post.md')
  writeFileSync(postPath, body.caption || '', 'utf-8')
  files.push(postPath)

  return c.json({
    packagePath: pkgPath,
    imageDir,
    images: copiedImages,
    files,
  })
})

export default packageRoute
