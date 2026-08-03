import { useEffect, useState, type ReactElement } from 'react'
import ConversationList from './components/ConversationList'
import ChatWindow from './components/ChatWindow'
import type { ConversationSummary } from '../../preload/api'

export default function App(): ReactElement {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refreshConversations = async (): Promise<ConversationSummary[]> => {
    const list = await window.electron.listConversations()
    setConversations(list)
    return list
  }

  useEffect(() => {
    window.electron.listConversations().then((list) => {
      setConversations(list)

      if (list.length > 0) {
        setSelectedId(list[0].id)
        return
      }

      window.electron.createConversation().then((conversation) => {
        setSelectedId(conversation.id)
        window.electron.listConversations().then(setConversations)
      })
    })
  }, [])

  const handleCreate = async (): Promise<void> => {
    const conversation = await window.electron.createConversation()
    await refreshConversations()
    setSelectedId(conversation.id)
  }

  const handleDelete = async (id: string): Promise<void> => {
    await window.electron.deleteConversation(id)
    const list = await refreshConversations()
    if (selectedId === id) {
      setSelectedId(list[0]?.id ?? null)
    }
  }

  return (
    <div style={{ height: '100vh', background: '#111827', display: 'flex' }}>
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
      <ChatWindow
        key={selectedId ?? 'none'}
        conversationId={selectedId}
        onActivity={refreshConversations}
      />
    </div>
  )
}
