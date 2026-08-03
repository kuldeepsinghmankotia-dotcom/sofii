import OpenAI from 'openai'
import log from '../lib/logger'

const scope = log.scope('groq')

// llama-3.3-70b-versatile is deprecated on Groq's free/developer tier
// (shutdown 2026-08-16); openai/gpt-oss-120b is Groq's recommended
// replacement and is itself designed for strong tool-calling support.
// Overridable via GROQ_MODEL so a future deprecation doesn't require a
// code change, just an env var update.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
}

export const SYSTEM_PROMPT = 'You are SOFII, a friendly, intelligent AI desktop assistant.'

// Groq-specific request fields not present in the openai SDK's types (hence
// the intersection type below rather than plain params). openai/gpt-oss-120b
// is a reasoning model: by default it streams hidden chain-of-thought as a
// separate `reasoning` delta field *in addition to* the real answer in
// `content`, and that reasoning still consumes tokens even when unused —
// verified against the live API, where a 200-token budget was exhausted by
// reasoning before any `content` was produced at all. include_reasoning:
// false suppresses it; reasoning_effort: 'low' keeps it minimal, which
// matters given the free tier's tight 8K TPM budget.
export interface GroqReasoningParams {
  reasoning_effort?: 'low' | 'medium' | 'high'
  include_reasoning?: boolean
}

export const SUPPRESS_REASONING: GroqReasoningParams = {
  reasoning_effort: 'low',
  include_reasoning: false
}

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

// Called after the user saves a new API key via Settings, so the next
// getGroqClient() call rebuilds with it instead of keeping a stale client
// constructed with a missing/old key.
export function resetGroqClient(): void {
  client = undefined
}
