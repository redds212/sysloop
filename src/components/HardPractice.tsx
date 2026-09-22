import { useState } from 'react'
import type { Attempt, Card, Category } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { previousMissedKeys } from '../lib/difficult'
import { getDefaultEntry } from '../lib/srs'
import { CardView } from './card/CardView'

export function HardPractice({cards,categories,attempts,repository,save,onFront,onRevealed,onFinish,stars,onStar,busy}: {
  cards:Card[];categories:Category[];attempts:Attempt[];repository:LearningRepository;
  save:(attempt:Attempt)=>Promise<void>;onFront:()=>void;onRevealed:()=>void;onFinish:()=>void;
  stars:string[];onStar:(id:string,starred:boolean)=>Promise<void>;busy:boolean
}) {
  const [queue]=useState(cards),[index,setIndex]=useState(0),[round,setRound]=useState(0),[result,setResult]=useState<Attempt|null>(null)
  const card=queue[index]
  if(!card)return <section className="panel"><h1>Trening zakończony.</h1><p>Harmonogram powtórek pozostał bez zmian.</p><button className="primary" onClick={onFinish}>Wróć do trudnych sekwencji</button></section>
  const starred=stars.includes(card.id)
  return <section><div className="session-bar"><span>Ćwicz trudne · bez zmiany planu</span><strong>{index+1} / {queue.length}</strong><button className="text-button" disabled={busy} onClick={onFinish}>Zakończ</button></div>
    <button className="text-button star-toggle" disabled={busy} aria-pressed={starred} onClick={()=>void onStar(card.id,!starred).catch(()=>{})}>{starred?'★ W moich trudnych':'☆ Dodaj do moich trudnych'}</button>
    {result?<section className="panel result-panel"><h1>{result.correct?'Wszystko się zgadza.':'Wiesz już, co wymaga pracy.'}</h1><p className="muted">Oceniono tę próbę. Plan powtórek i oznaczenia poprzednich błędów pozostają bez zmian.</p><button className="primary" onClick={()=>{setIndex(i=>i+1);setResult(null);onFront()}}>{index+1===queue.length?'Zakończ trening':'Następna sekwencja'}</button><button className="text-button" onClick={()=>{setRound(r=>r+1);setResult(null);onFront()}}>Powtórz tę sekwencję</button></section>
      :<CardView key={`${card.id}:${round}`} card={card} category={categories.find(c=>c.slug===card.categorySlug)} baseline={getDefaultEntry()} timed={false} phase="hard" repository={repository} previousMissed={previousMissedKeys(card,attempts)} onRevealed={onRevealed} onRate={async attempt=>{await save(attempt);setResult(attempt)}}/>}
  </section>
}
