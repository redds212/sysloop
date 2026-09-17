// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { FreePractice } from './FreePractice'
import { previewRepository } from '../dev/previewRepository'
import { getDefaultEntry } from '../lib/srs'
afterEach(cleanup)
it('Powtórz cofa zaliczenie, a kolejna ocena nie sumuje poziomów w tej wizycie',async()=>{
  const repository=previewRepository(),card=(await repository.load()).cards[4]
  render(<FreePractice card={card} entry={getDefaultEntry()} timed={false} repository={repository}
    save={async(attempt,entry)=>{await repository.recordAttempt(attempt);await repository.putProgress(card.id,entry)}}
    restore={async(c,entry)=>repository.putProgress(c.id,entry)} onRevealed={()=>{}} onRepeat={()=>{}} onRead={()=>{}} onHome={()=>{}}/>)
  fireEvent.click(screen.getByRole('button',{name:'Pokaż'}));fireEvent.click(screen.getByRole('button',{name:'Wszystko dobrze'}))
  await screen.findByText('Wszystko się zgadza.')
  expect(repository.inspect().store[card.id].consecutiveCorrect).toBe(1)
  fireEvent.click(screen.getByRole('button',{name:'Powtórz'}));await screen.findByRole('button',{name:'Pokaż'})
  expect(repository.inspect().store[card.id]).toEqual(getDefaultEntry())
  fireEvent.click(screen.getByRole('button',{name:'Pokaż'}));fireEvent.click(screen.getByRole('button',{name:'Wszystko dobrze'}))
  await screen.findByText('Wszystko się zgadza.')
  expect(repository.inspect().store[card.id].consecutiveCorrect).toBe(1)
})
