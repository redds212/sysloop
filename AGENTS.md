# AGENTS.md — SysLoop

You are building **SysLoop**: a spaced-repetition trainer for a bridge partnership's bidding-system notes.

**Read `docs/SPEC.md` completely before writing any code.** The spec is the source of truth. If this file and the spec disagree, the spec wins. If the spec is ambiguous, contradictory or looks wrong, stop and ask the owner. Don't guess on anything that affects scheduling, grading, privacy or the data pipeline.

## Environment

- Windows 11. Work **locally** in this folder (`D:\claude system`). The source PDFs in `sys files/` are private and will never be in git, so a cloud sandbox cannot build or run the importer.
- **Paths contain spaces** (`D:\claude system`, `sys files/`, `D:\claude bridge rozdania`). Quote them in every command.
- Available: Node 24 / npm 11, Git, GitHub CLI, Python 3.14.
- The importer venv **already exists**: `tools/importer/.venv` (Python 3.14, PyMuPDF 1.28.2; word coordinates and page rendering verified). Use `tools/importer/.venv/Scripts/python.exe`. You may `pip install` more packages into it (e.g. pytest).
- This folder is not a git repository yet. Run `git init` in M0, with no remote.
- **Reference implementation: BridgeLoop** at `D:\claude bridge rozdania\bridge-trainer` (the owner's app, same stack). **Read-only.** Never modify it, commit to it, or run its migrations. Copy files from it as listed in SPEC §11.2.

## Hard rules

1. **Privacy (SPEC §13).** System content (meanings, notes, auctions of real cards, page images, parse output) must never reach git, `public/`, the JS bundle, test fixtures, commit messages or logs. Create `.gitignore` **before the first commit**. It must cover `sys files/`, `data/`, `.env*` (but keep `.env.example` and `.env.import.example`), `tools/importer/.venv/`, `node_modules/` and `dist/`.
2. Tests and dev fixtures use **invented** auctions and meanings only.
3. The Supabase **service role key** lives only in `.env.import`. Never put it in frontend code or `VITE_*` variables.
4. **Ask the owner first** before you: create a GitHub repo, add a remote, push, deploy, run SQL or migrations against their Supabase project, upload import runs, or install anything globally. Local `npm install` and `pip install` into the project venv are fine.
5. Don't touch BridgeLoop (see Environment).
6. UI copy in **Polish**. Code identifiers in English. Comments may be in Polish, as in BridgeLoop; stay consistent within a file.
7. Follow the spec's numbers exactly: intervals, timer formula, queue order, thresholds, flags.

## Milestones

Work in this order. At each ✋, stop, report, and wait for the owner.

**M0 — Scaffold.** Create the Vite + React + TypeScript + Tailwind app from BridgeLoop's configs (SPEC §11). Dev port 5175. Strip everything deal-specific. Add Vitest. Set up `.gitignore` per the hard rules. `npm run lint`, `npm run build` and `npm test` pass. Run `git init` (no remote).

**M1 — Database.** Write migrations for SPEC §10: tables, RLS, grants, RPCs, storage bucket, signup trigger, and the `delete-user` edge function. Write `docs/BACKEND_SETUP.md` adapted from BridgeLoop's `docs/BACKEND_SETUP.md`.
✋ The owner creates the Supabase project, runs the migrations, fills `.env.local` and `.env.import`, and makes themselves admin. **Don't wait for this:** the owner does it in parallel, and M2 and M3 don't need the database. Never run SQL yourself.

**M2 — Domain logic with tests.** Build `src/lib/auction/*` (normalize, display, match, index; SPEC §5.1 and §8), `srs.ts` (§6.4), `session.ts` (§6.5), the timer limit (§6.3), line statistics (§7.6), and the progress-effect rules (§6.7, mirrored in SQL). Write unit tests for every rule, and one test per row of every example table in the spec.

**M3 — Importer: parse.** Build `tools/importer` `parse` / `parse-all` with PyMuPDF (SPEC §9.1–9.4), page images, the review HTML and the stats. Importer unit tests use synthetic layouts. Run `parse-all` and report cards, lines and flags per category, plus any call lines that couldn't be attached.
✋ The owner looks at the stats.

**M4 — App core.** Build auth, shell, sidebar tree, card screen (front / reveal / mark missed lines / rate), timer, daily session with buffer and resume, free practice with anti-gaming, read mode with › / ‹ navigation, Notatki, and Zgłoś błąd (SPEC §6, §7.1–7.4, §7.8). Develop the UI against the `src/dev` preview harness with invented fixtures; the real data path reads from Supabase.

**M5 — Admin.** Build Użytkownicy, Zgłoszenia, Karty with the card editor (cosmetic vs substantive), Importy (run review and apply), and Kategorie (SPEC §7.9, §9.6, §10.3).

**M6 — Real data.** Run the verification pass (SPEC §9.5) category by category, then `propose`.
✋ Ask before `upload`. The owner applies the runs in the app and approves drafts.

**M7 — Search and Trudne odzywki.** Build search by auction (SPEC §8) and Trudne odzywki (§7.6). Check search manually against at least 10 real auctions that include opponents' calls, and report the results.

**M8 — Finish.** Build Mój panel (§7.7), the PWA manifest and placeholder icons, and do a responsive pass at 375 × 812 and on desktop. Prepare the deploy workflow without running it. Check `dist/` for leaked content (§13 rule 4). Go through the acceptance criteria (§15) one by one.
✋ The owner decides on the name, URL, repo and deploy.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server on http://localhost:5175 |
| `npm run build` | type-check and production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `python -m tools.importer parse "sys files/<file>.pdf"` | parse one PDF |
| `python -m tools.importer parse-all` | parse all PDFs and print a summary |
| `python -m tools.importer propose <slug>` | build the diff proposal |
| `python -m tools.importer upload <slug>` | upload a pending import run (**ask first**) |
| `python -m pytest tools/importer/tests` | importer tests |

`python` above means the importer venv, run from the project root: `& "tools/importer/.venv/Scripts/python.exe" -m tools.importer parse-all` (PowerShell).

## Conventions (inherited from BridgeLoop)

- Dates are local-day keys `YYYY-MM-DD`. Never schedule in UTC days.
- Persist write-through: every answer goes to Supabase when it is given.
- `md` is the only responsive breakpoint: `(min-width: 768px) and (min-height: 500px)`.
- SQL migrations are idempotent, one file per change, with explicit grants.
- Keep search logic isolated in `src/lib/auction/`. The owner expects to redesign search later.

## Reporting

At every milestone, report:
- what was built, and the main files
- test, lint and build results
- any deviation from the spec, with the reason
- open questions for the owner

Report failures as failures, with the output.
