import { useState } from 'react'
import type { Card, Category } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { AuctionView } from './AuctionView'

export function ReportCardButton({ card, category, repository }: { card: Card; category?: Category; repository: LearningRepository }) {
  const [open,setOpen]=useState(false), [message,setMessage]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState(''), [done,setDone]=useState(false)
  return <><button type="button" className="report-button" aria-haspopup="dialog" onClick={()=>{setOpen(true);setDone(false);setError('')}}><Icon name="flag" size={22}/><span>Zgłoś błąd</span></button>
    {done&&<span role="status" className="success-note">Zgłoszenie wysłane. Dziękujemy.</span>}
    {open&&<Modal title="Zgłoś błąd w pozycji" onClose={()=>{if(!busy)setOpen(false)}}>
      <div className="report-position"><p className="eyebrow">{category?.name??'Zgłaszana pozycja'}</p><AuctionView auction={card.auction} compact/>{card.context&&<p className="muted">{card.context}</p>}</div>
      <p className="muted report-hint">Opisz błąd lub niejasność. Administrator otrzyma zgłoszenie z linkiem do tej pozycji.</p>
      <form onSubmit={async e=>{e.preventDefault();if(busy||!message.trim())return;setBusy(true);setError('');try {await repository.report(card,category,message.trim());setOpen(false);setMessage('');setDone(true)} catch {setError('Nie udało się wysłać zgłoszenia. Spróbuj ponownie.')} finally {setBusy(false)}}}>
      <label htmlFor="report-message">Co wymaga poprawki?</label><textarea id="report-message" autoFocus maxLength={1000} rows={6} value={message} onChange={e=>setMessage(e.target.value)} required />
      <p className="muted counter">{message.length} / 1000</p>{error&&<p role="alert" className="error-note">{error}</p>}
      <button className="primary" disabled={busy||!message.trim()}>{busy?'Wysyłanie…':'Wyślij zgłoszenie'}</button>
    </form></Modal>}
  </>
}
