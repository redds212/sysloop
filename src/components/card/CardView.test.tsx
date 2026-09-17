// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardView } from './CardView'
import { previewData } from '../../dev/fixtures'
import { previewRepository } from '../../dev/previewRepository'
import { getDefaultEntry } from '../../lib/srs'

afterEach(()=>{cleanup();vi.useRealTimers()})
function setup(timed=false) {
  const card=previewData().cards[4],onRate=vi.fn().mockResolvedValue(undefined)
  render(<CardView card={card} baseline={getDefaultEntry()} timed={timed} phase="main" repository={previewRepository()} onRate={onRate} onRevealed={()=>{}}/>)
  return {card,onRate}
}
describe('ekran karty',()=>{
  it('nie umieszcza znaczeń w DOM przed odsłonięciem i nie zdradza ich długości',()=>{
    const {card}=setup()
    expect(screen.queryByText(card.lines[0].meaning)).toBeNull()
    expect(screen.getAllByLabelText('Znaczenie ukryte')).toHaveLength(2)
    expect(screen.queryByText('Zgłoś błąd')).toBeNull()
  })
  it('zapisuje błąd jednej odzywki i obecne klucze',async()=>{
    const {card,onRate}=setup()
    fireEvent.click(screen.getByRole('button',{name:'Pokaż'}))
    fireEvent.click(screen.getByRole('button',{name:new RegExp(card.lines[0].meaning)}))
    fireEvent.click(screen.getByRole('button',{name:'Dalej · 1 błąd'}))
    await waitFor(()=>expect(onRate).toHaveBeenCalledTimes(1))
    expect(onRate.mock.calls[0][0]).toMatchObject({correct:false,missedLineKeys:[card.lines[0].key],presentLineKeys:card.lines.map(l=>l.key),lineCount:2})
  })
  it('po 15 sekundach odsłania, blokuje zaznaczanie i zapisuje timeout z null',async()=>{
    vi.useFakeTimers();const {onRate}=setup(true)
    act(()=>vi.advanceTimersByTime(15000))
    expect(screen.getByText('Czas minął — zaliczone jako błąd')).toBeTruthy()
    expect(screen.getAllByRole('button',{pressed:false}).every(b=>(b as HTMLButtonElement).disabled)).toBe(true)
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Dalej'})))
    expect(onRate.mock.calls[0][0]).toMatchObject({correct:false,timedOut:true,missedLineKeys:null})
  })
  it('ręczne odsłonięcie zatrzymuje timer',()=>{
    vi.useFakeTimers();setup(true)
    fireEvent.click(screen.getByRole('button',{name:'Pokaż'}));act(()=>vi.advanceTimersByTime(30000))
    expect(screen.queryByText('Czas minął — zaliczone jako błąd')).toBeNull()
    expect(screen.getByRole('button',{name:'Wszystko dobrze'})).toBeTruthy()
  })
  it('ponawia tę samą próbę po błędzie i blokuje zmianę oceny',async()=>{
    const {onRate}=setup();onRate.mockRejectedValueOnce(new Error('Offline'))
    fireEvent.click(screen.getByRole('button',{name:'Pokaż'}));fireEvent.click(screen.getByRole('button',{name:'Wszystko dobrze'}))
    await screen.findByRole('button',{name:'Ponów zapis'})
    expect(screen.getAllByRole('button',{pressed:false}).every(b=>(b as HTMLButtonElement).disabled)).toBe(true)
    fireEvent.click(screen.getByRole('button',{name:'Ponów zapis'}));await waitFor(()=>expect(onRate).toHaveBeenCalledTimes(2))
    expect(onRate.mock.calls[1][0]).toEqual(onRate.mock.calls[0][0])
  })
})
