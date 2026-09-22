# Kolejne importy: 2♦ i 2NT

Data: 2026-09-22, Europe/Warsaw.

Obie propozycje przesłano do Supabase ze statusem `pending`. Właściciel stosuje je w **Admin → Importy → Zastosuj**. Sam upload nie dodaje jeszcze kart do treningu. Nie uruchamiano SQL ani migracji.

| Kategoria | Strony PDF | Karty | Odzywki | Gotowe do aktywacji | Szkice | Obrazy w Supabase |
|---|---:|---:|---:|---:|---:|---:|
| Otwarcie 2♦ | 6 | 15 | 96 | 15 | 0 | 6 |
| Otwarcie 2NT | 8 | 19 | 115 | 17 | 2 | 7 |

Każdą kartę i wszystkie 14 stron porównano wizualnie ze źródłem, włącznie z kontynuacjami znaczeń i notatkami kategorii. Po weryfikacji brak nieprzypisanych odzywek.

- Dodano kategorię `otw-2d` do `tools/importer/categories.json`.
- W `tools/importer/auction.py` poprawiono rozpoznawanie dopisków pisanych małymi literami przy wieloodzywkowych stubach. Nadal wymagany jest końcowy znak zapytania przed uznaniem ciągu za stub. Dopiski pozostają uwagami, nie osobnymi odpowiedziami.
- Pierwszy odczyt 2NT tworzył 21 kart i 121 linii. Poprawiony parser daje 19 kart i 117 linii; weryfikacja rozpoznała jeszcze dwa wiersze sekwencji/dopisku jako niebędące odpowiedziami. Ich treść zachowano w sekwencji i uwadze karty. Końcowo: 115 odpowiedzi.
- W 2♦ uzupełniono otwarcie pierwszej karty na podstawie tytułu rozdzielonego przez ekstrakcję na dwa wiersze. Zachowano surowy wynik parsera i osobną nakładkę weryfikacyjną.
- Dwa szkice w 2NT: strona 2 — placeholder zamiast znaczenia (`empty_meaning`, `verifier_uncertain`); strona 7 — niejednoznacznie zakończony stub, bez znaku zapytania (`ambiguous_layout`, `verifier_uncertain`). Nie dopisywano brakujących znaczeń.

## Źródła i sprawdzenie uploadu

Oryginalne PDF-y pozostają w `sys files/`; dodatkowe kopie z sumą SHA-256 są w gitignorowanym `data/source-archives/`. Wszystkie 14 obrazów stron pozostają lokalnie. Do prywatnego bucketu przesłano 13 stron powiązanych z kartami; ostatnia strona 2NT zawiera wyłącznie notatki kategorii. Karta z uwagami przechodzącymi na następną stronę ma przypisane obie strony.

Ponownie odczytano oba importy i porównano ich propozycje, surowe snapshoty i podsumowania. Pobrano wszystkie 13 obrazów i potwierdzono zgodność ich SHA-256 z lokalnymi plikami. Identyfikatory importów i potwierdzenia przechowywane są w `data/verification/<slug>/upload-receipt.json`.

Lokalne przeglądy: `data/review/otw-2d-verified.html` i `data/review/otw-2nt-verified.html`. Żadne prywatne materiały importu nie trafiają do git.

## Walidacja

- Testy importera: **85 passed**, w tym dwa nowe testy na wymyślonych sekwencjach dla dopisków przy stubach i znaczeń zaczynających się od odzywki.
- Pierwsze uruchomienie pytest w sandboxie zakończyło się `PermissionError: [WinError 5]` dla katalogu tymczasowego. Ponowne uruchomienie poza sandboxem przeszło w całości.
- Lokalny skrypt weryfikacji początkowo zgłosił `ZoneInfoNotFoundError` (brak pakietu `tzdata` w venv). Użyto strefy systemowej po potwierdzeniu, że jest to warszawska strefa Windows; zapisano znacznik czasu z offsetem i nazwę `Europe/Warsaw`.
- Zmiana nie dotyczy frontendu, oceniania ani harmonogramu powtórek.
- Przed zapisem wersji w repozytorium: `npm run lint` bez błędów, `npm test` — 169/169, `npm run build` zakończony powodzeniem. Pozostaje ostrzeżenie Vite o głównym pakiecie JS większym niż 500 kB (514,84 kB).
- Skan `dist/`: 1877 próbek tekstu źródłowego, zero dopasowań. Przed pierwszym wysłaniem repozytorium sprawdzono również 188 historycznych blobów git i śledzone pliki: brak prywatnych katalogów, PDF-ów, obrazów źródłowych, rzeczywistych kluczy z lokalnych plików środowiskowych i dopasowań długich znaczeń.

## Odstępstwa i pozostałe decyzje

Katalog rozszerzono z pierwotnych 14 do 15 kategorii na wyraźne polecenie właściciela. Dwa szkice wymagają jego rozstrzygnięcia w panelu; pozostałe karty są gotowe do aktywacji przez zastosowanie importów.
