# Importer lokalny (M3 / M6)

Uruchamiaj z katalogu projektu, używając istniejącego venv:

```powershell
& "tools/importer/.venv/Scripts/python.exe" -m tools.importer parse-all
& "tools/importer/.venv/Scripts/python.exe" -m tools.importer parse "sys files/<plik>.pdf"
& "tools/importer/.venv/Scripts/python.exe" -m pytest "tools/importer/tests" -q
```

Wyniki: `data/parsed`, `data/pages`, `data/review`, `data/parse-summary.json`.
Otwórz HTML przeglądu lokalnie; obrazy i treść nie potrzebują połączenia sieciowego.
Każda strona PDF jest renderowana. Karta jest umieszczona przy stronie początku;
kontynuacje sprawdzaj także na następnej stronie. Przegląd pokazuje surowy wynik,
nie zatwierdzone karty.

Parser pracuje na współrzędnych słów. Wiersze bez etykiety dołącza do znaczenia
powyżej. Kolumny stuba ustala na podstawie pozycji komórek i separatorów,
a znaczniki stron usuwa na podstawie położenia. Niejednoznaczności zachowuje z flagami.
Katalog kategorii dopasowuje prefiks, niezależnie od rewizji. `parse-all` odrzuca
kilka wersji tej samej kategorii, zamiast nadpisywać wyniki bez ostrzeżenia.

`audit.rows` zachowuje klasyfikację, pozycję i tekst każdego wiersza w prywatnym JSON.
`audit.lineReferences` wskazuje źródło każdej odzywki; `unattachedRows` wskazuje odzywki
w kartach `unknown_auction`. Niezależny skan wyszukuje potencjalne etykiety ze sklejonym
separatorem. Statystyka `unaccountedCallLines` musi wynosić 0; bilans jest sprawdzany
przed zapisaniem. Ten bilans nie zastępuje wizualnej weryfikacji każdej karty w M6.

Nieobsługiwane skróty etykiet pozostają w `label` ze zbiorem `bids: []` i flagą
`unknown_token`. Nie są zgadywane. Gęste macierze wymagające odczytu dwóch osi
pozostają w pozycjach nieustalonych, wraz z tekstem wierszy i obrazami.

Zestaw testów używa wyłącznie wymyślonych współrzędnych, sekwencji i znaczeń.
Zawiera odpowiednik każdego wiersza tabeli normalizacji §5.1 i każdego zagrożenia §4.3.
`parse` i `parse-all` nie odczytują kluczy ani nie łączą się z Supabase.

## Weryfikacja i propozycja

Po obejrzeniu każdej strony zapisz `data/verified/<slug>.json`. Nie nadpisuj surowego
`data/parsed/<slug>.json`. Format nakładki:

```text
{ rawDigest, pageDigests: { "p001.png": sha256, ... },
  cards: [{ rawCardKey, card, verification: "ok" | "uncertain", pages: [1, ...] }] }
```

`rawDigest` wylicza `diff.digest` z całego surowego JSON; `pageDigests` to SHA-256
bajtów obejrzanych PNG. Każda surowa karta musi mieć dokładnie jeden wpis.
`card` to poprawiona karta camelCase. Flagi i `verificationNote` wyjaśniają szkice.
Puste znaczenia lub nieznane odzywki nie mogą dostać `ok`. W `pages` uwzględnij
także strony kontynuacji. Sama obecność nakładki nie zastępuje kontroli wizualnej.

```powershell
& "tools/importer/.venv/Scripts/python.exe" -m tools.importer propose "<slug>"
```

To wyłącznie odczyt Supabase i zapis lokalny. Wymaga `.env.import`.
Porównuje z ostatnim zastosowanym importem, nigdy z oczekującym. Propozycja w
`data/proposals/<slug>.json` zawiera `run`, skróty wejść i manifest obrazów.
Surowy snapshot pozostaje bez korekt, a `run.proposal.changes` zawiera poprawione
karty oraz znaczniki zmian wierszy. `effectiveLines` pokazuje oczekiwany wynik
po zachowaniu korekt administratora w wierszach niezmienionych w surowym PDF.

Po naprawie tożsamości weryfikator zachowuje `rawCardKey`; powiązanie przechodzi
do następnych importów przez `newRaw.cardKey` i `change.cardKey`. Zmiana naprawionej
tożsamości w już zastosowanej rewizji wymaga jawnego połączenia kart.
Obecny SQL scala wiersze według pojedynczego klucza. Jeśli zmieni się surowy wiersz,
który weryfikator wcześniej włączył do innego znaczenia, `propose` przerywa pracę:
potrzebny jest przegląd scalania zamiast ryzyka pozostawienia starego tekstu.

## Upload — dopiero po zgodzie właściciela

```powershell
& "tools/importer/.venv/Scripts/python.exe" -m tools.importer upload "<slug>" --confirm
```

Wysyła obrazy dodanych, zmienionych i oznaczonych kart do prywatnego `review-pages`,
potem jeden rekord `import_runs` ze statusem `pending`. Nie uruchamia SQL, RPC apply
ani zmian kart. Właściciel stosuje propozycję w **Admin → Importy**.
Zmiana wejść, obrazu lub bazy importu blokuje upload. Ponowienie po awarii używa
tego samego UUID i tych samych ścieżek; istniejący identyczny run nie jest dodawany
drugi raz. Przerwana wysyłka obrazów może pozostawić prywatne obiekty bez rekordu;
ponowienie je nadpisze. Narzędzie nie usuwa zdalnych obiektów automatycznie.
Po odrzuceniu runu nie wskrzeszamy go przy ponowieniu; przygotowanie nowego runu
wymaga zachowania starego lokalnego pliku propozycji pod inną nazwą.
