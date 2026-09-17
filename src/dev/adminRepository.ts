import type { AdminRepository, ImportDecisions } from '../admin/types'
import { adminFixtures } from './adminFixtures'
import { stampChangedLines } from '../lib/contentChanges'
import { effectiveLines } from '../admin/model'

export function adminPreviewRepository(storage?:Storage):AdminRepository {
  const key='sysloop:preview:admin'
  const stored=storage?.getItem(key)
  const state:ReturnType<typeof adminFixtures>=stored?JSON.parse(stored):adminFixtures()
  const persist=()=>storage?.setItem(key,JSON.stringify(state))
  const runById=(id:string)=>{const run=state.runs.find(r=>r.id===id);if(!run)throw new Error('Brak importu');return run}
  return {
    async load(){return structuredClone({...state.data,runs:state.runs})},
    async getRun(id){return structuredClone(runById(id))},
    async saveCard(card,substantive,revision){
      const old=state.data.cards.find(c=>c.id===card.id)!
      const updated={...card,lines:stampChangedLines(old.lines,card.lines,substantive,revision),updated_at:new Date().toISOString()}
      state.data.cards=state.data.cards.map(c=>c.id===card.id?updated:c);persist()
    },
    async saveCategory(category){state.data.categories=state.data.categories.map(c=>c.slug===category.slug?structuredClone(category):c);persist()},
    async updateUser(id,patch){state.data.users=state.data.users.map(u=>u.id===id?{...u,...patch}:u);persist()},
    async deleteUser(id){state.data.users=state.data.users.filter(u=>u.id!==id);persist()},
    async updateReport(id,status){state.data.reports=state.data.reports.map(r=>r.id===id?{...r,status}:r);persist()},
    async deleteReport(id){state.data.reports=state.data.reports.filter(r=>r.id!==id);persist()},
    async applyRun(id,decisions:ImportDecisions){
      const run=runById(id)
      if(run.status!=='pending')throw new Error('Import nie oczekuje na decyzję')
      for(const change of run.proposal.changes){
        const decision=decisions[change.cardKey]??{}
        if(decision.skip||change.kind==='unchanged')continue
        const existing=state.data.cards.find(c=>c.card_key===change.cardKey)
        if(change.kind==='removed'){if(existing)existing.status='archived';continue}
        if(!change.card)continue
        const approved=decision.approve||(change.verification==='ok'&&!change.card.review_flags.length)
        const lines=effectiveLines(change,existing)
        const updated={...change.card,id:existing?.id??crypto.randomUUID(),created_at:existing?.created_at??new Date().toISOString(),updated_at:new Date().toISOString(),source_revision:run.revision,status:approved?'active' as const:'draft' as const,review_flags:approved?[]:change.card.review_flags.length?change.card.review_flags:['verifier_uncertain'],lines:existing?stampChangedLines(existing.lines,lines,!decision.cosmetic,run.revision):lines}
        state.data.cards=existing?state.data.cards.map(c=>c.id===existing.id?updated:c):[...state.data.cards,updated]
      }
      state.data.categories=state.data.categories.map(c=>c.slug===run.category_slug?{...c,source_file:run.source_file,revision:run.revision,notes:run.raw_snapshot.category.notes??[]}:c)
      run.status='applied';run.applied_at=new Date().toISOString();persist()
    },
    async discardRun(id){const run=runById(id);if(run.status!=='pending')throw new Error('Import nie oczekuje');run.status='discarded';persist()},
    async cardPage(){return null},
    async pageUrl(){throw new Error('Podgląd nie zawiera stron PDF')},
  }
}
