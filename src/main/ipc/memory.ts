import { ipcMain } from 'electron'
import { getDb } from '../services/db'

export function registerMemoryIpc(): void {
  ipcMain.handle('memory:create', (_event, content: string) => {
    return getDb().createMemory(content)
  })

  ipcMain.handle('memory:list', () => {
    return getDb().listMemories()
  })

  ipcMain.handle('memory:update', (_event, memoryId: string, content: string) => {
    getDb().updateMemory(memoryId, content)
    return { ok: true }
  })

  ipcMain.handle('memory:delete', (_event, memoryId: string) => {
    getDb().deleteMemory(memoryId)
    return { ok: true }
  })
}
