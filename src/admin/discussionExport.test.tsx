// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReportsAdmin } from './ReportsAdmin'
import { AdminPanel } from './AdminPanel'
import { adminFixtures, adminPreviewUser } from '../dev/adminFixtures'
import { adminPreviewRepository } from '../dev/adminRepository'
import { createDiscussionPdf } from './discussionPdf'
import type { ReportRow } from '../lib/database.types'

vi.mock('./discussionPdf',()=>({createDiscussionPdf:vi.fn(async()=>({blob:new Blob(['pdf']),name:'test.pdf'}))}))
beforeEach(()=>{
  vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=>'blob:test'),revokeObjectURL:vi.fn()}))
})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals()})
const props=()=>({reports:adminFixtures().data.reports,busy:false,update:vi.fn(async()=>true),remove:vi.fn(async()=>true),onEdit:vi.fn(),exportPdf:vi.fn<(reports:ReportRow[])=>Promise<{blob:Blob;name:string}>>().mockResolvedValue({blob:new Blob(['pdf']),name:'test.pdf'})})
it('exports visible discussions, optionally resolved ones, or a single topic; cleans download URLs',async()=>{
  const p=props(),view=render(<ReportsAdmin {...p} kind="discussion"/>)
  fireEvent.click(screen.getByRole('button',{name:'Eksportuj PDF (1)'}))
  const link=await screen.findByRole('link',{name:'Pobierz PDF'})
  expect(link.getAttribute('download')).toBe('test.pdf')
  expect(p.exportPdf.mock.calls[0][0].map(r=>r.id)).toEqual([2])
  fireEvent.click(screen.getByLabelText('Pokaż również omówione'))
  fireEvent.click(screen.getByRole('button',{name:'Eksportuj PDF (2)'}))
  await waitFor(()=>expect(p.exportPdf).toHaveBeenCalledTimes(2))
  await screen.findByRole('link',{name:'Pobierz PDF'})
  expect(p.exportPdf.mock.calls[1][0].map(r=>r.id)).toEqual([2,3])
  fireEvent.click(screen.getByRole('button',{name:'PDF tematu #3'}))
  await screen.findByRole('link',{name:'Pobierz PDF'})
  expect(p.exportPdf.mock.calls[2][0].map(r=>r.id)).toEqual([3])
  expect(p.update).not.toHaveBeenCalled();expect(p.remove).not.toHaveBeenCalled()
  view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
})
it('shows failures, allows retry and disables empty exports',async()=>{
  const p=props();p.exportPdf.mockRejectedValueOnce(new Error('offline'))
  const view=render(<ReportsAdmin {...p} kind="discussion"/>)
  fireEvent.click(screen.getByRole('button',{name:'Eksportuj PDF (1)'}))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('link',{name:'Pobierz PDF'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Eksportuj PDF (1)'}))
  await screen.findByRole('link',{name:'Pobierz PDF'})
  view.rerender(<ReportsAdmin {...p} reports={[]} kind="discussion"/>)
  expect((screen.getByRole('button',{name:'Eksportuj PDF (0)'}) as HTMLButtonElement).disabled).toBe(true)
})
it('reloads current cards and comments before generating, without changing the ticket',async()=>{
  const repository=adminPreviewRepository(),data=adminFixtures().data
  vi.spyOn(repository,'load').mockResolvedValueOnce(data)
  const updated=structuredClone(data);updated.cards[0].lines[0].meaning='Najnowszy wymyślony opis';updated.reports[1].message='Najnowszy komentarz'
  vi.mocked(repository.load).mockResolvedValue(updated)
  const write=vi.spyOn(repository,'updateReport')
  render(<AdminPanel user={adminPreviewUser} repository={repository} onBack={()=>{}}/>)
  await screen.findByRole('heading',{name:'Karty'})
  fireEvent.click(screen.getByRole('button',{name:'Do dyskusji'}))
  fireEvent.click(screen.getByRole('button',{name:'Eksportuj PDF (1)'}))
  await screen.findByRole('link',{name:'Pobierz PDF'})
  expect(createDiscussionPdf).toHaveBeenCalledWith(expect.objectContaining({cards:updated.cards,reports:[updated.reports[1]]}))
  expect(repository.load).toHaveBeenCalledTimes(2);expect(write).not.toHaveBeenCalled()
})
