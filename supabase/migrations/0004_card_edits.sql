-- Datę zmian merytorycznych wyznacza Europe/Warsaw (decyzja właściciela).
begin;
create or replace function public.revision_review_day()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Warsaw')::date + 1;
$$;
revoke all on function public.revision_review_day() from public, anon, authenticated;

create or replace function public.admin_save_card(p_card jsonb, p_substantive boolean, p_revision text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  old_card public.cards%rowtype;
  candidate public.cards%rowtype;
  item jsonb; old_line jsonb; new_lines jsonb := '[]';
  stamp timestamptz := clock_timestamp();
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
  update public.cards set
    category_slug = candidate.category_slug, card_key = candidate.card_key,
    section = candidate.section, sort_order = candidate.sort_order,
    auction = candidate.auction, auction_key = candidate.auction_key,
    context = candidate.context, auction_note = candidate.auction_note,
    notes = candidate.notes, lines = new_lines, status = candidate.status,
    review_flags = candidate.review_flags, verification_note = candidate.verification_note,
    source_page = candidate.source_page, source_revision = candidate.source_revision, updated_at = stamp
  where id = old_card.id;
  if p_substantive then
    update public.srs_progress set next_review_date = public.revision_review_day()
    where card_id = old_card.id and status <> 'NEW' and next_review_date > public.revision_review_day();
  end if;
  return old_card.id;
end;
$$;
revoke all on function public.admin_save_card(jsonb,boolean,text) from public, anon;
grant execute on function public.admin_save_card(jsonb,boolean,text) to authenticated;
commit;
