import { describe, expect, it } from 'vitest'
import { discussionDocument, discussionFileName } from './discussionDocument'
import { adminFixtures } from '../dev/adminFixtures'

function fixture() {
  const data=adminFixtures().data
  return {...data,reports:data.reports.filter(r=>r.kind==='discussion'),exportedAt:'2026-09-30T22:30:00Z'}
}
describe('discussion PDF content',()=>{
  it('includes current content, ticket comment and only marks selected stable keys',()=>{
    const data=fixture(),card=data.cards[0]
    card.lines[1]={...card.lines[1],label:'Zmieniony podpis',meaning:'Aktualny opis testowy'}
    card.lines[0]={...card.lines[0],label:data.reports[0].selected_lines![0].label}
    const serialized=JSON.stringify(discussionDocument(data))
    expect(serialized).toContain('Aktualny opis testowy')
    expect(serialized).toContain('Wymyślony temat: czy doprecyzować ten wariant?')
    expect(serialized).toContain('Zmieniony podpis')
    expect(serialized.match(/DO\\nDYSKUSJI/g)).toHaveLength(2)
    expect(serialized.match(/"pageBreak":"before"/g)).toHaveLength(1)
    expect(serialized).toContain('#16803e')
    expect(serialized).toContain('#254c99')
  })
  it('marks the whole position when no individual calls were selected',()=>{
    const data=fixture();data.reports=[{...data.reports[0],selected_lines:[]}]
    expect(JSON.stringify(discussionDocument(data)).match(/DO\\nDYSKUSJI/g)).toHaveLength(data.cards[0].lines.length)
  })
  it('explicitly lists removed calls and preserves tickets for missing cards',()=>{
    const data=fixture();data.reports[0].selected_lines=[{key:'removed',label:'Dawny podpis'}]
    data.reports[1].card_id='deleted-card'
    const output=JSON.stringify(discussionDocument(data))
    expect(output).toContain('których nie ma już w aktualnej karcie: Dawny podpis')
    expect(output).toContain('Brak aktualnej karty')
    expect(output).toContain(data.reports[1].card_label)
    expect(output).not.toContain('DO\\nDYSKUSJI')
  })
  it('rejects an empty selection and error tickets',()=>{
    const data=fixture()
    expect(()=>discussionDocument({...data,reports:[]})).toThrow()
    expect(()=>discussionDocument({...data,reports:[{...data.reports[0],kind:'error'}]})).toThrow()
  })
  it('uses Warsaw dates in filenames across UTC midnight',()=>{
    expect(discussionFileName('2026-09-30T22:30:00Z')).toBe('SysLoop-dyskusje-2026-10-01.pdf')
  })
})
