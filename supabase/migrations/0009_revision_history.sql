-- Published before/after snapshots and version-specific first-review markers.
begin;

create table if not exists public.card_revisions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  category_slug text not null,
  revision text not null, previous_revision text,
  changed_at timestamptz not null default clock_timestamp(),
  substantive boolean not null,
  before_snapshot jsonb, after_snapshot jsonb not null
);
create index if not exists card_revisions_card_date_idx on public.card_revisions(card_id,changed_at desc,id);
alter table public.card_revisions enable row level security;
revoke all on public.card_revisions from anon, authenticated;
grant select on public.card_revisions to authenticated;
grant all on public.card_revisions to service_role;
drop policy if exists revisions_read on public.card_revisions;
create policy revisions_read on public.card_revisions for select to authenticated
using (public.is_admin(auth.uid()) or (public.is_approved(auth.uid()) and exists
  (select 1 from public.cards c where c.id=card_id and c.status='active')));

alter table public.attempts add column if not exists line_versions jsonb not null default '{}';
alter table public.attempts drop constraint if exists attempts_line_versions_object;
alter table public.attempts add constraint attempts_line_versions_object check(jsonb_typeof(line_versions)='object');
grant select, insert, delete on public.attempts to authenticated;

create or replace function public.card_revision_snapshot(p jsonb)
returns jsonb language sql immutable set search_path=public as $$
  select jsonb_build_object('auction',p->'auction','context',p->'context',
    'section',p->'section','auctionNote',p->'auction_note','notes',p->'notes','lines',p->'lines');
$$;
create or replace function public.revision_content(p jsonb)
returns jsonb language sql immutable set search_path=public as $$
  select p || jsonb_build_object('lines',coalesce((select jsonb_agg(value-'changedAt'-'changedIn'-'changeId' order by ord)
    from jsonb_array_elements(p->'lines') with ordinality as l(value,ord)),'[]'::jsonb));
$$;
revoke all on function public.card_revision_snapshot(jsonb), public.revision_content(jsonb) from public, anon, authenticated;

-- Baseline only: preserve today's published content without labelling it NEW.
insert into public.card_revisions(card_id,category_slug,revision,changed_at,substantive,before_snapshot,after_snapshot)
select c.id,c.category_slug,c.source_revision,c.updated_at,false,null,public.card_revision_snapshot(to_jsonb(c))
from public.cards c where c.status='active' and not exists(select 1 from public.card_revisions r where r.card_id=c.id);

create or replace function public.stamp_published_line_changes()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  baseline jsonb; line jsonb; old_line jsonb; clean jsonb; result jsonb := '[]';
  stamp timestamptz := clock_timestamp(); change_id uuid := gen_random_uuid();
  substantive boolean := coalesce(current_setting('sysloop.substantive_edit',true),'') <> 'false';
begin
  if new.status <> 'active' then return new; end if;
  if TG_OP='UPDATE' and old.status='active' then
    baseline := public.card_revision_snapshot(to_jsonb(old));
  else
    select after_snapshot into baseline from public.card_revisions where card_id=new.id order by changed_at desc,id desc limit 1;
  end if;
  for line in select value from jsonb_array_elements(new.lines) loop
    clean := line-'changedAt'-'changedIn'-'changeId';
    select value into old_line from jsonb_array_elements(coalesce(baseline->'lines','[]')) where value->>'key'=line->>'key';
    if baseline is null or (substantive and (old_line is null or clean is distinct from (old_line-'changedAt'-'changedIn'-'changeId'))) then
      clean := clean || jsonb_build_object('changedAt',stamp,'changedIn',coalesce(nullif(current_setting('sysloop.edit_revision',true),''),new.source_revision),'changeId',change_id);
    elsif old_line is not null then
      if old_line ? 'changedAt' then clean := clean || jsonb_build_object('changedAt',old_line->'changedAt'); end if;
      if old_line ? 'changedIn' then clean := clean || jsonb_build_object('changedIn',old_line->'changedIn'); end if;
      if old_line ? 'changeId' then clean := clean || jsonb_build_object('changeId',old_line->'changeId'); end if;
    end if;
    result := result || jsonb_build_array(clean);
  end loop;
  new.lines := result;
  return new;
end;
$$;
revoke all on function public.stamp_published_line_changes() from public, anon, authenticated;
drop trigger if exists stamp_published_line_changes on public.cards;
create trigger stamp_published_line_changes before insert or update on public.cards
  for each row execute function public.stamp_published_line_changes();

create or replace function public.record_published_card_revision()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  baseline jsonb; next_snapshot jsonb; previous_revision text;
  substantive boolean := coalesce(current_setting('sysloop.substantive_edit',true),'') <> 'false';
begin
  -- Draft contents never become a member-visible historical version.
  if new.status <> 'active' then return new; end if;
  if TG_OP='UPDATE' and old.status='active' then
    baseline := public.card_revision_snapshot(to_jsonb(old));
    select revision into previous_revision from public.card_revisions where card_id=new.id order by changed_at desc,id desc limit 1;
    previous_revision := coalesce(previous_revision,old.source_revision);
  else
    select after_snapshot,revision into baseline,previous_revision from public.card_revisions
      where card_id=new.id order by changed_at desc,id desc limit 1;
  end if;
  next_snapshot := public.card_revision_snapshot(to_jsonb(new));
  if baseline is not null and public.revision_content(baseline)=public.revision_content(next_snapshot) then return new; end if;
  insert into public.card_revisions(card_id,category_slug,revision,previous_revision,substantive,before_snapshot,after_snapshot)
    values(new.id,new.category_slug,coalesce(nullif(current_setting('sysloop.edit_revision',true),''),new.source_revision),previous_revision,baseline is null or substantive,baseline,next_snapshot);
  return new;
end;
$$;
revoke all on function public.record_published_card_revision() from public, anon, authenticated;
drop trigger if exists record_published_card_revision on public.cards;
create trigger record_published_card_revision after insert or update on public.cards
  for each row execute function public.record_published_card_revision();

-- admin_save_card is redefined below with a transaction-local edit classification.

create or replace function public.admin_save_card(p_card jsonb, p_substantive boolean, p_revision text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  old_card public.cards%rowtype;
  candidate public.cards%rowtype;
  item jsonb; old_line jsonb; new_lines jsonb := '[]';
  stamp timestamptz := clock_timestamp();
  previous_edit_kind text := coalesce(current_setting('sysloop.substantive_edit',true),'');
  previous_edit_revision text := coalesce(current_setting('sysloop.edit_revision',true),'');
begin
  if not public.is_admin(auth.uid()) then raise exception 'Wymagane uprawnienia administratora'; end if;
  select * into old_card from public.cards where id = (p_card->>'id')::uuid for update;
  if not found then raise exception 'Nie znaleziono karty'; end if;
  candidate := jsonb_populate_record(old_card, p_card);
  if candidate.id <> old_card.id then raise exception 'Nie można zmienić identyfikatora'; end if;
  if jsonb_typeof(candidate.lines) <> 'array' or jsonb_array_length(candidate.lines) = 0 then
    raise exception 'Karta wymaga odzywek';
  end if;
  if exists (select 1 from jsonb_array_elements(candidate.lines) l
    group by l->>'key' having count(*) > 1) then raise exception 'Powtórzony klucz odzywki'; end if;
  for item in select value from jsonb_array_elements(candidate.lines) loop
    if coalesce(item->>'key','') = '' then raise exception 'Brak klucza odzywki'; end if;
    select value into old_line from jsonb_array_elements(old_card.lines) where value->>'key' = item->>'key';
    -- Klient nie może sam ustawić ani skasować znaczników zmiany.
    item := item - 'changedAt' - 'changedIn';
    if p_substantive and (old_line is null or item is distinct from (old_line - 'changedAt' - 'changedIn')) then
      item := item || jsonb_build_object('changedAt', stamp, 'changedIn', p_revision);
    elsif old_line is not null then
      if old_line ? 'changedAt' then item := item || jsonb_build_object('changedAt',old_line->'changedAt'); end if;
      if old_line ? 'changedIn' then item := item || jsonb_build_object('changedIn',old_line->'changedIn'); end if;
    end if;
    new_lines := new_lines || jsonb_build_array(item);
  end loop;
  perform set_config('sysloop.substantive_edit',case when p_substantive then 'true' else 'false' end,true);
  perform set_config('sysloop.edit_revision',p_revision,true);
  update public.cards set
    category_slug = candidate.category_slug, card_key = candidate.card_key,
    section = candidate.section, sort_order = candidate.sort_order,
    auction = candidate.auction, auction_key = candidate.auction_key,
    context = candidate.context, auction_note = candidate.auction_note,
    notes = candidate.notes, lines = new_lines, status = candidate.status,
    review_flags = candidate.review_flags, verification_note = candidate.verification_note,
    source_page = candidate.source_page, source_revision = candidate.source_revision, updated_at = stamp
  where id = old_card.id;
  perform set_config('sysloop.substantive_edit',previous_edit_kind,true);
  perform set_config('sysloop.edit_revision',previous_edit_revision,true);
  if p_substantive then
    update public.srs_progress set next_review_date = public.revision_review_day()
    where card_id = old_card.id and status <> 'NEW' and next_review_date > public.revision_review_day();
  end if;
  return old_card.id;
end;
$$;
revoke all on function public.admin_save_card(jsonb,boolean,text) from public, anon;
grant execute on function public.admin_save_card(jsonb,boolean,text) to authenticated;

notify pgrst, 'reload schema';
commit;
