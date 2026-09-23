// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecentChanges } from './RecentChanges'
import { CardView } from './card/CardView'
import { previewData } from '../dev/fixtures'
import { previewRepository } from '../dev/previewRepository'
import { revisionFixtures } from '../dev/revisionFixtures'
import { getDefaultEntry } from '../lib/srs'

afterEach(()=>{cleanup();localStorage.clear()})
it('lista ma daty i rzeczywiste przed/po; dodana odzywka ma puste przed',async()=>{
  const data=previewData(),start=vi.fn()
  render(<RecentChanges cards={data.cards} categories={data.categories} attempts={[]} repository={previewRepository()} busy={false} onStart={start} onRead={()=>{}}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Ćwicz zmienione (2) →'}))
  expect(start).toHaveBeenCalledWith(['demo-1','demo-5'])
  const summary=screen.getAllByText('Porównaj przed / po · 2 odzywek',{selector:'summary'})[0]
  fireEvent.click(summary)
  expect(screen.getByText('Wymyślone poprzednie ustalenie: inny opis testowy.')).toBeTruthy()
  const added=screen.getAllByText('Dodano')[0].closest('.revision-line')!
  expect(within(added as HTMLElement).getByText('Przed').nextElementSibling?.textContent).toBe('')
  expect(document.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-23T07:00:00Z')
})
it('trening pokazuje poprzednią treść dopiero przy błędzie i zapisuje wersję NEW bez treści wpisu',async()=>{
  const card=previewData().cards[0],repository=previewRepository(),save=vi.fn().mockResolvedValue(undefined)
  const history=vi.spyOn(repository,'revisions'),before=revisionFixtures([card])[0].before_snapshot!.lines[0].meaning
  const view=render(<CardView revisionTraining card={card} baseline={getDefaultEntry()} timed={false} phase="hard" repository={repository} onRate={save} onRevealed={()=>{}}/>)
  expect(history).not.toHaveBeenCalled()
  expect(screen.queryByText(before)).toBeNull()
  expect(screen.getAllByText('NEW')).toHaveLength(2)
  fireEvent.change(screen.getByRole('textbox',{name:`Twoje znaczenie: ${card.lines[0].label}`}),{target:{value:'Mój wymyślony skrót'}})
  fireEvent.click(screen.getByRole('button',{name:'Pokaż'}))
  await waitFor(()=>expect(history).toHaveBeenCalledWith(card.id))
  await screen.findByText('Zaznacz błędną odzywkę, aby zobaczyć również poprzednie ustalenie.')
  expect(screen.queryByText(before)).toBeNull()
  const row=screen.getByText('Mój wymyślony skrót').closest('.line-row')!
  fireEvent.click(within(row as HTMLElement).getByRole('button'))
  expect(screen.getByText(before)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Dalej · 1 błąd'}))
  await waitFor(()=>expect(save).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][0]).toMatchObject({phase:'hard',correct:false,lineVersions:{[card.lines[0].key]:card.lines[0].changeId}})
  expect(JSON.stringify(save.mock.calls)).not.toContain('Mój wymyślony skrót')
  view.unmount()
  render(<CardView attempts={[save.mock.calls[0][0]]} card={card} baseline={getDefaultEntry()} timed={false} phase="main" repository={repository} onRate={save} onRevealed={()=>{}}/>)
  expect(screen.queryByText('NEW')).toBeNull()
})
