// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { UsersAdmin } from './UsersAdmin'
import { adminFixtures } from '../dev/adminFixtures'
import { adminPreviewRepository } from '../dev/adminRepository'

afterEach(cleanup)
const users=adminFixtures().data.users
const props={users,currentId:users[0].id,busy:false,update:async()=>true,remove:async()=>true}
it('pokazuje zwarte liczniki, logowanie w Warszawie i konto bez aktywności',async()=>{
  render(<UsersAdmin {...props} loadActivity={adminPreviewRepository().userActivity}/>)
  await screen.findByText('428 / 86')
  const own=within(screen.getByRole('article',{name:users[0].username}))
  expect(own.getByText('12')).toBeTruthy()
  expect(own.getByText('30.09.26, 09:35')).toBeTruthy()
  const pending=within(screen.getByRole('article',{name:users[1].username}))
  expect(pending.getByText('0 / 0')).toBeTruthy()
  expect(pending.getByText('Nigdy')).toBeTruthy()
  expect(pending.getByText('Zarządzaj').closest('details')?.open).toBe(false)
  fireEvent.click(pending.getByText('Zarządzaj'))
  expect(pending.getByText('Zarządzaj').closest('details')?.open).toBe(true)
  expect(pending.getByRole('button',{name:'Usuń konto'})).toBeTruthy()
})
it('błąd pobierania nie udaje zer i nie blokuje zarządzania kontem; można ponowić',async()=>{
  const load=vi.fn().mockRejectedValueOnce(new Error('Statystyki wymagają migracji 0010_admin_user_activity.sql w Supabase.')).mockResolvedValue(await adminPreviewRepository().userActivity())
  render(<UsersAdmin {...props} loadActivity={load}/>)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('0 / 0')).toBeNull()
  fireEvent.click(screen.getByText('Zarządzaj'))
  expect((screen.getByRole('button',{name:'Zatwierdź dostęp'}) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'Odśwież aktywność'}))
  await screen.findByText('428 / 86')
  expect(screen.queryByRole('alert')).toBeNull()
})
