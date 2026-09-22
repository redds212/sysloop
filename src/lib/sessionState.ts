import type { Attempt, Card, SRSEntry, SRSStore, UserSettings } from '../types'
import { applyAnswer, finalizeBuffer } from './srs'
import { adaptSession, type DailySession } from './session'
import { todayKey } from './date'

/** Serializable domain snapshot; the persistence hook will be added in M4. */
export interface SessionState { session: DailySession; index: number; buffer: string[]; bufferIndex: number; inBuffer: boolean; correctionLines?: Record<string, string[] | null> }
export function startSession(session: DailySession): SessionState {
  return { session, index: 0, buffer: [], bufferIndex: 0, inBuffer: false }
}
export function currentCardId(state: SessionState): string | null {
  return (state.inBuffer ? state.buffer[state.bufferIndex] : state.session.slots[state.index]?.cardId) ?? null
}
export function advanceSession(state: SessionState, miss = false): SessionState {
  if (!currentCardId(state)) return state
  if (state.inBuffer) return { ...state, bufferIndex: state.bufferIndex + 1 }
  const id = currentCardId(state)!
  const buffer = miss && !state.buffer.includes(id) ? [...state.buffer, id] : state.buffer
  const index = state.index + 1
  return { ...state, index, buffer, inBuffer: index >= state.session.slots.length && buffer.length > 0 }
}
export function answerSession(state: SessionState, attempt: Attempt, previous: SRSEntry, now = new Date(), correctionMode: UserSettings['correctionMode'] = 'whole') {
  if (attempt.cardId !== currentCardId(state) || attempt.phase !== (state.inBuffer ? 'buffer' : 'main')) throw new Error('Próba nie pasuje do bieżącej pozycji')
  const progress = state.inBuffer ? finalizeBuffer(previous, attempt.correct, now)
    : attempt.correct ? applyAnswer(previous, true, now) : null
  const next = advanceSession(state, !attempt.correct)
  if (!state.inBuffer && !attempt.correct) next.correctionLines = {
    ...state.correctionLines, [attempt.cardId]: correctionMode === 'missed' && attempt.missedLineKeys?.length ? [...attempt.missedLineKeys] : null,
  }
  return { attempt, progress, state: next }
}

/** Missing/removed keys and timeouts fall back to the whole card. */
export function correctionCard(card: Card, state: SessionState): { card: Card; scope: 'full' | 'partial' } {
  const keys = state.inBuffer ? state.correctionLines?.[card.id] : null
  const lines = keys ? card.lines.filter(line => keys.includes(line.key)) : []
  return lines.length ? { card: { ...card, lines }, scope: 'partial' } : { card, scope: 'full' }
}
export function restoreSession(state: SessionState, cards: readonly Card[], now = new Date()): SessionState | null {
  if (state.session.date !== todayKey(now)) return null
  const active = new Set(cards.filter(c => c.status === 'active').map(c => c.id))
  let result = state
  while (currentCardId(result) && !active.has(currentCardId(result)!)) result = advanceSession(result)
  return result
}
export function adaptSessionState(state: SessionState, cards: Card[], store: SRSStore, settings: UserSettings, now = new Date()): SessionState {
  if (state.inBuffer) return state
  const session = adaptSession(state.session, state.index, cards, store, settings, now)
  return { ...state, session, inBuffer: state.index >= session.slots.length && state.buffer.length > 0 }
}
/** Re-ratings always start at visitBase; retrying after failure keeps that failure. */
export const rateVisit = (visitBase: SRSEntry, correct: boolean, now = new Date()) => applyAnswer(visitBase, correct, now)
export const repeatVisit = (visitBase: SRSEntry, lastRating: SRSEntry, wasCorrect: boolean) => wasCorrect ? { ...visitBase } : { ...lastRating }
