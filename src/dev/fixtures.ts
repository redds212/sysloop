import type { AppUser, Card, Category } from '../types'
import type { LearningData } from '../lib/learningRepository'
import { call, normalizeAuction, auctionKey } from '../lib/auction/normalize'
import { addDaysKey } from '../lib/date'

// Entirely invented examples for interface work. Never derived from the PDFs.
export const previewUser: AppUser = { id:'preview-user', username:'Ola', email:'ola@example.test', isAdmin:false, status:'approved', dailyTarget:5, mode:'balanced', timedMode:false }
const categories: Category[] = [
  {slug:'demo-open',name:'Otwarcia — przykład',group:'Otwarcia',sortOrder:0,sourceFile:'invented',revision:'demo',notes:[{title:'USTALENIA DO PODGLĄDU',body:'To wymyślona notatka do sprawdzenia interfejsu.\nNie opisuje systemu partnerstwa.'}]},
  {slug:'demo-defense',name:'Obrona — przykład',group:'Obrona',sortOrder:1,sourceFile:'invented',revision:'demo',notes:[]},
]
function makeCard(id:string,auction:Card['auction'],labels:string[],extra:Partial<Card>={}):Card {
  const normalized=normalizeAuction(auction)
  return {id,categorySlug:'demo-open',section:'PRZYKŁADOWE KONTYNUACJE',sortOrder:Number(id.replace(/\D/g,''))||0,auction:normalized,auctionKey:auctionKey(normalized),notes:[],lines:labels.map((label,i)=>({key:label,label:label.replace('C','♣').replace('D','♦').replace('H','♥').replace('S','♠'),bids:[label],meaning:[ 'Przykład testowy: spokojna propozycja dalszej rozmowy.', 'Przykład testowy: wariant A — pierwszy opis.\nWariant B — drugi opis tej samej odzywki.', 'Przykład testowy: prośba o dodatkową informację.' ][i%3]})),status:'active',reviewFlags:[],sourcePage:1,sourceRevision:'demo',...extra}
}
export function previewData():LearningData {
  const root=makeCard('demo-1',[call('1NT')],['2C','2D','2H','2S','2NT','3C'],{notes:['Uwaga przykładowa: warianty w obrębie jednej odzywki oceniamy razem.']})
  const child=makeCard('demo-2',[...root.auction,call('2C')],['2D','2H','2S'])
  const defense=makeCard('demo-3',[call('1S','they'),call('X'),call('2S','they','przykład')],['3C','3D','3H','3NT'],{categorySlug:'demo-defense',context:'Przykładowy warunek'})
  const long=makeCard('demo-4',[call('2NT')],Array.from({length:28},(_,i)=>`${Math.floor(i/5)+2}${['C','D','H','S','NT'][i%5]}`),{section:'DŁUGA POZYCJA — PODGLĄD'})
  const short=makeCard('demo-5',[call('3C')],['3D','3H'])
  root.lines=root.lines.map((line,i)=>i<2?{...line,changedIn:'demo-2',changedAt:'2026-09-23T07:00:00Z',changeId:'demo-root-change-2'}:line)
  return {cards:[root,child,defense,long,short],categories,attempts:[],session:null,store:{[defense.id]:{status:'LEARNING',consecutiveCorrect:0,interval:1,lastSeen:new Date(Date.now()-86400000).toISOString(),nextReviewDate:addDaysKey(-1)},[short.id]:{status:'REVIEW',consecutiveCorrect:1,interval:3,lastSeen:new Date(Date.now()-4*86400000).toISOString(),nextReviewDate:addDaysKey(-1)}}}
}
