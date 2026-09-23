# Historia zmian — raport 23 września 2026

## Potwierdzenie produkcji

Właściciel potwierdził wykonanie migracji 0009 dnia 23 września 2026. Frontend commit `44f02e9` opublikowano na https://system.bridgeloop.pl/; GitHub Actions run `35882484833` zakończony sukcesem. Odczyt publicznej strony zwrócił HTTP 200 i nowy pakiet z nagłówkiem System RJ-WG oraz Ostatnio zmienione. Nie wykonano próbnej zmiany rzeczywistych ustaleń na produkcji.

## Gotowe

- `supabase/migrations/0009_revision_history.sql`: transakcyjna historia publikacji, punkt początkowy dla istniejących kart, RLS oraz wersje odzywek w próbach. Merytoryczne i kosmetyczne edycje są rozróżniane. Szkice nie trafiają do historii dostępnej uczestnikom.
- `src/lib/revisions.ts`, `grading.ts`, `supabaseRepository.ts`: NEW zależy od zapisanej oceny konkretnej wersji, także błędnej; częściowe próby obejmują tylko obecne odzywki.
- `src/components/RecentChanges.tsx`, `DifficultCards.tsx`: Ostatnio zmienione, daty warszawskie, historia Przed/Po, pusty stan Przed dla nowości, trening aktualnych pozycji.
- `src/components/card/CardView.tsx`, `HardPractice.tsx`: wpisywanie własnych znaczeń, po odsłonięciu i oznaczeniu błędu także poprzednia treść; brak zmiany SRS w treningu zmian.
- `src/LearningApp.tsx`: nagłówek System RJ-WG.
- Import pozostaje lokalny, wykrywa różnice i wymaga zatwierdzenia w Admin → Importy. Test SQL wykonuje prawdziwy apply_import_run na wymyślonych danych: zachowuje korektę bazy przy zmianie innej linii, zapisuje dodaną i zmienioną kartę, odrzuca ponowne zastosowanie.

## Końcowa weryfikacja

- `npm run lint`: PASS.
- `npm test`: **192 passed**, 18 plików.
- `npm run build`: PASS; ostrzeżenie Vite: `Some chunks are larger than 500 kB after minification`, główny JS 526.40 kB (gzip 150.70 kB).
- Importer pytest: **85 passed**. Uruchomiony w projektowym venv, z nowym katalogiem tymczasowym pod data/ i bez cache pluginu.
- SQL: lokalny PGlite (PostgreSQL w pamięci), fikcyjne dane, bez Supabase. Sprawdzone RLS dla admin/approved/pending/anon, rollback, kosmetyka, szkice, import, poziom SRS i termin warszawski, ponowne wykonanie migracji oraz istniejące karty bez NEW.
- Przeglądarka: lokalny preview, komputer i 375 × 812. Nagłówek, lista dat i Przed/Po, puste Przed przy dodanej linii, domyślne wpisywanie, poprzednie znaczenie dopiero po oznaczeniu błędu. Zapis błędnej oceny i Powtórz usuwają NEW. Brak poziomego przepełnienia (viewport 375, szerokość dokumentu 360). Przywrócono domyślny viewport.
- Prywatność: 1520 znaczeń o długości co najmniej 30 znaków sprawdzono w 9 plikach tekstowych dist, także jako zakodowane stringi JSON: **0 dopasowań**. Prywatne dane pozostają poza git.

## Wcześniejsze nieudane próby

- Przerwane testy z poprzedniej pracy nie zostały wykonane: automatyczna kontrola zgody była niedostępna z powodu limitu użycia. Po wznowieniu kontrola zezwoliła na normalne uruchomienie.
- Pytest w sandboxie: `PermissionError: [WinError 5] Odmowa dostępu`, najpierw katalog pytest w TEMP (68 passed, 17 errors), potem własny basetemp w data/ (błąd także podczas porządkowania). Ponowiono poza sandboxem za zgodą narzędzia: 85 passed. Nie zmieniano kodu importera.
- W poprzedniej części prac build/testy wykryły `TS1005` (brak nawiasu w nowym helperze) oraz błędy `TS2345`/typ `never` w mapowaniu schematu Supabase. Poprawione; końcowy build i testy przechodzą.
- Test kosmetycznej edycji zakładał fixture bez wcześniejszego changedAt. Po dodaniu wersji do fixture poprawiono asercję na zachowanie poprzedniego znacznika; test przechodzi.

## Aktywacja i ograniczenia

Właściciel musi wykonać **0009_revision_history.sql** w Supabase → SQL Editor → New query → Run. Agent nie wykonał SQL na zdalnym projekcie i nie importował nowego prawdziwego PDF-a. Szczegółowe kroki w BACKEND_SETUP.md. Frontend przed migracją pokazuje informację o oczekującej aktywacji historii, dotychczasowa nauka działa.

Nie odtwarzamy starszych treści z surowego parsera. Historia rozpoczyna się od punktu początkowego migracji. Kosmetyka jest zachowana w bazie, ale nie zaśmieca listy treningowej. Zarchiwizowane pozycje nie trafiają do treningu aktualnego systemu. W preview historia jest wymyślona; integrację importu sprawdzono w lokalnym SQL, a nie na produkcji. Brak nowego formularza uploadu PDF w przeglądarce — zgodnie ze SPEC importer pozostaje lokalny.

Rozszerzenia SPEC są zapisane w §6.7. NEW po pierwszej zapisanej ocenie, również błędnej, oraz przegląd/akceptacja importu zostały potwierdzone przez właściciela. Trening stosuje istniejący tryb trudnych bez SRS; poprzednią treść ujawnia przy błędzie zgodnie z prośbą. Nie zmieniono interwałów ani zasad samooceny.
