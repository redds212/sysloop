// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import LearningApp from './LearningApp'
import { previewData, previewUser } from './dev/fixtures'
import { previewRepository } from './dev/previewRepository'
import { browserJournal } from './lib/learningRepository'
import { startSession } from './lib/sessionState'
import { generateDailySession } from './lib/session'
import { grade } from './lib/grading'
import { applyAnswer, getDefaultEntry } from './lib/srs'

afterEach(()=>{cleanup();localStorage.clear()})
function setup(exhausted:boolean) {
  const data=previewData(),card=data.cards[0]
  if(exhausted)data.cards=[card]
  data.session=startSession(generateDailySession([card],{}, {...previewUser,dailyTarget:1}))
  data.session.index=1
  data.attempts=[grade(card,[],false,'main')]
  data.store={[card.id]:applyAnswer(getDefaultEntry(),true)}
  localStorage.setItem('sysloop:preview:data',JSON.stringify(data))
  const repository=previewRepository(localStorage)
  render(<LearningApp user={previewUser} repository={repository} journal={browserJournal(previewUser,localStorage)} onLogout={()=>{}}/>)
  return repository
}
it('udostępnia kolejną sesję w panelu i po zakończeniu, a potem ćwiczenie bez zmiany planu',async()=>{
  const repo=setup(false)
  fireEvent.click(await screen.findByRole('button',{name:'Kolejna sesja (4) →'}))
  await screen.findByText('Dodatkowa sesja')
  for(let i=0;i<4;i++){
    fireEvent.click(await screen.findByRole('button',{name:'Pokaż'}))
    fireEvent.click(screen.getByRole('button',{name:'Wszystko dobrze'}))
    await waitFor(()=>expect(repo.inspect().attempts).toHaveLength(i+2))
  }
  await screen.findByText('Sesja zakończona.')
  expect(screen.getByText('Dziś oceniono 5 pozycji w sesjach. Cel dzienny: 5.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Ćwicz dalej bez zmiany planu'}))
  await screen.findByText('Dodatkowe ćwiczenie · bez zmiany planu')
})
it('ćwiczenie po wyczerpaniu puli zapisuje ocenę bez zmiany SRS i ukończonej sesji',async()=>{
  const repo=setup(true),before=repo.inspect()
  fireEvent.click(await screen.findByRole('button',{name:'Ćwicz dalej bez zmiany planu'}))
  fireEvent.click(await screen.findByRole('button',{name:'Pokaż'}))
  fireEvent.click(screen.getByRole('button',{name:'Wszystko dobrze'}))
  await screen.findByText('Wszystko się zgadza.')
  expect(repo.inspect().attempts.at(-1)?.phase).toBe('hard')
  expect(repo.inspect().store).toEqual(before.store)
  expect(repo.inspect().session).toEqual(before.session)
  fireEvent.click(screen.getByRole('button',{name:'Zakończ trening'}))
  fireEvent.click(await screen.findByRole('button',{name:'Wróć do panelu'}))
  expect(await screen.findByRole('button',{name:'Ćwicz dalej bez zmiany planu'})).toBeTruthy()
})
