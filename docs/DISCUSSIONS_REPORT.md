# Do dyskusji — 2026-09-23

Gotowa implementacja lokalna: obok flagi pojawia się osobny dymek **Do dyskusji**. Formularz pozwala wskazać całą pozycję albo jedną lub kilka odzywek. Wybór odzywek wymaga przynajmniej jednego zaznaczenia, opis jest wymagany i ograniczony do 1 000 znaków. Temat zachowuje klucze oraz etykiety wybranych odzywek z chwili utworzenia. Ich znaczenia nie są ujawniane w formularzu przed odsłonięciem karty.

W **Admin → Do dyskusji** są statusy **Do omówienia / W toku / Omówione**, ponowne otwarcie, usuwanie po potwierdzeniu i odnośnik do właściwej karty. Lista błędów **Zgłoszenia** jest osobna. Zakończenie dyskusji nie edytuje ustaleń ani postępu nauki.

Główne pliki: `src/components/ReportCardButton.tsx`, `CardTools.tsx`, `src/admin/ReportsAdmin.tsx`, `AdminPanel.tsx`, `src/lib/reporting.ts`, `supabaseRepository.ts`. Lokalny podgląd współdzieli tematy między formularzem a panelem admina.

## Baza i publikacja

Przygotowano idempotentną migrację `supabase/migrations/0008_report_kinds.sql`: rodzaj wpisu `error/discussion` i lista wybranych odzywek. Poprzednie wpisy pozostają błędami; dostęp jest taki sam jak dla istniejących zgłoszeń. Właściciel potwierdził wykonanie migracji 0008 bez błędów i zlecił kontynuację publikacji. Agent nie wykonywał SQL. Instrukcja: ostatnia sekcja `docs/BACKEND_SETUP.md`.

Do testów lokalnych użyj `http://localhost:5175/?preview=learning`. Podgląd nie wymaga migracji i niczego nie wysyła do produkcyjnej bazy. Prawdziwy zapis dyskusji wymaga 0008. Przed aktywacją formularz zachowuje wpis po nieudanej wysyłce i nie zamienia tematu na zgłoszenie błędu. Po potwierdzeniu migracji wersja jest przekazywana na master do publikacji przez istniejący workflow GitHub Pages.

## Weryfikacja

- Końcowe `npm test`: **180/180**, 15 plików. Obejmuje rozdzielenie list, wybór i zachowanie zakresu, ponowne otwarcie tematu, powiązanie z kartą, zapis Supabase bez odczytu niedostępnego dla zwykłego użytkownika, brak migracji i zachowanie tekstu po błędzie.
- `npm run lint`: bez błędów.
- `npm run build`: zakończony poprawnie; pozostaje ostrzeżenie o głównym pliku JS >500 kB.
- Podgląd w przeglądarce: temat z dwiema odzywkami utworzony na wymyślonej karcie i odczytany w Admin → Do dyskusji. Formularz sprawdzony przy 375 × 812, przewijany pionowo bez poziomego przepełnienia.
- Migracji nie uruchamiano; zapis produkcyjny sprawdzono testem adaptera, a nie rzeczywistym ticketem w Supabase. Importer nie był zmieniany.

Pierwsze uruchomienie wykryło dwa błędy nowych testów, poprawione przed końcową weryfikacją:

```text
Tests  1 failed | 179 passed (180)
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name " · 1NT"
```

Poprawka: uwzględnienie normalizacji białych znaków w nazwie przycisku testowego.

```text
src/components/CardTools.test.tsx: error TS2769: No overload matches this call.
Object literal may only specify known properties, and 'exact' does not exist in type 'ByRoleOptions'.
```

Poprawka: usunięcie opcji Playwright z wywołań Testing Library. Ponowne testy i build przeszły.

## Następny zakres: zmiany systemu

Przejrzano istniejące porównywanie rewizji PDF i scalanie importów. `docs/REVISION_TRAINING_PLAN.md` opisuje brakującą historię zatwierdzonych treści i przyszły trening. Ten trening nie został jeszcze wdrożony; pytania o wpływ na harmonogram i moment ujawnienia poprzedniej odpowiedzi pozostają otwarte.
