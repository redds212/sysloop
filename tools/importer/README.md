# Importer lokalny (M3)

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
Polecenia `propose` / `upload` należą do M6 i nie są jeszcze zaimplementowane.
Importer M3 nie odczytuje kluczy ani nie łączy się z Supabase.
