import { useEffect, useState } from 'react'
import type { CardRow } from '../lib/database.types'
import type { AdminRepository, ChangeKind, ImportDecisions, ImportRun, ImportSummary } from './types'
import { AuctionView } from '../components/AuctionView'
import { Confirm, CollapsedSourcePage } from './shared'
import { changeLabel, when } from './labels'
import { effectiveLines, lineDiff } from './model'

interface Props {runs:ImportSummary[];cards:CardRow[];repository:AdminRepository;busy:boolean;apply:(id:string,decisions:ImportDecisions)=>Promise<boolean>;discard:(id:string)=>Promise<boolean>}
export function ImportsAdmin(props:Props) {
  const [selected,setSelected]=useState<string|null>(null)
  if(selected)return <RunDetail key={selected} {...props} id={selected} onBack={()=>setSelected(null)}/>
  return <section><h2>Importy</h2><p className="muted">Przejrzyj różnice i strony źródłowe przed zastosowaniem importu.</p>{!props.runs.length&&<p className="admin-empty">Brak importów. Przygotuje je lokalny importer.</p>}{props.runs.map(run=><button key={run.id} className="admin-list-card" onClick={()=>setSelected(run.id)}><span className="admin-row-head"><strong>{run.source_file}</strong><span className="badge">{run.status==='pending'?'Oczekuje':run.status==='applied'?'Zastosowany':'Odrzucony'}</span></span><span className="muted">{run.category_slug} · {run.revision} · {when(run.created_at)}</span></button>)}</section>
}
function RunDetail({id,onBack,cards,repository,busy,apply,discard}:Props&{id:string;onBack:()=>void}) {
  const [run,setRun]=useState<ImportRun|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0)
  const [tab,setTab]=useState<ChangeKind>('added'), [decisions,setDecisions]=useState<ImportDecisions>({}), [confirm,setConfirm]=useState<'apply'|'discard'|null>(null)
  useEffect(()=>{let active=true;void repository.getRun(id).then(value=>{if(active){setRun(value);setError('')}}).catch(()=>{if(active)setError('Nie udało się wczytać importu.')});return()=>{active=false}},[id,repository,retry])
  if(!run)return <section><button className="text-button" onClick={onBack}>← Importy</button><p role={error?'alert':'status'}>{error||'Wczytywanie importu…'}</p>{error&&<button className="secondary" onClick={()=>setRetry(n=>n+1)}>Spróbuj ponownie</button>}</section>
  const pending=run.status==='pending'
  const changes=run.proposal.changes
  const counts=(kind:ChangeKind)=>changes.filter(c=>c.kind===kind).length
  const setDecision=(key:string,patch:ImportDecisions[string])=>setDecisions({...decisions,[key]:{...decisions[key],...patch}})
  return <section><button className="text-button" disabled={busy} onClick={onBack}>← Importy</button><h2>{run.source_file}</h2><p className="muted">{run.revision} · {when(run.created_at)} · {pending?'Oczekuje na decyzję':run.status==='applied'?'Zastosowany':'Odrzucony'}</p>
    <div className="admin-tabs" aria-label="Rodzaj zmian">{(Object.keys(changeLabel) as ChangeKind[]).map(kind=><button key={kind} className={tab===kind?'selected':''} aria-pressed={tab===kind} onClick={()=>setTab(kind)}>{changeLabel[kind]} ({counts(kind)})</button>)}</div>
    {!changes.some(c=>c.kind===tab)&&<p className="admin-empty">Brak pozycji w tej grupie.</p>}
    {changes.filter(c=>c.kind===tab).map(change=>{
      const current=cards.find(c=>c.card_key===change.cardKey), doc=change.card??current
      const merged=effectiveLines(change,current)
      const before=current?.lines??change.oldRaw?.lines??[]
      const diff=lineDiff(before,change.kind==='removed'?[]:change.kind==='unchanged'?before:merged)
      return <article className="panel" key={change.cardKey}>
        {doc?<><AuctionView auction={doc.auction} compact/>{doc.context&&<p className="context-chip">{doc.context}</p>}<p className="muted">{doc.section} · strona {doc.source_page}</p></>:<p className="verbatim">{change.cardKey}</p>}
        {change.kind==='changed'&&<p className="muted">„Po zmianie” uwzględnia poprawki z bazy zachowywane dla niezmienionych wierszy PDF.</p>}
        {doc?.review_flags.map(flag=><span key={flag} className="flag">{flag}</span>)}
        {doc?.verification_note&&<p className="verbatim muted">{doc.verification_note}</p>}
        {change.verification!=='ok'&&change.kind!=='removed'&&change.kind!=='unchanged'&&<p className="muted">Wymaga weryfikacji — pozostanie szkicem, chyba że zatwierdzisz ją poniżej.</p>}
        <details><summary>Odzywki i różnice ({diff.length})</summary>{diff.map(line=><div className={`import-line-diff ${line.kind}`} key={line.key}><span className="badge">{changeLabel[line.kind as ChangeKind]}</span><div className="admin-columns"><div><h3>Obecnie</h3><p className="verbatim">{line.old?`${line.old.label} — ${line.old.meaning}`:'—'}</p></div><div><h3>Po zmianie</h3><p className="verbatim">{line.next?`${line.next.label} — ${line.next.meaning}`:'—'}</p></div></div></div>)}</details>
        {change.card&&<details><summary>Licytacja i uwagi</summary>{current&&<><h3>Obecnie</h3><AuctionView auction={current.auction}/><p className="verbatim">{[current.context,current.auction_note,...current.notes].filter(Boolean).join('\n\n')}</p></>}<h3>Po zmianie</h3><AuctionView auction={change.card.auction}/><p className="verbatim">{[change.card.context,change.card.auction_note,...change.card.notes].filter(Boolean).join('\n\n')}</p></details>}
        {change.pageImages?.map(path=><CollapsedSourcePage key={path} repository={repository} path={path}/>)}
        {!change.pageImages?.length&&(doc?.review_flags.length??0)>0&&<p className="muted">Brak przesłanego obrazu strony.</p>}
        {pending&&change.kind!=='unchanged'&&<fieldset disabled={busy}>
          {change.kind==='changed'&&<label className="admin-check"><input type="checkbox" checked={!!decisions[change.cardKey]?.cosmetic} onChange={e=>setDecision(change.cardKey,{cosmetic:e.target.checked})}/>Zmiana kosmetyczna — bez wpływu na powtórki</label>}
          {(change.kind==='added'||change.kind==='changed')&&<label className="admin-check"><input type="checkbox" checked={!!decisions[change.cardKey]?.approve} onChange={e=>setDecision(change.cardKey,{approve:e.target.checked})}/>Sprawdziłem kartę — zatwierdź i usuń flagi</label>}
        </fieldset>}
      </article>
    })}
    <details className="panel"><summary>Notatki kategorii po imporcie</summary>{run.raw_snapshot.category.notes?.map((n,i)=><div key={i}><h3>{n.title}</h3><p className="verbatim">{n.body}</p></div>)}</details>
    {pending&&<div className="admin-actions"><button className="primary" disabled={busy} onClick={()=>setConfirm('apply')}>Zastosuj import</button><button className="text-button danger" disabled={busy} onClick={()=>setConfirm('discard')}>Odrzuć import</button></div>}
    {confirm&&<Confirm title={confirm==='apply'?'Zastosować import?':'Odrzucić import?'} busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>{void (confirm==='apply'?apply(run.id,decisions):discard(run.id)).then(ok=>{setConfirm(null);if(ok)onBack()})}} label={confirm==='apply'?'Zastosuj import':'Odrzuć import'}><p>{run.source_file}</p>{confirm==='apply'?<><p>Dodane: {counts('added')} · zmienione: {counts('changed')} · archiwizowane: {counts('removed')}.</p><p className="muted">Zmiany merytoryczne przyspieszą późniejsze powtórki do jutra według czasu Warszawy. Niezweryfikowane karty pozostaną szkicami. Notatki kategorii zostaną zastąpione notatkami z importu.</p></>:<p className="muted">Ten import nie zmieni kart ani postępów.</p>}</Confirm>}
  </section>
}
