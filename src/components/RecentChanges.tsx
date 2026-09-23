import type { Attempt, Card, Category } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { useRevisions } from '../hooks/useRevisions'
import { newLineKeys, revisionLines } from '../lib/revisions'
import { AuctionView, CallText } from './AuctionView'

export function RecentChanges({cards,categories,attempts,repository,busy,onStart,onRead}:{
  cards:Card[];categories:Category[];attempts:Attempt[];repository:LearningRepository;
  busy:boolean;onStart:(ids:string[])=>void;onRead:(id:string)=>void
}) {
  const {rows,error,retry}=useRevisions(repository)
  const revisions=(rows??[]).filter(r=>r.substantive&&cards.some(c=>c.id===r.card_id&&c.status==='active')).sort((a,b)=>b.changed_at.localeCompare(a.changed_at))
  const ids=[...new Set(revisions.map(r=>r.card_id))]
  return <section className="recent-changes"><h2>Ostatnio zmienione</h2>
    <p className="muted">Historia zatwierdzonych ustaleń, od najnowszych. NEW znika po pierwszej zapisanej ocenie odzywki. Trening korzysta z aktualnej wersji systemu i nie zmienia harmonogramu.</p>
    {error?<p className="error-note" role="alert">{error} <button className="text-button" onClick={retry}>Ponów</button></p>:!rows?<p role="status">Wczytywanie zmian…</p>:<>
      <button className="primary" disabled={busy||!ids.length} onClick={()=>onStart(ids)}>Ćwicz zmienione ({ids.length}) →</button>
      {!revisions.length&&<p className="panel">Brak zarejestrowanych zmian. Kolejne zatwierdzone aktualizacje pojawią się tutaj.</p>}
      {revisions.map(revision=>{
        const card=cards.find(c=>c.id===revision.card_id)!,differences=revisionLines(revision)
        const fresh=newLineKeys(card,attempts).filter(key=>differences.some(l=>l.after?.key===key&&l.after.changeId===card.lines.find(c=>c.key===key)?.changeId))
        return <article className="panel revision-panel" key={revision.id}>
          <div className="revision-heading"><span className="eyebrow">{categories.find(c=>c.slug===card.categorySlug)?.name}</span><time dateTime={revision.changed_at}>{new Date(revision.changed_at).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw',dateStyle:'medium',timeStyle:'short'})}</time></div>
          <AuctionView auction={revision.after_snapshot.auction} compact/>
          {revision.after_snapshot.context&&<p className="context-chip">{revision.after_snapshot.context}</p>}
          <p className="muted">{revision.previous_revision?`${revision.previous_revision} → ${revision.revision}`:`Nowa pozycja · ${revision.revision}`}{fresh.length>0&&<span className="new-chip" title="Jeszcze nieoceniona zmiana">NEW</span>}</p>
          <details className="revision-diff"><summary>Porównaj przed / po · {differences.length} odzywek</summary>
            <p className="muted">Zapis z tej aktualizacji. Pusta strona „Przed” oznacza nową odzywkę. Późniejsze zmiany mogą być już w aktualnej karcie.</p>
            {differences.map(line=><div className="revision-line" key={line.key}>
              <h3><CallText text={line.after?.label??line.before!.label}/>{!line.before&&<small>Dodano</small>}{!line.after&&<small>Usunięto</small>}</h3>
              <div className="before-after"><div><small>Przed</small><p className="verbatim">{line.before?.meaning??''}</p></div><div><small>Po</small><p className="verbatim">{line.after?.meaning??''}</p></div></div>
              {line.before&&line.after&&(line.before.label!==line.after.label||JSON.stringify(line.before.bids)!==JSON.stringify(line.after.bids))&&<p className="muted">Odzywka: <CallText text={line.before.label}/> → <CallText text={line.after.label}/></p>}
            </div>)}
            {revision.before_snapshot&&JSON.stringify(revision.before_snapshot.auction)!==JSON.stringify(revision.after_snapshot.auction)&&<div className="before-after"><div><small>Licytacja przed</small><AuctionView auction={revision.before_snapshot.auction} compact/></div><div><small>Licytacja po</small><AuctionView auction={revision.after_snapshot.auction} compact/></div></div>}
            {(['context','auctionNote','notes','section'] as const).map(key=>{
              const before=revision.before_snapshot?.[key],after=revision.after_snapshot[key]
              if(JSON.stringify(before??(key==='notes'?[]:''))===JSON.stringify(after??(key==='notes'?[]:'')))return null
              const label={context:'Warunek',auctionNote:'Uwaga do licytacji',notes:'Uwagi',section:'Sekcja'}[key]
              return <div key={key} className="revision-line"><h3>{label}</h3><div className="before-after"><div><small>Przed</small><p className="verbatim">{Array.isArray(before)?before.join('\n'):before??''}</p></div><div><small>Po</small><p className="verbatim">{Array.isArray(after)?after.join('\n'):after??''}</p></div></div></div>
            })}
          </details>
          <div className="secondary-actions"><button className="text-button" onClick={()=>onRead(card.id)}>Czytaj aktualną pozycję</button><button className="secondary" disabled={busy} onClick={()=>onStart([card.id])}>Ćwicz aktualną pozycję</button></div>
        </article>
      })}
    </>}
  </section>
}
