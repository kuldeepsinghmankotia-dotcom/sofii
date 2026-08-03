export interface Conversation {
  id: string
  title: string
  created_at: number
  updated_at: number
}

export interface ConversationSummary {
  id: string
  title: string
  updated_at: number
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  created_at: number
}

export interface ConversationWithMessages {
  id: string
  title: string
  messages: ChatMessage[]
}

export interface SendMessageResult {
  messageId: string
  streamId: string
}

export type StreamEvent =
  | { type: 'chunk'; delta: string }
  | { type: 'done'; fullContent: string }
  | { type: 'error'; error: string }

export interface SofiiElectronAPI {
  createConversation: () => Promise<Conversation>
  listConversations: () => Promise<ConversationSummary[]>
  getConversation: (conversationId: string) => Promise<ConversationWithMessages | undefined>
  renameConversation: (conversationId: string, title: string) => Promise<{ ok: true }>
  deleteConversation: (conversationId: string) => Promise<{ ok: true }>
  sendMessage: (conversationId: string, content: string) => Promise<SendMessageResult>
  onStreamChunk: (streamId: string, callback: (event: StreamEvent) => void) => () => void
}
