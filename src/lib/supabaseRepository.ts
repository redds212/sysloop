import { supabase } from './supabase'
import type { AppUser, Attempt, Card, Category, SRSEntry } from '../types'
import type { AttemptRow, CardRow, CategoryRow, DailySessionRow, SrsProgressRow } from './database.types'
import type { LearningRepository } from './learningRepository'
import type { SessionState } from './sessionState'
import { sessionFromSlots } from './session'
import { compactAuction } from './auction/display'

const checked = <T,>(result: { data: T; error: unknown }): T => {
  if (result.error) throw new Error('Nie udało się połączyć z bazą. Sprawdź połączenie i spróbuj ponownie.')
  return result.data
}
export async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const batch = checked(await page(offset, offset + 499)) ?? []
    rows.push(...batch)
    if (batch.length < 500) return rows
  }
}
export const cardFromRow = (r: CardRow): Card => ({ id: r.id, categorySlug: r.category_slug, section: r.section, sortOrder: r.sort_order, auction: r.auction, auctionKey: r.auction_key, context: r.context ?? undefined, auctionNote: r.auction_note ?? undefined, notes: r.notes, lines: r.lines, status: r.status, reviewFlags: r.review_flags, verificationNote: r.verification_note ?? undefined, sourcePage: r.source_page, sourceRevision: r.source_revision })
const categoryFromRow = (r: CategoryRow): Category => ({ slug: r.slug, name: r.name, group: r.group_name, sortOrder: r.sort_order, sourceFile: r.source_file, revision: r.revision, notes: r.notes })
const entryFromRow = (r: SrsProgressRow): SRSEntry => ({ status: r.status, consecutiveCorrect: r.consecutive_correct, interval: r.interval, nextReviewDate: r.next_review_date, lastSeen: r.last_seen, flagDifficult: r.flag_difficult })
const attemptFromRow = (r: AttemptRow): Attempt => ({ cardId: r.card_id, correct: r.correct, phase: r.phase, missedLineKeys: r.missed_line_keys, presentLineKeys: r.present_line_keys, timedOut: r.timed_out, lineCount: r.line_count, ts: r.ts })
export const sessionFromRow = (r: DailySessionRow): SessionState => ({ session: sessionFromSlots(r.date, r.slots, r.deferred_review_ids, r.target, r.mode), index: Math.min(r.idx, r.slots.length), buffer: r.buffer, bufferIndex: Math.min(r.buffer_index, r.buffer.length), inBuffer: r.in_buffer })

export function createRepository(user: Pick<AppUser,'id'|'username'>): LearningRepository {
  const uid = user.id
  return {
    async load() {
      const [cards, categories, progress, attempts, session] = await Promise.all([
        allRows((a,b) => supabase.from('cards').select('*').eq('status','active').order('id').range(a,b)),
        allRows((a,b) => supabase.from('categories').select('*').order('sort_order').order('slug').range(a,b)),
        allRows((a,b) => supabase.from('srs_progress').select('*').eq('user_id',uid).order('card_id').range(a,b)),
        allRows((a,b) => supabase.from('attempts').select('*').eq('user_id',uid).order('id').range(a,b)),
        supabase.from('daily_sessions').select('*').eq('user_id',uid).maybeSingle().then(checked),
      ])
      return { cards: cards.map(cardFromRow), categories: categories.map(categoryFromRow), store: Object.fromEntries(progress.map(r => [r.card_id, entryFromRow(r)])), attempts: attempts.map(attemptFromRow), session: session ? sessionFromRow(session) : null }
    },
    async saveSession(s) {
      checked(await supabase.from('daily_sessions').upsert({ user_id: uid, date: s.session.date, slots: s.session.slots, idx: s.index, buffer: s.buffer, buffer_index: s.bufferIndex, in_buffer: s.inBuffer, deferred_review_ids: s.session.deferredReviewIds, target: s.session.target, mode: s.session.mode, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }))
    },
    async putProgress(cardId, e) {
      checked(await supabase.from('srs_progress').upsert({ user_id: uid, card_id: cardId, status: e.status, consecutive_correct: e.consecutiveCorrect, interval: e.interval, next_review_date: e.nextReviewDate, last_seen: e.lastSeen, flag_difficult: !!e.flagDifficult }, { onConflict: 'user_id,card_id' }))
    },
    async recordAttempt(a) {
      const existing = checked(await supabase.from('attempts').select('id').eq('user_id',uid).eq('card_id',a.cardId).eq('ts',a.ts).limit(1))
      if (existing?.length) return
      checked(await supabase.from('attempts').insert({ user_id: uid, card_id: a.cardId, correct: a.correct, phase: a.phase, missed_line_keys: a.missedLineKeys, present_line_keys: a.presentLineKeys, timed_out: a.timedOut, line_count: a.lineCount, ts: a.ts }))
    },
    async saveSettings(settings) { checked(await supabase.rpc('update_my_settings', { p_daily_target: settings.dailyTarget, p_mode: settings.mode, p_timed_mode: !!settings.timedMode })) },
    async report(card, category, message) {
      // Reports are insert-only for members: do not append .select().
      checked(await supabase.from('card_reports').insert({ user_id: uid, card_id: card.id, card_label: `${category?.name ?? ''} · ${compactAuction(card.auction)}`, reporter_label: user.username, message }))
    },
  }
}
