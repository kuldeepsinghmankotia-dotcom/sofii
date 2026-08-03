import { app, session, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { loadEnv } from './lib/env'
import log from './lib/logger'
import { initDb } from './services/db'
import { applyStoredApiKey } from './services/settings'
import { registerChatIpc } from './ipc/chat'
import { registerVoiceIpc } from './ipc/voice'
import { registerMemoryIpc } from './ipc/memory'
import { registerReminderIpc } from './ipc/reminders'
import { registerSettingsIpc } from './ipc/settings'

loadEnv()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  applyStoredApiKey()
  initDb(join(app.getPath('userData'), 'sofii.db'))
  registerChatIpc()
  registerVoiceIpc()
  registerMemoryIpc()
  registerReminderIpc()
  registerSettingsIpc()
  log.info('Sofii ready, database initialized at', join(app.getPath('userData'), 'sofii.db'))

  // This is a single-user local desktop app (not an arbitrary website), so
  // granting its own renderer microphone access for push-to-talk is safe;
  // Electron denies all permission requests by default otherwise.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
