import { useEffect, useState, type ReactElement } from 'react'
import type { Reminder, ReminderStatus } from '../../../preload/api'

function toLocalDatetimeInputValue(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function defaultDatetimeValue(): string {
  return toLocalDatetimeInputValue(Date.now() + 60 * 60 * 1000)
}

function statusLabel(status: ReminderStatus): string {
  if (status === 'pending') return 'Upcoming'
  if (status === 'fired') return 'Done'
  return 'Cancelled'
}

export default function ReminderPanel(): ReactElement {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [content, setContent] = useState('')
  const [when, setWhen] = useState(defaultDatetimeValue())

  const refresh = async (): Promise<void> => {
    setReminders(await window.electron.listReminders())
  }

  useEffect(() => {
    window.electron.listReminders().then(setReminders)

    const unsubscribe = window.electron.onReminderFired(() => {
      window.electron.listReminders().then(setReminders)
    })

    return unsubscribe
  }, [])

  const handleAdd = async (): Promise<void> => {
    if (!content.trim() || !when) return
    const scheduledAt = new Date(when).getTime()
    if (Number.isNaN(scheduledAt)) return

    await window.electron.createReminder(content.trim(), scheduledAt)
    setContent('')
    await refresh()
  }

  const handleCancel = async (id: string): Promise<void> => {
    await window.electron.cancelReminder(id)
    await refresh()
  }

  const handleDelete = async (id: string): Promise<void> => {
    await window.electron.deleteReminder(id)
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
        ⏰ Reminders
      </div>

      <div style={{ padding: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="What should I remind you about?"
          style={{
            flex: 1,
            minWidth: 200,
            padding: 12,
            borderRadius: 10,
            border: 'none',
            outline: 'none',
            fontSize: 16
          }}
        />

        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          style={{
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
        {reminders.length === 0 && <div style={{ color: '#9ca3af' }}>No reminders yet.</div>}
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#374151',
              padding: 12,
              borderRadius: 10,
              gap: 10
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {reminder.content}
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>
                {new Date(reminder.scheduled_at).toLocaleString()} · {statusLabel(reminder.status)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {reminder.status === 'pending' && (
                <button
                  onClick={() => handleCancel(reminder.id)}
                  title="Cancel reminder"
                  style={{
                    background: 'transparent',
                    border: '1px solid #6b7280',
                    borderRadius: 6,
                    color: '#d1d5db',
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: '4px 8px'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => handleDelete(reminder.id)}
                title="Delete reminder"
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
          </div>
        ))}
      </div>
    </div>
  )
}
