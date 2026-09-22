# M6 — pilot Otwarcie 1NT

Stan: upload wykonany po zgodzie właściciela 2026-09-21. Odczyt kontrolny 2026-09-22
potwierdził zastosowanie importu przez właściciela: 40 active i 3 draft.
Zakres: jedna kategoria, zgodnie z wyborem właściciela. Pozostałych kategorii nie weryfikowano w M6.

## Wynik kontroli źródła

Porównano obrazy wszystkich 17 stron, 43 karty i 7 sekcji Notatek.
Surowy wynik pozostał nienaruszony. Poprawki i materiały kontrolne są tylko w ignorowanym `data/`.

| Wariant | Karty | Wiersze | Karty z flagami | Gotowe do aktywacji | Szkice |
|---|---:|---:|---:|---:|---:|
| Surowy parser | 43 | 263 | 7 | — | — |
| Zweryfikowana propozycja | 43 | 250 | 3 | 40 | 3 |

13 wciętych przykładów błędnie rozpoznanych jako osobne odpowiedzi włączono do znaczeń
w czterech pozycjach. Zachowano ich treść. W czterech dalszych kartach usunięto z treści
separatory pustych komórek etykiet. Poprawiono jedno przypisanie objaśnienia pasa:
uwaga dotycząca naszej odzywki nie jest kwalifikatorem odzywki przeciwnika.

Pozostałe szkice, numeracja kart od 1 jak w HTML:

- Karta 27, strona 11: dwie etykiety bez znaczenia także w PDF.
- Karta 35, strona 15: macierz z dwiema osiami; wymaga rozpisania na pozycje.
- Karta 36, strona 15: kreski zamiast jednego znaczenia w źródle.

Flagi propozycji: `empty_meaning` 2, `line_count_mismatch` 1,
`auction_from_header` 1, `unknown_auction` 1, `verifier_uncertain` 3.
Surowy audyt: 0 nieprzypisanych i 0 nierozliczonych wierszy odzywek.
Macierz jest jawnie nieustaloną pozycją; jej 10 surowych wierszy zachowano w szkicu.
Nie oznaczamy jej jako poprawnej karty. Sprawdzono zgodność treści z PDF, nie poprawność ustaleń brydżowych.

## Implementacja

- `tools/importer/diff.py`: porównanie raw–raw, znaczniki zmian, weryfikacja wejść,
  zachowanie korekt z bazy, mapowanie naprawionej tożsamości.
- `tools/importer/backend.py`: klient REST/Storage, odczyt ostatniego zastosowanego runu
  i kart z paginacją, błędy bez odpowiedzi serwera/sekretów, blokada przekierowań.
- `tools/importer/upload.py`: lokalne przygotowanie, manifest SHA-256, UUID do ponowień,
  kontrola aktualności bazy, obrazy przed utworzeniem rekordu pending; brak apply.
- `tools/importer/__main__.py`: `propose` i `upload --confirm`.
- `tools/importer/review_html.py`: osobny HTML po weryfikacji, z notatkami weryfikatora.
- `tools/importer/tests/test_diff_upload.py`: wyłącznie wymyślone dane i atrapowy backend.

Prywatne wyniki: `data/verified/otw-1n.json`, `data/proposals/otw-1n.json`,
`data/review/otw-1n-verified.html`, `data/verification/otw-1n/`.

## Proponowany upload

Odczyt Supabase: brak zastosowanego importu i 0 istniejących kart tej kategorii.
Zmiany: 43 added, 0 changed, 0 removed, 0 unchanged.
Jeden run pending oraz 17 prywatnych PNG (około 1,76 MB); lokalny JSON około 0,65 MB.
Apply przez właściciela da 40 active i 3 draft, o ile nie zatwierdzi ręcznie szkiców.
Upload wykonano po zgodzie właściciela. Run `b566e3c3-2215-475d-9ced-41fa9a70e6a8`
ma status `pending` (2026-09-21, 16:35 Europe/Warsaw).
Odczyt kontrolny potwierdził pełną zgodność rekordu z propozycją, zgodność SHA-256
wszystkich 17 przesłanych obrazów i prywatność bucketu `review-pages`.
Kategoria nadal ma 0 kart w tabeli `cards`, ponieważ apply należy do właściciela.
Prywatne potwierdzenie: `data/verification/otw-1n/upload-receipt.json`.
Nie wykonano SQL, zdalnego apply, wdrożenia ani publikacji repozytorium.

## Weryfikacja techniczna

- `npm run lint`: PASS.
- `npm run build`: PASS. Ostrzeżenie wydajnościowe `PLUGIN_TIMINGS` dotyczyło
  `vite-plugin-pwa:build closeBundle` (8,0 s); build zakończył się kodem 0.
- `npm test`: PASS, 140 testów / 10 plików.
- Testy importera: PASS, 83 testy (45 dotychczasowych + 38 nowych).
- Pełna lokalna symulacja przygotowanego uploadu: 17 obrazów, 1 run, 0 wywołań sieciowych.
- Kontrola `dist/`: 1822 znane znaczenia o długości co najmniej 24 znaków,
  10 plików, 0 plików z trafieniami. Prywatne wejścia, wyniki i `.env.import` są gitignored.

Nieudane pierwsze uruchomienia, przed powtórzeniem z odpowiednimi uprawnieniami:

```text
pytest: PermissionError: [WinError 5] Odmowa dostępu: ...data\\pytest-m6-...
propose: Import przerwany: RuntimeError. Sprawdź lokalne pliki i konfigurację.
```

Pierwsza porażka wynikała z dostępu sandboxa do katalogu tymczasowego pytest;
drugie polecenie w sandboxie nie wykonało odczytu sieciowego. Powtórzenia poza tymi
ograniczeniami zakończyły się powodzeniem. Po uzyskaniu zgody rzeczywisty upload
pilota także zakończył się powodzeniem i został zweryfikowany przez odczyt.

## Ograniczenia i decyzje

- Wyłącznie pilot 1NT; cały M6 nie jest jeszcze zakończony.
- Nie rozstrzygano braków PDF ani macierzy domysłem; szkice pozostają do przeglądu właściciela.
- Nie zmieniono parsera ani surowych snapshotów wszystkich kategorii. Naprawy są w propozycji,
  zgodnie z §9.5. Parser nadal może mylić wcięte przykłady z etykietami; weryfikacja jest obowiązkowa.
- Obrazy wysyłamy również dla dodanych kart, aby pierwszy import miał pełny podgląd źródła.
- SQL obsługuje scalanie według pojedynczych kluczy wierszy. Dla przyszłych zmian scalonych
  przykładów importer przerywa przygotowanie zamiast nadpisać korekty lub zachować nieaktualne
  znaczenie. Rozszerzenie mapowania będzie potrzebne przed taką rewizją; pilot go nie wymaga.
- Zmiana już naprawionego klucza w kolejnej rewizji wymaga jawnego przeglądu połączenia kart.
- Akceptacja zdalnych zmian merytorycznych/kosmetycznych na użytkowniku testowym oraz importu
  zawierającego changed/removed pozostaje otwarta (§15.10); nie wykonujemy tych zapisów bez zgody.

Pilot został zastosowany; trzy nierozstrzygnięte pozycje pozostały szkicami.
Do dalszej pracy pozostaje rozstrzygnięcie szkiców i weryfikacja pozostałych kategorii.
