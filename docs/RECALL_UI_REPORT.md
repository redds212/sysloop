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

## Doprecyzowanie interfejsu — 22.09.2026

- Zamiast dodatkowego napisu nad znaczeniem: mała bursztynowa ikona ostrzeżenia obok odzywki, z etykietą dostępności i podpowiedzią „Poprzednio błąd”. Wiersze oznaczone i nieoznaczone mają tę samą wysokość.
- Pasek Pokaż / Wszystko dobrze / Dalej jest przypięty do dołu również na desktopie; nie przykrywa bocznego menu. Dolny odstęp treści pozwala przewinąć ostatnią odpowiedź ponad pasek.
- Wspólny przycisk trudnych sekwencji ma tekst 16 px i żółtą gwiazdkę 28 px: obrys przed zaznaczeniem, wypełnienie po zaznaczeniu.
- Sprawdzone w podglądzie na wymyślonej karcie z 28 odzywkami, przy 1280 × 900 i 375 × 812. Przycisk oceny jest w obszarze widocznym, brak poziomego przepełnienia.
- `npm test`: 169/169; lint i build: PASS. Pozostaje ostrzeżenie Vite o głównym fragmencie JS >500 kB (514,84 kB). Bez zmian harmonogramu, oceniania i bazy danych; nie potrzeba dodatkowej migracji.
