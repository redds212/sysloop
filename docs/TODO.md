# SysLoop — lista dalszych prac

Aktualizacja: 2026-10-08, Europe/Warsaw. Lista zapisana na prośbę właściciela.
Pomysły poniżej nie oznaczają zlecenia wdrożenia wszystkich funkcji.

## Teraz: ostatnie aktualne pliki obrony

- [x] Opracować i przesłać do **Admin → Importy**: `OBR_1T_rev2018.pdf` (`obr-1t`).
- [x] Opracować i przesłać do **Admin → Importy**: `OBR_1D_rev2018.pdf` (`obr-1d`).
- [x] Opracować i przesłać do **Admin → Importy**: `OBR_W_2NT po blokach_rev2021.pdf` (`obr-w-2nt-bloki`).
- [ ] Właściciel: przejrzeć i zastosować oczekujące importy oraz rozstrzygnąć oznaczone szkice.

Potwierdzono w backendzie 2026-10-08: wszystkie trzy importy mają stan
**oczekujący**; nie zostały automatycznie zastosowane.

| Import | Karty | Odzywki | Zweryfikowane | Do decyzji | Strony źródłowe |
|---|---:|---:|---:|---:|---:|
| `obr-1t` | 59 | 580 | 56 | 3 | 34 |
| `obr-1d` | 75 | 643 | 74 | 1 | 38 |
| `obr-w-2nt-bloki` | 12 | 74 | 9 | 3 | 6 |

Łącznie 146 kart, 1297 odzywek, 7 szkiców; brak pominiętych lub nieprzypisanych
wierszy odzywek. Przejrzano wszystkie 78 stron. Potwierdzono zgodność propozycji
na serwerze oraz kompletność prywatnych obrazów. Oryginały PDF i lokalne archiwa
pozostają zachowane. Wątpliwości opisano przy odpowiednich kartach w importach.

Decyzja właściciela z 2026-10-08: `OBR_W_2kol_rev2025.pdf` (`obr-w-2kol`)
i `OBR_inne_2025.pdf` (`obr-inne`) są **nieaktualne**. Nie importować ich do
treningu. Zachować lokalne pliki; nie usuwać historii ani archiwów.

W audycie z 2026-10-08 wcześniejsze importy `otw-1t`, `otw-1h` i `otw-1s`
oczekiwały na zatwierdzenie. Stan importu trzeba odróżniać od aktywności kart:
przygotowane lokalnie → przesłane do przeglądu → zastosowane → aktywne/szkice.

## Porządkowanie treści

- [ ] Przejrzeć szkice w **Admin → Karty**, także po zastosowaniu importów.
- [ ] Rozpatrzyć zgłoszenia błędów i tematy do dyskusji; uzgodnienia nanieść do źródłowych PDF-ów.
- [ ] Po zatwierdzeniu ostatnich importów ponownie sprawdzić kompletność aktualnych kategorii.

## Pomysły do wyboru

1. **Wyszukiwarka licytacji** — ekran wpisywania odzywek i wyników; wykorzystać istniejącą logikę dopasowania, także z interwencjami przeciwników.
2. **Pełny Mój panel** — dni z rzędu, dzienny wolumen, historia, postęp według kategorii i nadchodzące powtórki; obecne statystyki administratora nie zastępują panelu użytkownika.
3. **Trening jednej kategorii / przed turniejem** — dowolne ćwiczenie wskazanego działu bez zmiany harmonogramu.
4. **Ustalenia z dyskusji** — zapisana decyzja przy temacie oraz powiązanie jej z aktualizacją karty.
5. **Przegląd kompletności importów** — jedna zwarta lista plików ze stanem opracowania, aktualnością wersji i liczbą kart do weryfikacji.

## Zasady kontynuacji

- Nie wznawiać importów dwóch nieaktualnych plików bez nowej decyzji właściciela.
- Oczekującego importu nie opisywać jako już dostępnego w treningu.
- Treść systemu, prywatne raporty weryfikacji i obrazy pozostają w `data/` lub prywatnym backendzie; ta lista zawiera wyłącznie nazwy i zadania.
