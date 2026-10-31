set search_path = public, extensions;

-- Unified search (src/lib/search-engine.ts). The index (public.search_index, migration 0600) now covers every public
-- module: stories and events (0600), Creation Atlas profiles, Life Guidance topics, Life Through the Ages records,
-- Qira'at readers and misconceptions, hadith catalogue references (number and chapter only, never the text) and
-- public Mufti questions. Private questions, drafts and dream requests are never indexed.
--
-- Three locks keep unpublished content out:
--   1. triggers index a row only while public.search_entity_live() says its source row is public;
--   2. RLS on search_index shows a row only while its source is still public (a stale row stays invisible);
--   3. public.search() filters on the same function again.

-- ---------- Normalisation: Urdu letter forms and Eastern digits fold too (mirrors src/lib/search.ts) ----------
create or replace function public.normalize_arabic(t text)
returns text language sql immutable parallel safe as $$
  select translate(
    regexp_replace(normalize(coalesce(t, ''), NFC), E'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u08D3-\u08FF]', '', 'g'),
    'أإآٱىةؤئیےۓکہۂۃھ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    'اااايهوييييكهههه01234567890123456789'
  );
$$;

-- ---------- Which source rows are public: one definition for triggers, RLS and the search function ----------
create table public.search_sources (
  entity_type text primary key,
  table_name text not null,
  id_type text not null check (id_type in ('uuid', 'text')),
  live_predicate text not null, -- SQL over alias t; written by migrations only
  facet text not null,
  url_template text, -- {slug} / {id}; null when a custom trigger builds the row
  title_col text,
  title_ar_col text,
  body_col text
);
alter table public.search_sources enable row level security;
revoke all on public.search_sources from public, anon, authenticated;

insert into public.search_sources (entity_type, table_name, id_type, live_predicate, facet, url_template, title_col, title_ar_col, body_col) values
  ('story', 'stories', 'uuid', $p$t.status = 'published'$p$, 'stories', null, null, null, null),
  ('event', 'historical_events', 'uuid', $p$t.status = 'published'$p$, 'events', null, null, null, null),
  ('creation', 'creation_profiles', 'uuid', $p$t.status = 'published'$p$, 'creation', '/creation/{slug}', 'name_en', 'name_ar', 'classification'),
  ('guidance', 'guidance_topics', 'uuid', $p$t.status = 'published'$p$, 'guidance', '/guidance/{slug}', 'title_en', 'title_ar', 'summary_en'),
  ('hadith', 'hadith_entries', 'uuid', $p$t.status = 'published' and t.collection_id in ('bukhari', 'muslim', 'tirmidhi', 'ibnmajah')$p$, 'hadith', null, null, null, null),
  ('mufti_question', 'mufti_questions', 'uuid', $p$t.visibility = 'public' and t.status in ('accepted', 'assigned', 'answered', 'closed')$p$, 'questions', '/community/questions/{id}', 'title', null, 'body'),
  ('qiraah', 'qiraat', 'text', $p$t.status = 'published'$p$, 'qiraat', '/qiraat#qr-readers-h', 'name_translit', 'name_ar', null),
  ('riwayah', 'riwayat', 'text', $p$t.status = 'published'$p$, 'qiraat', '/qiraat#qr-readers-h', 'name_translit', 'name_ar', null),
  ('qiraat_misconception', 'qiraat_misconceptions', 'uuid', $p$t.status = 'published'$p$, 'qiraat', '/qiraat', 'question', null, null),
  ('lifestyle_era', 'historical_eras', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages', 'name_en', 'name_ar', 'summary'),
  ('lifestyle_community', 'historical_communities', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages', 'name_en', 'name_ar', 'summary'),
  ('lifestyle_food', 'historical_foods', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/food', 'name_en', 'name_ar', 'summary'),
  ('lifestyle_occupation', 'historical_occupations', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/compare', 'title_en', 'title_ar', 'body_md'),
  ('lifestyle_housing', 'historical_housing', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/compare', 'title_en', 'title_ar', 'body_md'),
  ('lifestyle_transport', 'historical_transport', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/compare', 'title_en', 'title_ar', 'body_md'),
  ('lifestyle_activity', 'historical_daily_activities', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/compare', 'title_en', 'title_ar', 'body_md'),
  ('lifestyle_health', 'historical_health_conditions', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/compare', 'title_en', 'title_ar', 'body_md'),
  ('lifestyle_reconstruction', 'historical_reconstructions', 'uuid', $p$t.status = 'published'$p$, 'lifestyle', '/life-through-ages/day', 'title_en', 'title_ar', 'intro_md');

-- True only while the source row exists and is public. Unknown types are never live.
create or replace function public.search_entity_live(etype text, eid text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  src public.search_sources;
  ok boolean;
begin
  select * into src from public.search_sources where entity_type = etype;
  if not found or eid is null then return false; end if;
  if src.id_type = 'uuid' and eid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  execute format('select exists (select 1 from public.%I t where t.id = $1::%s and (%s))', src.table_name, src.id_type, src.live_predicate)
    into ok using eid;
  return coalesce(ok, false);
end $$;
revoke execute on function public.search_entity_live(text, text) from public;
grant execute on function public.search_entity_live(text, text) to anon, authenticated, service_role;

-- RLS: a row is visible only while its source is public. (Rows are written only by the security definer triggers.)
drop policy if exists read_all on public.search_index;
create policy read_live on public.search_index for select using (public.search_entity_live(entity_type, entity_id));
revoke insert, update, delete on public.search_index from anon, authenticated;

-- ---------- Indexing ----------
-- Upsert or remove one row; `rec` is the source row as JSON.
create or replace function public.search_index_row(etype text, rec jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  src public.search_sources;
  eid text := rec ->> 'id';
  v_title text;
begin
  select * into src from public.search_sources where entity_type = etype;
  if not found or src.url_template is null then return; end if;
  v_title := nullif(btrim(rec ->> src.title_col), '');
  if v_title is null or not public.search_entity_live(etype, eid) then
    delete from public.search_index where entity_type = etype and entity_id = eid;
    return;
  end if;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  values (etype, eid,
          replace(replace(src.url_template, '{slug}', coalesce(rec ->> 'slug', '')), '{id}', eid),
          left(v_title, 300),
          nullif(btrim(case when src.title_ar_col is null then null else rec ->> src.title_ar_col end), ''),
          left(coalesce(case when src.body_col is null then null else rec ->> src.body_col end, ''), 2000),
          src.facet)
  on conflict (entity_type, entity_id) do update
    set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, facet = excluded.facet, updated_at = now();
end $$;

-- Generic trigger: tg_argv[0] is the entity type.
create or replace function public.index_search_source()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = tg_argv[0] and entity_id = old.id::text;
    return old;
  end if;
  perform public.search_index_row(tg_argv[0], to_jsonb(new));
  return new;
end $$;

-- Hadith: the catalogue reference only (collection, number, chapter title), never the narration text.
create or replace function public.search_index_hadith(hid uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
begin
  if not public.search_entity_live('hadith', hid::text) then
    delete from public.search_index where entity_type = 'hadith' and entity_id = hid::text;
    return;
  end if;
  select h.id, h.collection_id, h.canonical_number, h.numbering_system, c.name_en, c.name_ar, ch.title_en ch_en, ch.title_ar ch_ar
    into r
  from public.hadith_entries h
  join public.hadith_collections c on c.id = h.collection_id
  left join public.hadith_chapters ch on ch.id = h.chapter_id
  where h.id = hid;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  values ('hadith', r.id::text, '/hadith/' || r.collection_id || '/' || r.canonical_number, r.name_en || ' ' || r.canonical_number,
          r.name_ar || ' ' || r.canonical_number,
          concat_ws(' · ', nullif(r.ch_en, ''), nullif(r.ch_ar, ''), 'Numbering: ' || r.numbering_system), 'hadith')
  on conflict (entity_type, entity_id) do update
    set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, updated_at = now();
end $$;

create or replace function public.index_hadith()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'hadith' and entity_id = old.id::text;
    return old;
  end if;
  perform public.search_index_hadith(new.id);
  return new;
end $$;
create trigger hadith_entries_search after insert or update or delete on public.hadith_entries for each row execute function public.index_hadith();

do $$
declare s record;
begin
  for s in select * from public.search_sources where url_template is not null loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.index_search_source(%L)',
      s.table_name || '_search', s.table_name, s.entity_type);
  end loop;
end $$;

revoke execute on function public.search_index_row(text, jsonb), public.index_search_source(), public.search_index_hadith(uuid), public.index_hadith()
  from public, anon, authenticated;

-- Rebuild the index from the sources (backfill now; staff may run it after bulk imports). Owner / service role only.
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
  -- Stories and events keep their own triggers (migration 0600); the same rows here.
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
  return (select count(*)::int from public.search_index);
end $$;
revoke execute on function public.search_reindex() from public, anon, authenticated;
grant execute on function public.search_reindex() to service_role;

select public.search_reindex();
-- normalize_arabic changed: recompute the stored tsvector of existing rows.
update public.search_index set title = title;

create index if not exists search_index_trgm_ar on public.search_index using gin (public.normalize_arabic(coalesce(title_ar, '')) gin_trgm_ops);

-- ---------- The search function: several spellings at once (aliases), typo tolerant titles, explicit live filter ----------
drop function if exists public.search(text, text[], integer, integer);
create function public.search(q text, facets text[] default null, lim integer default 20, off integer default 0, alts text[] default null)
returns table (entity_type text, entity_id text, url text, title text, title_ar text, snippet text, facet text, rank real, total bigint)
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
    select s.entity_type, s.entity_id, s.url, s.title, s.title_ar, s.body, s.facet,
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
      and public.search_entity_live(s.entity_type, s.entity_id)
    group by s.entity_type, s.entity_id, s.url, s.title, s.title_ar, s.body, s.facet
  )
  select h.entity_type, h.entity_id, h.url, h.title, h.title_ar, left(h.body, 220), h.facet, h.rank::real, count(*) over ()
  from hits h
  order by h.rank desc, h.title
  limit least(greatest(coalesce(lim, 20), 1), 200) offset greatest(coalesce(off, 0), 0);
$$;
grant execute on function public.search(text, text[], integer, integer, text[]) to anon, authenticated;
