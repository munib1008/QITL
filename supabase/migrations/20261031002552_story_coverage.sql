set search_path = public, extensions;

-- Story coverage dashboard and automated story checks: server-side, derived from records (docs/STORY_COVERAGE.md).
--
-- NO NEW TABLE and no manual checkbox: every figure is computed from the records themselves each time it is asked for.
--   * story_coverage_by_subject()  one row per Event Universe item (the 25 prophets, people, communities, events,
--                                  parables, seerah), with the counts below. STAFF ONLY: it carries titles.
--   * story_coverage_counts()      the same, summed (counts only, no titles). STAFF ONLY.
--   * story_coverage_refs()        the Quran passages indexed by an event reference or a chapter, and whether each
--                                  rests on an approved claim. STAFF ONLY (the page compares them with the narrative
--                                  register in content/events/narrative-ranges.json).
--   * story_check_inputs()         the rows the automated checks (src/lib/stories/checks.ts) read. STAFF ONLY.
--   * story_coverage_public        a view of published counts only: it runs with the caller's rights, so an anonymous
--                                  caller counts only what is already public and sees no title.
-- The functions return nothing to anyone who is not editorial staff, and are not executable by anon at all.
--
-- "Discovered" (the item exists in the register) / "researched" (verse references and claims were gathered) /
-- "reviewed" (a scholar approved a chapter, section or the item) / "published" (the item and a part of its story are
-- public) are kept as four separate figures. A title existing never counts as coverage.
--
-- A prophet's story is found through its person record (people.slug = the item's slug, where the journey spells two
-- slugs differently: dhulkifl and zakariya) or through event_stories, and a
-- chapter may also name its event directly (chapters.event_id).

-- ---------- 1. Per subject ----------
create or replace function public.story_coverage_by_subject()
returns table (
  track text, event_id uuid, slug text, title text, status text,
  verse_refs integer, verse_refs_verified integer,
  claims integer, claims_approved integer,
  hadith_links integer, hadith_verified integer,
  chapters integer, chapters_drafted integer, chapters_reviewed integer, chapters_published integer,
  sections integer, sections_drafted integer, sections_reviewed integer, sections_published integer,
  scripts_en integer, scripts_ar integer, scripts_ur integer, translations_pending integer,
  media_approved integer, needs_review integer,
  researched boolean, reviewed boolean, published boolean
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_staff() then
    return;
  end if;
  return query
  with ev as (
    select e.id, e.track, e.slug, e.title, e.status::text as status,
           case when e.track = 'prophets' then (select p.id from public.people p
             where p.slug = case e.slug when 'dhul-kifl' then 'dhulkifl' when 'zakariyya' then 'zakariya' else e.slug end) end as person_id
    from public.historical_events e where e.track is not null and e.merged_into is null
  ),
  ch as (
    select distinct ev.id as eid, c.id as cid, c.status::text as cstatus,
      (c.body_md <> '' or coalesce(c.summary_md, '') <> '' or coalesce(c.deep_md, '') <> '' or coalesce(c.kids_md, '') <> '' or coalesce(c.lessons_md, '') <> '') as has_text,
      public.chapter_review_ok(c.id) as ok
    from ev join public.chapters c on c.event_id = ev.id
       or c.story_id in (select s.id from public.stories s where (ev.person_id is not null and s.person_id = ev.person_id)
                         or s.id in (select es.story_id from public.event_stories es where es.event_id = ev.id))
  ),
  sec as (
    select distinct ev.id as eid, x.id as sid, x.status::text as sstatus, x.claim_id,
      (x.body_md <> '' or x.section = 'fact') as has_text, public.latest_review_approved('story_section', x.id) as ok
    from ev join public.story_sections x on x.audience = 'full' and (x.event_id = ev.id or (ev.person_id is not null and x.person_id = ev.person_id))
  ),
  sc as (
    select ev.id as eid, s.id as scid, s.language, s.status::text as scstatus, s.translated_from,
      case when s.translated_from is null then public.latest_review_approved('story_script', s.id)
           else exists (select 1 from public.translation_reviews t where t.translated_script_id = s.id and t.script_version = s.version and t.aspect = 'linguistic' and t.decision = 'approved')
            and exists (select 1 from public.translation_reviews t where t.translated_script_id = s.id and t.script_version = s.version and t.aspect = 'religious' and t.decision = 'approved') end as ok
    from ev join public.story_scripts s on s.event_id = ev.id or (ev.person_id is not null and s.person_id = ev.person_id)
  ),
  cl as (
    select ev.id as eid, ec.claim_id from ev join public.event_claims ec on ec.event_id = ev.id
    union select ev.id, r.claim_id from ev join public.event_verse_refs r on r.event_id = ev.id where r.claim_id is not null
    union select ch.eid, cc.claim_id from ch join public.chapter_claims cc on cc.chapter_id = ch.cid
    union select sec.eid, sec.claim_id from sec
  ),
  hl as (
    select distinct cl.eid, cr.id as ref_id,
      (c.status in ('approved', 'published') and g.id is not null and public.grade_is_authentic(g.grade) and h.collection_id in ('bukhari', 'muslim', 'tirmidhi', 'ibnmajah')) as verified
    from cl join public.evidence_claims c on c.id = cl.claim_id
    join public.claim_references cr on cr.claim_id = cl.claim_id and cr.kind = 'hadith'
    left join public.hadith_entries h on h.id = cr.hadith_id
    left join public.hadith_gradings g on g.id = cr.hadith_grading_id
  )
  select ev.track, ev.id, ev.slug, ev.title, ev.status,
    (select count(*) from public.event_verse_refs r where r.event_id = ev.id)::integer,
    (select count(*) from public.event_verse_refs r join public.evidence_claims c on c.id = r.claim_id where r.event_id = ev.id and c.status in ('approved', 'published'))::integer,
    (select count(*) from cl where cl.eid = ev.id)::integer,
    (select count(*) from cl join public.evidence_claims c on c.id = cl.claim_id where cl.eid = ev.id and c.status in ('approved', 'published'))::integer,
    (select count(*) from hl where hl.eid = ev.id)::integer,
    (select count(*) from hl where hl.eid = ev.id and hl.verified)::integer,
    (select count(*) from ch where ch.eid = ev.id)::integer,
    (select count(*) from ch where ch.eid = ev.id and ch.has_text)::integer,
    (select count(*) from ch where ch.eid = ev.id and ch.ok)::integer,
    (select count(*) from ch where ch.eid = ev.id and ch.cstatus = 'published')::integer,
    (select count(*) from sec where sec.eid = ev.id)::integer,
    (select count(*) from sec where sec.eid = ev.id and sec.has_text)::integer,
    (select count(*) from sec where sec.eid = ev.id and sec.ok)::integer,
    (select count(*) from sec where sec.eid = ev.id and sec.sstatus = 'published')::integer,
    (select count(*) from sc where sc.eid = ev.id and sc.language = 'en' and sc.scstatus = 'published' and sc.ok)::integer,
    (select count(*) from sc where sc.eid = ev.id and sc.language = 'ar' and sc.scstatus = 'published' and sc.ok)::integer,
    (select count(*) from sc where sc.eid = ev.id and sc.language = 'ur' and sc.scstatus = 'published' and sc.ok)::integer,
    (select count(*) from sc where sc.eid = ev.id and sc.translated_from is not null and not (sc.scstatus = 'published' and sc.ok))::integer,
    (select count(*) from public.story_media m where m.approved_by is not null and (m.event_id = ev.id or (ev.person_id is not null and m.person_id = ev.person_id)))::integer,
    (select count(*) from (
        select 1 from public.content_dependency_versions d where d.stale and d.cleared_at is null
          and ((d.dependant_type = 'chapter' and d.dependant_id in (select cid from ch where ch.eid = ev.id))
            or (d.dependant_type = 'story_section' and d.dependant_id in (select sid from sec where sec.eid = ev.id))
            or (d.dependant_type = 'story_script' and d.dependant_id in (select scid from sc where sc.eid = ev.id)))
        group by d.dependant_type, d.dependant_id) q)::integer,
    ((select count(*) from cl where cl.eid = ev.id) > 0 and (select count(*) from public.event_verse_refs r where r.event_id = ev.id) > 0),
    ((select count(*) from ch where ch.eid = ev.id and ch.ok) + (select count(*) from sec where sec.eid = ev.id and sec.ok) > 0 or public.latest_review_approved('event', ev.id)),
    (ev.status = 'published' and (select count(*) from ch where ch.eid = ev.id and ch.cstatus = 'published') + (select count(*) from sec where sec.eid = ev.id and sec.sstatus = 'published') > 0)
  from ev order by ev.track, ev.slug;
end $$;

-- ---------- 2. Totals (counts only) ----------
create or replace function public.story_coverage_counts()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  out jsonb;
begin
  if not public.is_staff() then
    return null;
  end if;
  select jsonb_build_object(
    'discovered', count(*),
    'researched', count(*) filter (where researched),
    'reviewed', count(*) filter (where reviewed),
    'published', count(*) filter (where published),
    'verse_refs', coalesce(sum(verse_refs), 0), 'verse_refs_verified', coalesce(sum(verse_refs_verified), 0),
    'claims', coalesce(sum(claims), 0), 'claims_approved', coalesce(sum(claims_approved), 0),
    'hadith_links', coalesce(sum(hadith_links), 0), 'hadith_verified', coalesce(sum(hadith_verified), 0),
    'chapters', coalesce(sum(chapters), 0), 'chapters_drafted', coalesce(sum(chapters_drafted), 0),
    'chapters_reviewed', coalesce(sum(chapters_reviewed), 0), 'chapters_published', coalesce(sum(chapters_published), 0),
    'sections', coalesce(sum(sections), 0), 'sections_published', coalesce(sum(sections_published), 0),
    'scripts_en', coalesce(sum(scripts_en), 0), 'scripts_ar', coalesce(sum(scripts_ar), 0), 'scripts_ur', coalesce(sum(scripts_ur), 0),
    'translations_pending', coalesce(sum(translations_pending), 0),
    'media_approved', coalesce(sum(media_approved), 0), 'needs_review', coalesce(sum(needs_review), 0)
  ) into out
  from public.story_coverage_by_subject();
  return out;
end $$;

-- ---------- 3. Quran passages indexed ----------
create or replace function public.story_coverage_refs()
returns table (source text, event_id uuid, surah integer, ayah_from integer, ayah_to integer, verified boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_staff() then
    return;
  end if;
  return query
  select 'event'::text, r.event_id, r.surah::integer, r.ayah_from::integer, r.ayah_to::integer,
         coalesce((select c.status in ('approved', 'published') from public.evidence_claims c where c.id = r.claim_id), false)
  from public.event_verse_refs r
  union all
  select 'chapter'::text, ch.event_id, cr.quran_surah::integer, cr.quran_ayah_from::integer, coalesce(cr.quran_ayah_to, cr.quran_ayah_from)::integer, c.status in ('approved', 'published')
  from public.chapters ch join public.chapter_claims cc on cc.chapter_id = ch.id
  join public.evidence_claims c on c.id = cc.claim_id join public.claim_references cr on cr.claim_id = c.id and cr.kind = 'quran';
end $$;

-- ---------- 4. Inputs of the automated checks ----------
create or replace function public.story_check_inputs()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  out jsonb;
begin
  if not public.is_staff() and coalesce(auth.role(), '') <> 'service_role' then
    return null;
  end if;
  select jsonb_build_object(
    'stories', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'status', s.status, 'personSlug', p.slug)), '[]'::jsonb)
                from public.stories s left join public.people p on p.id = s.person_id),
    'chapters', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'storySlug', s.slug, 'position', c.position, 'anchor', c.anchor, 'title', c.title,
                  'status', c.status, 'eventSlug', e.slug, 'bodyMd', c.body_md, 'summaryMd', c.summary_md, 'deepMd', c.deep_md, 'kidsMd', c.kids_md,
                  'lessonsMd', c.lessons_md, 'unknownsMd', c.unknowns_md)), '[]'::jsonb)
                from public.chapters c join public.stories s on s.id = c.story_id left join public.historical_events e on e.id = c.event_id),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'section', x.section, 'status', x.status, 'subjectSlug', coalesce(p.slug, e.slug),
                  'subjectKind', case when x.person_id is not null then 'person' else 'event' end, 'bodyMd', x.body_md)), '[]'::jsonb)
                from public.story_sections x left join public.people p on p.id = x.person_id left join public.historical_events e on e.id = x.event_id
                where x.audience = 'full'),
    'refs', (select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (
        select 'chapter'::text as "unitKind", c.id as "unitId", ec.id as "claimId", ec.status as "claimStatus", r.kind, r.quran_surah as surah,
               r.quran_ayah_from as "ayahFrom", r.quran_ayah_to as "ayahTo", r.hadith_id as "hadithId", h.collection_id as collection,
               g.grade, (g.id is not null and public.grade_is_authentic(g.grade)) as authentic, src.rights_status as "rightsStatus"
        from public.chapters c join public.chapter_claims cc on cc.chapter_id = c.id join public.evidence_claims ec on ec.id = cc.claim_id
        join public.claim_references r on r.claim_id = ec.id left join public.hadith_entries h on h.id = r.hadith_id
        left join public.hadith_gradings g on g.id = r.hadith_grading_id left join public.sources src on src.id = r.source_id
        union all
        select 'section', x.id, ec.id, ec.status, r.kind, r.quran_surah, r.quran_ayah_from, r.quran_ayah_to, r.hadith_id, h.collection_id,
               g.grade, (g.id is not null and public.grade_is_authentic(g.grade)), src.rights_status
        from public.story_sections x join public.evidence_claims ec on ec.id = x.claim_id
        join public.claim_references r on r.claim_id = ec.id left join public.hadith_entries h on h.id = r.hadith_id
        left join public.hadith_gradings g on g.id = r.hadith_grading_id left join public.sources src on src.id = r.source_id
        where x.audience = 'full') q),
    'unitsWithoutClaims', (select coalesce(jsonb_agg(jsonb_build_object('unitKind', u.k, 'unitId', u.id)), '[]'::jsonb) from (
        select 'chapter'::text as k, c.id from public.chapters c where not exists (select 1 from public.chapter_claims cc where cc.chapter_id = c.id)) u),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('slug', p.slug, 'kind', p.kind, 'status', p.status)), '[]'::jsonb) from public.people p),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('slug', e.slug, 'track', e.track, 'status', e.status, 'orderingKind', e.ordering_kind,
                  'datePrecision', e.date_precision, 'startYear', e.start_year, 'endYear', e.end_year, 'startAh', e.start_ah, 'claimId', e.claim_id)), '[]'::jsonb)
               from public.historical_events e),
    'eventRefs', (select coalesce(jsonb_agg(jsonb_build_object('eventSlug', e.slug, 'surah', r.surah, 'ayahFrom', r.ayah_from, 'ayahTo', r.ayah_to)), '[]'::jsonb)
                  from public.event_verse_refs r join public.historical_events e on e.id = r.event_id),
    'relationships', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'from', pf.slug, 'to', pt.slug, 'kind', r.kind, 'status', r.status,
                  'confidence', r.confidence, 'competingGroup', r.competing_group)), '[]'::jsonb)
                from public.relationships r join public.people pf on pf.id = r.person_from join public.people pt on pt.id = r.person_to),
    'translations', (select coalesce(jsonb_agg(jsonb_build_object('scriptId', s.id, 'language', s.language, 'status', s.status, 'title', s.title,
                  'linguisticOk', exists (select 1 from public.translation_reviews t where t.translated_script_id = s.id and t.script_version = s.version and t.aspect = 'linguistic' and t.decision = 'approved'),
                  'religiousOk', exists (select 1 from public.translation_reviews t where t.translated_script_id = s.id and t.script_version = s.version and t.aspect = 'religious' and t.decision = 'approved'))), '[]'::jsonb)
                from public.story_scripts s where s.translated_from is not null)
  ) into out;
  return out;
end $$;

revoke execute on function public.story_coverage_by_subject(), public.story_coverage_counts(), public.story_coverage_refs(), public.story_check_inputs()
  from public, anon, authenticated;
grant execute on function public.story_coverage_by_subject(), public.story_coverage_counts(), public.story_coverage_refs(), public.story_check_inputs() to authenticated, service_role;

-- ---------- 5. Public: published counts only ----------
create view public.story_coverage_public with (security_invoker = true) as
select (select count(*) from public.stories where status = 'published')::integer as stories_published,
       (select count(*) from public.chapters where status = 'published')::integer as chapters_published,
       (select count(*) from public.story_sections where status = 'published' and audience = 'full')::integer as sections_published;
revoke all on public.story_coverage_public from public, anon, authenticated;
grant select on public.story_coverage_public to anon, authenticated;
