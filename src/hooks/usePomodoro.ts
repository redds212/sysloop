import { useCallback, useEffect, useState } from 'react'
import { advancePomodoro, DEFAULT_POMODORO, remainingSeconds, restorePomodoro, restorePomodoroConfig, startBreak, startFocus, type PomodoroConfig, type PomodoroState } from '../lib/pomodoro'

export function usePomodoro(userId: string) {
  const key = `sysloop:pomodoro:${userId}`
  const configKey = `sysloop:pomodoro-config:${userId}`
  const [config, setConfig] = useState<PomodoroConfig>(() => {
    try { return restorePomodoroConfig(localStorage.getItem(configKey)) } catch { return { ...DEFAULT_POMODORO } }
  })
  const [clock, setClock] = useState(() => {
    const now = Date.now()
    let state: PomodoroState = { phase: 'idle' }
    try { state = restorePomodoro(sessionStorage.getItem(key), now) } catch { /* Storage is optional. */ }
    return { state, now }
  })
  const { state, now } = clock

  useEffect(() => {
    try { localStorage.setItem(configKey, JSON.stringify(config)) } catch { /* Preferences still work for this visit. */ }
  }, [configKey, config])

  useEffect(() => {
    // Only timer metadata; no card content or answers are stored here.
    try {
      if (state.phase === 'idle') sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify(state))
    } catch { /* The timer still works without persistence. */ }
  }, [key, state])

  useEffect(() => {
    if (state.phase !== 'focus' && state.phase !== 'break') return
    const tick = () => {
      const nextNow = Date.now()
      setClock(previous => ({ state: advancePomodoro(previous.state, nextNow), now: nextNow }))
    }
    const interval = window.setInterval(tick, 250)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [state.phase])

  const begin = useCallback(() => {
    const time = Date.now()
    setClock({ state: startFocus(time, config), now: time })
  }, [config])
  const takeBreak = useCallback(() => {
    const time = Date.now()
    setClock(previous => previous.state.phase === 'focus' || previous.state.phase === 'finishing'
      ? { state: startBreak(time, previous.state.config), now: time } : previous)
  }, [])
  const finishCard = useCallback(() => {
    const time = Date.now()
    setClock(previous => previous.state.phase !== 'idle' && advancePomodoro(previous.state, time).phase === 'finishing'
      ? { state: startBreak(time, previous.state.config), now: time }
      : previous)
  }, [])
  const stop = useCallback(() => {
    // Logout/navigation can unmount the hook before the persistence effect runs.
    try { sessionStorage.removeItem(key) } catch { /* Storage is optional. */ }
    setClock({ state: { phase: 'idle' }, now: Date.now() })
  }, [key])

  return { state, config, setConfig, remaining: remainingSeconds(state, now), begin, takeBreak, finishCard, stop }
}
