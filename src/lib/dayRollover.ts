import type { LearningData } from './learningRepository'
import type { Attempt } from '../types'
import { todayKey } from './date'
import { applyAnswer, normalizeEntry } from './srs'

/** The owner confirmed that unfinished main misses become next-day retries. */
export function unfinishedCorrections(data: LearningData, now = new Date()) {
  const latest = new Map<string, Attempt>()
  for (const attempt of data.attempts) {
    if (attempt.phase === 'hard') continue
    const previous = latest.get(attempt.cardId)
    if (!previous || Date.parse(attempt.ts) >= Date.parse(previous.ts)) latest.set(attempt.cardId, attempt)
  }
  const active = new Set(data.cards.filter(card => card.status === 'active').map(card => card.id))
  return [...latest.values()].filter(a => {
    if (!active.has(a.cardId) || a.phase !== 'main' || a.correct || todayKey(new Date(a.ts)) >= todayKey(now)) return false
    const seen = data.store[a.cardId]?.lastSeen
    return !seen || Date.parse(seen) < Date.parse(a.ts)
  }).map(a => ({ cardId: a.cardId, entry: applyAnswer(normalizeEntry(data.store[a.cardId]), false, new Date(a.ts)) }))
}
