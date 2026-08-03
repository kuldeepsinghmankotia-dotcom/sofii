import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'crypto'
import { getDb, DEFAULT_CONVERSATION_TITLE, type MessageRole, type SofiiDb } from '../services/db'
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption
} from 'openai/resources/chat/completions'
import {
  getGroqClient,
  getGroqModel,
  SYSTEM_PROMPT,
  SUPPRESS_REASONING,
  type GroqReasoningParams
} from '../services/groqClient'
import { rankMemoriesByRelevance } from '../services/memoryRanking'
import { TOOL_DEFINITIONS, executeToolCall } from '../services/tools'
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

interface AccumulatedToolCall {
  id: string
  name: string
  argumentsJson: string
}

/**
 * Runs one streamed completion call, forwarding content deltas to the
 * renderer as they arrive and accumulating any tool_calls deltas (Groq has
 * been observed to send a tool call's full id/name/arguments in a single
 * chunk, but this accumulates defensively by index in case that changes).
 */
async function streamCompletion(
  event: IpcMainInvokeEvent,
  channel: string,
  messages: ChatCompletionMessageParam[],
  toolOptions: { tools?: ChatCompletionTool[]; tool_choice?: ChatCompletionToolChoiceOption },
  onContent: (delta: string) => void
): Promise<AccumulatedToolCall[]> {
  const stream = await getGroqClient().chat.completions.create({
    model: getGroqModel(),
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
    ...SUPPRESS_REASONING,
    ...toolOptions
  } as ChatCompletionCreateParamsStreaming & GroqReasoningParams)

  const toolCallsByIndex = new Map<number, AccumulatedToolCall>()

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta

    if (delta?.content) {
      onContent(delta.content)
      event.sender.send(channel, { type: 'chunk', delta: delta.content })
    }

    if (delta?.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const existing = toolCallsByIndex.get(toolCallDelta.index) ?? {
          id: '',
          name: '',
          argumentsJson: ''
        }
        if (toolCallDelta.id) existing.id = toolCallDelta.id
        if (toolCallDelta.function?.name) existing.name = toolCallDelta.function.name
        if (toolCallDelta.function?.arguments)
          existing.argumentsJson += toolCallDelta.function.arguments
        toolCallsByIndex.set(toolCallDelta.index, existing)
      }
    }
  }

  return Array.from(toolCallsByIndex.values())
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

  // The model needs "now" to resolve relative times ("in 10 minutes",
  // "tomorrow at 5pm") into the absolute ISO timestamp create_reminder needs.
  const systemPromptWithTime = `${SYSTEM_PROMPT}\n\nThe current date and time is ${new Date().toString()}.`
  const systemPrompt =
    relevantMemories.length > 0
      ? `${systemPromptWithTime}\n\nThings you remember about the user (only mention if relevant):\n${relevantMemories.map((m) => `- ${m.content}`).join('\n')}`
      : systemPromptWithTime

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history
  ]

  try {
    let fullContent = ''

    const toolCalls = await streamCompletion(
      event,
      channel,
      baseMessages,
      { tools: TOOL_DEFINITIONS, tool_choice: 'auto' },
      (delta) => {
        fullContent += delta
      }
    )

    if (toolCalls.length > 0) {
      // Independent tool calls run concurrently rather than one at a time.
      const toolResultMessages: ChatCompletionMessageParam[] = await Promise.all(
        toolCalls.map(async (toolCall) => ({
          role: 'tool' as const,
          tool_call_id: toolCall.id,
          content: await executeToolCall(
            { name: toolCall.name, argumentsJson: toolCall.argumentsJson },
            db
          )
        }))
      )

      const followUpMessages: ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'assistant',
          content: fullContent || null,
          tool_calls: toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: 'function',
            function: { name: toolCall.name, arguments: toolCall.argumentsJson }
          }))
        },
        ...toolResultMessages
      ]

      // Bounded to exactly one tool round: no `tools` option here, so the
      // model has nothing left to call and must produce a final reply.
      await streamCompletion(event, channel, followUpMessages, {}, (delta) => {
        fullContent += delta
      })
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
      model: getGroqModel(),
      messages: [
        {
          role: 'system',
          content:
            'Generate a short 3-6 word title summarizing this conversation. Reply with only the title itself, no quotes and no trailing punctuation.'
        },
        { role: 'user', content: `User: ${userContent}\nAssistant: ${assistantContent}` }
      ],
      temperature: 0.3,
      // Hidden reasoning tokens count against max_tokens even with
      // include_reasoning: false (verified against the live API — ~20-30
      // reasoning tokens for this prompt), so this needs real headroom above
      // the actual title length or the response gets truncated to empty.
      max_tokens: 150,
      ...SUPPRESS_REASONING
    } as ChatCompletionCreateParamsNonStreaming & GroqReasoningParams)

    const title = response.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '')
    if (title) db.renameConversation(conversationId, title)
  } catch (error) {
    // Non-critical: leave the default title if this fails.
    const message = error instanceof Error ? error.message : String(error)
    scope.error('Auto-title generation error:', message)
  }
}
