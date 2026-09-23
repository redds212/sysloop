# Zgłoszenia i automatyczne zaznaczanie — 2026-09-23

- Przycisk z flagą „Zgłoś błąd” jest nad pozycją obok gwiazdki, przed i po odsłonięciu, również w czytaniu oraz treningu trudnych. Formularz pokazuje kategorię, sekwencję i kontekst. Wykorzystuje istniejące `card_reports` oraz panel Admin → Zgłoszenia; nie wymaga migracji.
- W trybie „Wpisuj własne znaczenia” niepusty tekst zaznacza odzywkę jako przemyślaną. Usunięcie tekstu lub pozostawienie samych białych znaków usuwa znacznik. Ręczne przełączanie nadal działa; kolejna edycja niepustego wpisu zaznacza odzywkę ponownie. Ocena i harmonogram pozostają niezależne od tych znaczników.
- Główne pliki: `CardTools.tsx`, `ReportCardButton.tsx`, `LearningApp.tsx`, `HardPractice.tsx`, `card/CardView.tsx`, `index.css`. Lokalny podgląd współdzieli przykładowe zgłoszenia między nauką a administracją.

Weryfikacja: lint oraz build przeszły; 172 testy w 14 plikach przeszły. Build nadal zgłasza ostrzeżenie o głównym pliku JS większym niż 500 kB. Testy obejmują zaznaczanie i czyszczenie wpisu, niezależność oceny, zgłoszenie przypisane do właściwej karty, obsługę w adminie, ponowienie po błędzie oraz czyszczenie formularza przy zmianie karty.

W przeglądarce na wymyślonych danych sprawdzono wpis → znacznik/licznik, usunięcie → wyczyszczenie, formularz i potwierdzenie zgłoszenia przy 375 × 812 oraz pojawienie się ticketu w panelu administratora. Nie wysyłano testowych zgłoszeń do produkcyjnej bazy. Rozszerzenia właściciela zapisano w SPEC §6.1 i §7.8.
