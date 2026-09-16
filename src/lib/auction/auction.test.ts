import { describe, expect, it } from 'vitest'
import { auctionKey, call, cardKey, normalizeAlternatives, normalizeAuction, normalizeToken } from './normalize'
import { auctionGrid, compactAuction } from './display'
import { auctionMatches, tokenMatches } from './match'
import { buildAuctionIndex } from './index'
import { inventedCard, inventedLine } from '../testFixtures'

const w = (s: string, q?: string) => call(s, 'we', q)
const t = (s: string, q?: string) => call(s, 'they', q)
describe('SPEC §5.1 — each table row, with invented auctions substituted', () => {
  it.each([
    ['row 1: two columns', [w('2♣'), w('2♦')], '2C (P) 2D (P)'],
    ['row 2: multirow', [w('2♣'), w('2♦'), w('2♥'), w('3♣'), w('3♦')], '2C (P) 2D (P) 2H (P) 3C (P) 3D (P)'],
    ['row 3: four columns', [t('2♦'), w('ktr'), t('pas'), w('2♥'), t('pas'), w('2♠'), t('pas')], '(2D) X (P) 2H (P) 2S (P)'],
    ['row 4: nonbid alternatives', [t('2NT'), w('x'), t('pass/xx')], '(2NT) X (P/XX)'],
    ['row 5: inherited level', [t('2NT'), w('pass'), t('5♣/♦/♥')], '(2NT) P (5C/5D/5H)'],
    ['row 6: sides from columns', [w('3♥'), t('ktr')], '3H (X)'],
    ['row 7: qualified header', [w('2♣'), t('pas'), w('2♦'), t('ktr', 'FIKCYJNE')], '2C (P) 2D (X[FIKCYJNE])'],
    ['row 8: wildcard', [t('2♦'), w('pas'), t('WYŻSZE')], '(2D) P (*)'],
    ['row 9: summary', [t('2♥'), w('3♥')], '(2H) 3H (P)'],
    ['row 10: root', [w('5♣')], '5C (P)'],
    ['row 11: alternative roots', [w('4♥/♠')], '4H/4S (P)'],
  ])('%s', (_name, input, expected) => expect(auctionKey(normalizeAuction(input))).toBe(expected))
  it.each([['1 NT','1NT'],['3 BA','3NT'],['p','P'],['PAS','P'],['pass','P'],['KTR','X'],['x','X'],['RKTR','XX'],['xx','XX'],['WYŻSZE','*'],['1X','1*']])('alias %s', (input, expected) => expect(normalizeToken(input)).toBe(expected))
  it('normalizes mixed alternatives, removes duplicates and carries levels', () => {
    expect(normalizeAlternatives('KTR /5♦')).toEqual(['X','5D'])
    expect(normalizeAlternatives('6♥/♠/♥')).toEqual(['6H','6S'])
  })
  it('rejects unknown tokens and empty alternatives', () => {
    expect(() => normalizeToken('?')).toThrow()
    expect(() => normalizeAlternatives('4H/')).toThrow()
    expect(() => normalizeAuction([{side:'we',alts:[]}])).toThrow()
  })
  it('inserts our pass between opponents and preserves leading written passes', () => {
    expect(auctionKey(normalizeAuction([w('P'),t('3C'),t('3D')]))).toBe('P (3C) P (3D)')
  })
  it('is idempotent and never appends a pass to a query strip', () => {
    const a = normalizeAuction([w('5D')])
    expect(normalizeAuction(a)).toEqual(a)
    expect(normalizeAuction([w('5D')], false)).toHaveLength(1)
  })
  it('identity retains qualifiers, context and duplicate suffixes', () => {
    expect(cardKey('test', [t('X','A')],'warunek',2)).toBe('test|(X[A])|warunek#2')
    expect(cardKey('test',[t('X','A')])).not.toBe(cardKey('test',[t('X','B')]))
  })
  it('compact display hides only implicit passes; grids align sides', () => {
    const a = normalizeAuction([w('4C'),w('4D')])
    expect(compactAuction(a)).toBe('4♣–4♦')
    expect(auctionGrid(a)[0]).toHaveLength(2)
    const b = normalizeAuction([t('4NT'),w('X'),t('P'),w('XX')])
    expect(compactAuction(b)).toBe('(4NT)–ktr–(pas)–rktr')
    expect(auctionGrid(b)[0]).toHaveLength(4)
  })
})
describe('matching and search', () => {
  it.each(['P','X','XX'])('wildcards never match %s', token => expect(tokenMatches('*',token)).toBe(false))
  it('matches same-side alternatives and level wildcards, ignores qualifier and implicit markers', () => {
    expect(tokenMatches('4*','4NT')).toBe(true)
    expect(tokenMatches('4*','5H')).toBe(false)
    expect(auctionMatches([t('4C/D','A')],[t('4D','B')])).toBe(true)
    expect(auctionMatches([t('P')],[{...t('P'),implicit:true}])).toBe(true)
    expect(auctionMatches([t('P')],[w('P')])).toBe(false)
  })
  it('returns three groups, highlighting the documented last call', () => {
    const parent = inventedCard('parent',[w('4D')]); parent.lines = [inventedLine('4S')]
    const next = inventedCard('next',[w('4D'),w('4S')])
    const deeper = inventedCard('deeper',[w('4D'),w('4S'),w('5NT')])
    const r = buildAuctionIndex([parent,next,deeper]).search([w('4D'),w('4S')])
    expect(r.meanings.map(h => h.lineKey)).toEqual(['4S'])
    expect(r.next.map(h => h.card.id)).toEqual(['next'])
    expect(r.continuations.map(h => h.card.id)).toEqual(['deeper'])
  })
  it('never returns a meaning for an opponents call', () => {
    expect(buildAuctionIndex([inventedCard('a',[w('4D')])]).search([w('4D'),t('4H')]).meanings).toEqual([])
  })
  it('keeps context/qualifier variants and excludes draft/archived', () => {
    const a = inventedCard('a',[w('4NT'),t('X','a')])
    const b = {...inventedCard('b',[w('4NT'),t('X','b')]),context:'inny warunek'}
    const c = {...a,id:'c',status:'archived' as const}, d = {...a,id:'d',status:'draft' as const}
    expect(buildAuctionIndex([a,b,c,d]).search([w('4NT'),t('X')]).next.map(h=>h.card.id)).toEqual(['a','b'])
  })
  it('exact siblings suppress wildcard branches even when later calls do not match', () => {
    const wildcard = inventedCard('wild',[w('4D'),t('*'),w('5H')])
    const exact = inventedCard('exact',[w('4D'),t('4S'),w('5C')])
    const index = buildAuctionIndex([wildcard,exact])
    expect(index.matching(normalizeAuction([w('4D'),t('4S'),w('5H')]))).toEqual([])
    expect(index.matching(normalizeAuction([w('4D'),t('4H'),w('5H')])).map(c=>c.id)).toEqual(['wild'])
  })
  it('retries without leading passes and otherwise uses a literal longest prefix', () => {
    const card = inventedCard('root',[w('4D')]); card.lines = [inventedLine('4S')]
    const idx = buildAuctionIndex([card])
    expect(idx.search([w('P'),t('P'),w('4D')]).fallback).toBe('leading-passes')
    expect(idx.search([w('4D'),w('5C'),w('5D')]).prefix[0].card.id).toBe('root')
    expect(idx.search([w('4D'),t('4H')]).fallback).toBe('empty')
    expect(idx.search([w('7NT')]).fallback).toBe('empty')
  })
  it('limits continuations to 20, shortest first, and searches 1000 invented cards', () => {
    const cards = Array.from({length:1000},(_,i)=>inventedCard(String(i),[w('4D'),w(i%2?'5C':'5H'),...Array.from({length:i%5},()=>w('P'))]))
    const idx = buildAuctionIndex(cards)
    const start = performance.now(); const r = idx.search([w('4D')]); const elapsed = performance.now()-start
    expect(r.continuations).toHaveLength(20)
    expect(r.continuations[0].card.auction.length).toBe(4)
    expect(elapsed).toBeLessThan(50)
  })
})
