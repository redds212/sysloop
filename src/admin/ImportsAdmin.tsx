import { useEffect, useState } from 'react'
import type { CardRow } from '../lib/database.types'
import type { AdminRepository, ChangeKind, ImportDecisions, ImportRun, ImportSummary } from './types'
import { AuctionView } from '../components/AuctionView'
import { Confirm, CollapsedSourcePage } from './shared'
import { changeLabel, when } from './labels'
import { importLineDiff, supersededAt, undecidedRemovals } from './model'

function VersionBadge({run,runs}:{run:ImportSummary;runs:ImportSummary[]}) {
  const expired=supersededAt(run,runs)
  return <span className={`badge import-version ${expired?'legacy':run.status==='applied'?'current':''}`}>
    {expired?`Legacy · nieaktualny od ${when(expired)}`:run.status==='applied'?'Aktualna wersja':run.status==='pending'?'Oczekuje':'Odrzucony'}
  </span>
}

interface Props {runs:ImportSummary[];cards:CardRow[];repository:AdminRepository;busy:boolean;apply:(id:string,decisions:ImportDecisions)=>Promise<boolean>;discard:(id:string)=>Promise<boolean>}
export function ImportsAdmin(props:Props) {
  const [selected,setSelected]=useState<string|null>(null)
  if(selected)return <RunDetail key={selected} {...props} id={selected} onBack={()=>setSelected(null)}/>
  return <section><h2>Importy</h2><p className="muted">Przejrzyj różnice i strony źródłowe przed zastosowaniem importu. Legacy oznacza wersję zastąpioną przez później zastosowany import.</p>{!props.runs.length&&<p className="admin-empty">Brak importów. Przygotuje je lokalny importer.</p>}{props.runs.map(run=><button key={run.id} className="admin-list-card" onClick={()=>setSelected(run.id)}><span className="admin-row-head"><strong>{run.source_file}</strong><VersionBadge run={run} runs={props.runs}/></span><span className="muted">{run.category_slug} · {run.revision} · {when(run.created_at)}</span></button>)}</section>
}
function RunDetail({id,onBack,cards,runs,repository,busy,apply,discard}:Props&{id:string;onBack:()=>void}) {
  const [run,setRun]=useState<ImportRun|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0)
  const [tab,setTab]=useState<ChangeKind>('added'), [decisions,setDecisions]=useState<ImportDecisions>({}), [confirm,setConfirm]=useState<'apply'|'discard'|null>(null)
  const [onlyDifferences,setOnlyDifferences]=useState(false)
  useEffect(()=>{let active=true;void repository.getRun(id).then(value=>{if(active){setRun(value);setError('')}}).catch(()=>{if(active)setError('Nie udało się wczytać importu.')});return()=>{active=false}},[id,repository,retry])
  if(!run)return <section><button className="text-button" onClick={onBack}>← Importy</button><p role={error?'alert':'status'}>{error||'Wczytywanie importu…'}</p>{error&&<button className="secondary" onClick={()=>setRetry(n=>n+1)}>Spróbuj ponownie</button>}</section>
  const pending=run.status==='pending'
  const changes=run.proposal.changes
  const counts=(kind:ChangeKind)=>changes.filter(c=>c.kind===kind).length
  const unresolved=undecidedRemovals(run,decisions)
  const removals=changes.filter(c=>c.kind==='removed')
  const kept=removals.filter(c=>decisions[c.cardKey]?.skip===true).length
  const archived=removals.filter(c=>decisions[c.cardKey]?.skip===false).length
  const visibleChanges=changes.filter(c=>onlyDifferences?c.kind!=='unchanged':c.kind===tab)
  const setDecision=(key:string,patch:ImportDecisions[string])=>setDecisions({...decisions,[key]:{...decisions[key],...patch}})
  return <section><button className="text-button" disabled={busy} onClick={onBack}>← Importy</button><h2>{run.source_file}</h2><VersionBadge run={run} runs={runs}/><p className="muted">{run.revision} · {when(run.created_at)}</p>
    {!pending&&<p className="muted">Historyczna propozycja: porównanie z poprzednim PDF, nie z dzisiejszym stanem kart. Zachowane ręczne poprawki mogą różnić się od tej propozycji.</p>}
    <label className="admin-check"><input type="checkbox" checked={onlyDifferences} onChange={e=>setOnlyDifferences(e.target.checked)}/>Tylko różnice</label>
    {onlyDifferences?<p className="muted">Dodane, zmienione i znikające pozycje razem. Niezmienione odzywki są ukryte.</p>:<div className="admin-tabs" aria-label="Rodzaj zmian">{(Object.keys(changeLabel) as ChangeKind[]).map(kind=><button key={kind} className={tab===kind?'selected':''} aria-pressed={tab===kind} onClick={()=>setTab(kind)}>{changeLabel[kind]} ({counts(kind)})</button>)}</div>}
    {!visibleChanges.length&&<p className="admin-empty">{onlyDifferences?'Brak różnic.':'Brak pozycji w tej grupie.'}</p>}
    {visibleChanges.map(change=>{
      const current=cards.find(c=>c.card_key===change.cardKey), doc=change.card??current
      const diff=importLineDiff(change,current,pending).filter(line=>!onlyDifferences||line.kind!=='unchanged')
      return <article className="panel" key={change.cardKey}>
        <span className="badge">{change.kind==='removed'?'Zniknęła z PDF':changeLabel[change.kind]}</span>
        {doc?<><AuctionView auction={doc.auction} compact/>{doc.context&&<p className="context-chip">{doc.context}</p>}<p className="muted">{doc.section} · strona {doc.source_page}</p></>:<p className="verbatim">{change.cardKey}</p>}
        {pending&&change.kind==='changed'&&<p className="muted">„Po zmianie” uwzględnia poprawki z bazy zachowywane dla niezmienionych wierszy PDF.</p>}
        {doc?.review_flags.map(flag=><span key={flag} className="flag">{flag}</span>)}
        {doc?.verification_note&&<p className="verbatim muted">{doc.verification_note}</p>}
        {pending&&change.verification!=='ok'&&change.kind!=='removed'&&change.kind!=='unchanged'&&<p className="muted">Wymaga weryfikacji — pozostanie szkicem, chyba że zatwierdzisz ją poniżej.</p>}
        <details key={String(onlyDifferences)} open={onlyDifferences}><summary>Odzywki i różnice ({diff.length})</summary>{diff.map(line=><div className={`import-line-diff ${line.kind}`} key={line.key}><span className="badge">{changeLabel[line.kind as ChangeKind]}</span><div className="admin-columns"><div><h3>{pending?'Obecnie':'Poprzedni PDF'}</h3><p className="verbatim">{line.old?`${line.old.label} — ${line.old.meaning}`:'—'}</p></div><div><h3>{pending?'Po zmianie':'Propozycja importu'}</h3><p className="verbatim">{line.next?`${line.next.label} — ${line.next.meaning}`:'—'}</p></div></div></div>)}{onlyDifferences&&!diff.length&&<p className="muted">Zmiana dotyczy licytacji, uwag lub innych danych pozycji — rozwiń szczegóły poniżej.</p>}</details>
        {change.card&&<details><summary>Licytacja i uwagi</summary>{current&&<><h3>Obecnie</h3><AuctionView auction={current.auction}/><p className="verbatim">{[current.context,current.auction_note,...current.notes].filter(Boolean).join('\n\n')}</p></>}<h3>Po zmianie</h3><AuctionView auction={change.card.auction}/><p className="verbatim">{[change.card.context,change.card.auction_note,...change.card.notes].filter(Boolean).join('\n\n')}</p></details>}
        {change.pageImages?.map(path=><CollapsedSourcePage key={path} repository={repository} path={path}/>)}
        {!change.pageImages?.length&&(doc?.review_flags.length??0)>0&&<p className="muted">Brak przesłanego obrazu strony.</p>}
        {pending&&change.kind!=='unchanged'&&<fieldset disabled={busy}>
          {change.kind==='removed'&&<><legend>Ta sekwencja zniknęła z PDF. Co zrobić z kartą?</legend><label className="admin-check"><input type="radio" name={`removal-${change.cardKey}`} checked={decisions[change.cardKey]?.skip===true} onChange={()=>setDecision(change.cardKey,{skip:true})}/>Zachowaj w treningu — pominięcie w PDF jest uproszczeniem</label><label className="admin-check"><input type="radio" name={`removal-${change.cardKey}`} checked={decisions[change.cardKey]?.skip===false} onChange={()=>setDecision(change.cardKey,{skip:false})}/>Archiwizuj kartę — usuń z treningu, zachowaj historię</label></>}
          {change.kind==='changed'&&<label className="admin-check"><input type="checkbox" checked={!!decisions[change.cardKey]?.cosmetic} onChange={e=>setDecision(change.cardKey,{cosmetic:e.target.checked})}/>Zmiana kosmetyczna — bez wpływu na powtórki</label>}
          {(change.kind==='added'||change.kind==='changed')&&<label className="admin-check"><input type="checkbox" checked={!!decisions[change.cardKey]?.approve} onChange={e=>setDecision(change.cardKey,{approve:e.target.checked})}/>Sprawdziłem kartę — zatwierdź i usuń flagi</label>}
        </fieldset>}
      </article>
    })}
    <details className="panel"><summary>Notatki kategorii po imporcie</summary>{run.raw_snapshot.category.notes?.map((n,i)=><div key={i}><h3>{n.title}</h3><p className="verbatim">{n.body}</p></div>)}</details>
    {pending&&unresolved.length>0&&<div className="import-removal-warning"><p>Sekwencje znikające z PDF bez Twojej decyzji: {unresolved.length}. Wybierz dla każdej zachowanie lub archiwizację.</p><button className="secondary" disabled={busy} onClick={()=>{setOnlyDifferences(false);setTab('removed')}}>Przejrzyj zniknięte sekwencje ({unresolved.length})</button></div>}
    {pending&&<div className="admin-actions"><button className="primary" disabled={busy||unresolved.length>0} onClick={()=>setConfirm('apply')}>Zastosuj import</button><button className="text-button danger" disabled={busy} onClick={()=>setConfirm('discard')}>Odrzuć import</button></div>}
    {confirm&&<Confirm title={confirm==='apply'?'Zastosować import?':'Odrzucić import?'} busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>{if(confirm==='apply'&&unresolved.length)return;void (confirm==='apply'?apply(run.id,decisions):discard(run.id)).then(ok=>{setConfirm(null);if(ok)onBack()})}} label={confirm==='apply'?'Zastosuj import':'Odrzuć import'}><p>{run.source_file}</p>{confirm==='apply'?<><p>Dodane: {counts('added')} · zmienione: {counts('changed')} · archiwizowane: {archived} · zachowane mimo braku w PDF: {kept}.</p>{removals.map(c=>{const card=cards.find(card=>card.card_key===c.cardKey);return <div key={c.cardKey}>{card?<AuctionView auction={card.auction} compact/>:<p>{c.cardKey}</p>}<strong>{decisions[c.cardKey]?.skip?'Zachowaj w treningu':'Archiwizuj — wyłącz z treningu'}</strong></div>})}<p className="muted">Historia odpowiedzi pozostaje zachowana. Zmiany merytoryczne przyspieszą późniejsze powtórki do jutra według czasu Warszawy. Niezweryfikowane karty pozostaną szkicami. Notatki kategorii zostaną zastąpione notatkami z importu.</p></>:<p className="muted">Ten import nie zmieni kart ani postępów.</p>}</Confirm>}
  </section>
}
