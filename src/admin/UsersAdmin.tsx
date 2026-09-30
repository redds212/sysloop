import { useEffect, useState } from 'react'
import type { ProfileRow, UserActivityRow } from '../lib/database.types'
import { Confirm } from './shared'
import { when } from './labels'

type Action = {user:ProfileRow; kind:'approve'|'revoke'|'admin'|'delete'}
const number=new Intl.NumberFormat('pl-PL')
const loginDate=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
export function UsersAdmin({users,loadActivity,currentId,busy,update,remove}: {users:ProfileRow[];loadActivity:()=>Promise<UserActivityRow[]>;currentId:string;busy:boolean;update:(id:string,patch:Pick<Partial<ProfileRow>,'status'|'is_admin'>)=>Promise<boolean>;remove:(id:string)=>Promise<boolean>}) {
  const [action,setAction]=useState<Action|null>(null)
  const [refresh,setRefresh]=useState(0)
  const [activity,setActivity]=useState<{request:number;rows:UserActivityRow[];error:string}|null>(null)
  useEffect(()=>{
    let active=true
    void loadActivity().then(rows=>{if(active)setActivity({request:refresh,rows,error:''})}).catch(error=>{
      if(active)setActivity({request:refresh,rows:[],error:error instanceof Error?error.message:'Nie udało się pobrać aktywności. Spróbuj ponownie.'})
    })
    return()=>{active=false}
  },[loadActivity,refresh,users])
  useEffect(()=>{
    const refreshVisible=()=>{if(document.visibilityState==='visible')setRefresh(n=>n+1)}
    const timer=window.setInterval(refreshVisible,60_000)
    document.addEventListener('visibilitychange',refreshVisible)
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refreshVisible)}
  },[])
  const loading=activity?.request!==refresh
  const byUser=new Map((loading?[]:activity?.rows??[]).map(row=>[row.user_id,row]))
  const titles={approve:'Zatwierdź dostęp',revoke:'Wstrzymaj dostęp',admin:action?.user.is_admin?'Odbierz rolę administratora':'Nadaj rolę administratora',delete:'Usuń konto bezpowrotnie'}
  async function confirm() {
    if(!action)return
    const {user,kind}=action
    const ok=kind==='delete'?await remove(user.id):await update(user.id,kind==='admin'?{is_admin:!user.is_admin}:{status:kind==='approve'?'approved':'pending'})
    setAction(null)
    return ok
  }
  return <section><div className="admin-row-head"><h2>Użytkownicy</h2><button className="text-button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>{loading?'Wczytywanie aktywności…':'Odśwież aktywność'}</button></div><p className="muted">Oczekujący: {users.filter(u=>u.status==='pending').length}</p>
    <p className="admin-activity-help">Seria: dni z oceną. Oceny: wszystkie próby / różne karty. Czas Warszawy.</p>
    {!loading&&activity?.error&&<p className="error-note" role="alert">{activity.error}</p>}
    {!users.length&&<p className="admin-empty">Brak użytkowników.</p>}
    {users.map(u=>{
      const stats=byUser.get(u.id),placeholder=loading?'…':'—'
      return <article key={u.id} className="panel admin-user" aria-label={u.username||'Bez nazwy'}>
        <div className="admin-user-identity"><h3 title={`Konto od ${when(u.created_at)}`}>{u.username||'Bez nazwy'}{u.id===currentId?' (Ty)':''}</h3><span className="badge">{u.is_admin?'Administrator':u.status==='approved'?'Zatwierdzony':'Oczekuje'}</span></div>
        <dl className="admin-user-stats" aria-label="Aktywność użytkownika" aria-busy={loading}>
          <div title="Kolejne dni z co najmniej jedną oceną, również błędną. Seria trwa, jeśli ćwiczono dziś lub wczoraj."><dt>Dni z rzędu</dt><dd className={stats&&stats.streak_days>0?'streak-active':''}>{stats?number.format(stats.streak_days):placeholder}</dd></div>
          <div title="Wszystkie zapisane oceny, w tym poprawki i ćwiczenia trudnych / liczba różnych kart. Odczyt bez oceny nie zwiększa liczników."><dt>Oceny / karty</dt><dd>{stats?`${number.format(stats.total_attempts)} / ${number.format(stats.unique_cards)}`:placeholder}</dd></div>
          <div title={stats?.last_sign_in_at?`Ostatnie logowanie: ${when(stats.last_sign_in_at)} (Warszawa). Powrót do otwartej sesji nie jest nowym logowaniem.`:'Ostatnie logowanie z Supabase Auth; nie jest to czas ostatniej odpowiedzi.'}><dt>Logowanie</dt><dd>{!stats?placeholder:stats.last_sign_in_at?<time dateTime={stats.last_sign_in_at}>{loginDate.format(new Date(stats.last_sign_in_at))}</time>:'Nigdy'}</dd></div>
        </dl>
        {u.id!==currentId&&<details className="admin-user-manage"><summary>Zarządzaj</summary><p className="muted">Konto od {when(u.created_at)}</p><div className="admin-actions"><button className="secondary" disabled={busy} onClick={()=>setAction({user:u,kind:u.status==='pending'?'approve':'revoke'})}>{u.status==='pending'?'Zatwierdź dostęp':'Wstrzymaj dostęp'}</button><button className="text-button" disabled={busy} onClick={()=>setAction({user:u,kind:'admin'})}>{u.is_admin?'Odbierz rolę administratora':'Nadaj rolę administratora'}</button><button className="text-button danger" disabled={busy} onClick={()=>setAction({user:u,kind:'delete'})}>Usuń konto</button></div></details>}
      </article>
    })}
    {action&&<Confirm title={titles[action.kind]} busy={busy} onClose={()=>setAction(null)} onConfirm={()=>void confirm()} label={titles[action.kind]}><p>{action.user.username||'Bez nazwy'}</p><p className="muted">{action.kind==='delete'?'Konto, postępy i historia odpowiedzi zostaną trwale usunięte. Zgłoszenia pozostaną.':action.kind==='admin'&&!action.user.is_admin?'Administrator ma dostęp do wszystkich kart, źródeł, importów i zarządzania użytkownikami.':action.kind==='approve'?'Użytkownik uzyska dostęp do zatwierdzonego systemu.':action.kind==='revoke'?(action.user.is_admin?'To konto nadal ma rolę administratora i zachowa dostęp administracyjny.':'Użytkownik straci dostęp do nauki; historia pozostanie.'):'Użytkownik straci dostęp do panelu administratora.'}</p></Confirm>}
  </section>
}
