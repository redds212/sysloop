export type Side = 'we' | 'they'
export type CallToken = string
export interface AuctionCall { side: Side; alts: CallToken[]; implicit?: true; qualifier?: string }
export interface CardLine {
  key: string; label: string; bids: CallToken[]; meaning: string; changedIn?: string; changedAt?: string
}
export interface Card {
  id: string; categorySlug: string; section: string; sortOrder: number;
  auction: AuctionCall[]; auctionKey: string; context?: string; auctionNote?: string;
  notes: string[]; lines: CardLine[]; status: 'draft' | 'active' | 'archived';
  reviewFlags: string[]; verificationNote?: string; sourcePage: number; sourceRevision: string;
}
export type SRSStatus = 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED'
export interface SRSEntry {
  status: SRSStatus; consecutiveCorrect: number; interval: number;
  nextReviewDate: string | null; lastSeen: string | null; flagDifficult?: boolean
}
export type SRSStore = Record<string, SRSEntry>
export type LearningMode = 'maintenance' | 'balanced' | 'intensive'
export interface UserSettings { dailyTarget: number; mode: LearningMode; timedMode?: boolean }
export type AttemptPhase = 'main' | 'buffer' | 'free'
export interface Attempt {
  cardId: string; correct: boolean; phase: AttemptPhase; missedLineKeys: string[] | null;
  presentLineKeys: string[]; timedOut: boolean; lineCount: number; ts: string
}
