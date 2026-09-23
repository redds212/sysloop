import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import type { CardRow } from './database.types'
import type { CardRevision } from './revisions'
import { previewData } from '../dev/fixtures'

const admin='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',pending='00000000-0000-4000-8000-000000000003'
let db:PGlite
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid,bucket_id text);`)
  for(const file of ['0001_schema','0002_access','0004_card_edits','0005_import_runs','0006_difficult_practice','0009_revision_history','0009_revision_history'])
    await db.exec(readFileSync(`supabase/migrations/${file}.sql`,'utf8'))
  for(const [id,isAdmin,status] of [[admin,true,'approved'],[member,false,'approved'],[pending,false,'pending']] as const){
    await db.query('insert into auth.users values($1)',[id])
    await db.query('insert into public.profiles(id,is_admin,status) values($1,$2,$3)',[id,isAdmin,status])
  }
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
  await db.exec(`reset role; truncate public.cards,public.categories,public.import_runs cascade;`)
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',admin])
  await db.exec(`insert into public.categories(slug,name,group_name,source_file) values('demo-open','Test','Test','invented.pdf')`)
})
async function addCard(status='active') {
  const c=previewData().cards[0]
  return (await db.query<CardRow>(`insert into public.cards(category_slug,card_key,auction,auction_key,lines,status,source_page,source_revision)
    values('demo-open','invented',$1,$2,$3,$4,1,'test-1') returning *`,[JSON.stringify(c.auction),c.auctionKey,JSON.stringify(c.lines),status])).rows[0]
}
async function revisions(){return (await db.query<CardRevision>('select * from public.card_revisions order by changed_at,id')).rows}
async function save(card:CardRow,substantive=true,revision='test-2') {
  await db.query('select public.admin_save_card($1,$2,$3)',[JSON.stringify(card),substantive,revision])
  return (await db.query<CardRow>('select * from public.cards where id=$1',[card.id])).rows[0]
}

it('historia zapisuje prawdziwe przed/po, zachowuje niezmienione znaczniki i poziom SRS',async()=>{
  const card=await addCard(),token=card.lines[0].changeId
  expect(token).toBeTruthy()
  expect((await revisions())[0].before_snapshot).toBeNull()
  await db.query(`insert into public.srs_progress(user_id,card_id,status,consecutive_correct,interval,next_review_date) values($1,$2,'MASTERED',4,81,'2099-01-01')`,[member,card.id])
  const changed=await save({...card,lines:card.lines.map((l,i)=>i===0?{...l,meaning:'Nowe wymyślone znaczenie.'}:l)})
  expect(changed.lines[0].changeId).not.toBe(token)
  expect(changed.lines[1].changeId).toBe(card.lines[1].changeId)
  const rows=await revisions()
  expect(rows).toHaveLength(2)
  expect(rows[1].before_snapshot?.lines[0].meaning).toBe(card.lines[0].meaning)
  expect(rows[1].after_snapshot.lines[0].meaning).toBe('Nowe wymyślone znaczenie.')
  expect(rows[1].revision).toBe('test-2')
  expect(changed.lines[0].changedIn).toBe('test-2')
  expect((await db.query(`select consecutive_correct, next_review_date=public.revision_review_day() as due from public.srs_progress`)).rows[0]).toEqual({consecutive_correct:4,due:true})
})
it('kosmetyka nie odnawia NEW, lecz jest zachowana jako stan przed kolejną zmianą',async()=>{
  const card=await addCard()
  const cosmetic=await save({...card,lines:card.lines.map(l=>({...l,meaning:l.meaning+' '}))},false)
  expect(cosmetic.lines.map(l=>l.changeId)).toEqual(card.lines.map(l=>l.changeId))
  expect((await revisions())[1].substantive).toBe(false)
  await save({...cosmetic,notes:['Wymyślona nowa uwaga.']},true,'test-3')
  expect((await revisions())[2].before_snapshot?.lines).toEqual(cosmetic.lines)
  const count=(await revisions()).length
  await save({...cosmetic,notes:['Wymyślona nowa uwaga.'],source_page:2},false,'test-4')
  expect(await revisions()).toHaveLength(count)
})
it('szkic nie ujawnia historii przed zatwierdzeniem ani jego roboczych znaczeń po publikacji',async()=>{
  const draft=await addCard('draft')
  expect(await revisions()).toEqual([])
  const published=await save({...draft,status:'active',lines:draft.lines.map(l=>({...l,meaning:'Wymyślona opublikowana treść.'}))},false)
  expect((await revisions())[0].before_snapshot).toBeNull()
  await save({...published,status:'draft',lines:published.lines.map(l=>({...l,meaning:'Sekretny roboczy przykład.'}))})
  expect(await revisions()).toHaveLength(1)
  await save({...published,status:'active',lines:published.lines.map(l=>({...l,meaning:'Druga opublikowana wersja.'}))})
  expect((await revisions())[1].before_snapshot?.lines[0].meaning).toBe('Wymyślona opublikowana treść.')
  expect(JSON.stringify(await revisions())).not.toContain('Sekretny roboczy')
})
it('RLS: zatwierdzony czyta tylko aktywne karty, pending i anon nie czytają, klient nie zapisuje historii',async()=>{
  const card=await addCard()
  await db.exec('set role authenticated')
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',member])
  expect(await revisions()).toHaveLength(1)
  await expect(db.exec(`delete from public.card_revisions`)).rejects.toThrow()
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',pending])
  expect(await revisions()).toEqual([])
  await db.exec('reset role')
  await db.query(`update public.cards set status='archived' where id=$1`,[card.id])
  await db.exec('set role authenticated')
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',member])
  expect(await revisions()).toEqual([])
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',admin])
  expect(await revisions()).toHaveLength(1)
  await db.exec('reset role; set role anon')
  await expect(revisions()).rejects.toThrow()
})
it('cofnięcie transakcji cofa jednocześnie kartę i historię',async()=>{
  const card=await addCard()
  await db.exec('begin')
  await save({...card,notes:['Wymyślona zmiana cofnięta.']})
  expect(await revisions()).toHaveLength(2)
  await db.exec('rollback')
  expect(await revisions()).toHaveLength(1)
  expect((await db.query<CardRow>('select * from public.cards')).rows[0].notes).toEqual([])
})

it('migracja zapisuje istniejącą kartę jako punkt początkowy bez NEW i nie powiela go',async()=>{
  await db.exec('alter table public.cards disable trigger stamp_published_line_changes; alter table public.cards disable trigger record_published_card_revision')
  const draft=await addCard('draft')
  const lines=draft.lines.map(({key,label,bids,meaning})=>({key,label,bids,meaning}))
  await db.query("update public.cards set status='active',lines=$1 where id=$2",[JSON.stringify(lines),draft.id])
  await db.exec('alter table public.cards enable trigger stamp_published_line_changes; alter table public.cards enable trigger record_published_card_revision')
  for(let i=0;i<2;i++)await db.exec(readFileSync('supabase/migrations/0009_revision_history.sql','utf8'))
  const rows=await revisions()
  expect(rows).toHaveLength(1)
  expect(rows[0].substantive).toBe(false)
  expect(rows[0].after_snapshot.lines.every(l=>!l.changeId)).toBe(true)
  const card=(await db.query<CardRow>('select * from public.cards where id=$1',[draft.id])).rows[0]
  await save({...card,status:'draft',lines:lines.map(l=>({...l,meaning:'Nieopublikowana treść robocza.'}))})
  await save({...card,status:'active',lines:lines.map(l=>({...l,meaning:'Wymyślona opublikowana aktualizacja.'}))})
  expect((await revisions())[1].before_snapshot?.lines).toEqual(lines)
})

it('zastosowanie różnic PDF zachowuje poprawki bazy i zapisuje nową oraz zmienioną kartę w historii',async()=>{
  const card=await addCard()
  const rawLines=card.lines.map(({key,label,bids,meaning})=>({key,label,bids,meaning}))
  const corrected=await save({...card,lines:card.lines.map((l,i)=>i===0?{...l,meaning:'Wymyślona poprawka redakcyjna bazy.'}:l)},false)
  const category={slug:'demo-open',name:'Test',group:'Test',notes:[]}
  const baseline=(await db.query<{id:string}>(`insert into public.import_runs(category_slug,source_file,revision,status,raw_snapshot,proposal,applied_at)
    values('demo-open','invented.pdf','test-1','applied',$1,'{}',clock_timestamp()) returning id`,[JSON.stringify({category,cards:[]})])).rows[0].id
  const nextLines=rawLines.map((l,i)=>i===1?{...l,meaning:'Wymyślona nowa treść z PDF.'}:l)
  const proposal={baseRunId:baseline,changes:[
    {kind:'changed',cardKey:card.card_key,card:{...card,lines:nextLines},oldRaw:{lines:rawLines},newRaw:{lines:nextLines},verification:'ok'},
    {kind:'added',cardKey:'invented-added',card:{...card,card_key:'invented-added',context:'Nowa wymyślona pozycja'},newRaw:{lines:rawLines},verification:'ok'},
  ]}
  const run=(await db.query<{id:string}>(`insert into public.import_runs(category_slug,source_file,revision,raw_snapshot,proposal)
    values('demo-open','invented-2.pdf','test-2',$1,$2) returning id`,[JSON.stringify({category,cards:[]}),JSON.stringify(proposal)])).rows[0].id
  await db.query('select public.apply_import_run($1,$2)',[run,'{}'])
  const rows=await revisions(),change=rows.filter(r=>r.card_id===card.id).at(-1)!
  expect(change.before_snapshot?.lines[0].meaning).toBe(corrected.lines[0].meaning)
  expect(change.after_snapshot.lines[0].meaning).toBe(corrected.lines[0].meaning)
  expect(change.after_snapshot.lines[1].meaning).toBe('Wymyślona nowa treść z PDF.')
  expect(change.after_snapshot.lines[0].changeId).toBe(corrected.lines[0].changeId)
  expect(rows.find(r=>r.card_id!==card.id)?.before_snapshot).toBeNull()
  await expect(db.query('select public.apply_import_run($1,$2)',[run,'{}'])).rejects.toThrow()
  expect(await revisions()).toHaveLength(rows.length)
})
