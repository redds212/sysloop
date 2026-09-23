import { useCallback, useEffect, useState } from 'react'
import type { Attempt, AttemptPhase, Card, Category, SRSEntry } from '../../types'
import type { LearningRepository } from '../../lib/learningRepository'
import { grade, errorNoun, callNoun } from '../../lib/grading'
import { timerLimit } from '../../lib/timer'
import { changedSinceLoad } from '../../lib/contentChanges'
import { useCardTimer } from '../../hooks/useCardTimer'
import { AuctionView, CallText } from '../AuctionView'
import { Modal } from '../Modal'
import { NotesView } from '../NotesView'
import { SourcePreviewButton } from '../SourcePreviewButton'
import { Icon } from '../Icon'
import { newLineKeys, previousLine } from '../../lib/revisions'
import { useRevisions } from '../../hooks/useRevisions'

interface Props { attempts?:Attempt[];revisionTraining?:boolean;previousMissed?: string[]; scope?: Attempt['scope']; card: Card; category?: Category; baseline: SRSEntry; timed: boolean; phase: AttemptPhase; repository: LearningRepository; onRate: (attempt: Attempt) => Promise<void>; onRevealed: () => void }
const writingPreference='sysloop.write-meanings'
export function CardView({card,category,baseline,timed,phase,repository,onRate,onRevealed,previousMissed=[],scope='full',attempts=[],revisionTraining=false}:Props) {
  const [revealed,setRevealed]=useState(false), [timedOut,setTimedOut]=useState(false), [missed,setMissed]=useState<string[]>([])
  const [considered,setConsidered]=useState<string[]>([]),[answers,setAnswers]=useState<Record<string,string>>({})
  const [writing,setWriting]=useState(()=>{try{return revisionTraining||localStorage.getItem(writingPreference)==='true'}catch{return revisionTraining}})
  const fresh=newLineKeys(card,attempts)
  const history=useRevisions(repository,revisionTraining&&revealed,card.id)
  const [notes,setNotes]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<Attempt|null>(null)
  const [loadedEntry]=useState(baseline)
  const expire=useCallback(()=>{setTimedOut(true);setRevealed(true);onRevealed()},[onRevealed])
  const limit=timerLimit(card.lines.length,loadedEntry.consecutiveCorrect)
  const timer=useCardTimer(timed,limit,revealed,expire)
  const reveal=useCallback(()=>{if(timer.expiredNow())setTimedOut(true);setRevealed(true);onRevealed()},[timer,onRevealed])
  function toggleConsidered(key:string) {setConsidered(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key])}
  function changeAnswer(key:string,value:string) {
    setAnswers(prev=>({...prev,[key]:value}))
    setConsidered(prev=>value.trim()?(prev.includes(key)?prev:[...prev,key]):prev.filter(k=>k!==key))
  }
  function changeWriting(value:boolean) {
    setWriting(value)
    // Persist only the display preference; answers stay in this card attempt's memory.
    try {localStorage.setItem(writingPreference,String(value))} catch {/* Storage may be unavailable. */}
  }
  useEffect(()=>{
    if(revealed)return
    const handle=(e:KeyboardEvent)=>{if((e.key===' '||e.key==='Enter')&&e.target===document.body){e.preventDefault();reveal()}}
    window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle)
  },[revealed,reveal])
  async function rate() {
    if(busy)return
    const attempt=pending??{...grade(card,missed,timedOut,phase),scope}
    setPending(attempt);setBusy(true);setError('')
    try {await onRate(attempt)} catch {setError('Zapis nie został potwierdzony. Przywróć połączenie i ponów zapis.')} finally {setBusy(false)}
  }
  return <article className="learning-card">
    <div className="card-breadcrumb"><span>{category?.name}</span><span className="section-title">{card.section}</span></div>
    <div className="position-heading"><h1>{phase==='buffer'?'Jeszcze raz, spokojnie.':'Co oznaczają te odzywki?'}</h1><span className="counter">{card.lines.length} {callNoun(card.lines.length)}</span></div>
    {scope==='partial'&&<p className="correction-note">Poprawiasz tylko wcześniej błędne odzywki. Cała pozycja wróci jutro.</p>}
    <AuctionView auction={card.auction}/>{card.context&&<p className="context-chip">{card.context}</p>}
    <div className="card-instruction"><span>{revealed?(timedOut?'Czas minął — zaliczone jako błąd':'Zaznacz każdą odzywkę, której znaczenie umknęło.'):'Przypomnij sobie znaczenie każdej odzywki.'}</span>
      {timed&&!revealed&&<span className={`timer ${timer.remaining<=10?'warning':''}`} role="timer" aria-label="Pozostały czas">{Math.floor(timer.remaining/60)}:{String(timer.remaining%60).padStart(2,'0')}</span>}
    </div>
    {!revealed&&<div className="recall-tools">
      <label className="writing-toggle"><input type="checkbox" checked={writing} onChange={e=>changeWriting(e.target.checked)}/>Wpisuj własne znaczenia</label>
      <span className="counter" aria-live="polite">Przemyślane: {considered.length} / {card.lines.length}</span>
      <p>{writing?'Wpisanie tekstu zaznacza odzywkę jako przemyślaną. Wyczyszczenie pola usuwa znacznik. Kliknięciem odzywki możesz zmienić zaznaczenie.':'Kliknij odzywkę lub puste pole, gdy przypomnisz sobie znaczenie. Ponowne kliknięcie usuwa znacznik.'}</p>
    </div>}
    <div className="line-list">{card.lines.map(line=><div key={line.key} className={`line-row ${previousMissed.includes(line.key)?'previous-miss':''} ${missed.includes(line.key)?'missed':''} ${!revealed&&considered.includes(line.key)?'considered':''}`}>
      <div className="call-label-group">
        {!revealed?<button type="button" className="line-label recall-label" aria-label={`Przemyślana odzywka ${line.label}`} aria-pressed={considered.includes(line.key)} onClick={()=>toggleConsidered(line.key)}><CallText text={line.label}/></button>:<div className="line-label"><CallText text={line.label}/></div>}
        {previousMissed.includes(line.key)&&<span className="previous-miss-icon" role="img" aria-label="Poprzednio błąd" title="Uważaj — poprzednio błąd"><Icon name="warning" size={14}/></span>}
        {fresh.includes(line.key)&&<span className="new-chip" title="Nowe lub zmienione ustalenie — do pierwszej zapisanej oceny" aria-label={`Nowe ustalenie: ${line.label}`}>NEW</span>}
      </div>
      {!revealed?(writing?<div className="answer-input-wrap"><textarea className="answer-input" aria-label={`Twoje znaczenie: ${line.label}`} placeholder="Twoje znaczenie…" rows={1} maxLength={4000} value={answers[line.key]??''} onChange={e=>changeAnswer(line.key,e.target.value)}/>{considered.includes(line.key)&&<span className="recall-check" aria-label="Przemyślane">✓</span>}</div>:<button type="button" className="meaning-blank" aria-label={`Przemyślane znaczenie ${line.label}`} aria-pressed={considered.includes(line.key)} onClick={()=>toggleConsidered(line.key)}><span aria-label="Znaczenie ukryte"/>{considered.includes(line.key)&&<small className="recall-check" aria-hidden="true">✓</small>}</button>):<div className={`meaning-content ${answers[line.key]?.trim()?'with-answer':''}`}>
        {answers[line.key]?.trim()&&<div className="own-answer"><small>Twój zapis</small><p className="verbatim">{answers[line.key]}</p></div>}
        <button disabled={timedOut||!!pending} className="meaning-button" aria-pressed={missed.includes(line.key)} onClick={()=>setMissed(prev=>prev.includes(line.key)?prev.filter(k=>k!==line.key):[...prev,line.key])}>
          {answers[line.key]?.trim()&&<small className="answer-caption">Znaczenie w systemie</small>}
          <span className="verbatim">{line.meaning}</span>{changedSinceLoad(line,loadedEntry.lastSeen)&&<small className="change-chip">zmiana w {line.changedIn}</small>}
          <span className="mark" aria-hidden="true">{missed.includes(line.key)?'✕':'○'}</span>
        </button>
        {revisionTraining&&(missed.includes(line.key)||timedOut)&&history.rows&&(()=>{
          const previous=previousLine(history.rows,card,line.key)
          return previous?<div className="previous-answer"><small>Poprzednie ustalenie — już nie obowiązuje</small><p className="verbatim">{previous.before?.meaning??''}</p>{!previous.before&&<small>Nowa odzywka — wcześniej bez ustalenia.</small>}</div>:null
        })()}
      </div>}
    </div>)}</div>
    {revisionTraining&&revealed&&(history.error?<p className="error-note" role="alert">{history.error} <button className="text-button" onClick={history.retry}>Ponów podgląd poprzednich ustaleń</button></p>:!history.rows?<p role="status">Wczytywanie poprzednich ustaleń…</p>:<p className="muted">Zaznacz błędną odzywkę, aby zobaczyć również poprzednie ustalenie.</p>)}
    {revealed&&(card.notes.length>0||card.auctionNote)&&<section className="notes-block"><h2>Uwagi</h2>{[...card.notes,...(card.auctionNote?[card.auctionNote]:[])].map((note,i)=><p className="verbatim" key={i}>{note}</p>)}</section>}
    {revealed&&<div className="secondary-actions"><SourcePreviewButton cardId={card.id} repository={repository}/>{category&&<button className="text-button" onClick={()=>setNotes(true)}>Notatki</button>}</div>}
    {error&&<p className="error-note" role="alert">{error}</p>}
    <footer className="card-action"><p className="muted">{phase==='hard'?'Ćwiczenie bez zmiany planu powtórek.':scope==='partial'?'To krótka poprawka. Cała pozycja wróci jutro.':revealed?'Tylko komplet poprawnych odpowiedzi zalicza kartę.':'Znaczenia odsłonisz jednocześnie.'}</p>
      <button className={`primary ${revealed&&(timedOut||missed.length)?'retry':''}`} disabled={busy} onClick={()=>{if(revealed)void rate();else reveal()}}>{busy?'Zapisywanie…':error?'Ponów zapis':!revealed?'Pokaż':timedOut?'Dalej':missed.length?`Dalej · ${missed.length} ${errorNoun(missed.length)}`:'Wszystko dobrze'}</button>
    </footer>
    {notes&&category&&<Modal title="Notatki kategorii" onClose={()=>setNotes(false)}><NotesView category={category}/></Modal>}
  </article>
}
