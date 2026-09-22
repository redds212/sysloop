import { describe, expect, it } from 'vitest'
import { difficultCards, previousMissedKeys } from './difficult'
import { hardLines } from './lineStats'
import { grade } from './grading'
import { inventedCard, inventedLine } from './testFixtures'
import { answerSession, correctionCard, startSession, restoreSession } from './sessionState'
import { generateDailySession } from './session'
import { getDefaultEntry } from './srs'
import { unfinishedCorrections } from './dayRollover'

const card={...inventedCard(),lines:[inventedLine('6H'),inventedLine('6S'),inventedLine('6NT')]}
const at=(day:number)=>new Date(`2026-09-${String(day).padStart(2,'0')}T10:00:00+02:00`)
const miss=(day:number)=>grade(card,['6S'],false,'main',at(day))
const pass=(day:number)=>grade(card,[],false,'free',at(day))

describe('historia pełnych prób',()=>{
  it('oznacza tylko błędy z ostatniej pełnej próby, przed kolejnym odsłonięciem',()=>{
    expect(previousMissedKeys(card,[miss(20),pass(19)])).toEqual(['6S'])
    expect(previousMissedKeys(card,[miss(20),pass(21)])).toEqual([])
  })
  it('pomija krótką poprawkę i trening trudnych, nawet jeśli są późniejsze',()=>{
    const partial={...pass(21),phase:'buffer' as const,scope:'partial' as const}
    const hard={...pass(22),phase:'hard' as const}
    expect(previousMissedKeys(card,[miss(20),partial,hard])).toEqual(['6S'])
  })
  it('pełna poprawka jest kolejną pełną próbą',()=>{
    expect(previousMissedKeys(card,[miss(20),{...pass(21),phase:'buffer'}])).toEqual([])
  })
  it('timeout oznacza wszystkie obecne wtedy odzywki, nie nowe',()=>{
    const timed=grade({...card,lines:card.lines.slice(0,2)},[],true,'main',at(20))
    expect(previousMissedKeys(card,[timed])).toEqual(['6H','6S'])
    expect(hardLines([card],[timed,timed])).toEqual([])
  })
  it('wyklucza usunięte linie i obce karty',()=>{
    expect(previousMissedKeys({...card,lines:[card.lines[0]]},[miss(20)])).toEqual([])
    expect(previousMissedKeys(card,[{...miss(20),cardId:'other'}])).toEqual([])
  })
  it('liczy 2 błędy z 5 ostatnich pełnych ocen i pomija dodatkowe treningi',()=>{
    const history=[miss(17),miss(18),pass(19),pass(20),pass(21)]
    const extra=Array.from({length:10},(_,i)=>({...pass(22),phase:i%2?'hard' as const:'buffer' as const,scope:i%2?'full' as const:'partial' as const}))
    expect(hardLines([card],[...history,...extra])).toMatchObject([{cardId:card.id,misses:2,appearances:5}])
    expect(hardLines([card],[...history,pass(22)])).toEqual([])
  })
  it('próby, w których linia nie istniała, nie zajmują jej okna pięciu ocen',()=>{
    const absent=grade({...card,lines:[card.lines[0]]},[],false,'free',at(21))
    expect(hardLines([card],[miss(18),miss(19),absent])).toMatchObject([{misses:2,appearances:2}])
  })
  it('filtry łączą ręczne gwiazdki i automatyczne błędy bez duplikatów',()=>{
    const manual={...card,id:'manual'},archived={...card,id:'archived',status:'archived' as const}
    const cards=[card,manual,archived],stars=[manual.id,card.id,archived.id],history=[miss(19),miss(20)]
    expect(difficultCards(cards,history,stars,'all').map(i=>i.card.id)).toEqual([card.id,manual.id])
    expect(difficultCards(cards,history,stars,'frequent').map(i=>i.card.id)).toEqual([card.id])
    expect(difficultCards(cards,history,stars,'starred')).toHaveLength(2)
    expect(difficultCards(cards,[...history,pass(21),pass(22),pass(23),pass(24)],stars,'starred')).toHaveLength(2)
    expect(difficultCards(cards,history,[],'starred')).toEqual([])
  })
})

describe('krótka poprawka w dziennej sesji',()=>{
  const initial=()=>startSession(generateDailySession([card],{}, {dailyTarget:1,mode:'balanced'},at(20)))
  it('zachowuje zakres błędu po serializacji i wznowieniu',()=>{
    const failed=answerSession(initial(),miss(20),getDefaultEntry(),at(20),'missed')
    expect(failed.progress).toBeNull()
    const resumed=restoreSession(JSON.parse(JSON.stringify(failed.state)),[card],at(20))!
    const shown=correctionCard(card,resumed)
    expect(shown.card.lines.map(l=>l.key)).toEqual(['6S'])
    expect(shown.card.auction).toEqual(card.auction)
    expect(shown.scope).toBe('partial')
  })
  it.each([true,false])('po krótkiej poprawce (%s) wraca cała karta jutro na poziomie zero, bez kolejnej poprawki',correct=>{
    const state=answerSession(initial(),miss(20),getDefaultEntry(),at(20),'missed').state
    const shown=correctionCard(card,state)
    const attempt={...grade(shown.card,correct?[]:['6S'],false,'buffer',at(20)),scope:shown.scope}
    const result=answerSession(state,attempt,getDefaultEntry(),at(20),'missed')
    expect(result.progress).toMatchObject({status:'LEARNING',consecutiveCorrect:0,interval:1,nextReviewDate:'2026-09-21',flagDifficult:correct?undefined:true})
    expect(result.state.bufferIndex).toBe(1)
    expect(result.state.buffer).toEqual([card.id])
  })
  it('domyślne poprawki i stare sesje pokazują całą kartę',()=>{
    expect(correctionCard(card,answerSession(initial(),miss(20),getDefaultEntry(),at(20)).state)).toEqual({card,scope:'full'})
    expect(correctionCard(card,{...initial(),inBuffer:true,buffer:[card.id]})).toEqual({card,scope:'full'})
  })
  it('timeout i usunięcie wszystkich błędnych linii bezpiecznie wracają do całej karty',()=>{
    const state=answerSession(initial(),grade(card,[],true,'main',at(20)),getDefaultEntry(),at(20),'missed').state
    expect(correctionCard(card,state).scope).toBe('full')
    expect(correctionCard(card,{...state,correctionLines:{[card.id]:['removed']}}).scope).toBe('full')
  })
  it('usuwa nieistniejące linie ze skrótu, nie dodaje nowych',()=>{
    const state={...initial(),inBuffer:true,correctionLines:{[card.id]:['removed','6S']}}
    expect(correctionCard(card,state).card.lines.map(l=>l.key)).toEqual(['6S'])
  })
  it('trening trudnych nie przesłania niedokończonej poprawki o północy',()=>{
    const result=unfinishedCorrections({cards:[card],categories:[],store:{},session:null,attempts:[miss(20),{...pass(21),phase:'hard'}]},at(22))
    expect(result).toHaveLength(1)
    expect(result[0].entry.nextReviewDate).toBe('2026-09-21')
  })
})
