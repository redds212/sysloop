# Poprawki, trudne sekwencje i podgląd oryginału — 22.09.2026

Wdrożono decyzje właściciela 1A/2A/3C/4A/5A/6A oraz późniejsze doprecyzowania dotyczące kolorów i oryginału. To rozszerzenie nauki; nie oznacza ukończenia całego M7/M8 ani weryfikacji pozostałych kategorii.

## Zmiany

- Ustawienia: cała pozycja albo tylko błędne odzywki w jednorazowej poprawce. Cała sekwencja i kontekst pozostają widoczne. Zakres jest zapisywany razem z sesją i przetrwa odświeżenie. Oba warianty pozostawiają całą kartę na jutro, na poziomie 0. `src/lib/sessionState.ts`, `src/hooks/useLearning.ts`, `src/components/LearningSettings.tsx`.
- Oznaczenie „Poprzednio błąd” przed odsłonięciem pochodzi z ostatniej pełnej próby. Krótka poprawka i specjalny trening nie kasują go. `src/lib/difficult.ts`, `src/components/card/CardView.tsx`.
- Trudne sekwencje: własne gwiazdki, częste błędy i suma obu; próg automatyczny 2/5 dla pojedynczej odzywki. Osobny trening nie zapisuje postępu SRS, nie zajmuje sesji dziennej ani nie usuwa karty z puli nowych. Próby mają fazę `hard`. `src/components/DifficultCards.tsx`, `HardPractice.tsx`, `src/lib/lineStats.ts`.
- Gwiazdki zapisywane niezależnie od SRS, z potwierdzeniem zapisu i odzyskiwaniem po utracie połączenia. `src/lib/learningRepository.ts`, `supabaseRepository.ts`.
- Rozwinięte menu: delikatna zieleń na etapach 1–3, mocniejsza przy opanowaniu (4–5), czerwony przy ponownej nauce. Legenda i podpowiedź etapu/terminu. `src/components/sidebar/Sidebar.tsx`, `src/index.css`.
- „Oryginalny fragment” po odsłonięciu i w czytaniu: fragment, cała strona, powiększanie z przewijaniem. Pobieranie dopiero po kliknięciu. Oryginalne PDF-y pozostają lokalnie, obrazy stron w prywatnym zasobniku. `src/components/SourcePreviewButton.tsx`, `src/lib/sourcePreview.ts`.

## Weryfikacja

- `npm test`: **169/169**, 13 plików.
- `npm run lint`: **PASS**.
- `npm run build`: **PASS**. Ostrzeżenie Vite: główny fragment JS 512,44 kB po minifikacji przekracza próg 500 kB (146,58 kB gzip).
- Pierwszy build w sandboxie nie przeszedł: `[plugin externalize-deps] Error: spawn EPERM`. Powtórzony po przyznaniu lokalnego uprawnienia wykonania procesów przeszedł; to ograniczenie środowiska, nie pominięty błąd kompilacji.
- Kontrola `dist/`: 1833 znaczenia z lokalnych danych sprawdzone w postaci tekstowej i JSON; **0 trafień**.
- Podgląd na wymyślonych danych, desktop 1280 × 900 oraz telefon 375 × 812: wybór krótkich poprawek, oznaczenie błędu, wznowienie po odświeżeniu, gwiazdka, lista trudnych, trening bez zmiany planu, zachowanie oznaczenia po poprawnej próbie `hard`, własny wpis, fragment/strona/powiększenie, kolory pozycji w trakcie nauki i opanowanej.
- Lokalna kontrola metadanych 1NT: 40 aktywnych kart, 42 odwołania do już przesłanych stron, 41 fragmentów z identyfikowalnymi wierszami; 1 dalszy ciąg bez odrębnej etykiety odzywki pokazuje pełną stronę. To kontrola powiązań i geometrii, nie ponowna wizualna weryfikacja wszystkich kart.
- Importera nie zmieniano; jego testów nie powtarzano w tej zmianie.
- Nowych migracji **nie uruchamiano** na Supabase. Integracja nowych RPC i polityk RLS z rzeczywistymi kontami pozostaje do sprawdzenia po wykonaniu SQL przez właściciela. Testy aplikacji używają lokalnego repozytorium podglądu.

## Aktualizacja bazy przez właściciela

W SQL Editor projektu SysLoop wykonać kolejno całe pliki:

1. `supabase/migrations/0006_difficult_practice.sql`
2. `supabase/migrations/0007_source_preview.sql`

Następnie odświeżyć aplikację. Instrukcje: `docs/BACKEND_SETUP.md`. Bez 0006 dotychczasowa nauka pozostaje dostępna; nowe tryby są wyłączone z informacją o wymaganej aktualizacji. Nie wykonywano uploadu, wdrożenia ani zmian w BridgeLoop.

## Uściślenia

- Tryb poprawek domyślnie zachowuje dotychczasową pełną kartę. Zmiana ustawienia działa na później ocenione błędy; już zapisana poprawka zachowuje zakres.
- Timeout lub usunięcie wszystkich błędnych linii oznacza pełną poprawkę. Pozostałe usunięte linie pomijamy.
- Pełna poprawka liczy się do historii pełnych ocen; krótka jest wyłączona, także gdy przypadkiem obejmuje wszystkie linie.
- Gwiazdki zostają do ręcznego usunięcia. Automatyczna lista zmienia się według pełnych ocen; trening trudnych nie oczyszcza jej sztucznie.
- Dodatkowy trening jest bez timera, w kolejności aktualnego filtra; jego kolejka trwa przez bieżącą wizytę. Zapisane próby i gwiazdki przetrwają odświeżenie.
- Podgląd dotyczy zachowanego dokumentu źródłowego, który może różnić się od późniejszych korekt w aplikacji. Niepewny wycinek zastępuje pełna strona z wyjaśnieniem. Podpisane adresy obrazów wygasają po 10 minutach; ponowne otwarcie odświeża dostęp.
- Zgodnie z nową decyzją właściciela obrazy aktywnych kart z zastosowanych importów stają się dostępne zatwierdzonym użytkownikom. Odczyt pełnej strony obejmuje również jej sąsiednie pozycje; nie zmieniamy zasobnika na publiczny ani nie udostępniamy importów oczekujących.
