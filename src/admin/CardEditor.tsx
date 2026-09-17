import { useState } from 'react'
import type { CardRow } from '../lib/database.types'
import { AuctionView } from '../components/AuctionView'
import { prepareCard, type CallDraft, type LineDraft } from './model'
import { Confirm, SourcePage } from './shared'
import type { AdminRepository } from './types'

interface Props {card:CardRow; cards:CardRow[]; repository:AdminRepository; busy:boolean; save:(card:CardRow,substantive:boolean,revision:string)=>Promise<boolean>; onBack:()=>void}
export function CardEditor({card,cards,repository,busy,save,onBack}:Props) {
  const [edited,setEdited]=useState(()=>structuredClone(card))
  const [calls,setCalls]=useState<CallDraft[]>(()=>card.auction.map(c=>({side:c.side,text:c.alts.join('/'),qualifier:c.qualifier??'',implicit:c.implicit})))
  const [lines,setLines]=useState<LineDraft[]>(()=>card.lines.map(l=>({...l,bids:l.bids.join('/')})))
  const [error,setError]=useState(''), [dirty,setDirty]=useState(false), [discard,setDiscard]=useState(false)
  const [candidate,setCandidate]=useState<CardRow|null>(null), [substantive,setSubstantive]=useState(true), [revision,setRevision]=useState(card.source_revision)
  function patch(update:Partial<CardRow>) {setEdited({...edited,...update});setDirty(true)}
  function changeCall(index:number,update:Partial<CallDraft>) {setCalls(calls.map((c,i)=>i===index?{...c,...update}:c));setDirty(true)}
  function changeLine(index:number,update:Partial<LineDraft>) {setLines(lines.map((l,i)=>i===index?{...l,...update}:l));setDirty(true)}
  function move(index:number,delta:number) {const next=[...lines];[next[index],next[index+delta]]=[next[index+delta],next[index]];setLines(next);setDirty(true)}
  function review(approve=false) {
    try {
      const prepared=prepareCard(card,approve?{...edited,status:'active',review_flags:[]}:edited,calls,lines,cards)
      if(prepared.status==='active' && prepared.review_flags.length) throw new Error('Usuń rozstrzygnięte flagi lub użyj „Zatwierdź kartę”.')
      setCandidate(prepared);setError('')
    } catch(e){setError(e instanceof Error?e.message:'Sprawdź wprowadzone dane.')}
  }
  return <section className="admin-editor">
    <button className="text-button" disabled={busy} onClick={()=>dirty?setDiscard(true):onBack()}>← Wróć do kart</button>
    <h1>Edytuj pozycję</h1><p className="muted">{card.category_slug} · strona {card.source_page} · {card.source_revision}</p>
    <AuctionView auction={card.auction}/>
    <fieldset disabled={busy} className="admin-fields">
      <label>Sekcja<input value={edited.section} onChange={e=>patch({section:e.target.value})}/></label>
      <section className="panel"><h2>Licytacja przed znakiem zapytania</h2><p className="muted">Każdy wiersz to jedna odzywka. Alternatywy oddziel ukośnikiem. Pasy domyślne zostaną uzupełnione.</p>
        {calls.map((c,i)=><div className="admin-call-row" key={i}>
          <label>Strona {i+1}<select value={c.side} onChange={e=>changeCall(i,{side:e.target.value as CallDraft['side'],implicit:undefined})}><option value="we">My</option><option value="they">Oni</option></select></label>
          <label>Odzywka {i+1}<input value={c.text} onChange={e=>changeCall(i,{text:e.target.value,implicit:undefined})}/></label>
          <label>Kwalifikator {i+1}<input value={c.qualifier} onChange={e=>changeCall(i,{qualifier:e.target.value})}/></label>
          <button className="text-button danger" aria-label={`Usuń odzywkę licytacji ${i+1}`} onClick={()=>{setCalls(calls.filter((_,n)=>n!==i));setDirty(true)}}>Usuń</button>
          {c.implicit&&<small className="muted">Pas domyślny</small>}
        </div>)}
        <button className="text-button" onClick={()=>{setCalls([...calls,{side:'we',text:'',qualifier:''}]);setDirty(true)}}>+ Dodaj odzywkę licytacji</button>
      </section>
      <label>Kontekst<input value={edited.context??''} onChange={e=>patch({context:e.target.value||null})}/></label>
      <label>Uwaga do licytacji<textarea value={edited.auction_note??''} onChange={e=>patch({auction_note:e.target.value||null})}/></label>
      <h2>Kontynuacje</h2>
      {lines.map((l,i)=><section key={l.key} className="panel editor-line">
        <div className="admin-row-head"><h3>Odzywka {i+1}</h3><div className="admin-actions"><button className="icon-button" aria-label={`Przesuń odzywkę ${i+1} w górę`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button className="icon-button" aria-label={`Przesuń odzywkę ${i+1} w dół`} disabled={i===lines.length-1} onClick={()=>move(i,1)}>↓</button><button className="text-button danger" onClick={()=>{setLines(lines.filter((_,n)=>n!==i));setDirty(true)}}>Usuń odzywkę {i+1}</button></div></div>
        <div className="admin-columns"><label>Etykieta {i+1}<input value={l.label} onChange={e=>changeLine(i,{label:e.target.value})}/></label><label>Odzywki i alternatywy {i+1}<input value={l.bids} onChange={e=>changeLine(i,{bids:e.target.value})}/></label></div>
        <label>Znaczenie {i+1}<textarea rows={4} value={l.meaning} onChange={e=>changeLine(i,{meaning:e.target.value})}/></label>
      </section>)}
      <button className="text-button" onClick={()=>{setLines([...lines,{key:crypto.randomUUID(),label:'',bids:'',meaning:''}]);setDirty(true)}}>+ Dodaj kontynuację</button>
      <h2>Uwagi do karty</h2>{edited.notes.map((note,i)=><div key={i}><label>Uwaga {i+1}<textarea value={note} onChange={e=>patch({notes:edited.notes.map((n,j)=>j===i?e.target.value:n)})}/></label><button className="text-button danger" onClick={()=>patch({notes:edited.notes.filter((_,j)=>j!==i)})}>Usuń uwagę {i+1}</button></div>)}
      <button className="text-button" onClick={()=>patch({notes:[...edited.notes,'']})}>+ Dodaj uwagę</button>
      <label>Status<select value={edited.status} onChange={e=>patch({status:e.target.value as CardRow['status']})}><option value="draft">Szkic</option><option value="active">Aktywna</option><option value="archived">Archiwum</option></select></label>
      {edited.review_flags.length>0&&<div><h3>Flagi do sprawdzenia</h3>{edited.review_flags.map(flag=><div className="admin-row-head" key={flag}><span className="flag">{flag}</span><button className="text-button" onClick={()=>patch({review_flags:edited.review_flags.filter(f=>f!==flag)})}>Rozstrzygnięta — usuń flagę</button></div>)}</div>}
      <label>Notatka weryfikacji<textarea value={edited.verification_note??''} onChange={e=>patch({verification_note:e.target.value||null})}/></label>
    </fieldset>
    <SourcePage key={`${card.id}:${card.updated_at}`} repository={repository} card={card}/>
    {error&&<p role="alert" className="error-note">{error}</p>}
    <div className="admin-actions"><button className="primary" disabled={busy} onClick={()=>review()}>Przejrzyj i zapisz</button>{edited.status==='draft'&&<button className="secondary" disabled={busy} onClick={()=>review(true)}>Zatwierdź kartę</button>}</div>
    {candidate&&<Confirm title="Zapis karty" busy={busy} onClose={()=>setCandidate(null)} label="Zapisz kartę" onConfirm={()=>{void save(candidate,substantive,revision).then(ok=>{setCandidate(null);if(ok)onBack()})}}>
      <p>{candidate.status==='active'?'Karta będzie dostępna w nauce.':candidate.status==='archived'?'Karta zniknie z nauki; historia pozostanie.':'Karta pozostanie szkicem widocznym dla administratora.'}</p>
      <AuctionView auction={candidate.auction} compact/>{candidate.context&&<p className="context-chip">{candidate.context}</p>}<p className="muted">Liczba odzywek po zapisie: {candidate.lines.length}</p>
      <label className="admin-check"><input type="radio" name="change-type" checked={substantive} onChange={()=>setSubstantive(true)}/>Zmiana merytoryczna</label><p className="muted">Zmienione odzywki zostaną wyróżnione. Późniejsze powtórki wrócą jutro według czasu Warszawy; poziom pozostanie bez zmian.</p>
      <label className="admin-check"><input type="radio" name="change-type" checked={!substantive} onChange={()=>setSubstantive(false)}/>Zmiana kosmetyczna</label><p className="muted">Poprawka zapisu bez wyróżnienia i bez zmiany harmonogramu.</p>
      <label>Etykieta zmiany<input value={revision} onChange={e=>setRevision(e.target.value)}/></label>
    </Confirm>}
    {discard&&<Confirm title="Odrzucić niezapisane zmiany?" busy={false} onClose={()=>setDiscard(false)} onConfirm={onBack} label="Odrzuć zmiany"><p>Zmiany tego formularza nie zostały zapisane.</p></Confirm>}
  </section>
}
