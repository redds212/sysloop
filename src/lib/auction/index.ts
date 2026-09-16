import type { AuctionCall, Card } from '../../types'
import { normalizeAuction } from './normalize'
import { callMatches } from './match'

export interface SearchHit { card: Card; lineKey?: string }
export interface SearchResult {
  meanings: SearchHit[]; next: SearchHit[]; continuations: SearchHit[]; prefix: SearchHit[];
  fallback: 'none' | 'leading-passes' | 'prefix' | 'empty'; message?: string
}
export const SEARCH_HELP = 'Wyszukiwanie nie śledzi odsyłaczy ani analogii „system on”; nie wywnioskuje pozycji przy stole ani założeń.'

/** First-call buckets bound scans; exact branches shadow wildcard siblings at every depth. */
export function buildAuctionIndex(input: readonly Card[]) {
  const cards = input.filter(c => c.status === 'active')
  const first = new Map<string, Set<Card>>()
  for (const card of cards) {
    for (const token of card.auction[0]?.alts ?? []) {
      const key = `${card.auction[0].side}:${token}`
      if (!first.has(key)) first.set(key, new Set())
      first.get(key)!.add(card)
    }
  }
  function matching(query: readonly AuctionCall[]): Card[] {
    if (!query.length) return cards
    const head = query[0]
    const keys = head.alts.flatMap(t => [`${head.side}:${t}`, `${head.side}:*`, `${head.side}:${t[0]}*`])
    let pool = [...new Set(keys.flatMap(k => [...(first.get(k) ?? [])]))]
    for (let i = 0; i < query.length; i++) {
      const q = query[i]
      pool = pool.filter(c => c.auction[i] && callMatches(c.auction[i], q))
      const exact = pool.filter(c => q.alts.every(t => c.auction[i].alts.includes(t)))
      if (exact.length) pool = exact
    }
    return pool
  }
  function groups(inputCalls: readonly AuctionCall[]): SearchResult {
    const query = normalizeAuction(inputCalls, false)
    const position = normalizeAuction(inputCalls)
    const full = matching(position)
    const last = query.at(-1)
    const meanings = last?.side === 'we' ? matching(query.slice(0, -1))
      .filter(c => c.auction.length === query.length - 1)
      .flatMap(card => card.lines.filter(line => last.alts.every(t => line.bids.includes(t)))
        .map(line => ({ card, lineKey: line.key }))) : []
    return { meanings, next: full.filter(c => c.auction.length === position.length).map(card => ({ card })),
      continuations: full.filter(c => c.auction.length > position.length)
        .sort((a, b) => a.auction.length - b.auction.length || a.sortOrder - b.sortOrder)
        .slice(0, 20).map(card => ({ card })), prefix: [], fallback: 'none' }
  }
  const hasHits = (r: SearchResult) => r.meanings.length + r.next.length + r.continuations.length > 0
  function search(inputCalls: readonly AuctionCall[]): SearchResult {
    if (!inputCalls.length) return { meanings: [], next: [], continuations: [], prefix: [], fallback: 'empty', message: 'Wprowadź sekwencję.' }
    let query = normalizeAuction(inputCalls, false)
    let result = groups(query)
    if (hasHits(result)) return result
    let trimmed = false
    while (query[0]?.alts.length === 1 && query[0].alts[0] === 'P') { query = query.slice(1); trimmed = true }
    if (trimmed && query.length) {
      result = groups(query)
      if (hasHits(result)) return { ...result, fallback: 'leading-passes', message: 'bez pasów na początku' }
    }
    for (let n = query.length; n > 0; n--) {
      const prefix = matching(query.slice(0, n)).filter(c => c.auction.length === n)
      if (prefix.length) return { ...result, fallback: 'prefix', prefix: prefix.map(card => ({ card })),
        message: `${trimmed ? 'bez pasów na początku · ' : ''}Notatki kończą się tutaj — dalszej sekwencji nie ma w systemie` }
    }
    return { ...result, fallback: 'empty', message: 'Brak tej sekwencji w notatkach.' }
  }
  return { search, matching, size: cards.length }
}
