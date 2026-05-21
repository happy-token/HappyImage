export interface PlatformRule {
  platform: string
  name: string
  nameZh: string
  maxImages: number
  maxTitleLength: number
  maxBodyLength: number
  maxHashtags: number
  supportedAspectRatios: string[]
  maxImageSizeMB: number
  notes: string[]
}

export interface PlatformCheckResult {
  platform: string
  imageCount: number
  images: string[]
  title: string
  body: string
  hashtags: string[]
  violations: PlatformViolation[]
}

export interface PlatformViolation {
  field: string
  message: string
  current: string | number
  limit: string | number
  severity: 'error' | 'warning'
}

export const platformRules: Record<string, PlatformRule> = {
  xiaohongshu: {
    platform: 'xiaohongshu',
    name: 'Xiaohongshu',
    nameZh: '小红书',
    maxImages: 18,
    maxTitleLength: 20,
    maxBodyLength: 1000,
    maxHashtags: 10,
    supportedAspectRatios: ['1:1', '3:4', '4:3'],
    maxImageSizeMB: 20,
    notes: ['支持图文混排', '首图建议 3:4 竖版', '标签用 # 开头'],
  },
  wechat: {
    platform: 'wechat',
    name: 'WeChat Official Account',
    nameZh: '微信公众号',
    maxImages: 0,
    maxTitleLength: 64,
    maxBodyLength: 20000,
    maxHashtags: 0,
    supportedAspectRatios: ['1:1', '16:9'],
    maxImageSizeMB: 10,
    notes: ['封面图建议 900x500 (16:9 裁剪)', '正文图片建议宽度 900px', '作者名 4-8 字为宜'],
  },
  weibo: {
    platform: 'weibo',
    name: 'Weibo',
    nameZh: '微博',
    maxImages: 18,
    maxTitleLength: 0,
    maxBodyLength: 2000,
    maxHashtags: 0,
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    maxImageSizeMB: 20,
    notes: ['140 字以内显示全文', '超 140 字自动折叠', '支持长文模式（头条文章）'],
  },
  x: {
    platform: 'x',
    name: 'X (Twitter)',
    nameZh: 'X',
    maxImages: 4,
    maxTitleLength: 0,
    maxBodyLength: 280,
    maxHashtags: 0,
    supportedAspectRatios: ['1:1', '16:9', '3:4'],
    maxImageSizeMB: 5,
    notes: ['280 字符限制', '图片最多 4 张', '支持长文（X Premium）'],
  },
}

export function checkPlatform(platform: string, data: {
  images: string[]
  title?: string
  body?: string
  hashtags?: string[]
}): PlatformCheckResult {
  const rule = platformRules[platform]
  if (!rule) {
    return {
      platform,
      imageCount: data.images.length,
      images: data.images,
      title: data.title || '',
      body: data.body || '',
      hashtags: data.hashtags || [],
      violations: [{ field: 'platform', message: `Unknown platform: ${platform}`, current: platform, limit: 'supported platforms', severity: 'error' }],
    }
  }

  const violations: PlatformViolation[] = []

  if (rule.maxImages > 0 && data.images.length > rule.maxImages) {
    violations.push({
      field: 'images',
      message: `${rule.nameZh} 最多 ${rule.maxImages} 张图片，当前 ${data.images.length} 张`,
      current: data.images.length,
      limit: rule.maxImages,
      severity: 'error',
    })
  }

  if (rule.maxTitleLength > 0 && data.title && data.title.length > rule.maxTitleLength) {
    violations.push({
      field: 'title',
      message: `${rule.nameZh} 标题最多 ${rule.maxTitleLength} 字，当前 ${data.title.length} 字`,
      current: data.title.length,
      limit: rule.maxTitleLength,
      severity: 'warning',
    })
  }

  if (rule.maxBodyLength > 0 && data.body && data.body.length > rule.maxBodyLength) {
    violations.push({
      field: 'body',
      message: `${rule.nameZh} 正文最多 ${rule.maxBodyLength} 字，当前 ${data.body.length} 字`,
      current: data.body.length,
      limit: rule.maxBodyLength,
      severity: 'warning',
    })
  }

  if (data.body && platform === 'weibo' && data.body.length <= 140) {
    violations.push({
      field: 'body',
      message: '字数 ≤ 140 字，将以短文模式发布，不会被折叠',
      current: data.body.length,
      limit: 140,
      severity: 'warning',
    })
  }

  if (data.body && platform === 'x' && data.body.length <= 280) {
    violations.push({
      field: 'body',
      message: `当前 ${data.body.length} 字符，在 280 字符限制内`,
      current: data.body.length,
      limit: 280,
      severity: 'warning',
    })
  }

  return {
    platform,
    imageCount: data.images.length,
    images: data.images,
    title: data.title || '',
    body: data.body || '',
    hashtags: data.hashtags || [],
    violations,
  }
}
