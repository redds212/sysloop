import type { Attempt, Card } from '../types'
import { hardLines } from './lineStats'

export function previousMissedKeys(card: Card, attempts: readonly Attempt[]): string[] {
  const last = attempts.filter(a => a.cardId === card.id && a.scope !== 'partial' && a.phase !== 'hard')
    .sort((a,b) => b.ts.localeCompare(a.ts))[0]
  if (!last) return []
  const missed = last.missedLineKeys ?? last.presentLineKeys
  return card.lines.filter(line => missed.includes(line.key)).map(line => line.key)
}

export type DifficultFilter = 'all' | 'starred' | 'frequent'
export function difficultCards(cards: readonly Card[], attempts: readonly Attempt[], stars: readonly string[], filter: DifficultFilter) {
  const lines = hardLines(cards, attempts)
  return cards.filter(card => card.status === 'active').map(card => ({
    card, starred: stars.includes(card.id), lines: lines.filter(line => line.cardId === card.id),
  })).filter(item => filter === 'starred' ? item.starred : filter === 'frequent' ? item.lines.length : item.starred || item.lines.length)
    .sort((a,b) => (b.lines[0]?.misses ?? 0) - (a.lines[0]?.misses ?? 0)
      || (b.lines[0]?.lastMiss ?? '').localeCompare(a.lines[0]?.lastMiss ?? '') || a.card.sortOrder - b.card.sortOrder)
}
