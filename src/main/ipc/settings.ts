import { ipcMain } from 'electron'
import { hasApiKey, setApiKey } from '../services/settings'
import { resetGroqClient } from '../services/groqClient'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:has-api-key', () => hasApiKey())

  ipcMain.handle('settings:set-api-key', (_event, key: string) => {
    setApiKey(key)
    resetGroqClient()
    return { ok: true }
  })
}
