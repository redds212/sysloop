import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = !!url && !!key
// A missing configuration has its own screen. No requests use these placeholders.
export const supabase = createClient<Database>(url || 'http://127.0.0.1:54321', key || 'unconfigured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
