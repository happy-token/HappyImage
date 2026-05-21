export type CoreCommandCategory = 'content' | 'backend' | 'publish'

export interface CoreCommand {
  id: string
  displayName: string
  category: CoreCommandCategory
  requiredSkill: string
  supportsFileInput: boolean
  supportsPublishing: boolean
  skillId?: string
  publishPlatform?: 'wechat' | 'weibo' | 'x'
}

export interface ParsedSlashCommand {
  raw: string
  commandId: string
  args: string[]
  rest: string
  command?: CoreCommand
}

export const CORE_COMMANDS: CoreCommand[] = [
  { id: 'baoyu-image-cards', displayName: 'Image Cards', category: 'content', requiredSkill: 'baoyu-image-cards', supportsFileInput: true, supportsPublishing: false, skillId: 'image-cards' },
  { id: 'baoyu-cover-image', displayName: 'Cover Image', category: 'content', requiredSkill: 'baoyu-cover-image', supportsFileInput: true, supportsPublishing: false, skillId: 'cover-image' },
  { id: 'baoyu-infographic', displayName: 'Infographic', category: 'content', requiredSkill: 'baoyu-infographic', supportsFileInput: true, supportsPublishing: false, skillId: 'infographic' },
  { id: 'baoyu-article-illustrator', displayName: 'Article Illustrator', category: 'content', requiredSkill: 'baoyu-article-illustrator', supportsFileInput: true, supportsPublishing: false, skillId: 'article-illustrator' },
  { id: 'baoyu-comic', displayName: 'Comic', category: 'content', requiredSkill: 'baoyu-comic', supportsFileInput: true, supportsPublishing: false, skillId: 'comic' },
  { id: 'baoyu-slide-deck', displayName: 'Slide Deck', category: 'content', requiredSkill: 'baoyu-slide-deck', supportsFileInput: true, supportsPublishing: false, skillId: 'slide-deck' },
  { id: 'baoyu-diagram', displayName: 'Diagram', category: 'content', requiredSkill: 'baoyu-diagram', supportsFileInput: true, supportsPublishing: false, skillId: 'diagram' },
  { id: 'baoyu-imagine', displayName: 'Imagine', category: 'backend', requiredSkill: 'baoyu-imagine', supportsFileInput: false, supportsPublishing: false },
  { id: 'baoyu-post-to-wechat', displayName: 'Post to WeChat', category: 'publish', requiredSkill: 'baoyu-post-to-wechat', supportsFileInput: false, supportsPublishing: true, publishPlatform: 'wechat' },
  { id: 'baoyu-post-to-weibo', displayName: 'Post to Weibo', category: 'publish', requiredSkill: 'baoyu-post-to-weibo', supportsFileInput: false, supportsPublishing: true, publishPlatform: 'weibo' },
  { id: 'baoyu-post-to-x', displayName: 'Post to X', category: 'publish', requiredSkill: 'baoyu-post-to-x', supportsFileInput: false, supportsPublishing: true, publishPlatform: 'x' },
]

export function getCoreCommand(commandId: string) {
  return CORE_COMMANDS.find(command => command.id === commandId)
}

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const [head = '', ...args] = trimmed.slice(1).split(/\s+/).filter(Boolean)
  if (!head) return null
  const commandId = head.startsWith('baoyu-') ? head : `baoyu-${head}`
  return {
    raw: trimmed,
    commandId,
    args,
    rest: args.join(' '),
    command: getCoreCommand(commandId),
  }
}
