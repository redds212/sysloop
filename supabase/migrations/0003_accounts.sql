begin;
create or replace function public.update_my_settings(p_daily_target int, p_mode text, p_timed_mode boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set
    daily_target = coalesce(greatest(1, least(100, p_daily_target)), daily_target),
    mode = case when p_mode in ('maintenance','balanced','intensive') then p_mode else mode end,
    timed_mode = coalesce(p_timed_mode, timed_mode)
  where id = auth.uid();
$$;
revoke all on function public.update_my_settings(int,text,boolean) from public, anon;
grant execute on function public.update_my_settings(int,text,boolean) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.anonymize_card_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.card_reports set reporter_label = '' where user_id = old.id;
  return old;
end;
$$;
revoke all on function public.anonymize_card_reports() from public, anon, authenticated;
drop trigger if exists on_auth_user_deleted_anonymize_reports on auth.users;
create trigger on_auth_user_deleted_anonymize_reports before delete on auth.users
  for each row execute function public.anonymize_card_reports();
commit;
