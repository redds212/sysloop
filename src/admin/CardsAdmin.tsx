import { useState } from 'react'
import type { CardRow, CategoryRow } from '../lib/database.types'
import { AuctionView } from '../components/AuctionView'
import { compactAuction } from '../lib/auction/display'
import { statusLabel } from './labels'

export function CardsAdmin({cards,categories,onEdit}: {cards:CardRow[];categories:CategoryRow[];onEdit:(id:string)=>void}) {
  const [category,setCategory]=useState(''), [status,setStatus]=useState(''), [flag,setFlag]=useState(''), [query,setQuery]=useState('')
  const needle=query.trim().toLocaleLowerCase('pl')
  const visible=cards.filter(c=>(!category||c.category_slug===category)&&(!status||c.status===status)&&(!flag||c.review_flags.includes(flag))&&(!needle||[c.auction_key,compactAuction(c.auction),c.context,...c.lines.map(l=>`${l.label} ${l.meaning}`)].join(' ').toLocaleLowerCase('pl').includes(needle))).sort((a,b)=>a.category_slug.localeCompare(b.category_slug)||a.sort_order-b.sort_order)
  return <section><h2>Karty</h2><div className="admin-filters">
    <label>Kategoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Wszystkie kategorie</option>{categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
    <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Wszystkie statusy</option>{Object.entries(statusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Flaga<select value={flag} onChange={e=>setFlag(e.target.value)}><option value="">Wszystkie flagi</option>{[...new Set(cards.flatMap(c=>c.review_flags))].sort().map(f=><option key={f}>{f}</option>)}</select></label>
    <label>Szukaj w licytacji i znaczeniach<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  </div><p className="muted">{visible.length} pozycji</p>
    {!visible.length&&<p className="admin-empty">Brak kart spełniających kryteria.</p>}
    {visible.map(c=><button key={c.id} className="admin-list-card" onClick={()=>onEdit(c.id)}><span className="admin-row-head"><span>{categories.find(cat=>cat.slug===c.category_slug)?.name??c.category_slug}</span><span className={`badge ${c.status}`}>{statusLabel[c.status]}</span></span><AuctionView auction={c.auction} compact/>{c.context&&<span className="muted">{c.context}</span>}<span className="muted">Strona {c.source_page} · {c.lines.length} odzywek{c.review_flags.length?` · ${c.review_flags.length} flag`:''}</span></button>)}
  </section>
}
