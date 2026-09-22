-- Właściciel wykonuje w SQL Editor. Istniejące obrazy pozostają prywatne.
begin;
create or replace function public.card_source(p_card_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.cards%rowtype;
  r public.import_runs%rowtype;
  change jsonb;
  raw_order int;
  source_pages jsonb;
begin
  if not (public.is_approved(auth.uid()) or public.is_admin(auth.uid())) then
    raise exception 'Not approved';
  end if;
  select * into c from public.cards where id=p_card_id and status='active';
  if not found then return null; end if;
  for r in select * from public.import_runs where status='applied'
    and category_slug=c.category_slug and revision=c.source_revision order by applied_at desc,id
  loop
    select x into change from jsonb_array_elements(r.proposal->'changes') x
      where x->>'cardKey'=c.card_key and jsonb_array_length(coalesce(x->'pageImages','[]'))>0 limit 1;
    if change is null then continue; end if;
    select (x->>'sortOrder')::int into raw_order from jsonb_array_elements(r.raw_snapshot->'cards') x
      where x->>'cardKey'=change->'newRaw'->>'cardKey' limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('path',p,'page',substring(p from '/p([0-9]+)\.png$')::int)),'[]')
      into source_pages from jsonb_array_elements_text(change->'pageImages') p
      where p ~ ('^'||r.id::text||'/p[0-9]+\.png$');
    return jsonb_build_object('sourceFile',r.source_file,'revision',r.revision,'cardOrder',coalesce(raw_order,-1),'renderScale',1.5,
      'pages',source_pages,
      'rows',(select coalesce(jsonb_agg(jsonb_build_object('row',x->'row','kind',x->'kind','page',x->'page','bounds',x->'bounds')),'[]')
        from jsonb_array_elements(coalesce(r.raw_snapshot->'audit'->'rows','[]')) x
        where exists(select 1 from jsonb_array_elements(source_pages) p where p->'page'=x->'page')),
      'lineReferences',(select coalesce(jsonb_agg(jsonb_build_object('row',x->'row','cardOrder',x->'cardOrder')),'[]')
        from jsonb_array_elements(coalesce(r.raw_snapshot->'audit'->'lineReferences','[]')) x));
  end loop;
  return null;
end;
$$;
revoke all on function public.card_source(uuid) from public, anon;
grant execute on function public.card_source(uuid) to authenticated;

create or replace function public.can_read_source_page(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_approved(auth.uid()) and exists (
    select 1 from public.import_runs r
      cross join lateral jsonb_array_elements(r.proposal->'changes') ch
      join public.cards c on c.card_key=ch->>'cardKey'
        and c.category_slug=r.category_slug and c.source_revision=r.revision and c.status='active'
    where r.status='applied' and p_path ~ ('^'||r.id::text||'/p[0-9]+\.png$')
      and coalesce(ch->'pageImages','[]') ? p_path
  );
$$;
revoke all on function public.can_read_source_page(text) from public, anon;
grant execute on function public.can_read_source_page(text) to authenticated;
drop policy if exists source_pages_approved_read on storage.objects;
create policy source_pages_approved_read on storage.objects for select to authenticated
  using (bucket_id='review-pages' and public.can_read_source_page(name));
commit;
