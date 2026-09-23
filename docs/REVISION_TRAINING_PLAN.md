# Aktualizacja systemu i trening zmian

Stan: rozszerzenie opublikowane 23 września 2026. Właściciel potwierdził wykonanie migracji 0009. Nie zastosowano nowego PDF; kolejne zatwierdzone aktualizacje będą zapisywać historię. Agent nie wykonywał migracji na zdalnej bazie.

## Przepływ

1. Zachowujemy poprzedni PDF i obrazy. Lokalny importer porównuje nowy surowy odczyt z ostatnim zastosowanym odczytem, przygotowuje dodane, zmienione i usunięte pozycje. Weryfikacja porównuje je ze źródłem.
2. Upload tworzy oczekujący import. Administrator ogląda różnice w Admin → Importy i zatwierdza Zastosuj. Użytkownik potwierdził zachowanie tego kroku.
3. Zmiana zapisuje rzeczywistą kartę sprzed edycji i wynik po scaleniu w jednej transakcji. Poprawki redakcyjne niezmienionych w PDF wierszy zostają. Historia obejmuje też edytor admina i nie ujawnia roboczych szkiców.
4. Trudne sekwencje → Ostatnio zmienione: merytoryczne zmiany aktywnych kart, daty Europe/Warsaw, wersje i Przed/Po. Nowe linie mają pustą stronę Przed, usunięte pustą Po. Historia nie znika po ocenie.
5. Trening korzysta z aktualnych pełnych pozycji, domyślnie z wpisywaniem tekstu. To istniejący tryb hard: bez wpływu na SRS. Po odsłonięciu i oznaczeniu błędu pokazuje poprzednią treść z podpisem, że już nie obowiązuje. Własny tekst służy samoocenie i nie trafia do bazy.
6. NEW identyfikuje konkretną zmianę odzywki. Znika po pierwszej zapisanej ocenie tej wersji, również błędnej (decyzja właściciela). Próba częściowa obejmuje tylko obecne w niej odzywki. Kosmetyka nie odnawia NEW.

## Granice

- PDF-y przesyłamy dotychczasowym lokalnym importerem; nie dodano formularza uploadu PDF w przeglądarce.
- W istniejących kartach migracja zapisuje punkt początkowy bez NEW. Nie odtwarza nieznanej starszej historii.
- Merytoryczna aktualizacja nadal przyspiesza późniejsze terminy na jutro w Warszawie, zachowując poziom. Sam trening zmian nie zmienia harmonogramu.
- Lista pokazuje zachowaną historię, a ćwiczenie zawsze aktualną treść karty; nie przywraca dawnych ustaleń.
- Historia ma RLS: admin wszystkie wpisy, approved tylko historię aktywnych kart, pending/anon bez dostępu. Publiczny pakiet nie zawiera treści systemu.
- Lokalny preview używa wymyślonej historii. Całą ścieżkę zatwierdzenia importu sprawdzają testy SQL na fikcyjnych danych.

Szczegóły sprawdzenia: REVISION_HISTORY_REPORT.md. Aktywacja: BACKEND_SETUP.md, sekcja migracji 0009.
