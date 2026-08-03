import { describe, it, expect } from 'vitest'
import { rankMemoriesByRelevance } from './memoryRanking'
import type { Memory } from './db'

function makeMemory(id: string, content: string, updated_at: number): Memory {
  return { id, content, created_at: updated_at, updated_at }
}

describe('rankMemoriesByRelevance', () => {
  it('returns an empty array when there are no memories', () => {
    expect(rankMemoriesByRelevance([], 'what is my favorite language', 5)).toEqual([])
  })

  it('excludes memories with no keyword overlap', () => {
    const memories = [makeMemory('1', 'Lives in Delhi', 1)]
    expect(rankMemoriesByRelevance(memories, 'favorite programming language', 5)).toEqual([])
  })

  it('ranks memories with more overlapping keywords higher', () => {
    const weakMatch = makeMemory('1', 'Likes coffee in the morning', 1)
    const strongMatch = makeMemory('2', 'Favorite programming language is TypeScript', 2)

    const result = rankMemoriesByRelevance(
      [weakMatch, strongMatch],
      'What is my favorite programming language?',
      5
    )

    expect(result.map((m) => m.id)).toEqual(['2'])
  })

  it('respects the limit', () => {
    const memories = [
      makeMemory('1', 'TypeScript project Alpha', 1),
      makeMemory('2', 'TypeScript project Beta', 2),
      makeMemory('3', 'TypeScript project Gamma', 3)
    ]

    const result = rankMemoriesByRelevance(memories, 'TypeScript project', 2)
    expect(result).toHaveLength(2)
  })

  it('breaks score ties by most recently updated', () => {
    const older = makeMemory('1', 'Works on the Sofii project', 1)
    const newer = makeMemory('2', 'Works on the Sofii project', 2)

    const result = rankMemoriesByRelevance([older, newer], 'Sofii project', 5)
    expect(result.map((m) => m.id)).toEqual(['2', '1'])
  })
})
