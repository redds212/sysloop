import { expect, it } from 'vitest'
import { advancePomodoro, DEFAULT_POMODORO, BREAK_MINUTES, FOCUS_MINUTES, BREAK_SECONDS, FOCUS_SECONDS, formatCountdown, remainingSeconds, restorePomodoro, restorePomodoroConfig, startBreak, startFocus } from './pomodoro'

it('gives 15 minutes of focus and then waits for the current answer', () => {
  const focus = startFocus(1000)
  expect(FOCUS_SECONDS).toBe(900)
  expect(remainingSeconds(focus, 1000)).toBe(900)
  expect(advancePomodoro(focus, 900999).phase).toBe('focus')
  expect(advancePomodoro(focus, 901000)).toEqual({ phase: 'finishing', config: DEFAULT_POMODORO })
})

it('gives the full 3 minute break and waits for an explicit new cycle', () => {
  const rest = startBreak(1234567)
  expect(BREAK_SECONDS).toBe(180)
  expect(remainingSeconds(rest, 1234567)).toBe(180)
  expect(advancePomodoro(rest, 1234567 + 180000)).toEqual({ phase: 'ready', config: DEFAULT_POMODORO })
  expect(advancePomodoro({ phase: 'ready', config: DEFAULT_POMODORO }, 99999999)).toEqual({ phase: 'ready', config: DEFAULT_POMODORO })
})

it('catches up after a sleeping tab without inventing completed focus cycles', () => {
  expect(advancePomodoro(startFocus(0), 3600000)).toEqual({ phase: 'finishing', config: DEFAULT_POMODORO })
  expect(advancePomodoro(startBreak(0), 3600000)).toEqual({ phase: 'ready', config: DEFAULT_POMODORO })
  expect(remainingSeconds(startFocus(0), 3600000)).toBe(0)
})

it('restores deadlines across reloads and ignores invalid storage', () => {
  expect(restorePomodoro(JSON.stringify(startFocus(0)), 60000)).toEqual(startFocus(0))
  expect(restorePomodoro(JSON.stringify(startFocus(0)), 900000)).toEqual({ phase: 'finishing', config: DEFAULT_POMODORO })
  expect(restorePomodoro(JSON.stringify(startBreak(0)), 180000)).toEqual({ phase: 'ready', config: DEFAULT_POMODORO })
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

it.each(FOCUS_MINUTES.flatMap(focusMinutes => BREAK_MINUTES.map(breakMinutes => ({ focusMinutes, breakMinutes }))))('supports a $focusMinutes/$breakMinutes cycle through deadlines and reloads', config => {
  const focus = startFocus(0, config)
  expect(remainingSeconds(focus, 0)).toBe(config.focusMinutes * 60)
  expect(restorePomodoro(JSON.stringify(focus), 1000)).toEqual(focus)
  const finishing = advancePomodoro(focus, config.focusMinutes * 60000)
  expect(finishing).toEqual({ phase: 'finishing', config })
  expect(restorePomodoro(JSON.stringify(finishing), 1000)).toEqual(finishing)
  const rest = startBreak(0, config)
  expect(remainingSeconds(rest, 0)).toBe(config.breakMinutes * 60)
  expect(restorePomodoro(JSON.stringify(rest), 1000)).toEqual(rest)
  expect(advancePomodoro(rest, config.breakMinutes * 60000)).toEqual({ phase: 'ready', config })
})

it('restores old 15/3 timers and rejects unsupported or malformed duration settings', () => {
  expect(restorePomodoro('{"phase":"focus","deadline":900000}', 0)).toEqual(startFocus(0))
  expect(restorePomodoro('{"phase":"finishing"}', 0)).toEqual({ phase: 'finishing', config: DEFAULT_POMODORO })
  for (const config of [null, {}, { focusMinutes: 30, breakMinutes: 3 }, { focusMinutes: 20, breakMinutes: 2 }, { focusMinutes: '25', breakMinutes: 5 }]) {
    expect(restorePomodoroConfig(JSON.stringify(config))).toEqual(DEFAULT_POMODORO)
    expect(restorePomodoro(JSON.stringify({ phase: 'focus', deadline: 100, config }), 0)).toEqual({ phase: 'idle' })
  }
  expect(restorePomodoroConfig('{')).toEqual(DEFAULT_POMODORO)
  expect(restorePomodoroConfig('{"focusMinutes":25,"breakMinutes":5}')).toEqual({ focusMinutes: 25, breakMinutes: 5 })
})
