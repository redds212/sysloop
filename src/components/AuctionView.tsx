import type { AuctionCall, Suit } from '../types'
import { displayToken } from '../lib/auction/display'
import { SuitSymbol } from './SuitSymbol'

export function CallText({ text }: { text: string }) {
  return <>{text.split(/([♣♦♥♠])[\uFE0E\uFE0F]?/).map((part,i) => {
    const suit = ({'♣':'C','♦':'D','♥':'H','♠':'S'} as Record<string,Suit>)[part]
    return suit ? <SuitSymbol key={i} suit={suit}/> : part
  })}</>
}
export function AuctionView({ auction, compact=false, question=true }: { auction: AuctionCall[]; compact?: boolean; question?: boolean }) {
  const contested = auction.some(c=>c.side==='they'&&!c.implicit)
  const calls = compact || !contested ? auction.filter(c=>!c.implicit) : auction
  return <div className={compact?'auction-compact':'auction-panel'}>
    {!compact && <div className={`auction-head ${contested?'four':'two'}`}>{(contested ? [0,1,2,3].map(i=>i%2===(auction[0]?.side==='they'?1:0)?'My':'Oni') : ['Otwierający','Odpowiadający']).map((label,i)=><span key={i}>{label}</span>)}</div>}
    <div className={compact?'auction-inline':`auction-grid ${contested?'four':'two'}`}>
      {calls.map((call,i)=><span key={i} className={`auction-call ${call.side==='they'?'opponent':''} ${call.implicit?'implicit':''}`}>
        <span>{call.side==='they'&&'('}<CallText text={call.alts.map(displayToken).join('/')} />{call.side==='they'&&')'}</span>
        {call.qualifier&&<small className="qualifier"><CallText text={call.qualifier}/></small>}
        {compact&&i<calls.length-1&&<span className="auction-dash">–</span>}
      </span>)}
      {!compact&&question&&<span className="auction-question" aria-label="Nasza odzywka">?</span>}
    </div>
  </div>
}
