// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { CardTools } from './CardTools'
import { previewData } from '../dev/fixtures'
import { previewRepository } from '../dev/previewRepository'
import { adminPreviewRepository } from '../dev/adminRepository'
import { ReportsAdmin } from '../admin/ReportsAdmin'

beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
})
afterEach(()=>{cleanup();sessionStorage.clear()})

it('zgłoszenie pozycji trafia do admina, wskazuje kartę i daje się rozwiązać',async()=>{
  const data=previewData(),card=data.cards[0],category=data.categories.find(c=>c.slug===card.categorySlug)
  const repository=previewRepository(sessionStorage),onStar=vi.fn()
  const view=render(<CardTools card={card} category={category} repository={repository} starred={false} busy={false} onStar={onStar}/>)
  fireEvent.click(screen.getByRole('button',{name:'Zgłoś błąd'}))
  expect(screen.queryByText(card.lines[0].meaning)).toBeNull()
  expect((screen.getByRole('button',{name:'Wyślij zgłoszenie'}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByRole('textbox',{name:'Co wymaga poprawki?'}),{target:{value:'  Testowe zgłoszenie niejasności  '}})
  fireEvent.click(screen.getByRole('button',{name:'Wyślij zgłoszenie'}))
  await screen.findByRole('status')
  expect(onStar).not.toHaveBeenCalled()
  const admin=adminPreviewRepository(sessionStorage),reports=(await admin.load()).reports
  const report=reports.find(r=>r.message==='Testowe zgłoszenie niejasności')!
  expect(report).toMatchObject({card_id:card.id,status:'new',user_id:'preview-user'})
  view.unmount()
  const edit=vi.fn(),update=vi.fn(async(id:number,status:'new'|'seen'|'resolved')=>{await admin.updateReport(id,status);return true})
  render(<ReportsAdmin reports={reports} busy={false} update={update} remove={vi.fn()} onEdit={edit}/>)
  const ticket=within(screen.getByText(report.message).closest('article')!)
  fireEvent.click(ticket.getByRole('button',{name:report.card_label!}))
  expect(edit).toHaveBeenCalledWith(card.id)
  fireEvent.click(ticket.getByRole('button',{name:'Rozwiązane'}))
  await waitFor(()=>expect(update).toHaveBeenCalledWith(report.id,'resolved'))
  expect((await admin.load()).reports.find(r=>r.id===report.id)?.status).toBe('resolved')
})

it('błąd wysyłki zachowuje tekst do ponowienia; zmiana karty czyści formularz',async()=>{
  const cards=previewData().cards,repository=previewRepository()
  repository.report=vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined)
  const view=render(<CardTools card={cards[0]} repository={repository} starred={false} busy={false}/>)
  fireEvent.click(screen.getByRole('button',{name:'Zgłoś błąd'}))
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Test ponowienia'}})
  fireEvent.click(screen.getByRole('button',{name:'Wyślij zgłoszenie'}))
  await screen.findByRole('alert')
  expect(screen.queryByRole('status')).toBeNull()
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Test ponowienia')
  fireEvent.click(screen.getByRole('button',{name:'Wyślij zgłoszenie'}))
  await screen.findByRole('status')
  expect(repository.report).toHaveBeenLastCalledWith(cards[0],undefined,'Test ponowienia')
  fireEvent.click(screen.getByRole('button',{name:'Zgłoś błąd'}))
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Szkic poprzedniej karty'}})
  view.rerender(<CardTools card={cards[1]} repository={repository} starred={false} busy={false}/>)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Zgłoś błąd'}))
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
})
