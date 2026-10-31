// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LearningApp from './LearningApp'
import { previewData, previewUser } from './dev/fixtures'
import { previewRepository } from './dev/previewRepository'
import { browserJournal } from './lib/learningRepository'
import { startFocus } from './lib/pomodoro'

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.useRealTimers() })

async function setup(count = 3, target = 1, timedMode = false) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 31, 12))
  const data = previewData()
  data.cards = data.cards.slice(0, count)
  data.store = {}
  localStorage.setItem('sysloop:preview:data', JSON.stringify(data))
  const repository = previewRepository(localStorage)
  const user = { ...previewUser, dailyTarget: target, timedMode }
  const app = () => <LearningApp user={user} repository={repository} journal={browserJournal(user, localStorage)} onLogout={()=>{}}/>
  await act(async () => { render(app()) })
  return { repository, app }
}

async function click(name: string | RegExp) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })) })
}

async function elapse(milliseconds: number) {
  vi.setSystemTime(Date.now() + milliseconds)
  await act(async () => { window.dispatchEvent(new Event('focus')) })
}

const startName = 'Rozpocznij pomodoro: 15 minut nauki, 3 minuty przerwy'

it('starts alongside the regular session and continues batches with normal saved progress', async () => {
  const { repository } = await setup()
  const start = screen.getByRole('button', { name: startName })
  expect(start.parentElement).toBe(screen.getByRole('button', { name: 'Rozpocznij sesję (1) →' }).parentElement)
  await click(startName)
  expect(screen.getByRole('timer', { name: 'Nauka — pozostały czas' }).textContent).toBe('15:00')
  const first = repository.inspect().session!.session.slots[0].cardId
  await click('Pokaż')
  await click('Wszystko dobrze')
  const saved = repository.inspect()
  expect(saved.attempts).toHaveLength(1)
  expect(saved.attempts[0]).toMatchObject({ cardId: first, correct: true, phase: 'main' })
  expect(saved.store[first]).toMatchObject({ interval: 3, consecutiveCorrect: 1 })
  expect(saved.session!.session.slots[0].cardId).not.toBe(first)
  expect(screen.getByRole('button', { name: 'Pokaż' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Notatki ↗' })).toBeNull()
})

it('keeps the current answer at 15 minutes and starts a full break only after saving its grade', async () => {
  const { repository } = await setup(3, 3)
  await click(startName)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Wpisuj własne znaczenia' }))
  const input = screen.getAllByRole('textbox')[0]
  fireEvent.change(input, { target: { value: 'Wymyślona odpowiedź do testu' } })
  await elapse(900000)
  expect(screen.getByText(/15 minut za Tobą/)).toBeTruthy()
  expect((input as HTMLTextAreaElement).value).toBe('Wymyślona odpowiedź do testu')
  expect(repository.inspect().attempts).toHaveLength(0)
  await click('Pokaż')
  await click('Wszystko dobrze')
  expect(screen.getByRole('timer', { name: 'Pozostały czas przerwy' }).textContent).toBe('3:00')
  expect(screen.queryByRole('button', { name: 'Pokaż' })).toBeNull()
  expect(repository.inspect().attempts[0]).toMatchObject({ correct: true, timedOut: false, phase: 'main' })
  const saved = repository.inspect()
  await elapse(180000)
  expect(screen.getByText('Wracamy do nauki?')).toBeTruthy()
  expect(repository.inspect()).toEqual(saved)
  await click('Kolejne 15 min →')
  expect(screen.getByRole('timer', { name: 'Nauka — pozostały czas' }).textContent).toBe('15:00')
  expect(screen.getByRole('button', { name: 'Pokaż' })).toBeTruthy()
})

it('retains normal correction and SRS rules before continuing the next batch', async () => {
  const { repository } = await setup()
  await click(startName)
  const first = repository.inspect().session!.session.slots[0].cardId
  await click('Pokaż')
  fireEvent.click(document.querySelector('.meaning-button')!)
  await click('Dalej · 1 błąd')
  expect(repository.inspect().session!.inBuffer).toBe(true)
  expect(repository.inspect().store[first]).toBeUndefined()
  await elapse(1000)
  await click('Pokaż')
  await click('Wszystko dobrze')
  const saved = repository.inspect()
  expect(saved.attempts.map(a=>a.phase)).toEqual(['main', 'buffer'])
  expect(saved.store[first]).toMatchObject({ status: 'LEARNING', interval: 1, consecutiveCorrect: 0, nextReviewDate: '2026-11-01' })
  expect(saved.session!.session.slots[0].cardId).not.toBe(first)
})

it('waits for a failed answer write to succeed before entering the break', async () => {
  const { repository } = await setup(3, 3)
  await click(startName)
  await elapse(900000)
  await click('Pokaż')
  vi.spyOn(repository, 'recordAttempt').mockRejectedValueOnce(new Error('Invented connection failure'))
  await click('Wszystko dobrze')
  expect(screen.queryByRole('timer', { name: 'Pozostały czas przerwy' })).toBeNull()
  expect(repository.inspect().attempts).toHaveLength(0)
  await click('Ponów zapis')
  expect(repository.inspect().attempts).toHaveLength(1)
  expect(screen.getByRole('timer', { name: 'Pozostały czas przerwy' }).textContent).toBe('3:00')
})

it('restores focus and break after reload without resetting the clock', async () => {
  const { app, repository } = await setup(3, 3)
  await click(startName)
  await elapse(60000)
  cleanup()
  await act(async () => { render(app()) })
  expect(screen.getByRole('timer', { name: 'Nauka — pozostały czas' }).textContent).toBe('14:00')
  await elapse(840000)
  await click('Pokaż')
  await click('Wszystko dobrze')
  await elapse(60000)
  const saved = repository.inspect()
  cleanup()
  await act(async () => { render(app()) })
  expect(screen.getByRole('timer', { name: 'Pozostały czas przerwy' }).textContent).toBe('2:00')
  expect(repository.inspect()).toEqual(saved)
})

it.each([false, true])('handles a write crossing the deadline, including disabling the timer during that write (%s)', async stopDuringWrite => {
  const { repository } = await setup(3, 3)
  await click(startName)
  await elapse(899000)
  await click('Pokaż')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const record = repository.recordAttempt
  vi.spyOn(repository, 'recordAttempt').mockImplementationOnce(async attempt => { await gate; await record(attempt) })
  await click('Wszystko dobrze')
  await elapse(2000)
  if(stopDuringWrite) await click('Wyłącz pomodoro')
  await act(async () => { release() })
  expect(repository.inspect().attempts).toHaveLength(1)
  expect(!!screen.queryByRole('timer', { name: 'Pozostały czas przerwy' })).toBe(!stopDuringWrite)
})

it('never starts a hidden card timer during a break', async () => {
  const { repository } = await setup(3, 3, true)
  await click(startName)
  await click('Pokaż')
  await elapse(900000)
  await click('Wszystko dobrze')
  await elapse(180000)
  await click('Kolejne 15 min →')
  expect(screen.getByRole('button', { name: 'Pokaż' })).toBeTruthy()
  expect(screen.queryByText('Czas minął — zaliczone jako błąd')).toBeNull()
  expect(repository.inspect().attempts).toHaveLength(1)
})

it('ends early when today’s pool is exhausted without repeating or pulling future cards forward', async () => {
  const { repository } = await setup(1)
  await click(startName)
  await click('Pokaż')
  await click('Wszystko dobrze')
  expect(screen.getByText(/Wszystkie dostępne karty na dziś zrobione/)).toBeTruthy()
  await elapse(180000)
  expect(screen.queryByRole('button', { name: 'Kolejne 15 min →' })).toBeNull()
  expect(repository.inspect().attempts).toHaveLength(1)
  await click('Zakończ pomodoro')
  expect(screen.queryByRole('button', { name: startName })).toBeNull()
})

it('can disable pomodoro without grading or replacing the active card', async () => {
  const { repository } = await setup()
  await click(startName)
  const saved = repository.inspect()
  await click('Wyłącz pomodoro')
  expect(screen.queryByRole('timer', { name: 'Nauka — pozostały czas' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Pokaż' })).toBeTruthy()
  expect(repository.inspect()).toEqual(saved)
  expect(sessionStorage.getItem(`sysloop:pomodoro:${previewUser.id}`)).toBeNull()
})

it('does not start the timer if starting the session fails', async () => {
  const { repository } = await setup()
  vi.spyOn(repository, 'saveSession').mockRejectedValueOnce(new Error('Invented connection failure'))
  await click(startName)
  expect(screen.queryByRole('timer', { name: 'Nauka — pozostały czas' })).toBeNull()
  expect(repository.inspect().session).toBeNull()
})

it('restores an expired focus timer as finishing, without grading a card', async () => {
  const { app, repository } = await setup(3, 3)
  await click(startName)
  cleanup()
  sessionStorage.setItem(`sysloop:pomodoro:${previewUser.id}`, JSON.stringify(startFocus(Date.now() - 1800000)))
  await act(async () => { render(app()) })
  expect(screen.getByText(/15 minut za Tobą/)).toBeTruthy()
  expect(repository.inspect().attempts).toHaveLength(0)
})
