import { describe, expect, it } from 'vitest'
import { generateAdditionalSession } from './session'
import { inventedCard } from './testFixtures'
import { grade } from './grading'
import { getDefaultEntry } from './srs'
import type { SRSStore } from '../types'

const now = new Date(2026, 8, 28, 12)
const settings = {dailyTarget:5, mode:'balanced' as const}
const cards = Array.from({length:14}, (_,i)=>inventedCard(String(i)))
const due = {...getDefaultEntry(), status:'REVIEW' as const, consecutiveCorrect:2 as const, interval:9, nextReviewDate:'2026-09-27'}
describe('additional scheduled sessions',()=>{
  it('keeps quotas and priority, excludes every mode graded today and completed slots',()=>{
    const store:SRSStore={'0':{...due,status:'LEARNING',interval:1},'1':due,'2':{...due,nextReviewDate:'2026-09-26'},'3':due,'4':due,'5':due,'6':due,'7':due,'8':{...due,nextReviewDate:'2026-09-29'}}
    const attempts = (['main','buffer','free','hard'] as const).map((phase,i)=>grade(cards[i+4],[],false,phase,now))
    const queue=generateAdditionalSession(cards,store,settings,attempts,['1'],now)
    expect(queue.slots.slice(0,3)).toEqual([{cardId:'0',kind:'retry'},{cardId:'2',kind:'review'},{cardId:'3',kind:'review'}])
    expect(queue.newCount).toBe(2)
    expect(queue.slots.every(s=>!['1','4','5','6','7','8'].includes(s.cardId))).toBe(true)
    expect(generateAdditionalSession(cards,store,settings,attempts,['1'],now)).toEqual(queue)
  })
  it('older ratings do not exclude due reviews; drafts and future reviews stay out',()=>{
    const pool=cards.slice(0,4).map(c=>({...c}))
    pool[2].status='draft';pool[3].status='archived'
    const queue=generateAdditionalSession(pool,{'0':due,'1':{...due,nextReviewDate:'2026-09-29'}},settings,[grade(pool[0],[],false,'main',new Date(2026,8,27,12))],[],now)
    expect(queue.slots).toEqual([{cardId:'0',kind:'review'}])
  })
  it('returns a smaller last batch and then an empty queue without advancing future cards',()=>{
    const pool=cards.slice(0,2)
    const queue=generateAdditionalSession(pool,{'0':{...due,nextReviewDate:'2026-09-29'}},settings,[],[],now)
    expect(queue.slots).toEqual([{cardId:'1',kind:'new'}])
    expect(generateAdditionalSession(pool,{'0':{...due,nextReviewDate:'2026-09-29'}},settings,[grade(pool[1],[],false,'main',now)],['1'],now).slots).toEqual([])
  })
})
