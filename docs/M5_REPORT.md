# M5 — panel administratora

## Zbudowane

- `src/admin/AdminPanel.tsx`: pięć zakładek, bramka administratora, odświeżanie
  po potwierdzonym zapisie, jawne błędy i blokada kolejnych zmian do odświeżenia
  po niepotwierdzonej operacji. Panel ładowany dynamicznie z `src/App.tsx`.
- `UsersAdmin.tsx`: zatwierdzanie i wstrzymywanie dostępu, nadawanie/odbieranie
  roli administratora, trwałe usunięcie przez istniejącą funkcję `delete-user`.
  Własne uprawnienia i własne konto są chronione przed zmianami w tym panelu.
- `ReportsAdmin.tsx`: nowe/przejrzane/rozwiązane, ponowne otwarcie, usunięcie
  z potwierdzeniem, otwarcie właściwej karty w edytorze.
- `CardsAdmin.tsx`, `CardEditor.tsx`, `model.ts`: filtry kategorii, statusu i flag,
  wyszukiwanie w licytacji i znaczeniach; edycja stron, odzywek, alternatyw,
  kwalifikatorów, kontekstu, uwag, znaczeń, statusu i weryfikacji. Dodawanie,
  usuwanie i kolejność kontynuacji; zachowanie kluczy historii przy poprawkach
  tekstu i zmianie kolejności. Potwierdzenie skutków i wybór kosmetyczna/merytoryczna.
  Szkice mają osobne zatwierdzenie. Szkice bez flag i notatki dostają flagę
  `verifier_uncertain`; aktywacja wymaga rozstrzygnięcia flag.
- `ImportsAdmin.tsx`: lista, liczniki i grupy dodane/zmienione/usunięte/bez zmian,
  porównanie każdego wiersza i uwag, wybór zmian kosmetycznych i zatwierdzenia,
  podgląd notatek kategorii oraz potwierdzenie apply/discard.
  Porównanie pokazuje wynik raw-vs-raw z zachowaniem niezmienionych poprawek z bazy.
- `CategoriesAdmin.tsx`: nazwa, grupa, kolejność, edycja i kolejność Notatek.
- `repository.ts`: paginowany odczyt, istniejące RPC `admin_save_card`,
  `apply_import_run`, `discard_import_run`, aktualizacje profili/kategorii/zgłoszeń.
  Bez service role w kliencie; RLS i kontrole wewnątrz RPC pozostają granicą dostępu.
- `shared.tsx`: prywatne obrazy stron przez podpisany URL na 10 minut, odświeżenie
  wygasłego obrazu; w imporcie obrazy pobierane dopiero po rozwinięciu podglądu.
- `src/dev/adminFixtures.ts`, `adminRepository.ts`: wymyślone dane do testów UI,
  zapis podglądu w sessionStorage; wycięte z produkcji. Podgląd dostępny przez
  przycisk Admin w `?preview=learning` albo bezpośrednio `?preview=admin`.

## Sprawdzenie

| Kontrola | Wynik końcowy |
|---|---|
| `npm test` | 140/140, 10 plików |
| `npm run lint` | PASS, bez ostrzeżeń |
| `npm run build` | PASS, 106 modułów; osobny pakiet panelu; bez ostrzeżenia rozmiaru |
| pytest importera | 45/45, bez zmian w importerze |
| Produkcyjny JS | 0 trafień dla 1822 unikalnych znaczeń o długości co najmniej 24 znaków, 0 znaczników podglądu, 0 klucza service role |

Nowe testy: bramka dostępu bez odczytu dla nie-admina, potwierdzenie uprawnień,
zgłoszenie → edytor, decyzja kosmetyczna importu, archiwizacja i pozostawienie
niezweryfikowanych kart jako szkiców, błąd zapisu i odzyskanie, zapis karty w obu
trybach, zatwierdzenie szkicu, klucze linii przy reorganizacji, normalizacja
licytacji, kolizje tożsamości oraz zachowanie ręcznych poprawek z bazy.

Przeglądarka, wyłącznie dane wymyślone: wejście z menu nauki, karta i edytor przy
375 × 812, edycja znaczenia, zatwierdzenie szkicu ze zmianą kosmetyczną, potwierdzony
zapis. Przegląd importu i porównanie przed/po przy szerokości desktopowej 1280,
wybór kosmetycznej zmiany, potwierdzenie i status „Zastosowany”. Tymczasowy rozmiar
przeglądarki przywrócono po kontroli.

## Błędy w trakcie prac

Poniższe próby nie przeszły; po poprawkach kontrole końcowe przeszły.

1. Pierwszy build: typ `ImportRun` nie spełniał ograniczenia tabel SDK, co dawało
   `TS2345: ... not assignable to parameter of type 'never'` / `'undefined'`
   i `TS2339: Property ... does not exist on type 'never'`. Dodano mapowany typ
   wiersza tabeli. Usunięto też `TS18048` i `TS2531` przez obsługę braku danych.
2. Pierwszy lint: 3 błędy `react-refresh/only-export-components` w `shared.tsx`.
   Etykiety i formatowanie dat przeniesiono do `labels.ts`.
3. Po dodaniu testów build wykrył `TS2769: 'exact' does not exist in type
   'ByRoleOptions'`. Usunięto opcję nieobsługiwaną przez Testing Library.
4. Przejściowe ostrzeżenie Vite: `Some chunks are larger than 500 kB after
   minification`. Panel wydzielono do dynamicznego importu; końcowy build bez niego.
5. Pierwszy pytest: `44 passed, 2 warnings, 1 error`; błąd setup:
   `PermissionError: [WinError 5]` przy katalogu `pytest-of-wojci` w Temp.
   Próba z nowym katalogiem w `data/` także zakończyła się `WinError 5`.
   Uruchomienie poza sandboxem, z nowym katalogiem tymczasowym i wyłączonym cache,
   dało `45 passed in 0.11s`. Nie zmieniano testów ani importera.

## Doprecyzowania i granice

- W `docs/IMPORT_CONTRACT.md` opisano `pageImages` jako tablicę ścieżek
  `<run_id>/p<NNN>.png` na zmianie; uzupełni ją uploader w M6. Spec wymagała
  ścieżek, ale nie definiowała nazwy pola. Nie jest potrzebna migracja.
- Opcjonalne łączenie usuniętej i dodanej pozycji (`linkTo`) pozostaje bez UI
  w M5. Spec dopuszcza jego pominięcie w v1; istniejący backend nadal je obsługuje.
- Daty administracyjne i opis „jutro” używają Europe/Warsaw; skutki postępu
  nadal wyznacza przygotowane RPC. Nie zmieniano reguł SRS ani kolejki.
- Zamiast bezpośrednio skopiować zależne od rozdań komponenty BridgeLoop,
  dostosowano ich przepływy do wspólnego repozytorium admina i podglądu testowego.
- Nie wykonano SQL, nowych migracji, uploadu, zmian w kontach ani zapisów do
  Supabase. Nie było deploy, push ani zmian w BridgeLoop.
- Testy apply i skutków edycji korzystają z lokalnego repozytorium testowego
  oraz domenowej logiki. Nie zastępują wykonania RPC w prawdziwej bazie.
  Pełne kryterium §15.10 (testowe konto w Supabase, rzeczywisty import i prywatny
  obraz) pozostaje do próby po przygotowaniu i autoryzacji danych w M6.
- M6 nie rozpoczęto. Brak nowych pytań blokujących ukończenie M5.
