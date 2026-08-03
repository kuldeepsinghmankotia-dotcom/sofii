import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'crypto'
import { getDb, DEFAULT_CONVERSATION_TITLE, type MessageRole, type SofiiDb } from '../services/db'
import { getGroqClient, GROQ_MODEL, SYSTEM_PROMPT } from '../services/groqClient'
import { rankMemoriesByRelevance } from '../services/memoryRanking'
import log from '../lib/logger'

const scope = log.scope('chat-ipc')
const MEMORY_RECALL_LIMIT = 5

export function registerChatIpc(): void {
  ipcMain.handle('chat:create-conversation', () => {
    return getDb().createConversation()
  })

  ipcMain.handle('chat:list-conversations', () => {
    return getDb().listConversations()
  })

  ipcMain.handle('chat:get-conversation', (_event, conversationId: string) => {
    return getDb().getConversation(conversationId)
  })

  ipcMain.handle('chat:rename-conversation', (_event, conversationId: string, title: string) => {
    getDb().renameConversation(conversationId, title)
    return { ok: true }
  })

  ipcMain.handle('chat:delete-conversation', (_event, conversationId: string) => {
    getDb().deleteConversation(conversationId)
    return { ok: true }
  })

  ipcMain.handle(
    'chat:send-message',
    (event: IpcMainInvokeEvent, conversationId: string, content: string) => {
      const db = getDb()
      const userMessage = db.insertMessage(conversationId, 'user', content)
      const streamId = randomUUID()

      // Fire-and-forget: streaming happens over a dedicated event channel,
      // the invoke() call itself only needs to hand back identifiers.
      void streamAssistantReply(event, conversationId, streamId)

      return { messageId: userMessage.id, streamId }
    }
  )
}

async function streamAssistantReply(
  event: IpcMainInvokeEvent,
  conversationId: string,
  streamId: string
): Promise<void> {
  const db = getDb()
  const channel = `chat:stream:${streamId}`
  const conversation = db.getConversation(conversationId)

  if (!conversation) {
    event.sender.send(channel, { type: 'error', error: 'Conversation not found.' })
    return
  }

  const history: { role: MessageRole; content: string }[] = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content
  }))

  const latestUserMessage = [...conversation.messages].reverse().find((m) => m.role === 'user')
  const relevantMemories = latestUserMessage
    ? rankMemoriesByRelevance(db.listMemories(), latestUserMessage.content, MEMORY_RECALL_LIMIT)
    : []

  const shouldAutoTitle =
    conversation.messages.length === 1 && conversation.title === DEFAULT_CONVERSATION_TITLE

  const systemPrompt =
    relevantMemories.length > 0
      ? `${SYSTEM_PROMPT}\n\nThings you remember about the user (only mention if relevant):\n${relevantMemories.map((m) => `- ${m.content}`).join('\n')}`
      : SYSTEM_PROMPT

  try {
    const stream = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      temperature: 0.7,
      max_tokens: 1024,
      stream: true
    })

    let fullContent = ''

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        fullContent += delta
        event.sender.send(channel, { type: 'chunk', delta })
      }
    }

    db.insertMessage(conversationId, 'assistant', fullContent || 'No response received.')

    if (shouldAutoTitle && latestUserMessage) {
      await autoTitleConversation(db, conversationId, latestUserMessage.content, fullContent)
    }

    event.sender.send(channel, { type: 'done', fullContent })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    scope.error('Groq streaming error:', message)
    event.sender.send(channel, { type: 'error', error: message })
  }
}

async function autoTitleConversation(
  db: SofiiDb,
  conversationId: string,
  userContent: string,
  assistantContent: string
): Promise<void> {
  try {
    const response = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Generate a short 3-6 word title summarizing this conversation. Reply with only the title itself, no quotes and no trailing punctuation.'
        },
        { role: 'user', content: `User: ${userContent}\nAssistant: ${assistantContent}` }
      ],
      temperature: 0.3,
      max_tokens: 20
    })

    const title = response.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '')
    if (title) db.renameConversation(conversationId, title)
  } catch (error) {
    // Non-critical: leave the default title if this fails.
    const message = error instanceof Error ? error.message : String(error)
    scope.error('Auto-title generation error:', message)
  }
}
