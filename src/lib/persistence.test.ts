import { describe, expect, it } from 'vitest'
import { flushOperation, type Journal, type LearningOperation } from './learningRepository'
import { previewRepository } from '../dev/previewRepository'
import { grade } from './grading'
import { getDefaultEntry, applyAnswer } from './srs'
import { generateDailySession } from './session'
import { startSession } from './sessionState'
import { continuationCards, parentCards } from './auction/navigation'
import { call, normalizeAuction } from './auction/normalize'

function journal():Journal { let value:LearningOperation|null=null;return {read:()=>value,write:v=>{value=structuredClone(v)},clear:()=>{value=null}} }
describe('potwierdzony zapis i odzyskiwanie',()=>{
  it('równoległe odzyskiwanie z StrictMode zapisuje próbę tylko raz',async()=>{
    const repo=previewRepository(),j=journal(),card=(await repo.load()).cards[0]
    j.write({attempt:grade(card,[],false,'free')})
    await Promise.all([flushOperation(repo,j),flushOperation(repo,j)])
    expect(repo.inspect().attempts).toHaveLength(1)
  })
  it('po utracie odpowiedzi serwera nie dubluje próby i kończy zapis postępu i sesji',async()=>{
    const repo=previewRepository(), j=journal(), data=await repo.load(), card=data.cards[0]
    const attempt=grade(card,[],false,'main'), progress=applyAnswer(getDefaultEntry(),true)
    const session=startSession(generateDailySession(data.cards,data.store,{dailyTarget:5,mode:'balanced'}))
    const original=repo.recordAttempt;let fail=true
    repo.recordAttempt=async a=>{await original(a);if(fail){fail=false;throw new Error('Lost acknowledgement')}}
    await expect(flushOperation(repo,j,{attempt,progress:{cardId:card.id,entry:progress},session})).rejects.toThrow()
    expect(j.read()).not.toBeNull();expect(repo.inspect().attempts).toHaveLength(1)
    await flushOperation(repo,j)
    expect(repo.inspect().attempts).toHaveLength(1);expect(repo.inspect().store[card.id]).toEqual(progress);expect(repo.inspect().session).toEqual(session);expect(j.read()).toBeNull()
  })
  it('nie zastępuje niezapisanego wyniku inną odpowiedzią',async()=>{
    const repo=previewRepository(),j=journal(),card=(await repo.load()).cards[0]
    const original=grade(card,[card.lines[0].key],false,'free')
    j.write({attempt:original});await flushOperation(repo,j,{attempt:grade(card,[],false,'free')})
    expect(repo.inspect().attempts).toEqual([original])
  })
  it('nie przechodzi do następnej karty przy błędzie zapisu postępu',async()=>{
    const repo=previewRepository(),j=journal(),data=await repo.load(),card=data.cards[0]
    repo.putProgress=async()=>{throw new Error('Offline')}
    const operation={attempt:grade(card,[],false,'main'),progress:{cardId:card.id,entry:applyAnswer(getDefaultEntry(),true)},session:startSession(generateDailySession(data.cards,data.store,{dailyTarget:5,mode:'balanced'}))}
    await expect(flushOperation(repo,j,operation)).rejects.toThrow('Offline')
    expect(repo.inspect().session).toBeNull();expect(j.read()).toEqual(operation)
  })
})
describe('nawigacja czytania',()=>{
  it('odnajduje dziecko i rodzica bez zmiany postępu',async()=>{
    const data=await previewRepository().load(),root=data.cards[0],child=data.cards[1]
    expect(continuationCards(root,root.lines[0],data.cards).map(c=>c.id)).toEqual([child.id])
    expect(parentCards(child,data.cards).map(c=>c.id)).toEqual([root.id])
  })
  it('nie podstawia pozycji jednostronnej pod interwencję',async()=>{
    const data=await previewRepository().load(),root=data.cards[0],child={...data.cards[1],auction:normalizeAuction([call('1NT'),call('X','they'),call('2C')])}
    expect(continuationCards(root,root.lines[0],[child])).toEqual([])
  })
  it('zachowuje kilka wariantów kontekstu i wyklucza archiwalne',async()=>{
    const data=await previewRepository().load(),root=data.cards[0],child=data.cards[1]
    expect(continuationCards(root,root.lines[0],[child,{...child,id:'other',context:'Przykład'},{...child,id:'archived',status:'archived'}])).toHaveLength(2)
  })
})
