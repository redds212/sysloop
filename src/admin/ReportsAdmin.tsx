import { useState } from 'react'
import type { ReportRow } from '../lib/database.types'
import { Confirm } from './shared'
import { when } from './labels'
const labels={new:'Nowe',seen:'Przejrzane',resolved:'Rozwiązane'}
export function ReportsAdmin({reports,busy,update,remove,onEdit}: {reports:ReportRow[];busy:boolean;update:(id:number,status:ReportRow['status'])=>Promise<boolean>;remove:(id:number)=>Promise<boolean>;onEdit:(id:string)=>void}) {
  const [all,setAll]=useState(false), [deleting,setDeleting]=useState<ReportRow|null>(null)
  const visible=reports.filter(r=>all||r.status!=='resolved')
  return <section><h2>Zgłoszenia</h2><label className="admin-check"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>Pokaż również rozwiązane</label>
    {!visible.length&&<p className="admin-empty">Nic nie czeka na reakcję.</p>}
    {visible.map(r=><article className="panel" key={r.id}><div className="admin-row-head"><span className="badge">{labels[r.status]}</span><span className="muted">{when(r.created_at)}</span></div><button className="text-button admin-report-link" onClick={()=>onEdit(r.card_id)}>{r.card_label||'Otwórz kartę'}</button><p className="verbatim">{r.message}</p><p className="muted">{r.reporter_label||'Usunięty użytkownik'}</p><div className="admin-actions">{r.status==='new'&&<button className="secondary" disabled={busy} onClick={()=>void update(r.id,'seen')}>Przejrzane</button>}<button className="secondary" disabled={busy} onClick={()=>void update(r.id,r.status==='resolved'?'new':'resolved')}>{r.status==='resolved'?'Otwórz ponownie':'Rozwiązane'}</button><button className="text-button danger" disabled={busy} onClick={()=>setDeleting(r)}>Usuń zgłoszenie</button></div></article>)}
    {deleting&&<Confirm title="Usunąć zgłoszenie bezpowrotnie?" busy={busy} onClose={()=>setDeleting(null)} onConfirm={()=>{void remove(deleting.id).then(()=>setDeleting(null))}} label="Usuń zgłoszenie"><p>{deleting.card_label}</p><p className="muted">Usunięcia tego zgłoszenia nie można cofnąć.</p></Confirm>}
  </section>
}
