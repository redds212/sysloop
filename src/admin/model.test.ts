import { describe, expect, it } from 'vitest'
import { adminFixtures } from '../dev/adminFixtures'
import { effectiveLines, lineDiff, prepareCard, type CallDraft } from './model'

function draft() {
  const {data,runs}=adminFixtures(), card=data.cards[0]
  const calls:CallDraft[]=card.auction.map(c=>({side:c.side,text:c.alts.join('/'),qualifier:c.qualifier??'',implicit:c.implicit}))
  const lines=card.lines.map(l=>({...l,bids:l.bids.join('/')}))
  return {data,runs,card,calls,lines}
}
describe('edytor i porównanie importu',()=>{
  it('zmiana kolejności zachowuje klucze historii odzywek',()=>{
    const {card,calls,lines,data}=draft()
    const result=prepareCard(card,card,calls,[lines[1],lines[0],...lines.slice(2)],data.cards)
    expect(result.lines.map(l=>l.key)).toEqual([card.lines[1].key,card.lines[0].key,...card.lines.slice(2).map(l=>l.key)])
  })
  it('nowa odzywka nie przejmuje historii usuniętej odzywki',()=>{
    const {card,calls,lines,data}=draft()
    const result=prepareCard(card,card,calls,[{...lines[0],key:'new-id'},...lines.slice(1)],data.cards)
    expect(result.lines[0].key).toBe(`${card.lines[0].key}#2`)
  })
  it('zmiana bids nie przejmuje klucza innej odzywki',()=>{
    const {card,calls,lines,data}=draft()
    const result=prepareCard(card,card,calls,[{...lines[0],bids:lines[1].bids},...lines.slice(1)],data.cards)
    expect(result.lines[0].key).toBe(`${card.lines[1].key}#2`)
  })
  it('kwalifikator, kontekst i strony trafiają do klucza; pasy są uzupełniane',()=>{
    const {card,lines,data}=draft()
    const result=prepareCard(card,{...card,context:'Testowy kontekst'},[{side:'we',text:'2♥/♠',qualifier:''},{side:'they',text:'ktr',qualifier:'Test'}],lines,data.cards)
    expect(result.auction_key).toBe('2H/2S (X[Test])')
    expect(result.card_key).toContain('|Testowy kontekst')
    const implicit=prepareCard(card,card,[{side:'we',text:'2H',qualifier:''},{side:'we',text:'2NT',qualifier:''}],lines,data.cards)
    expect(implicit.auction_key).toBe('2H (P) 2NT (P)')
  })
  it('poprawka tekstu zachowuje sufiks powtórzonej pozycji',()=>{
    const {card,calls,lines,data}=draft(), duplicate={...card,card_key:card.card_key+'#2'}
    expect(prepareCard(duplicate,duplicate,calls,lines,data.cards).card_key).toBe(duplicate.card_key)
  })
  it('odrzuca pustą kartę i nieznane odzywki',()=>{
    const {card,calls,lines,data}=draft()
    expect(()=>prepareCard(card,card,calls,[],data.cards)).toThrow('przynajmniej')
    expect(()=>prepareCard(card,card,[{side:'we',text:'?',qualifier:''}],lines,data.cards)).toThrow('Nieznana')
    expect(()=>prepareCard(card,card,[],lines,data.cards)).toThrow('Uzupełnij')
  })
  it('nie pozwala zmienić tożsamości na istniejącą pozycję',()=>{
    const {card,calls,lines,data}=draft()
    expect(()=>prepareCard(card,{...card,context:'Kopia'},calls,lines,[...data.cards,{...card,id:'other',card_key:`${card.card_key}|Kopia`}])).toThrow('już istnieje')
  })
  it('różnice pokazują zachowaną poprawkę z bazy, nowe znaczenie oraz usunięty wiersz',()=>{
    const {card,runs}=draft(), change=runs[0].proposal.changes.find(c=>c.kind==='changed')!
    const current={...card,lines:card.lines.map((l,i)=>i===1?{...l,meaning:'Ręczna poprawka testowa.'}:l)}
    const merged=effectiveLines(change,current)
    expect(merged[0].meaning).toBe(change.card!.lines[0].meaning)
    expect(merged[1].meaning).toBe('Ręczna poprawka testowa.')
    const diff=lineDiff(current.lines,merged.slice(0,-1))
    expect(diff[0].kind).toBe('changed')
    expect(diff[1].kind).toBe('unchanged')
    expect(diff.at(-1)?.kind).toBe('removed')
  })
})
