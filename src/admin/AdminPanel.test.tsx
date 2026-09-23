// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AdminPanel } from './AdminPanel'
import { CardEditor } from './CardEditor'
import { adminFixtures, adminPreviewUser } from '../dev/adminFixtures'
import { adminPreviewRepository } from '../dev/adminRepository'
import { progressAfterEdit } from '../lib/contentChanges'

beforeAll(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
})
afterEach(cleanup)

describe('panel administratora',()=>{
  it('nie pobiera danych dla zwykłego użytkownika',()=>{
    const repository=adminPreviewRepository();const load=vi.spyOn(repository,'load')
    render(<AdminPanel user={{...adminPreviewUser,isAdmin:false}} repository={repository} onBack={()=>{}}/>)
    expect(screen.getByText('Brak dostępu')).toBeTruthy();expect(load).not.toHaveBeenCalled()
  })
  it('nadanie dostępu wymaga potwierdzenia; własne konto nie ma usuwania',async()=>{
    const repository=adminPreviewRepository();const update=vi.spyOn(repository,'updateUser')
    render(<AdminPanel user={adminPreviewUser} repository={repository} onBack={()=>{}}/>)
    await screen.findByRole('heading',{name:'Karty'})
    fireEvent.click(screen.getByRole('button',{name:'Użytkownicy'}))
    expect(screen.getAllByRole('button',{name:'Usuń konto'})).toHaveLength(1)
    fireEvent.click(screen.getByRole('button',{name:'Zatwierdź dostęp'}))
    expect(update).not.toHaveBeenCalled()
    const dialog=screen.getByRole('dialog',{name:'Zatwierdź dostęp'})
    fireEvent.click(within(dialog).getByRole('button',{name:'Zatwierdź dostęp'}))
    await waitFor(()=>expect(update).toHaveBeenCalledWith('pending-demo',{status:'approved'}))
    await screen.findByText('Uprawnienia użytkownika zostały zapisane.')
  })
  it('zgłoszenie otwiera właściwą kartę w edytorze',async()=>{
    render(<AdminPanel user={adminPreviewUser} repository={adminPreviewRepository()} onBack={()=>{}}/>)
    await screen.findByRole('heading',{name:'Karty'})
    fireEvent.click(screen.getByRole('button',{name:'Zgłoszenia'}))
    fireEvent.click(screen.getByRole('button',{name:'Przykładowe zgłoszenie do karty'}))
    expect(screen.getByLabelText('Znaczenie 1')).toBeTruthy()
  })
  it('wysyła decyzję kosmetyczną dopiero po przeglądzie i potwierdzeniu importu',async()=>{
    const repository=adminPreviewRepository(), apply=vi.spyOn(repository,'applyRun')
    render(<AdminPanel user={adminPreviewUser} repository={repository} onBack={()=>{}}/>)
    await screen.findByRole('heading',{name:'Karty'})
    fireEvent.click(screen.getByRole('button',{name:'Importy'}))
    fireEvent.click(screen.getByRole('button',{name:/przyklad-demo.pdf/}))
    await screen.findByRole('heading',{name:'przyklad-demo.pdf'})
    fireEvent.click(screen.getByRole('button',{name:'Zmienione (1)'}))
    fireEvent.click(screen.getByLabelText('Zmiana kosmetyczna — bez wpływu na powtórki'))
    fireEvent.click(screen.getByRole('button',{name:'Zastosuj import'}))
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Zastosuj import'}))
    await waitFor(()=>expect(apply).toHaveBeenCalledOnce())
    expect(Object.values(apply.mock.calls[0][1])).toContainEqual({cosmetic:true})
    await screen.findByText('Import został zastosowany.')
    const data=await repository.load()
    expect(data.cards.find(c=>c.id==='demo-5')?.status).toBe('archived')
    expect(data.cards.some(c=>c.context==='Test nowej pozycji'&&c.status==='draft')).toBe(true)
  })
  it('niepotwierdzony zapis zamyka potwierdzenie i blokuje kolejne zmiany do odświeżenia',async()=>{
    const repository=adminPreviewRepository();vi.spyOn(repository,'updateUser').mockRejectedValue(new Error('offline'))
    render(<AdminPanel user={adminPreviewUser} repository={repository} onBack={()=>{}}/>)
    await screen.findByRole('heading',{name:'Karty'})
    fireEvent.click(screen.getByRole('button',{name:'Użytkownicy'}))
    fireEvent.click(screen.getByRole('button',{name:'Zatwierdź dostęp'}))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Zatwierdź dostęp'}))
    await screen.findByRole('alert')
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    expect((screen.getByRole('button',{name:'Zatwierdź dostęp'}) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button',{name:'Odśwież dane'}))
    await waitFor(()=>expect((screen.getByRole('button',{name:'Zatwierdź dostęp'}) as HTMLButtonElement).disabled).toBe(false))
  })
})

describe('zapis karty',()=>{
  it.each([true,false])('zmiana merytoryczna=%s przekazuje wybraną politykę i stosuje znaczniki',async substantive=>{
    const repository=adminPreviewRepository(), {data}=adminFixtures(), card=data.cards[0]
    const save=vi.fn(async(c,s,r)=>{await repository.saveCard(c,s,r);return true})
    render(<CardEditor card={card} cards={data.cards} repository={repository} busy={false} save={save} onBack={()=>{}}/>)
    fireEvent.change(screen.getByLabelText('Znaczenie 1'),{target:{value:'Wymyślona nowa treść.'}})
    fireEvent.click(screen.getByRole('button',{name:'Przejrzyj i zapisz'}))
    if(!substantive)fireEvent.click(screen.getByLabelText('Zmiana kosmetyczna'))
    fireEvent.click(screen.getByRole('button',{name:'Zapisz kartę'}))
    await waitFor(()=>expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][1]).toBe(substantive)
    const updated=(await repository.load()).cards[0]
    if(substantive)expect(updated.lines[0].changedAt).not.toBe(card.lines[0].changedAt)
    else expect(updated.lines[0].changedAt).toBe(card.lines[0].changedAt)
    const progress={status:'MASTERED' as const,consecutiveCorrect:4,interval:81,nextReviewDate:'2026-12-01',lastSeen:'2026-09-01T12:00:00Z'}
    expect(progressAfterEdit(progress,substantive,new Date('2026-09-17T23:30:00Z'))).toMatchObject({consecutiveCorrect:4,nextReviewDate:substantive?'2026-09-19':'2026-12-01'})
  })
  it('zatwierdzenie szkicu usuwa flagi po jawnym potwierdzeniu',async()=>{
    const repository=adminPreviewRepository(), {data}=adminFixtures(), card=data.cards[1]
    const save=vi.fn(async()=>true)
    render(<CardEditor card={card} cards={data.cards} repository={repository} busy={false} save={save} onBack={()=>{}}/>)
    fireEvent.click(screen.getByRole('button',{name:'Zatwierdź kartę'}))
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Zapisz kartę'}))
    await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({status:'active',review_flags:[]}),true,'demo'))
  })
})
