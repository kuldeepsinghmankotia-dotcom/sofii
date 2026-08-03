import OpenAI from 'openai'
import log from '../lib/logger'

const scope = log.scope('groq')

export const GROQ_MODEL = 'llama-3.3-70b-versatile'

export const SYSTEM_PROMPT = 'You are SOFII, a friendly, intelligent AI desktop assistant.'

let client: OpenAI | undefined

// Constructed lazily (on first real use) rather than at module-load time:
// ES module imports are hoisted and evaluated before this module's importer
// (main/index.ts) gets a chance to run loadEnv(), so an eager `new OpenAI()`
// here would read process.env.GROQ_API_KEY before it's populated.
export function getGroqClient(): OpenAI {
  if (!client) {
    scope.info('GROQ API KEY:', process.env.GROQ_API_KEY ? 'Loaded ✅' : 'Missing ❌')
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    })
  }
  return client
}
