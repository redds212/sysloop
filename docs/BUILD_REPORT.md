# Raport budowy M0–M3

## M0

- Szkielet React/Vite/TypeScript/Tailwind, port 5175, nazwa SysLoop, manifest i tymczasowa ikona.
- Konfiguracje skopiowane i dostosowane z BridgeLoop; projekt źródłowy tylko odczytywany.
- `.gitignore` utworzony przed pozostałymi plikami; repo lokalne bez remote.
- Lint OK, build OK, Vitest 7/7.
- Pierwszy build: TS2591 (`node:fs`) i TS7006 — poprawiono typy Node w konfiguracji.
- Pierwszy install: ENOTCACHED. Pierwszy Vitest: spawn EPERM. Ponowiono z zatwierdzonym dostępem.
- Nie uruchomiono SQL ani nie połączono się z Supabase.
- Zatwierdzone przez właściciela rozszerzenie: `attempts.present_line_keys` dla poprawnych statystyk zmienianych kart.
- Baza URL Vite `/` na potrzeby lokalnej budowy; adres publikacji pozostaje do ustalenia.

## Uzgodnienia

- Europe/Warsaw dla daty „jutro” przy zmianach merytorycznych w SQL — zatwierdzone.

## M1 — ukończone pliki, bez wykonania SQL

- Napisano strukturę tabel, RLS, granty, signup trigger, anonimizację zgłoszeń,
  prywatny bucket, RPC edycji kart i zastosowania/odrzucenia importu.
- Skopiowano `delete-user` bez modyfikowania BridgeLoop.
- Dodano `docs/BACKEND_SETUP.md` oraz `docs/IMPORT_CONTRACT.md`.
- SQL nie został wykonany, a funkcja Edge nie została wdrożona ani uruchomiona.
- Migracja 0004 definiuje `revision_review_day()` w strefie Europe/Warsaw.
- Ponowny lint OK. Build i Vitest: wyniki M0; nowe SQL nie jest nimi walidowane.
- Nie ma oczekujących pytań blokujących M2–M3.

## Dodatkowe problemy środowiska

- Pierwszy zapis indeksu Git: `Unable to create .git/index.lock: Permission denied`.
  Ponowiono z uprawnieniem do lokalnego zapisu Git.
- Pierwszy commit: `Author identity unknown`. Użyto dla tego commita istniejącej
  tożsamości autora z konfiguracji BridgeLoop, bez zmiany konfiguracji globalnej.
- Commit M0: `a0da07f`. Brak remote.
