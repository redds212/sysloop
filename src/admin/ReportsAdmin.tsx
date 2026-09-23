import { useState } from 'react'
import type { ReportRow } from '../lib/database.types'
import type { ReportKind } from '../lib/reporting'
import { CallText } from '../components/AuctionView'
import { Confirm } from './shared'
import { when } from './labels'
export function ReportsAdmin({reports,busy,update,remove,onEdit,kind='error'}: {reports:ReportRow[];busy:boolean;update:(id:number,status:ReportRow['status'])=>Promise<boolean>;remove:(id:number)=>Promise<boolean>;onEdit:(id:string)=>void;kind?:ReportKind}) {
  const [all,setAll]=useState(false), [deleting,setDeleting]=useState<ReportRow|null>(null)
  const discussion=kind==='discussion'
  const labels=discussion?{new:'Do omówienia',seen:'W toku',resolved:'Omówione'}:{new:'Nowe',seen:'Przejrzane',resolved:'Rozwiązane'}
  const visible=reports.filter(r=>(r.kind??'error')===kind&&(all||r.status!=='resolved'))
  const deleteLabel=discussion?'Usuń temat':'Usuń zgłoszenie'
  return <section><h2>{discussion?'Do dyskusji':'Zgłoszenia'}</h2>
    {discussion&&<p className="muted">Propozycje zmian ustaleń i pytania do wspólnego omówienia. Zakończenie dyskusji nie zmienia automatycznie systemu.</p>}
    <label className="admin-check"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>{discussion?'Pokaż również omówione':'Pokaż również rozwiązane'}</label>
    {!visible.length&&<p className="admin-empty">{discussion?'Brak tematów do omówienia.':'Nic nie czeka na reakcję.'}</p>}
    {visible.map(r=><article className="panel" key={r.id}>
      <div className="admin-row-head"><span className="badge">{labels[r.status]}</span><span className="muted">{when(r.created_at)}</span></div>
      <button className="text-button admin-report-link" onClick={()=>onEdit(r.card_id)}>{r.card_label||'Otwórz kartę'}</button>
      {discussion&&<div className="admin-discussion-lines"><span className="muted">{r.selected_lines?.length?'Odzywki do omówienia:':'Cała pozycja'}</span>{r.selected_lines?.map(line=><span className="badge" key={line.key}><CallText text={line.label}/></span>)}</div>}
      <p className="verbatim">{r.message}</p><p className="muted">{r.reporter_label||'Usunięty użytkownik'}</p>
      <div className="admin-actions">
        {r.status==='new'&&<button className="secondary" disabled={busy} onClick={()=>void update(r.id,'seen')}>{discussion?'W toku':'Przejrzane'}</button>}
        <button className="secondary" disabled={busy} onClick={()=>void update(r.id,r.status==='resolved'?'new':'resolved')}>{r.status==='resolved'?'Otwórz ponownie':discussion?'Omówione':'Rozwiązane'}</button>
        <button className="text-button danger" disabled={busy} onClick={()=>setDeleting(r)}>{deleteLabel}</button>
      </div>
    </article>)}
    {deleting&&<Confirm title={discussion?'Usunąć temat bezpowrotnie?':'Usunąć zgłoszenie bezpowrotnie?'} busy={busy} onClose={()=>setDeleting(null)} onConfirm={()=>{void remove(deleting.id).then(ok=>{if(ok)setDeleting(null)})}} label={deleteLabel}><p>{deleting.card_label}</p><p className="muted">{discussion?'Usunięcia tego tematu nie można cofnąć.':'Usunięcia tego zgłoszenia nie można cofnąć.'}</p></Confirm>}
  </section>
}
