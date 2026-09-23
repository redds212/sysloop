import { useState } from 'react'
import type { Card, Category } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { AuctionView, CallText } from './AuctionView'
import { DiscussionsUnavailableError, type ReportKind } from '../lib/reporting'

export function ReportCardButton({ card, category, repository, kind='error' }: { card: Card; category?: Category; repository: LearningRepository; kind?:ReportKind }) {
  const [open,setOpen]=useState(false), [message,setMessage]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [done,setDone]=useState(false)
  const [selectedOnly,setSelectedOnly]=useState(false),[lineKeys,setLineKeys]=useState<string[]>([])
  const discussion=kind==='discussion',inputId=`report-message-${kind}`
  const missingSelection=discussion&&selectedOnly&&!lineKeys.length
  return <><button type="button" className={`report-button${discussion?' discussion-button':''}`} aria-haspopup="dialog" onClick={()=>{setOpen(true);setDone(false);setError('')}}><Icon name={discussion?'discussion':'flag'} size={22}/><span>{discussion?'Do dyskusji':'Zgłoś błąd'}</span></button>
    {done&&<span role="status" className="success-note">{discussion?'Temat dodany do dyskusji.':'Zgłoszenie wysłane. Dziękujemy.'}</span>}
    {open&&<Modal title={discussion?'Dodaj temat do dyskusji':'Zgłoś błąd w pozycji'} onClose={()=>{if(!busy)setOpen(false)}}>
      <div className="report-position"><p className="eyebrow">{category?.name??'Zgłaszana pozycja'}</p><AuctionView auction={card.auction} compact/>{card.context&&<p className="muted">{card.context}</p>}</div>
      <p className="muted report-hint">{discussion?'Opisz propozycję zmiany ustalenia lub pytanie do wspólnego omówienia. Temat trafi na osobną listę „Do dyskusji” w panelu administratora.':'Opisz błąd w zapisie pozycji. Administrator otrzyma zgłoszenie z linkiem do tej pozycji.'}</p>
      <form onSubmit={async e=>{e.preventDefault();if(busy||!message.trim()||missingSelection)return;setBusy(true);setError('');try {await repository.report(card,category,message.trim(),kind,discussion&&selectedOnly?lineKeys:[]);setOpen(false);setMessage('');setLineKeys([]);setSelectedOnly(false);setDone(true)} catch(error) {setError(error instanceof DiscussionsUnavailableError?error.message:discussion?'Nie udało się dodać tematu. Spróbuj ponownie.':'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.')} finally {setBusy(false)}}}>
      {discussion&&<fieldset className="discussion-scope" disabled={busy}><legend>Czego dotyczy temat?</legend>
        <div className="discussion-scope-options"><label><input type="radio" name="discussion-scope" checked={!selectedOnly} onChange={()=>setSelectedOnly(false)}/>Cała pozycja</label><label><input type="radio" name="discussion-scope" checked={selectedOnly} onChange={()=>setSelectedOnly(true)}/>Wybrane odzywki</label></div>
        {selectedOnly&&<><div className="discussion-lines">{card.lines.map(line=><label key={line.key}><input type="checkbox" aria-label={`Do dyskusji: ${line.label}`} checked={lineKeys.includes(line.key)} onChange={e=>setLineKeys(keys=>e.target.checked?[...keys,line.key]:keys.filter(key=>key!==line.key))}/><CallText text={line.label}/></label>)}</div><p className="muted">{lineKeys.length?`Wybrano: ${lineKeys.length}`:'Wybierz co najmniej jedną odzywkę.'}</p></>}
      </fieldset>}
      <label htmlFor={inputId}>{discussion?'Co chcesz omówić lub zmienić?':'Co wymaga poprawki?'}</label><textarea id={inputId} autoFocus maxLength={1000} rows={6} disabled={busy} value={message} onChange={e=>setMessage(e.target.value)} required />
      <p className="muted counter">{message.length} / 1000</p>{error&&<p role="alert" className="error-note">{error}</p>}
      <button className="primary" disabled={busy||!message.trim()||missingSelection}>{busy?'Wysyłanie…':discussion?'Dodaj do dyskusji':'Wyślij zgłoszenie'}</button>
    </form></Modal>}
  </>
}
