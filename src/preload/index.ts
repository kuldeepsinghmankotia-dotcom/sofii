import { contextBridge, ipcRenderer } from 'electron'
import type { StreamEvent, SofiiElectronAPI } from './api'

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
  }
}

contextBridge.exposeInMainWorld('electron', api)
