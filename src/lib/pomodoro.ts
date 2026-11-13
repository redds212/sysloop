export const FOCUS_SECONDS = 15 * 60
export const BREAK_SECONDS = 3 * 60

export const FOCUS_MINUTES = [15, 20, 25] as const
export const BREAK_MINUTES = [1, 3, 5] as const
export interface PomodoroConfig {
  focusMinutes: typeof FOCUS_MINUTES[number];
  breakMinutes: typeof BREAK_MINUTES[number];
}
export const DEFAULT_POMODORO: PomodoroConfig = { focusMinutes: 15, breakMinutes: 3 }

function isConfig(value: unknown): value is PomodoroConfig {
  return !!value && typeof value === 'object' && 'focusMinutes' in value && 'breakMinutes' in value &&
    FOCUS_MINUTES.some(n => n === value.focusMinutes) && BREAK_MINUTES.some(n => n === value.breakMinutes)
}

export function restorePomodoroConfig(raw: string | null): PomodoroConfig {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (isConfig(value)) return { focusMinutes: value.focusMinutes, breakMinutes: value.breakMinutes }
  } catch { /* Invalid preferences use the default durations. */ }
  return { ...DEFAULT_POMODORO }
}

export type PomodoroState =
  | { phase: 'idle' }
  | { phase: 'finishing' | 'ready'; config: PomodoroConfig }
  | { phase: 'focus' | 'break'; deadline: number; config: PomodoroConfig }

export function startFocus(now: number, config: PomodoroConfig = DEFAULT_POMODORO): PomodoroState {
  return { phase: 'focus', deadline: now + config.focusMinutes * 60000, config: { ...config } }
}

export function startBreak(now: number, config: PomodoroConfig = DEFAULT_POMODORO): PomodoroState {
  return { phase: 'break', deadline: now + config.breakMinutes * 60000, config: { ...config } }
}

// Absolute deadlines stay accurate after a sleeping tab wakes up.
export function advancePomodoro(state: PomodoroState, now: number): PomodoroState {
  if ('deadline' in state && now >= state.deadline) {
    return { phase: state.phase === 'focus' ? 'finishing' : 'ready', config: state.config }
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
    // Older tabs have only phase/deadline and retain their original 15/3 cycle.
    const config = 'config' in value ? value.config : DEFAULT_POMODORO
    if (!isConfig(config)) return { phase: 'idle' }
    const cleanConfig = { focusMinutes: config.focusMinutes, breakMinutes: config.breakMinutes }
    if (value.phase === 'finishing' || value.phase === 'ready') return { phase: value.phase, config: cleanConfig }
    if ((value.phase === 'focus' || value.phase === 'break') && 'deadline' in value &&
      typeof value.deadline === 'number' && Number.isFinite(value.deadline) &&
      value.deadline <= now + (value.phase === 'focus' ? config.focusMinutes : config.breakMinutes) * 60000) {
      return advancePomodoro({ phase: value.phase, deadline: value.deadline, config: cleanConfig }, now)
    }
  } catch { /* Invalid or unavailable tab storage starts a fresh timer. */ }
  return { phase: 'idle' }
}
