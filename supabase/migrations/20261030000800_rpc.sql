set search_path = public, extensions;

-- Read RPCs for the atlas and the genealogy graph. SECURITY INVOKER: RLS still decides what is visible.

create or replace function public.atlas_places(bbox text default null, at_year integer default null)
returns table (id uuid, location_slug text, name text, geom_precision public.geometry_precision, confidence public.evidence_kind, geojson jsonb, source text, attribution text)
language sql stable security invoker set search_path = public, extensions as $$
  with box as (
    select case when bbox is null then null else st_makeenvelope(
      split_part(bbox, ',', 1)::float8, split_part(bbox, ',', 2)::float8,
      split_part(bbox, ',', 3)::float8, split_part(bbox, ',', 4)::float8, 4326) end as env
  )
  select g.id, l.slug, l.name_en, g.precision, g.confidence,
         case when g.geom is null then null else st_asgeojson(g.geom, 5)::jsonb end,
         s.work, s.attribution
  from public.place_geometries g
  join public.locations l on l.id = g.location_id
  left join public.sources s on s.id = g.source_id
  cross join box
  where g.status = 'published' and l.status = 'published'
    and (box.env is null or g.geom is null or g.geom && box.env)
    and (at_year is null or g.valid_from_year is null or (g.valid_from_year <= at_year and coalesce(g.valid_to_year, at_year) >= at_year));
$$;
grant execute on function public.atlas_places(text, integer) to anon, authenticated;

-- People within `depth` edges of a person, and the edges between them, each carrying its claim and references.
create or replace function public.person_graph(person_slug text, depth integer default 2)
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  with recursive start as (
    select id from public.people where slug = person_slug and status = 'published'
  ), walk(pid, d) as (
    select id, 0 from start
    union
    select case when r.person_from = w.pid then r.person_to else r.person_from end, w.d + 1
    from walk w join public.relationships r on (r.person_from = w.pid or r.person_to = w.pid) and r.status = 'published'
    where w.d < least(greatest(depth, 1), 4)
  ), nodes as (
    select distinct on (p.id) p.id, p.slug, p.name_en, p.name_ar, p.kind, w.d
    from walk w join public.people p on p.id = w.pid and p.status = 'published'
    order by p.id, w.d
  )
  select case when not exists (select 1 from start) then null else jsonb_build_object(
    'focus', person_slug,
    'nodes', coalesce((select jsonb_agg(jsonb_build_object('id', n.slug, 'name', n.name_en, 'nameAr', n.name_ar, 'kind', n.kind, 'distance', n.d) order by n.d, n.name_en) from nodes n), '[]'),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'from', pf.slug, 'to', pt.slug, 'kind', r.kind, 'confidence', r.confidence,
        'competingGroup', r.competing_group, 'tradition', r.tradition,
        'claim', jsonb_build_object('id', c.id, 'statement', c.statement, 'evidence', c.evidence,
          'references', coalesce((select jsonb_agg(jsonb_build_object('kind', cr.kind, 'surah', cr.quran_surah, 'from', cr.quran_ayah_from, 'to', cr.quran_ayah_to, 'hadith', cr.hadith_id, 'locator', cr.locator)) from public.claim_references cr where cr.claim_id = c.id), '[]'))))
      from public.relationships r
      join nodes nf on nf.id = r.person_from join nodes nt on nt.id = r.person_to
      join public.people pf on pf.id = r.person_from join public.people pt on pt.id = r.person_to
      join public.evidence_claims c on c.id = r.claim_id
      where r.status = 'published'), '[]')
  ) end;
$$;
grant execute on function public.person_graph(text, integer) to anon, authenticated;
