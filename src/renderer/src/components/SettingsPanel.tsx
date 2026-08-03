import { useEffect, useState, type ReactElement } from 'react'

export default function SettingsPanel(): ReactElement {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.electron.hasApiKey().then(setHasKey)
  }, [])

  const handleSave = async (): Promise<void> => {
    if (!input.trim()) return
    await window.electron.setApiKey(input.trim())
    setInput('')
    setHasKey(true)
    setSaved(true)
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
        ⚙️ Settings
      </div>

      <div
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 480
        }}
      >
        <div style={{ fontWeight: 'bold' }}>Groq API key</div>

        <div style={{ color: '#9ca3af', fontSize: 13 }}>
          {hasKey === null
            ? 'Checking…'
            : hasKey
              ? '✅ A key is configured.'
              : '⚠️ No key configured yet — chat, voice, and tools will not work until you add one.'}
        </div>

        <div style={{ color: '#9ca3af', fontSize: 13 }}>
          Get a free key at console.groq.com (no credit card required), then paste it below.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setSaved(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
            placeholder="gsk_..."
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
            onClick={handleSave}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>

        {saved && <div style={{ color: '#22c55e', fontSize: 13 }}>Saved.</div>}
      </div>
    </div>
  )
}
