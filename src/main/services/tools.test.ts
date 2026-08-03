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

  it('creates a reminder from valid arguments', () => {
    const scheduledAtIso = new Date(Date.now() + 60_000).toISOString()
    const result = executeToolCall(
      {
        name: 'create_reminder',
        argumentsJson: JSON.stringify({ content: 'Drink water', scheduled_at_iso: scheduledAtIso })
      },
      db
    )

    expect(result).toContain('Reminder created')
    expect(db.listReminders().map((r) => r.content)).toEqual(['Drink water'])
  })

  it('returns an error and creates nothing when content is missing', () => {
    const result = executeToolCall(
      {
        name: 'create_reminder',
        argumentsJson: JSON.stringify({ scheduled_at_iso: new Date().toISOString() })
      },
      db
    )

    expect(result).toMatch(/^Error/)
    expect(db.listReminders()).toEqual([])
  })

  it('returns an error and creates nothing when the date is unparseable', () => {
    const result = executeToolCall(
      {
        name: 'create_reminder',
        argumentsJson: JSON.stringify({ content: 'Drink water', scheduled_at_iso: 'not-a-date' })
      },
      db
    )

    expect(result).toMatch(/^Error/)
    expect(db.listReminders()).toEqual([])
  })

  it('creates a memory from valid arguments', () => {
    const result = executeToolCall(
      { name: 'create_memory', argumentsJson: JSON.stringify({ content: 'Prefers TypeScript' }) },
      db
    )

    expect(result).toContain('Memory saved')
    expect(db.listMemories().map((m) => m.content)).toEqual(['Prefers TypeScript'])
  })

  it('returns an error when memory content is missing', () => {
    const result = executeToolCall({ name: 'create_memory', argumentsJson: '{}' }, db)
    expect(result).toMatch(/^Error/)
    expect(db.listMemories()).toEqual([])
  })

  it('lists no reminders when none are pending', () => {
    const result = executeToolCall({ name: 'list_reminders', argumentsJson: '{}' }, db)
    expect(result).toBe('No upcoming reminders.')
  })

  it('lists pending reminders', () => {
    db.createReminder('Call the dentist', Date.now() + 60_000)
    const result = executeToolCall({ name: 'list_reminders', argumentsJson: '{}' }, db)
    expect(result).toContain('Call the dentist')
  })

  it('returns an error for an unknown tool name', () => {
    const result = executeToolCall({ name: 'delete_everything', argumentsJson: '{}' }, db)
    expect(result).toMatch(/^Error: unknown tool/)
  })

  it('returns an error for malformed JSON arguments', () => {
    const result = executeToolCall({ name: 'create_memory', argumentsJson: '{not json' }, db)
    expect(result).toMatch(/^Error/)
  })
})
