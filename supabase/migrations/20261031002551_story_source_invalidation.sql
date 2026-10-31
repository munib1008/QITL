set search_path = public, extensions;

-- Source-change invalidation (docs/STORY_ENCYCLOPEDIA_AUDIT.md gap 5).
--
-- Reuses content_dependency_versions (migration 1200: dependant_type/id, source_type/id, stale, flagged_at; chapters
-- migration added reason, cleared_at, cleared_by). NO NEW TABLE. When something a story depends on changes
-- MATERIALLY, every dependant that was already reviewed or published is flagged with the reason and the time:
--
--   source change                                            dependants flagged
--   -------------------------------------------------------  -----------------------------------------------------
--   a claim's text or evidence class changes, or the claim   chapters, stories (summaries), story sections, quizzes,
--   leaves approved/published                                media, scripts (and their translations), audio
--   a claim reference (Quran range, hadith, tafsir link,     the same, through the claim
--   history/scholar source) is added, changed or removed on
--   an approved/published claim
--   a hadith grading is recorded, changed or removed         the same, for every claim citing that narration
--   (a dissenting grading counts: every grading is shown)
--   a hadith commentary link is unpublished/changed          the same, for every claim citing that narration
--   a verse reference of an event changes                    chapters, sections, scripts and stories of that event
--
-- The PUBLISHED SNAPSHOT STAYS FROZEN: flagging never edits a dependant (published rows cannot change in place); it
-- only adds a row to the queue. A flagged chapter or story cannot be (re)published until a scholarly reviewer approves
-- it again after the flag (a review bound to its version), and only while all its claims are still approved.
-- Drafts are never flagged (they have not been reviewed). Audio is flagged, never switched off.

-- ---------- 1. What depends on a claim, and what a dependant rests on ----------
create or replace function public.claim_dependants(cid uuid)
returns table (dtype text, did uuid)
language sql stable security definer set search_path = public, extensions as $$
  select 'chapter'::text, c.id from public.chapter_claims cc join public.chapters c on c.id = cc.chapter_id
    where cc.claim_id = cid and c.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'story'::text, s.id from public.chapter_claims cc join public.chapters c on c.id = cc.chapter_id join public.stories s on s.id = c.story_id
    where cc.claim_id = cid and s.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'story_section'::text, x.id from public.story_sections x
    where x.claim_id = cid and x.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'quiz'::text, z.id from public.quiz_questions q join public.story_quizzes z on z.id = q.quiz_id
    where q.claim_id = cid and z.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'media'::text, m.id from public.story_media m
    where m.claim_id = cid and m.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'story_script'::text, sc.id from public.scene_claim_references r
    join public.story_scenes s on s.id = r.scene_id join public.story_scripts sc on sc.id = s.script_id
    where r.claim_id = cid and sc.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'story_script'::text, t.id from public.scene_claim_references r
    join public.story_scenes s on s.id = r.scene_id join public.story_scripts t on t.translated_from = s.script_id
    where r.claim_id = cid and t.status in ('in_review', 'approved', 'published', 'correction')
  union
  select 'narration_audio'::text, a.id from public.scene_claim_references r
    join public.narration_audio a on a.scene_id = r.scene_id
    where r.claim_id = cid and a.status = 'approved';
$$;

create or replace function public.dependant_claim_ids(dt text, did uuid)
returns table (claim_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select cc.claim_id from public.chapter_claims cc where dt = 'chapter' and cc.chapter_id = did
  union
  select cc.claim_id from public.chapters c join public.chapter_claims cc on cc.chapter_id = c.id where dt = 'story' and c.story_id = did
  union
  select x.claim_id from public.story_sections x where dt = 'story_section' and x.id = did
  union
  select q.claim_id from public.quiz_questions q where dt = 'quiz' and q.quiz_id = did
  union
  select m.claim_id from public.story_media m where dt = 'media' and m.id = did
  union
  select r.claim_id from public.story_scenes s join public.scene_claim_references r on r.scene_id = s.id
    where dt = 'story_script' and (s.script_id = did or s.script_id = (select translated_from from public.story_scripts where id = did))
  union
  select r.claim_id from public.narration_audio a join public.scene_claim_references r on r.scene_id = a.scene_id where dt = 'narration_audio' and a.id = did;
$$;

-- True while every claim a dependant rests on is still approved or published.
create or replace function public.dependant_claims_ok(dt text, did uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select not exists (
    select 1 from public.dependant_claim_ids(dt, did) d join public.evidence_claims c on c.id = d.claim_id
    where c.status not in ('approved', 'published'));
$$;

-- ---------- 2. Flagging ----------
create or replace function public.flag_row(dt text, did uuid, st text, sid uuid, why text)
returns void language sql security definer set search_path = public, extensions as $$
  insert into public.content_dependency_versions (dependant_type, dependant_id, source_type, source_id, source_version, stale, flagged_at, reason)
  values (dt, did, st, sid, 1, true, now(), left(why, 500))
  on conflict (dependant_type, dependant_id, source_type, source_id) do update
    set stale = true, flagged_at = now(), reason = excluded.reason, cleared_at = null, cleared_by = null,
        source_version = public.content_dependency_versions.source_version + 1;
$$;

create or replace function public.flag_claim_dependants(cid uuid, why text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  d record;
  n integer := 0;
begin
  for d in select * from public.claim_dependants(cid) loop
    perform public.flag_row(d.dtype, d.did, 'claim', cid, why);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Dependants of an event's verse references: chapters, sections, scripts, and the stories linked to the event.
create or replace function public.flag_event_dependants(eid uuid, why text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  d record;
  n integer := 0;
begin
  for d in
    select 'chapter'::text as dtype, c.id as did from public.chapters c
      where c.status in ('in_review', 'approved', 'published', 'correction')
        and (c.event_id = eid or c.story_id in (select story_id from public.event_stories where event_id = eid))
    union
    select 'story', s.id from public.stories s
      where s.status in ('in_review', 'approved', 'published', 'correction') and s.id in (select story_id from public.event_stories where event_id = eid)
    union
    select 'story_section', x.id from public.story_sections x where x.event_id = eid and x.status in ('in_review', 'approved', 'published', 'correction')
    union
    select 'story_script', sc.id from public.story_scripts sc where sc.event_id = eid and sc.status in ('in_review', 'approved', 'published', 'correction')
  loop
    perform public.flag_row(d.dtype, d.did, 'event', eid, why);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- 3. Triggers on the sources ----------
create or replace function public.claims_flag_dependants()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if old.status in ('approved', 'published') and new.status not in ('approved', 'published') then
    perform public.flag_claim_dependants(new.id, 'A claim it rests on is no longer approved (now ' || new.status || ').');
  elsif old.status in ('approved', 'published') and (old.statement is distinct from new.statement or old.evidence is distinct from new.evidence) then
    perform public.flag_claim_dependants(new.id, 'The text or evidence class of a claim it rests on changed.');
  end if;
  return null;
end $$;
create trigger evidence_claims_flag after update on public.evidence_claims for each row execute function public.claims_flag_dependants();

create or replace function public.references_flag_dependants()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.claim_references := case when tg_op = 'DELETE' then old else new end;
  what text;
  cid uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'created_at') = (to_jsonb(old) - 'created_at') then
    return null;
  end if;
  what := case r.kind
    when 'quran' then 'Quran reference ' || r.quran_surah || ':' || r.quran_ayah_from || coalesce('-' || r.quran_ayah_to, '')
    when 'hadith' then 'hadith reference'
    when 'tafsir' then 'tafsir link'
    else r.kind || ' source' end;
  for cid in select distinct x from unnest(array[r.claim_id, case when tg_op = 'UPDATE' then old.claim_id end]) x where x is not null loop
    if exists (select 1 from public.evidence_claims c where c.id = cid and c.status in ('approved', 'published')) then
      perform public.flag_claim_dependants(cid, 'A ' || what || ' of a claim it rests on was ' ||
        case tg_op when 'INSERT' then 'added.' when 'DELETE' then 'removed.' else 'changed.' end);
    end if;
  end loop;
  return null;
end $$;
create trigger claim_references_flag after insert or update or delete on public.claim_references for each row execute function public.references_flag_dependants();

-- A grading recorded, changed or removed for a narration a claim cites. A new dissenting grading is material too:
-- every recorded grading is shown, so a claim resting on the narration must be looked at again.
create or replace function public.gradings_flag_dependants()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  g public.hadith_gradings := case when tg_op = 'DELETE' then old else new end;
  why text;
  cid uuid;
begin
  if tg_op = 'INSERT' then
    if public.grade_is_authentic(new.grade) then return null; end if;
    why := 'A ' || new.grade || ' grading by ' || new.grader || ' was recorded for a hadith it cites.';
  elsif tg_op = 'UPDATE' then
    if (new.grade, new.grader, new.source_id, new.hadith_id) is not distinct from (old.grade, old.grader, old.source_id, old.hadith_id) then return null; end if;
    why := 'The grading by ' || old.grader || ' (' || old.grade || ') of a hadith it cites changed.';
  else
    why := 'The grading by ' || old.grader || ' (' || old.grade || ') of a hadith it cites was removed.';
  end if;
  for cid in
    select distinct r.claim_id from public.claim_references r join public.evidence_claims c on c.id = r.claim_id
    where r.kind = 'hadith' and r.hadith_id in (g.hadith_id, case when tg_op = 'UPDATE' then old.hadith_id end) and c.status in ('approved', 'published')
  loop
    perform public.flag_claim_dependants(cid, why);
  end loop;
  return null;
end $$;
create trigger hadith_gradings_flag after insert or update or delete on public.hadith_gradings for each row execute function public.gradings_flag_dependants();

-- A commentary (tafsir-style) link of a hadith that was published and is changed or withdrawn.
create or replace function public.commentary_flag_dependants()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  cid uuid;
begin
  if old.status <> 'published' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status = 'published' and (new.edition_id, new.locator) is not distinct from (old.edition_id, old.locator) then
    return null;
  end if;
  for cid in
    select distinct r.claim_id from public.claim_references r join public.evidence_claims c on c.id = r.claim_id
    where r.kind = 'hadith' and r.hadith_id = old.hadith_id and c.status in ('approved', 'published')
  loop
    perform public.flag_claim_dependants(cid, 'A commentary link of a hadith it cites was changed or withdrawn.');
  end loop;
  return null;
end $$;
create trigger hadith_commentary_links_flag after update or delete on public.hadith_commentary_links for each row execute function public.commentary_flag_dependants();

create or replace function public.event_refs_flag_dependants()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.event_verse_refs := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and (new.surah, new.ayah_from, new.ayah_to, new.event_id) is not distinct from (old.surah, old.ayah_from, old.ayah_to, old.event_id) then
    return null;
  end if;
  perform public.flag_event_dependants(r.event_id, 'A verse reference of the event it covers (' || r.surah || ':' || r.ayah_from || '-' || r.ayah_to || ') was ' ||
    case tg_op when 'INSERT' then 'added.' when 'DELETE' then 'removed.' else 'changed.' end);
  if tg_op = 'UPDATE' and old.event_id <> new.event_id then
    perform public.flag_event_dependants(old.event_id, 'A verse reference of the event it covers was moved to another event.');
  end if;
  return null;
end $$;
create trigger event_verse_refs_flag after insert or update or delete on public.event_verse_refs for each row execute function public.event_refs_flag_dependants();

-- ---------- 4. Clearing: a fresh scholarly approval after the flag, while the claims are still sound ----------
create or replace function public.reviews_clear_flags()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  dt text := case new.entity_type when 'chapter' then 'chapter' when 'story' then 'story' when 'story_section' then 'story_section'
    when 'quiz' then 'quiz' when 'media' then 'media' when 'story_script' then 'story_script' end;
begin
  if dt is null or new.decision <> 'approved' then
    return null;
  end if;
  if public.dependant_claims_ok(dt, new.entity_id) then
    update public.content_dependency_versions
      set cleared_at = now(), cleared_by = new.reviewer_id
      where dependant_type = dt and dependant_id = new.entity_id and stale and cleared_at is null and flagged_at <= new.created_at;
    -- The audio of a re-approved script: its narration text is unchanged and the script was re-checked.
    if dt = 'story_script' then
      update public.content_dependency_versions
        set cleared_at = now(), cleared_by = new.reviewer_id
        where dependant_type = 'narration_audio' and stale and cleared_at is null and flagged_at <= new.created_at
          and dependant_id in (select a.id from public.narration_audio a join public.story_scenes s on s.id = a.scene_id where s.script_id = new.entity_id);
    end if;
  end if;
  return null;
end $$;
create trigger editorial_reviews_clear_flags after insert on public.editorial_reviews for each row execute function public.reviews_clear_flags();

-- ---------- 5. The "Needs re-review" queue (staff only) ----------
create or replace function public.story_needs_rereview()
returns table (dependant_type text, dependant_id uuid, title text, story_slug text, status text, reasons text[], flagged_at timestamptz, sources integer)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_staff() then
    return;
  end if;
  return query
  select d.dependant_type, d.dependant_id,
    case d.dependant_type
      when 'chapter' then (select c.title from public.chapters c where c.id = d.dependant_id)
      when 'story' then (select s.title from public.stories s where s.id = d.dependant_id)
      when 'story_section' then (select coalesce(x.title, x.section) from public.story_sections x where x.id = d.dependant_id)
      when 'quiz' then (select z.title from public.story_quizzes z where z.id = d.dependant_id)
      when 'media' then (select m.caption from public.story_media m where m.id = d.dependant_id)
      when 'story_script' then (select sc.title || ' (' || sc.language || ')' from public.story_scripts sc where sc.id = d.dependant_id)
      when 'narration_audio' then (select 'Audio, scene ' || s.position || ' of ' || sc.title from public.narration_audio a
        join public.story_scenes s on s.id = a.scene_id join public.story_scripts sc on sc.id = s.script_id where a.id = d.dependant_id)
      else d.dependant_type end,
    case d.dependant_type
      when 'chapter' then (select s.slug from public.chapters c join public.stories s on s.id = c.story_id where c.id = d.dependant_id)
      when 'story' then (select s.slug from public.stories s where s.id = d.dependant_id)
      else null end,
    case d.dependant_type
      when 'chapter' then (select c.status::text from public.chapters c where c.id = d.dependant_id)
      when 'story' then (select s.status::text from public.stories s where s.id = d.dependant_id)
      when 'story_section' then (select x.status::text from public.story_sections x where x.id = d.dependant_id)
      when 'quiz' then (select z.status::text from public.story_quizzes z where z.id = d.dependant_id)
      when 'media' then (select m.status::text from public.story_media m where m.id = d.dependant_id)
      when 'story_script' then (select sc.status::text from public.story_scripts sc where sc.id = d.dependant_id)
      when 'narration_audio' then (select a.status from public.narration_audio a where a.id = d.dependant_id)
      else null end,
    array_agg(distinct coalesce(d.reason, 'A source it was built from changed.')),
    max(d.flagged_at),
    count(*)::integer
  from public.content_dependency_versions d
  where d.stale and d.cleared_at is null
  group by d.dependant_type, d.dependant_id
  order by max(d.flagged_at) desc nulls last;
end $$;

revoke execute on function public.claim_dependants(uuid), public.dependant_claim_ids(text, uuid), public.dependant_claims_ok(text, uuid),
  public.flag_row(text, uuid, text, uuid, text), public.flag_claim_dependants(uuid, text), public.flag_event_dependants(uuid, text),
  public.claims_flag_dependants(), public.references_flag_dependants(), public.gradings_flag_dependants(), public.commentary_flag_dependants(),
  public.event_refs_flag_dependants(), public.reviews_clear_flags(), public.story_needs_rereview() from public, anon, authenticated;
grant execute on function public.story_needs_rereview() to authenticated;
