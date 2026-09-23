import { useCallback, useState, type ReactNode } from 'react'
import type { AppUser } from './types'
import type { Journal, LearningRepository } from './lib/learningRepository'
import { normalizeEntry } from './lib/srs'
import { useLearning } from './hooks/useLearning'
import { Sidebar } from './components/sidebar/Sidebar'
import { CardView } from './components/card/CardView'
import { FreePractice } from './components/FreePractice'
import { ReadView } from './components/ReadView'
import { NotesView } from './components/NotesView'
import { LearningSettings } from './components/LearningSettings'
import { DifficultCards } from './components/DifficultCards'
import { CardTools } from './components/CardTools'
import { HardPractice } from './components/HardPractice'
import { previousMissedKeys } from './lib/difficult'
import { correctionCard } from './lib/sessionState'
import { Modal } from './components/Modal'

type View={kind:'hardPractice';ids:string[];visit:number}|{kind:'home'|'session'|'settings'|'hard'}|{kind:'practice'|'read'|'notes';id:string;visit:number}
export default function LearningApp({user,repository,journal,onLogout,onAdmin,account,preview=false}: {user:AppUser;repository:LearningRepository;journal:Journal;onLogout:()=>void;onAdmin?:()=>void;account?:ReactNode;preview?:boolean}) {
  const learning=useLearning(user,repository,journal)
  const [view,setView]=useState<View>({kind:'home'}),[drawer,setDrawer]=useState(false),[front,setFront]=useState(false)
  const revealed=useCallback(()=>setFront(false),[])
  const navigate=(next:View)=>{if(learning.busy||learning.error)return;setView(next);setDrawer(false);setFront(next.kind==='practice'||next.kind==='session'||next.kind==='hardPractice')}
  const open=(kind:'practice'|'read'|'notes',id:string)=>{if(view.kind===kind&&'id'in view&&view.id===id){setDrawer(false);return}navigate({kind,id,visit:Date.now()})}
  const {data,session,queue,currentId,busy,settings}=learning
  if(!data||learning.loading)return <div className="loading-page"><div className="wordmark">Sys<span>Loop</span></div><p role={learning.error?'alert':'status'}>{learning.error||'Wczytywanie Twojego systemu…'}</p>{learning.error&&<button className="primary" onClick={()=>void learning.load()}>Spróbuj ponownie</button>}<button className="text-button" onClick={onLogout}>Wyloguj</button></div>
  const cardId=view.kind==='session'?currentId:'id'in view&&view.kind!=='notes'?view.id:null
  const card=data.cards.find(c=>c.id===cardId)
  const corrected=card&&session?correctionCard(card,session):null
  const practiceAvailable=data.practiceFeaturesAvailable!==false
  const stars=data.starredCardIds??[]
  const previousMissed=card?previousMissedKeys(card,data.attempts):[]
  const category=data.categories.find(c=>c.slug===card?.categorySlug)
  const remaining=session?(session.inBuffer?session.buffer.slice(session.bufferIndex):session.session.slots.slice(session.index).map(s=>s.cardId)):queue?.slots.map(s=>s.cardId)??[]
  const completed=!!session&&!currentId
  const resumeLabel=session?.inBuffer?`Wznów poprawki (${session.bufferIndex} / ${session.buffer.length})`:`Wznów sesję (${session?.index??0} / ${session?.session.slots.length??0})`
  async function start() {if(busy||learning.error)return;try{await learning.begin();setView({kind:'session'});setDrawer(false);setFront(true)}catch{/* The hook displays the write error. */}}
  const sidebar=<Sidebar onHard={practiceAvailable?()=>navigate({kind:'hard'}):undefined} user={user} cards={data.cards} categories={data.categories} store={data.store} recommended={remaining} locked={front} onPractice={id=>open('practice',id)} onRead={id=>open('read',id)} onNotes={id=>open('notes',id)} onHome={()=>navigate({kind:'home'})} onSettings={()=>navigate({kind:'settings'})} onLogout={onLogout} onAdmin={onAdmin?()=>{if(!learning.busy&&!learning.error)onAdmin()}:undefined}/>
  return <div className="app-shell"><aside className="desktop-sidebar">{sidebar}</aside><div className="app-body">
    <header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setDrawer(true)} aria-label="Otwórz menu">☰</button><span className="topbar-label">{view.kind==='session'?'Codzienna praktyka':view.kind==='practice'?'Ćwiczenie swobodne':view.kind==='read'?'Biblioteka':'Twój system'}</span><span className="today-label">{new Date().toLocaleDateString('pl-PL',{day:'numeric',month:'long'})}</span></header>
    {preview&&<div className="preview-banner">Podgląd · wymyślone karty · zapis tylko w tej przeglądarce</div>}
    <main className="main-content">
      {!practiceAvailable&&<p className="muted" role="status">Nowe tryby ćwiczeń czekają na aktualizację bazy danych przez administratora. Dotychczasowa nauka działa.</p>}
      {card&&<CardTools card={card} category={category} repository={repository} starred={stars.includes(card.id)} busy={busy} onStar={practiceAvailable?()=>learning.setStar(card.id,!stars.includes(card.id)):undefined}/>}
      {view.kind==='hard'&&practiceAvailable&&<DifficultCards cards={data.cards} categories={data.categories} attempts={data.attempts} stars={stars} busy={busy} onStar={learning.setStar} onRead={id=>open('read',id)} onStart={ids=>navigate({kind:'hardPractice',ids,visit:Date.now()})}/>}
      {view.kind==='hardPractice'&&practiceAvailable&&<HardPractice key={view.visit} cards={view.ids.flatMap(id=>data.cards.filter(c=>c.id===id))} categories={data.categories} attempts={data.attempts} stars={stars} onStar={learning.setStar} busy={busy} repository={repository} save={learning.saveHard} onFront={()=>setFront(true)} onRevealed={revealed} onFinish={()=>navigate({kind:'hard'})}/>}

      {learning.error&&<p role="alert" className="error-note">{learning.error}<button className="text-button" disabled={busy} onClick={()=>{void learning.load().then(ok=>{if(ok){setView({kind:'home'});setFront(false)}})}}>Ponów zapis i wczytaj</button></p>}
      {view.kind!=='session'&&session&&currentId&&<button className="resume-strip" disabled={busy} onClick={()=>void start()}>{resumeLabel}<span>→</span></button>}
      {(view.kind==='home'||view.kind==='settings')&&<>
        <p className="eyebrow">Mały rytuał, pewniejsza licytacja</p><h1 className="welcome-title">{completed?'Na dziś wystarczy.':`Cześć, ${user.username}.`}</h1><p className="welcome-subtitle">{completed?'Dzisiejsza sesja jest zakończona. Do zobaczenia przy kolejnej powtórce.':'Kilka pozycji dziennie. Coraz mniej znaków zapytania przy stole.'}</p>
        <section className="daily-panel panel"><div><span className="eyebrow">Dzisiejsza sesja</span><h2>{completed?'Dobra robota.':session&&currentId?'Wróć tam, gdzie skończyłeś.':'Zrób miejsce na pewność.'}</h2><p className="muted">{!data.cards.length?'Karty pojawią się tutaj po weryfikacji i zatwierdzeniu importu.':completed?`${session.session.slots.length} pozycji · ${session.buffer.length} powtórek w poprawkach.`:'Najpierw poprawki i powtórki. Potem nowe pozycje.'}</p></div>
          <div className="daily-count"><strong>{completed?'✓':session?.session.slots.length??queue?.slots.length??0}</strong><span>{completed?'sesja ukończona':'pozycji na dziś'}</span></div>
          {!completed&&<><div className="queue-split"><span><i className="status-dot learning"/>{queue?.retryCount??0} poprawek</span><span><i className="status-dot review"/>{queue?.reviewCount??0} powtórek</span><span><i className="status-dot new"/>{queue?.newCount??0} nowych</span></div><button className="primary" disabled={busy||!remaining.length} onClick={()=>void start()}>{session&&currentId?resumeLabel:`Rozpocznij sesję (${queue?.slots.length??0})`} →</button></>}
        </section>
        <div className="guide-panels"><section className="panel"><span className="step-number">01</span><h2>Przypomnij sobie</h2><p className="muted">Zobacz licytację i odzywki. Ich znaczenia odtwórz w pamięci.</p></section><section className="panel"><span className="step-number">02</span><h2>Sprawdź i zaznacz</h2><p className="muted">Odsłoń odpowiedzi. Zaznacz wszystko, co wymaga powtórki.</p></section></div>
        {view.kind==='settings'&&<><LearningSettings practiceAvailable={practiceAvailable} key={`${settings.dailyTarget}:${settings.mode}:${settings.timedMode}:${settings.correctionMode}`} settings={settings} save={learning.updateSettings}/>{account}</>}
      </>}
      {view.kind==='session'&&card&&session&&<><div className="session-bar"><span>{session.inBuffer?'Poprawki':'Sesja dzienna'}</span><strong>{session.inBuffer?session.bufferIndex:session.index} / {session.inBuffer?session.buffer.length:session.session.slots.length}</strong><button className="text-button" disabled={busy} onClick={()=>navigate({kind:'home'})}>Wstrzymaj</button><progress value={session.inBuffer?session.bufferIndex:session.index} max={session.inBuffer?session.buffer.length:session.session.slots.length}/></div><CardView key={`${learning.day}:${session.index}:${session.bufferIndex}:${card.id}`} card={corrected?.card??card} scope={corrected?.scope} previousMissed={previousMissed} category={category} baseline={normalizeEntry(data.store[card.id])} timed={!!settings.timedMode} phase={session.inBuffer?'buffer':'main'} repository={repository} onRevealed={revealed} onRate={async a=>{await learning.answer(a);setFront(true)}}/></>}
      {view.kind==='session'&&!card&&<section className="panel result-panel"><span className="result-symbol">✓</span><h1>{completed?'Sesja zakończona.':'Nowy dzień, nowa sesja.'}</h1><p className="muted">{completed?`Zakończono ${session?.session.slots.length??0} pozycji oraz ${session?.buffer.length??0} poprawek.`:'Wczorajsza kolejka wygasła. Odpowiedzi zostały zapisane.'}</p><button className="primary" onClick={()=>navigate({kind:'home'})}>Wróć do panelu</button></section>}
      {view.kind==='practice'&&card&&<FreePractice previousMissed={previousMissed} key={`${view.id}:${view.visit}`} card={card} category={category} entry={normalizeEntry(data.store[card.id])} timed={!!settings.timedMode} repository={repository} save={learning.saveVisit} restore={learning.restoreVisit} onRevealed={revealed} onRepeat={()=>setFront(true)} onRead={()=>open('read',card.id)} onHome={()=>navigate({kind:'home'})}/>}
      {view.kind==='read'&&card&&<ReadView card={card} cards={data.cards} category={category} onRead={id=>open('read',id)} onPractice={id=>open('practice',id)} repository={repository}/>}
      {view.kind==='notes'&&data.categories.filter(c=>c.slug===view.id).map(c=><NotesView key={c.slug} category={c}/>)}
    </main>
  </div>{drawer&&<Modal title="Twój system" onClose={()=>setDrawer(false)}>{sidebar}</Modal>}</div>
}
