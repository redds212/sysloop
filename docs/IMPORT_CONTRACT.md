# Kontrakt importu

M1 definiuje kontrakt dla implementacji `propose` i `upload` w M6. M3 nie łączy się z bazą.

`raw_snapshot`: wynik parsera: `category`, `cards`, `stats`. Pola parsera są camelCase.

`proposal`: `{ baseRunId: uuid | null, changes: [...] }`. `baseRunId` identyfikuje ostatni
zastosowany import; SQL odrzuca propozycję przygotowaną na nieaktualnej podstawie.

Każda zmiana: `{ cardKey, kind, card, oldRaw, newRaw, verification }`.
`kind`: added / changed / removed / unchanged. `card` jest zweryfikowaną propozycją
w formacie kolumn tabeli `cards` (snake_case), z `lines` w formacie CardLine (camelCase).
`oldRaw` i `newRaw`: odpowiadające surowe karty, bez poprawek weryfikatora.
`verification`: `ok` tylko po sprawdzeniu. Usunięte pozycje nie potrzebują `card`.

Opcjonalne `pageImages` na każdej zmianie to tablica ścieżek w prywatnym bucket
`review-pages`: `<run_id>/p<NNN>.png` (strony od 1). Uploader w M6 wpisze ścieżki
po przesłaniu obrazów. Panel M5 odczytuje je przez URL podpisany na 10 minut;
brak obrazu jest jawnie oznaczony. W `card` nie zapisujemy URL ani obrazów.

`p_decisions`: obiekt indeksowany `cardKey`; wartości `{ cosmetic?, linkTo?, approve?, skip? }`.
`linkTo` zawiera klucz usuwanej karty w tej samej kategorii; tylko dodana karta może go użyć.
`skip` pomija tę zmianę w bieżącym imporcie. Zastosowany raw snapshot nadal opisuje cały PDF.
Administrator jawnie zatwierdzający kartę usuwa flagi; niezweryfikowane pozycje pozostają draft.

Apply i discard wymagają administratora. Klient nie może bezpośrednio zmieniać `import_runs`.
Importy kategorii są serializowane, a cała operacja apply jest jedną transakcją.
