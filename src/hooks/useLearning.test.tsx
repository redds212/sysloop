// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useLearning } from './useLearning'
import { previewRepository } from '../dev/previewRepository'
import { previewUser } from '../dev/fixtures'
import { browserJournal } from '../lib/learningRepository'
import { grade } from '../lib/grading'
import { currentCardId } from '../lib/sessionState'
afterEach(()=>{cleanup();localStorage.clear()})
describe('sesja z zapisem',()=>{
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
