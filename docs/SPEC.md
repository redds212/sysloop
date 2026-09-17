# SysLoop — v1 specification

> **SysLoop**: a spaced-repetition trainer for a bridge partnership's bidding-system notes.
> **Status:** design approved 2026-09-16 (design interview with the owner). Build starting with Codex.
> **This file is the single source of truth for the build.** Build rules and milestones: `AGENTS.md`.
> **Owner / admin:** redds, author of BridgeLoop (bridgeloop.pl).
> **Project folder:** `D:\claude system` (PDFs in `sys files/`).

## Contents
1. What we're building
2. Decisions log
3. Glossary
4. Source material (the PDFs)
5. Domain model
6. Learning loop
7. Features and screens (v1)
8. Search by auction
9. Data pipeline: import, verification, revisions
10. Backend (Supabase)
11. Frontend
12. Visual direction
13. Privacy and security rules
14. Out of scope / later
15. Acceptance criteria
16. Open items (need the owner)

---

## 1. What we're building

A mobile-first web app (PWA) that drills a bidding system one position at a time.

- A **card is one auction position** from the notes, e.g. `1♣ – 1♦ / 1♥ – 2♣ / 2♦ – ?`.
- The front shows the auction and **the calls documented at that point, with their meanings hidden**.
- The user recalls the meanings silently, reveals them, and **marks the lines they got wrong**. **Only a perfect card passes.**
- A spaced-repetition schedule (the same engine as BridgeLoop) decides when each card comes back.
- The content comes from 14 PDFs (one category per file). A local import pipeline parses them; every card is checked against its PDF page; the owner approves doubtful cards. New PDF revisions are imported as reviewed diffs.
- It is a **separate app** from BridgeLoop (own repo, URL, Supabase project), built from a copy of BridgeLoop's code (auth, Supabase, SRS, daily session, timer, settings, PWA, deploy) with **its own screens**.
- **Closed group:** people sign up, the admin approves them. System content is readable only after approval and never ships in the repo or the public JS bundle.

## 2. Decisions log

| # | Topic | Decision |
|---|---|---|
| 1 | Card unit | One auction position (a stub ending in `?`) with all its documented continuations. Front: auction + list of calls, meanings hidden. Back: meanings. |
| 2 | Summary blocks | `ZESTAWIENIE … ODPOWIEDZI` blocks are cards too; they are the root positions (e.g. `1♣ – ?`). |
| 3 | Prose | `OPIS …`, `UWAGI OGÓLNE` and similar prose become per-category **Notatki**, never scheduled. `UWAGA` notes inside a position are shown with that card after reveal and are not graded. |
| 4 | Card size | No cap, no splitting, no weighting. A 28-line position is one card. |
| 5 | Grading | The user marks missed lines. **Pass only at 100%** (zero missed lines). Missed line keys are stored per attempt. No manual override of the result. Each line is right or wrong; forgetting one of the a/ b/ c/ variants makes the line wrong. |
| 6 | Scheduling | BridgeLoop engine, cards never retire. Pass: 3 → 9 → 27 → 81 → 160 days, then stays at 160. Fail: back tomorrow, counter reset. "Opanowane" = at 81+ days (label only). 160 matches BridgeLoop commit `015977e`. |
| 7 | New cards | Random from all active cards, shuffled with a date seed (as BridgeLoop). Categories are labels only; there is no category filter in sessions. |
| 8 | Daily session | Exactly as BridgeLoop: daily target (default 20), modes Utrwalenie / Zrównoważony / Intensywny (20 / 40 / 70% new), queue = yesterday's misses → due reviews → new cards; cards missed in the session come back once at its end; misses may crowd out new cards (intended). |
| 9 | Timer | Optional "tryb na czas", off by default. 6 s per line for a new card, down to 3 s per line at 81+ days, minimum 15 s. When time runs out: auto-reveal, counts as fail. |
| 10 | App | Separate app built from a copy of BridgeLoop's code; the UI/UX may differ. |
| 11 | Users | Closed group like BridgeLoop: sign-up → admin approval → access. Everyone has their own progress. The owner is the admin. |
| 12 | Privacy | Content lives in Supabase behind RLS; never in the repo, the bundle, fixtures or logs. |
| 13 | Verification | The importer flags suspicious cards; an agent then compares every card with an image of its PDF page. Doubtful cards stay **drafts** until the admin approves them. "Zgłoś błąd" is the safety net. The check is "card = PDF", not "the PDF is right". |
| 14 | Revisions | The PDFs stay the master copy. A new PDF is parsed and compared with the previous parse; the admin approves added / removed / changed cards. Matching by category + auction (+ context). Removed cards are archived with their history. The admin can also edit cards directly. |
| 15 | Changed meaning | Keep the user's step, make the card due tomorrow, highlight changed lines after reveal ("zmiana w rev2026"). The admin can mark a change **cosmetic**: then progress is untouched. |
| 16 | v1 features | Daily session, Mój panel, Zgłoś błąd, admin, **sidebar practice (counts toward the schedule)**, **Notatki**, **search by auction including opponents' calls**, **read mode**, **Trudne odzywki**. |
| 17 | Later | "Przed turniejem": drill a whole category without affecting the schedule. |
| 18 | Search | Builder's design for v1 (section 8); the owner expects a redesign later, so keep it isolated. |
| 19 | Name | **SysLoop**. |
| 20 | Builder | Codex, following `AGENTS.md`. |

## 3. Glossary

- **Category**: one PDF file, e.g. *Otwarcie 1♣*.
- **Section**: a heading inside a PDF, e.g. `LICYTACJA W SEKWENCJI 1♣ – 1♦`. Groups positions in the sidebar.
- **Position / card**: an auction where our side is to call (`?`), plus the documented calls.
- **Line**: one documented call at a position with its meaning (`2♠ – <meaning>`). A line may cover alternatives (`4♥/♠`, `pas/x`).
- **Call tokens**: `1C`…`7NT`, `P` (pas, pass, p), `X` (ktr, x), `XX` (rktr, xx). Suits: C ♣, D ♦, H ♥, S ♠; NT (also written BA).
- **We / They**: our partnership / the opponents. Opponents' calls are usually in parentheses in the notes, but not always (4.3).
- **Implicit pass**: an opponents' pass the notes don't write (uncontested sequences).
- **Qualifier**: a label on one call describing its agreed meaning, e.g. `(KTR) T/O`, `(1♥) TRANSFER`, `1♥ = naturalne`.
- **Context**: a condition on a whole position, e.g. `TYLKO PRZED PARTIĄ`.
- **Revision**: tag from the file name (`rev2025`, `rev2025beta`, `2025`, or none).
- **Import run**: one uploaded parse of one PDF, waiting for admin review.
- **Draft**: an imported card not yet approved; invisible to non-admins.

## 4. Source material

Location: `sys files/` in the project folder. **Private: never committed, never uploaded anywhere except as parsed cards into Supabase.**

### 4.1 Files → categories

Mapping lives in `tools/importer/categories.json` (committed; contains names only). Match files by the prefix before the revision suffix, so `OTW_1T_rev2026.pdf` still maps to `otw-1t`. Do not take names from the running page headers: `OBR_inne` and `OTW_3_plus` carry headers of other files.

| File | slug | Display name | Group | Pages | Revision |
|---|---|---|---|---|---|
| `OTW_1T_rev2025.pdf` | `otw-1t` | Otwarcie 1♣ | Otwarcia | 82 | rev2025 |
| `OTW_1K_rev2025.pdf` | `otw-1k` | Otwarcie 1♦ | Otwarcia | 45 | rev2025 |
| `OTW_1H_rev2025.pdf` | `otw-1h` | Otwarcie 1♥ | Otwarcia | 41 | rev2025 |
| `OTW_1S_rev2025.pdf` | `otw-1s` | Otwarcie 1♠ | Otwarcia | 32 | rev2025 |
| `OTW_1N_rev2025.pdf` | `otw-1n` | Otwarcie 1NT | Otwarcia | 17 | rev2025 |
| `OTW_2T_rev2025.pdf` | `otw-2t` | Otwarcie 2♣ | Otwarcia | 7 | rev2025 |
| `OTW_2M_rev2025beta.pdf` | `otw-2m` | Otwarcie 2♥ i 2♠ | Otwarcia | 3 | rev2025beta |
| `OTW_2NT_rev2025.pdf` | `otw-2nt` | Otwarcie 2NT | Otwarcia | 8 | rev2025 |
| `OTW_3_plus.pdf` | `otw-3plus` | Otwarcia 3♣ i wyżej | Otwarcia | 4 | none |
| `OBR_1T_rev2018.pdf` | `obr-1t` | Obrona przeciwko 1♣ | Obrona | 34 | rev2018 |
| `OBR_1D_rev2018.pdf` | `obr-1d` | Obrona przeciwko 1♦ | Obrona | 38 | rev2018 |
| `OBR_W_2kol_rev2025.pdf` | `obr-w-2kol` | Wejścia dwukolorowe | Obrona | 5 | rev2025 |
| `OBR_W_2NT po blokach_rev2021.pdf` | `obr-w-2nt-bloki` | Wejście 2NT po otwarciach blokujących | Obrona | 6 | rev2021 |
| `OBR_inne_2025.pdf` | `obr-inne` | Obrona – różne | Obrona | 2 | 2025 |

`OTW_3_plus` covers several openings (3♣, 3♦, 3♥/♠, 3NT, 4♣/♦, 4♥/♠, 4NT), each under its own `OTWARCIE …` title.

### 4.2 Structure of a file

1. Title block (`OTWARCIE 1♣`, `OBRONA vs OTWARCIE 1♦ PRECISION, NATURALNY`).
2. Prose: `OPIS OTWARCIA`, `UWAGI OGÓLNE`, `OPIS INTERWENCJI …`, `OPIS WEJŚĆ` → Notatki. Some `OPIS …` blocks contain call lines; those are positions (9.3 rule 10).
3. Summary blocks: `ZESTAWIENIE PIERWSZYCH ODPOWIEDZI`, `ZESTAWIENIE ODPOWIEDZI PO (1♥) – 2♥` → root/summary positions.
4. Section headers: `LICYTACJA W SEKWENCJI …`, `DALSZA LICYTACJA W SEKWENCJI …`, `LICYTACJA PO INTERWENCJI …`, `KONTYNUACJA …`, `KONTRA NA …`.
5. Auction stubs (one or more rows, the last containing `?`), followed by lines `call – meaning`.
6. `UWAGA …` notes and cross-references (`dalsza licytacja jak w sekwencji 1♦ – (1♠) – ktr`, `SCHEMAT PODOBNY DO 1♣ – 1NT`).
7. Noise: running page header (file title) and page number on every page.

Rough pre-import measurement (text heuristics): about 650 positions, about 5,800 lines, median 8 lines per position, largest uncontested positions 20–28 lines; the defence files are under-detected by simple heuristics. 324 pages in total. The importer produces the real numbers.

### 4.3 Known extraction hazards (all found in the real files)

| Hazard | Example | Required handling |
|---|---|---|
| Calls with several meanings | 1♣ `ZESTAWIENIE PIERWSZYCH ODPOWIEDZI`: 14 labelled rows and 5 unlabelled ones. `1♠` has four meaning rows, `2♦` and `2♥` two each; the unlabelled rows are further meanings of the call above (verified on the rendered page). `pdftotext -layout` shifts them onto the wrong calls | Pair by word y-position; an unlabelled row at the meaning column belongs to the labelled row above it (joined with `\n`). Flag `line_count_mismatch` only when a label has no meaning text on its row or meaning rows come before the first label |
| Page header / number inside a block | `Otwarcie 1♣ - licytacja jednostronna` and `3` between a stub and its lines | Strip by page position |
| Wrapped meanings | `2♠ – a/ …, b/ …,` then a row `– c/ …, d/ …` | Rows with no label continue the previous meaning; a lone leading `–` is not a new call; uncertain → `wrapped_line` |
| Grouped calls | `4♥/♠ – …`, `pas/x – …`, `4♣/♦ – …` | One line with alternatives |
| 2-column uncontested stubs | `1♣ - 1♦` / `1♥ - 2♣` / `2♦ - ?` | Both columns are ours; insert implicit opponents' passes |
| 4-column stubs, opponents in parentheses | `(1♦) - ktr - (pas) - 1♥` / `(pas) - 1♠ - (pas) - ?` | Seats alternate; parentheses = they |
| 4-column stubs **without** parentheses | `2♥ - ktr - ? -` (means 2♥ (X) ?), `2♠ - 2NT - ? -` | Side comes from the column (x-coordinate), not from parentheses; unclear 2- vs 4-column → `ambiguous_layout` |
| Empty cells | `- - pas - (pas)`, `rktr - (pas) - ? -` | Placeholders; use coordinates |
| Qualifiers on opponents' calls | headers `(1♦) – KTR – (1♥) NATURALNE` vs `… (1♥) TRANSFER`; `1♣ – (PAS) – 1♦ – (KTR) T/O` vs `… (KTR) 5+♦`; `(1♦) – 1♥ – (KTR) <4♠`; `(1♦) – KTR – (3♣) FIT ♦`; stub note `1♥ = naturalne` | Qualifier on that call. Same auction with different qualifiers = different cards |
| Position context | `?    TYLKO PRZED PARTIĄ` | Card-level context, part of the card identity |
| Wildcards | `(1♦) – PAS – (WYŻSZE)`, `(1♦) – KTR – (PAS) – WYŻSZE`, `1♣ – (p) – 1X – (2♥/♠) – 2NT` | Tokens `*` (any higher bid) and `1*` (any suit at that level) |
| Alternatives in stubs | `(1NT) - x - (pass/xx) - ?`, `(1NT) - pass - (4♣/♦/♥) - ?`, `1♣ – (1♥) – KTR /2♦`, `3♥/♠ - ?` | Alternatives per call |
| Trailing text on stub rows | `pass/xx = …`, `4♣/♦/♥ = …`, `UWAGA TRANSFERY`, `SCHEMAT PODOBNY DO 1♣ - 1NT` | `<call> = text` for an opponents' call → that call's qualifier; anything else → auction note |
| Auction only in a prose header | `OPIS INTERWENCJI – KONTRA WYWOŁAWCZA PO 1♦` followed by call lines | Card with flag `auction_from_header`; the verifier sets the auction |
| Relative stubs | a stub that is only `?`, or starts mid-auction | Resolve against the section header; flag `relative_stub` |
| Cross-references | `Tak jak (1♣) – pas – (1♠) transfer.` | Keep as note text; no automatic linking in v1 |
| Same auction twice in one file | `(1NT) - pass - (4♣/♦/♥) - ?` appears twice in `OBR_inne` | Different context/qualifier if found; else `#2` suffix + `duplicate_key` |

## 5. Domain model

### 5.1 Calls and auctions

```ts
type Side = 'we' | 'they';
// '1C'..'7NT', 'P', 'X', 'XX', '*' (any higher bid), '1*'..'7*' (any suit at that level)
type CallToken = string;

interface AuctionCall {
  side: Side;
  alts: CallToken[];   // one or more alternatives: ['P','XX'], ['4C','4D','4H']
  implicit?: true;     // a pass the notes don't write (inserted by the normalizer)
  qualifier?: string;  // agreed meaning of this call, verbatim: 'T/O', 'TRANSFER', '5+♦', 'naturalne'
}
```

Normalization rules (the importer and the search use the same rules):
1. Tokens: ♣ ♦ ♥ ♠ → C D H S; `NT`, `BA`, `1 NT` → NT; `pas`, `pass`, `PAS`, `p` → P; `ktr`, `KTR`, `x`, `X` → X; `rktr`, `RKTR`, `xx`, `XX` → XX; `WYŻSZE` → `*`; placeholder `1X` → `1*`.
2. Alternatives: `4♣/♦/♥` → [4C, 4D, 4H] (the level carries over); `3♥/♠` → [3H, 3S]; `pass/xx` → [P, XX]; `KTR /2♦` → [X, 2D].
3. Sides strictly alternate. Between two consecutive calls of the same side, insert an implicit pass of the other side.
4. The `?` is always our call. If the last written call is ours, append an implicit opponents' pass.
5. Leading passes are kept only if the notes write them.
6. The auction is the list of calls before `?`; it never contains `?`.

Canonical string `auction_key`: calls joined by one space; opponents' calls wrapped in `( )`; alternatives joined by `/`; a qualifier appended in `[ ]`; implicit passes included.

| In the notes | auction_key |
|---|---|
| `1♣ - 1♦` / `?-` | `1C (P) 1D (P)` |
| `1♣ - 1♦` / `1♥ - 2♣` / `2♦ - ?` | `1C (P) 1D (P) 1H (P) 2C (P) 2D (P)` |
| `(1♦) - ktr - (pas) - 1♥` / `(pas) - 1♠ - (pas) - ?` | `(1D) X (P) 1H (P) 1S (P)` |
| `(1NT) - x - (pass/xx) - ?` | `(1NT) X (P/XX)` |
| `(1NT) - pass - (4♣/♦/♥) - ?` | `(1NT) P (4C/4D/4H)` |
| `2♥ - ktr - ? -` (4 columns, no parentheses) | `2H (X)` |
| position under header `1♣ – (PAS) – 1♦ – (KTR) T/O` where opener is to call | `1C (P) 1D (X[T/O])` |
| position under header `(1♦) – PAS – (WYŻSZE)` where we are to call | `(1D) P (*)` |
| `ZESTAWIENIE ODPOWIEDZI PO (1♥) - 2♥` | `(1H) 2H (P)` |
| `ZESTAWIENIE PIERWSZYCH ODPOWIEDZI` in `otw-1t` | `1C (P)` |
| `3♥/♠ - ?` | `3H/3S (P)` |

Display conventions: P → `pas`, X → `ktr`, XX → `rktr`, NT → `NT`; suit symbols in 4-colour; opponents' calls in parentheses; qualifiers as small chips. Compact form (lists, history, search results) hides implicit passes: `1♣–1♦–1♥–2♣–2♦`, `(1♦)–ktr–(pas)–1♥–(pas)–1♠`. Grid form (card screen) shows implicit passes dimmed only where needed for column alignment.

### 5.2 Card

```ts
interface CardLine {
  key: string;        // stable within the card: canonical bids joined by '/', plus '#n' for repeats ('2S', 'P/X#2')
  label: string;      // as displayed: '4♥/♠', 'pas/x'
  bids: CallToken[];  // canonical alternatives
  meaning: string;    // verbatim; wrapped rows joined with '\n'
  changedIn?: string; // revision label of the last substantive change
  changedAt?: string; // ISO timestamp of that change
}

interface Card {
  id: string;               // uuid, stable forever (progress hangs on it)
  categorySlug: string;
  section: string;          // nearest section header, verbatim
  sortOrder: number;        // order of appearance in the PDF
  auction: AuctionCall[];
  auctionKey: string;
  context?: string;         // position-level condition, verbatim
  auctionNote?: string;     // trailing stub text that is not a qualifier
  notes: string[];          // UWAGA / cross-reference paragraphs of this position
  lines: CardLine[];        // at least one
  status: 'draft' | 'active' | 'archived';
  reviewFlags: string[];    // see 9.4
  verificationNote?: string;
  sourcePage: number;       // 1-based page where the stub starts
  sourceRevision: string;
}
```

Card identity `card_key` = `<categorySlug>|<auctionKey>`, plus `|<context>` when there is a context, plus `#n` when the same key repeats inside one file.

### 5.3 Category

`slug`, `name`, `group` (Otwarcia or Obrona), `sortOrder`, `sourceFile`, `revision`, `notes` = list of `{ title, body }` prose sections in PDF order.

## 6. Learning loop

### 6.1 Card screen

Phases: `front` → `revealed` → `rated`.

**Front**
- Breadcrumb: category · section.
- Auction (5.1). Uncontested → rows of `otwierający | odpowiadający`. Contested → 4-column rows, the first column is the first caller.
- Context chip, qualifier chips.
- The lines: call labels in order with **blank meaning slots** (uniform placeholder bars; no hint of meaning length).
- Primary button **Pokaż** (Space / Enter on desktop). Timer if enabled (6.3). No other navigation that would reveal content (no Notatki link on the front).

**Revealed**
- Meanings appear. Notes and auction note in a muted **Uwagi** block (not gradable).
- Lines changed since the user last saw the card get an amber chip **zmiana w rev2026** (6.7).
- Tapping a line toggles **missed** (red tint + ✗); tapping again clears it.
- Primary button: **Wszystko dobrze** when no line is marked; **Dalej · N błędów** when at least one is marked. Polish plural: 1 → błąd; n mod 10 in 2–4 and n mod 100 not in 12–14 → błędy; otherwise błędów.
- Secondary: **Zgłoś błąd**, **Notatki** (category notes in a sheet).

**Rated** → next card (session) or the result state (free practice, 6.6).

### 6.2 Grading

- Pass ⇔ zero missed lines.
- Every rating writes an attempt: `card_id`, `correct`, `phase` (`main`, `buffer` or `free`), `missed_line_keys` (empty array on pass; `null` on timeout), `timed_out`, `line_count`, `ts`.

### 6.3 Timer (tryb na czas)

- Setting in Mój panel, default off (`profiles.timed_mode`).
- Limit in seconds = `max(15, ceil(perLine[level] × lineCount))`, with `perLine = [6, 5, 4, 3.5, 3, 3]` indexed by `consecutive_correct` (0–5).
  - Examples: 8 lines, new → 48 s. 8 lines at 81+ days → 24 s. 20 lines, new → 120 s. 2 lines → 15 s.
- Starts when the front is shown; resets whenever a card is (re)loaded. **Pokaż** stops it and grading is normal.
- At zero: auto-reveal, marking disabled, message **Czas minął — zaliczone jako błąd**, button **Dalej** → fail with `timed_out = true`, `missed_line_keys = null`.
- Last 10 seconds in amber (BridgeLoop `DealTimer`).

### 6.4 SRS (per user × card)

Copy BridgeLoop `src/lib/srs.ts` at commit `015977e` (or later), replacing deal ids with card ids:
- Status `NEW`, `LEARNING`, `REVIEW`, `MASTERED`. `SUCCESS_INTERVALS = [3, 9, 27, 81, 160]`, `MAX_STEP = 5`, `MASTERED_STEP = 4`.
- Pass: `step = min(5, consecutive_correct + 1)`, `interval = SUCCESS_INTERVALS[step − 1]`, `next_review_date = today + interval`, status `MASTERED` if step ≥ 4, else `REVIEW`.
- Fail: `LEARNING`, step 0, interval 1, `next_review_date = tomorrow`.
- Never retire.
- Dates are local-day keys `YYYY-MM-DD` (BridgeLoop `lib/date.ts`); day rollover with `useDayKey`.

### 6.5 Daily session

Copy BridgeLoop `src/lib/session.ts` and `src/hooks/useDailySession.ts`, replacing deals with cards.
- Settings: `daily_target` default 20, slider 5–40 (DB clamp 1–100, label "sugerowane 10" as in BridgeLoop), `mode` maintenance / balanced / intensive = 20 / 40 / 70% new.
- Today's queue (up to X slots):
  1. **Retries**: `LEARNING` with interval 1, due today or earlier. They consume the review quota and are limited only by X.
  2. **Due reviews**, most overdue first, up to the review quota. Unused quota goes to new cards.
  3. **New**: all `active` cards the user has never attempted, shuffled with a seed from today's date.
- Main pass: pass → apply to SRS immediately; fail → record the attempt, push the card to the buffer (no SRS write yet).
- Buffer pass (after the main pass): every missed card once more; whatever the result → `LEARNING`, due tomorrow, counter 0; failed again → `flag_difficult = true`.
- Snapshot in `daily_sessions` so the session resumes after reload or on another device; it expires at local midnight; a target/mode change mid-day adapts the queue; archived cards are skipped.
- Owner clarification (2026-09-17): unfinished main-pass misses at midnight become `LEARNING`, step 0, due the day after the original answer. Recover these before generating the next day's queue; do not override a later free-practice or buffer rating.
- Progress bar `7 / 20`; label **Poprawki** during the buffer pass; completion summary at the end.

### 6.6 Free practice (sidebar, search, read mode, Trudne odzywki)

- **Counts toward the schedule.** `phase = 'free'`.
- Anti-gaming as in BridgeLoop `App.tsx` (`visitBaseRef`, `applyFromSnapshot`): a rating is computed from the SRS snapshot taken before the visit; re-rating the same card in the same visit recomputes from that snapshot and never stacks; **Powtórz** after a pass restores the snapshot; a fail stays.
- Opening a card for free practice while a session runs pauses the session; **Wznów sesję** stays available.

### 6.7 Effect of content changes on progress

Owner clarification (2026-09-16): database-triggered “tomorrow” uses **Europe/Warsaw** for the group.

- **Substantive** change to a card (from an import run or the admin editor): set `changedIn` / `changedAt` on changed and added lines; for every `srs_progress` row of that card with status ≠ NEW and `next_review_date` later than tomorrow → set `next_review_date = tomorrow` (step unchanged).
- Highlight rule: a line shows **zmiana w …** when `changedAt > srs_progress.last_seen` at the moment the card is loaded.
- **Cosmetic** change: text updated only; no highlight, no schedule change.
- Archived card: excluded from sessions, lists and search; progress and attempts kept.
- A line removed from a card: its key in old attempts is ignored by statistics.

## 7. Features and screens (v1)

Polish UI copy everywhere. Mobile-first (375 × 812). Desktop two-pane layout (sidebar + main) from the `md` breakpoint, defined as in BridgeLoop: `(min-width: 768px) and (min-height: 500px)`; `md` is the only breakpoint.

### 7.1 Auth
Copy BridgeLoop: login, sign-up (email + username + password), email confirmation, pending-approval screen with **Sprawdź ponownie**, reset password, change password.

### 7.2 Shell
- **Sidebar** (drawer on mobile): wordmark; buttons **Mój panel**, **Admin** (admins only), **Wyloguj**; **Rekomendowane na dziś** (first 3 items of today's queue + "+N więcej"); **Szukaj sekwencji**; **Trudne odzywki**; the category tree; footer counters **Nowe / Nauka / Opanowane**.
- **Category tree**: group (Otwarcia, Obrona) → category (with progress, e.g. `38 / 197`) → **Notatki** entry + sections → positions. A position row shows the compact auction and a status dot (grey new, red learning, amber review, emerald mastered). Tap → free practice. Secondary icon → read mode.
- **Main area** by default: **Rozpocznij sesję (20)**, **Wznów sesję (4 / 20)** or today's summary.

### 7.3 Read mode
- Auction, context, qualifiers, **all lines with meanings**, notes.
- For each line: if a card exists whose auction = this auction + that call (+ implicit opponents' pass) → **›** link to it.
- **‹** link to the parent position when one exists (a card whose auction plus one of its lines' calls gives this auction).
- Buttons **Ćwicz tę pozycję** (free practice) and **Zgłoś błąd**.
- Never changes SRS.

### 7.4 Notatki
Per category: prose sections in PDF order (title + body, line breaks kept). Read-only for users, editable by the admin.

### 7.5 Search by auction
Section 8.

### 7.6 Trudne odzywki

Owner clarification (2026-09-16): attempts also store `present_line_keys text[]`, the keys present at grading, so only appearances while a line existed are counted.
- A line is **trudna** when it was missed in at least 2 of its last 5 graded appearances. An appearance is an attempt of its card with `missed_line_keys` not null, made while the line existed.
- Sorted by misses in the last 5 (descending), then by most recent miss. Row: call label, compact auction, category, `2/5`, date of last miss.
- Tap → free practice of that card; after reveal the line is outlined as trudna.
- Empty state: **Brak trudnych odzywek — tak trzymaj.**

### 7.7 Mój panel
Follow BridgeLoop `UserPanel`: tiles (dni z rzędu, śr. dziennie, rozwiązanych łącznie, opanowanych); Dzisiejsza sesja (retries / reviews / new + start); Ustawienia nauki (daily target slider, mode, tryb na czas); Plan powtórek na kolejne dni; Historia (label = category · compact auction, action **Ćwicz**); **Postęp w kategoriach** (new: per category seen / total and mastered); Strefa resetu.

### 7.8 Zgłoś błąd
Modal with a textarea (max 1,000 characters) → `card_reports` with a label snapshot (category · compact auction). Confirmation toast.

### 7.9 Admin
- **Użytkownicy**: as BridgeLoop (approve, admin flag, delete via edge function).
- **Zgłoszenia**: as BridgeLoop deal reports; a report opens the card editor.
- **Karty**: filter by category, status (draft / active / archived) and review flag; text search in auction and meanings. Editor: auction (calls, sides, alternatives, qualifiers), context, auction note, notes, lines (add, remove, reorder, edit label / bids / meaning), status; shows the source page image when available. Saving asks **Zmiana merytoryczna** or **kosmetyczna** (6.7). Drafts have **Zatwierdź**.
- **Importy**: list of runs. Run detail: summary counts; tabs added / changed / removed / unchanged; a changed card shows old vs new per line; every change has a **kosmetyczna** toggle; flagged cards show their flags, verification note and page image; a removed card can be linked to an added one (**to ta sama pozycja**, keeps the card id and progress; optional in v1); **Zastosuj** applies the run in one transaction (10.3); **Odrzuć** discards it.
- **Kategorie**: rename, group, order, edit Notatki.

## 8. Search by auction (v1, expect a redesign)

Goal: find what the notes say about an auction that may include opponents' calls. The notes mostly document one side's bidding and usually one round of opponents' action, so many real auctions are simply not in them. The search must say so plainly and show the closest documented positions.

### 8.1 Input
- Bidding box: levels 1–7 × ♣ ♦ ♥ ♠ NT, plus **pas**, **ktr**, **rktr**; **Cofnij**, **Wyczyść**.
- Side toggle above the box: **My | Oni**, default **My**. After an **Oni** call it returns to **My**. Uncontested sequences therefore need no toggling; one opponents' call is one extra tap.
- An auction strip shows the entered calls, opponents' calls in parentheses.
- The query is normalized with the rules in 5.1, so `1♣ 1♦ 1♥` equals `1♣ (pas) 1♦ (pas) 1♥`.
- Results update after every tap.

### 8.2 Results, in groups, in this order
1. **Znaczenie ostatniej odzywki**: only when the last entered call is ours. Cards whose auction matches the query without its last call; the line whose `bids` contain that call is highlighted.
2. **Co dalej**: cards whose auction equals the query (with an implicit opponents' pass appended when the last call is ours).
3. **Dalsze sekwencje**: cards whose auction starts with the query, shortest first, at most 20.

Each result shows category, section, compact auction, context and qualifiers, and the actions **Czytaj** / **Ćwicz**.

### 8.3 Matching
- Call by call: same side, and the query token is in the card call's `alts`.
- Card token `*` matches any bid (not P, X or XX). `1*` matches any bid at that level.
- Exact beats wildcard: a wildcard card is listed only if no sibling card matches that call exactly.
- Qualifiers and context never filter. Cards that differ only by them are all listed, each with its label.
- Implicit and explicit passes are equal.

### 8.4 When nothing matches
1. If the query starts with passes, retry without them and label the results **bez pasów na początku**.
2. Otherwise show the **longest documented prefix**: the deepest card matching a prefix of the query, with **Notatki kończą się tutaj — dalszej sekwencji nie ma w systemie**.
3. Otherwise **Brak tej sekwencji w notatkach.**

Never substitute an uncontested position for a contested query: showing a meaning that may not apply is worse than showing nothing.

### 8.5 Implementation constraints
- All logic in `src/lib/auction/` (normalize, display, match, index) as pure functions with Vitest tests on **invented** fixtures.
- Build an in-memory index of active cards after load (e.g. a trie over canonical call tokens). Search over 1,000 cards must take under 50 ms on a phone.
- Known limitations, stated in a short help text on the search screen: no following of cross-references (`jak w sekwencji …`), no "system on" analogies, no seat or vulnerability inference.

## 9. Data pipeline: import, verification, revisions

### 9.1 Tooling
- `tools/importer/`: Python ≥ 3.12 in a venv (`tools/importer/.venv`), **PyMuPDF** for words with coordinates and for rendering pages. No other heavy dependencies. The venv already exists (Python 3.14, PyMuPDF 1.28.2); word coordinates and page rendering were verified on `OTW_1T_rev2025.pdf` page 2.
- Output in `data/` (gitignored, disposable): `data/parsed/<slug>.json`, `data/pages/<slug>/p<NNN>.png`, `data/review/<slug>.html`, `data/proposals/<slug>.json`.
- Secrets in `.env.import` (gitignored): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Commit `.env.import.example` without values.
- Commands:
  - `python -m tools.importer parse "sys files/OTW_1T_rev2025.pdf"` → parsed JSON, page images, review HTML, stats.
  - `python -m tools.importer parse-all` → all files + summary table (cards, lines, flags per category).
  - `python -m tools.importer propose <slug>` → diff against the raw snapshot of the last applied run in Supabase (empty on first import) → `data/proposals/<slug>.json`.
  - `python -m tools.importer upload <slug>` → pending `import_runs` row + page images of flagged / changed cards into the private bucket.

### 9.2 Parse output
Per file: category meta, prose sections (notes), raw cards (5.2 shape without `id` and `status`) with `reviewFlags`, and `stats`.

### 9.3 Parser rules
1. Extract words with bounding boxes per page. Remove the running header (repeated text line at the top of each page) and the page number (lone number at the bottom).
2. Classify blocks: title; prose header (`OPIS`, `UWAGI OGÓLNE`); section header (`LICYTACJA`, `DALSZA LICYTACJA`, `KONTYNUACJA`, `KONTRA NA`, `LICYTACJA PO INTERWENCJI`); summary header (`ZESTAWIENIE`); stub rows; call lines; notes (`UWAGA` and other prose inside a section).
3. A call line starts at a row whose label cell holds a call (single, alternatives, or `pas/x` style) followed by a separator and text. Following rows without a label, at the meaning column, belong to that line: either wrapped text or another meaning of the same call (common: one call with several meaning rows). They are joined with `\n` and graded as one line.
4. Pair labels and meaning rows by **word y-position**, never by plain-text order. A label with no meaning text on its row, or meaning rows before the first label of a block → `line_count_mismatch`.
5. Stub rows: decide 2-column vs 4-column layout from the x-positions of the cells and from the section context. Sides: 2-column → both ours; 4-column → alternate by column index, starting from the side of the first filled column. Parentheses confirm the side but don't decide it. Unclear → `ambiguous_layout`.
6. A stub that restates the section header's auction and continues on the next rows is one auction. A stub that starts mid-auction, or is only `?`, is resolved relative to the section header → `relative_stub`.
7. Qualifiers: words after the last call of a header (`NATURALNE`, `TRANSFER`, `NAT`, `T/O`, `5+♦`, `4+♠`, `<4♠`, `FIT ♦`) → qualifier of that call. `<call> = text` → qualifier of the matching opponents' call, otherwise auction note. Guesses → `qualifier_guess`.
8. Context: text after `?` on the stub row (`TYLKO PRZED PARTIĄ`) → card context.
9. Summary blocks: `ZESTAWIENIE PIERWSZYCH ODPOWIEDZI` → root card of the nearest opening title or `X - ?` stub (`OTWARCIE 3♦` → `3D (P)`); `ZESTAWIENIE ODPOWIEDZI PO (1♥) – 2♥` → auction from the header.
10. Call lines under a prose header (`OPIS INTERWENCJI – KONTRA WYWOŁAWCZA PO 1♦`) → card with a best-guess auction and `auction_from_header`.
11. **No call line may be dropped silently.** Lines that can't be attached become a card with `unknown_auction`.
12. `sortOrder` = order of appearance.

### 9.4 Review flags
Any flag makes the card a draft unless the verifier clears it:
`line_count_mismatch`, `ambiguous_layout`, `relative_stub`, `auction_from_header`, `unknown_auction`, `duplicate_key`, `wrapped_line`, `unknown_token`, `empty_meaning`, `suspicious_length` (1 line or more than 30), `qualifier_guess`, `verifier_uncertain`.

### 9.5 Verification pass (agent procedure)
For each category:
1. Open the page images, or `data/review/<slug>.html`, which shows each page image next to the cards parsed from it.
2. For every card compare with the page: auction (calls, sides, alternatives, qualifiers, context), line labels, meanings (verbatim, every variant), notes, and that no line on the page is missing.
3. Fix mistakes in the proposal. Set `verification = 'ok'` (flags cleared) or keep / add flags with a short `verificationNote`.
4. Anything uncertain stays flagged (`verifier_uncertain`).

If the agent cannot view images: skip steps 1–3; every card with any flag stays a draft and the admin reviews it in the app.
The verifier checks that the card matches the PDF, not whether the system itself is right.

### 9.6 Import runs and revisions
- Every upload creates `import_runs` with `status = 'pending'`, holding:
  - `raw_snapshot`: the parser output for this PDF **before** verification fixes;
  - `proposal`: per card `added`, `changed`, `removed` or `unchanged`; the proposed card after verification fixes; per-line change markers; flags; verification note; page image paths.
- Diff = new raw parse vs the `raw_snapshot` of the **last applied** run of this category, matched by `card_key`, then by line `key`. Comparing raw with raw makes extraction errors present in both versions cancel out, so corrections stored in the database survive.
- Changed card: lines unchanged in the raw parse keep the database text; changed and added lines take the verified new text; removed lines are removed.
- First import of a category: everything is `added`.
- **Apply** (admin in the app, one transaction, RPC `apply_import_run`):
  - added → insert; `active` if verified with no flags, else `draft`;
  - changed → update lines; substantive unless toggled cosmetic; progress effects per 6.7;
  - removed → `archived`;
  - removed linked to added → update the old card in place (same id);
  - category `revision`, `source_file` and Notatki updated; run `status = 'applied'`, `applied_at`, `applied_by`.
- **Discard** → `status = 'discarded'`.

## 10. Backend (Supabase)

A new Supabase project (region Frankfurt, Free plan). Setup guide `docs/BACKEND_SETUP.md`, adapted from BridgeLoop's. Migrations in `supabase/migrations/`: idempotent SQL, one file per change, run in the SQL Editor.

### 10.1 Tables
- **profiles**: as BridgeLoop (0001 + 0002_timed_mode + 0011): `id` (auth uid), `username`, `is_admin`, `status` (pending or approved), `daily_target` (default 20, 1–100), `mode`, `timed_mode` (default false), `created_at`. Signup trigger as BridgeLoop.
- **categories**: `slug` (pk), `name`, `group_name`, `sort_order`, `source_file`, `revision`, `notes` jsonb, `updated_at`.
- **cards**: `id` uuid (pk), `category_slug` (fk), `card_key` (unique), `section`, `sort_order`, `auction` jsonb, `auction_key`, `context`, `auction_note`, `notes` jsonb, `lines` jsonb, `status` (draft, active, archived), `review_flags` jsonb, `verification_note`, `source_page`, `source_revision`, `created_at`, `updated_at`.
- **srs_progress**: as BridgeLoop with `card_id` uuid (fk, cascade): `status`, `consecutive_correct` (0–5), `interval`, `next_review_date` date, `last_seen`, `flag_difficult`; pk (`user_id`, `card_id`).
- **attempts**: `id`, `user_id`, `card_id` (no fk, survives card deletion), `correct`, `phase` (main, buffer, free), `missed_line_keys` text[] (nullable), `timed_out` bool, `line_count` int, `ts`. Indexes (`user_id`, `ts desc`) and (`user_id`, `card_id`, `ts desc`).
- **daily_sessions**: as BridgeLoop 0010, slots `[{ cardId, kind }]`, `buffer` = card ids.
- **card_reports**: as BridgeLoop `deal_reports` (0008 + 0009) with `card_id` and `card_label`.
- **import_runs**: `id` uuid (pk), `category_slug`, `source_file`, `revision`, `status` (pending, applied, discarded), `raw_snapshot` jsonb, `proposal` jsonb, `summary` jsonb, `created_at`, `applied_at`, `applied_by`.
- Storage bucket **review-pages** (private): `<run_id>/p<NNN>.png`.

### 10.2 Row level security
Use BridgeLoop's security-definer helpers `is_admin(uid)` and `is_approved(uid)`.

| Table | Read | Write |
|---|---|---|
| profiles | own row, or admin | admin updates / deletes; insert by signup trigger; settings only via `update_my_settings` |
| categories | approved or admin | admin |
| cards | approved users: `status = 'active'` only; admin: all | admin |
| srs_progress, attempts, daily_sessions | own rows while approved | own rows while approved; own delete always |
| card_reports | admin | insert own while approved; admin update / delete |
| import_runs | admin | status changes via RPC; insert by service role |
| storage review-pages | admin | service role |

Grant table privileges to `authenticated` explicitly for every table (BridgeLoop lesson: RLS alone ends in "permission denied for table").

### 10.3 RPCs (security definer, admin check inside where relevant)
- `update_my_settings(p_daily_target int, p_mode text, p_timed_mode boolean)`: as BridgeLoop.
- `admin_save_card(p_card jsonb, p_substantive boolean, p_revision text)`: update a card; when substantive, stamp changed lines and pull due dates forward for all users (6.7).
- `apply_import_run(p_run_id uuid, p_decisions jsonb)`: 9.6 in a single transaction. `p_decisions` per card key: `{ cosmetic?, linkTo?, approve?, skip? }`.
- Optional `my_line_stats()` for Trudne odzywki; client-side aggregation of the user's attempts is acceptable for a small group.

### 10.4 Edge function
`delete-user`: copy from BridgeLoop.

## 11. Frontend

### 11.1 Stack
Same as BridgeLoop: Vite 8, React 19, TypeScript ~6.0, Tailwind CSS 3, `@supabase/supabase-js` 2, `vite-plugin-pwa`, ESLint. Add **Vitest** for `src/lib`. Dev server port **5175** (BridgeLoop uses 5174).

### 11.2 Reuse from BridgeLoop
Source: `D:\claude bridge rozdania\bridge-trainer` (**read-only**). Copy and adapt (deal → card):

| BridgeLoop | Use |
|---|---|
| `src/lib/srs.ts`, `src/lib/date.ts`, `src/hooks/useDayKey.ts` | as is (ids renamed) |
| `src/lib/session.ts`, `src/hooks/useDailySession.ts` | deals → cards |
| `src/hooks/useSRS.ts`, `src/hooks/useHistory.ts`, `src/hooks/useSettings.ts` | card ids; attempts carry missed lines, timeout, line count |
| `src/hooks/useDealTimer.ts`, `src/components/DealTimer.tsx` | per-line limit (6.3) |
| `src/auth/*`, `src/lib/supabase.ts`, `src/lib/database.types.ts` | new tables |
| `src/components/UserPanel.tsx`, `SessionBar.tsx`, `InstallPrompt.tsx`, `src/hooks/useInstallPrompt.ts` | new texts and stats |
| `src/admin/AdminPanel.tsx`, `UsersAdmin.tsx`, `ReportsAdmin.tsx`, `src/hooks/useUsers.ts`, `src/hooks/useDealReports.ts` | cards |
| `src/components/SuitIcon.tsx`, `src/components/Icon.tsx`, `src/lib/suitColors.ts` | as is |
| `src/dev/*Preview.tsx` pattern (`?preview=…`) | UI harness on invented fixtures |
| migrations `0001`, `0002_timed_mode`, `0008`, `0009`, `0010`, `0011`; `supabase/functions/delete-user` | merged into the new migrations |
| `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`, `tsconfig*.json`, `index.html`, `.env.example`, `.github/workflows/deploy.yml` | new name, base path, manifest |

Do **not** copy: table / hand / trick / contract components, deal builder, deal search, dedup, tags, sources, `imports/`, `scripts/`, `src/data/dealsMock.json`, BridgeLoop logo and icons.

### 11.3 Structure
```
src/
  lib/auction/   normalize.ts  display.ts  match.ts  index.ts  (+ *.test.ts)
  lib/           srs.ts  session.ts  date.ts  timer.ts  lineStats.ts  supabase.ts  database.types.ts
  hooks/         useCards  useCategories  useSRS  useDailySession  useHistory  useSettings
                 useDayKey  useCardTimer  useReports  useUsers  useImportRuns
  components/    card/ (CardView, LineRow, UwagiBlock)  AuctionView  BiddingBox  sidebar/
                 SearchPanel  ReadView  NotesView  HardLines  UserPanel  SessionBar  ReportCardButton
  admin/         AdminPanel  UsersAdmin  ReportsAdmin  CardsAdmin  CardEditor  ImportsAdmin  CategoriesAdmin
  auth/
  dev/           preview harness + invented fixtures
tools/importer/  __main__.py  parse.py  layout.py  auction.py  diff.py  upload.py  review_html.py
                 categories.json  tests/
supabase/        migrations/  functions/delete-user/
docs/            SPEC.md  BACKEND_SETUP.md
data/            (gitignored)
sys files/       (gitignored)
```

### 11.4 Deploy
GitHub Actions → GitHub Pages, as BridgeLoop (secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Vite `base` depends on the chosen URL (section 16). PWA manifest with the new name and icons; the service worker never caches Supabase responses (BridgeLoop `vite.config.ts` pattern).

## 12. Visual direction

- Family resemblance with BridgeLoop, not a copy. Brand tokens: `bg #0b1220`, `panel #131c2e`, `soft #1b2740`, `line rgba(255,255,255,.09)`, `text #e8edf5`, `dim #8a97ad`, `accent #10b981`, `accent-soft #34d399`, `accent-2 #fbbf24`, `danger #e0524d`. Fonts: Space Grotesk (display, call labels), Manrope (UI and meanings), IBM Plex Mono (section headers, counters). 4-colour suits on panels: ♠ `#5b9be8`, ♥ `#e0524d`, ♦ `#df8a2e`, ♣ `#36ad63`.
- No green felt: this app is about text. Cards are panels.
- Card layout: label column (Space Grotesk, about 64 px wide, coloured suits) + meaning column (Manrope 15 px, line-height 1.45). Blank meanings are soft rounded bars of equal height. Missed line: red left border + ✗. Changed line: amber chip.
- Auction: opponents' calls dimmed and in parentheses; qualifiers as small chips under their calls.
- Touch targets at least 44 px; on mobile the primary action sits fixed at the bottom.
- Section headers in IBM Plex Mono uppercase, verbatim from the notes.
- Name **SysLoop**. Wordmark in the BridgeLoop lockup style: `Sys` in the text colour + `Loop` in accent-soft (Space Grotesk 700). Icons are placeholders until designed.

## 13. Privacy and security rules

1. Never commit `sys files/`, `data/`, `.env*` (except the `.example` files), page images or parse output. Set `.gitignore` before the first commit.
2. No system content (meanings, notes, real card auctions, page images) in the frontend bundle, `public/`, test fixtures, commit messages or logs. Tests use invented content.
3. The service role key lives only in `.env.import` on the local machine; never in `VITE_*` variables or frontend code.
4. Content is fetched only after login and approval (RLS). After a production build, search `dist/` for a known meaning string: it must not be found.
5. Page images are admin-only.
6. The repo may be public (like BridgeLoop) only because rules 1–5 hold.
7. Documentation follows the same rule: this spec shows the notes' **notation** (auctions, headers, qualifiers) but never real **meanings**. Use `…` or invented text when writing examples.

## 14. Out of scope for v1 / later

- **Przed turniejem**: drill a whole category without affecting the schedule.
- Search redesign: following cross-references, "system on" analogies, seat and vulnerability handling.
- PDF upload inside the app (the importer stays a local tool).
- Offline drilling.
- English UI.
- Rejected during design: category focus filters, tree-ordered new cards, weighting cards by size, a "Prawie" grade.

## 15. Acceptance criteria (v1)

1. `parse-all` runs on all 14 PDFs; the summary lists cards, lines and flags per category; no call line is lost (every call line on every page is in a card or reported).
2. After verification and apply, every card is `active`, or `draft` with at least one flag or note; drafts are invisible to non-admins.
3. A pending user sees no content; an approved user sees active cards; `dist/` contains no system content.
4. Session: the queue follows 6.5 (unit tests); SRS transitions follow 6.4 (unit tests); buffer pass works; reload resumes; midnight resets the queue.
5. Grading: any missed line = fail; missed keys stored; timeout = fail with null keys; the timer formula matches 6.3 (unit tests).
6. Free practice updates SRS with anti-gaming (repeats in one visit never stack; Powtórz reverts a pass).
7. Read mode › / ‹ navigation works on uncontested and contested positions.
8. Search: unit tests cover every row of the 5.1 table, implicit passes, alternatives, wildcards, qualifiers, the three result groups and the fallbacks in 8.4; a manual check with at least 10 real auctions including opponents' calls.
9. Trudne odzywki follows 7.6 (unit tests for the aggregation).
10. Admin: approve users, handle reports, edit a card (cosmetic vs substantive effects checked on a test user), review and apply an import run containing a changed and a removed card.
11. Usable at 375 × 812 and on desktop; the PWA installs; `npm run lint`, `npm run build`, `npm test` and the importer tests pass.

## 16. Open items (need the owner)

Decided: name **SysLoop**; builder **Codex**; PyMuPDF installed in `tools/importer/.venv`.

Still open:
1. **URL**: `redds212.github.io/<repo>/` or a subdomain such as `sys.bridgeloop.pl` (needs a DNS CNAME record). Decides Vite `base`.
2. **Supabase**: the owner creates the new project and puts the keys into `.env.local` (URL, anon key) and `.env.import` (service role key).
3. **GitHub**: creating the repo, pushing and deploying only with the owner's go.
4. **Icons / wordmark design**: placeholders until then.
