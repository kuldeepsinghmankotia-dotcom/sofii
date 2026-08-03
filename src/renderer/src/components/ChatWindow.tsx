import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ChatMessage } from '../../../preload/api'

type Props = {
  conversationId: string | null
  onActivity?: () => void
}

export default function ChatWindow({ conversationId, onActivity }: Props): ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [title, setTitle] = useState('')
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!conversationId) return

    let cancelled = false

    window.electron.getConversation(conversationId).then((conversation) => {
      if (cancelled || !conversation) return
      setMessages(conversation.messages)
      setTitle(conversation.title)
    })

    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  const sendMessage = async (): Promise<void> => {
    if (!input.trim() || !conversationId) return

    const content = input
    setInput('')

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: Date.now()
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: Date.now()
    }

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder])

    const { streamId } = await window.electron.sendMessage(conversationId, content)

    unsubscribeRef.current?.()
    unsubscribeRef.current = window.electron.onStreamChunk(streamId, (event) => {
      if (event.type === 'chunk') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: m.content + event.delta } : m
          )
        )
      } else if (event.type === 'done') {
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
        onActivity?.()
      } else if (event.type === 'error') {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, content: event.error } : m))
        )
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
      }
    })
  }

  if (!conversationId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af'
        }}
      >
        Select or start a new conversation
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: 'white' }}>
      <div
        style={{
          padding: 20,
          fontSize: 20,
          fontWeight: 'bold',
          borderBottom: '1px solid #374151'
        }}
      >
        {title || '🤖 Sofii AI'}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#2563eb' : '#374151',
              padding: 12,
              borderRadius: 12,
              maxWidth: '75%',
              whiteSpace: 'pre-wrap'
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', padding: 15, gap: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage()
          }}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: 'none',
            outline: 'none',
            fontSize: 16
          }}
        />

        <button
          onClick={sendMessage}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '12px 20px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
