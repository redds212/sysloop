import { useState } from 'react'
import type { Attempt, Card, Category, SRSEntry } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { rateVisit, repeatVisit } from '../lib/sessionState'
import { AuctionView } from './AuctionView'
import { CardView } from './card/CardView'

interface Props { previousMissed?:string[];card:Card;category?:Category;entry:SRSEntry;timed:boolean;repository:LearningRepository;save:(attempt:Attempt,entry:SRSEntry)=>Promise<void>;restore:(card:Card,entry:SRSEntry)=>Promise<void>;onRevealed:()=>void;onRepeat:()=>void;onRead:()=>void;onHome:()=>void }
export function FreePractice({previousMissed,card,category,entry,timed,repository,save,restore,onRevealed,onRepeat,onRead,onHome}:Props) {
  const [baseline]=useState(entry),[result,setResult]=useState<{correct:boolean;entry:SRSEntry}|null>(null),[round,setRound]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
  if(!result)return <CardView previousMissed={previousMissed} key={round} card={card} category={category} baseline={baseline} timed={timed} phase="free" repository={repository} onRevealed={onRevealed} onRate={async attempt=>{const next=rateVisit(baseline,attempt.correct,new Date(attempt.ts));await save(attempt,next);setResult({correct:attempt.correct,entry:next})}}/>
  return <section className="result-panel panel"><span className={`result-symbol ${result.correct?'':'failed'}`}>{result.correct?'✓':'↻'}</span><p className="eyebrow">Ćwiczenie zakończone</p><h1>{result.correct?'Wszystko się zgadza.':'Ta pozycja wróci jutro.'}</h1><AuctionView auction={card.auction} compact/>
    <p className="muted">{result.correct?`Następna powtórka: ${result.entry.nextReviewDate}.`:'Każda powtórka pomaga uporządkować system.'}</p>
    <button className="primary" onClick={onHome}>Wróć do panelu</button><div className="secondary-actions"><button className="text-button" disabled={busy} onClick={()=>{void(async()=>{setBusy(true);setError('');try {if(result.correct)await restore(card,repeatVisit(baseline,result.entry,true));setResult(null);setRound(r=>r+1);onRepeat()}catch {setError('Nie udało się przywrócić postępu. Ponów próbę.')}finally{setBusy(false)}})()}}>Powtórz</button><button className="text-button" disabled={busy} onClick={onRead}>Czytaj pozycję</button></div>
    {error&&<p className="error-note" role="alert">{error}</p>}
    <p className="muted">Powtórzenie po zaliczeniu cofa zaliczenie z tej wizyty.</p>
  </section>
}
