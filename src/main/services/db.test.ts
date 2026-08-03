import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SofiiDb } from './db'

describe('SofiiDb', () => {
  let db: SofiiDb

  beforeEach(() => {
    db = new SofiiDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('creates a conversation with default title', () => {
    const conversation = db.createConversation()
    expect(conversation.title).toBe('New conversation')
    expect(conversation.id).toBeTruthy()
  })

  it('lists conversations ordered by most recently updated', () => {
    const first = db.createConversation('First')
    const second = db.createConversation('Second')

    db.insertMessage(first.id, 'user', 'hello again')

    const list = db.listConversations()
    expect(list.map((c) => c.id)).toEqual([first.id, second.id])
  })

  it('returns undefined for a missing conversation', () => {
    expect(db.getConversation('does-not-exist')).toBeUndefined()
  })

  it('stores and retrieves messages in order', () => {
    const conversation = db.createConversation('Test')
    db.insertMessage(conversation.id, 'user', 'hi')
    db.insertMessage(conversation.id, 'assistant', 'hello!')

    const result = db.getConversation(conversation.id)
    expect(result?.messages.map((m) => m.content)).toEqual(['hi', 'hello!'])
    expect(result?.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
  })

  it('renames a conversation', () => {
    const conversation = db.createConversation('Old title')
    db.renameConversation(conversation.id, 'New title')
    expect(db.getConversation(conversation.id)?.title).toBe('New title')
  })

  it('deletes a conversation and cascades its messages', () => {
    const conversation = db.createConversation()
    db.insertMessage(conversation.id, 'user', 'hi')
    db.deleteConversation(conversation.id)
    expect(db.getConversation(conversation.id)).toBeUndefined()
  })

  it('creates and lists memories ordered by most recently updated', () => {
    const first = db.createMemory('Likes TypeScript')
    const startMs = Date.now()
    while (Date.now() === startMs) {
      // busy-wait to guarantee a distinct millisecond for the second insert,
      // since ordering here is by updated_at (Date.now()), not insertion order
    }
    const second = db.createMemory('Lives in Delhi')

    const list = db.listMemories()
    expect(list.map((m) => m.id)).toEqual([second.id, first.id])
    expect(list.map((m) => m.content)).toEqual(['Lives in Delhi', 'Likes TypeScript'])
  })

  it('updates a memory and bumps its updated_at', () => {
    const memory = db.createMemory('Old fact')
    db.updateMemory(memory.id, 'New fact')

    const [updated] = db.listMemories()
    expect(updated.content).toBe('New fact')
    expect(updated.updated_at).toBeGreaterThanOrEqual(memory.updated_at)
  })

  it('deletes a memory', () => {
    const memory = db.createMemory('Temporary fact')
    db.deleteMemory(memory.id)
    expect(db.listMemories()).toEqual([])
  })

  it('creates a reminder as pending and lists it ordered by scheduled time', () => {
    const later = db.createReminder('Call the dentist', Date.now() + 60_000)
    const sooner = db.createReminder('Take a break', Date.now() + 1_000)

    expect(later.status).toBe('pending')

    const list = db.listReminders()
    expect(list.map((r) => r.id)).toEqual([sooner.id, later.id])
  })

  it('only lists pending reminders in listPendingReminders', () => {
    const pending = db.createReminder('Still pending', Date.now() + 1_000)
    const cancelled = db.createReminder('Will be cancelled', Date.now() + 1_000)
    db.updateReminderStatus(cancelled.id, 'cancelled')

    const list = db.listPendingReminders()
    expect(list.map((r) => r.id)).toEqual([pending.id])
  })

  it('updates a reminder status', () => {
    const reminder = db.createReminder('Water the plants', Date.now() + 1_000)
    db.updateReminderStatus(reminder.id, 'fired')

    const [updated] = db.listReminders()
    expect(updated.status).toBe('fired')
  })

  it('deletes a reminder', () => {
    const reminder = db.createReminder('Temporary reminder', Date.now() + 1_000)
    db.deleteReminder(reminder.id)
    expect(db.listReminders()).toEqual([])
  })
})
