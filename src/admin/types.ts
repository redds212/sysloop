import type { CardRow, CategoryRow, ProfileRow, ReportRow } from '../lib/database.types'
import type { CardLine } from '../types'

export type CardDocument = Omit<CardRow, 'id' | 'created_at' | 'updated_at'>
export type ChangeKind = 'added' | 'changed' | 'removed' | 'unchanged'
export interface RawCard { lines: CardLine[]; [key: string]: unknown }
export interface ImportChange {
  cardKey: string;
  kind: ChangeKind;
  card?: CardDocument;
  oldRaw?: RawCard | null;
  newRaw?: RawCard | null;
  verification?: string;
  pageImages?: string[];
}
export interface ImportSummary {
  id: string; category_slug: string; source_file: string; revision: string;
  status: 'pending' | 'applied' | 'discarded'; created_at: string;
  applied_at: string | null; applied_by: string | null;
  summary: Record<string, unknown>;
}
export interface ImportRun extends ImportSummary {
  raw_snapshot: { category: { slug: string; name: string; group: string; sortOrder?: number; notes?: CategoryRow['notes'] }; cards: RawCard[] };
  proposal: { baseRunId: string | null; changes: ImportChange[] };
}
export type ImportDecisions = Record<string, { cosmetic?: boolean; approve?: boolean; skip?: boolean; linkTo?: string }>
export interface AdminData { cards: CardRow[]; categories: CategoryRow[]; users: ProfileRow[]; reports: ReportRow[]; runs: ImportSummary[] }
export interface AdminRepository {
  load(): Promise<AdminData>;
  getRun(id: string): Promise<ImportRun>;
  saveCard(card: CardRow, substantive: boolean, revision: string): Promise<void>;
  saveCategory(category: CategoryRow): Promise<void>;
  updateUser(id: string, patch: Pick<Partial<ProfileRow>, 'status' | 'is_admin'>): Promise<void>;
  deleteUser(id: string): Promise<void>;
  updateReport(id: number, status: ReportRow['status']): Promise<void>;
  deleteReport(id: number): Promise<void>;
  applyRun(id: string, decisions: ImportDecisions): Promise<void>;
  discardRun(id: string): Promise<void>;
  pageUrl(path: string): Promise<string>;
  cardPage(card: CardRow): Promise<string | null>;
}
