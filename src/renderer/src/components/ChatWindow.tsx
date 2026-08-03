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
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [speakEnabled, setSpeakEnabled] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])

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
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = (text: string): void => {
    if (!speakEnabled || !text.trim()) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
  }

  const addSystemNote = (content: string): void => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', content, created_at: Date.now() }
    ])
  }

  const sendMessage = async (overrideContent?: string): Promise<void> => {
    const content = overrideContent ?? input
    if (!content.trim() || !conversationId) return

    if (overrideContent === undefined) setInput('')

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
    let fullContent = ''

    unsubscribeRef.current?.()
    unsubscribeRef.current = window.electron.onStreamChunk(streamId, (event) => {
      if (event.type === 'chunk') {
        fullContent += event.delta
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: m.content + event.delta } : m
          )
        )
      } else if (event.type === 'done') {
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
        onActivity?.()
        speak(fullContent)
      } else if (event.type === 'error') {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, content: event.error } : m))
        )
        unsubscribeRef.current?.()
        unsubscribeRef.current = null
      }
    })
  }

  const toggleRecording = async (): Promise<void> => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      audioChunksRef.current = []

      recorder.ondataavailable = (e): void => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async (): Promise<void> => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()

        setIsTranscribing(true)
        try {
          const { text } = await window.electron.transcribeAudio(arrayBuffer, 'audio/webm')
          if (text.trim()) await sendMessage(text.trim())
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          addSystemNote(`Transcription failed: ${message}`)
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addSystemNote(`Microphone unavailable: ${message}`)
    }
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
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>{title || '🤖 Sofii AI'}</span>
        <button
          onClick={() => {
            setSpeakEnabled((prev) => {
              if (prev) window.speechSynthesis.cancel()
              return !prev
            })
          }}
          title={speakEnabled ? 'Spoken replies on' : 'Spoken replies off'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18
          }}
        >
          {speakEnabled ? '🔊' : '🔇'}
        </button>
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
        {isTranscribing && (
          <div style={{ alignSelf: 'flex-end', color: '#9ca3af', fontSize: 14 }}>Transcribing…</div>
        )}
      </div>

      <div style={{ display: 'flex', padding: 15, gap: 10 }}>
        <button
          onClick={toggleRecording}
          disabled={isTranscribing}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          style={{
            background: isRecording ? '#dc2626' : '#374151',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '12px 16px',
            cursor: isTranscribing ? 'default' : 'pointer',
            opacity: isTranscribing ? 0.6 : 1
          }}
        >
          {isRecording ? '⏹' : '🎙️'}
        </button>

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
          onClick={() => sendMessage()}
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
