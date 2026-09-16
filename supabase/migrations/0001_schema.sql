-- SysLoop: struktura bez danych systemu. Wykonuje właściciel w SQL Editor.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  is_admin boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved')),
  daily_target int not null default 20 check (daily_target between 1 and 100),
  mode text not null default 'balanced' check (mode in ('maintenance','balanced','intensive')),
  timed_mode boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.categories (
  slug text primary key, name text not null, group_name text not null,
  sort_order int not null default 0, source_file text not null, revision text not null default '',
  notes jsonb not null default '[]' check (jsonb_typeof(notes) = 'array'),
  updated_at timestamptz not null default now()
);
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.categories(slug),
  card_key text not null unique, section text not null default '', sort_order int not null default 0,
  auction jsonb not null check (jsonb_typeof(auction) = 'array'), auction_key text not null,
  context text, auction_note text,
  notes jsonb not null default '[]' check (jsonb_typeof(notes) = 'array'),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) > 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  review_flags jsonb not null default '[]' check (jsonb_typeof(review_flags) = 'array'),
  verification_note text, source_page int not null check (source_page > 0), source_revision text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists cards_category_order_idx on public.cards(category_slug, sort_order);
create index if not exists cards_auction_idx on public.cards(auction_key);
create table if not exists public.srs_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  status text not null default 'NEW' check (status in ('NEW','LEARNING','REVIEW','MASTERED')),
  consecutive_correct int not null default 0 check (consecutive_correct between 0 and 5),
  interval int not null default 0 check (interval >= 0),
  next_review_date date, last_seen timestamptz, flag_difficult boolean not null default false,
  primary key(user_id, card_id)
);
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null, correct boolean not null,
  phase text not null check (phase in ('main','buffer','free')),
  missed_line_keys text[], present_line_keys text[] not null,
  timed_out boolean not null default false, line_count int not null check (line_count > 0),
  ts timestamptz not null default now(),
  constraint attempt_line_count check (cardinality(present_line_keys) = line_count),
  constraint attempt_grading check (
    (timed_out and not correct and missed_line_keys is null) or
    (not timed_out and missed_line_keys is not null
      and missed_line_keys <@ present_line_keys
      and correct = (cardinality(missed_line_keys) = 0))
  )
);
create index if not exists attempts_user_ts_idx on public.attempts(user_id, ts desc);
create index if not exists attempts_user_card_ts_idx on public.attempts(user_id, card_id, ts desc);
create table if not exists public.daily_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date date not null, slots jsonb not null default '[]', idx int not null default 0 check (idx >= 0),
  buffer jsonb not null default '[]', buffer_index int not null default 0 check (buffer_index >= 0),
  in_buffer boolean not null default false, deferred_review_ids jsonb not null default '[]',
  target int not null default 20 check (target between 1 and 100),
  mode text not null default 'balanced' check (mode in ('maintenance','balanced','intensive')),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(slots) = 'array' and jsonb_typeof(buffer) = 'array'
    and jsonb_typeof(deferred_review_ids) = 'array')
);
create table if not exists public.card_reports (
  id bigint generated always as identity primary key,
  card_id uuid not null, card_label text not null default '',
  user_id uuid references auth.users(id) on delete set null,
  reporter_label text not null default '', message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'new' check (status in ('new','seen','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists card_reports_status_created_idx on public.card_reports(status, created_at desc);
create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(), category_slug text not null,
  source_file text not null, revision text not null,
  status text not null default 'pending' check (status in ('pending','applied','discarded')),
  raw_snapshot jsonb not null, proposal jsonb not null, summary jsonb not null default '{}',
  created_at timestamptz not null default now(), applied_at timestamptz,
  applied_by uuid references auth.users(id) on delete set null
);
create index if not exists import_runs_category_applied_idx on public.import_runs(category_slug, applied_at desc);
commit;
