import type { Suit } from '../types'
import { suitColor } from '../lib/suitColors'

const symbols: Record<Suit, string> = { C:'♣', D:'♦', H:'♥', S:'♠' }

/** Vector shapes keep suit colours independent of the device's emoji fonts. */
export function SuitSymbol({suit}: {suit: Suit}) {
  return <span className="suit-symbol" style={{color:`var(--suit-${suit}, ${suitColor(suit)})`}}>
    <span className="sr-only">{symbols[suit]}</span>
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {suit==='C'?<><circle cx="12" cy="6.5" r="4.5"/><circle cx="6.5" cy="13" r="4.5"/><circle cx="17.5" cy="13" r="4.5"/><path d="M10 11h4c-1 5 0 9 3 11H7c3-2 4-6 3-11Z"/></>
        :suit==='S'?<path d="M12 2C9 6 2 10 2 15c0 5 7 7 9 1 0 3-2 5-4 6h10c-2-1-4-3-4-6 2 6 9 4 9-1 0-5-7-9-10-13Z"/>
        :suit==='H'?<path d="M12 22 3 13C-3 7 5-1 12 6c7-7 15 1 9 7Z"/>
        :<path d="m12 1 10 11-10 11L2 12Z"/>}
    </svg>
  </span>
}
