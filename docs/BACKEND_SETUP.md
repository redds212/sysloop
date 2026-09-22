# SysLoop — konfiguracja Supabase

Instrukcja dla właściciela. Podczas M0–M3 agent nie uruchamia SQL, nie łączy się
z Supabase i nie wysyła treści. Migracje wymagają wykonania i sprawdzenia przez właściciela.

## 1. Projekt

Utwórz osobny projekt **SysLoop**, region Frankfurt, plan Free. Zachowaj hasło bazy.
Nie używaj projektu BridgeLoop.

## 2. Migracje

Data „jutro” w RPC zmian merytorycznych jest liczona w **Europe/Warsaw**,
zgodnie z decyzją właściciela. Uwzględnia zmianę czasu letniego i zimowego.

W SQL Editor wykonaj całe pliki, po kolei:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_access.sql`
3. `supabase/migrations/0003_accounts.sql`
4. `supabase/migrations/0004_card_edits.sql`
5. `supabase/migrations/0005_import_runs.sql`
6. `supabase/migrations/0006_difficult_practice.sql`
7. `supabase/migrations/0007_source_preview.sql`

Każdy plik ma transakcję oraz jest idempotentny. Nie ma seedów z treścią.
Powstaną: profiles, categories, cards, srs_progress, attempts, daily_sessions,
card_reports, import_runs oraz prywatny bucket review-pages.

## 3. Lokalne klucze

Skopiuj `.env.example` do `.env.local` i wpisz URL oraz publiczny anon key projektu.
Skopiuj `.env.import.example` do `.env.import`: URL oraz service role key.
Service role key pozostaje tylko w `.env.import`; nie wklejaj go do rozmowy ani do `VITE_*`.
Funkcja Edge otrzymuje ten klucz automatycznie w środowisku Supabase.

## 4. Uwierzytelnianie

Włącz dostawcę Email oraz potwierdzanie e-mail.
Na czas lokalnej pracy ustaw Site URL i dozwolony redirect na `http://localhost:5175/`.
Adres produkcyjny dodaj dopiero po decyzji o URL. Nie stosuj adresów BridgeLoop.

Interfejs logowania powstanie w M4. Teraz możesz utworzyć własnego użytkownika w
Authentication → Users; po utworzeniu sprawdź, czy trigger utworzył profil.
Nazwy użytkowników są unikalne, tak jak w BridgeLoop.

## 5. Konto administratora

Po utworzeniu konta wykonaj samodzielnie poniższy SQL, podstawiając swój adres:

```sql
insert into public.profiles (id, username, is_admin, status)
select id,
       coalesce(nullif(raw_user_meta_data->>'username',''), split_part(email,'@',1)),
       true, 'approved'
from auth.users where email = 'TWOJ@EMAIL'
on conflict (id) do update set is_admin = true, status = 'approved';
```

## 6. Usuwanie użytkowników

W Edge Functions utwórz funkcję `delete-user`, używając
`supabase/functions/delete-user/index.ts`, skopiowanej z BridgeLoop.
Funkcja sprawdza sesję i uprawnienia administratora; nie pozwala usuwać własnego konta.
Wdrożenie wykonuje właściciel. Agent jej teraz nie wdraża.

## 7. Sprawdzenie uprawnień po wykonaniu migracji

Sprawdzaj jako rzeczywiści użytkownicy, nie jako service role (omija RLS):

- Anonimowy użytkownik nie odczytuje tabel z treścią.
- Pending odczytuje własny profil, ale nie kategorie ani karty.
- Approved odczytuje aktywne karty; nie draft, archived, import_runs, obrazy z niezatwierdzonych importów ani zgłoszenia. Obrazy powiązane z aktywnymi kartami w zastosowanych importach są dostępne przez podgląd oryginału.
- Próba zmiany własnego `is_admin` lub `status` bez uprawnień admina nie przechodzi.
- Własne ustawienia zmieniają się przez `update_my_settings`.
- Historia i postęp są własne; usunięcie własnych danych jest możliwe również po cofnięciu zatwierdzenia.
- Zgłoszenie zapisuj bez `.select()` — odczyt jest tylko dla admina (SPEC §10.2).
- Import może zastosować lub odrzucić wyłącznie admin przez RPC.
- `present_line_keys` jest wymagane w próbach, także przy timeout; missed keys są wtedy null.

Pełne sprawdzenie zapisu kart, importu i zmian postępu nastąpi po przygotowaniu interfejsu
oraz fikcyjnych danych kontrolnych. Żadna migracja nie była wykonana przez agenta.

## Aktualizacja z 22 września: poprawki, trudne sekwencje i oryginał

Jeżeli kroki 1–5 były już wykonane, uruchom tylko pliki **0006**, następnie **0007**, każdy w całości w SQL Editor projektu SysLoop. Następnie odśwież aplikację. Nie trzeba odtwarzać tabel, kont ani importować 1NT ponownie.

- 0006 dodaje zapis trybu poprawek, zakresu próby, kolejki błędnych linii i osobnych gwiazdek z RLS. Dotychczasowa historia jest traktowana jako pełne próby. Ustawienia: Mój panel → Poprawki na końcu sesji.
- 0007 dodaje pobieranie granic źródła oraz wąski odczyt obrazów aktywnych kart dla zatwierdzonych użytkowników. Bucket **pozostaje prywatny**. Przy każdym otwarciu podglądu aplikacja otrzymuje podpisane adresy ważne 10 minut.
- W ćwiczeniu przycisk **Oryginalny fragment** pojawia się po odsłonięciu znaczeń. Przełącznik **Cała strona** pokazuje otoczenie. Gdy nie ma pewnych granic fragmentu, aplikacja wyjaśnia i pokazuje całą stronę.
- Dla obecnego 1NT obrazy są już przesłane. Zachowujemy pliki w `sys files/` oraz obrazy w prywatnym zasobniku; nie trzeba przesyłać pełnego PDF-a.
- Sprawdź na zatwierdzonym koncie zapis gwiazdki, wznowienie krótkiej poprawki i źródło; na innym koncie gwiazdki i próby mają być niezależne. Pending/anon nie mogą pobierać źródeł.
- Przed 0006 dotychczasowa nauka działa, nowe tryby pozostają wyłączone z informacją o aktualizacji. Nie uruchamiano tych migracji automatycznie.
