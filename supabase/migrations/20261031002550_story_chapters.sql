set search_path = public, extensions;

-- Story chapters and depth modes (docs/STORY_ENCYCLOPEDIA_AUDIT.md gap 3).
--
-- NO NEW CONTENT TABLE. The chapter object already exists (stories -> chapters -> chapter_claims -> evidence_claims ->
-- claim_references, with the 'story' and 'chapter' review types), so this migration EXTENDS `chapters` and `stories`:
--   * an anchor (individually linkable: /stories/<slug>#chapter-<anchor>) and an optional link to a timeline event;
--   * the depth modes as columns of the chapter itself, all resting on the chapter's claims and reviewed together:
--       summary_md  One-Minute Summary          body_md   Complete Story (the existing column)
--       deep_md     Deep Study                  kids_md   Kids Mode
--       lessons_md  Life Lessons (shown labelled as educational interpretation)
--       unknowns_md what the sources do not establish ("Sources and uncertainties")
--     A mode left empty renders the "not established / under review" state; nothing is ever filled in.
--   * a version on chapters and stories; a scholarly review BINDS to the version it was given for
--     (editorial_reviews.entity_version, stamped by the database), as in Shifa; editing a draft makes a new version, so
--     the earlier approval no longer counts.
--   * published rows are frozen (move to correction first), and so are the claims behind a published chapter.
--   * chapters get an author column (created_by, stamped) and are registered in review_entity_authors, so a reviewer
--     never approves their own chapter (tests/db/security.test.ts).
-- A view lists each chapter's verse references (derived from its claims' Quran references, never typed twice).

-- ---------- 1. chapters: anchor, event link, depth modes, version, author ----------
alter table public.chapters
  add column anchor text,
  add column event_id uuid references public.historical_events (id) on delete set null,
  add column summary_md text check (char_length(summary_md) <= 4000),
  add column deep_md text check (char_length(deep_md) <= 40000),
  add column kids_md text check (char_length(kids_md) <= 8000),
  add column lessons_md text check (char_length(lessons_md) <= 8000),
  add column unknowns_md text check (char_length(unknowns_md) <= 4000),
  add column version integer not null default 1,
  add column created_by uuid references auth.users (id) on delete set null;

-- Chapters that predate anchors get their position (the page links them as #chapter-<position>).
update public.chapters set anchor = position::text where anchor is null;
alter table public.chapters alter column anchor set not null;
alter table public.chapters add constraint chapters_anchor_check check (anchor ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index chapters_story_anchor on public.chapters (story_id, anchor);
create index chapters_event on public.chapters (event_id) where event_id is not null;

alter table public.stories add column version integer not null default 1;

-- ---------- 2. Reviews bind to the version ----------
alter table public.editorial_reviews add column entity_version integer;

create or replace function public.stamp_review_version()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.entity_type = 'chapter' then
    select version into new.entity_version from public.chapters where id = new.entity_id;
  elsif new.entity_type = 'story' then
    select version into new.entity_version from public.stories where id = new.entity_id;
  end if;
  return new;
end $$;
create trigger a1_stamp_review_version before insert on public.editorial_reviews for each row execute function public.stamp_review_version();

-- The latest review of this chapter (or story) approves, and was given for the version now being published.
create or replace function public.chapter_review_ok(cid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select r.decision = 'approved' and r.entity_version is not distinct from c.version
    from public.editorial_reviews r join public.chapters c on c.id = r.entity_id
    where r.entity_type = 'chapter' and r.entity_id = cid
    order by r.created_at desc, r.id desc limit 1), false);
$$;
create or replace function public.story_review_ok(sid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select r.decision = 'approved' and r.entity_version is not distinct from s.version
    from public.editorial_reviews r join public.stories s on s.id = r.entity_id
    where r.entity_type = 'story' and r.entity_id = sid
    order by r.created_at desc, r.id desc limit 1), false);
$$;

-- ---------- 3. Chapter rules: anchor default, versioning, freeze, publish ----------
create or replace function public.guard_chapter()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  changed boolean := false;
begin
  if new.anchor is null then
    new.anchor := new.position::text;
  end if;
  if tg_op = 'UPDATE' then
    changed := (to_jsonb(new) - 'updated_at' - 'status' - 'version' - 'created_by') <> (to_jsonb(old) - 'updated_at' - 'status' - 'version' - 'created_by');
    if old.status = 'published' and new.status = 'published' and changed then
      raise exception 'a published chapter is frozen; move it to correction first' using errcode = 'P0001';
    end if;
    if changed then
      new.version := old.version + 1;
    end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not exists (
      select 1 from public.chapter_claims cc join public.claim_references r on r.claim_id = cc.claim_id
      where cc.chapter_id = new.id and r.kind in ('quran', 'hadith')
    ) then
      raise exception 'no evidence, no publish: chapter % rests on no Quran or authentic hadith reference', new.id using errcode = 'P0001';
    end if;
    if not public.chapter_review_ok(new.id) then
      raise exception 'no review, no publish: chapter % needs an approved scholarly review of this version', new.id using errcode = 'P0001';
    end if;
    if exists (select 1 from public.content_dependency_versions d where d.dependant_type = 'chapter' and d.dependant_id = new.id and d.stale and d.cleared_at is null) then
      raise exception 'needs re-review: a source of chapter % changed; a scholarly reviewer must re-review it first', new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- content_dependency_versions (migration 1200) gets the columns the source-change queue needs (migration 2551): why a
-- dependant was flagged, and who cleared the flag with a fresh review.
alter table public.content_dependency_versions
  add column reason text check (char_length(reason) <= 500),
  add column cleared_at timestamptz,
  add column cleared_by uuid references auth.users (id) on delete set null;

create trigger chapters_rules before insert or update on public.chapters for each row execute function public.guard_chapter();

-- The claims behind a published chapter are frozen with it; while it is a draft, changing them makes a new version.
create or replace function public.guard_chapter_claims()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  ids uuid[] := array[]::uuid[];
  cid uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then ids := ids || old.chapter_id; end if;
  if tg_op in ('UPDATE', 'INSERT') and not (new.chapter_id = any (ids)) then ids := ids || new.chapter_id; end if;
  foreach cid in array ids loop
    if exists (select 1 from public.chapters where id = cid and status = 'published') then
      raise exception 'the claims of a published chapter cannot change; move the chapter to correction first' using errcode = 'P0001';
    end if;
  end loop;
  foreach cid in array ids loop
    update public.chapters set version = version + 1 where id = cid;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger chapter_claims_rules before insert or update or delete on public.chapter_claims for each row execute function public.guard_chapter_claims();

-- ---------- 4. Story rules: versioning, freeze, review bound to the version ----------
create or replace function public.guard_story()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  changed boolean := false;
begin
  if tg_op = 'UPDATE' then
    changed := (to_jsonb(new) - 'updated_at' - 'status' - 'version' - 'created_by' - 'published_at') <> (to_jsonb(old) - 'updated_at' - 'status' - 'version' - 'created_by' - 'published_at');
    if old.status = 'published' and new.status = 'published' and changed then
      raise exception 'a published story is frozen; move it to correction first' using errcode = 'P0001';
    end if;
    if changed then
      new.version := old.version + 1;
    end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not public.story_review_ok(new.id) then
      raise exception 'no review, no publish: story % needs an approved scholarly review of this version', new.id using errcode = 'P0001';
    end if;
    if exists (select 1 from public.content_dependency_versions d where d.dependant_type = 'story' and d.dependant_id = new.id and d.stale and d.cleared_at is null) then
      raise exception 'needs re-review: a source of story % changed; a scholarly reviewer must re-review it first', new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger stories_rules before insert or update on public.stories for each row execute function public.guard_story();

revoke execute on function public.stamp_review_version(), public.chapter_review_ok(uuid), public.story_review_ok(uuid),
  public.guard_chapter(), public.guard_chapter_claims(), public.guard_story() from public, anon, authenticated;

-- ---------- 5. Author column and no self-review ----------
insert into public.review_entity_authors (entity_type, table_name, author_column) values ('chapter', 'chapters', 'created_by');
create trigger a0_stamp_author before insert or update on public.chapters for each row execute function public.stamp_author('created_by');

-- ---------- 6. Verse references of a chapter: derived from its claims (read-only, runs with the caller's rights) ----------
create view public.chapter_verse_refs with (security_invoker = true) as
select c.id as chapter_id, c.story_id, c.anchor, cc.claim_id, ec.status as claim_status,
       r.quran_surah as surah, r.quran_ayah_from as ayah_from, coalesce(r.quran_ayah_to, r.quran_ayah_from) as ayah_to
from public.chapters c
join public.chapter_claims cc on cc.chapter_id = c.id
join public.evidence_claims ec on ec.id = cc.claim_id
join public.claim_references r on r.claim_id = cc.claim_id and r.kind = 'quran';
revoke all on public.chapter_verse_refs from public, anon, authenticated;
grant select on public.chapter_verse_refs to anon, authenticated;
