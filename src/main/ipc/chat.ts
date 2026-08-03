import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'crypto'
import { getDb, type MessageRole } from '../services/db'
import { getGroqClient, GROQ_MODEL, SYSTEM_PROMPT } from '../services/groqClient'
import log from '../lib/logger'

const scope = log.scope('chat-ipc')

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

  try {
    const stream = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
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
    event.sender.send(channel, { type: 'done', fullContent })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    scope.error('Groq streaming error:', message)
    event.sender.send(channel, { type: 'error', error: message })
  }
}
