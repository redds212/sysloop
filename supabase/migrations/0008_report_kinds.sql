-- Separate correction reports from proposals to discuss partnership agreements.
begin;

alter table public.card_reports
  add column if not exists kind text not null default 'error';
alter table public.card_reports
  add column if not exists selected_lines jsonb not null default '[]'::jsonb;
alter table public.card_reports drop constraint if exists card_reports_kind_check;
alter table public.card_reports add constraint card_reports_kind_check
  check (kind in ('error', 'discussion'));
alter table public.card_reports drop constraint if exists card_reports_selected_lines_check;
alter table public.card_reports add constraint card_reports_selected_lines_check
  check (jsonb_typeof(selected_lines) = 'array'
    and (kind = 'discussion' or selected_lines = '[]'::jsonb));

create index if not exists card_reports_kind_status_created_idx
  on public.card_reports(kind, status, created_at desc);

-- Existing RLS applies to both kinds: approved members insert their own,
-- only admins read/update/delete. The existing anonymization trigger also applies.
grant select, insert, update, delete on public.card_reports to authenticated;
grant usage, select on sequence public.card_reports_id_seq to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
