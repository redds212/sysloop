import { beforeEach, expect, it, vi } from 'vitest'
import { createRepository } from './supabaseRepository'
import { DiscussionsUnavailableError, selectedReportLines } from './reporting'
import { previewData, previewUser } from '../dev/fixtures'

const {insert,from}=vi.hoisted(()=>{
  const insert=vi.fn()
  return {insert,from:vi.fn(()=>({insert}))}
})
vi.mock('./supabase',()=>({supabase:{from}}))
beforeEach(()=>{vi.clearAllMocks();insert.mockResolvedValue({data:null,error:null})})

it('zapisuje temat i wybrane odzywki bez pobierania zgłoszeń użytkownika',async()=>{
  const card=previewData().cards[0]
  await createRepository(previewUser).report(card,undefined,'Propozycja testowa','discussion',[card.lines[1].key])
  expect(from).toHaveBeenCalledWith('card_reports')
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({kind:'discussion',selected_lines:[{key:card.lines[1].key,label:card.lines[1].label}],message:'Propozycja testowa',card_id:card.id,user_id:previewUser.id}))
  expect(JSON.stringify(insert.mock.calls)).not.toContain(card.lines[1].meaning)
})
it('dotychczasowe zgłoszenia działają także przed migracją',async()=>{
  await createRepository(previewUser).report(previewData().cards[0],undefined,'Błąd testowy')
  expect(insert.mock.calls[0][0]).not.toHaveProperty('kind')
  expect(insert.mock.calls[0][0]).not.toHaveProperty('selected_lines')
})
it.each(['kind','selected_lines'])('nie zamienia tematu na błąd, gdy brakuje kolumny %s',async column=>{
  insert.mockResolvedValue({data:null,error:{code:'PGRST204',message:`Missing ${column} column`}})
  await expect(createRepository(previewUser).report(previewData().cards[0],undefined,'Temat testowy','discussion')).rejects.toBeInstanceOf(DiscussionsUnavailableError)
  expect(insert).toHaveBeenCalledTimes(1)
})
it('nie interpretuje odmowy dostępu jako braku migracji',async()=>{
  insert.mockResolvedValue({data:null,error:{code:'42501',message:'Permission denied'}})
  await expect(createRepository(previewUser).report(previewData().cards[0],undefined,'Temat testowy','discussion')).rejects.not.toBeInstanceOf(DiscussionsUnavailableError)
})
it('zakres zachowuje kolejność karty, usuwa duplikaty i odrzuca nieistniejące odzywki',()=>{
  const card=previewData().cards[0],first=card.lines[0],second=card.lines[1]
  expect(selectedReportLines(card,'discussion',[second.key,first.key,first.key])).toEqual([first,second].map(({key,label})=>({key,label})))
  expect(selectedReportLines(card,'discussion',[])).toEqual([])
  expect(()=>selectedReportLines(card,'discussion',['missing-test-key'])).toThrow()
  expect(()=>selectedReportLines(card,'error',[first.key])).toThrow()
})
