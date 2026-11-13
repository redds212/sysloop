import { useCallback, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { BREAK_MINUTES, FOCUS_MINUTES, type PomodoroConfig } from '../lib/pomodoro'
import { Icon } from './Icon'

export interface PomodoroSettingsProps {
  config: PomodoroConfig;
  onConfigChange: (config: PomodoroConfig) => void;
}

export function PomodoroSettings({ config, onConfigChange, active = false }: PomodoroSettingsProps & { active?: boolean }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])
  return <>
    <button ref={trigger} type="button" className={`pomodoro-settings-trigger${active ? ' active' : ''}`}
      aria-label="Ustawienia pomodoro" title="Ustawienia pomodoro" aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      {active ? <span aria-hidden="true">🍅</span> : <Icon name="chevron-down" size={14}/>}
    </button>
    {open && <SettingsPopover id={id} trigger={trigger} config={config} onConfigChange={onConfigChange} active={active} onClose={close}/>}
  </>
}

function SettingsPopover({ id, trigger, config, onConfigChange, active, onClose }: PomodoroSettingsProps & {
  id: string; trigger: RefObject<HTMLButtonElement | null>; active: boolean; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const place = () => {
      if (!trigger.current || !panel.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const box = panel.current.getBoundingClientRect()
      panel.current.style.left = `${Math.max(8, Math.min(anchor.right - box.width, window.innerWidth - box.width - 8))}px`
      const below = anchor.bottom + 8
      panel.current.style.top = `${Math.max(8, below + box.height <= window.innerHeight - 8 ? below : anchor.top - box.height - 8)}px`
    }
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) onClose()
    }
    place()
    panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [trigger, onClose])
  return createPortal(<div ref={panel} id={id} className="pomodoro-settings-panel" role="dialog" aria-label="Ustawienia pomodoro"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); trigger.current?.focus() }
    }}>
    <p className="pomodoro-settings-title">Pomodoro <span>minuty</span></p>
    <fieldset><legend>Nauka</legend><div className="pomodoro-options">{FOCUS_MINUTES.map(minutes => <label key={minutes}>
      <input type="radio" name={`${id}-focus`} value={minutes} checked={config.focusMinutes === minutes}
        onChange={() => onConfigChange({ ...config, focusMinutes: minutes })}/><span>{minutes}</span>
    </label>)}</div></fieldset>
    <fieldset><legend>Przerwa</legend><div className="pomodoro-options">{BREAK_MINUTES.map(minutes => <label key={minutes}>
      <input type="radio" name={`${id}-break`} value={minutes} checked={config.breakMinutes === minutes}
        onChange={() => onConfigChange({ ...config, breakMinutes: minutes })}/><span>{minutes}</span>
    </label>)}</div></fieldset>
    <p className="muted">{active ? 'Zmiany od następnego cyklu.' : 'Zapamiętamy Twój wybór.'}</p>
  </div>, document.body)
}
