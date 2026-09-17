export const statusLabel = {draft:'Szkic',active:'Aktywna',archived:'Archiwum'}
export const changeLabel = {added:'Dodane',changed:'Zmienione',removed:'Usunięte',unchanged:'Bez zmian'}
export function when(iso:string) { return new Date(iso).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }
