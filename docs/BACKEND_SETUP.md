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
- Approved odczytuje aktywne karty; nie draft, archived, import_runs, obrazy ani zgłoszenia.
- Próba zmiany własnego `is_admin` lub `status` bez uprawnień admina nie przechodzi.
- Własne ustawienia zmieniają się przez `update_my_settings`.
- Historia i postęp są własne; usunięcie własnych danych jest możliwe również po cofnięciu zatwierdzenia.
- Zgłoszenie zapisuj bez `.select()` — odczyt jest tylko dla admina (SPEC §10.2).
- Import może zastosować lub odrzucić wyłącznie admin przez RPC.
- `present_line_keys` jest wymagane w próbach, także przy timeout; missed keys są wtedy null.

Pełne sprawdzenie zapisu kart, importu i zmian postępu nastąpi po przygotowaniu interfejsu
oraz fikcyjnych danych kontrolnych. Żadna migracja nie była wykonana przez agenta.
