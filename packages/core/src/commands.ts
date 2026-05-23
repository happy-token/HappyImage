export type CoreCommandCategory = 'content' | 'backend' | 'publish'
export type CommandSourceType = 'text' | 'file' | 'project'
export type CommandOutputType = 'images' | 'copy' | 'prompts' | 'package' | 'publish-result'

export interface CoreCommand {
  id: string
  slash: string
  displayName: string
  category: CoreCommandCategory
  description: string
  requiredSkill: string
  inputTypes: CommandSourceType[]
  outputTypes: CommandOutputType[]
  supportsFileInput: boolean
  supportsNaturalLanguage: boolean
  supportsRevision: boolean
  supportsPublishing: boolean
  skillId?: string
  publishPlatform?: 'wechat' | 'weibo' | 'x'
}

export interface CommandRequest {
  commandId: string
  source: {
    type: CommandSourceType
    value: string
  }
  options: Record<string, unknown>
  context?: {
    sessionId?: string
    projectPath?: string
    artifactIds?: string[]
  }
}

export interface CommandValidationResult {
  ok: boolean
  command?: CoreCommand
  error?: string
}

export interface ParsedSlashCommand {
  raw: string
  commandId: string
  args: string[]
  rest: string
  command?: CoreCommand
}

const COMMAND_ALIASES: Record<string, string> = {
  'baoyu-xhs-images': 'baoyu-image-cards',
}

export function normalizeCommandId(commandId: string) {
  return COMMAND_ALIASES[commandId] || commandId
}

export const CORE_COMMANDS: CoreCommand[] = [
  { id: 'baoyu-image-cards', slash: '/baoyu-image-cards', displayName: 'Image Cards', category: 'content', description: 'Generate social image cards from text or markdown.', requiredSkill: 'baoyu-image-cards', inputTypes: ['text', 'file'], outputTypes: ['images', 'copy', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'image-cards' },
  { id: 'baoyu-cover-image', slash: '/baoyu-cover-image', displayName: 'Cover Image', category: 'content', description: 'Generate a cover image or social banner.', requiredSkill: 'baoyu-cover-image', inputTypes: ['text', 'file'], outputTypes: ['images', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'cover-image' },
  { id: 'baoyu-infographic', slash: '/baoyu-infographic', displayName: 'Infographic', category: 'content', description: 'Generate structured infographics.', requiredSkill: 'baoyu-infographic', inputTypes: ['text', 'file'], outputTypes: ['images', 'copy', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'infographic' },
  { id: 'baoyu-article-illustrator', slash: '/baoyu-article-illustrator', displayName: 'Article Illustrator', category: 'content', description: 'Generate article illustrations from source content.', requiredSkill: 'baoyu-article-illustrator', inputTypes: ['text', 'file'], outputTypes: ['images', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'article-illustrator' },
  { id: 'baoyu-comic', slash: '/baoyu-comic', displayName: 'Comic', category: 'content', description: 'Generate knowledge comic panels.', requiredSkill: 'baoyu-comic', inputTypes: ['text', 'file'], outputTypes: ['images', 'copy', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'comic' },
  { id: 'baoyu-slide-deck', slash: '/baoyu-slide-deck', displayName: 'Slide Deck', category: 'content', description: 'Generate slide-style visual pages.', requiredSkill: 'baoyu-slide-deck', inputTypes: ['text', 'file'], outputTypes: ['images', 'copy', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'slide-deck' },
  { id: 'baoyu-diagram', slash: '/baoyu-diagram', displayName: 'Diagram', category: 'content', description: 'Generate architecture, flow, sequence, and concept diagrams.', requiredSkill: 'baoyu-diagram', inputTypes: ['text', 'file'], outputTypes: ['images', 'prompts'], supportsFileInput: true, supportsNaturalLanguage: true, supportsRevision: true, supportsPublishing: false, skillId: 'diagram' },
  { id: 'baoyu-imagine', slash: '/baoyu-imagine', displayName: 'Imagine', category: 'backend', description: 'Render images through the configured image generation backend.', requiredSkill: 'baoyu-imagine', inputTypes: ['text', 'file'], outputTypes: ['images'], supportsFileInput: false, supportsNaturalLanguage: false, supportsRevision: false, supportsPublishing: false },
  { id: 'baoyu-post-to-wechat', slash: '/baoyu-post-to-wechat', displayName: 'Post to WeChat', category: 'publish', description: 'Publish a prepared package to WeChat.', requiredSkill: 'baoyu-post-to-wechat', inputTypes: ['project'], outputTypes: ['publish-result'], supportsFileInput: false, supportsNaturalLanguage: false, supportsRevision: false, supportsPublishing: true, publishPlatform: 'wechat' },
  { id: 'baoyu-post-to-weibo', slash: '/baoyu-post-to-weibo', displayName: 'Post to Weibo', category: 'publish', description: 'Publish a prepared package to Weibo.', requiredSkill: 'baoyu-post-to-weibo', inputTypes: ['project'], outputTypes: ['publish-result'], supportsFileInput: false, supportsNaturalLanguage: false, supportsRevision: false, supportsPublishing: true, publishPlatform: 'weibo' },
  { id: 'baoyu-post-to-x', slash: '/baoyu-post-to-x', displayName: 'Post to X', category: 'publish', description: 'Publish a prepared package to X.', requiredSkill: 'baoyu-post-to-x', inputTypes: ['project'], outputTypes: ['publish-result'], supportsFileInput: false, supportsNaturalLanguage: false, supportsRevision: false, supportsPublishing: true, publishPlatform: 'x' },
]

export function getCoreCommand(commandId: string) {
  const normalized = normalizeCommandId(commandId)
  return CORE_COMMANDS.find(command => command.id === normalized)
}

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const [head = '', ...args] = trimmed.slice(1).split(/\s+/).filter(Boolean)
  if (!head) return null
  const commandId = normalizeCommandId(head.startsWith('baoyu-') ? head : `baoyu-${head}`)
  return {
    raw: trimmed,
    commandId,
    args,
    rest: args.join(' '),
    command: getCoreCommand(commandId),
  }
}

export function commandIdForSkillId(skillId: string) {
  if (skillId === 'xhs-images') return 'baoyu-image-cards'
  return CORE_COMMANDS.find(command => command.skillId === skillId)?.id || `baoyu-${skillId}`
}

export function commandRequestFromSlash(input: string): CommandRequest | null {
  const parsed = parseSlashCommand(input)
  if (!parsed?.command) return null
  const command = parsed.command
  const firstArg = parsed.args[0] || ''
  if (command.category === 'publish') {
    return {
      commandId: command.id,
      source: { type: 'project', value: parsed.rest },
      options: {},
    }
  }
  if (firstArg && /\.(md|markdown|txt)$/i.test(firstArg)) {
    return {
      commandId: command.id,
      source: { type: 'file', value: firstArg },
      options: { prompt: parsed.args.slice(1).join(' ') },
    }
  }
  return {
    commandId: command.id,
    source: { type: 'text', value: parsed.rest },
    options: {},
  }
}

export function commandRequestFromSkill(skillId: string, content: string, options: Record<string, unknown> = {}): CommandRequest {
  return {
    commandId: commandIdForSkillId(skillId),
    source: { type: 'text', value: content },
    options,
  }
}

export function validateCommandRequest(request: CommandRequest, skillExists?: (skillName: string) => boolean): CommandValidationResult {
  const command = getCoreCommand(request.commandId)
  if (!command) return { ok: false, error: `Unknown command: ${request.commandId}` }
  if (!command.inputTypes.includes(request.source.type)) {
    return { ok: false, command, error: `${command.id} does not support ${request.source.type} input` }
  }
  if (skillExists && !skillExists(command.requiredSkill)) {
    return { ok: false, command, error: `Required skill not found: ${command.requiredSkill}` }
  }
  if (command.category === 'publish' && !request.source.value.trim()) {
    return { ok: false, command, error: `${command.id} requires a project or package path` }
  }
  return { ok: true, command }
}
