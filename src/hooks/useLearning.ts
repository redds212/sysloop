import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppUser, Attempt, Card, SRSEntry, UserSettings } from '../types'
import type { Journal, LearningData, LearningOperation, LearningRepository } from '../lib/learningRepository'
import { flushOperation } from '../lib/learningRepository'
import { generateDailySession, adaptSession } from '../lib/session'
import { answerSession, currentCardId, restoreSession, startSession, type SessionState } from '../lib/sessionState'
import { normalizeEntry } from '../lib/srs'
import { todayKey } from '../lib/date'
import { useDayKey } from './useDayKey'
import { unfinishedCorrections } from '../lib/dayRollover'

async function hydrate(repository: LearningRepository, journal: Journal) {
  await flushOperation(repository,journal)
  const loaded = await repository.load()
  for (const progress of unfinishedCorrections(loaded)) {
    await flushOperation(repository,journal,{progress})
    loaded.store[progress.cardId] = progress.entry
  }
  loaded.session = loaded.session ? restoreSession(loaded.session,loaded.cards) : null
  return loaded
}

export function useLearning(user: AppUser, repository: LearningRepository, journal: Journal) {
  const [data, setData] = useState<LearningData | null>(null)
  const [settings, setSettings] = useState<UserSettings>({ dailyTarget: user.dailyTarget, mode: user.mode, timedMode: user.timedMode })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const day = useDayKey()
  const [loadedDay,setLoadedDay] = useState('')
  const session = data?.session?.session.date === day ? data.session : null
  const load = useCallback(async () => {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const loaded = await hydrate(repository,journal)
      setData(loaded)
      setLoadedDay(todayKey())
      return true
    } catch { setError('Nie udało się wczytać danych. Sprawdź połączenie i spróbuj ponownie.'); return false }
    finally { lock.current = false; setBusy(false) }
  }, [repository, journal])
  useEffect(() => { let active = true; void (async () => {
    try {
      const loaded = await hydrate(repository,journal)
      if(active) { setData(loaded); setLoadedDay(day) }
    } catch { if(active) setError('Nie udało się wczytać danych. Sprawdź połączenie i spróbuj ponownie.') }
  })(); return () => { active = false } }, [repository,journal,day])

  async function commit(operation: LearningOperation) {
    if (lock.current) throw new Error('Trwa zapisywanie odpowiedzi.')
    lock.current = true; setBusy(true); setError('')
    try {
      // A previous failure must be recovered, never replaced by a new rating.
      const pending = journal.read()
      if (pending && JSON.stringify(pending) !== JSON.stringify(operation)) {
        throw new Error('Najpierw dokończ poprzedni zapis.')
      }
      const actual = pending ?? operation
      await flushOperation(repository,journal,actual)
      setData(previous => previous && ({ ...previous,
        store: actual.progress ? { ...previous.store, [actual.progress.cardId]: actual.progress.entry } : previous.store,
        attempts: actual.attempt && !previous.attempts.some(a => a.cardId === actual.attempt!.cardId && a.ts === actual.attempt!.ts) ? [...previous.attempts, actual.attempt] : previous.attempts,
        session: actual.session ?? previous.session,
      }))
      return actual
    } catch {
      setError('Odpowiedź czeka na zapis. Przywróć połączenie i kliknij „Ponów zapis”.')
      throw new Error('Zapis nie został potwierdzony.')
    } finally { lock.current = false; setBusy(false) }
  }
  const attemptedIds = new Set(data?.attempts.map(a => a.cardId))
  const queue = data ? generateDailySession(data.cards,data.store,settings,new Date(),attemptedIds) : null
  async function begin() {
    if (!data || !queue || loadedDay !== todayKey()) return
    let next = session ?? startSession(queue)
    const adjusted = adaptSession(next.session,next.index,data.cards,data.store,settings,new Date(),attemptedIds)
    next = { ...next, session: adjusted, inBuffer: next.inBuffer || (next.index >= adjusted.slots.length && next.buffer.length > 0) }
    next = restoreSession(next,data.cards) ?? startSession(queue)
    await commit({ session: next })
  }
  async function answer(attempt: Attempt) {
    if(!data || !session || session.session.date !== todayKey()) throw new Error('Rozpoczął się nowy dzień. Wróć do dzisiejszej sesji.')
    const result = answerSession(session,attempt,normalizeEntry(data.store[attempt.cardId]),new Date(attempt.ts))
    result.state = restoreSession(result.state,data.cards) ?? result.state
    await commit({ attempt, ...(result.progress ? { progress: { cardId: attempt.cardId, entry: result.progress } } : {}), session: result.state })
  }
  async function saveVisit(attempt: Attempt, entry: SRSEntry) { await commit({ attempt, progress: { cardId: attempt.cardId, entry } }) }
  async function restoreVisit(card: Card, entry: SRSEntry) { await commit({ progress: { cardId: card.id, entry } }) }
  async function updateSettings(next: UserSettings) {
    if(lock.current) return
    if(journal.read()) throw new Error('Najpierw dokończ poprzedni zapis.')
    lock.current=true; setBusy(true)
    try {
      await repository.saveSettings(next)
      if(data && session && !session.inBuffer) {
        const adapted = adaptSession(session.session,session.index,data.cards,data.store,next,new Date(),attemptedIds)
        const nextSession: SessionState = { ...session, session: adapted, inBuffer: session.index >= adapted.slots.length && session.buffer.length > 0 }
        await flushOperation(repository,journal,{session:nextSession})
        setData({...data,session:nextSession})
      }
      setSettings(next); setError('')
    } catch { setError('Nie udało się zapisać ustawień. Spróbuj ponownie.'); throw new Error('Zapis ustawień nie powiódł się.') }
    finally { lock.current=false; setBusy(false) }
  }
  return { data, loading: !data || loadedDay !== day, settings, session, queue, currentId: session ? currentCardId(session) : null, day, busy, error, load, begin, answer, saveVisit, restoreVisit, updateSettings }
}
