import { formatCountdown, type PomodoroState } from '../lib/pomodoro'
import { Icon } from './Icon'

export function PomodoroStart({ onStart, disabled = false }: { onStart: () => void; disabled?: boolean }) {
  return <button className="pomodoro-start" disabled={disabled} onClick={onStart}
    aria-label="Rozpocznij pomodoro: 15 minut nauki, 3 minuty przerwy"
    title="Pomodoro · 15 min nauki / 3 min przerwy">
    <span aria-hidden="true">🍅</span><span>15 min</span>
  </button>
}

export function PomodoroStatus({ state, remaining, onStop }: {
  state: PomodoroState; remaining: number; onStop: () => void;
}) {
  if (state.phase === 'idle') return null
  const label = state.phase === 'focus' ? 'Nauka' : state.phase === 'finishing' ? 'Dokończ kartę' : state.phase === 'break' ? 'Przerwa' : 'Przerwa zakończona'
  return <div className={`pomodoro-status ${state.phase}`}>
    <span aria-hidden="true">🍅</span>
    <div><span className="pomodoro-phase" role="status">{label}</span>
      {(state.phase === 'focus' || state.phase === 'break') && <span className="pomodoro-clock" role="timer" aria-label={`${label} — pozostały czas`}>{formatCountdown(remaining)}</span>}
    </div>
    <button className="pomodoro-stop" aria-label="Wyłącz pomodoro" title="Wyłącz pomodoro" onClick={onStop}><Icon name="close" size={16}/></button>
  </div>
}

export function PomodoroBreak({ remaining, ready, busy, hasNext, onContinue, onStop }: {
  remaining: number; ready: boolean; busy: boolean; hasNext: boolean; onContinue: () => void; onStop: () => void;
}) {
  return <section className="panel pomodoro-break" aria-labelledby="pomodoro-break-heading">
    <span className="pomodoro-illustration" aria-hidden="true">🍅</span>
    <p className="eyebrow">Pomodoro · 15 / 3</p>
    <h1 id="pomodoro-break-heading" role="status">{ready ? 'Wracamy do nauki?' : 'Teraz chwila dla Ciebie.'}</h1>
    <p className="muted">{!hasNext ? 'Wszystkie dostępne karty na dziś zrobione. Dobra robota — czas odpocząć.' : ready ? 'Przerwa zakończona. Zacznij kolejne 15 minut, kiedy będziesz gotowy.' : 'Odpocznij od ekranu. Rozprostuj nogi, napij się wody.'}</p>
    <div className="pomodoro-break-clock" role="timer" aria-label="Pozostały czas przerwy">{formatCountdown(remaining)}</div>
    {ready && hasNext && <button className="primary" disabled={busy} onClick={onContinue}>Kolejne 15 min →</button>}
    <button className="text-button" disabled={busy} onClick={onStop}>Zakończ pomodoro</button>
  </section>
}
