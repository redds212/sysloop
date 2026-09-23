// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { CardTools } from './CardTools'
import { previewData } from '../dev/fixtures'
import { previewRepository } from '../dev/previewRepository'
import { adminPreviewRepository } from '../dev/adminRepository'
import { ReportsAdmin } from '../admin/ReportsAdmin'
import { AdminPanel } from '../admin/AdminPanel'
import { adminPreviewUser } from '../dev/adminFixtures'
import { DiscussionsUnavailableError } from '../lib/reporting'

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
  expect(repository.report).toHaveBeenLastCalledWith(cards[0],undefined,'Test ponowienia','error',[])
  fireEvent.click(screen.getByRole('button',{name:'Zgłoś błąd'}))
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Szkic poprzedniej karty'}})
  view.rerender(<CardTools card={cards[1]} repository={repository} starred={false} busy={false}/>)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Zgłoś błąd'}))
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
})

it('temat z wybranymi odzywkami trafia tylko do dyskusji i zachowuje zakres po zamknięciu',async()=>{
  const card=previewData().cards[0],repository=previewRepository(sessionStorage)
  render(<CardTools card={card} repository={repository} starred={false} busy={false}/>)
  fireEvent.click(screen.getByRole('button',{name:'Do dyskusji'}))
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Testowa propozycja innego ustalenia'}})
  fireEvent.click(screen.getByRole('radio',{name:'Wybrane odzywki'}))
  const submit=screen.getByRole('button',{name:'Dodaj do dyskusji'}) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  for(const line of [card.lines[0],card.lines[2]])fireEvent.click(screen.getByRole('checkbox',{name:`Do dyskusji: ${line.label}`}))
  expect(submit.disabled).toBe(false)
  expect(screen.queryByText(card.lines[0].meaning)).toBeNull()
  fireEvent.click(submit)
  await screen.findByText('Temat dodany do dyskusji.')
  const admin=adminPreviewRepository(sessionStorage)
  const report=(await admin.load()).reports.find(r=>r.kind==='discussion')!
  expect(report.selected_lines).toEqual([card.lines[0],card.lines[2]].map(({key,label})=>({key,label})))
  cleanup()
  render(<AdminPanel user={adminPreviewUser} repository={admin} onBack={()=>{}}/>)
  await screen.findByRole('heading',{name:'Karty'})
  fireEvent.click(screen.getByRole('button',{name:'Zgłoszenia'}))
  expect(screen.queryByText(report.message)).toBeNull()
  expect(screen.getByText('Wymyślone zgłoszenie: sprawdź opis pierwszej odzywki.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Do dyskusji'}))
  expect(screen.queryByText('Wymyślone zgłoszenie: sprawdź opis pierwszej odzywki.')).toBeNull()
  expect(screen.getByText(report.message)).toBeTruthy()
  expect(screen.getByText('Odzywki do omówienia:')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Omówione'}))
  await waitFor(()=>expect(screen.queryByText(report.message)).toBeNull())
  fireEvent.click(screen.getByRole('checkbox',{name:'Pokaż również omówione'}))
  expect(screen.getByText(report.message)).toBeTruthy()
  expect((await admin.load()).reports.find(r=>r.id===report.id)).toMatchObject({status:'resolved',selected_lines:report.selected_lines})
  fireEvent.click(screen.getByRole('button',{name:'Otwórz ponownie'}))
  await screen.findByText('Do omówienia')
  fireEvent.click(screen.getByRole('button',{name:report.card_label.trim()}))
  expect(screen.getByLabelText('Znaczenie 1')).toBeTruthy()
})

it('brak aktywacji dyskusji zachowuje wybrane odzywki i tekst, bez zapisu jako błąd',async()=>{
  const card=previewData().cards[0],repository=previewRepository()
  repository.report=vi.fn().mockRejectedValue(new DiscussionsUnavailableError())
  render(<CardTools card={card} repository={repository} starred={false} busy={false}/>)
  fireEvent.click(screen.getByRole('button',{name:'Do dyskusji'}))
  fireEvent.click(screen.getByRole('radio',{name:'Wybrane odzywki'}))
  fireEvent.click(screen.getByRole('checkbox',{name:`Do dyskusji: ${card.lines[0].label}`}))
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'Testowy temat'}})
  fireEvent.click(screen.getByRole('button',{name:'Dodaj do dyskusji'}))
  expect((await screen.findByRole('alert')).textContent).toContain('czeka na aktywację')
  expect(screen.queryByRole('status')).toBeNull()
  expect((screen.getByRole('checkbox',{name:`Do dyskusji: ${card.lines[0].label}`}) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Testowy temat')
  fireEvent.click(screen.getByRole('radio',{name:'Cała pozycja'}))
  fireEvent.click(screen.getByRole('button',{name:'Dodaj do dyskusji'}))
  await waitFor(()=>expect(repository.report).toHaveBeenLastCalledWith(card,undefined,'Testowy temat','discussion',[]))
})
