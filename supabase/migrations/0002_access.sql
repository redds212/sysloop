-- Jawne granty oraz RLS. Brak dostępu anonimowego do treści.
begin;
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;
create or replace function public.is_approved(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' from public.profiles where id = uid), false);
$$;
revoke all on function public.is_admin(uuid), public.is_approved(uuid) from public, anon;
grant execute on function public.is_admin(uuid), public.is_approved(uuid) to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['profiles','categories','cards','srs_progress','attempts','daily_sessions','card_reports','import_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage on schema public to authenticated, service_role;
grant select, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.categories, public.cards, public.srs_progress, public.daily_sessions to authenticated;
grant select, insert, delete on public.attempts to authenticated;
grant select, insert, update, delete on public.card_reports to authenticated;
grant select on public.import_runs to authenticated;
grant usage, select on sequence public.attempts_id_seq, public.card_reports_id_seq to authenticated, service_role;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin(auth.uid()));

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated
  using (public.is_approved(auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists cards_read on public.cards;
create policy cards_read on public.cards for select to authenticated
  using ((public.is_approved(auth.uid()) and status = 'active') or public.is_admin(auth.uid()));
do $$
declare t text;
begin
  foreach t in array array['categories','cards'] loop
    execute format('drop policy if exists admin_insert on public.%I', t);
    execute format('create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin(auth.uid()))', t);
    execute format('drop policy if exists admin_update on public.%I', t);
    execute format('create policy admin_update on public.%I for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))', t);
    execute format('drop policy if exists admin_delete on public.%I', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.is_admin(auth.uid()))', t);
  end loop;
  foreach t in array array['srs_progress','attempts','daily_sessions'] loop
    execute format('drop policy if exists own_read on public.%I', t);
    execute format('create policy own_read on public.%I for select to authenticated using (user_id = auth.uid() and public.is_approved(auth.uid()))', t);
    execute format('drop policy if exists own_insert on public.%I', t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = auth.uid() and public.is_approved(auth.uid()))', t);
    if t <> 'attempts' then
      execute format('drop policy if exists own_update on public.%I', t);
      execute format('create policy own_update on public.%I for update to authenticated using (user_id = auth.uid() and public.is_approved(auth.uid())) with check (user_id = auth.uid() and public.is_approved(auth.uid()))', t);
    end if;
    execute format('drop policy if exists own_delete on public.%I', t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;
drop policy if exists reports_read on public.card_reports;
create policy reports_read on public.card_reports for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists reports_insert on public.card_reports;
create policy reports_insert on public.card_reports for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved(auth.uid()));
drop policy if exists reports_update on public.card_reports;
create policy reports_update on public.card_reports for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists reports_delete on public.card_reports;
create policy reports_delete on public.card_reports for delete to authenticated using (public.is_admin(auth.uid()));
drop policy if exists import_runs_read on public.import_runs;
create policy import_runs_read on public.import_runs for select to authenticated using (public.is_admin(auth.uid()));

insert into storage.buckets(id, name, public) values ('review-pages','review-pages',false)
  on conflict (id) do update set public = false;
drop policy if exists review_pages_admin_read on storage.objects;
create policy review_pages_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'review-pages' and public.is_admin(auth.uid()));
grant select on storage.objects to authenticated;
grant select, insert, update, delete on storage.objects to service_role;
commit;
