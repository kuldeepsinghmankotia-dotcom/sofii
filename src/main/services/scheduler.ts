import { getDb, type Reminder } from './db'

// setTimeout's delay is a 32-bit signed int internally; anything larger gets
// silently truncated/fires immediately in Node. Reminders further out than
// this get re-checked (see initScheduler) rather than scheduled directly.
const MAX_TIMEOUT_MS = 2_147_483_647

const timers = new Map<string, NodeJS.Timeout>()

export function msUntil(
  reminder: Pick<Reminder, 'scheduled_at'>,
  now: number = Date.now()
): number {
  return reminder.scheduled_at - now
}

export function isOverdue(
  reminder: Pick<Reminder, 'scheduled_at'>,
  now: number = Date.now()
): boolean {
  return msUntil(reminder, now) <= 0
}

export function cancelReminderTimer(reminderId: string): void {
  const timer = timers.get(reminderId)
  if (timer) {
    clearTimeout(timer)
    timers.delete(reminderId)
  }
}

export function scheduleReminder(reminder: Reminder, onFire: (reminder: Reminder) => void): void {
  cancelReminderTimer(reminder.id)

  const delay = Math.min(Math.max(msUntil(reminder), 0), MAX_TIMEOUT_MS)
  const timer = setTimeout(() => {
    timers.delete(reminder.id)
    onFire(reminder)
  }, delay)

  timers.set(reminder.id, timer)
}

/**
 * Loads pending reminders at startup: anything already due (the app was
 * closed when it should have fired) fires immediately instead of being
 * silently dropped; everything else gets a timer for its remaining delay.
 */
export function initScheduler(onFire: (reminder: Reminder) => void): void {
  for (const reminder of getDb().listPendingReminders()) {
    if (isOverdue(reminder)) {
      onFire(reminder)
    } else {
      scheduleReminder(reminder, onFire)
    }
  }
}
