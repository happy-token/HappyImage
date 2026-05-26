import type { ProjectPlan } from '@happytokenai/happyimage-core'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  type?: 'text' | 'plan' | 'runner' | 'thinking' | 'error' | 'tool'
  planData?: ProjectPlan
  sourceContent?: string
  retryFn?: () => void
  targetImageIndex?: number
  targetImageName?: string
  confirmed?: boolean
  toolName?: string
  toolStatus?: 'started' | 'progress' | 'succeeded' | 'failed'
  toolInput?: Record<string, unknown>
}

export interface ChatState {
  messages: ChatMessage[]
  streamingMsgId: string | null
  planningMsgId: string | null
}

export type ChatAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'APPEND_TEXT'; messageId: string; text: string }
  | { type: 'SET_MESSAGE'; messageId: string; patch: Partial<ChatMessage> }
  | { type: 'REMOVE_MESSAGE'; messageId: string }
  | { type: 'SET_STREAMING'; messageId: string | null }
  | { type: 'SET_PLANNING'; messageId: string | null }
  | { type: 'CLEAR_PLANNING' }
  | { type: 'RESET_MESSAGES'; messages: ChatMessage[] }
  | { type: 'UPSERT_TOOL'; messageId: string; name: string; status: ChatMessage['toolStatus']; input?: Record<string, unknown> }

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }

    case 'RESET_MESSAGES':
      return { ...state, messages: action.messages, streamingMsgId: null, planningMsgId: null }

    case 'APPEND_TEXT':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.messageId ? { ...msg, text: msg.text + action.text } : msg
        ),
      }

    case 'SET_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.messageId ? { ...msg, ...action.patch } : msg
        ),
      }

    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter(msg => msg.id !== action.messageId) }

    case 'SET_STREAMING':
      return { ...state, streamingMsgId: action.messageId }

    case 'SET_PLANNING':
      return { ...state, planningMsgId: action.messageId }

    case 'CLEAR_PLANNING':
      return { ...state, planningMsgId: null }

    case 'UPSERT_TOOL': {
      const existing = state.messages.find(msg => msg.id === action.messageId)
      if (existing) {
        return {
          ...state,
          messages: state.messages.map(msg =>
            msg.id === action.messageId
              ? { ...msg, toolStatus: action.status, toolInput: action.input || msg.toolInput, text: action.status === 'succeeded' ? 'Done' : action.status === 'failed' ? 'Failed' : msg.text }
              : msg
          ),
        }
      }
      const toolMsg = makeMessage('system', action.status === 'started' ? 'Starting...' : 'Running...', 'tool', {
        id: action.messageId,
        toolName: action.name,
        toolStatus: action.status,
        toolInput: action.input,
      })
      return { ...state, messages: [...state.messages, toolMsg] }
    }

    default:
      return state
  }
}

let msgCounter = 0

export function makeMessage(role: ChatMessage['role'], text: string, type?: ChatMessage['type'], extra?: Partial<ChatMessage>): ChatMessage {
  return { id: `msg-${Date.now()}-${++msgCounter}`, role, text, type, ...extra }
}
