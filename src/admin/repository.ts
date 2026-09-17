import { supabase } from '../lib/supabase'
import { allRows } from '../lib/supabaseRepository'
import type { AdminRepository } from './types'

function result<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw new Error('Operacja nie została potwierdzona. Sprawdź połączenie i uprawnienia, a następnie odśwież dane.')
  return r.data
}
const runColumns = 'id,category_slug,source_file,revision,status,created_at,applied_at,applied_by,summary' as const

export function createAdminRepository(currentUserId: string): AdminRepository {
  return {
    async load() {
      const [cards, categories, users, reports, runs] = await Promise.all([
        allRows((a,b) => supabase.from('cards').select('*').order('id').range(a,b)),
        allRows((a,b) => supabase.from('categories').select('*').order('sort_order').order('slug').range(a,b)),
        allRows((a,b) => supabase.from('profiles').select('*').order('created_at', {ascending:false}).order('id').range(a,b)),
        allRows((a,b) => supabase.from('card_reports').select('*').order('created_at', {ascending:false}).order('id').range(a,b)),
        allRows((a,b) => supabase.from('import_runs').select(runColumns).order('created_at', {ascending:false}).order('id').range(a,b)),
      ])
      return { cards, categories, users, reports, runs }
    },
    async getRun(id) {
      const run=result(await supabase.from('import_runs').select('*').eq('id',id).single())
      if(!run)throw new Error('Nie znaleziono importu.')
      return run
    },
    async saveCard(card, substantive, revision) {
      result(await supabase.rpc('admin_save_card', {p_card:card, p_substantive:substantive, p_revision:revision}))
    },
    async saveCategory(c) {
      result(await supabase.from('categories').update({name:c.name, group_name:c.group_name, sort_order:c.sort_order, notes:c.notes, updated_at:new Date().toISOString()}).eq('slug',c.slug).select('slug').single())
    },
    async updateUser(id, patch) {
      if (id === currentUserId) throw new Error('Własne uprawnienia pozostają bez zmian.')
      result(await supabase.from('profiles').update(patch).eq('id',id).select('id').single())
    },
    async deleteUser(id) {
      if (id === currentUserId) throw new Error('Nie można usunąć własnego konta.')
      const data = result(await supabase.functions.invoke('delete-user', {body:{targetUserId:id}}))
      if (data?.ok !== true) throw new Error('Nie potwierdzono usunięcia konta. Odśwież listę użytkowników.')
    },
    async updateReport(id, status) { result(await supabase.from('card_reports').update({status}).eq('id',id).select('id').single()) },
    async deleteReport(id) { result(await supabase.from('card_reports').delete().eq('id',id).select('id').single()) },
    async applyRun(id, decisions) { result(await supabase.rpc('apply_import_run', {p_run_id:id, p_decisions:decisions})) },
    async discardRun(id) { result(await supabase.rpc('discard_import_run', {p_run_id:id})) },
    async pageUrl(path) {
      if (!/^[a-zA-Z0-9-]+\/p\d+\.png$/.test(path)) throw new Error('Nieprawidłowa ścieżka strony źródłowej.')
      const signed=result(await supabase.storage.from('review-pages').createSignedUrl(path, 600))
      if(!signed)throw new Error('Nie znaleziono strony źródłowej.')
      return signed.signedUrl
    },
    async cardPage(card) {
      const runs = await allRows((a,b) => supabase.from('import_runs').select('id,proposal').eq('category_slug',card.category_slug).eq('revision',card.source_revision).eq('status','applied').order('applied_at',{ascending:false}).order('id').range(a,b))
      for (const run of runs) {
        const change = run.proposal.changes.find(c => c.cardKey === card.card_key)
        const path = change?.pageImages?.find(p => p === `${run.id}/p${String(card.source_page).padStart(3,'0')}.png`)
        if (path) return path
      }
      return null
    },
  }
}
