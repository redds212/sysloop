import type { Card } from '../types'
import { cardSnapshot, type CardRevision } from '../lib/revisions'

// Invented earlier wording, never imported from system notes.
export function revisionFixtures(cards:Card[]):CardRevision[] {
  const root=cards.find(c=>c.id==='demo-1'),added=cards.find(c=>c.id==='demo-5')
  const rows:CardRevision[]=[]
  if(root){
    const after=cardSnapshot(root),before=structuredClone(after)
    before.lines=before.lines.filter((_,i)=>i!==1).map((line,i)=>i===0?{...line,meaning:'Wymyślone poprzednie ustalenie: inny opis testowy.',changeId:undefined}:line)
    rows.push({id:'demo-revision-2',card_id:root.id,category_slug:root.categorySlug,revision:'demo-2',previous_revision:'demo-1',changed_at:'2026-09-23T07:00:00Z',substantive:true,before_snapshot:before,after_snapshot:after})
  }
  if(added)rows.push({id:'demo-revision-1',card_id:added.id,category_slug:added.categorySlug,revision:'demo-1',previous_revision:null,changed_at:'2026-09-22T07:00:00Z',substantive:true,before_snapshot:null,after_snapshot:cardSnapshot(added)})
  return rows
}
