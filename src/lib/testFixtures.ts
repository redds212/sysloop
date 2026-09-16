// Entirely invented fixtures; never load PDFs or parsed content here.
import type { AuctionCall, Card, CardLine } from '../types'
import { auctionKey, normalizeAuction } from './auction/normalize'
export const inventedLine = (key = '6H', meaning = 'Znaczenie wymyślone do testu'): CardLine => ({ key, label: key, bids: [key], meaning })
export function inventedCard(id = 'fictional', calls: AuctionCall[] = []): Card {
  const auction = normalizeAuction(calls)
  return { id, categorySlug: 'fictional', section: 'SEKCJA TESTOWA', sortOrder: 0, auction,
    auctionKey: auctionKey(auction), notes: [], lines: [inventedLine()], status: 'active',
    reviewFlags: [], sourcePage: 1, sourceRevision: 'test' }
}
