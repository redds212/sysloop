import { useEffect, useState } from 'react'
import type { LearningRepository } from '../lib/learningRepository'
import { RevisionHistoryUnavailableError, type CardRevision } from '../lib/revisions'

export function useRevisions(repository:LearningRepository,enabled=true,cardId?:string) {
  const [rows,setRows]=useState<CardRevision[]|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0)
  useEffect(()=>{
    if(!enabled)return
    let active=true
    const request=repository.revisions?repository.revisions(cardId):Promise.reject(new RevisionHistoryUnavailableError())
    void request.then(value=>{if(active){setRows(value);setError('')}}).catch(error=>{
      if(active)setError(error instanceof RevisionHistoryUnavailableError?error.message:'Nie udało się wczytać historii zmian. Spróbuj ponownie.')
    })
    return()=>{active=false}
  },[repository,enabled,cardId,reload])
  return {rows,error,retry:()=>{setError('');setRows(null);setReload(n=>n+1)}}
}
