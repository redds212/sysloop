import type { AuctionCall } from '../../types'
export function tokenMatches(pattern: string, query: string): boolean {
  if (pattern === query) return true
  if (!/^[1-7](?:[CDHS]|NT)$/.test(query)) return false
  return pattern === '*' || (/^[1-7]\*$/.test(pattern) && pattern[0] === query[0])
}
export function callMatches(pattern: AuctionCall, query: AuctionCall): boolean {
  return pattern.side === query.side && query.alts.every(q => pattern.alts.some(p => tokenMatches(p, q)))
}
export function auctionMatches(pattern: readonly AuctionCall[], query: readonly AuctionCall[], prefix = false): boolean {
  return (prefix ? pattern.length >= query.length : pattern.length === query.length)
    && query.every((c, i) => callMatches(pattern[i], c))
}
