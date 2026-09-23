import type { Card, CardLine } from '../types'

export type ReportKind = 'error' | 'discussion'
export type ReportLine = Pick<CardLine,'key'|'label'>

export function selectedReportLines(card:Card,kind:ReportKind,keys:string[]):ReportLine[] {
  if(kind!=='discussion'&&keys.length)throw new Error('Wybór odzywek dotyczy dyskusji.')
  if(keys.some(key=>!card.lines.some(line=>line.key===key)))throw new Error('Wybranej odzywki nie ma w pozycji.')
  return card.lines.filter(line=>keys.includes(line.key)).map(({key,label})=>({key,label}))
}

export class DiscussionsUnavailableError extends Error {
  constructor() {
    super('Lista dyskusji czeka na aktywację przez administratora. Twój tekst pozostał w formularzu.')
    this.name='DiscussionsUnavailableError'
  }
}
