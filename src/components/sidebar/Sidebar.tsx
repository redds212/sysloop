import type { AppUser, Card, Category, SRSStore } from '../../types'
import { normalizeEntry } from '../../lib/srs'
import { AuctionView } from '../AuctionView'

interface Props { user:AppUser; cards:Card[]; categories:Category[]; store:SRSStore; recommended:string[]; locked:boolean; onPractice:(id:string)=>void; onRead:(id:string)=>void; onNotes:(slug:string)=>void; onHome:()=>void; onSettings:()=>void; onLogout:()=>void; onAdmin?:()=>void }
export function Sidebar({user,cards,categories,store,recommended,locked,onPractice,onRead,onNotes,onHome,onSettings,onLogout,onAdmin}:Props) {
  const counts={NEW:0,LEARNING:0,REVIEW:0,MASTERED:0}
  for(const card of cards)counts[normalizeEntry(store[card.id]).status]++
  return <div className="sidebar-inner"><button className="wordmark" onClick={onHome}>Sys<span>Loop</span></button><p className="sidebar-caption">TWÓJ SYSTEM, W PAMIĘCI</p>
    <div className="profile-row"><span className="avatar">{user.username.slice(0,1).toUpperCase()}</span><span>{user.username}<small>{user.isAdmin?'Administrator':'Partnerstwo'}</small></span><button className="icon-button" onClick={onLogout} aria-label="Wyloguj">↪</button></div>
    <button className="nav-button" onClick={onSettings}>Mój panel <span>↗</span></button>
    {user.isAdmin&&onAdmin&&!locked&&<button className="nav-button" onClick={onAdmin}>Admin <span>↗</span></button>}
    <section className="recommendations"><h2 className="eyebrow">Rekomendowane na dziś</h2>{recommended.slice(0,3).map((id,i)=>{const card=cards.find(c=>c.id===id);return card&&<button className="recommendation" key={id} onClick={()=>onPractice(id)}><span className="counter">0{i+1}</span><AuctionView auction={card.auction} compact/></button>})}
      {!recommended.length&&<p className="muted">Na dziś wszystko gotowe.</p>}{recommended.length>3&&<button className="text-button" onClick={onHome}>+{recommended.length-3} więcej</button>}
    </section>
    <h2 className="eyebrow tree-title">Biblioteka systemu</h2>
    {!categories.length&&<p className="muted">Kategorie pojawią się po zatwierdzeniu importu.</p>}
    {[...new Set(categories.map(c=>c.group))].map(group=><section key={group} className="tree-group"><h3>{group}</h3>{categories.filter(c=>c.group===group).map(category=>{
      const categoryCards=cards.filter(c=>c.categorySlug===category.slug).sort((a,b)=>a.sortOrder-b.sortOrder)
      const seen=categoryCards.filter(c=>!!store[c.id]?.lastSeen).length
      return <details key={category.slug} className="category-branch"><summary><span>{category.name}</span><small>{seen} / {categoryCards.length}</small></summary>
        {!locked&&<button className="tree-notes" onClick={()=>onNotes(category.slug)}>Notatki ↗</button>}
        {[...new Set(categoryCards.map(c=>c.section))].map(section=><details key={section} className="section-branch"><summary className="section-title">{section||'Pozycje'}</summary>{categoryCards.filter(c=>c.section===section).map(card=><div key={card.id} className="tree-position"><button onClick={()=>onPractice(card.id)}><span className={`status-dot ${normalizeEntry(store[card.id]).status.toLowerCase()}`}/><AuctionView auction={card.auction} compact/>{card.context&&<small>{card.context}</small>}</button>{!locked&&<button className="read-icon" onClick={()=>onRead(card.id)} aria-label="Czytaj pozycję">↗</button>}</div>)}</details>)}
      </details>
    })}</section>)}
    <footer className="sidebar-stats"><span><b>{counts.NEW}</b>Nowe</span><span><b>{counts.LEARNING+counts.REVIEW}</b>Nauka</span><span><b>{counts.MASTERED}</b>Opanowane</span></footer>
  </div>
}
