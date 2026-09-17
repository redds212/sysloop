import { describe, expect, it } from 'vitest'
import { unfinishedCorrections } from './dayRollover'
import { previewData } from '../dev/fixtures'
import { grade } from './grading'
const answerAt=new Date(2026,8,17,23,58), tomorrow=new Date(2026,8,18,0,1)
describe('nieukończone poprawki o północy',()=>{
  it('nowa karta pominięta w poprawkach wraca następnego dnia na poziomie zero',()=>{
    const data=previewData(),card=data.cards[0];data.attempts=[grade(card,[card.lines[0].key],false,'main',answerAt)]
    expect(unfinishedCorrections(data,tomorrow)).toEqual([{cardId:card.id,entry:{status:'LEARNING',consecutiveCorrect:0,interval:1,nextReviewDate:'2026-09-18',lastSeen:answerAt.toISOString()}}])
  })
  it('nie finalizuje błędu przed północą',()=>{
    const data=previewData(),card=data.cards[0];data.attempts=[grade(card,[],true,'main',answerAt)]
    expect(unfinishedCorrections(data,answerAt)).toEqual([])
  })
  it.each(['free','buffer'] as const)('nie nadpisuje późniejszej oceny %s',phase=>{
    const data=previewData(),card=data.cards[0];data.attempts=[grade(card,[],true,'main',answerAt),grade(card,[],false,phase,new Date(2026,8,17,23,59))]
    expect(unfinishedCorrections(data,tomorrow)).toEqual([])
  })
  it('kilka dni przerwy nie przesuwa terminu na dzień po powrocie',()=>{
    const data=previewData(),card=data.cards[0];data.attempts=[grade(card,[],true,'main',answerAt)]
    expect(unfinishedCorrections(data,new Date(2026,8,23))[0].entry.nextReviewDate).toBe('2026-09-18')
  })
  it('już odzyskany postęp nie jest ponownie zapisywany',()=>{
    const data=previewData(),card=data.cards[0];data.attempts=[grade(card,[],true,'main',answerAt)]
    data.store[card.id]=unfinishedCorrections(data,tomorrow)[0].entry
    expect(unfinishedCorrections(data,tomorrow)).toEqual([])
  })
  it('pomija karty archiwalne',()=>{
    const data=previewData(),card=data.cards[0];card.status='archived';data.attempts=[grade(card,[],true,'main',answerAt)]
    expect(unfinishedCorrections(data,tomorrow)).toEqual([])
  })
})
