-- Wykonuje właściciel w SQL Editor. Tylko zagregowana aktywność, bez treści kart.
begin;
create or replace function public.admin_user_activity()
returns table (
  user_id uuid,
  streak_days bigint,
  total_attempts bigint,
  unique_cards bigint,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.is_admin(auth.uid()), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  with activity as materialized (
    select a.user_id, a.card_id, (a.ts at time zone 'Europe/Warsaw')::date as day
    from public.attempts a where a.ts <= now()
  ), totals as (
    select a.user_id, count(*) as attempts, count(distinct a.card_id) as cards
    from activity a group by a.user_id
  ), days as (
    select distinct a.user_id, a.day from activity a
  ), ranked as (
    select d.user_id, d.day,
      max(d.day) over (partition by d.user_id) as latest,
      row_number() over (partition by d.user_id order by d.day desc) as position
    from days d
  ), streaks as (
    -- Dzisiaj może jeszcze nie być oceny; seria trwa, jeśli ćwiczono wczoraj.
    select r.user_id, count(*) as days
    from ranked r
    where r.latest >= (now() at time zone 'Europe/Warsaw')::date - 1
      and r.latest - r.day = r.position - 1
    group by r.user_id
  )
  select p.id, coalesce(s.days, 0), coalesce(t.attempts, 0), coalesce(t.cards, 0), u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join totals t on t.user_id = p.id
  left join streaks s on s.user_id = p.id;
end;
$$;
revoke all on function public.admin_user_activity() from public, anon, authenticated;
grant execute on function public.admin_user_activity() to authenticated;
commit;
