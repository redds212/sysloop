import type { CardLine, SRSEntry } from '../types'

export function revisionReviewDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => Number(parts.find(p => p.type === type)!.value)
  // UTC is only arithmetic on already selected Warsaw calendar fields.
  const day = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + 1))
  return day.toISOString().slice(0, 10)
}
export function progressAfterEdit(entry: SRSEntry, substantive: boolean, now = new Date()): SRSEntry {
  const tomorrow = revisionReviewDay(now)
  return substantive && entry.status !== 'NEW' && entry.nextReviewDate && entry.nextReviewDate > tomorrow
    ? { ...entry, nextReviewDate: tomorrow } : entry
}
export function changedSinceLoad(line: CardLine, lastSeen: string | null): boolean {
  return !!line.changedAt && !!lastSeen && Date.parse(line.changedAt) > Date.parse(lastSeen)
}
export function stampChangedLines(previous: readonly CardLine[], next: readonly CardLine[], substantive: boolean, revision: string, now = new Date()): CardLine[] {
  return next.map(line => {
    const old = previous.find(l => l.key === line.key)
    const clean: CardLine = { key: line.key, label: line.label, bids: [...line.bids], meaning: line.meaning }
    const changed = !old || old.label !== line.label || old.meaning !== line.meaning || JSON.stringify(old.bids) !== JSON.stringify(line.bids)
    if (substantive && changed) return { ...clean, changedIn: revision, changedAt: now.toISOString() }
    return { ...clean, ...(old?.changedAt ? { changedAt: old.changedAt } : {}), ...(old?.changedIn ? { changedIn: old.changedIn } : {}) }
  })
}
