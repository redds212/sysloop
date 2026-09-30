import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import type { UserActivityRow } from './database.types'

const admin='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',pending='00000000-0000-4000-8000-000000000003'
const card='00000000-0000-4000-8000-000000000010'
let db:PGlite
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid,bucket_id text);`)
  for(const file of ['0001_schema','0002_access','0006_difficult_practice','0010_admin_user_activity','0010_admin_user_activity'])
    await db.exec(readFileSync(`supabase/migrations/${file}.sql`,'utf8'))
  for(const [id,isAdmin,status] of [[admin,true,'approved'],[member,false,'approved'],[pending,false,'pending']] as const){
    await db.query('insert into auth.users(id) values($1)',[id])
    await db.query('insert into public.profiles(id,is_admin,status) values($1,$2,$3)',[id,isAdmin,status])
  }
},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
  await db.exec(`reset role; truncate public.attempts; update auth.users set last_sign_in_at=null; set timezone='Pacific/Honolulu';`)
  await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',admin])
})
async function attempt(daysAgo:number,phase='main',scope='full',id=card) {
  await db.query(`insert into public.attempts(user_id,card_id,correct,phase,scope,missed_line_keys,present_line_keys,line_count,ts)
    values($1,$2,false,$3,$4,array['P'],array['P'],1,
      ((now() at time zone 'Europe/Warsaw')::date - $5::int)::timestamp at time zone 'Europe/Warsaw')`,[member,id,phase,scope,daysAgo])
}
async function activity(id=member){
  const row=(await db.query<UserActivityRow>('select * from public.admin_user_activity() where user_id=$1',[id])).rows[0]
  return {...row,streak_days:Number(row.streak_days),total_attempts:Number(row.total_attempts),unique_cards:Number(row.unique_cards)}
}
it('nowe konto ma zera i brak logowania, niezależnie od daty utworzenia profilu',async()=>{
  expect(await activity()).toEqual({user_id:member,streak_days:0,total_attempts:0,unique_cards:0,last_sign_in_at:null})
})
it('liczy kalendarz Warszawy pomimo innej strefy bazy; granica północy rozdziela dni',async()=>{
  await attempt(0)
  await db.query(`insert into public.attempts(user_id,card_id,correct,phase,missed_line_keys,present_line_keys,line_count,ts)
    values($1,$2,true,'free','{}',array['P'],1,
      ((now() at time zone 'Europe/Warsaw')::date::timestamp at time zone 'Europe/Warsaw') - interval '1 second')`,[member,card])
  await attempt(2)
  expect(await activity()).toMatchObject({streak_days:3,total_attempts:3,unique_cards:1})
})
it('zachowuje serię do końca dnia po ostatnim ćwiczeniu, zliczając dzień tylko raz',async()=>{
  await attempt(1);await attempt(1);await attempt(2);await attempt(3);await attempt(6)
  expect(await activity()).toMatchObject({streak_days:3,total_attempts:5})
})
it('przerwa kończy serię, wcześniejszy długi streak jej nie przedłuża',async()=>{
  await attempt(0);await attempt(2);await attempt(3);await attempt(4)
  expect((await activity()).streak_days).toBe(1)
  await db.exec('delete from public.attempts where ts >= ((now() at time zone \'Europe/Warsaw\')::date::timestamp at time zone \'Europe/Warsaw\')')
  expect((await activity()).streak_days).toBe(0)
})
it('volume uwzględnia wszystkie fazy i częściowe poprawki, a różne karty liczy osobno',async()=>{
  await attempt(0);await attempt(0,'buffer','partial');await attempt(0,'free');await attempt(0,'hard','full',pending)
  await attempt(-2) // Przyszły znacznik nie tworzy aktywności.
  expect(await activity()).toMatchObject({streak_days:1,total_attempts:4,unique_cards:2})
  expect((await activity(admin)).total_attempts).toBe(0)
})
it('agreguje całą historię, również powyżej limitu 1000 wierszy API',async()=>{
  await db.query(`insert into public.attempts(user_id,card_id,correct,phase,missed_line_keys,present_line_keys,line_count,ts)
    select $1::uuid,$2::uuid,true,'main','{}',array['P'],1,
      ((now() at time zone 'Europe/Warsaw')::date - n)::timestamp at time zone 'Europe/Warsaw'
    from generate_series(0,1100) n`,[member,card])
  expect(await activity()).toMatchObject({streak_days:1101,total_attempts:1101,unique_cards:1})
})
it('odczytuje faktyczne logowanie Auth, a nie czas odpowiedzi',async()=>{
  await db.query("update auth.users set last_sign_in_at='2026-03-29T00:30:00Z' where id=$1",[member])
  await attempt(0)
  expect(new Date((await activity()).last_sign_in_at!).toISOString()).toBe('2026-03-29T00:30:00.000Z')
})
it('tylko admin odczytuje agregaty; nie udostępnia bezpośrednio Auth ani cudzej historii',async()=>{
  await attempt(0)
  await db.exec('set role authenticated')
  expect((await activity()).total_attempts).toBe(1)
  expect((await db.query('select * from public.attempts')).rows).toHaveLength(0)
  await expect(db.exec('select * from auth.users')).rejects.toThrow()
  for(const id of [member,pending,'']){
    await db.query('select set_config($1,$2,false)',['request.jwt.claim.sub',id])
    await expect(db.exec('select * from public.admin_user_activity()')).rejects.toThrow(/Administrator access required/)
  }
  await db.exec('reset role; set role anon')
  await expect(db.exec('select * from public.admin_user_activity()')).rejects.toThrow(/permission denied/)
})
