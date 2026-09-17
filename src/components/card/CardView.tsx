import { useCallback, useEffect, useState } from 'react'
import type { Attempt, AttemptPhase, Card, Category, SRSEntry } from '../../types'
import type { LearningRepository } from '../../lib/learningRepository'
import { grade, errorNoun } from '../../lib/grading'
import { timerLimit } from '../../lib/timer'
import { changedSinceLoad } from '../../lib/contentChanges'
import { useCardTimer } from '../../hooks/useCardTimer'
import { AuctionView, CallText } from '../AuctionView'
import { Modal } from '../Modal'
import { NotesView } from '../NotesView'
import { ReportCardButton } from '../ReportCardButton'

interface Props { card: Card; category?: Category; baseline: SRSEntry; timed: boolean; phase: AttemptPhase; repository: LearningRepository; onRate: (attempt: Attempt) => Promise<void>; onRevealed: () => void }
export function CardView({card,category,baseline,timed,phase,repository,onRate,onRevealed}:Props) {
  const [revealed,setRevealed]=useState(false), [timedOut,setTimedOut]=useState(false), [missed,setMissed]=useState<string[]>([])
  const [notes,setNotes]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<Attempt|null>(null)
  const [loadedEntry]=useState(baseline)
  const expire=useCallback(()=>{setTimedOut(true);setRevealed(true);onRevealed()},[onRevealed])
  const limit=timerLimit(card.lines.length,loadedEntry.consecutiveCorrect)
  const timer=useCardTimer(timed,limit,revealed,expire)
  const reveal=useCallback(()=>{if(timer.expiredNow())setTimedOut(true);setRevealed(true);onRevealed()},[timer,onRevealed])
  useEffect(()=>{
    if(revealed)return
    const handle=(e:KeyboardEvent)=>{if((e.key===' '||e.key==='Enter')&&e.target===document.body){e.preventDefault();reveal()}}
    window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)
  },[revealed,reveal])
  async function rate() {
    if(busy)return
    const attempt=pending??grade(card,missed,timedOut,phase)
    setPending(attempt);setBusy(true);setError('')
    try {await onRate(attempt)} catch {setError('Zapis nie został potwierdzony. Przywróć połączenie i ponów zapis.')} finally {setBusy(false)}
  }
  return <article className="learning-card">
    <div className="card-breadcrumb"><span>{category?.name}</span><span className="section-title">{card.section}</span></div>
    <div className="position-heading"><h1>{phase==='buffer'?'Jeszcze raz, spokojnie.':'Co oznaczają te odzywki?'}</h1><span className="counter">{card.lines.length} odzywek</span></div>
    <AuctionView auction={card.auction}/>{card.context&&<p className="context-chip">{card.context}</p>}
    <div className="card-instruction"><span>{revealed?(timedOut?'Czas minął — zaliczone jako błąd':'Zaznacz każdą odzywkę, której znaczenie umknęło.'):'Przypomnij sobie znaczenie każdej odzywki.'}</span>
      {timed&&!revealed&&<span className={`timer ${timer.remaining<=10?'warning':''}`} role="timer" aria-label="Pozostały czas">{Math.floor(timer.remaining/60)}:{String(timer.remaining%60).padStart(2,'0')}</span>}
    </div>
    <div className="line-list">{card.lines.map(line=><div key={line.key} className={`line-row ${missed.includes(line.key)?'missed':''}`}>
      <div className="line-label"><CallText text={line.label}/></div>
      {!revealed?<div className="meaning-blank" aria-label="Znaczenie ukryte"><span/></div>:<button disabled={timedOut||!!pending} className="meaning-button" aria-pressed={missed.includes(line.key)} onClick={()=>setMissed(prev=>prev.includes(line.key)?prev.filter(k=>k!==line.key):[...prev,line.key])}>
        <span className="verbatim">{line.meaning}</span>{changedSinceLoad(line,loadedEntry.lastSeen)&&<small className="change-chip">zmiana w {line.changedIn}</small>}
        <span className="mark" aria-hidden="true">{missed.includes(line.key)?'✕':'○'}</span>
      </button>}
    </div>)}</div>
    {revealed&&(card.notes.length>0||card.auctionNote)&&<section className="notes-block"><h2>Uwagi</h2>{[...card.notes,...(card.auctionNote?[card.auctionNote]:[])].map((note,i)=><p className="verbatim" key={i}>{note}</p>)}</section>}
    {revealed&&<div className="secondary-actions"><ReportCardButton card={card} category={category} repository={repository}/>{category&&<button className="text-button" onClick={()=>setNotes(true)}>Notatki</button>}</div>}
    {error&&<p className="error-note" role="alert">{error}</p>}
    <footer className="card-action"><p className="muted">{revealed?'Tylko komplet poprawnych odpowiedzi zalicza kartę.':'Znaczenia odsłonisz jednocześnie.'}</p>
      <button className={`primary ${revealed&&(timedOut||missed.length)?'retry':''}`} disabled={busy} onClick={()=>{if(revealed)void rate();else reveal()}}>{busy?'Zapisywanie…':error?'Ponów zapis':!revealed?'Pokaż':timedOut?'Dalej':missed.length?`Dalej · ${missed.length} ${errorNoun(missed.length)}`:'Wszystko dobrze'}</button>
    </footer>
    {notes&&category&&<Modal title="Notatki kategorii" onClose={()=>setNotes(false)}><NotesView category={category}/></Modal>}
  </article>
}
