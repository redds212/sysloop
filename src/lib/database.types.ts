import type { AuctionCall, CardLine, LearningMode, SRSStatus } from '../types'
import type { SessionSlot } from './session'

export type ProfileRow = { id: string; username: string; is_admin: boolean; status: 'pending' | 'approved'; daily_target: number; mode: LearningMode; timed_mode: boolean; created_at: string }
export type CategoryRow = { slug: string; name: string; group_name: string; sort_order: number; source_file: string; revision: string; notes: { title: string; body: string }[]; updated_at: string }
export type CardRow = { id: string; category_slug: string; card_key: string; section: string; sort_order: number; auction: AuctionCall[]; auction_key: string; context: string | null; auction_note: string | null; notes: string[]; lines: CardLine[]; status: 'draft' | 'active' | 'archived'; review_flags: string[]; verification_note: string | null; source_page: number; source_revision: string; created_at: string; updated_at: string }
export type SrsProgressRow = { user_id: string; card_id: string; status: SRSStatus; consecutive_correct: number; interval: number; next_review_date: string | null; last_seen: string | null; flag_difficult: boolean }
export type AttemptRow = { id: number; user_id: string; card_id: string; correct: boolean; phase: 'main' | 'buffer' | 'free'; missed_line_keys: string[] | null; present_line_keys: string[]; timed_out: boolean; line_count: number; ts: string }
export type DailySessionRow = { user_id: string; date: string; slots: SessionSlot[]; idx: number; buffer: string[]; buffer_index: number; in_buffer: boolean; deferred_review_ids: string[]; target: number; mode: LearningMode; updated_at: string }
export type ReportRow = { id: number; user_id: string | null; card_id: string; card_label: string; reporter_label: string; message: string; status: 'new' | 'seen' | 'resolved'; created_at: string }
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
export type Database = { public: {
  Tables: { profiles: Table<ProfileRow>; categories: Table<CategoryRow>; cards: Table<CardRow>; srs_progress: Table<SrsProgressRow>; attempts: Table<AttemptRow>; daily_sessions: Table<DailySessionRow>; card_reports: Table<ReportRow> };
  Views: Record<string, never>;
  Functions: { update_my_settings: { Args: { p_daily_target: number; p_mode: string; p_timed_mode: boolean }; Returns: undefined } };
  Enums: Record<string, never>; CompositeTypes: Record<string, never>;
} }
