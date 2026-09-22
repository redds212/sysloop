-- Wykonuje właściciel w SQL Editor. Bez danych systemu.
begin;
alter table public.profiles add column if not exists correction_mode text not null default 'whole'
  check (correction_mode in ('whole','missed'));
alter table public.attempts add column if not exists scope text not null default 'full'
  check (scope in ('full','partial'));
alter table public.attempts drop constraint if exists attempts_phase_check;
alter table public.attempts add constraint attempts_phase_check check (phase in ('main','buffer','free','hard'));
alter table public.attempts drop constraint if exists attempt_partial_phase;
alter table public.attempts add constraint attempt_partial_phase check (scope = 'full' or phase = 'buffer');
alter table public.daily_sessions add column if not exists correction_lines jsonb not null default '{}'
  check (jsonb_typeof(correction_lines) = 'object');

create table if not exists public.difficult_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  primary key(user_id, card_id)
);
alter table public.difficult_cards enable row level security;
drop policy if exists difficult_read on public.difficult_cards;
create policy difficult_read on public.difficult_cards for select to authenticated
  using (user_id = auth.uid() and public.is_approved(auth.uid()));
drop policy if exists difficult_insert on public.difficult_cards;
create policy difficult_insert on public.difficult_cards for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved(auth.uid())
    and exists (select 1 from public.cards where id = card_id and status = 'active'));
drop policy if exists difficult_delete on public.difficult_cards;
create policy difficult_delete on public.difficult_cards for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.difficult_cards from public, anon, authenticated;
grant select, insert, delete on public.difficult_cards to authenticated;
grant all on public.difficult_cards to service_role;

create or replace function public.update_my_learning_settings(p_daily_target int, p_mode text, p_timed_mode boolean, p_correction_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_approved(auth.uid()) then raise exception 'Not approved'; end if;
  if p_correction_mode is null or p_correction_mode not in ('whole','missed') then raise exception 'Invalid correction mode'; end if;
  perform public.update_my_settings(p_daily_target,p_mode,p_timed_mode);
  update public.profiles set correction_mode = p_correction_mode where id = auth.uid();
end;
$$;
revoke all on function public.update_my_learning_settings(int,text,boolean,text) from public, anon;
grant execute on function public.update_my_learning_settings(int,text,boolean,text) to authenticated;
commit;
