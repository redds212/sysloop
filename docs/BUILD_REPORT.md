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

## Uzgodnienia oczekujące

- Strefa daty „jutro” dla zmian merytorycznych wykonywanych w SQL.
