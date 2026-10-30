set search_path = public, extensions;

-- Full-text search over published content in English and Arabic, with Arabic normalisation and trigram
-- matching for transliterations (Shu'ayb / Shuaib / Shoaib).

-- Strip tashkeel and tatweel, and fold letter variants, so a query matches with or without vowel marks.
create or replace function public.normalize_arabic(t text)
returns text language sql immutable parallel safe as $$
  select translate(
    regexp_replace(coalesce(t, ''), E'[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]', '', 'g'),
    'أإآٱىةؤئ',
    'اااايهوي'
  );
$$;

-- Fold Latin transliteration marks and apostrophes: "Shu'ayb" → "shuayb", "Ṣāliḥ" → "salih".
create or replace function public.normalize_latin(t text)
returns text language sql immutable parallel safe as $$
  select lower(regexp_replace(translate(coalesce(t, ''), 'ĀāĪīŪūṢṣḌḍṬṭẒẓḤḥ', 'AaIiUuSsDdTtZzHh'), '[''’‘`ʿʾ-]', '', 'g'));
$$;

create table public.search_index (
  entity_type text not null,
  entity_id text not null,
  url text not null check (url ~ '^/'),
  title text not null,
  title_ar text,
  body text not null default '',
  evidence public.evidence_kind,
  facet text not null, -- prophets, stories, events, places, quran, hadith, last_hour
  updated_at timestamptz not null default now(),
  tsv tsvector generated always as (
    setweight(to_tsvector('simple', public.normalize_latin(title)), 'A') ||
    setweight(to_tsvector('simple', public.normalize_arabic(coalesce(title_ar, ''))), 'A') ||
    setweight(to_tsvector('english', body), 'C') ||
    setweight(to_tsvector('simple', public.normalize_arabic(body)), 'D')
  ) stored,
  primary key (entity_type, entity_id)
);
create index search_index_tsv on public.search_index using gin (tsv);
create index search_index_trgm on public.search_index using gin (public.normalize_latin(title) gin_trgm_ops);

alter table public.search_index enable row level security;
alter table public.search_index force row level security;
grant select on public.search_index to anon, authenticated;
create policy read_all on public.search_index for select using (true);

-- Only published rows are ever indexed; unpublishing removes them.
create or replace function public.index_story()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' or new.status <> 'published' then
    delete from public.search_index where entity_type = 'story' and entity_id = coalesce(new.id, old.id)::text;
    return coalesce(new, old);
  end if;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  values ('story', new.id::text, '/stories/' || new.slug, new.title, new.title_ar, new.summary, 'stories')
  on conflict (entity_type, entity_id) do update set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, updated_at = now();
  return new;
end $$;
create trigger stories_index after insert or update or delete on public.stories for each row execute function public.index_story();

create or replace function public.index_event()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' or new.status <> 'published' then
    delete from public.search_index where entity_type = 'event' and entity_id = coalesce(new.id, old.id)::text;
    return coalesce(new, old);
  end if;
  insert into public.search_index (entity_type, entity_id, url, title, title_ar, body, facet)
  values ('event', new.id::text, case when new.category like 'last_hour%' then '/last-hour#' else '/timeline?selected=' end || new.slug,
          new.title, new.title_ar, coalesce(new.summary, ''), case when new.category like 'last_hour%' then 'last_hour' else 'events' end)
  on conflict (entity_type, entity_id) do update set url = excluded.url, title = excluded.title, title_ar = excluded.title_ar, body = excluded.body, facet = excluded.facet, updated_at = now();
  return new;
end $$;
create trigger historical_events_index after insert or update or delete on public.historical_events for each row execute function public.index_event();

create or replace function public.search(q text, facets text[] default null, lim integer default 20, off integer default 0)
returns table (entity_type text, entity_id text, url text, title text, title_ar text, snippet text, facet text, rank real, total bigint)
language sql stable security invoker set search_path = public, extensions as $$
  with query as (
    select websearch_to_tsquery('simple', public.normalize_latin(public.normalize_arabic(q))) as ts_simple,
           websearch_to_tsquery('english', q) as ts_en,
           public.normalize_latin(q) as latin
  ), hits as (
    select s.*, greatest(ts_rank(s.tsv, query.ts_simple), ts_rank(s.tsv, query.ts_en), similarity(public.normalize_latin(s.title), query.latin)) as rank
    from public.search_index s, query
    where (s.tsv @@ query.ts_simple or s.tsv @@ query.ts_en or public.normalize_latin(s.title) % query.latin)
      and (facets is null or s.facet = any (facets))
  )
  select h.entity_type, h.entity_id, h.url, h.title, h.title_ar, left(h.body, 220), h.facet, h.rank::real, count(*) over ()
  from hits h order by h.rank desc, h.title limit least(greatest(lim, 1), 50) offset greatest(off, 0);
$$;
grant execute on function public.search(text, text[], integer, integer) to anon, authenticated;
