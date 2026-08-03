import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import log from '../lib/logger'

const scope = log.scope('settings')

interface SofiiConfig {
  groqApiKey?: string
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function loadConfig(): SofiiConfig {
  const path = getConfigPath()
  if (!existsSync(path)) return {}

  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return {}
  }
}

function saveConfig(config: SofiiConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * A packaged app has no .env file (electron-builder.yml deliberately
 * excludes it so a developer's own key never ships inside the binary), so
 * GROQ_API_KEY has nowhere to come from unless the user enters one via
 * Settings. Called once at startup, after loadEnv(): if dotenv already
 * populated GROQ_API_KEY (dev mode), this is a no-op and dev workflow is
 * unaffected; otherwise it fills it in from the saved config.
 */
export function applyStoredApiKey(): void {
  if (process.env.GROQ_API_KEY) {
    scope.info('API key source: environment (.env)')
    return
  }

  const config = loadConfig()
  if (config.groqApiKey) {
    process.env.GROQ_API_KEY = config.groqApiKey
    scope.info('API key source: saved Settings config')
  } else {
    scope.info('API key source: none configured yet')
  }
}

export function setApiKey(key: string): void {
  const config = loadConfig()
  config.groqApiKey = key
  saveConfig(config)
  process.env.GROQ_API_KEY = key
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}
