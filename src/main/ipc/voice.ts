import { ipcMain } from 'electron'
import { toFile } from 'openai'
import { getGroqClient } from '../services/groqClient'
import log from '../lib/logger'

const scope = log.scope('voice-ipc')

// Groq's hosted Whisper endpoint, not a local model: this keeps setup free
// (generous no-credit-card free tier, same GROQ_API_KEY already in use for
// chat) and avoids a local whisper.cpp/ffmpeg toolchain. Swappable later for
// a fully local/offline STT provider behind this same IPC contract.
const TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'

export function registerVoiceIpc(): void {
  ipcMain.handle(
    'voice:transcribe',
    async (_event, audio: ArrayBuffer, mimeType: string): Promise<{ text: string }> => {
      try {
        const file = await toFile(audio, 'audio.webm', { type: mimeType })
        const transcription = await getGroqClient().audio.transcriptions.create({
          file,
          model: TRANSCRIPTION_MODEL
        })

        return { text: transcription.text }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        scope.error('Transcription error:', message)
        throw new Error(message)
      }
    }
  )
}
