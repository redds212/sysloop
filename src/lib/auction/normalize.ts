import type { AuctionCall, Side } from '../../types'

const suits: Record<string, string> = { '♣': 'C', '♦': 'D', '♥': 'H', '♠': 'S' }
const aliases: Record<string, string> = { PAS: 'P', PASS: 'P', KTR: 'X', RKTR: 'XX', 'WYŻSZE': '*' }
export function normalizeToken(raw: string): string {
  const text = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/[♣♦♥♠]/g, s => suits[s]).replace(/BA$/, 'NT')
  const token = aliases[text] ?? text.replace(/^([1-7])X$/, '$1*')
  if (!/^(?:[1-7](?:[CDHS]|NT|\*)|P|X|XX|\*)$/.test(token)) throw new Error('Nieznana odzywka')
  return token
}
export function normalizeAlternatives(raw: string): string[] {
  let level = ''
  return [...new Set(raw.split('/').map(part => {
    let text = part.trim()
    if (/^[1-7]/.test(text)) level = text[0]
    else if (/^(?:[♣♦♥♠CDHS]|NT|BA)$/i.test(text) && level) text = level + text
    return normalizeToken(text)
  }))]
}
export const opposite = (side: Side): Side => side === 'we' ? 'they' : 'we'
export function call(raw: string, side: Side = 'we', qualifier?: string): AuctionCall {
  return { side, alts: normalizeAlternatives(raw), ...(qualifier ? { qualifier } : {}) }
}
/** Query strips use beforeQuestion=false; position keys use the default. */
export function normalizeAuction(input: readonly AuctionCall[], beforeQuestion = true): AuctionCall[] {
  const result: AuctionCall[] = []
  for (const entry of input) {
    if (!entry.alts.length) throw new Error('Pusta odzywka')
    if (result.at(-1)?.side === entry.side) result.push({ side: opposite(entry.side), alts: ['P'], implicit: true })
    result.push({ ...entry, alts: [...new Set(entry.alts.map(normalizeToken))] })
  }
  if (beforeQuestion && result.at(-1)?.side === 'we') result.push({ side: 'they', alts: ['P'], implicit: true })
  return result
}
export function auctionKey(auction: readonly AuctionCall[]): string {
  return auction.map(c => {
    const value = c.alts.join('/') + (c.qualifier ? `[${c.qualifier}]` : '')
    return c.side === 'they' ? `(${value})` : value
  }).join(' ')
}
export function cardKey(categorySlug: string, auction: readonly AuctionCall[], context?: string, occurrence = 1): string {
  return `${categorySlug}|${auctionKey(auction)}${context ? `|${context}` : ''}${occurrence > 1 ? `#${occurrence}` : ''}`
}
