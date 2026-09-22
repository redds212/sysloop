// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLearning } from './useLearning'
import { previewRepository } from '../dev/previewRepository'
import { previewUser } from '../dev/fixtures'
import { browserJournal } from '../lib/learningRepository'
import { grade } from '../lib/grading'
import { currentCardId } from '../lib/sessionState'
afterEach(()=>{cleanup();localStorage.clear()})
describe('sesja z zapisem',()=>{
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
