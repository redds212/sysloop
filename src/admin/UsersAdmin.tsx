import { useState } from 'react'
import type { ProfileRow } from '../lib/database.types'
import { Confirm } from './shared'
import { when } from './labels'

type Action = {user:ProfileRow; kind:'approve'|'revoke'|'admin'|'delete'}
export function UsersAdmin({users,currentId,busy,update,remove}: {users:ProfileRow[];currentId:string;busy:boolean;update:(id:string,patch:Pick<Partial<ProfileRow>,'status'|'is_admin'>)=>Promise<boolean>;remove:(id:string)=>Promise<boolean>}) {
  const [action,setAction]=useState<Action|null>(null)
  const titles={approve:'Zatwierdź dostęp',revoke:'Wstrzymaj dostęp',admin:action?.user.is_admin?'Odbierz rolę administratora':'Nadaj rolę administratora',delete:'Usuń konto bezpowrotnie'}
  async function confirm() {
    if(!action)return
    const {user,kind}=action
    const ok=kind==='delete'?await remove(user.id):await update(user.id,kind==='admin'?{is_admin:!user.is_admin}:{status:kind==='approve'?'approved':'pending'})
    setAction(null)
    return ok
  }
  return <section><h2>Użytkownicy</h2><p className="muted">Oczekujący: {users.filter(u=>u.status==='pending').length}</p>
    {!users.length&&<p className="admin-empty">Brak użytkowników.</p>}
    {users.map(u=><article key={u.id} className="panel"><div className="admin-row-head"><h3>{u.username||'Bez nazwy'}{u.id===currentId?' (Ty)':''}</h3><span className="badge">{u.is_admin?'Administrator':u.status==='approved'?'Zatwierdzony':'Oczekuje'}</span></div><p className="muted">Konto od {when(u.created_at)}</p>
      {u.id!==currentId&&<div className="admin-actions"><button className="secondary" disabled={busy} onClick={()=>setAction({user:u,kind:u.status==='pending'?'approve':'revoke'})}>{u.status==='pending'?'Zatwierdź dostęp':'Wstrzymaj dostęp'}</button><button className="text-button" disabled={busy} onClick={()=>setAction({user:u,kind:'admin'})}>{u.is_admin?'Odbierz rolę administratora':'Nadaj rolę administratora'}</button><button className="text-button danger" disabled={busy} onClick={()=>setAction({user:u,kind:'delete'})}>Usuń konto</button></div>}
    </article>)}
    {action&&<Confirm title={titles[action.kind]} busy={busy} onClose={()=>setAction(null)} onConfirm={()=>void confirm()} label={titles[action.kind]}><p>{action.user.username||'Bez nazwy'}</p><p className="muted">{action.kind==='delete'?'Konto, postępy i historia odpowiedzi zostaną trwale usunięte. Zgłoszenia pozostaną.':action.kind==='admin'&&!action.user.is_admin?'Administrator ma dostęp do wszystkich kart, źródeł, importów i zarządzania użytkownikami.':action.kind==='approve'?'Użytkownik uzyska dostęp do zatwierdzonego systemu.':action.kind==='revoke'?(action.user.is_admin?'To konto nadal ma rolę administratora i zachowa dostęp administracyjny.':'Użytkownik straci dostęp do nauki; historia pozostanie.'):'Użytkownik straci dostęp do panelu administratora.'}</p></Confirm>}
  </section>
}
