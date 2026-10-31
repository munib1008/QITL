set search_path = public, extensions;

-- Unified story search with typed results and facets (docs/STORY_ENCYCLOPEDIA_AUDIT.md, gap 6).
--
-- Builds on migration 20261031002200: the same three locks keep unpublished content out (the index triggers, RLS on
-- search_index through search_entity_live(), and the explicit filter in search()). New here:
--   * search_index.kind    prophet | person | community | event | parable | hadith_story | story  (the visible type label)
--   * search_index.track   the Event Universe track of an event, person or community item (prophets, people, communities, events, parables, seerah)
--   * search_index.surahs  the surahs a record's Quran references fall in (from approved claims / verse references)
--   * new sources         published people (EN/AR names, aliases of any language) and published hadith stories (EN/AR/UR titles);
--                         published communities now open the community page
--   * search(..., kinds, tracks, surah)  three optional filters; the first five parameters and their order are unchanged.
-- Only published rows are indexed. Hadith text is never indexed (a hadith story is indexed by its own title and summary).

alter table public.search_index
  add column kind text,
  add column track text,
  add column surahs smallint[] not null default '{}';
create index search_index_kind on public.search_index (kind) where kind is not null;
create index search_index_surahs on public.search_index using gin (surahs);

-- ---------- Sources ----------
insert into public.search_sources (entity_type, table_name, id_type, live_predicate, facet, url_template, title_col, title_ar_col, body_col) values
  ('person', 'people', 'uuid', $p$t.status = 'published'$p$, 'people', null, null, null, null),
  ('hadith_story', 'hadith_stories', 'uuid', $p$t.status = 'published'$p$, 'hadith_stories', null, null, null, null);
-- A published community now has its own page.
update public.search_sources set facet = 'communities', url_template = '/communities/{slug}' where entity_type = 'lifestyle_community';

-- ---------- The surahs of a record ----------
create or replace function public.search_record_surahs(etype text, eid text)
returns smallint[] language plpgsql stable security definer set search_path = public, extensions as $$
declare
  u uuid;
  out smallint[] := '{}';
begin
  if eid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return out; end if;
  u := eid::uuid;
  if etype = 'event' then
    select coalesce(array_agg(distinct surah), '{}') into out from public.event_verse_refs where event_id = u;
  elsif etype = 'person' then
    select coalesce(array_agg(distinct s), '{}') into out from (
      select r.quran_surah s from public.person_claims pc join public.claim_references r on r.claim_id = pc.claim_id and r.kind = 'quran' where pc.person_id = u
      union select v.surah from public.people p join public.event_verse_refs v on v.event_id = p.subject_event_id where p.id = u
    ) x where s is not null;
  elsif etype = 'lifestyle_community' then
    select coalesce(array_agg(distinct s), '{}') into out from (
      select r.quran_surah s from public.historical_communities c join public.claim_references r on r.claim_id = c.claim_id and r.kind = 'quran' where c.id = u
      union select v.surah from public.historical_communities c join public.event_verse_refs v on v.event_id = c.subject_event_id where c.id = u
    ) x where s is not null;
  elsif etype = 'hadith_story' then
    select coalesce(array_agg(distinct r.quran_surah), '{}') into out
    from public.hadith_story_claims sc join public.claim_references r on r.claim_id = sc.claim_id and r.kind = 'quran' where sc.story_id = u and r.quran_surah is not null;
  end if;
  return out;
end $$;
revoke execute on function public.search_record_surahs(text, text) from public, anon, authenticated;

-- ---------- Type, track and surahs are set on every write of an index row ----------
create or replace function public.search_index_meta()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  trk text;
  pkind text;
begin
  new.kind := null;
  new.track := null;
  new.surahs := '{}';
  if new.entity_type = 'story' then
    new.kind := 'story';
  elsif new.entity_type = 'event' then
    if new.entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select track into trk from public.historical_events where id = new.entity_id::uuid;
    end if;
    new.track := trk;
    new.kind := case trk when 'prophets' then 'prophet' when 'people' then 'person' when 'communities' then 'community' when 'parables' then 'parable' else 'event' end;
    -- An item of the Complete Timeline has its own page.
    if trk is not null then new.url := '/events/' || regexp_replace(new.url, '^.*[=/]', ''); end if;
  elsif new.entity_type = 'person' then
    select p.kind into pkind from public.people p where new.entity_id ~ '^[0-9a-f-]{36}$' and p.id = new.entity_id::uuid;
    new.kind := case when pkind = 'prophet' then 'prophet' else 'person' end;
    select e.track into new.track from public.people p join public.historical_events e on e.id = p.subject_event_id where new.entity_id ~ '^[0-9a-f-]{36}$' and p.id = new.entity_id::uuid;
  elsif new.entity_type = 'lifestyle_community' then
    new.kind := 'community';
    select e.track into new.track from public.historical_communities c join public.historical_events e on e.id = c.subject_event_id where new.entity_id ~ '^[0-9a-f-]{36}$' and c.id = new.entity_id::uuid;
  elsif new.entity_type = 'hadith_story' then
    new.kind := 'hadith_story';
  end if;
  new.surahs := public.search_record_surahs(new.entity_type, new.entity_id);
  return new;
end $$;
revoke execute on function public.search_index_meta() from public, anon, authenticated;
create trigger a1_search_index_meta before insert or update on public.search_index for each row execute function public.search_index_meta();

-- ---------- People: names (EN/AR), then the summary and every alias (any language) ----------
create or replace function public.search_index_person(pid uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
begin
  if not public.search_entity_live('person', pid::text) then
    delete from public.search_index where entity_type = 'person' and entity_id = pid::text;
    return;
  end if;
  select p.id, p.slug, p.name_en, p.name_ar, p.summary,
         (select string_agg(a.alias, ' · ' order by a.alias) from public.person_aliases a where a.person_id = p.id) aliases
    into r from public.people p where p.id = pid;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  values ('person', r.id::text, '/people/' || r.slug, left(r.name_en, 300), nullif(btrim(r.name_ar), ''),
          left(concat_ws(' · ', nullif(btrim(r.summary), ''), r.aliases), 2000), 'people')
  on conflict (entity_type, entity_id) do update
    set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, facet = excluded.facet, updated_at = now();
end $$;

create or replace function public.index_person()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'person' and entity_id = old.id::text;
    return old;
  end if;
  perform public.search_index_person(new.id);
  return new;
end $$;
create trigger people_search after insert or update or delete on public.people for each row execute function public.index_person();

create or replace function public.index_person_alias()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.search_index_person(case when tg_op = 'DELETE' then old.person_id else new.person_id end);
  return null;
end $$;
create trigger person_aliases_search after insert or update or delete on public.person_aliases for each row execute function public.index_person_alias();

-- ---------- Hadith stories: EN title, AR title; the Urdu title, narrator and summaries in the body ----------
create or replace function public.search_index_hadith_story(sid uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.hadith_stories;
begin
  if not public.search_entity_live('hadith_story', sid::text) then
    delete from public.search_index where entity_type = 'hadith_story' and entity_id = sid::text;
    return;
  end if;
  select * into r from public.hadith_stories where id = sid;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  values ('hadith_story', r.id::text, '/hadith-stories/' || r.slug, left(r.title_en, 300), nullif(btrim(r.title_ar), ''),
          left(concat_ws(' · ', nullif(btrim(r.summary_en), ''), r.title_ur, r.narrator_en, r.narrator_ar, r.narrator_ur, r.summary_ar, r.summary_ur), 2000), 'hadith_stories')
  on conflict (entity_type, entity_id) do update
    set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, facet = excluded.facet, updated_at = now();
end $$;

create or replace function public.index_hadith_story()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'hadith_story' and entity_id = old.id::text;
    return old;
  end if;
  perform public.search_index_hadith_story(new.id);
  return new;
end $$;
create trigger hadith_stories_search after insert or update or delete on public.hadith_stories for each row execute function public.index_hadith_story();

-- Quran connections arrive as parts of a draft story; the index row is written when the story is published (its parts are frozen then).
revoke execute on function public.search_index_person(uuid), public.index_person(), public.index_person_alias(),
  public.search_index_hadith_story(uuid), public.index_hadith_story() from public, anon, authenticated;

-- ---------- Rebuild: the previous sources, plus people and hadith stories ----------
create or replace function public.search_reindex()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  s record;
  r record;
begin
  delete from public.search_index i where not public.search_entity_live(i.entity_type, i.entity_id);
  for s in select * from public.search_sources where url_template is not null loop
    for r in execute format('select to_jsonb(t) j from public.%I t where %s', s.table_name, s.live_predicate) loop
      perform public.search_index_row(s.entity_type, r.j);
    end loop;
  end loop;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  select 'story', st.id::text, '/stories/' || st.slug, st.title, st.title_ar, st.summary, 'stories' from public.stories st where st.status = 'published'
  on conflict (entity_type, entity_id) do update set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, updated_at = now();
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  select 'event', e.id::text, case when e.category like 'last_hour%' then '/last-hour#' else '/timeline?selected=' end || e.slug, e.title, e.title_ar,
         coalesce(e.summary, ''), case when e.category like 'last_hour%' then 'last_hour' else 'events' end
  from public.historical_events e where e.status = 'published'
  on conflict (entity_type, entity_id) do update set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, facet = excluded.facet, updated_at = now();
  for r in select id from public.hadith_entries where status = 'published' loop
    perform public.search_index_hadith(r.id);
  end loop;
  for r in select id from public.people where status = 'published' loop
    perform public.search_index_person(r.id);
  end loop;
  for r in select id from public.hadith_stories where status = 'published' loop
    perform public.search_index_hadith_story(r.id);
  end loop;
  -- Recompute type, track and surahs of every row (also after a record's verse references changed).
  update public.search_index set title = title;
  return (select count(*)::int from public.search_index);
end $$;
revoke execute on function public.search_reindex() from public, anon, authenticated;
grant execute on function public.search_reindex() to service_role;

select public.search_reindex();

-- ---------- The search function: three optional filters appended ----------
drop function if exists public.search(text, text[], integer, integer, text[]);
create function public.search(q text, facets text[] default null, lim integer default 20, off integer default 0, alts text[] default null,
                              kinds text[] default null, tracks text[] default null, surah smallint default null)
returns table (entity_type text, entity_id text, url text, title text, title_ar text, snippet text, facet text, rank real, total bigint, kind text, track text, surahs smallint[])
language sql stable security invoker set search_path = public, extensions as $$
  with terms as (
    select distinct left(btrim(x), 120) as term
    from unnest(array[q] || coalesce(alts[1:6], '{}'::text[])) as x
    where char_length(btrim(coalesce(x, ''))) > 0
  ), query as (
    select websearch_to_tsquery('simple', public.normalize_latin(public.normalize_arabic(term))) as ts_simple,
           websearch_to_tsquery('english', term) as ts_en,
           public.normalize_latin(public.normalize_arabic(term)) as latin,
           public.normalize_arabic(term) as arabic
    from terms
  ), hits as (
    select s.entity_type, s.entity_id, s.url, s.title, s.title_ar, s.body, s.facet, s.kind, s.track, s.surahs,
           max(greatest(ts_rank(s.tsv, query.ts_simple), ts_rank(s.tsv, query.ts_en),
                        similarity(public.normalize_latin(s.title), query.latin),
                        word_similarity(query.latin, public.normalize_latin(s.title)),
                        similarity(public.normalize_arabic(coalesce(s.title_ar, '')), query.arabic))) as rank
    from public.search_index s cross join query
    where (s.tsv @@ query.ts_simple
        or s.tsv @@ query.ts_en
        or public.normalize_latin(s.title) % query.latin
        or query.latin <% public.normalize_latin(s.title)
        or (s.title_ar is not null and public.normalize_arabic(s.title_ar) % query.arabic))
      and (facets is null or s.facet = any (facets))
      and (kinds is null or s.kind = any (kinds))
      and (tracks is null or s.track = any (tracks))
      and (surah is null or surah = any (s.surahs))
      and public.search_entity_live(s.entity_type, s.entity_id)
    group by s.entity_type, s.entity_id, s.url, s.title, s.title_ar, s.body, s.facet, s.kind, s.track, s.surahs
  )
  select h.entity_type, h.entity_id, h.url, h.title, h.title_ar, left(h.body, 220), h.facet, h.rank::real, count(*) over (), h.kind, h.track, h.surahs
  from hits h
  order by h.rank desc, h.title
  limit least(greatest(coalesce(lim, 20), 1), 200) offset greatest(coalesce(off, 0), 0);
$$;
grant execute on function public.search(text, text[], integer, integer, text[], text[], text[], smallint) to anon, authenticated;
