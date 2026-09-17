import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppUser } from '../types'
import type { AdminData, AdminRepository } from './types'
import { CardsAdmin } from './CardsAdmin'
import { CardEditor } from './CardEditor'
import { UsersAdmin } from './UsersAdmin'
import { ReportsAdmin } from './ReportsAdmin'
import { CategoriesAdmin } from './CategoriesAdmin'
import { ImportsAdmin } from './ImportsAdmin'
import './admin.css'

const tabs={cards:'Karty',users:'Użytkownicy',reports:'Zgłoszenia',imports:'Importy',categories:'Kategorie'}
export function AdminPanel({user,repository,onBack,preview=false}: {user:AppUser;repository:AdminRepository;onBack:()=>void;preview?:boolean}) {
  const [tab,setTab]=useState<keyof typeof tabs>('cards'), [editing,setEditing]=useState<string|null>(null)
  const [data,setData]=useState<AdminData|null>(null), [error,setError]=useState(''), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false)
  const [categoryEditing,setCategoryEditing]=useState(false)
  const lock=useRef(false)
  const reload=useCallback(async()=>{const loaded=await repository.load();setData(loaded)},[repository])
  useEffect(()=>{
    if(!user.isAdmin)return
    let active=true
    void repository.load().then(value=>{if(active)setData(value)}).catch(()=>{if(active)setError('Nie udało się wczytać panelu. Sprawdź połączenie i uprawnienia.')})
    return()=>{active=false}
  },[repository,user.isAdmin])
  async function act(operation:()=>Promise<void>,message:string) {
    if(lock.current||error)return false
    lock.current=true;setBusy(true);setError('');setNotice('')
    try {
      await operation();setNotice(message)
      try {await reload()} catch {setError('Zapis potwierdzony, ale lista nie została odświeżona. Odśwież dane przed kolejną zmianą.')}
      return true
    } catch {setError('Operacja nie została potwierdzona. Odśwież dane, aby sprawdzić jej wynik, zanim spróbujesz ponownie.');return false}
    finally {lock.current=false;setBusy(false)}
  }
  async function refresh() {
    if(lock.current)return
    lock.current=true;setBusy(true)
    try {await reload();setError('')} catch {setError('Nie udało się odświeżyć danych. Sprawdź połączenie i uprawnienia.')}
    finally {lock.current=false;setBusy(false)}
  }
  if(!user.isAdmin)return <div className="loading-page"><h1>Brak dostępu</h1><button className="primary" onClick={onBack}>Wróć do nauki</button></div>
  function edit(id:string) {
    if(!data?.cards.some(c=>c.id===id)){setError('Karty nie ma już w bazie. Zgłoszenie pozostaje w historii.');return}
    setEditing(id)
  }
  const card=data?.cards.find(c=>c.id===editing)
  const writing=busy||!!error
  return <div className="admin-shell"><header className="admin-header"><button className="wordmark" disabled={busy||!!card||categoryEditing} onClick={onBack}>Sys<span>Loop</span></button><span className="eyebrow">Administracja</span>{!card&&!categoryEditing&&<button className="text-button" disabled={busy} onClick={onBack}>← Wróć do nauki</button>}</header>
    {preview&&<div className="preview-banner">Podgląd administratora · wymyślone dane · zmiany tylko w tej karcie przeglądarki</div>}
    <main className="admin-main">
      {!card&&!categoryEditing&&<nav className="admin-tabs" aria-label="Panel administratora">{Object.entries(tabs).map(([key,label])=><button key={key} disabled={busy} className={tab===key?'selected':''} aria-pressed={tab===key} onClick={()=>{setTab(key as keyof typeof tabs);setNotice('')}}>{label}</button>)}</nav>}
      {notice&&<p className="success-note" role="status">{notice}</p>}
      {error&&<div role="alert" className="error-note">{error}<button className="text-button" disabled={busy} onClick={()=>void refresh()}>Odśwież dane</button></div>}
      {!data&&!error&&<p role="status">Wczytywanie panelu…</p>}
      {data&&card?<CardEditor key={card.id} card={card} cards={data.cards} repository={repository} busy={writing} onBack={()=>setEditing(null)} save={(value,substantive,revision)=>act(()=>repository.saveCard(value,substantive,revision),'Karta została zapisana.')}/>:data&&<>
        {tab==='cards'&&<CardsAdmin cards={data.cards} categories={data.categories} onEdit={edit}/>}
        {tab==='users'&&<UsersAdmin users={data.users} currentId={user.id} busy={writing} update={(id,patch)=>act(()=>repository.updateUser(id,patch),'Uprawnienia użytkownika zostały zapisane.')} remove={id=>act(()=>repository.deleteUser(id),'Konto zostało usunięte.')}/>}
        {tab==='reports'&&<ReportsAdmin reports={data.reports} busy={writing} onEdit={edit} update={(id,status)=>act(()=>repository.updateReport(id,status),'Status zgłoszenia został zapisany.')} remove={id=>act(()=>repository.deleteReport(id),'Zgłoszenie zostało usunięte.')}/>}
        {tab==='categories'&&<CategoriesAdmin categories={data.categories} busy={writing} onEditing={setCategoryEditing} save={c=>act(()=>repository.saveCategory(c),'Kategoria została zapisana.')}/>}
        {tab==='imports'&&<ImportsAdmin runs={data.runs} cards={data.cards} repository={repository} busy={writing} apply={(id,decisions)=>act(()=>repository.applyRun(id,decisions),'Import został zastosowany.')} discard={id=>act(()=>repository.discardRun(id),'Import został odrzucony.')}/>}
      </>}
    </main>
  </div>
}
