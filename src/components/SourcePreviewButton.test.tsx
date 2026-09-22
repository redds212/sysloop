// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { CardView } from './card/CardView'
import { previewRepository } from '../dev/previewRepository'
import { previewData } from '../dev/fixtures'
import { getDefaultEntry } from '../lib/srs'
beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
})
afterEach(()=>{cleanup();localStorage.clear()})
it('nie pobiera ani nie pokazuje oryginału przed odsłonięciem i kliknięciem; przełącza fragment i stronę',async()=>{
  const repository=previewRepository(),source=vi.spyOn(repository,'sourcePreview')
  const card=previewData().cards[4]
  render(<CardView card={card} baseline={getDefaultEntry()} timed={false} phase="main" repository={repository} onRate={async()=>{}} onRevealed={()=>{}}/>)
  expect(screen.queryByRole('button',{name:'Oryginalny fragment'})).toBeNull()
  expect(source).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Pokaż'}))
  expect(source).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Oryginalny fragment'}))
  await waitFor(()=>expect(screen.getByRole('img')).toBeTruthy())
  expect(source).toHaveBeenCalledExactlyOnceWith(card.id)
  const img=screen.getByRole('img')
  Object.defineProperty(img,'naturalWidth',{value:600});Object.defineProperty(img,'naturalHeight',{value:840})
  fireEvent.load(img)
  expect(img.getAttribute('alt')).toContain('fragment karty')
  fireEvent.click(screen.getByRole('button',{name:'Cała strona'}))
  expect(img.getAttribute('alt')).not.toContain('fragment karty')
  fireEvent.click(screen.getByRole('button',{name:'Pokaż fragment'}))
  expect(img.getAttribute('alt')).toContain('fragment karty')
})
it('oznaczenie poprzedniego błędu nie jest zaznaczeniem błędu bieżącej próby',async()=>{
  const card=previewData().cards[4],rate=vi.fn().mockResolvedValue(undefined)
  render(<CardView card={card} previousMissed={[card.lines[0].key]} scope="partial" baseline={getDefaultEntry()} timed={false} phase="buffer" repository={previewRepository()} onRate={rate} onRevealed={()=>{}}/>)
  expect(screen.getByRole('img',{name:'Poprzednio błąd'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Pokaż'}))
  fireEvent.click(screen.getByRole('button',{name:'Wszystko dobrze'}))
  await waitFor(()=>expect(rate).toHaveBeenCalledTimes(1))
  expect(rate.mock.calls[0][0]).toMatchObject({correct:true,scope:'partial',missedLineKeys:[]})
})
