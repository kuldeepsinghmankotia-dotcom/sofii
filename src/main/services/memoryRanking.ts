import type { Memory } from './db'

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'to',
  'of',
  'and',
  'or',
  'in',
  'on',
  'at',
  'for',
  'with',
  'my',
  'me',
  'i',
  'you',
  'your',
  'it',
  'that',
  'this'
])

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word))

  return new Set(words)
}

/**
 * Pure, dependency-free keyword-overlap relevance scoring for local memory
 * recall. Deliberately simple (no embeddings/vector search) so it needs no
 * network calls or ML runtime — fine at single-user local scale, and can be
 * swapped for a semantic ranker later behind this same signature.
 */
export function rankMemoriesByRelevance(
  memories: Memory[],
  query: string,
  limit: number
): Memory[] {
  const queryTokens = tokenize(query)
  if (queryTokens.size === 0) return []

  const scored = memories
    .map((memory) => {
      const memoryTokens = tokenize(memory.content)
      let score = 0
      for (const token of queryTokens) {
        if (memoryTokens.has(token)) score += 1
      }
      return { memory, score }
    })
    .filter((entry) => entry.score > 0)

  scored.sort((a, b) => b.score - a.score || b.memory.updated_at - a.memory.updated_at)

  return scored.slice(0, limit).map((entry) => entry.memory)
}
