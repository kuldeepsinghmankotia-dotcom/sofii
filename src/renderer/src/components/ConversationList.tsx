import { useState, type ReactElement } from 'react'
import type { ConversationSummary } from '../../../preload/api'

export type View = 'chat' | 'memories' | 'reminders' | 'settings'

type Props = {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  view: View
  onSetView: (view: View) => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  view,
  onSetView
}: Props): ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const startEditing = (conversation: ConversationSummary): void => {
    setEditingId(conversation.id)
    setEditingValue(conversation.title)
  }

  const commitEditing = (): void => {
    if (editingId && editingValue.trim()) {
      onRename(editingId, editingValue.trim())
    }
    setEditingId(null)
  }
  return (
    <div
      style={{
        width: 240,
        background: '#0b1220',
        borderRight: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onCreate}
          style={{
            width: '100%',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          + New conversation
        </button>

        {view !== 'chat' && (
          <button
            onClick={() => onSetView('chat')}
            style={{
              width: '100%',
              background: 'transparent',
              color: 'white',
              border: '1px solid #374151',
              borderRadius: 10,
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            💬 Back to chats
          </button>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onSetView(view === 'memories' ? 'chat' : 'memories')}
            style={{
              flex: 1,
              background: view === 'memories' ? '#1f2937' : 'transparent',
              color: 'white',
              border: '1px solid #374151',
              borderRadius: 10,
              padding: '10px 8px',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            🧠 Memories
          </button>

          <button
            onClick={() => onSetView(view === 'reminders' ? 'chat' : 'reminders')}
            style={{
              flex: 1,
              background: view === 'reminders' ? '#1f2937' : 'transparent',
              color: 'white',
              border: '1px solid #374151',
              borderRadius: 10,
              padding: '10px 8px',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            ⏰ Reminders
          </button>

          <button
            onClick={() => onSetView(view === 'settings' ? 'chat' : 'settings')}
            title="Settings"
            style={{
              background: view === 'settings' ? '#1f2937' : 'transparent',
              color: 'white',
              border: '1px solid #374151',
              borderRadius: 10,
              padding: '10px 10px',
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            ⚙️
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 10px',
              borderRadius: 8,
              marginBottom: 4,
              cursor: 'pointer',
              background: conversation.id === selectedId ? '#1f2937' : 'transparent',
              color: 'white',
              fontSize: 14
            }}
          >
            {editingId === conversation.id ? (
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={commitEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditing()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                style={{
                  flex: 1,
                  background: '#111827',
                  color: 'white',
                  border: '1px solid #2563eb',
                  borderRadius: 6,
                  padding: '2px 6px',
                  fontSize: 14,
                  minWidth: 0
                }}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startEditing(conversation)
                }}
                title="Double-click to rename"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {conversation.title}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(conversation.id)
              }}
              title="Delete conversation"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: 14,
                flexShrink: 0
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
