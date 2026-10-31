export const FOCUS_SECONDS = 15 * 60
export const BREAK_SECONDS = 3 * 60

export type PomodoroState =
  | { phase: 'idle' | 'finishing' | 'ready' }
  | { phase: 'focus' | 'break'; deadline: number }

export function startFocus(now: number): PomodoroState {
  return { phase: 'focus', deadline: now + FOCUS_SECONDS * 1000 }
}

export function startBreak(now: number): PomodoroState {
  return { phase: 'break', deadline: now + BREAK_SECONDS * 1000 }
}

// Absolute deadlines stay accurate after a sleeping tab wakes up.
export function advancePomodoro(state: PomodoroState, now: number): PomodoroState {
  if ('deadline' in state && now >= state.deadline) {
    return { phase: state.phase === 'focus' ? 'finishing' : 'ready' }
  }
  return state
}

export function remainingSeconds(state: PomodoroState, now: number) {
  return 'deadline' in state ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : 0
}

export function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function restorePomodoro(raw: string | null, now: number): PomodoroState {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object' || !('phase' in value)) return { phase: 'idle' }
    if (value.phase === 'finishing' || value.phase === 'ready') return { phase: value.phase }
    if ((value.phase === 'focus' || value.phase === 'break') && 'deadline' in value &&
      typeof value.deadline === 'number' && Number.isFinite(value.deadline) &&
      value.deadline <= now + (value.phase === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS) * 1000) {
      return advancePomodoro({ phase: value.phase, deadline: value.deadline }, now)
    }
  } catch { /* Invalid or unavailable tab storage starts a fresh timer. */ }
  return { phase: 'idle' }
}
