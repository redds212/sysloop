import { useState } from 'react'
import type { CategoryRow } from '../lib/database.types'
import { Confirm } from './shared'

export function CategoriesAdmin({categories,busy,save,onEditing}: {categories:CategoryRow[];busy:boolean;save:(c:CategoryRow)=>Promise<boolean>;onEditing:(editing:boolean)=>void}) {
  const [editing,setEditing]=useState<CategoryRow|null>(null), [discard,setDiscard]=useState(false)
  if(!editing)return <section><h2>Kategorie</h2><p className="muted">Nowe kategorie pojawiają się przy zastosowaniu importu.</p>{!categories.length&&<p className="admin-empty">Brak kategorii.</p>}{categories.map(c=><button className="admin-list-card" key={c.slug} onClick={()=>{setEditing(structuredClone(c));onEditing(true)}}><strong>{c.name}</strong><span className="muted">{c.group_name} · kolejność {c.sort_order} · {c.notes.length} notatek</span></button>)}</section>
  const patch=(value:Partial<CategoryRow>)=>setEditing({...editing,...value})
  return <form onSubmit={e=>{e.preventDefault();void save(editing).then(ok=>{if(ok){setEditing(null);onEditing(false)}})}}>
    <button type="button" className="text-button" disabled={busy} onClick={()=>setDiscard(true)}>← Wróć do kategorii</button><h2>{editing.name}</h2>
    <fieldset disabled={busy} className="admin-fields"><label>Nazwa kategorii<input required value={editing.name} onChange={e=>patch({name:e.target.value})}/></label><label>Grupa<select value={editing.group_name} onChange={e=>patch({group_name:e.target.value})}><option>Otwarcia</option><option>Obrona</option></select></label><label>Kolejność<input type="number" required step="1" value={editing.sort_order} onChange={e=>patch({sort_order:Number(e.target.value)})}/></label>
      <h2>Notatki</h2>{editing.notes.map((n,i)=><section className="panel" key={i}><label>Tytuł notatki {i+1}<input required value={n.title} onChange={e=>patch({notes:editing.notes.map((v,j)=>j===i?{...v,title:e.target.value}:v)})}/></label><label>Treść notatki {i+1}<textarea rows={6} value={n.body} onChange={e=>patch({notes:editing.notes.map((v,j)=>j===i?{...v,body:e.target.value}:v)})}/></label><div className="admin-actions"><button type="button" className="text-button" disabled={i===0} onClick={()=>{const notes=[...editing.notes];[notes[i],notes[i-1]]=[notes[i-1],notes[i]];patch({notes})}}>Przenieś wyżej</button><button type="button" className="text-button danger" onClick={()=>patch({notes:editing.notes.filter((_,j)=>j!==i)})}>Usuń notatkę {i+1}</button></div></section>)}
      <button type="button" className="text-button" onClick={()=>patch({notes:[...editing.notes,{title:'',body:''}]})}>+ Dodaj notatkę</button><button type="submit" className="primary">{busy?'Zapisywanie…':'Zapisz kategorię'}</button>
    </fieldset>{discard&&<Confirm title="Odrzucić formularz kategorii?" busy={false} onClose={()=>setDiscard(false)} onConfirm={()=>{setDiscard(false);setEditing(null);onEditing(false)}} label="Odrzuć zmiany"><p>Niezapisane zmiany zostaną utracone.</p></Confirm>}
  </form>
}
