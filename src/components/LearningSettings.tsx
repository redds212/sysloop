import { useState } from 'react'
import type { UserSettings } from '../types'
import { MODE_LABELS } from '../lib/session'
export function LearningSettings({settings,save}: {settings:UserSettings;save:(next:UserSettings)=>Promise<void>}) {
  const [draft,setDraft]=useState(settings),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  return <section className="panel settings"><h2>Ustawienia nauki</h2><form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{await save(draft);setMessage('Ustawienia zapisane.')}catch{setMessage('Nie udało się zapisać ustawień.')}finally{setBusy(false)}}}>
    <label htmlFor="daily-target">Dzienny cel <strong>{draft.dailyTarget} pozycji</strong></label><input id="daily-target" type="range" min={5} max={40} value={draft.dailyTarget} onChange={e=>setDraft({...draft,dailyTarget:Number(e.target.value)})}/><p className="muted">Sugerowane 10 · wybierz tempo dla siebie.</p>
    <fieldset><legend>Tryb nauki</legend>{Object.entries(MODE_LABELS).map(([value,label])=><label className="radio-row" key={value}><input type="radio" name="mode" checked={draft.mode===value} onChange={()=>setDraft({...draft,mode:value as UserSettings['mode']})}/><span>{label}</span><small>{value==='maintenance'?'20':value==='balanced'?'40':'70'}% nowych</small></label>)}</fieldset>
    <label className="checkbox-row"><input type="checkbox" checked={!!draft.timedMode} onChange={e=>setDraft({...draft,timedMode:e.target.checked})}/><span>Tryb na czas<small>Przypominanie z odliczaniem, dopasowanym do karty.</small></span></label>
    <button className="primary" disabled={busy}>{busy?'Zapisywanie…':'Zapisz ustawienia'}</button>{message&&<p role="status">{message}</p>}
  </form></section>
}
