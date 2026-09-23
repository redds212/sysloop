import type { Attempt, AttemptPhase, Card } from '../types'
export function grade(card: Card, missed: readonly string[], timedOut: boolean, phase: AttemptPhase, now = new Date()): Attempt {
  const presentLineKeys = card.lines.map(l => l.key)
  if (!presentLineKeys.length || new Set(presentLineKeys).size !== presentLineKeys.length) throw new Error('Nieprawidłowe odzywki karty')
  if (!timedOut && missed.some(k => !presentLineKeys.includes(k))) throw new Error('Nieznany klucz odzywki')
  const missedLineKeys = timedOut ? null : [...new Set(missed)]
  const lineVersions=Object.fromEntries(card.lines.filter(l=>l.changeId).map(l=>[l.key,l.changeId!]))
  return { cardId: card.id, correct: !timedOut && missedLineKeys!.length === 0, phase,
    missedLineKeys, presentLineKeys, timedOut, lineCount: presentLineKeys.length, ts: now.toISOString(),...(Object.keys(lineVersions).length?{lineVersions}:{}) }
}
export function errorNoun(count: number): string {
  if (count === 1) return 'błąd'
  return count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? 'błędy' : 'błędów'
}
export function callNoun(count: number): string {
  if (count === 1) return 'odzywka'
  return count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? 'odzywki' : 'odzywek'
}
