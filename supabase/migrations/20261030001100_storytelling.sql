set search_path = public, extensions;

-- The storytelling model: every prophet and every Quranic event uses the same sections A–G, in three reading
-- levels (kids, young, full) that rest on the same reviewed claims; quizzes and media pass the same review.
-- Replaces profile_sections (created empty in 0010; this migration refuses to run if it holds any rows).

do $$
begin
  if exists (select 1 from public.profile_sections) then
    raise exception 'profile_sections is not empty; migrate its rows before replacing it';
  end if;
end $$;
drop table public.profile_sections;
drop type public.profile_section_kind;
drop type public.profile_depth;

-- ---------- Story sections ----------
create table public.story_sections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  -- A introduction facts, summary (one-minute), B before the mission, C calling and message,
  -- D challenge steps, E outcome, F takeaways, reflection questions, scholarly notes. G (references) is derived.
  section text not null check (section in ('summary', 'fact', 'before_mission', 'calling', 'step', 'outcome', 'takeaway', 'reflection', 'scholarly_note')),
  fact_key text check (fact_key in ('name_variants', 'designation', 'era', 'lifespan', 'age_at_events', 'people_addressed', 'time_among_people', 'geography')),
  -- D: each challenge is a chain Situation -> Challenge -> Action -> Response -> Outcome -> Lesson.
  step_group smallint check (step_group >= 1),
  step_role text check (step_role in ('situation', 'challenge', 'action', 'response', 'outcome', 'lesson')),
  position smallint not null default 1 check (position >= 1),
  audience text not null default 'full' check (audience in ('kids', 'young', 'full')),
  base_section_id uuid references public.story_sections (id) on delete cascade, -- the full version a kids/young text adapts
  title text check (char_length(title) <= 160),
  value_text text check (char_length(value_text) <= 160),
  value_note text check (char_length(value_note) <= 300),
  known boolean not null default true,
  body_md text not null default '' check (char_length(body_md) <= 20000),
  everyday_example text check (char_length(everyday_example) <= 1000),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((person_id is null) <> (event_id is null)),
  check ((section = 'fact') = (fact_key is not null)),
  check ((section = 'step') = (step_group is not null and step_role is not null)),
  check (section = 'step' or (step_group is null and step_role is null)),
  -- A fact the sources do not establish carries no value; an established fact needs one.
  check (section <> 'fact' or (known and value_text is not null) or (not known and value_text is null)),
  check (section = 'fact' or known),
  check (section = 'fact' or char_length(body_md) > 0),
  -- A takeaway names the lesson, explains its meaning and gives an everyday example (a modern application).
  check (section <> 'takeaway' or (title is not null and everyday_example is not null)),
  check (section = 'takeaway' or everyday_example is null),
  check ((audience = 'full') = (base_section_id is null))
);
create index story_sections_person on public.story_sections (person_id, section, position) where person_id is not null;
create index story_sections_event on public.story_sections (event_id, section, position) where event_id is not null;
create unique index story_sections_fact_person on public.story_sections (person_id, fact_key, audience) where section = 'fact' and person_id is not null;
create unique index story_sections_fact_event on public.story_sections (event_id, fact_key, audience) where section = 'fact' and event_id is not null;

-- Kids and young versions adapt a full section: same subject, same section, same claim. One set of reviewed
-- claims powers every reading level.
create or replace function public.check_story_level()
returns trigger language plpgsql set search_path = public, extensions as $$
declare b public.story_sections;
begin
  if new.base_section_id is null then return new; end if;
  select * into b from public.story_sections where id = new.base_section_id;
  if b.audience <> 'full' then raise exception 'a reading-level version must adapt a full section' using errcode = 'P0001'; end if;
  if b.claim_id <> new.claim_id then raise exception 'a reading-level version must rest on the same claim as its full section' using errcode = 'P0001'; end if;
  if b.section <> new.section or coalesce(b.fact_key, '') <> coalesce(new.fact_key, '') or coalesce(b.step_role, '') <> coalesce(new.step_role, '')
     or b.person_id is distinct from new.person_id or b.event_id is distinct from new.event_id then
    raise exception 'a reading-level version must match its full section (subject, section, fact or step)' using errcode = 'P0001';
  end if;
  if new.status = 'published' and b.status <> 'published' then
    raise exception 'publish the full section before its kids or young version' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger story_sections_level before insert or update on public.story_sections for each row execute function public.check_story_level();
create trigger story_sections_touch before update on public.story_sections for each row execute function public.touch_updated_at();
create trigger story_sections_audit after insert or update or delete on public.story_sections for each row execute function public.audit();

-- ---------- Quizzes (facts only from reviewed claims) ----------
create table public.story_quizzes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  audience text not null default 'kids' check (audience in ('kids', 'young', 'full')),
  title text not null check (char_length(title) between 3 and 160),
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((person_id is null) <> (event_id is null))
);
create trigger story_quizzes_touch before update on public.story_quizzes for each row execute function public.touch_updated_at();
create trigger story_quizzes_audit after insert or update or delete on public.story_quizzes for each row execute function public.audit();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.story_quizzes (id) on delete cascade,
  position smallint not null default 1 check (position >= 1),
  prompt text not null check (char_length(prompt) between 5 and 400),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5),
  correct_index smallint not null check (correct_index >= 0),
  explanation text check (char_length(explanation) <= 1000),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  check (correct_index < jsonb_array_length(options)),
  unique (quiz_id, position)
);
create trigger quiz_questions_audit after insert or update or delete on public.quiz_questions for each row execute function public.audit();

-- ---------- Media and animations ----------
create table public.story_media (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  role text not null check (role in ('infographic', 'cover', 'timeline_visual', 'event_sequence', 'animation', 'outcome', 'takeaway_graphic')),
  -- Animations are symbolic components shipped with the site (no figures, no unseen beings); images are approved assets.
  animation_key text check (animation_key in ('rain-flood', 'sea-path', 'wheat-cycles', 'cave-daylight', 'foundations-rising', 'palace-architecture', 'beginning-timeline')),
  asset_id uuid references public.assets (id) on delete restrict,
  caption text not null check (char_length(caption) between 3 and 300),
  alt_text text not null check (char_length(alt_text) between 3 and 500),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict, -- the claim the visual illustrates
  status public.publication_status not null default 'draft',
  approved_by uuid references auth.users (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((person_id is null) <> (event_id is null)),
  check ((role = 'animation') = (animation_key is not null)),
  check (role = 'animation' or asset_id is not null),
  check (status <> 'published' or approved_by is not null)
);
create trigger story_media_audit after insert or update or delete on public.story_media for each row execute function public.audit();

-- ---------- Review and publishing ----------
alter table public.editorial_reviews drop constraint editorial_reviews_entity_type_check;
alter table public.editorial_reviews add constraint editorial_reviews_entity_type_check
  check (entity_type in ('claim', 'story', 'chapter', 'event', 'relationship', 'place_geometry', 'person', 'story_section', 'quiz', 'media'));

create or replace function public.guard_entity_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  n_claims integer;
  n_unapproved integer;
  etype text := case tg_table_name when 'stories' then 'story' when 'chapters' then 'chapter' when 'historical_events' then 'event'
    when 'relationships' then 'relationship' when 'place_geometries' then 'place_geometry' when 'story_sections' then 'story_section'
    when 'story_quizzes' then 'quiz' when 'story_media' then 'media' else tg_table_name end;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  if tg_table_name = 'chapters' then
    select count(*), count(*) filter (where c.status not in ('approved', 'published')) into n_claims, n_unapproved
    from public.chapter_claims cc join public.evidence_claims c on c.id = cc.claim_id where cc.chapter_id = new.id;
  elsif tg_table_name = 'stories' then
    select count(*), count(*) filter (where c.status not in ('approved', 'published')) into n_claims, n_unapproved
    from public.chapters ch join public.chapter_claims cc on cc.chapter_id = ch.id join public.evidence_claims c on c.id = cc.claim_id
    where ch.story_id = new.id;
  elsif tg_table_name = 'historical_events' then
    select count(*), count(*) filter (where c.status not in ('approved', 'published')) into n_claims, n_unapproved
    from (select claim_id from public.event_claims where event_id = new.id union select new.claim_id where new.claim_id is not null) ec
    join public.evidence_claims c on c.id = ec.claim_id;
  elsif tg_table_name = 'story_quizzes' then
    select count(*), count(*) filter (where c.status not in ('approved', 'published')) into n_claims, n_unapproved
    from public.quiz_questions q join public.evidence_claims c on c.id = q.claim_id where q.quiz_id = new.id;
  else
    select count(*), count(*) filter (where c.status not in ('approved', 'published')) into n_claims, n_unapproved
    from public.evidence_claims c where c.id = (to_jsonb(new) ->> 'claim_id')::uuid;
    if tg_table_name = 'place_geometries' and to_jsonb(new) ->> 'precision' = 'unknown' then
      n_claims := greatest(n_claims, 1);
    end if;
  end if;
  if n_claims = 0 then
    raise exception 'no evidence, no publish: % % has no claims', etype, new.id using errcode = 'P0001';
  end if;
  if n_unapproved > 0 then
    raise exception 'no evidence, no publish: % % has % unapproved claim(s)', etype, new.id, n_unapproved using errcode = 'P0001';
  end if;
  if not public.latest_review_approved(etype, new.id) then
    raise exception 'no review, no publish: % % lacks a scholarly approval', etype, new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.guard_entity_publish(), public.check_story_level() from public, anon, authenticated;

create trigger story_sections_guard before insert or update on public.story_sections for each row execute function public.guard_entity_publish();
create trigger story_sections_version after insert or update on public.story_sections for each row execute function public.snapshot_version();
create trigger story_quizzes_guard before insert or update on public.story_quizzes for each row execute function public.guard_entity_publish();
create trigger story_media_guard before insert or update on public.story_media for each row execute function public.guard_entity_publish();

-- Published questions cannot change under readers: edit a draft quiz instead.
create or replace function public.lock_published_questions()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.story_quizzes z where z.id = coalesce(new.quiz_id, old.quiz_id) and z.status = 'published') then
    raise exception 'this quiz is published; move it back to draft to change its questions' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.lock_published_questions() from public, anon, authenticated;
create trigger quiz_questions_lock before insert or update or delete on public.quiz_questions for each row execute function public.lock_published_questions();

-- ---------- Hadith evidence: four collections, each narration graded authentic by a named scholar ----------
-- Stories and claims draw only on Sahih al-Bukhari, Sahih Muslim, Jami' at-Tirmidhi and Sunan Ibn Majah. A
-- collection is never a grade: every hadith reference must cite a recorded authentic grading of that narration.
create or replace function public.check_hadith_evidence()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  coll text;
  g public.hadith_gradings;
begin
  if new.kind <> 'hadith' then return new; end if;
  select collection_id into coll from public.hadith_entries where id = new.hadith_id;
  if coll not in ('bukhari', 'muslim', 'tirmidhi', 'ibnmajah') then
    raise exception 'hadith evidence must come from Sahih al-Bukhari, Sahih Muslim, Jami'' at-Tirmidhi or Sunan Ibn Majah' using errcode = 'P0001';
  end if;
  if new.hadith_grading_id is null then
    raise exception 'a hadith reference must cite the authentic grading it relies on (grade, named scholar, source)' using errcode = 'P0001';
  end if;
  select * into g from public.hadith_gradings where id = new.hadith_grading_id and hadith_id = new.hadith_id;
  if g.id is null or not public.grade_is_authentic(g.grade) then
    raise exception 'only narrations graded sahih or hasan by a named scholar may be used as evidence' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.check_hadith_evidence() from public, anon, authenticated;
create trigger claim_references_hadith before insert or update on public.claim_references for each row execute function public.check_hadith_evidence();

-- ---------- Access ----------
alter table public.story_sections enable row level security;
alter table public.story_sections force row level security;
alter table public.story_quizzes enable row level security;
alter table public.story_quizzes force row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_questions force row level security;
alter table public.story_media enable row level security;
alter table public.story_media force row level security;
grant select on public.story_sections, public.story_quizzes, public.quiz_questions, public.story_media to anon, authenticated;
grant insert, update, delete on public.story_sections, public.story_quizzes, public.quiz_questions, public.story_media to authenticated;

-- Public only when the item and its subject are published.
create or replace function public.subject_published(p uuid, e uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.people where id = p and status = 'published')
      or exists (select 1 from public.historical_events where id = e and status = 'published');
$$;

do $$
declare t text;
begin
  foreach t in array array['story_sections', 'story_quizzes', 'story_media'] loop
    execute format('create policy read_published on public.%I for select using (public.is_staff() or (status = ''published'' and public.subject_published(person_id, event_id)))', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'') or public.has_role(''scholarly_reviewer'')) with check (public.has_role(''editor'') or public.has_role(''scholarly_reviewer''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
end $$;
create policy read_published on public.quiz_questions for select using (
  public.is_staff() or exists (select 1 from public.story_quizzes z where z.id = quiz_id and z.status = 'published' and public.subject_published(z.person_id, z.event_id))
);
create policy editor_write on public.quiz_questions for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
