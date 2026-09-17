import type { Card, Category } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { continuationCards, parentCards } from '../lib/auction/navigation'
import { AuctionView, CallText } from './AuctionView'
import { ReportCardButton } from './ReportCardButton'
export function ReadView({card,cards,category,onRead,onPractice,repository}: {card:Card;cards:Card[];category?:Category;onRead:(id:string)=>void;onPractice:(id:string)=>void;repository:LearningRepository}) {
  const parents=parentCards(card,cards)
  return <article className="read-view"><p className="eyebrow">Czytanie · {category?.name}</p><h1>Przejrzyj tę pozycję</h1>
    <p className="section-title">{card.section}</p><div className="read-links">{parents.map(parent=><button key={parent.id} className="text-button" onClick={()=>onRead(parent.id)}>‹ Wcześniejsza pozycja {parent.context}</button>)}</div>
    <AuctionView auction={card.auction}/>{card.context&&<p className="context-chip">{card.context}</p>}
    <div className="line-list">{card.lines.map(line=><div key={line.key} className="line-row"><span className="line-label"><CallText text={line.label}/></span><div className="read-meaning"><p className="verbatim">{line.meaning}</p>{continuationCards(card,line,cards).map(next=><button key={next.id} className="text-button continuation" onClick={()=>onRead(next.id)}>Dalsza licytacja {next.context} <AuctionView auction={next.auction} compact/> ›</button>)}</div></div>)}</div>
    {(card.notes.length>0||card.auctionNote)&&<section className="notes-block"><h2>Uwagi</h2>{[...card.notes,...(card.auctionNote?[card.auctionNote]:[])].map((note,i)=><p className="verbatim" key={i}>{note}</p>)}</section>}
    <div className="secondary-actions"><button className="primary" onClick={()=>onPractice(card.id)}>Ćwicz tę pozycję</button><ReportCardButton card={card} category={category} repository={repository}/></div>
    <p className="muted">Czytanie nie zmienia planu powtórek.</p>
  </article>
}
