// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLearning } from './useLearning'
import { previewRepository } from '../dev/previewRepository'
import { previewUser } from '../dev/fixtures'
import { browserJournal } from '../lib/learningRepository'
import { grade } from '../lib/grading'
import { currentCardId } from '../lib/sessionState'
import { previewData } from '../dev/fixtures'
import { inventedCard } from '../lib/testFixtures'
afterEach(()=>{cleanup();localStorage.clear()})
describe('sesja z zapisem',()=>{
  it('kolejne porcje zachowują historię, poprawki i wznowienie, bez powtarzania ocenionych kart',async()=>{
    localStorage.setItem('sysloop:preview:data',JSON.stringify({...previewData(),cards:Array.from({length:12},(_,i)=>inventedCard(`extra-${i}`)),store:{}}))
    const repo=previewRepository(localStorage),journal=browserJournal(previewUser,localStorage)
    const hook=renderHook(()=>useLearning(previewUser,repo,journal))
    await waitFor(()=>expect(hook.result.current.data).not.toBeNull())
    await act(()=>hook.result.current.begin())
    await act(async()=>{expect(await hook.result.current.beginNext()).toBe(false)})
    const firstIds=hook.result.current.session!.session.slots.map(s=>s.cardId)
    for(let i=0;i<5;i++) {
      const card=hook.result.current.data!.cards.find(c=>c.id===hook.result.current.currentId)!
      await act(()=>hook.result.current.answer(grade(card,[],false,'main')))
    }
    expect(hook.result.current.nextQueue!.slots).toHaveLength(5)
    await act(()=>hook.result.current.updateSettings({...hook.result.current.settings,correctionMode:'missed'}))
    expect(hook.result.current.currentId).toBeNull()
    await act(()=>hook.result.current.beginNext())
    expect(hook.result.current.session!.buffer).toEqual([])
    expect(hook.result.current.session!.session.slots.every(s=>!firstIds.includes(s.cardId))).toBe(true)
    const missed=hook.result.current.data!.cards.find(c=>c.id===hook.result.current.currentId)!
    await act(()=>hook.result.current.answer(grade(missed,[missed.lines[0].key],false,'main')))
    const resumeId=hook.result.current.currentId
    hook.unmount()
    const resumedRepo=previewRepository(localStorage)
    const resumed=renderHook(()=>useLearning(previewUser,resumedRepo,journal))
    await waitFor(()=>expect(resumed.result.current.currentId).toBe(resumeId))
    expect(resumed.result.current.data!.attempts).toHaveLength(6)
    expect(resumed.result.current.session!.correctionLines?.[missed.id]).toEqual([missed.lines[0].key])
    for(let i=0;i<4;i++) {
      const card=resumed.result.current.data!.cards.find(c=>c.id===resumed.result.current.currentId)!
      await act(()=>resumed.result.current.answer(grade(card,[],false,'main')))
    }
    expect(resumed.result.current.currentId).toBe(missed.id)
    await act(()=>resumed.result.current.answer({...grade(missed,[],false,'buffer'),scope:'partial'}))
    expect(resumed.result.current.data!.store[missed.id]).toMatchObject({status:'LEARNING',interval:1,consecutiveCorrect:0})
    expect(resumed.result.current.nextQueue!.slots).toHaveLength(2)
    await act(()=>resumed.result.current.beginNext())
    for(let i=0;i<2;i++) {
      const card=resumed.result.current.data!.cards.find(c=>c.id===resumed.result.current.currentId)!
      await act(()=>resumed.result.current.answer(grade(card,[],false,'main')))
    }
    expect(resumed.result.current.nextQueue!.slots).toEqual([])
    await act(async()=>{expect(await resumed.result.current.beginNext()).toBe(false)})
    expect(resumed.result.current.data!.attempts.filter(a=>a.phase==='main')).toHaveLength(12)
    expect(resumed.result.current.settings.dailyTarget).toBe(5)
  })
  it('odzyskuje zapis rozpoczęcia kolejnej porcji po utracie potwierdzenia',async()=>{
    const repo=previewRepository(),journal=browserJournal(previewUser,localStorage)
    const hook=renderHook(()=>useLearning({...previewUser,dailyTarget:1},repo,journal))
    await waitFor(()=>expect(hook.result.current.data).not.toBeNull())
    await act(()=>hook.result.current.begin())
    const card=hook.result.current.data!.cards.find(c=>c.id===hook.result.current.currentId)!
    await act(()=>hook.result.current.answer(grade(card,[],false,'main')))
    const nextId=hook.result.current.nextQueue!.slots[0].cardId
    const save=repo.saveSession.bind(repo)
    repo.saveSession=async session=>{await save(session);throw new Error('Lost receipt')}
    await act(async()=>{await expect(hook.result.current.beginNext()).rejects.toThrow()})
    expect(hook.result.current.currentId).toBeNull()
    expect(journal.read()?.session?.session.slots[0].cardId).toBe(nextId)
    repo.saveSession=save
    await act(()=>hook.result.current.load())
    expect(hook.result.current.currentId).toBe(nextId)
    expect(hook.result.current.data!.attempts).toHaveLength(1)
    expect(journal.read()).toBeNull()
  })
  it('trening trudnych zapisuje tylko próbę, nie zmienia SRS, sesji ani puli nowych',async()=>{
    const repo=previewRepository(),journal=browserJournal(previewUser,localStorage)
    const progress=vi.spyOn(repo,'putProgress'),session=vi.spyOn(repo,'saveSession')
    const hook=renderHook(()=>useLearning(previewUser,repo,journal))
    await waitFor(()=>expect(hook.result.current.data).not.toBeNull())
    const before=structuredClone(repo.inspect()),queue=hook.result.current.queue
    const card=before.cards[0]
    await act(()=>hook.result.current.saveHard(grade(card,[card.lines[0].key],false,'hard')))
    expect(progress).not.toHaveBeenCalled();expect(session).not.toHaveBeenCalled()
    expect(repo.inspect().store).toEqual(before.store)
    expect(hook.result.current.queue).toEqual(queue)
    expect(repo.inspect().attempts).toHaveLength(1)
  })
  it('gwiazdka i preferencja poprawek przetrwają ponowne wczytanie',async()=>{
    const repo=previewRepository(localStorage),journal=browserJournal(previewUser,localStorage)
    const hook=renderHook(()=>useLearning(previewUser,repo,journal))
    await waitFor(()=>expect(hook.result.current.data).not.toBeNull())
    const id=hook.result.current.data!.cards[0].id
    await act(()=>hook.result.current.setStar(id,true))
    await act(()=>hook.result.current.updateSettings({...hook.result.current.settings,correctionMode:'missed'}))
    hook.unmount()
    const nextRepo=previewRepository(localStorage),next=renderHook(()=>useLearning(previewUser,nextRepo,journal))
    await waitFor(()=>expect(next.result.current.data?.starredCardIds).toEqual([id]))
    expect(next.result.current.settings.correctionMode).toBe('missed')
    await act(()=>next.result.current.setStar(id,false))
    expect(next.result.current.data?.starredCardIds).toEqual([])
  })
  it('utrata potwierdzenia gwiazdki jest odzyskiwana po odświeżeniu bez duplikatu',async()=>{
    const repo=previewRepository(localStorage),journal=browserJournal(previewUser,localStorage)
    const original=repo.setStar!.bind(repo)
    repo.setStar=async(...args)=>{await original(...args);throw new Error('Lost receipt')}
    const hook=renderHook(()=>useLearning(previewUser,repo,journal))
    await waitFor(()=>expect(hook.result.current.data).not.toBeNull())
    const id=hook.result.current.data!.cards[0].id
    await act(async()=>{await expect(hook.result.current.setStar(id,true)).rejects.toThrow()})
    expect(journal.read()?.star).toEqual({cardId:id,starred:true})
    hook.unmount()
    const nextRepo=previewRepository(localStorage),next=renderHook(()=>useLearning(previewUser,nextRepo,journal))
    await waitFor(()=>expect(next.result.current.data?.starredCardIds).toEqual([id]))
    expect(journal.read()).toBeNull()
  })
  it('przechodzi cały przebieg z buforem, wznawia po odświeżeniu i zachowuje ukończenie',async()=>{
    const repo=previewRepository(),journal=browserJournal(previewUser,localStorage)
    const first=renderHook(()=>useLearning(previewUser,repo,journal))
    await waitFor(()=>expect(first.result.current.data).not.toBeNull())
    await act(()=>first.result.current.begin())
    const firstId=first.result.current.currentId!,firstCard=first.result.current.data!.cards.find(c=>c.id===firstId)!
    const before=first.result.current.data!.store[firstId]
    await act(()=>first.result.current.answer(grade(firstCard,[firstCard.lines[0].key],false,'main')))
    expect(first.result.current.data!.store[firstId]).toEqual(before)
    const secondId=first.result.current.currentId;first.unmount()
    const resumed=renderHook(()=>useLearning(previewUser,repo,journal))
    await waitFor(()=>expect(resumed.result.current.currentId).toBe(secondId))
    for(let i=0;i<4;i++) {
      const c=resumed.result.current.data!.cards.find(c=>c.id===resumed.result.current.currentId)!
      await act(()=>resumed.result.current.answer(grade(c,[],false,'main')))
    }
    expect(resumed.result.current.session!.inBuffer).toBe(true);expect(resumed.result.current.currentId).toBe(firstId)
    await act(()=>resumed.result.current.answer(grade(firstCard,[],false,'buffer')))
    expect(resumed.result.current.currentId).toBeNull();expect(resumed.result.current.data!.store[firstId]).toMatchObject({status:'LEARNING',consecutiveCorrect:0,interval:1})
    resumed.unmount()
    const final=renderHook(()=>useLearning(previewUser,repo,journal));await waitFor(()=>expect(final.result.current.session).not.toBeNull())
    expect(currentCardId(final.result.current.session!)).toBeNull();expect(final.result.current.data!.attempts).toHaveLength(6)
  })
})
