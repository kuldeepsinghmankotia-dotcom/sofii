import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

let tempDir: string

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  }
}))

describe('settings', () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sofii-settings-test-'))
    delete process.env.GROQ_API_KEY
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    delete process.env.GROQ_API_KEY
  })

  it('reports no api key when none is set or stored', async () => {
    const { hasApiKey } = await import('./settings')
    expect(hasApiKey()).toBe(false)
  })

  it('setApiKey persists to config.json and updates process.env immediately', async () => {
    const { setApiKey, hasApiKey } = await import('./settings')
    setApiKey('gsk_test_key')

    expect(process.env.GROQ_API_KEY).toBe('gsk_test_key')
    expect(hasApiKey()).toBe(true)
  })

  it('applyStoredApiKey fills process.env from a previously saved key', async () => {
    const settingsA = await import('./settings')
    settingsA.setApiKey('gsk_saved_key')

    // Simulate a fresh process: env cleared, module re-imported.
    delete process.env.GROQ_API_KEY
    vi.resetModules()

    const settingsB = await import('./settings')
    settingsB.applyStoredApiKey()

    expect(process.env.GROQ_API_KEY).toBe('gsk_saved_key')
  })

  it('applyStoredApiKey never overwrites an already-set env var (.env takes precedence)', async () => {
    const settingsA = await import('./settings')
    settingsA.setApiKey('gsk_saved_key')

    delete process.env.GROQ_API_KEY
    vi.resetModules()

    process.env.GROQ_API_KEY = 'gsk_from_dotenv'
    const settingsB = await import('./settings')
    settingsB.applyStoredApiKey()

    expect(process.env.GROQ_API_KEY).toBe('gsk_from_dotenv')
  })

  it('applyStoredApiKey is a no-op when nothing has ever been saved', async () => {
    const { applyStoredApiKey, hasApiKey } = await import('./settings')
    applyStoredApiKey()
    expect(hasApiKey()).toBe(false)
  })
})
