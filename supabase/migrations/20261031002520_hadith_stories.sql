set search_path = public, extensions;

-- Hadith Stories: authentic hadith narratives presented as stories (docs/STORY_ENCYCLOPEDIA_AUDIT.md, gap 1).
--
-- This migration is STRUCTURE ONLY. It ships no story, no hadith text, no translation and no grading. A hadith story POINTS
-- AT existing hadith_entries rows (the Arabic and any licensed translation stay in hadith_entries / hadith_translations and are
-- rendered by the existing hadith components, under their licence and content_permissions); it never copies the narration.
--
-- Evidence rule (the same as Shifa class B): Sahih al-Bukhari, Sahih Muslim, or a narration of Jami' at-Tirmidhi / Sunan Ibn
-- Majah that carries an INDIVIDUAL grading of sahih or sahih li-ghayrihi by a named grader (hadith_gradings). A collection is
-- never a grade. Several variants of one narration are kept as separate rows, each with its own reference and grading, and are
-- never merged into one quotation.
--
-- Review: one pathway, a scholarly (hadith authenticity) review bound to the story VERSION being published. Editing a draft
-- (or any of its parts) makes a new version, so an earlier approval no longer counts. A reviewer never reviews a story they or
-- the author of any part wrote. A published story and its parts are frozen: move it to correction first.

insert into public.review_entity_types (type, module) values ('hadith_story', 'hadith_stories');

-- ---------- Counts for the designed empty states (numbers only, no titles) ----------
create table public.encyclopedia_stats (
  kind text primary key check (kind in ('hadith_story', 'person', 'community')),
  published integer not null default 0,
  under_review integer not null default 0
);
insert into public.encyclopedia_stats (kind) values ('hadith_story'), ('person'), ('community');
alter table public.encyclopedia_stats enable row level security;
alter table public.encyclopedia_stats force row level security;
revoke all on public.encyclopedia_stats from anon, authenticated;
grant select on public.encyclopedia_stats to anon, authenticated;
create policy read_counts on public.encyclopedia_stats for select using (true);

-- ---------- Stories ----------
create table public.hadith_stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title_en text not null check (char_length(title_en) between 2 and 200),
  title_ar text check (char_length(title_ar) between 2 and 200),
  title_ur text check (char_length(title_ur) between 2 and 200),
  -- The Companion (or other narrator) the narration is reported from, as the editor read it in the cited narration.
  narrator_en text check (char_length(narrator_en) between 2 and 200),
  narrator_ar text check (char_length(narrator_ar) between 2 and 200),
  narrator_ur text check (char_length(narrator_ur) between 2 and 200),
  kind text not null check (kind in ('clarifies_quranic_story', 'separate_episode', 'independent_lesson')),
  summary_en text check (char_length(summary_en) <= 1500),
  summary_ar text check (char_length(summary_ar) <= 1500),
  summary_ur text check (char_length(summary_ur) <= 1500),
  -- NULL = "Not established": the page says so instead of supplying a setting.
  context_en text check (char_length(context_en) <= 3000),
  context_ar text check (char_length(context_ar) <= 3000),
  context_ur text check (char_length(context_ur) <= 3000),
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hadith_stories_status on public.hadith_stories (status);

create or replace function public.hadith_story_public(sid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.hadith_stories where id = sid and status = 'published');
$$;

-- ---------- The narrations a story points at ----------
create table public.hadith_story_entries (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.hadith_stories (id) on delete cascade,
  hadith_id uuid not null references public.hadith_entries (id) on delete restrict,
  -- The individual grading this story relies on (required for Tirmidhi and Ibn Majah: sahih or sahih li-ghayrihi, named grader).
  grading_id uuid references public.hadith_gradings (id) on delete restrict,
  is_primary boolean not null default false,
  variant_note text check (char_length(variant_note) <= 300),   -- e.g. "the longer wording": a label, never the narration text
  position smallint not null default 1 check (position between 1 and 50),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (story_id, hadith_id)
);
create unique index hadith_story_entries_one_primary on public.hadith_story_entries (story_id) where is_primary;
create index hadith_story_entries_hadith on public.hadith_story_entries (hadith_id);

create or replace function public.check_hadith_story_entry()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.grading_id is not null and not exists (select 1 from public.hadith_gradings g where g.id = new.grading_id and g.hadith_id = new.hadith_id) then
    raise exception 'the grading does not belong to the cited narration' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger hadith_story_entries_check before insert or update on public.hadith_story_entries for each row execute function public.check_hadith_story_entry();

-- ---------- Links to people, communities, events and themes (Life Guidance topics): ids only, no free text ----------
create table public.hadith_story_links (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.hadith_stories (id) on delete cascade,
  target_kind text not null check (target_kind in ('person', 'community', 'event', 'theme')),
  person_id uuid references public.people (id) on delete restrict,
  community_id uuid references public.historical_communities (id) on delete restrict,
  event_id uuid references public.historical_events (id) on delete restrict,
  guidance_topic_id uuid references public.guidance_topics (id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 50),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(person_id, community_id, event_id, guidance_topic_id) = 1),
  check ((target_kind = 'person') = (person_id is not null)),
  check ((target_kind = 'community') = (community_id is not null)),
  check ((target_kind = 'event') = (event_id is not null)),
  check ((target_kind = 'theme') = (guidance_topic_id is not null))
);
create unique index hadith_story_links_unique on public.hadith_story_links (story_id, target_kind, coalesce(person_id, community_id, event_id, guidance_topic_id));
create index hadith_story_links_person on public.hadith_story_links (person_id) where person_id is not null;
create index hadith_story_links_community on public.hadith_story_links (community_id) where community_id is not null;
create index hadith_story_links_event on public.hadith_story_links (event_id) where event_id is not null;
create index hadith_story_links_theme on public.hadith_story_links (guidance_topic_id) where guidance_topic_id is not null;

-- ---------- Quran connections: an approved claim with Quran references. Never a free-typed verse. ----------
create table public.hadith_story_claims (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.hadith_stories (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 50),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (story_id, claim_id)
);

-- ---------- Lessons, and modern application (always shown as an educational interpretation) ----------
create table public.hadith_story_lessons (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.hadith_stories (id) on delete cascade,
  kind text not null check (kind in ('lesson', 'modern_application')),
  body_en text not null check (char_length(body_en) between 10 and 1500),
  body_ar text check (char_length(body_ar) <= 1500),
  body_ur text check (char_length(body_ur) <= 1500),
  position smallint not null default 1 check (position between 1 and 50),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index hadith_story_lessons_story on public.hadith_story_lessons (story_id, kind, position);

-- ---------- Reviews: scholarly (hadith authenticity), bound to the version ----------
create table public.hadith_story_reviews (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.hadith_stories (id) on delete cascade,
  story_version integer not null default 1,   -- set by the database to the version being reviewed
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index hadith_story_reviews_story on public.hadith_story_reviews (story_id, created_at desc);

-- Everyone who wrote the story or any part of it.
create or replace function public.hadith_story_authors(sid uuid)
returns uuid[] language sql stable security definer set search_path = public, extensions as $$
  select coalesce(array_agg(distinct u) filter (where u is not null), '{}') from (
    select created_by u from public.hadith_stories where id = sid
    union all select created_by from public.hadith_story_entries where story_id = sid
    union all select created_by from public.hadith_story_links where story_id = sid
    union all select created_by from public.hadith_story_claims where story_id = sid
    union all select created_by from public.hadith_story_lessons where story_id = sid
  ) x;
$$;

create or replace function public.hadith_story_review_ok(sid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select r.decision = 'approved' from public.hadith_story_reviews r
    where r.story_id = sid and r.story_version = (select version from public.hadith_stories where id = sid)
    order by r.created_at desc, r.id desc limit 1), false);
$$;

create or replace function public.check_hadith_story_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  select version into new.story_version from public.hadith_stories where id = new.story_id;
  if not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('scholarly_reviewer', 'admin')) then
    raise exception 'only a scholarly reviewer may review the authenticity of a hadith story' using errcode = '42501';
  end if;
  if new.reviewer_id = any (public.hadith_story_authors(new.story_id)) then
    raise exception 'a reviewer cannot review their own story' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger hadith_story_reviews_check before insert on public.hadith_story_reviews for each row execute function public.check_hadith_story_reviewer();
create trigger hadith_story_reviews_audit after insert on public.hadith_story_reviews for each row execute function public.audit();

-- ---------- Publishing ----------
create or replace function public.guard_hadith_story_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  e record;
  c record;
  alltext text;
  norm_all text;
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published hadith story cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'published'
     and to_jsonb(new) - 'updated_at' - 'status' - 'version' <> to_jsonb(old) - 'updated_at' - 'status' - 'version' then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  if coalesce(btrim(new.narrator_en), '') = '' then
    raise exception 'a hadith story names its narrator before it is published' using errcode = 'P0001';
  end if;
  if coalesce(btrim(new.summary_en), '') = '' then
    raise exception 'a hadith story needs its English summary before it is published' using errcode = 'P0001';
  end if;

  -- No evidence, no publish: exactly one primary narration, each of an allowed source and individually graded where required.
  if not exists (select 1 from public.hadith_story_entries where story_id = new.id) then
    raise exception 'no evidence, no publish: a hadith story points at at least one narration' using errcode = 'P0001';
  end if;
  if (select count(*) from public.hadith_story_entries where story_id = new.id and is_primary) <> 1 then
    raise exception 'a hadith story has exactly one primary narration' using errcode = 'P0001';
  end if;
  for e in
    select se.id, se.grading_id, h.id hid, h.collection_id, h.status hstatus, h.arabic, g.grade, g.grader
    from public.hadith_story_entries se
    join public.hadith_entries h on h.id = se.hadith_id
    left join public.hadith_gradings g on g.id = se.grading_id
    where se.story_id = new.id
  loop
    if e.hstatus <> 'published' then
      raise exception 'the narration % is not published, so a story cannot rest on it', e.hid using errcode = 'P0001';
    end if;
    if e.collection_id not in ('bukhari', 'muslim', 'tirmidhi', 'ibnmajah') then
      raise exception 'a hadith story rests only on Sahih al-Bukhari, Sahih Muslim, or an individually graded narration of Tirmidhi or Ibn Majah' using errcode = 'P0001';
    end if;
    if e.collection_id in ('tirmidhi', 'ibnmajah') and (e.grading_id is null or e.grade not in ('sahih', 'sahih li-ghayrihi') or coalesce(btrim(e.grader), '') = '') then
      raise exception 'a narration of Tirmidhi or Ibn Majah needs an individual grading of sahih or sahih li-ghayrihi by a named grader' using errcode = 'P0001';
    end if;
  end loop;

  -- A story that clarifies a Quranic story must point at the Quran through an approved claim.
  if new.kind = 'clarifies_quranic_story' and not exists (select 1 from public.hadith_story_claims where story_id = new.id) then
    raise exception 'a story that clarifies a Quranic story needs a Quran connection (an approved claim with Quran references)' using errcode = 'P0001';
  end if;
  for c in
    select ec.id, ec.status, ec.evidence, exists (select 1 from public.claim_references r where r.claim_id = ec.id and r.kind = 'quran') has_quran
    from public.hadith_story_claims sc join public.evidence_claims ec on ec.id = sc.claim_id where sc.story_id = new.id
  loop
    if c.status not in ('approved', 'published') then
      raise exception 'no evidence, no publish: claim % is not approved', c.id using errcode = 'P0001';
    end if;
    if not c.has_quran then
      raise exception 'a Quran connection rests on a claim with a Quran reference (claim %)', c.id using errcode = 'P0001';
    end if;
  end loop;

  -- The narration text lives in hadith_entries and hadith_translations only: a story never copies it wholesale.
  alltext := concat_ws(E'\n', new.summary_en, new.summary_ar, new.summary_ur, new.context_en, new.context_ar, new.context_ur,
    (select string_agg(concat_ws(E'\n', body_en, body_ar, body_ur), E'\n') from public.hadith_story_lessons where story_id = new.id));
  norm_all := public.normalize_arabic(alltext);
  if exists (
    select 1 from public.hadith_story_entries se join public.hadith_entries h on h.id = se.hadith_id
    where se.story_id = new.id and char_length(h.arabic) > 20 and position(public.normalize_arabic(h.arabic) in norm_all) > 0
  ) or exists (
    select 1 from public.hadith_story_entries se join public.hadith_translations t on t.hadith_id = se.hadith_id
    where se.story_id = new.id and char_length(t.text) > 20 and position(lower(t.text) in lower(alltext)) > 0
  ) then
    raise exception 'a hadith story links to the narration; it does not copy its text (summaries, context and lessons are in the editor''s own words)' using errcode = 'P0001';
  end if;

  if not public.hadith_story_review_ok(new.id) then
    raise exception 'no review, no publish: hadith story % needs an approved scholarly review of this version', new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger hadith_stories_guard before insert or update on public.hadith_stories for each row execute function public.guard_hadith_story_publish();

-- The parts of a published story are frozen with it; changing them while it is a draft makes the story a new version.
create or replace function public.guard_hadith_story_parts()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  ids uuid[] := array[]::uuid[];
  sid uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then ids := ids || old.story_id; end if;
  if tg_op in ('UPDATE', 'INSERT') and not (new.story_id = any (ids)) then ids := ids || new.story_id; end if;
  foreach sid in array ids loop
    if exists (select 1 from public.hadith_stories where id = sid and status = 'published') then
      raise exception 'the parts of a published hadith story cannot change; move the story to correction first' using errcode = 'P0001';
    end if;
  end loop;
  foreach sid in array ids loop
    update public.hadith_stories set version = version + 1 where id = sid;
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

-- Counts for the empty states.
create or replace function public.refresh_encyclopedia_stats()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.encyclopedia_stats set
    published = (select count(*) from public.hadith_stories where status = 'published'),
    under_review = (select count(*) from public.hadith_stories where status in ('draft', 'in_review', 'approved', 'correction'))
  where kind = 'hadith_story';
  return null;
end $$;
create trigger hadith_stories_stats after insert or update or delete on public.hadith_stories for each statement execute function public.refresh_encyclopedia_stats();

revoke execute on function public.guard_hadith_story_publish(), public.guard_hadith_story_parts(), public.check_hadith_story_reviewer(),
  public.hadith_story_authors(uuid), public.hadith_story_review_ok(uuid), public.refresh_encyclopedia_stats(),
  public.check_hadith_story_entry() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['hadith_story_entries', 'hadith_story_links', 'hadith_story_claims', 'hadith_story_lessons'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_hadith_story_parts()', t || '_guard', t);
  end loop;
  -- The author column is the database's record (docs/SECURITY.md): stamped on insert, never changed after.
  foreach t in array array['hadith_stories', 'hadith_story_entries', 'hadith_story_links', 'hadith_story_claims', 'hadith_story_lessons'] loop
    execute format('create trigger a0_stamp_author before insert or update on public.%I for each row execute function public.stamp_author(%L)', t, 'created_by');
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
  end loop;
  foreach t in array array['hadith_story_entries', 'hadith_story_links', 'hadith_story_claims', 'hadith_story_lessons'] loop
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor''))', t);
    execute format('create policy editor_delete on public.%I for delete to authenticated using (public.has_role(''editor''))', t);
    execute format('create policy read_published on public.%I for select using (public.is_staff() or public.hadith_story_public(story_id))', t);
  end loop;
end $$;

create policy editor_insert on public.hadith_stories for insert to authenticated with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy admin_delete on public.hadith_stories for delete to authenticated using (public.has_role('admin') and status <> 'published');
create policy read_published on public.hadith_stories for select using (public.is_staff() or status = 'published');

alter table public.hadith_story_reviews enable row level security;
alter table public.hadith_story_reviews force row level security;
revoke all on public.hadith_story_reviews from anon, authenticated;
grant select, insert on public.hadith_story_reviews to authenticated;
create policy staff_read on public.hadith_story_reviews for select to authenticated using (public.is_staff());
create policy reviewer_insert on public.hadith_story_reviews for insert to authenticated with check (reviewer_id = auth.uid() and public.has_role('scholarly_reviewer'));

-- Register the author columns: a reviewer never reviews a story they wrote (tests/db/security.test.ts fails otherwise).
insert into public.review_entity_authors (entity_type, table_name, author_column) values
  ('hadith_story', 'hadith_stories', 'created_by'),
  ('hadith_story', 'hadith_story_entries', 'created_by'),
  ('hadith_story', 'hadith_story_links', 'created_by'),
  ('hadith_story', 'hadith_story_claims', 'created_by'),
  ('hadith_story', 'hadith_story_lessons', 'created_by');
