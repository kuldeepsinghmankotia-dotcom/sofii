import { ipcMain } from 'electron'
import { getDb } from '../services/db'
import { scheduleReminder, cancelReminderTimer, initScheduler } from '../services/scheduler'
import { fireReminder } from '../services/reminderFiring'

export function registerReminderIpc(): void {
  // Reschedules pending reminders (and immediately fires anything missed
  // while the app was closed) once, at startup.
  initScheduler(fireReminder)

  ipcMain.handle('reminder:create', (_event, content: string, scheduledAt: number) => {
    const reminder = getDb().createReminder(content, scheduledAt)
    scheduleReminder(reminder, fireReminder)
    return reminder
  })

  ipcMain.handle('reminder:list', () => {
    return getDb().listReminders()
  })

  ipcMain.handle('reminder:cancel', (_event, reminderId: string) => {
    cancelReminderTimer(reminderId)
    getDb().updateReminderStatus(reminderId, 'cancelled')
    return { ok: true }
  })

  ipcMain.handle('reminder:delete', (_event, reminderId: string) => {
    cancelReminderTimer(reminderId)
    getDb().deleteReminder(reminderId)
    return { ok: true }
  })
}
