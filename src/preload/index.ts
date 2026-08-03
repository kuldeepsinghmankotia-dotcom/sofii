import { contextBridge, ipcRenderer } from 'electron'
import type { StreamEvent, Reminder, SofiiElectronAPI } from './api'

const api: SofiiElectronAPI = {
  createConversation: () => ipcRenderer.invoke('chat:create-conversation'),

  listConversations: () => ipcRenderer.invoke('chat:list-conversations'),

  getConversation: (conversationId) => ipcRenderer.invoke('chat:get-conversation', conversationId),

  renameConversation: (conversationId, title) =>
    ipcRenderer.invoke('chat:rename-conversation', conversationId, title),

  deleteConversation: (conversationId) =>
    ipcRenderer.invoke('chat:delete-conversation', conversationId),

  sendMessage: (conversationId, content) =>
    ipcRenderer.invoke('chat:send-message', conversationId, content),

  onStreamChunk: (streamId, callback) => {
    const channel = `chat:stream:${streamId}`
    const listener = (_: Electron.IpcRendererEvent, data: StreamEvent): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  transcribeAudio: (audio, mimeType) => ipcRenderer.invoke('voice:transcribe', audio, mimeType),

  createMemory: (content) => ipcRenderer.invoke('memory:create', content),

  listMemories: () => ipcRenderer.invoke('memory:list'),

  updateMemory: (memoryId, content) => ipcRenderer.invoke('memory:update', memoryId, content),

  deleteMemory: (memoryId) => ipcRenderer.invoke('memory:delete', memoryId),

  createReminder: (content, scheduledAt) =>
    ipcRenderer.invoke('reminder:create', content, scheduledAt),

  listReminders: () => ipcRenderer.invoke('reminder:list'),

  cancelReminder: (reminderId) => ipcRenderer.invoke('reminder:cancel', reminderId),

  deleteReminder: (reminderId) => ipcRenderer.invoke('reminder:delete', reminderId),

  onReminderFired: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: Reminder): void => callback(data)
    ipcRenderer.on('reminder:fired', listener)
    return () => ipcRenderer.removeListener('reminder:fired', listener)
  },

  hasApiKey: () => ipcRenderer.invoke('settings:has-api-key'),

  setApiKey: (key) => ipcRenderer.invoke('settings:set-api-key', key)
}

contextBridge.exposeInMainWorld('electron', api)
