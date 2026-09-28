import { auctionKey, cardKey, normalizeAlternatives, normalizeAuction } from '../lib/auction/normalize'
import type { CardRow } from '../lib/database.types'
import type { CardLine, Side } from '../types'
import type { ImportChange, ImportDecisions, ImportRun, ImportSummary } from './types'

/** A version expires when the next version is applied, not when it is uploaded. */
export function supersededAt(run: ImportSummary, runs: readonly ImportSummary[]): string | null {
  if (run.status !== 'applied' || !run.applied_at) return null
  const applied = runs.filter(r=>r.category_slug===run.category_slug&&r.status==='applied'&&r.applied_at)
    .sort((a,b)=>Date.parse(a.applied_at!)-Date.parse(b.applied_at!)||a.id.localeCompare(b.id))
  const index = applied.findIndex(r=>r.id===run.id)
  return index < 0 ? null : applied[index+1]?.applied_at ?? null
}

export function undecidedRemovals(run: ImportRun, decisions: ImportDecisions): ImportChange[] {
  return run.proposal.changes.filter(c=>c.kind==='removed'&&typeof decisions[c.cardKey]?.skip!=='boolean'
    && !Object.values(decisions).some(d=>d.linkTo===c.cardKey&&!d.skip))
}

export function requireRemovalDecisions(run: ImportRun, decisions: ImportDecisions) {
  if (undecidedRemovals(run,decisions).length) throw new Error('Zdecyduj, czy zachować, czy archiwizować każdą sekwencję, która zniknęła z PDF.')
}

export function importLineDiff(change: ImportChange, current: CardRow | undefined, pending: boolean) {
  // Applied imports must not compare their proposal against today's (already updated) card.
  const before = pending ? current?.lines??change.oldRaw?.lines??[] : change.oldRaw?.lines??[]
  const after = change.kind==='removed'?[]:change.kind==='unchanged'?before:
    pending?effectiveLines(change,current):change.card?.lines??change.newRaw?.lines??[]
  return lineDiff(before,after)
}

export interface CallDraft { side: Side; text: string; qualifier: string; implicit?: true }
export interface LineDraft { key: string; label: string; bids: string; meaning: string }
export function prepareCard(original: CardRow, edited: CardRow, calls: CallDraft[], lines: LineDraft[], siblings: CardRow[]): CardRow {
  if (!lines.length) throw new Error('Karta musi mieć przynajmniej jedną odzywkę.')
  if (!calls.length && edited.status === 'active') throw new Error('Uzupełnij licytację przed zatwierdzeniem karty.')
  const auction = normalizeAuction(calls.map(c => ({side:c.side, alts:normalizeAlternatives(c.text), ...(c.qualifier ? {qualifier:c.qualifier} : {}), ...(c.implicit ? {implicit:true as const} : {})})))
  const key = auctionKey(auction)
  const identityChanged = key !== original.auction_key || edited.context !== original.context
  const identity = identityChanged ? cardKey(edited.category_slug, auction, edited.context ?? undefined) : original.card_key
  if (siblings.some(c => c.id !== original.id && c.card_key === identity)) throw new Error('Taka pozycja już istnieje. Sprawdź licytację i kontekst.')
  // Existing line identities survive reorder and text fixes. New/rebid lines cannot reuse history keys.
  const reserved = new Set(original.lines.map(l => l.key))
  const used = new Set<string>()
  const prepared = lines.map(l => {
    if (!l.label.trim() || !l.meaning.trim()) throw new Error('Każda odzywka wymaga etykiety i znaczenia.')
    const bids = normalizeAlternatives(l.bids)
    const previous = original.lines.find(old => old.key === l.key)
    let lineKey = l.key
    if (!previous || JSON.stringify(previous.bids) !== JSON.stringify(bids)) {
      const base = bids.join('/'); let n = 1; lineKey = base
      while (reserved.has(lineKey) || used.has(lineKey)) lineKey = `${base}#${++n}`
    }
    if (used.has(lineKey)) throw new Error('Odzywki mają powtórzony identyfikator.')
    used.add(lineKey)
    return {key:lineKey, label:l.label, bids, meaning:l.meaning}
  })
  const flags=edited.status==='draft'&&!edited.review_flags.length&&!edited.verification_note?.trim()?['verifier_uncertain']:edited.review_flags
  return {...edited, auction, auction_key:key, card_key:identity, lines:prepared, review_flags:flags}
}

/** Mirrors raw-vs-raw merging in apply_import_run; never overwrites unchanged database corrections. */
export function effectiveLines(change: ImportChange, current?: CardRow): CardLine[] {
  return (change.card?.lines ?? []).map(line => {
    const old = change.oldRaw?.lines.find(l => l.key === line.key)
    const next = change.newRaw?.lines.find(l => l.key === line.key)
    const stored = current?.lines.find(l => l.key === line.key)
    return old && next && stored && sameLine(old,next) ? stored : line
  })
}
export function sameLine(a: CardLine, b: CardLine): boolean {
  return a.key===b.key && a.label===b.label && a.meaning===b.meaning && JSON.stringify(a.bids)===JSON.stringify(b.bids)
}
export function lineDiff(before: CardLine[], after: CardLine[]) {
  return [...new Set([...after.map(l=>l.key),...before.map(l=>l.key)])].map(key => {
    const old = before.find(l=>l.key===key), next = after.find(l=>l.key===key)
    return {key, old, next, kind:!old?'added':!next?'removed':sameLine(old,next)?'unchanged':'changed'}
  })
}
