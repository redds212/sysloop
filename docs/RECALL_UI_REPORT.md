# Ekran przypominania — 2026-09-22

Zrealizowano trzy zmiany zamówione przez właściciela:

- Wiersze na ekranie nauki: minimalna wysokość 54 zamiast 67 px (około 20% mniej).
- Kliknięcie odzywki lub pustego pola przełącza neutralny znacznik przemyślenia,
  przygaszenie i licznik. Znacznik nie wpływa na ocenę ani harmonogram.
- Opcja „Wpisuj własne znaczenia”: wielowierszowy tekst przy każdej odzywce.
  Po odsłonięciu „Twój zapis” i „Znaczenie w systemie” są obok siebie na desktopie,
  a jeden pod drugim na telefonie. Ocena pozostaje ręczna; timeout nadal wymusza błąd.

Zapamiętywana jest tylko preferencja trybu pisania. Wpisy i znaczniki pozostają
w pamięci bieżącego widoku karty, znikają po opuszczeniu go lub odświeżeniu strony.
Nie trafiają do historii prób, localStorage ani Supabase. Zmiana trybu w obrębie
tej samej karty nie kasuje wpisów. Enter i spacja w polu tekstowym nie odsłaniają odpowiedzi.

Główne pliki: `src/components/card/CardView.tsx`, `src/index.css`,
`src/components/card/CardView.test.tsx`. Uaktualniono §6.1 specyfikacji.

Kontrola końcowa:

- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm test`: PASS, 144 testy w 10 plikach; cztery nowe przypadki zachowania ekranu.
- Podgląd na wymyślonych danych: znaczniki, pisanie, porównanie i ręczna ocena;
  sprawdzony desktop oraz 375 × 812, w tym wielowierszowe pole na telefonie.
- `dist/`: 1822 znane znaczenia sprawdzone, 0 trafień.
- Lokalny serwer ponownie uruchomiony w tle; HTTP 200 na porcie 5175.

Stan danych odczytany 2026-09-22: import 1NT zastosowany przez właściciela,
40 active i 3 draft. W tej zmianie nie wykonywano zapisów w Supabase.
Pozostałe kategorie, M7 i M8 pozostają osobnymi etapami do ukończenia.
