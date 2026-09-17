import { previewData, previewUser } from './fixtures'
import type { AdminData, ImportRun, CardDocument } from '../admin/types'
import type { CardRow } from '../lib/database.types'
import { cardKey } from '../lib/auction/normalize'

export const adminPreviewUser={...previewUser,isAdmin:true}
export function adminFixtures(): {data:AdminData;runs:ImportRun[]} {
  const learning=previewData(), stamp='2026-09-17T09:00:00.000Z'
  const cards:CardRow[]=learning.cards.map(c=>({id:c.id,category_slug:c.categorySlug,card_key:cardKey(c.categorySlug,c.auction,c.context),section:c.section,sort_order:c.sortOrder,auction:c.auction,auction_key:c.auctionKey,context:c.context??null,auction_note:c.auctionNote??null,notes:c.notes,lines:c.lines,status:c.status,review_flags:c.reviewFlags,verification_note:null,source_page:c.sourcePage,source_revision:c.sourceRevision,created_at:stamp,updated_at:stamp}))
  cards[1]={...cards[1],status:'draft',review_flags:['verifier_uncertain'],verification_note:'Wymyślona uwaga: porównaj podpisy z przykładowym źródłem.'}
  const category=learning.categories[0]
  const changed:CardDocument={...cards[0],lines:cards[0].lines.map((l,i)=>i===0?{...l,meaning:'Przykład testowy: poprawione znaczenie do nowego importu.'}:l)}
  const added:CardDocument={...cards[1],card_key:`${cards[1].card_key}|Test nowej pozycji`,context:'Test nowej pozycji',review_flags:['verifier_uncertain']}
  const run:ImportRun={id:'demo-run',category_slug:category.slug,source_file:'przyklad-demo.pdf',revision:'demo-2',status:'pending',summary:{added:1,changed:1,removed:1,unchanged:1},created_at:stamp,applied_at:null,applied_by:null,raw_snapshot:{category:{slug:category.slug,name:category.name,group:category.group,sortOrder:category.sortOrder,notes:category.notes},cards:[]},proposal:{baseRunId:null,changes:[
    {cardKey:added.card_key,kind:'added',card:added,newRaw:{lines:added.lines},verification:'uncertain'},
    {cardKey:cards[0].card_key,kind:'changed',card:changed,oldRaw:{lines:cards[0].lines},newRaw:{lines:changed.lines},verification:'ok'},
    {cardKey:cards[4].card_key,kind:'removed',oldRaw:{lines:cards[4].lines}},
    {cardKey:cards[3].card_key,kind:'unchanged',card:cards[3],oldRaw:{lines:cards[3].lines},newRaw:{lines:cards[3].lines}},
  ]}}
  const profile={id:previewUser.id,username:previewUser.username,is_admin:true,status:'approved' as const,daily_target:5,mode:'balanced' as const,timed_mode:false,created_at:stamp}
  return {data:{cards,categories:learning.categories.map(c=>({slug:c.slug,name:c.name,group_name:c.group,sort_order:c.sortOrder,source_file:c.sourceFile,revision:c.revision,notes:c.notes,updated_at:stamp})),users:[profile,{...profile,id:'pending-demo',username:'Testowy partner',is_admin:false,status:'pending'}],reports:[{id:1,user_id:'pending-demo',card_id:cards[0].id,card_label:'Przykładowe zgłoszenie do karty',reporter_label:'Testowy partner',message:'Wymyślone zgłoszenie: sprawdź opis pierwszej odzywki.',status:'new',created_at:stamp}],runs:[run]},runs:[run]}
}
