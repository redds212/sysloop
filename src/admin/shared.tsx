import { useEffect, useState, type ReactNode } from 'react'
import { Modal } from '../components/Modal'
import type { CardRow } from '../lib/database.types'
import type { AdminRepository } from './types'

export function Confirm({title, children, busy, onConfirm, onClose, label='Potwierdź'}: {title:string; children:ReactNode; busy:boolean; onConfirm:()=>void; onClose:()=>void; label?:string}) {
  return <Modal title={title} onClose={()=>{if(!busy)onClose()}}><div className="admin-confirm">{children}</div><div className="admin-actions"><button className="primary" disabled={busy} onClick={onConfirm}>{busy?'Zapisywanie…':label}</button><button className="text-button" disabled={busy} onClick={onClose}>Anuluj</button></div></Modal>
}
export function SourcePage({repository, path, card}: {repository:AdminRepository; path?:string; card?:CardRow}) {
  const [url,setUrl]=useState(''), [state,setState]=useState('Wczytywanie strony źródłowej…'), [retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true
    void (async()=>{
      try {
        const source=path??(card?await repository.cardPage(card):null)
        const signed=source?await repository.pageUrl(source):''
        if(active){setUrl(signed);setState(signed?'':'Obraz tej strony nie został przesłany.')}
      } catch {if(active){setUrl('');setState('Nie udało się wczytać strony źródłowej.')}}
    })()
    return()=>{active=false}
  },[repository,path,card,retry])
  return <section className="source-page"><h3>Strona źródłowa{card?` · ${card.source_page}`:''}</h3>{url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Strona źródłowa do porównania z kartą" onError={()=>{setUrl('');setState('Podgląd wygasł lub jest niedostępny.')}}/></a>:<p className="muted" role="status">{state}</p>}<button className="text-button" onClick={()=>setRetry(n=>n+1)}>Odśwież obraz</button></section>
}
export function CollapsedSourcePage({repository,path}: {repository:AdminRepository;path:string}) {
  const [open,setOpen]=useState(false)
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Porównaj ze stroną źródłową · {path.split('/').at(-1)}</summary>{open&&<SourcePage repository={repository} path={path}/>}</details>
}
