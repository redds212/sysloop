import { describe, expect, it } from 'vitest'
import type { Card, LearningMode, SRSEntry, SRSStore } from '../types'
import { addDaysKey, daysBetween, todayKey, toDateKey } from './date'
import { applyAnswer, finalizeBuffer, getDefaultEntry, isReviewDue, isRetryDue, normalizeEntry } from './srs'
import { adaptSession, generateDailySession, modeSplit } from './session'
import { answerSession, currentCardId, rateVisit, repeatVisit, restoreSession, startSession, adaptSessionState } from './sessionState'
import { errorNoun, grade } from './grading'
import { hardLines } from './lineStats'
import { timerIsAmber, timerLimit } from './timer'
import { changedSinceLoad, progressAfterEdit, revisionReviewDay, stampChangedLines } from './contentChanges'
import { inventedCard, inventedLine } from './testFixtures'

const now = new Date(2026, 8, 16, 12)
const base = getDefaultEntry()
const settings = { dailyTarget: 10, mode: 'balanced' as const }
const cards = (n: number): Card[] => Array.from({length:n},(_,i)=>inventedCard(String(i)))
const due = (date = '2026-09-15'): SRSEntry => ({status:'REVIEW',consecutiveCorrect:2,interval:9,nextReviewDate:date,lastSeen:'2026-09-06T10:00:00Z'})
describe('SRS and calendar dates', () => {
  it.each([[0,3,'REVIEW'],[1,9,'REVIEW'],[2,27,'REVIEW'],[3,81,'MASTERED'],[4,160,'MASTERED'],[5,160,'MASTERED']] as const)('pass from step %i', (step,interval,status) => {
    const result = applyAnswer({...base,consecutiveCorrect:step},true,now)
    expect(result).toMatchObject({status,interval,consecutiveCorrect:Math.min(step+1,5),nextReviewDate:addDaysKey(interval,now)})
  })
  it.each([0,1,2,3,4,5])('failure at step %i returns tomorrow', step => {
    expect(applyAnswer({...base,consecutiveCorrect:step},false,now)).toMatchObject({status:'LEARNING',interval:1,consecutiveCorrect:0,nextReviewDate:'2026-09-17'})
  })
  it.each([true,false])('buffer result %s resets regardless of grade', correct => {
    expect(finalizeBuffer(due(),correct,now)).toMatchObject({status:'LEARNING',nextReviewDate:'2026-09-17',consecutiveCorrect:0,flagDifficult:correct?undefined:true})
  })
  it('mastered cards remain due; legacy retired state gets a date', () => {
    expect(isReviewDue({...due(),status:'MASTERED'},now)).toBe(true)
    expect(normalizeEntry({status:'MASTERED',lastSeen:now.toISOString()}).nextReviewDate).toBe(addDaysKey(81,now))
    expect(isRetryDue({...due(),status:'LEARNING',interval:1},now)).toBe(true)
    expect(isRetryDue(due(),now)).toBe(false)
    expect(isReviewDue({...due(),nextReviewDate:'2026-09-17'},now)).toBe(false)
  })
  it('uses local calendar days including month and DST boundaries', () => {
    expect(todayKey(new Date(2026,0,1,0,5))).toBe('2026-01-01')
    expect(addDaysKey(1,new Date(2026,0,31,23))).toBe('2026-02-01')
    expect(daysBetween('2026-03-28','2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24','2026-10-26')).toBe(2)
    expect(toDateKey('invalid')).toBeNull()
  })
})
describe('daily queue and resume', () => {
  it.each([['maintenance',8,2],['balanced',6,4],['intensive',3,7]] as const)('mode %s', (mode,reviewLimit,newLimit) => expect(modeSplit({...settings,mode})).toEqual({reviewLimit,newLimit}))
  it('retries consume quota and can crowd out all new cards', () => {
    const pool = cards(20), store: SRSStore = {}
    for (const c of pool.slice(0,12)) store[c.id] = {...due(),status:'LEARNING',interval:1}
    const q = generateDailySession(pool,store,settings,now)
    expect(q.slots).toHaveLength(10); expect(q.retryCount).toBe(10); expect(q.newCount).toBe(0)
  })
  it('orders retry then most-overdue reviews then new; reports deferred reviews', () => {
    const pool = cards(20), store: SRSStore = {'0':{...due(),status:'LEARNING',interval:1}}
    for (let i=1;i<10;i++) store[String(i)] = due(`2026-09-${String(i).padStart(2,'0')}`)
    const q = generateDailySession(pool,store,settings,now)
    expect(q.slots.slice(0,6).map(s=>s.cardId)).toEqual(['0','1','2','3','4','5'])
    expect(q.newCount).toBe(4); expect(q.deferredReviewIds).toEqual(['6','7','8','9'])
  })
  it('fills unused review quota with new, but never fills unused new quota with excess reviews', () => {
    expect(generateDailySession(cards(20),{},settings,now).newCount).toBe(10)
    const store: SRSStore = Object.fromEntries(cards(20).map(c=>[c.id,due()]))
    expect(generateDailySession(cards(20),store,settings,now).slots).toHaveLength(6)
  })
  it('excludes nonactive, future and previously attempted NEW cards', () => {
    const pool = cards(5); pool[1].status='draft'; pool[2].status='archived'
    const q = generateDailySession(pool,{'3':due('2026-10-01')},settings,now,new Set(['4']))
    expect(q.slots.map(s=>s.cardId)).toEqual(['0'])
  })
  it('shuffles reproducibly per day across the whole pool', () => {
    const first = generateDailySession(cards(100),{},settings,now)
    expect(generateDailySession(cards(100),{},settings,now)).toEqual(first)
    expect(generateDailySession(cards(100),{},settings,new Date(2026,8,17)).slots).not.toEqual(first.slots)
    expect(first.slots.map(s=>s.cardId)).not.toEqual(cards(10).map(c=>c.id))
  })
  it('target changes preserve completed slots and do not duplicate cards', () => {
    const q = generateDailySession(cards(30),{},settings,now)
    const grown = adaptSession(q,4,cards(30),{},{...settings,dailyTarget:20},now)
    expect(grown.slots.slice(0,10)).toEqual(q.slots)
    expect(new Set(grown.slots.map(s=>s.cardId)).size).toBe(20)
    expect(adaptSession(grown,4,cards(30),{},{...settings,dailyTarget:2},now).slots).toHaveLength(4)
    expect(adaptSession(q,0,cards(30),{},settings,now)).toBe(q)
  })
  it('mode changes use the reference queue adaptation and buffer settings wait', () => {
    const q = generateDailySession(cards(30),{},settings,now)
    const next = adaptSession(q,2,cards(30),{},{...settings,mode:'intensive' as LearningMode},now)
    expect(next.mode).toBe('intensive'); expect(next.slots).toEqual(q.slots)
    const buffer = {...startSession(q),inBuffer:true,buffer:['0']}
    expect(adaptSessionState(buffer,cards(30),{},{...settings,dailyTarget:30},now)).toBe(buffer)
  })
  it('main miss writes no SRS, enters buffer once, then fail returns tomorrow', () => {
    const card = inventedCard('one')
    const q = generateDailySession([card],{},settings,now)
    const miss = answerSession(startSession(q),grade(card,['6H'],false,'main',now),base,now)
    expect(miss.progress).toBeNull(); expect(miss.state.buffer).toEqual(['one'])
    const end = answerSession(miss.state,grade(card,['6H'],false,'buffer',now),base,now)
    expect(end.progress?.flagDifficult).toBe(true); expect(currentCardId(end.state)).toBeNull()
  })
  it('main pass writes immediately and buffer pass still returns tomorrow', () => {
    const card = inventedCard('one'), q = generateDailySession([card],{},settings,now)
    expect(answerSession(startSession(q),grade(card,[],false,'main',now),base,now).progress?.interval).toBe(3)
    const state = {...startSession(q),inBuffer:true,buffer:['one']}
    expect(answerSession(state,grade(card,[],false,'buffer',now),base,now).progress?.interval).toBe(1)
  })
  it('round trips snapshots, expires at midnight, skips archived cards even if none remain', () => {
    const pool = cards(3), q = generateDailySession(pool,{},settings,now), state = startSession(q)
    expect(restoreSession(JSON.parse(JSON.stringify(state)),pool,now)).toEqual(state)
    expect(restoreSession(state,pool,new Date(2026,8,17))).toBeNull()
    expect(currentCardId(restoreSession(state,[],now)!)).toBeNull()
  })
  it('free practice reratings never stack; repeat reverts a pass and retains a fail', () => {
    const first = rateVisit(base,true,now), again = rateVisit(base,true,now)
    expect(first).toEqual(again); expect(first.consecutiveCorrect).toBe(1)
    expect(repeatVisit(base,first,true)).toEqual(base)
    const failed = rateVisit(base,false,now)
    expect(repeatVisit(base,failed,false)).toEqual(failed)
  })
})
describe('timer, grading, per-line statistics', () => {
  it.each([[8,0,48],[8,4,24],[8,5,24],[20,0,120],[2,0,15],[2,5,15],[7,3,25],[8,1,40],[8,2,32]])('%i lines at level %i → %i seconds', (count,level,expected)=>expect(timerLimit(count,level)).toBe(expected))
  it('amber only in the final ten seconds', ()=>{expect(timerIsAmber(10)).toBe(true);expect(timerIsAmber(11)).toBe(false);expect(timerIsAmber(0)).toBe(false)})
  it('passes only with zero misses; timeout records null misses and all present keys', () => {
    const c = inventedCard()
    expect(grade(c,[],false,'free',now).correct).toBe(true)
    expect(grade(c,['6H'],false,'free',now).correct).toBe(false)
    expect(grade(c,[],true,'free',now)).toMatchObject({correct:false,missedLineKeys:null,presentLineKeys:['6H'],lineCount:1})
    expect(()=>grade(c,['bogus'],false,'free',now)).toThrow()
  })
  it.each([[1,'błąd'],[2,'błędy'],[4,'błędy'],[5,'błędów'],[12,'błędów'],[14,'błędów'],[21,'błędów'],[22,'błędy'],[114,'błędów']])('Polish count %i', (n,word)=>expect(errorNoun(Number(n))).toBe(word))
  it('counts last five graded appearances only when line existed, skips timeouts and removed lines', () => {
    const c = inventedCard(), withAdded = {...c,lines:[inventedLine('6H'),inventedLine('6S')]}
    const attempts = Array.from({length:8},(_,i)=>grade(i<4?c:withAdded, i===1||i===3||i===5||i===7?['6H']:[],false,'free',new Date(2026,8,i+1)))
    attempts.push(grade(withAdded,[],true,'free',new Date(2026,8,15)))
    const hard = hardLines([withAdded],attempts)
    expect(hard).toHaveLength(1);expect(hard[0]).toMatchObject({misses:3,appearances:5,line:{key:'6H'}})
    expect(hardLines([{...c,lines:[inventedLine('6S')]}],attempts)).toEqual([])
    expect(hardLines([{...c,status:'archived'}],attempts)).toEqual([])
  })
  it('two misses suffice with fewer than five appearances; sorts by misses then recent miss', () => {
    const a = inventedCard('a'), b = inventedCard('b')
    const attempts = [grade(a,['6H'],false,'free',new Date(2026,8,1)),grade(a,['6H'],false,'free',new Date(2026,8,2)),grade(b,['6H'],false,'free',new Date(2026,8,3)),grade(b,['6H'],false,'free',new Date(2026,8,4))]
    expect(hardLines([a,b],attempts).map(h=>h.cardId)).toEqual(['b','a'])
  })
})
describe('content revisions', () => {
  it.each([
    ['2026-09-16T21:59:59Z','2026-09-17'],['2026-09-16T22:00:00Z','2026-09-18'],
    ['2026-03-28T23:30:00Z','2026-03-30'],['2026-10-24T22:30:00Z','2026-10-26'],
  ])('Warsaw tomorrow for %s', (input,expected)=>expect(revisionReviewDay(new Date(input))).toBe(expected))
  it('pulls future dates forward without changing step, leaves new/null/earlier dates', () => {
    expect(progressAfterEdit(due('2027-01-01'),true,now)).toEqual({...due('2027-01-01'),nextReviewDate:'2026-09-17'})
    for (const entry of [base,due('2026-09-16'),due('2026-09-17'),{...due(),nextReviewDate:null}]) expect(progressAfterEdit(entry,true,now)).toBe(entry)
    const old = due('2027-01-01'); expect(progressAfterEdit(old,false,now)).toBe(old)
  })
  it('stamps only changed/added lines; cosmetic edits preserve old markers', () => {
    const old = [inventedLine('6C'),inventedLine('6D'),inventedLine('6H')]
    const next = [old[0],inventedLine('6D','Zmienione fikcyjne znaczenie'),inventedLine('6S')]
    const changed = stampChangedLines(old,next,true,'test2',now)
    expect(changed[0].changedAt).toBeUndefined(); expect(changed[1].changedIn).toBe('test2'); expect(changed[2].changedAt).toBe(now.toISOString())
    expect(stampChangedLines(changed,changed.map(l=>({...l,meaning:l.meaning+' '})),false,'test3',new Date())).toMatchObject(changed.map(l=>({...l,meaning:l.meaning+' '})))
    expect(changedSinceLoad(changed[1],'2026-09-01T10:00:00Z')).toBe(true)
    expect(changedSinceLoad(changed[1],now.toISOString())).toBe(false)
    expect(changedSinceLoad(changed[1],null)).toBe(false)
  })
})
