# M4 — rdzeń aplikacji

## Zbudowane

- Logowanie, rejestracja, potwierdzenie e-mail, oczekiwanie na zatwierdzenie,
  reset i zmiana hasła: `src/auth/`, dostosowane z BridgeLoop.
- Powłoka i drzewo kategorii, rekomendacje, ustawienia nauki: `LearningApp.tsx`,
  `components/sidebar/Sidebar.tsx`, `components/LearningSettings.tsx`.
- Karta z jednolitymi pustymi polami, odsłonięciem i ścisłym ocenianiem wierszy;
  czas na kartę, timeout, wyróżnienie zmian, uwagi i zgłoszenia: `components/card/`.
- Sesja główna, poprawki, pauza, wznowienie, zachowane ukończenie, dostosowanie celu:
  `hooks/useLearning.ts`, istniejąca logika M2.
- Ćwiczenie swobodne z przywracaniem migawki po „Powtórz”; czytanie z linkami
  do rodziców i kontynuacji; Notatki i formularz zgłoszenia.
- Dostęp do bazy z paginacją: `lib/supabaseRepository.ts`, `database.types.ts`.
- Odpowiedź jest potwierdzana dopiero po zapisie historii, postępu i sesji.
  Dziennik oczekującej operacji w localStorage przechowuje identyfikatory, ocenę
  i migawkę postępu/kolejki, bez znaczeń ani treści kart. Przerwana operacja jest
  dokańczana przed kolejną nauką. Powtórzenie zapisu nie dubluje próby po jej
  identyfikatorze czasowym. Nie jest to tryb nauki offline ani transakcja SQL.
- Wymyślony podgląd: `http://127.0.0.1:5175/?preview=learning`.
  Dane podglądu są przechowywane tylko w sessionStorage i wycinane z produkcyjnego JS.

## Uzgodniona luka specyfikacji

Właściciel zatwierdził: nieukończone poprawki po północy wracają jako błąd,
poziom 0, termin dzień po pierwotnej odpowiedzi. `lib/dayRollover.ts` odzyskuje
je przed utworzeniem nowej kolejki, nie nadpisując późniejszej oceny.
Nie wymaga to nowej migracji. Dopisano regułę do SPEC §6.5.

## Weryfikacja

- Testy: 124/124, 8 plików; w tym komponenty React w jsdom, timeout,
  ponawianie przerwanego zapisu, pełna sesja z buforem i wznowieniem, cofnięcie
  zaliczenia w ćwiczeniu swobodnym, rodzic/dziecko i zmiana dnia.
- Build: TypeScript i Vite przeszły. Podgląd nie jest częścią produkcyjnego kodu.
- Lint: przeszedł bez ostrzeżeń. Wstępne ostrzeżenie o ref w cleanup usunięto,
  zastępując odwołanie callbackiem unieważnienia.
- Końcowy build: pierwszą próbę zablokował sandbox: `[plugin externalize-deps]
  Error: spawn EPERM`. Ponowne uruchomienie z uprawnieniem do lokalnego procesu
  zakończyło się poprawnie (94 moduły, PWA 7 plików).
- Kontrola produkcyjnego JS: brak znaczeń z importu, klucza service role
  oraz znaczników wymyślonych danych podglądu.
- Pierwszy build M4: `TS1109: Expression expected`, `TS1005: '...' expected`
  w LearningApp.tsx — poprawiono zamknięcie atrybutu JSX. Pierwszy lint zgłosił
  ten sam błąd i eksport useAuth wraz z komponentem; wspólny kontekst zachowano
  z miejscowym, udokumentowanym wyłączeniem reguły Fast Refresh.
- Początkowy glob testów obejmował tylko `.test.ts`; rozszerzono go o `.test.tsx`.
  Wynik 109 testów nie obejmował jeszcze testów komponentów; końcowy wynik obejmuje je.
- Automatyczny przegląd przejściowo odrzucił uruchomienie testów z powodu limitu
  użycia. Po wznowieniu przez właściciela testy wykonano z powodzeniem.
- Odczyt Supabase: wszystkie 8 tabel odpowiada HTTP 200 dla uprawnionego odczytu;
  1 zatwierdzony administrator, 0 kategorii i kart przed importem. Auth email działa;
  anonimowy odczyt kart odrzucony (HTTP 401). Nie zapisano danych ani nie wykonano SQL.
- Przeglądarka: ekran główny na desktopie, karta przy 375 × 812, odsłonięcie,
  zaznaczenie błędu i przejście z 0/5 do 1/5 sprawdzone na wymyślonych kartach.
  Po przerwie serwera odświeżenie trafiło na ERR_CONNECTION_REFUSED; narzędzie
  blokowało wewnętrzny adres data: strony błędu. Po ponownym uruchomieniu serwera
  otwarto świeżą kartę podglądu: odpowiedź, odświeżenie, „Wznów sesję (1 / 5)”
  i druga karta zostały potwierdzone także w przeglądarce.
- Pierwszy dostęp narzędzia przeglądarki został odrzucony ze względu na potencjalne
  ujawnienie treści. Właściciel następnie jawnie zezwolił narzędziu na odczyt
  podglądu z wymyślonymi kartami; powyższy przegląd wykonano po tej zgodzie.

## Granice etapu

- Poświadczenia i treści pozostają poza repo. Brak deploy, push, nowych migracji
  lub uploadu. Nie tworzono kont testowych w bazie i nie zmieniano konta właściciela.
- Nie wykonano pełnej próby logowania/odzyskiwania hasła z rzeczywistą skrzynką
  ani zapisu ocen rzeczywistego użytkownika. Baza jeszcze nie zawiera kart.
- Wspólna warstwa `useLearning` koordynuje zapis historii, SRS i sesji zamiast
  niezależnych optymistycznych hooków BridgeLoop, aby błędy zapisu nie były ciche.
- Mój panel na tym etapie zawiera sesję i ustawienia; statystyki, plan i reset
  należą do M8. Admin należy do M5, wyszukiwanie i Trudne odzywki do M7.
