# Pomodoro 15 / 3

2026-10-31, Europe/Warsaw.

Właściciel wybrał 15 minut zwykłej nauki z zapisem postępów, następnie
3 minuty przerwy. Zasady dodano do `SPEC.md` §6.3.1.

## Interfejs i zachowanie

- **🍅 15 min** obok startu/wznowienia/kolejnej sesji w panelu dziennym.
  Drugi punkt wejścia znajduje się w pasku już rozpoczętej sesji.
- Aktywne odliczanie w przyklejonym górnym pasku. Na telefonie zastępuje datę.
- Po 15 minutach można dokończyć kartę. Przerwa rozpoczyna się dopiero po
  potwierdzonym zapisie oceny; błąd zapisu pozwala ponowić tę samą odpowiedź.
- Zwykłe partie i poprawki przechodzą w kolejne dostępne partie bez resetowania
  licznika. Wyczerpanie puli na dziś uruchamia przerwę wcześniej.
- Po 3 minutach użytkownik wybiera **Kolejne 15 min**. Podczas przerwy karta
  i jej indywidualny timer nie są montowane.
- Wyłączenie licznika nie ocenia karty. Wyjście z nauki kończy pomodoro,
  zachowując zwykłą sesję. Przeładowanie tej samej karty przeglądarki przywraca
  fazę i termin końca, osobno dla użytkownika.
- Dotychczasowy timer pojedynczej karty ma etykietę **Limit czasu na kartę**.
  Formuła limitu i ocenianie po jego upływie pozostają zgodne z §6.3.

## Główne pliki

- `src/lib/pomodoro.ts`: fazy, terminy i odtwarzanie licznika.
- `src/hooks/usePomodoro.ts`: odliczanie, obsługa uśpienia i sessionStorage
  zawierający wyłącznie fazę/termin, bez treści i odpowiedzi.
- `src/components/Pomodoro.tsx`, `src/index.css`: przycisk, pasek i przerwa.
- `src/LearningApp.tsx`: integracja ze zwykłą sesją i zapisem postępów.
- `src/components/LearningSettings.tsx`: doprecyzowanie nazwy starego timera.
- `src/lib/pomodoro.test.ts`, `src/hooks/usePomodoro.test.tsx`,
  `src/PomodoroSession.test.tsx`: 20 nowych testów na wymyślonych danych.

## Walidacja

- `npm test`: **246 passed**, 27 plików testowych.
- `npm run lint`: **PASS**, kod 0.
- `npm run build`: **PASS**, kod 0, TypeScript/Vite/PWA. Nadal występuje
  wcześniejsze ostrzeżenie Vite o fragmentach JS większych niż 500 kB.
- Przegląd podglądu `?preview=pomodoro`: **375 × 812** i **1440 × 900**,
  start, odliczanie, ocenianie i przejście do przerwy.
- Skan produkcyjnego `dist/`: 302 dłuższe prywatne znaczenia porównane lokalnie,
  **0 dopasowań**. Treści nie wypisywano. To kontrola pomocnicza.
- `git diff --check`: **PASS**.

Pierwszy przebieg nowych testów integracyjnych: `2 failed | 16 passed`.
Naprawiono blokadę linków do notatek przed odsłonięciem karty po automatycznym
przejściu do kolejnej partii. Drugi błąd wynikał z jednakowego czasu dwóch
syntetycznych prób: sztuczny zegar testu przesunięto przed oceną poprawki,
aby nie uruchamiał istniejącej deduplikacji prób.

Wcześniejsze uruchomienie Vitest w sandboxie miało błąd `EPERM` przy plikach
tymczasowych. Testy wykonano z zatwierdzonym dostępem lokalnym. Podgląd
przeglądarkowy początkowo zwracał `ERR_CONNECTION_TIMED_OUT`; serwer lokalny
uruchomiony poza sandboxem rozwiązał problem. Nasłuch wyłącznie na localhost.

Nie ma migracji ani zmian w regułach SRS, ocenianiu czy importerze.
Nie uruchamiano SQL, importów, push ani wdrożenia. Brak otwartych pytań.
