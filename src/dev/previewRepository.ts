import type { LearningData, LearningRepository } from '../lib/learningRepository'
import type { UserSettings } from '../types'
import { previewData, previewUser } from './fixtures'
import { compactAuction } from '../lib/auction/display'
import { readPreviewReports, writePreviewReports } from './previewReports'
import { selectedReportLines } from '../lib/reporting'
export function previewRepository(storage?:Storage):LearningRepository&{inspect:()=>LearningData;getSettings:()=>UserSettings|null} {
  const key='sysloop:preview:data'
  let data:LearningData=JSON.parse(storage?.getItem(key)??'null')??previewData()
  const persist=()=>storage?.setItem(key,JSON.stringify(data))
  return {
    async load(){return structuredClone({...data,practiceFeaturesAvailable:true})},
    async saveSession(session){data={...data,session:structuredClone(session)};persist()},
    async putProgress(cardId,entry){data={...data,store:{...data.store,[cardId]:structuredClone(entry)}};persist()},
    async recordAttempt(attempt){if(!data.attempts.some(a=>a.cardId===attempt.cardId&&a.ts===attempt.ts)){data={...data,attempts:[...data.attempts,structuredClone(attempt)]};persist()}},
    async setStar(cardId,starred){data={...data,starredCardIds:[...(data.starredCardIds??[]).filter(id=>id!==cardId),...(starred?[cardId]:[])]};persist()},
    async saveSettings(settings){data={...data,correctionMode:settings.correctionMode??'whole'};persist();storage?.setItem('sysloop:preview:settings',JSON.stringify(settings))},
    async sourcePreview(){
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840"><rect width="600" height="840" fill="white"/><g fill="#162034" font-family="sans-serif"><text x="40" y="65" font-size="20">WYMYŚLONY DOKUMENT DO PODGLĄDU</text><text x="40" y="230" font-size="24">5♣ – (pas) – ?</text><text x="40" y="280" font-size="18">5♦ – Pierwszy opis testowy.</text><text x="40" y="325" font-size="18">5♥ – Drugi opis testowy.</text><text x="40" y="370" font-size="16">Uwaga: przykład, nie system partnerstwa.</text><text x="40" y="670" font-size="18">Kolejna pozycja na tej samej stronie.</text></g></svg>'
      return {sourceFile:'Przykład — wymyślony dokument',revision:'demo',fragments:[{page:1,url:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,top:195,bottom:395}]}
    },
    async report(card,category,message,kind='error',lineKeys=[]){
      const reports=readPreviewReports(storage)
      writePreviewReports(storage,[{id:Math.max(Date.now(),...reports.map(r=>r.id+1)),user_id:previewUser.id,card_id:card.id,
        card_label:`${category?.name??''} · ${compactAuction(card.auction)}`,reporter_label:previewUser.username,
        message,kind,selected_lines:selectedReportLines(card,kind,lineKeys),status:'new',created_at:new Date().toISOString()},...reports])
    },
    inspect:()=>structuredClone(data),
    getSettings:()=>JSON.parse(storage?.getItem('sysloop:preview:settings')??'null'),
  }
}
