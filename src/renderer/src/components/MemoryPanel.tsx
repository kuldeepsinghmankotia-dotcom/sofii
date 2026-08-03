import { useEffect, useState, type ReactElement } from 'react'
import type { Memory } from '../../../preload/api'

export default function MemoryPanel(): ReactElement {
  const [memories, setMemories] = useState<Memory[]>([])
  const [input, setInput] = useState('')

  const refresh = async (): Promise<void> => {
    setMemories(await window.electron.listMemories())
  }

  useEffect(() => {
    window.electron.listMemories().then(setMemories)
  }, [])

  const handleAdd = async (): Promise<void> => {
    if (!input.trim()) return
    await window.electron.createMemory(input.trim())
    setInput('')
    await refresh()
  }

  const handleDelete = async (id: string): Promise<void> => {
    await window.electron.deleteMemory(id)
    await refresh()
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
        🧠 Memories
      </div>

      <div style={{ padding: 20, display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder='Something to remember, e.g. "I prefer TypeScript over JavaScript"'
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
          onClick={handleAdd}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '12px 20px',
            cursor: 'pointer'
          }}
        >
          Add
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {memories.length === 0 && <div style={{ color: '#9ca3af' }}>Nothing remembered yet.</div>}
        {memories.map((memory) => (
          <div
            key={memory.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#374151',
              padding: 12,
              borderRadius: 10
            }}
          >
            <span>{memory.content}</span>
            <button
              onClick={() => handleDelete(memory.id)}
              title="Delete memory"
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
