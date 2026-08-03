import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initDb, type SofiiDb } from './db'
import { executeToolCall } from './tools'

describe('executeToolCall', () => {
  let db: SofiiDb

  beforeEach(() => {
    vi.useFakeTimers()
    db = initDb(':memory:')
  })

  afterEach(() => {
    vi.useRealTimers()
    db.close()
  })

  it('creates a reminder from valid arguments', async () => {
    const scheduledAtIso = new Date(Date.now() + 60_000).toISOString()
    const result = await executeToolCall(
      {
        name: 'create_reminder',
        argumentsJson: JSON.stringify({ content: 'Drink water', scheduled_at_iso: scheduledAtIso })
      },
      db
    )

    expect(result).toContain('Reminder created')
    expect(db.listReminders().map((r) => r.content)).toEqual(['Drink water'])
  })

  it('returns an error and creates nothing when content is missing', async () => {
    const result = await executeToolCall(
      {
        name: 'create_reminder',
        argumentsJson: JSON.stringify({ scheduled_at_iso: new Date().toISOString() })
      },
      db
    )

    expect(result).toMatch(/^Error/)
    expect(db.listReminders()).toEqual([])
  })

  it('returns an error and creates nothing when the date is unparseable', async () => {
    const result = await executeToolCall(
      {
        name: 'create_reminder',
        argumentsJson: JSON.stringify({ content: 'Drink water', scheduled_at_iso: 'not-a-date' })
      },
      db
    )

    expect(result).toMatch(/^Error/)
    expect(db.listReminders()).toEqual([])
  })

  it('creates a memory from valid arguments', async () => {
    const result = await executeToolCall(
      { name: 'create_memory', argumentsJson: JSON.stringify({ content: 'Prefers TypeScript' }) },
      db
    )

    expect(result).toContain('Memory saved')
    expect(db.listMemories().map((m) => m.content)).toEqual(['Prefers TypeScript'])
  })

  it('returns an error when memory content is missing', async () => {
    const result = await executeToolCall({ name: 'create_memory', argumentsJson: '{}' }, db)
    expect(result).toMatch(/^Error/)
    expect(db.listMemories()).toEqual([])
  })

  it('lists no reminders when none are pending', async () => {
    const result = await executeToolCall({ name: 'list_reminders', argumentsJson: '{}' }, db)
    expect(result).toBe('No upcoming reminders.')
  })

  it('lists pending reminders', async () => {
    db.createReminder('Call the dentist', Date.now() + 60_000)
    const result = await executeToolCall({ name: 'list_reminders', argumentsJson: '{}' }, db)
    expect(result).toContain('Call the dentist')
  })

  it('returns an error for an unknown tool name', async () => {
    const result = await executeToolCall({ name: 'delete_everything', argumentsJson: '{}' }, db)
    expect(result).toMatch(/^Error: unknown tool/)
  })

  it('returns an error for malformed JSON arguments', async () => {
    const result = await executeToolCall({ name: 'create_memory', argumentsJson: '{not json' }, db)
    expect(result).toMatch(/^Error/)
  })

  it('returns an error when get_weather location is missing', async () => {
    const result = await executeToolCall({ name: 'get_weather', argumentsJson: '{}' }, db)
    expect(result).toMatch(/^Error: location is required/)
  })

  it('returns a friendly error string when the weather lookup throws', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const result = await executeToolCall(
      { name: 'get_weather', argumentsJson: JSON.stringify({ location: 'Delhi' }) },
      db
    )

    expect(result).toBe('Error fetching weather: network down')
    global.fetch = originalFetch
  })
})
