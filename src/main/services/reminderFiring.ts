import { BrowserWindow, Notification } from 'electron'
import { getDb, type Reminder } from './db'

// Intentional, narrow exception to the "services avoid Electron" convention:
// firing a reminder inherently means showing a native OS notification and
// broadcasting to open windows, and both the reminders IPC module and the
// tool-calling module (a reminder created mid-conversation still needs to
// fire later) need to trigger the exact same side effects, so this is the
// one shared place for it rather than duplicating it in both.
export function fireReminder(reminder: Reminder): void {
  getDb().updateReminderStatus(reminder.id, 'fired')

  if (Notification.isSupported()) {
    new Notification({ title: 'Sofii Reminder', body: reminder.content }).show()
  }

  const firedReminder: Reminder = { ...reminder, status: 'fired' }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('reminder:fired', firedReminder)
  }
}
