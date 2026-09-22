import { Icon } from './Icon'

export function DifficultStarButton({starred,busy,onToggle}: {starred:boolean;busy:boolean;onToggle:()=>Promise<void>}) {
  return <button type="button" className="star-toggle" disabled={busy} aria-pressed={starred}
    title={starred?'Usuń z moich trudnych':'Dodaj do moich trudnych'} onClick={()=>void onToggle().catch(()=>{})}>
    <Icon name="star" size={28} className="star-icon" style={{fill:starred?'currentColor':'none'}}/>
    <span>{starred?'W moich trudnych':'Dodaj do moich trudnych'}</span>
  </button>
}
