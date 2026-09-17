import { lazy, Suspense, useMemo } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AuthCard } from './auth/AuthCard'
import { LoginPage } from './auth/LoginPage'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { ChangePasswordCard } from './auth/ChangePasswordCard'
import { configured } from './lib/supabase'
import { createRepository } from './lib/supabaseRepository'
import { browserJournal } from './lib/learningRepository'
import LearningApp from './LearningApp'
import type { AppUser } from './types'

const Preview = import.meta.env.DEV ? lazy(()=>import('./dev/Preview')) : null
function ApprovedApp({user,onLogout}:{user:AppUser;onLogout:()=>void}) {
  const {id,username}=user
  const repository=useMemo(()=>createRepository({id,username}),[id,username])
  const journal=useMemo(()=>browserJournal({id},localStorage),[id])
  return <LearningApp user={user} repository={repository} journal={journal} onLogout={onLogout} account={<ChangePasswordCard/>}/>
}
function AuthGate() {
  const {user,loading,offline,recovery,logout,refreshProfile}=useAuth()
  if(loading)return <AuthCard><p className="muted" role="status">Sprawdzanie sesji…</p></AuthCard>
  if(!user)return <LoginPage/>
  if(recovery)return <ResetPasswordPage/>
  if(offline)return <AuthCard><h1>Brak połączenia</h1><p className="muted">Połącz się z internetem, aby wczytać system i postępy.</p><button className="primary" onClick={()=>void refreshProfile()}>Spróbuj ponownie</button><button className="text-button" onClick={()=>void logout()}>Wyloguj</button></AuthCard>
  if(!user.isAdmin&&user.status!=='approved')return <AuthCard><h1>Konto czeka na akceptację</h1><p className="muted">Administrator zatwierdzi Twój dostęp do systemu.</p><button className="primary" onClick={()=>void refreshProfile()}>Sprawdź ponownie</button><button className="text-button" onClick={()=>void logout()}>Wyloguj</button></AuthCard>
  return <ApprovedApp key={user.id} user={user} onLogout={()=>void logout()}/>
}
export default function App() {
  if(Preview&&new URLSearchParams(location.search).has('preview'))return <Suspense fallback={<p>Ładowanie podglądu…</p>}><Preview/></Suspense>
  if(!configured)return <AuthCard><h1>Konfiguracja aplikacji</h1><p>Uzupełnij plik .env.local zgodnie z instrukcją konfiguracji projektu.</p></AuthCard>
  return <AuthProvider><AuthGate/></AuthProvider>
}
