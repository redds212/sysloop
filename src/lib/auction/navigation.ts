import type { Card, CardLine } from '../../types'
import { normalizeAuction } from './normalize'
import { auctionMatches } from './match'
export function continuationCards(card: Card, line: CardLine, cards: readonly Card[]): Card[] {
  return cards.filter(candidate=>candidate.status==='active' && line.bids.some(bid=>auctionMatches(candidate.auction,normalizeAuction([...card.auction,{side:'we',alts:[bid]}]))))
}
export function parentCards(card: Card, cards: readonly Card[]): Card[] {
  return cards.filter(candidate=>candidate.status==='active'&&candidate.auction.length<card.auction.length&&candidate.lines.some(line=>continuationCards(candidate,line,[card]).length>0))
}
