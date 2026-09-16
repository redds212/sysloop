import type { Attempt, Card, CardLine } from '../types'
export interface HardLine { cardId: string; line: CardLine; misses: number; appearances: number; lastMiss: string }
export function hardLines(cards: readonly Card[], attempts: readonly Attempt[]): HardLine[] {
  const byCard = new Map<string, Attempt[]>()
  for (const attempt of [...attempts].sort((a, b) => b.ts.localeCompare(a.ts))) {
    if (attempt.missedLineKeys === null) continue
    if (!byCard.has(attempt.cardId)) byCard.set(attempt.cardId, [])
    byCard.get(attempt.cardId)!.push(attempt)
  }
  const result: HardLine[] = []
  for (const card of cards.filter(c => c.status === 'active')) {
    for (const line of card.lines) {
      const recent = (byCard.get(card.id) ?? []).filter(a => a.presentLineKeys.includes(line.key)).slice(0, 5)
      const misses = recent.filter(a => a.missedLineKeys!.includes(line.key))
      if (misses.length >= 2) result.push({ cardId: card.id, line, misses: misses.length, appearances: recent.length, lastMiss: misses[0].ts })
    }
  }
  return result.sort((a, b) => b.misses - a.misses || b.lastMiss.localeCompare(a.lastMiss))
}
