import type { AppUser, Attempt, Card, Category, SRSEntry, SRSStore, UserSettings } from '../types'
import type { SessionState } from './sessionState'

export interface LearningData { cards: Card[]; categories: Category[]; store: SRSStore; attempts: Attempt[]; session: SessionState | null }
export interface LearningRepository {
  load(): Promise<LearningData>;
  saveSession(session: SessionState): Promise<void>;
  putProgress(cardId: string, entry: SRSEntry): Promise<void>;
  recordAttempt(attempt: Attempt): Promise<void>;
  saveSettings(settings: UserSettings): Promise<void>;
  report(card: Card, category: Category | undefined, message: string): Promise<void>;
}
export interface LearningOperation { attempt?: Attempt; progress?: { cardId: string; entry: SRSEntry }; session?: SessionState }
export interface Journal { read(): LearningOperation | null; write(operation: LearningOperation): void; clear(): void }
export function browserJournal(user: Pick<AppUser, 'id'>, storage: Storage): Journal {
  const key = `sysloop:pending:${user.id}`
  return {
    read: () => { const value = storage.getItem(key); return value ? JSON.parse(value) as LearningOperation : null },
    write: operation => storage.setItem(key, JSON.stringify(operation)),
    clear: () => storage.removeItem(key),
  }
}
/** Acknowledged writes only. A interrupted operation is replayed before loading another card. */
async function flush(repository: LearningRepository, journal: Journal, operation?: LearningOperation) {
  const pending = journal.read() ?? operation
  if (!pending) return
  journal.write(pending)
  // recordAttempt deduplicates the timestamp receipt, including a lost HTTP response.
  if (pending.attempt) await repository.recordAttempt(pending.attempt)
  if (pending.progress) await repository.putProgress(pending.progress.cardId, pending.progress.entry)
  if (pending.session) await repository.saveSession(pending.session)
  journal.clear()
}
const writes = new WeakMap<LearningRepository, Promise<void>>()
export function flushOperation(repository: LearningRepository, journal: Journal, operation?: LearningOperation): Promise<void> {
  // Also serializes StrictMode hydration and recovery on one mounted client.
  const next = (writes.get(repository) ?? Promise.resolve()).catch(() => {}).then(() => flush(repository,journal,operation))
  writes.set(repository,next)
  return next
}
