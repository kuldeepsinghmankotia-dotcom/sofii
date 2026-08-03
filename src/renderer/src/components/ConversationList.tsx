import { useState, type ReactElement } from 'react'
import type { ConversationSummary } from '../../../preload/api'

type Props = {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  view: 'chat' | 'memories'
  onToggleView: () => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  view,
  onToggleView
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

        <button
          onClick={onToggleView}
          style={{
            width: '100%',
            background: view === 'memories' ? '#1f2937' : 'transparent',
            color: 'white',
            border: '1px solid #374151',
            borderRadius: 10,
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          {view === 'memories' ? '💬 Back to chats' : '🧠 Memories'}
        </button>
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
