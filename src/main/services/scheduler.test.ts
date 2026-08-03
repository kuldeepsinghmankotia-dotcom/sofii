import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initDb, type SofiiDb } from './db'
import {
  msUntil,
  isOverdue,
  scheduleReminder,
  cancelReminderTimer,
  initScheduler
} from './scheduler'

describe('msUntil / isOverdue', () => {
  it('computes remaining milliseconds relative to now', () => {
    expect(msUntil({ scheduled_at: 1000 }, 900)).toBe(100)
    expect(msUntil({ scheduled_at: 1000 }, 1000)).toBe(0)
    expect(msUntil({ scheduled_at: 1000 }, 1100)).toBe(-100)
  })

  it('treats exactly-now and past as overdue, future as not', () => {
    expect(isOverdue({ scheduled_at: 1000 }, 1000)).toBe(true)
    expect(isOverdue({ scheduled_at: 1000 }, 1100)).toBe(true)
    expect(isOverdue({ scheduled_at: 1000 }, 900)).toBe(false)
  })
})

describe('scheduleReminder / cancelReminderTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires onFire after the remaining delay elapses', () => {
    const onFire = vi.fn()
    const reminder = {
      id: '1',
      content: 'Test',
      scheduled_at: Date.now() + 5000,
      status: 'pending' as const,
      created_at: Date.now()
    }

    scheduleReminder(reminder, onFire)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)
    expect(onFire).toHaveBeenCalledWith(reminder)
  })

  it('does not fire once cancelled', () => {
    const onFire = vi.fn()
    const reminder = {
      id: '2',
      content: 'Test',
      scheduled_at: Date.now() + 5000,
      status: 'pending' as const,
      created_at: Date.now()
    }

    scheduleReminder(reminder, onFire)
    cancelReminderTimer(reminder.id)

    vi.advanceTimersByTime(10_000)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('rescheduling the same id replaces the previous timer', () => {
    const onFire = vi.fn()
    const reminder = {
      id: '3',
      content: 'Test',
      scheduled_at: Date.now() + 5000,
      status: 'pending' as const,
      created_at: Date.now()
    }

    scheduleReminder(reminder, onFire)
    scheduleReminder(reminder, onFire)

    vi.advanceTimersByTime(5000)
    expect(onFire).toHaveBeenCalledTimes(1)
  })
})

describe('initScheduler', () => {
  let db: SofiiDb

  beforeEach(() => {
    vi.useFakeTimers()
    db = initDb(':memory:')
  })

  afterEach(() => {
    vi.useRealTimers()
    db.close()
  })

  it('fires overdue reminders immediately on startup', () => {
    const onFire = vi.fn()
    const overdue = db.createReminder('Missed while closed', Date.now() - 60_000)

    initScheduler(onFire)

    expect(onFire).toHaveBeenCalledWith(expect.objectContaining({ id: overdue.id }))
  })

  it('schedules future reminders instead of firing them immediately', () => {
    const onFire = vi.fn()
    db.createReminder('Later today', Date.now() + 60_000)

    initScheduler(onFire)
    expect(onFire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(60_000)
    expect(onFire).toHaveBeenCalledTimes(1)
  })
})
