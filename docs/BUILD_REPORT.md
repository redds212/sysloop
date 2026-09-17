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

## M2

- Skopiowano `date.ts`, `srs.ts`, `session.ts` z BridgeLoop; kolejka filtruje aktywne
  karty i przyjmuje zbiór wcześniej próbowanych kart.
- Dodano normalizację, klucze, wyświetlanie, dopasowanie i indeks wyszukiwania w `src/lib/auction/`.
- Dodano czyste funkcje stanów sesji, bufora i swobodnych powtórek (`sessionState.ts`).
- Timer, ścisłe ocenianie, statystyki wierszy oraz skutki zmian treści są testowane osobno.
- Vitest: 103/103, w tym odpowiednik każdego wiersza tabeli §5.1 na wymyślonych danych.
- Test indeksu 1000 kart przechodzi limit 50 ms na tym komputerze; telefon wymaga późniejszej kontroli.
- Hooki UI i zapis sieciowy pozostają w M4 zgodnie z zakresem. M4 nie rozpoczęto.

## Dodatkowe problemy środowiska

- Pierwszy zapis indeksu Git: `Unable to create .git/index.lock: Permission denied`.
  Ponowiono z uprawnieniem do lokalnego zapisu Git.
- Pierwszy commit: `Author identity unknown`. Użyto dla tego commita istniejącej
  tożsamości autora z konfiguracji BridgeLoop, bez zmiany konfiguracji globalnej.
- Commit M0: `a0da07f`. Brak remote.

## M3 — ukończone

- Importer `parse` i `parse-all` w `tools/importer/`: współrzędne słów,
  kolumny i strony licytacji, wielowierszowe znaczenia, kontekst i kwalifikatory,
  flagi, lokalne JSON-y, obrazy każdej strony i HTML do przeglądu.
- Niezależny audyt kandydatów odzywek, odnośniki do wierszy źródłowych oraz bilans
  wierszy. Nieustalone odzywki pozostają w kartach `unknown_auction`.
- Wszystkie 14 PDF-ów przetworzono: 764 karty, 5517 odzywek, 199 kart z flagami,
  43 odzywki bez pewnego przypisania. Bilans wykrytych odzywek: 0 nierozliczonych.
- Powstały 324 obrazy stron i 14 par JSON/HTML. Sprawdzono liczbę kart w HTML,
  odnośniki do wszystkich obrazów oraz bilans wierszy i odzywek w JSON.
- Wyniki szczegółowe i przykłady są wyłącznie lokalnie w `data/M3_REPORT.md`,
  `data/parse-summary.json` i `data/review/`; nie należą do tego commita.
- Najczęstsze flagi: `auction_from_header` 83, `unknown_token` 41, `relative_stub` 40.
- Automatyczne dopasowanie dłuższych znaczeń z wyników importu do gotowego `dist/`
  nie znalazło wycieku (0 dopasowań). To kontrola pomocnicza, nie formalny dowód.

## Końcowa walidacja (17 września 2026)

| Polecenie | Wynik |
|---|---|
| `npm run lint` | PASS, kod 0 |
| `npm run build` | PASS, kod 0; TypeScript + Vite + PWA |
| `npm test` | PASS, `Test Files 3 passed (3)`, `Tests 103 passed (103)` |
| importer: `python -m pytest tools/importer/tests -q --tb=short` | PASS, `45 passed in 0.11s` |
| importer: `parse-all` | PASS, wszystkie 14 kategorii |

SQL i Edge Function nie były uruchamiane ani sprawdzane na żywym Supabase.
Pełna weryfikacja każdej karty względem PDF należy do M6, po przeglądzie statystyk.
Automatyczny przegląd bezpieczeństwa odrzucił otwarcie prywatnego HTML przez
łącznik przeglądarki ze względu na udostępnienie prywatnej treści. Nie ponawiano
tej czynności inną drogą. Kontrola HTML była strukturalna; wygląd w przeglądarce
pozostaje niesprawdzony. Wybrane źródłowe obrazy stron obejrzano lokalnie.

## Wcześniejsze nieudane kontrole — naprawione, nie zaliczone jako sukces

Poniżej istotne fragmenty komunikatów; końcowe wyniki powyżej po poprawkach:

- Instalacja pytest w ograniczonym środowisku: `No matching distribution found for pytest`.
  Instalacja w istniejącym venv z zatwierdzonym dostępem powiodła się.
- Pierwszy pytest: `34 passed, 1 error`, `PermissionError` przy katalogu tymczasowym.
  Powtórzenie z uprawnieniem do lokalnych testów przeszło.
- Test geometrii pustego miejsca: `1 failed, 37 passed`; poprawiono współrzędne
  syntetycznej próbki tak, aby reprezentowała testowany układ.
- Pierwsza wersja audytu: `NameError: name 'rows' is not defined`, `15 failed, 29 passed`;
  również parse-all zakończył się błędem. Przeniesiono audyt do właściwej metody.
- Test bilansu: `1 failed, 43 passed`; poprawiono powtórzone identyfikatory wierszy
  w syntetycznej próbce i dodano walidację źródeł.
- Lint: `EPERM: operation not permitted, scandir` dla `.pytest_cache`;
  wyłączono katalogi cache testów z ESLint i Git.
- Przejściowe odrzucenie uruchomienia testów z powodu limitu użycia; późniejsza
  końcowa kontrola wszystkich 45 testów przeszła.

## Uzgodnienia, ograniczenia i odstępstwa

- Zatwierdzone `present_line_keys` rozszerza schemat prób ze specyfikacji, aby
  poprawnie liczyć historię dodawanych, usuwanych i przywracanych odzywek.
- Europe/Warsaw rozstrzyga strefę daty w SQL. Klient zachowuje lokalne klucze dni
  zgodnie ze specyfikacją; nie używa dni UTC.
- Manifest i ikona powstały już w M0 na wyraźne życzenie właściciela, mimo ich
  umieszczenia również w M8. Nazwa jest ostateczna.
- Jawny kontrakt przyszłych propozycji importu opisano w `docs/IMPORT_CONTRACT.md`.
  Polecenia propose/upload pozostają w M6 i nie są częścią tego wykonania.
- Nieobsługiwane etykiety pozostają z `unknown_token`; gęste macierze bez pewnej
  licytacji pozostają do weryfikacji z obrazem i zachowanymi wierszami źródła.
- Nie wykonano przeglądarkowej kontroli wyglądu HTML (odrzucenie opisane wyżej)
  ani pomiaru wyszukiwania na telefonie; test wydajności dotyczy tego komputera.
- Commity: M0 `a0da07f`, M1 `e126bc0`, M2 `882a12f`; niniejszy raport należy do M3.
- Brak połączenia z Supabase, wykonania SQL, uploadu, remote, push lub deploy.
  BridgeLoop nie był modyfikowany. M4 nie rozpoczęto. Brak pytań blokujących M0–M3.
