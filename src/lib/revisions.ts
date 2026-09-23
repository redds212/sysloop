import type { Attempt, AuctionCall, Card, CardLine } from '../types'

export interface CardSnapshot {
  auction:AuctionCall[]; context:string|null; section:string; auctionNote:string|null;
  notes:string[]; lines:CardLine[]
}
export interface CardRevision {
  id:string; card_id:string; category_slug:string; revision:string; previous_revision:string|null;
  changed_at:string; substantive:boolean; before_snapshot:CardSnapshot|null; after_snapshot:CardSnapshot
}
export interface LineDifference { key:string; before:CardLine|null; after:CardLine|null }
export function newLineKeys(card:Card,attempts:readonly Attempt[]):string[] {
  return card.lines.filter(line=>line.changeId&&!attempts.some(a=>a.cardId===card.id&&a.presentLineKeys.includes(line.key)&&a.lineVersions?.[line.key]===line.changeId)).map(l=>l.key)
}
export function sameLine(a:CardLine,b:CardLine):boolean {
  return a.label===b.label&&a.meaning===b.meaning&&JSON.stringify(a.bids)===JSON.stringify(b.bids)
}
export function revisionLines(revision:CardRevision):LineDifference[] {
  const before=revision.before_snapshot?.lines??[],after=revision.after_snapshot.lines
  const keys=[...after.map(l=>l.key),...before.filter(l=>!after.some(n=>n.key===l.key)).map(l=>l.key)]
  return keys.flatMap(key=>{
    const old=before.find(l=>l.key===key)??null,next=after.find(l=>l.key===key)??null
    return old&&next&&sameLine(old,next)?[]:[{key,before:old,after:next}]
  })
}
export function cardSnapshot(card:Card):CardSnapshot {
  return structuredClone({auction:card.auction,context:card.context??null,section:card.section,auctionNote:card.auctionNote??null,notes:card.notes,lines:card.lines})
}
export function previousLine(revisions:CardRevision[],card:Card,key:string):LineDifference|undefined {
  const current=card.lines.find(l=>l.key===key)
  if(!current?.changeId)return
  for(const revision of [...revisions].sort((a,b)=>b.changed_at.localeCompare(a.changed_at))) {
    if(revision.card_id!==card.id||!revision.substantive)continue
    const line=revisionLines(revision).find(l=>l.key===key&&l.after?.changeId===current.changeId)
    if(line)return line
  }
}
export class RevisionHistoryUnavailableError extends Error {
  constructor(){super('Historia zmian czeka na aktywację przez administratora.');this.name='RevisionHistoryUnavailableError'}
}
