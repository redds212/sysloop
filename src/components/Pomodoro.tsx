import { formatCountdown, type PomodoroState } from '../lib/pomodoro'
import { Icon } from './Icon'
import { PomodoroSettings, type PomodoroSettingsProps } from './PomodoroSettings'

export function PomodoroStart({ onStart, disabled = false, config, onConfigChange }: PomodoroSettingsProps & { onStart: () => void; disabled?: boolean }) {
  const breakUnit = config.breakMinutes === 1 ? 'minuta' : config.breakMinutes === 3 ? 'minuty' : 'minut'
  return <div className="pomodoro-start">
    <button className="pomodoro-start-action" disabled={disabled} onClick={onStart}
      aria-label={`Rozpocznij pomodoro: ${config.focusMinutes} minut nauki, ${config.breakMinutes} ${breakUnit} przerwy`}
      title={`Pomodoro · ${config.focusMinutes} min nauki / ${config.breakMinutes} min przerwy`}>
      <span aria-hidden="true">🍅</span><span>{config.focusMinutes}/{config.breakMinutes}</span>
    </button>
    <PomodoroSettings config={config} onConfigChange={onConfigChange}/>
  </div>
}

export function PomodoroStatus({ state, remaining, onStop, config, onConfigChange }: PomodoroSettingsProps & {
  state: PomodoroState; remaining: number; onStop: () => void;
}) {
  if (state.phase === 'idle') return null
  const label = state.phase === 'focus' ? 'Nauka' : state.phase === 'finishing' ? 'Dokończ kartę' : state.phase === 'break' ? 'Przerwa' : 'Przerwa zakończona'
  return <div className={`pomodoro-status ${state.phase}`}>
    <PomodoroSettings config={config} onConfigChange={onConfigChange} active/>
    <div><span className="pomodoro-phase" role="status">{label}</span>
      {(state.phase === 'focus' || state.phase === 'break') && <span className="pomodoro-clock" role="timer" aria-label={`${label} — pozostały czas`}>{formatCountdown(remaining)}</span>}
    </div>
    <button className="pomodoro-stop" aria-label="Wyłącz pomodoro" title="Wyłącz pomodoro" onClick={onStop}><Icon name="close" size={16}/></button>
  </div>
}

export function PomodoroBreak({ remaining, ready, busy, hasNext, onContinue, onStop, cycleConfig, nextConfig }: {
  cycleConfig: PomodoroSettingsProps['config']; nextConfig: PomodoroSettingsProps['config'];
  remaining: number; ready: boolean; busy: boolean; hasNext: boolean; onContinue: () => void; onStop: () => void;
}) {
  return <section className="panel pomodoro-break" aria-labelledby="pomodoro-break-heading">
    <span className="pomodoro-illustration" aria-hidden="true">🍅</span>
    <p className="eyebrow">Pomodoro · {cycleConfig.focusMinutes} / {cycleConfig.breakMinutes}</p>
    <h1 id="pomodoro-break-heading" role="status">{ready ? 'Wracamy do nauki?' : 'Teraz chwila dla Ciebie.'}</h1>
    <p className="muted">{!hasNext ? 'Wszystkie dostępne karty na dziś zrobione. Dobra robota — czas odpocząć.' : ready ? `Przerwa zakończona. Zacznij kolejne ${nextConfig.focusMinutes} minut, kiedy będziesz gotowy.` : 'Odpocznij od ekranu. Rozprostuj nogi, napij się wody.'}</p>
    <div className="pomodoro-break-clock" role="timer" aria-label="Pozostały czas przerwy">{formatCountdown(remaining)}</div>
    {ready && hasNext && <button className="primary" disabled={busy} onClick={onContinue}>Kolejne {nextConfig.focusMinutes} min →</button>}
    <button className="text-button" disabled={busy} onClick={onStop}>Zakończ pomodoro</button>
  </section>
}
