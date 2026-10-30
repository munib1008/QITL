set search_path = public, extensions;

-- Unified profile content for prophets and events: a fact grid and three reading depths
-- (a 30-second overview, a narrative, and a source-based study). Every section rests on a claim, so the
-- "no evidence, no publish" guard applies to it like any other entity. Nothing here is seeded with content.

create type public.profile_section_kind as enum (
  'overview',          -- 30-second summary
  'time_among_people', -- fact: how long the prophet remained among those he was sent to (if a text states it)
  'lifespan',          -- fact: total lifespan, or "not established"
  'people_addressed',  -- fact: who the message was addressed to
  'outcome',           -- fact: what became of the believers and the rejecters
  'situation',         -- narrative: the situation
  'challenge',         -- narrative: the challenge
  'what_happened',     -- narrative: what happened
  'lessons',           -- narrative: what can be learned (scholarly reflection, attributed)
  'study'              -- detailed source-based study with scholarly discussion
);
create type public.profile_depth as enum ('overview', 'narrative', 'study');

create table public.profile_sections (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  kind public.profile_section_kind not null,
  depth public.profile_depth not null,
  position smallint not null default 1 check (position >= 1),
  -- Short fact value for the fact grid, e.g. a duration as the text states it. NULL with known = false means
  -- "not established": the page says so instead of substituting an estimate.
  value_text text check (char_length(value_text) <= 120),
  value_note text check (char_length(value_note) <= 300),
  known boolean not null default true,
  body_md text not null default '' check (char_length(body_md) <= 20000),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Exactly one subject: a person or an event.
  check ((person_id is null) <> (event_id is null)),
  -- Facts belong to the fact grid; overview and study have their own depths.
  check (kind not in ('time_among_people', 'lifespan', 'people_addressed', 'outcome') or depth = 'overview'),
  check (kind <> 'overview' or depth = 'overview'),
  check (kind <> 'study' or depth = 'study'),
  check (kind not in ('situation', 'challenge', 'what_happened', 'lessons') or depth = 'narrative'),
  -- An unknown fact carries no value; a known fact needs one.
  check (known or value_text is null),
  check (kind not in ('time_among_people', 'lifespan', 'people_addressed', 'outcome') or not known or value_text is not null),
  -- Prose sections need prose.
  check (kind in ('time_among_people', 'lifespan', 'people_addressed', 'outcome') or char_length(body_md) > 0)
);
create unique index profile_sections_person_kind on public.profile_sections (person_id, kind, position) where person_id is not null;
create unique index profile_sections_event_kind on public.profile_sections (event_id, kind, position) where event_id is not null;
create trigger profile_sections_touch before update on public.profile_sections for each row execute function public.touch_updated_at();
create trigger profile_sections_audit after insert or update or delete on public.profile_sections for each row execute function public.audit();
create trigger profile_sections_guard before insert or update on public.profile_sections for each row execute function public.guard_entity_publish();
create trigger profile_sections_version after insert or update on public.profile_sections for each row execute function public.snapshot_version();

-- Reviews and the publish guard know the new entity type.
alter table public.editorial_reviews drop constraint editorial_reviews_entity_type_check;
alter table public.editorial_reviews add constraint editorial_reviews_entity_type_check
  check (entity_type in ('claim', 'story', 'chapter', 'event', 'relationship', 'place_geometry', 'person', 'profile_section'));

create or replace function public.guard_entity_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  n_claims integer;
  n_unapproved integer;
  etype text := case tg_table_name when 'stories' then 'story' when 'chapters' then 'chapter' when 'historical_events' then 'event' when 'relationships' then 'relationship' when 'place_geometries' then 'place_geometry' when 'profile_sections' then 'profile_section' else tg_table_name end;
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
  else
    select count(*), count(*) filter (where c.status not in ('approved', 'published')) into n_claims, n_unapproved
    from public.evidence_claims c where c.id = (to_jsonb(new) ->> 'claim_id')::uuid;
    if tg_table_name = 'place_geometries' and to_jsonb(new) ->> 'precision' = 'unknown' then
      n_claims := greatest(n_claims, 1); -- "this is not known" needs no geometry claim
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
revoke execute on function public.guard_entity_publish() from public, anon, authenticated;

-- A profile section is public only when it and its subject are published.
alter table public.profile_sections enable row level security;
alter table public.profile_sections force row level security;
grant select on public.profile_sections to anon, authenticated;
grant insert, update, delete on public.profile_sections to authenticated;
create policy read_published on public.profile_sections for select using (
  public.is_staff() or (
    status = 'published' and (
      exists (select 1 from public.people p where p.id = person_id and p.status = 'published')
      or exists (select 1 from public.historical_events e where e.id = event_id and e.status = 'published')
    )
  )
);
create policy editor_insert on public.profile_sections for insert to authenticated
  with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.profile_sections for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer'))
  with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.profile_sections for delete to authenticated
  using (public.has_role('admin') and status <> 'published');

-- A person can be published only with a scholarly approval (names, Arabic names and honorifics are reviewed too).
create or replace function public.guard_person_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and not public.latest_review_approved('person', new.id) then
    raise exception 'no review, no publish: person % lacks a scholarly approval', new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.guard_person_publish() from public, anon, authenticated;
create trigger people_guard before insert or update on public.people for each row execute function public.guard_person_publish();
