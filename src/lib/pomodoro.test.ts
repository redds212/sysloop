import { expect, it } from 'vitest'
import { advancePomodoro, BREAK_SECONDS, FOCUS_SECONDS, formatCountdown, remainingSeconds, restorePomodoro, startBreak, startFocus } from './pomodoro'

it('gives 15 minutes of focus and then waits for the current answer', () => {
  const focus = startFocus(1000)
  expect(FOCUS_SECONDS).toBe(900)
  expect(remainingSeconds(focus, 1000)).toBe(900)
  expect(advancePomodoro(focus, 900999).phase).toBe('focus')
  expect(advancePomodoro(focus, 901000)).toEqual({ phase: 'finishing' })
})

it('gives the full 3 minute break and waits for an explicit new cycle', () => {
  const rest = startBreak(1234567)
  expect(BREAK_SECONDS).toBe(180)
  expect(remainingSeconds(rest, 1234567)).toBe(180)
  expect(advancePomodoro(rest, 1234567 + 180000)).toEqual({ phase: 'ready' })
  expect(advancePomodoro({ phase: 'ready' }, 99999999)).toEqual({ phase: 'ready' })
})

it('catches up after a sleeping tab without inventing completed focus cycles', () => {
  expect(advancePomodoro(startFocus(0), 3600000)).toEqual({ phase: 'finishing' })
  expect(advancePomodoro(startBreak(0), 3600000)).toEqual({ phase: 'ready' })
  expect(remainingSeconds(startFocus(0), 3600000)).toBe(0)
})

it('restores deadlines across reloads and ignores invalid storage', () => {
  expect(restorePomodoro(JSON.stringify(startFocus(0)), 60000)).toEqual(startFocus(0))
  expect(restorePomodoro(JSON.stringify(startFocus(0)), 900000)).toEqual({ phase: 'finishing' })
  expect(restorePomodoro(JSON.stringify(startBreak(0)), 180000)).toEqual({ phase: 'ready' })
  for (const raw of [null, '{', '{}', 'null', '42', '{"phase":"focus","deadline":"later"}', '{"phase":"focus","deadline":999999999}']) {
    expect(restorePomodoro(raw, 0)).toEqual({ phase: 'idle' })
  }
})

it('shows minutes and zero-padded seconds, rounding up partial seconds', () => {
  expect(formatCountdown(900)).toBe('15:00')
  expect(formatCountdown(180)).toBe('3:00')
  expect(formatCountdown(9)).toBe('0:09')
  expect(formatCountdown(0)).toBe('0:00')
  expect(remainingSeconds(startFocus(0), 899999)).toBe(1)
})
