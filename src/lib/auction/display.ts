import type { AuctionCall } from '../../types'

const symbols: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠', P: 'pas', X: 'ktr', XX: 'rktr' }
export function displayToken(token: string): string {
  return symbols[token] ?? token.replace(/[CDHS]$/, suit => symbols[suit])
}
export function compactAuction(auction: readonly AuctionCall[]): string {
  return auction.filter(c => !c.implicit).map(c => {
    const text = c.alts.map(displayToken).join('/') + (c.qualifier ? ` [${c.qualifier}]` : '')
    return c.side === 'they' ? `(${text})` : text
  }).join('–')
}
/** Grid cells retain implicit passes for alignment; the UI dims those cells. */
export function auctionGrid(auction: readonly AuctionCall[]): AuctionCall[][] {
  const contested = auction.some(c => c.side === 'they' && !c.implicit)
  const cells = contested ? [...auction] : auction.filter(c => !c.implicit)
  const width = contested ? 4 : 2
  return Array.from({ length: Math.ceil(cells.length / width) }, (_, i) => cells.slice(i * width, (i + 1) * width))
}
