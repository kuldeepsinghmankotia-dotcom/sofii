import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export type MessageRole = 'user' | 'assistant' | 'system'

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

export interface ChatMessage {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  created_at: number
}

export interface ConversationWithMessages {
  id: string
  title: string
  messages: Omit<ChatMessage, 'conversation_id'>[]
}

export interface Memory {
  id: string
  content: string
  created_at: number
  updated_at: number
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL DEFAULT 'New conversation',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content         TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS memories (
    id         TEXT PRIMARY KEY,
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`

export class SofiiDb {
  private db: Database.Database

  constructor(filePath: string) {
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA)
  }

  createConversation(title = 'New conversation'): Conversation {
    const now = Date.now()
    const conversation: Conversation = {
      id: randomUUID(),
      title,
      created_at: now,
      updated_at: now
    }

    this.db
      .prepare(
        `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (@id, @title, @created_at, @updated_at)`
      )
      .run(conversation)

    return conversation
  }

  listConversations(): ConversationSummary[] {
    return this.db
      .prepare(`SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC`)
      .all() as ConversationSummary[]
  }

  getConversation(conversationId: string): ConversationWithMessages | undefined {
    const conversation = this.db
      .prepare(`SELECT id, title FROM conversations WHERE id = ?`)
      .get(conversationId) as Pick<Conversation, 'id' | 'title'> | undefined

    if (!conversation) return undefined

    const messages = this.db
      .prepare(
        `SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`
      )
      .all(conversationId) as Omit<ChatMessage, 'conversation_id'>[]

    return { id: conversation.id, title: conversation.title, messages }
  }

  renameConversation(conversationId: string, title: string): void {
    this.db
      .prepare(`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`)
      .run(title, Date.now(), conversationId)
  }

  deleteConversation(conversationId: string): void {
    this.db.prepare(`DELETE FROM conversations WHERE id = ?`).run(conversationId)
  }

  insertMessage(conversationId: string, role: MessageRole, content: string): ChatMessage {
    const message: ChatMessage = {
      id: randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      created_at: Date.now()
    }

    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (@id, @conversation_id, @role, @content, @created_at)`
      )
      .run(message)

    this.db
      .prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`)
      .run(message.created_at, conversationId)

    return message
  }

  createMemory(content: string): Memory {
    const now = Date.now()
    const memory: Memory = { id: randomUUID(), content, created_at: now, updated_at: now }

    this.db
      .prepare(
        `INSERT INTO memories (id, content, created_at, updated_at) VALUES (@id, @content, @created_at, @updated_at)`
      )
      .run(memory)

    return memory
  }

  listMemories(): Memory[] {
    return this.db
      .prepare(`SELECT id, content, created_at, updated_at FROM memories ORDER BY updated_at DESC`)
      .all() as Memory[]
  }

  updateMemory(memoryId: string, content: string): void {
    this.db
      .prepare(`UPDATE memories SET content = ?, updated_at = ? WHERE id = ?`)
      .run(content, Date.now(), memoryId)
  }

  deleteMemory(memoryId: string): void {
    this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(memoryId)
  }

  close(): void {
    this.db.close()
  }
}

let instance: SofiiDb | undefined

export function initDb(filePath: string): SofiiDb {
  instance = new SofiiDb(filePath)
  return instance
}

export function getDb(): SofiiDb {
  if (!instance) {
    throw new Error('Database has not been initialized. Call initDb() first.')
  }
  return instance
}
