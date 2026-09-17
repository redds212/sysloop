import { useMemo } from 'react'
import LearningApp from '../LearningApp'
import { previewUser } from './fixtures'
import { previewRepository } from './previewRepository'
import { browserJournal } from '../lib/learningRepository'
export default function Preview() {
  const repository=useMemo(()=>previewRepository(sessionStorage),[])
  const journal=useMemo(()=>browserJournal(previewUser,sessionStorage),[])
  const user={...previewUser,...repository.getSettings()}
  return <LearningApp user={user} repository={repository} journal={journal} onLogout={()=>{sessionStorage.removeItem('sysloop:preview:data');sessionStorage.removeItem('sysloop:preview:settings');journal.clear();location.reload()}} preview/>
}
