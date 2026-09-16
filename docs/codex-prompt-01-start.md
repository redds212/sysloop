You are starting the build of **SysLoop**, a spaced-repetition trainer for my bridge partnership's bidding-system notes.

## First
Read both files completely before you run or write anything:
1. `AGENTS.md`: rules, milestones, commands
2. `docs/SPEC.md`: the full specification and the source of truth

## Facts for this run
- Work locally in `D:\claude system`. Paths contain spaces (`D:\claude system`, `sys files`, `D:\claude bridge rozdania`), so quote them in every command.
- The name is final: **SysLoop**. Use `sysloop` as the npm package name, "SysLoop" in the page title and PWA manifest (placeholder icons are fine), and the wordmark `Sys` + `Loop` styled like BridgeLoop's lockup (SPEC §12).
- The importer venv already exists: `tools/importer/.venv` (Python 3.14, PyMuPDF 1.28.2). Word coordinates and page rendering have been checked on `OTW_1T_rev2025.pdf`. You may `pip install` more packages into it (e.g. pytest).
- Reference code: BridgeLoop in `D:\claude bridge rozdania\bridge-trainer`. Read-only: copy from it, never change it.
- No Supabase project exists yet. I'll create it while you work.
- If your sandbox blocks network access for `npm install` or `pip install`, ask me to approve it.

## Scope: milestones M0–M3, then stop
- **M0:** create `.gitignore` before anything else, then scaffold. `git init` with no remote. Make a local commit at the end of each milestone; commit messages must not contain system content.
- **M1:** write the migrations, the `delete-user` edge function and `docs/BACKEND_SETUP.md`. **Don't run any SQL and don't connect to Supabase.** Don't wait at the M1 stop point; go on to M2.
- **M2:** domain logic with unit tests, including one test for every row of the example tables in the spec.
- **M3:** importer `parse` and `parse-all`, page images, review HTML and stats. Run `parse-all` on all 14 PDFs.
- **Do not start M4.**

## Easy to get wrong (all in the spec)
- A row with no call label under a labelled row is **another meaning of that call**, not a missing label. For example, `1♠` in the 1♣ first-responses summary has four meaning rows. Pair labels and meanings by word y-position, never by plain-text order.
- In the opening files, opponents' calls in 4-column stubs often have **no parentheses**: `2♥ - ktr - ? -` means 2♥ (X) ?. The side comes from the column position.
- `?` is always our call. Insert implicit opponents' passes exactly as SPEC §5.1 says.
- The same auction with a different qualifier (`(KTR) T/O` vs `(KTR) 5+♦`) or context (`TYLKO PRZED PARTIĄ`) is a different card.
- **Never drop a call line silently.** Lines you can't attach become `unknown_auction` cards and are counted in the summary.
- Everything in `data/` stays local and gitignored. Tests use invented auctions and meanings.

## Final report (then stop and wait for me)
1. What you built in each milestone, with the main files.
2. Results of `npm run lint`, `npm run build`, `npm test` and the importer tests. Report failures as failures, with their output.
3. The `parse-all` summary, one row per category: cards, lines, flagged cards, count per flag type, unattached lines.
4. For the 3 most common flag types, a few examples each, given as file + page + compact auction (no meanings needed).
5. A short checklist of the Supabase setup I need to do (from `docs/BACKEND_SETUP.md`).
6. Anything in the spec that looked wrong or ambiguous, and every deviation from it with the reason.
