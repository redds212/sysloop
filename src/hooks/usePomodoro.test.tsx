// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePomodoro } from './usePomodoro'

afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.useRealTimers() })

it('restores a running clock after reload and stores only timer metadata', () => {
  vi.useFakeTimers()
  const first = renderHook(() => usePomodoro('invented-user'))
  act(() => first.result.current.begin())
  expect(first.result.current.remaining).toBe(900)
  act(() => vi.advanceTimersByTime(60000))
  first.unmount()
  const second = renderHook(() => usePomodoro('invented-user'))
  expect(second.result.current.remaining).toBe(840)
  expect(Object.keys(JSON.parse(sessionStorage.getItem('sysloop:pomodoro:invented-user')!)).sort()).toEqual(['config', 'deadline', 'phase'])
  act(() => second.result.current.stop())
  expect(second.result.current.state.phase).toBe('idle')
  expect(sessionStorage.getItem('sysloop:pomodoro:invented-user')).toBeNull()
})

it('resynchronizes on focus after sleep and never starts another focus cycle automatically', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => usePomodoro('invented-user'))
  act(() => result.current.begin())
  vi.setSystemTime(Date.now() + 20 * 60000)
  act(() => window.dispatchEvent(new Event('focus')))
  expect(result.current.state.phase).toBe('finishing')
  act(() => result.current.takeBreak())
  expect(result.current.remaining).toBe(180)
  act(() => vi.advanceTimersByTime(180000))
  expect(result.current.state.phase).toBe('ready')
  act(() => vi.advanceTimersByTime(900000))
  expect(result.current.state.phase).toBe('ready')
  act(() => result.current.begin())
  expect(result.current.remaining).toBe(900)
})

it('does not restore another user’s clock', () => {
  const first = renderHook(() => usePomodoro('invented-first'))
  act(() => first.result.current.begin())
  first.unmount()
  const second = renderHook(() => usePomodoro('invented-second'))
  expect(second.result.current.state.phase).toBe('idle')
})

it('remembers preferences per user while retaining the running cycle across reloads', () => {
  vi.useFakeTimers()
  const first = renderHook(() => usePomodoro('invented-first'))
  act(() => first.result.current.setConfig({ focusMinutes: 20, breakMinutes: 1 }))
  act(() => first.result.current.begin())
  act(() => first.result.current.setConfig({ focusMinutes: 25, breakMinutes: 5 }))
  expect(first.result.current.remaining).toBe(1200)
  first.unmount()
  const resumed = renderHook(() => usePomodoro('invented-first'))
  expect(resumed.result.current.config).toEqual({ focusMinutes: 25, breakMinutes: 5 })
  expect(resumed.result.current.remaining).toBe(1200)
  act(() => resumed.result.current.takeBreak())
  expect(resumed.result.current.remaining).toBe(60)
  act(() => resumed.result.current.stop())
  act(() => resumed.result.current.begin())
  expect(resumed.result.current.remaining).toBe(1500)
  resumed.unmount()
  const other = renderHook(() => usePomodoro('invented-second'))
  expect(other.result.current.config).toEqual({ focusMinutes: 15, breakMinutes: 3 })
  expect(other.result.current.state.phase).toBe('idle')
})
