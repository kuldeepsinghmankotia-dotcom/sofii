import type { ReactElement } from 'react'
import type { ConversationSummary } from '../../../preload/api'

type Props = {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onDelete
}: Props): ReactElement {
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
      <div style={{ padding: 12 }}>
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
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {conversation.title}
            </span>
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
                fontSize: 14
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
