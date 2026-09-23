# Aktualizacja systemu i trening zmian — przygotowanie

Wymaganie właściciela, 23 września 2026: porównywać nowe pliki systemu z poprzednimi, aktualizować zaakceptowane różnice i umożliwić trening zmienionych pozycji. Po wpisaniu odpowiedzi pokazać nowe znaczenie oraz, przy błędnej odpowiedzi, wcześniejsze ustalenie do porównania.

To projekt rozszerzenia, a nie informacja o działającym treningu. Nie zastosowano nowej wersji PDF ani zmian w produkcyjnej bazie. Rozstrzygnięcia o harmonogramie i momencie ujawnienia poprzedniego znaczenia czekają na odpowiedź właściciela.

## Istniejący mechanizm

- `tools/importer/diff.py`: porównanie surowego odczytu starego i nowego PDF, różnice pozycji oraz odzywek: dodane, zmienione, usunięte, bez zmian. Tożsamość obejmuje kategorię, licytację, kwalifikatory i kontekst.
- Nie zmieniamy automatycznie tożsamości po weryfikacji ani nie zgadujemy mapowania połączonych wierszy. Takie różnice wymagają jawnego przeglądu.
- `apply_import_run`: zatwierdzany przez admina import, kontrola aktualności wersji bazowej, jedna transakcja. Wiersze niezmienione w PDF zachowują poprawki redakcyjne z bazy. Usunięte pozycje są archiwizowane; jawne połączenie usuniętej z dodaną zachowuje identyfikator i historię.
- `admin_save_card`: rozróżnia zmianę merytoryczną i kosmetyczną. Merytoryczna przyspiesza późniejsze powtórki na jutro według Europe/Warsaw, zachowując poziom. Zmienione odzywki mają znacznik wersji i czasu.
- Oryginalne PDF-y pozostają lokalnie, obrazy stron w prywatnym zasobniku. Zmiana numeru strony lub nazwy rewizji sama nie jest zmianą znaczenia.

## Co należy dobudować przed zastosowaniem kolejnej aktualizacji

1. **Historia zatwierdzonych treści**: zapisać rzeczywistą kartę z bazy sprzed zmiany i ostateczny wynik po scaleniu, w tej samej transakcji co zmiana. Nie używać `oldRaw` jako poprzedniego ustalenia — to wynik parsera, który może zawierać skorygowane później błędy. Historia obejmuje też ręczne edycje administratora.
2. **Wersje i zakres**: powiązać zapis z kartą, importem (jeżeli istnieje), datą, wersją i typem zmiany; zachować licytację, kontekst oraz klucze/etykiety/znaczenia przed i po. Przy ponownych zmianach zachować cały łańcuch, nie tylko jedną nadpisywaną wartość. Rewizja tekstowa nie wystarczy jako unikalny identyfikator.
3. **Różnice do akceptacji**: admin porównuje wynikowy stary i nowy zapis, odróżnia zmianę merytoryczną od kosmetycznej i zatwierdza import. Zmiana licytacji/kontekstu wymaga jawnego powiązania; nie utożsamiać podobnych sekwencji automatycznie.
4. **Lista „Zmiany w systemie”**: wybór aktualizacji i widok zmienionych aktywnych pozycji. Dodane odzywki opisane jako nowe (bez wymyślonej poprzedniej odpowiedzi), usunięte widoczne w porównaniu, ale nie jako aktualne odpowiedzi do odtwarzania. Zarchiwizowane karty i kosmetyka nie trafiają do treningu aktualnego systemu. Sama zmiana uwag/kontekstu nadal powinna być widoczna na liście zmian.
5. **Trening**: pełna aktualna pozycja z polami na własne znaczenia, wskazanie zmienionych odzywek. Przed odsłonięciem żadnych nowych ani starych znaczeń. Po odsłonięciu własny wpis obok aktualnego znaczenia, ręczna ocena jak dotąd. Poprzedni zapis ma wyraźny podpis „Poprzednie ustalenie — już nie obowiązuje” i wersję/datę; nie klasyfikować wpisów przez proste porównanie tekstu.
6. **Dostęp i prywatność**: historia pozostaje w Supabase pod RLS. Zatwierdzeni użytkownicy otrzymują tylko historię dostępną dla aktywnych pozycji; nie udostępniać całych importów ani szkiców. Zapytanie o historię na potrzeby porównania dopiero po odsłonięciu. Żadnych znaczeń w repozytorium lub publicznym pakiecie.

## Rozstrzygnięcia oczekujące

- Czy trening zmian ma być osobnym treningiem bez wpływu na SRS (propozycja), czy odpowiedzi mają zmieniać harmonogram? Nie zmienia to obecnych skutków samej aktualizacji kart.
- Czy poprzednie znaczenie pokazywać dopiero przy ręcznie zaznaczonej błędnej odzywce (propozycja zgodna z prośbą), czy zawsze po odsłonięciu?

## Weryfikacja przyszłego wdrożenia

- Merytoryczna zmiana zapisuje prawdziwą treść sprzed i po scaleniu; błąd transakcji nie zostawia połowy historii. Kolejna rewizja nie usuwa poprzedniej.
- Test: poprawka w aplikacji, potem PDF zmienia inny wiersz — poprawka zostaje, historia pokazuje realny poprzedni stan.
- Zmiany etykiety, kontekstu, uwag, nowa/usunięta odzywka i jawne połączenie pozycji; kontrola nieaktualnej propozycji importu.
- Trening nie pokazuje historii przed odsłonięciem, własny wpis pozostaje widoczny, zakres ujawnienia poprzednich znaczeń odpowiada decyzji właściciela.
- Wybrana aktualizacja, a potem nowsza aktualizacja tej samej karty: ekran nie przedstawia historycznej odpowiedzi jako aktualnej. Trzeba odświeżyć kolejkę lub przerwać nieaktualną próbę.
- Osobne przypadki autoryzacji dla admina, approved, pending i anon; wyłącznie wymyślone dane w testach.

Przy dostarczeniu nowego PDF najpierw zachowujemy poprzedni plik, odczyt i obrazy, następnie tworzymy propozycję różnic. **Nie stosować aktualizacji przed uruchomieniem historii**, jeżeli poprzednie znaczenia mają być dostępne w treningu — późniejsza rekonstrukcja z parsera nie daje tej samej gwarancji.
