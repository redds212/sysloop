import { useMemo, useState } from 'react'
import LearningApp from '../LearningApp'
import { previewUser } from './fixtures'
import { previewRepository } from './previewRepository'
import { browserJournal } from '../lib/learningRepository'
import { AdminPanel } from '../admin/AdminPanel'
import { adminPreviewRepository } from './adminRepository'
import { adminPreviewUser } from './adminFixtures'
export default function Preview() {
  const repository=useMemo(()=>previewRepository(sessionStorage),[])
  const journal=useMemo(()=>browserJournal(previewUser,sessionStorage),[])
  const user={...previewUser,...repository.getSettings()}
  const adminRepository=useMemo(()=>adminPreviewRepository(sessionStorage),[])
  const [admin,setAdmin]=useState(new URLSearchParams(location.search).get('preview')==='admin')
  if(admin)return <AdminPanel user={adminPreviewUser} repository={adminRepository} onBack={()=>setAdmin(false)} preview/>
  return <LearningApp user={{...user,isAdmin:true}} repository={repository} journal={journal} onAdmin={()=>setAdmin(true)} onLogout={()=>{sessionStorage.removeItem('sysloop:preview:data');sessionStorage.removeItem('sysloop:preview:settings');journal.clear();location.reload()}} preview/>
}
