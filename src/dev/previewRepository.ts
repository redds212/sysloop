import type { LearningData, LearningRepository } from '../lib/learningRepository'
import type { UserSettings } from '../types'
import { previewData } from './fixtures'
export function previewRepository(storage?:Storage):LearningRepository&{inspect:()=>LearningData;getSettings:()=>UserSettings|null} {
  const key='sysloop:preview:data'
  let data:LearningData=JSON.parse(storage?.getItem(key)??'null')??previewData()
  const persist=()=>storage?.setItem(key,JSON.stringify(data))
  return {
    async load(){return structuredClone(data)},
    async saveSession(session){data={...data,session:structuredClone(session)};persist()},
    async putProgress(cardId,entry){data={...data,store:{...data.store,[cardId]:structuredClone(entry)}};persist()},
    async recordAttempt(attempt){if(!data.attempts.some(a=>a.cardId===attempt.cardId&&a.ts===attempt.ts)){data={...data,attempts:[...data.attempts,structuredClone(attempt)]};persist()}},
    async saveSettings(settings){storage?.setItem('sysloop:preview:settings',JSON.stringify(settings))},
    async report(){},
    inspect:()=>structuredClone(data),
    getSettings:()=>JSON.parse(storage?.getItem('sysloop:preview:settings')??'null'),
  }
}
