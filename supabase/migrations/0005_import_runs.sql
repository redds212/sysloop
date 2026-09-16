-- Kontrakt propozycji opisany w docs/IMPORT_CONTRACT.md.
begin;
create or replace function public.apply_import_run(p_run_id uuid, p_decisions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  run public.import_runs%rowtype; cat jsonb; change jsonb; decision jsonb; doc jsonb;
  current_card public.cards%rowtype; old_raw jsonb; new_raw jsonb;
  merged jsonb; proposed_line jsonb; db_line jsonb; old_line jsonb; new_line jsonb;
  target_id uuid; state text; approved boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Wymagane uprawnienia administratora'; end if;
  select * into run from public.import_runs where id = p_run_id for update;
  if not found or run.status <> 'pending' then raise exception 'Import nie oczekuje na zastosowanie'; end if;
  -- Importy jednej kategorii nie mogą równocześnie nadpisywać swoich wyników.
  perform pg_advisory_xact_lock(hashtextextended(run.category_slug, 0));
  if (run.proposal->>'baseRunId')::uuid is distinct from
    (select id from public.import_runs where category_slug = run.category_slug and status = 'applied'
      order by applied_at desc, id desc limit 1) then
    raise exception 'Nieaktualna propozycja: przygotuj ponownie różnice';
  end if;
  cat := run.raw_snapshot->'category';
  if cat->>'slug' is distinct from run.category_slug then raise exception 'Niezgodna kategoria'; end if;
  if jsonb_typeof(run.proposal->'changes') is distinct from 'array' then raise exception 'Nieprawidłowa propozycja'; end if;
  insert into public.categories(slug,name,group_name,sort_order,source_file,revision,notes)
  values(run.category_slug,cat->>'name',cat->>'group',coalesce((cat->>'sortOrder')::int,0),
    run.source_file,run.revision,coalesce(cat->'notes','[]'))
  on conflict(slug) do update set source_file = excluded.source_file, revision = excluded.revision,
    notes = excluded.notes, updated_at = now();

  for change in select value from jsonb_array_elements(run.proposal->'changes') loop
    decision := coalesce(p_decisions->(change->>'cardKey'),'{}');
    if coalesce((decision->>'skip')::boolean,false) or change->>'kind' = 'unchanged' then continue; end if;
    if change->>'kind' = 'removed' then
      -- Pozycja połączona z dodaną zachowuje id oraz historię; zajmie się nią krok added.
      if exists (select 1 from jsonb_each(p_decisions) d
          where d.value->>'linkTo' = change->>'cardKey' and not coalesce((d.value->>'skip')::boolean,false)) then continue; end if;
      update public.cards set status = 'archived', updated_at = now()
        where card_key = change->>'cardKey' and category_slug = run.category_slug;
      continue;
    end if;
    if change->>'kind' not in ('added','changed') then raise exception 'Nieznany rodzaj zmiany'; end if;
    doc := change->'card';
    if doc->>'category_slug' is distinct from run.category_slug or doc->>'card_key' is distinct from change->>'cardKey' then
      raise exception 'Niezgodny klucz propozycji';
    end if;
    approved := coalesce((decision->>'approve')::boolean,false)
      or (coalesce(change->>'verification' = 'ok',false) and coalesce(doc->'review_flags','[]') = '[]'::jsonb);
    state := case when approved then 'active' else 'draft' end;
    if approved then doc := doc || jsonb_build_object('review_flags','[]'::jsonb); end if;
    if not approved and coalesce(doc->'review_flags','[]') = '[]'::jsonb then
      doc := doc || jsonb_build_object('review_flags',jsonb_build_array('verifier_uncertain'));
    end if;
    doc := doc || jsonb_build_object('status',state,'source_revision',run.revision);
    select * into current_card from public.cards
      where card_key = coalesce(decision->>'linkTo',change->>'cardKey') and category_slug = run.category_slug for update;
    if decision ? 'linkTo' then
      if change->>'kind' <> 'added' or current_card.id is null then raise exception 'Nieprawidłowe połączenie kart'; end if;
      if not exists (select 1 from jsonb_array_elements(run.proposal->'changes') c
        where c->>'cardKey' = decision->>'linkTo' and c->>'kind' = 'removed') then
        raise exception 'Połączenie wymaga pozycji usuniętej';
      end if;
      if (select count(*) from jsonb_each(p_decisions) d where d.value->>'linkTo' = decision->>'linkTo') > 1 then
        raise exception 'Pozycja może zostać połączona tylko raz';
      end if;
    end if;
    if current_card.id is null then
      if change->>'kind' <> 'added' then raise exception 'Brak zmienianej karty'; end if;
      insert into public.cards(category_slug,card_key,section,sort_order,auction,auction_key,context,
        auction_note,notes,lines,status,review_flags,verification_note,source_page,source_revision)
      values(run.category_slug,doc->>'card_key',coalesce(doc->>'section',''),coalesce((doc->>'sort_order')::int,0),
        doc->'auction',doc->>'auction_key',doc->>'context',doc->>'auction_note',coalesce(doc->'notes','[]'),
        doc->'lines',state,coalesce(doc->'review_flags','[]'),doc->>'verification_note',(doc->>'source_page')::int,run.revision);
    else
      if change->>'kind' = 'added' and not (decision ? 'linkTo') then raise exception 'Dodawana karta już istnieje'; end if;
      -- Raw vs raw: wiersze niezmienione przez PDF zachowują poprawki w bazie.
      old_raw := change->'oldRaw'; new_raw := change->'newRaw'; merged := '[]';
      for proposed_line in select value from jsonb_array_elements(doc->'lines') loop
        select value into old_line from jsonb_array_elements(coalesce(old_raw->'lines','[]')) where value->>'key' = proposed_line->>'key';
        select value into new_line from jsonb_array_elements(coalesce(new_raw->'lines','[]')) where value->>'key' = proposed_line->>'key';
        select value into db_line from jsonb_array_elements(current_card.lines) where value->>'key' = proposed_line->>'key';
        if old_line is not null and old_line = new_line and db_line is not null then
          merged := merged || jsonb_build_array(db_line);
        else merged := merged || jsonb_build_array(proposed_line); end if;
      end loop;
      doc := doc || jsonb_build_object('id', current_card.id, 'lines', merged);
      target_id := public.admin_save_card(doc,not coalesce((decision->>'cosmetic')::boolean,false),run.revision);
    end if;
  end loop;
  update public.import_runs set status = 'applied',applied_at = clock_timestamp(),applied_by = auth.uid() where id = run.id;
end;
$$;
revoke all on function public.apply_import_run(uuid,jsonb) from public, anon;
grant execute on function public.apply_import_run(uuid,jsonb) to authenticated;

create or replace function public.discard_import_run(p_run_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Wymagane uprawnienia administratora'; end if;
  update public.import_runs set status = 'discarded' where id = p_run_id and status = 'pending';
  if not found then raise exception 'Import nie oczekuje na decyzję'; end if;
end;
$$;
revoke all on function public.discard_import_run(uuid) from public, anon;
grant execute on function public.discard_import_run(uuid) to authenticated;
commit;
