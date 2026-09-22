import { useState } from 'react'
import type { Attempt, Card, Category } from '../types'
import { difficultCards, type DifficultFilter } from '../lib/difficult'
import { AuctionView, CallText } from './AuctionView'

export function DifficultCards({cards,categories,attempts,stars,onStart,onRead,onStar,busy}: {
  cards:Card[];categories:Category[];attempts:Attempt[];stars:string[];
  onStart:(ids:string[])=>void;onRead:(id:string)=>void;onStar:(id:string,starred:boolean)=>Promise<void>;busy:boolean
}) {
  const [filter,setFilter]=useState<DifficultFilter>('all')
  const items=difficultCards(cards,attempts,stars,filter)
  return <section className="difficult-screen"><p className="eyebrow">Dodatkowa praktyka</p><h1>Trudne sekwencje</h1>
    <p className="muted">Zbieraj nieintuicyjne pozycje pod ★. Częste błędy pojawiają się tu automatycznie, gdy ta sama odzywka była błędna co najmniej 2 razy w ostatnich 5 pełnych ocenach.</p>
    <p className="muted">Ten trening nie zmienia harmonogramu ani statystyki częstych błędów. Gwiazdki usuwasz samodzielnie.</p>
    <div className="difficult-filters" role="group" aria-label="Filtr trudnych sekwencji">{([['all','Wszystkie'],['starred','Moje ★'],['frequent','Częste błędy']] as const).map(([value,label])=><button key={value} className="secondary" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    <button className="primary" disabled={busy||!items.length} onClick={()=>onStart(items.map(item=>item.card.id))}>Ćwicz trudne ({items.length}) →</button>
    {!items.length&&<p className="panel empty-difficult">Brak pozycji w tym filtrze. Możesz oznaczyć dowolną kartę gwiazdką.</p>}
    <div className="difficult-list">{items.map(({card,starred,lines})=><article key={card.id} className="panel">
      <p className="eyebrow">{categories.find(c=>c.slug===card.categorySlug)?.name}</p><AuctionView auction={card.auction} compact/>
      <p className="section-title">{card.section}</p>{card.context&&<p className="context-chip">{card.context}</p>}
      {lines.length>0&&<ul className="difficult-lines">{lines.map(({line,misses,appearances,lastMiss})=><li key={line.key}><CallText text={line.label}/> · {misses}/{appearances} błędnych · ostatnio {new Date(lastMiss).toLocaleDateString('pl-PL',{timeZone:'Europe/Warsaw'})}</li>)}</ul>}
      <div className="secondary-actions"><button className="text-button" disabled={busy} aria-pressed={starred} onClick={()=>void onStar(card.id,!starred).catch(()=>{})}>{starred?'★ Usuń z moich':'☆ Dodaj do moich'}</button><button className="text-button" onClick={()=>onRead(card.id)}>Czytaj</button><button className="secondary" disabled={busy} onClick={()=>onStart([card.id])}>Ćwicz</button></div>
    </article>)}</div>
  </section>
}
