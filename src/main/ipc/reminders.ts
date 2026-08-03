import { ipcMain, BrowserWindow, Notification } from 'electron'
import { getDb, type Reminder } from '../services/db'
import { scheduleReminder, cancelReminderTimer, initScheduler } from '../services/scheduler'

function handleReminderFired(reminder: Reminder): void {
  getDb().updateReminderStatus(reminder.id, 'fired')

  if (Notification.isSupported()) {
    new Notification({ title: 'Sofii Reminder', body: reminder.content }).show()
  }

  const firedReminder: Reminder = { ...reminder, status: 'fired' }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('reminder:fired', firedReminder)
  }
}

export function registerReminderIpc(): void {
  // Reschedules pending reminders (and immediately fires anything missed
  // while the app was closed) once, at startup.
  initScheduler(handleReminderFired)

  ipcMain.handle('reminder:create', (_event, content: string, scheduledAt: number) => {
    const reminder = getDb().createReminder(content, scheduledAt)
    scheduleReminder(reminder, handleReminderFired)
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
