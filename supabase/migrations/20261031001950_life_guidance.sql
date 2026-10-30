-- Life Guidance ("What are you facing today?"), docs/proposals/2026-10-31-briefs-review.md section 2.
-- A topic (e.g. feeling overwhelmed) holds lessons. Every lesson keeps three layers visibly apart:
--   1. revelation: linked evidence_claims whose references are Quran verses or hadith with a recorded authentic grading;
--   2. scholarly explanation: claims of class scholarly_interpretation (evidence 'scholar'), each with a named scholar and work;
--   3. everyday application: QITL's own educational suggestion, stored apart and always labelled as such.
-- It is not fatwa and not therapy: topic pages route personal rulings to the Mufti Q&A, and distress topics carry
-- reviewed safety notes (medical / mental-health help, crisis services). Readers get reviewed pages, never generated advice.
-- Reuses evidence_claims, claim_references, hadith_gradings, editorial_reviews and the publish-guard pattern.

insert into public.review_entity_types (type, module) values
  ('guidance_topic', 'life_guidance'), ('guidance_lesson', 'life_guidance'), ('guidance_link', 'life_guidance'), ('guidance_safety_note', 'life_guidance');

create table public.guidance_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title_en text not null check (char_length(title_en) between 2 and 120),
  title_ar text not null check (char_length(title_ar) between 2 and 120),
  summary_en text,
  summary_ar text,
  icon_key text not null default 'star' check (icon_key in ('wave', 'bond', 'leaf', 'scale', 'flame', 'return', 'moon', 'lantern', 'shield', 'home', 'hourglass', 'star')),
  distress boolean not null default false, -- needs published medical / mental-health safety notes before it is published
  position smallint not null default 100,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.guidance_topic_public(tid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.guidance_topics where id = tid and status = 'published');
$$;

create table public.guidance_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.guidance_topics (id) on delete cascade,
  position smallint not null default 1,
  title_en text not null check (char_length(title_en) between 2 and 160),
  title_ar text,
  -- Layer 3: QITL's educational suggestion. Never a ruling; the page labels it "Everyday application (QITL's suggestion)".
  application_en text not null default '',
  application_ar text,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guidance_lessons_topic on public.guidance_lessons (topic_id, position);

-- Layers 1 and 2: the claims a lesson rests on. A scholarly explanation names its scholar and work.
create table public.guidance_lesson_claims (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.guidance_lessons (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  layer text not null check (layer in ('revelation', 'scholarly_interpretation')),
  scholar_name text,
  work_title text,
  source_id uuid references public.sources (id),
  locator text, -- volume / page / section in the work
  position smallint not null default 1,
  created_at timestamptz not null default now(),
  unique (lesson_id, claim_id),
  check (layer <> 'scholarly_interpretation' or (char_length(coalesce(scholar_name, '')) > 1 and char_length(coalesce(work_title, '')) > 1)),
  check (layer <> 'revelation' or (scholar_name is null and work_title is null))
);
create index guidance_lesson_claims_lesson on public.guidance_lesson_claims (lesson_id, layer, position);

-- Related prophets, events, stories and creation profiles.
create table public.guidance_links (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.guidance_topics (id) on delete cascade,
  lesson_id uuid references public.guidance_lessons (id) on delete cascade,
  target_kind text not null check (target_kind in ('person', 'event', 'story', 'creation')),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  creation_id uuid references public.creation_profiles (id) on delete cascade,
  note_en text,
  note_ar text,
  position smallint not null default 1,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(person_id, event_id, story_id, creation_id) = 1),
  check ((target_kind = 'person') = (person_id is not null)),
  check ((target_kind = 'event') = (event_id is not null)),
  check ((target_kind = 'story') = (story_id is not null)),
  check ((target_kind = 'creation') = (creation_id is not null))
);

-- Non-religious safety guidance (seek medical / mental-health help, crisis services) and the route to a mufti.
create table public.guidance_safety_notes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.guidance_topics (id) on delete cascade,
  kind text not null check (kind in ('medical', 'mental_health', 'crisis', 'ruling_referral')),
  body_en text not null check (char_length(body_en) between 10 and 2000),
  body_ar text,
  position smallint not null default 1,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Publishing ----------
create or replace function public.guard_guidance_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := case tg_table_name
    when 'guidance_topics' then 'guidance_topic'
    when 'guidance_lessons' then 'guidance_lesson'
    when 'guidance_links' then 'guidance_link'
    else 'guidance_safety_note' end;
  bad uuid;
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published' and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published guidance entry cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if old.status <> 'published' and to_jsonb(new) - 'updated_at' - 'status' - 'version' <> to_jsonb(old) - 'updated_at' - 'status' - 'version' then
      new.version := old.version + 1;
    end if;
  end if;
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  if tg_table_name = 'guidance_lessons' then
    if char_length(btrim(new.application_en)) < 10 then
      raise exception 'a lesson needs its everyday application (QITL''s educational suggestion) before it is published' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.guidance_lesson_claims where lesson_id = new.id and layer = 'revelation') then
      raise exception 'no evidence, no publish: a lesson needs at least one revelation claim (Quran or graded hadith)' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.guidance_lesson_claims where lesson_id = new.id and layer = 'scholarly_interpretation') then
      raise exception 'no evidence, no publish: a lesson needs at least one scholarly explanation with a named scholar and work' using errcode = 'P0001';
    end if;
    select lc.claim_id into bad from public.guidance_lesson_claims lc join public.evidence_claims c on c.id = lc.claim_id
      where lc.lesson_id = new.id and c.status not in ('approved', 'published') limit 1;
    if bad is not null then
      raise exception 'no evidence, no publish: claim % is not approved', bad using errcode = 'P0001';
    end if;
    -- Revelation rests on the Quran or on hadith with a recorded authentic grading, never on a collection name alone.
    select lc.claim_id into bad from public.guidance_lesson_claims lc join public.evidence_claims c on c.id = lc.claim_id
      where lc.lesson_id = new.id and lc.layer = 'revelation' and (
        c.evidence not in ('quran', 'hadith')
        or not exists (select 1 from public.claim_references r where r.claim_id = c.id and r.kind in ('quran', 'hadith'))
        or exists (select 1 from public.claim_references r where r.claim_id = c.id and r.kind not in ('quran', 'hadith'))
        or exists (select 1 from public.claim_references r left join public.hadith_gradings g on g.id = r.hadith_grading_id
                   where r.claim_id = c.id and r.kind = 'hadith' and (g.id is null or not public.grade_is_authentic(g.grade)))
      ) limit 1;
    if bad is not null then
      raise exception 'revelation layer: claim % must cite only Quran verses or hadith with an authentic grading', bad using errcode = 'P0001';
    end if;
    select lc.claim_id into bad from public.guidance_lesson_claims lc join public.evidence_claims c on c.id = lc.claim_id
      where lc.lesson_id = new.id and lc.layer = 'scholarly_interpretation' and c.evidence <> 'scholar' limit 1;
    if bad is not null then
      raise exception 'scholarly layer: claim % must be of class scholarly_interpretation', bad using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'guidance_topics' then
    if not exists (select 1 from public.guidance_lessons where topic_id = new.id and status = 'published') then
      raise exception 'a topic needs at least one published lesson before it is published' using errcode = 'P0001';
    end if;
    if new.distress and not exists (select 1 from public.guidance_safety_notes where topic_id = new.id and status = 'published' and kind in ('medical', 'mental_health', 'crisis')) then
      raise exception 'a distress topic needs a published medical / mental-health safety note before it is published' using errcode = 'P0001';
    end if;
  end if;

  if not public.latest_review_approved(etype, new.id) then
    raise exception 'no review, no publish: % % lacks a scholarly approval', etype, new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.guard_guidance_publish() from public, anon, authenticated;

-- The claims behind a published lesson are frozen with it: correct the lesson first.
create or replace function public.guard_guidance_lesson_claims()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  lid uuid := coalesce((to_jsonb(new) ->> 'lesson_id')::uuid, (to_jsonb(old) ->> 'lesson_id')::uuid);
begin
  if exists (select 1 from public.guidance_lessons where id = lid and status = 'published')
     or (tg_op = 'UPDATE' and exists (select 1 from public.guidance_lessons where id = old.lesson_id and status = 'published')) then
    raise exception 'the claims of a published lesson cannot change; move the lesson to correction first' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.guard_guidance_lesson_claims() from public, anon, authenticated;
create trigger guidance_lesson_claims_guard before insert or update or delete on public.guidance_lesson_claims
  for each row execute function public.guard_guidance_lesson_claims();
create trigger guidance_lesson_claims_audit after insert or update or delete on public.guidance_lesson_claims for each row execute function public.audit();

do $$
declare t text;
begin
  foreach t in array array['guidance_topics', 'guidance_lessons', 'guidance_links', 'guidance_safety_notes'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_guidance_publish()', t || '_guard', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
  foreach t in array array['guidance_topics', 'guidance_lessons', 'guidance_links', 'guidance_safety_notes', 'guidance_lesson_claims'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy staff_update on public.%I for update to authenticated using (public.has_role(''editor'') or public.has_role(''scholarly_reviewer'')) with check (public.has_role(''editor'') or public.has_role(''scholarly_reviewer''))', t);
  end loop;
  -- Children are public only when they and their topic are published.
  foreach t in array array['guidance_lessons', 'guidance_links', 'guidance_safety_notes'] loop
    execute format('create policy read_published on public.%I for select using (public.is_staff() or (status = ''published'' and public.guidance_topic_public(topic_id)))', t);
  end loop;
end $$;
create policy read_published on public.guidance_topics for select using (public.is_staff() or status = 'published');
create policy read_published on public.guidance_lesson_claims for select using (
  public.is_staff() or exists (select 1 from public.guidance_lessons l where l.id = lesson_id and l.status = 'published' and public.guidance_topic_public(l.topic_id)));
create policy editor_insert on public.guidance_lesson_claims for insert to authenticated with check (public.has_role('editor'));
create policy editor_delete on public.guidance_lesson_claims for delete to authenticated using (public.has_role('editor'));
