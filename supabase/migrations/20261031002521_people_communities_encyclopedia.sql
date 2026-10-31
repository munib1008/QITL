set search_path = public, extensions;

-- People and Communities encyclopedia (docs/STORY_ENCYCLOPEDIA_AUDIT.md, gap 2).
--
-- people and historical_communities already carry a publication status with review guards (people: scholarly approval,
-- migration 20261030001000; communities: the Life Through the Ages guard with approved claims and religious/scientific review,
-- 20261031002060). This migration adds only what the public pages need and keeps every existing guard and row as it was:
--
--   people.encyclopedia_kind   a sub-grouping the editor sets from the sources (family member, ruler, unnamed person ...).
--                              NULL = not classified; the page never guesses a kind. 'prophet' only for kind = 'prophet'.
--   *.subject_event_id         the Event Universe item (track prophets / people / communities) that IS this person or community.
--                              Identification status ("named in the Quran" vs "named in later tradition"), the identification
--                              claims with their standing, and the verse references come from that item, not from this table.
--   person_claims              evidence claims for a person (Quran, hadith or scholarly); a person that joins the encyclopedia
--                              (encyclopedia_kind or subject item set) is published only with approved claims and the review.
--
-- Nothing is seeded: no person, community, kind, name or relationship is created here.

-- ---------- people ----------
alter table public.people
  add column encyclopedia_kind text,
  add column subject_event_id uuid references public.historical_events (id) on delete set null;
alter table public.people
  add constraint people_encyclopedia_kind_check check (encyclopedia_kind is null or encyclopedia_kind in ('prophet', 'individual', 'family_member', 'ruler', 'unnamed')),
  -- A non-prophet is never labelled a prophet, and a prophet is never filed under another group.
  add constraint people_prophet_label check (encyclopedia_kind is distinct from 'prophet' or kind = 'prophet'),
  add constraint people_prophet_group check (kind <> 'prophet' or encyclopedia_kind is null or encyclopedia_kind = 'prophet');
create unique index people_subject_event on public.people (subject_event_id) where subject_event_id is not null;

alter table public.historical_communities
  add column subject_event_id uuid references public.historical_events (id) on delete set null;
create unique index historical_communities_subject_event on public.historical_communities (subject_event_id) where subject_event_id is not null;

-- ---------- Evidence claims of a person ----------
create table public.person_claims (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 50),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (person_id, claim_id)
);
create index person_claims_person on public.person_claims (person_id, position);

create or replace function public.person_is_published(pid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.people where id = pid and status = 'published');
$$;

-- ---------- Guards ----------
-- The subject item belongs to the right track: a prophet to a prophets item, a non-prophet to a people item, a community to a
-- communities item. A published person's kind, grouping and subject item are fixed until the record is moved to correction.
create or replace function public.guard_people_encyclopedia()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  trk text;
begin
  if new.subject_event_id is not null then
    select track into trk from public.historical_events where id = new.subject_event_id;
    if trk is distinct from (case when new.kind = 'prophet' then 'prophets' else 'people' end) then
      raise exception 'the Event Universe item of a person is on the % track (a non-prophet is never filed under the prophets)', case when new.kind = 'prophet' then 'prophets' else 'people' end using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and (new.kind, new.encyclopedia_kind, new.subject_event_id) is distinct from (old.kind, old.encyclopedia_kind, old.subject_event_id) then
    raise exception 'a published person''s kind and Event Universe item are fixed: move it to correction first' using errcode = 'P0001';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and (new.encyclopedia_kind is not null or new.subject_event_id is not null) then
    if not exists (select 1 from public.person_claims where person_id = new.id) then
      raise exception 'no evidence, no publish: person % has no evidence claim', new.id using errcode = 'P0001';
    end if;
    if exists (select 1 from public.person_claims pc join public.evidence_claims c on c.id = pc.claim_id where pc.person_id = new.id and c.status not in ('approved', 'published')) then
      raise exception 'no evidence, no publish: person % has an unapproved claim', new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger people_zz_encyclopedia before insert or update on public.people for each row execute function public.guard_people_encyclopedia();

create or replace function public.guard_community_subject()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.subject_event_id is not null and not exists (select 1 from public.historical_events where id = new.subject_event_id and track = 'communities') then
    raise exception 'the Event Universe item of a community is on the communities track' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger historical_communities_zz_subject before insert or update on public.historical_communities for each row execute function public.guard_community_subject();

create or replace function public.guard_person_claims()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  pid uuid := case when tg_op = 'DELETE' then old.person_id else new.person_id end;
begin
  if exists (select 1 from public.people where id = pid and status = 'published') then
    raise exception 'the claims of a published person cannot change; move the person to correction first' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger person_claims_guard before insert or update or delete on public.person_claims for each row execute function public.guard_person_claims();

-- ---------- Counts (replaces the function of migration 2520 with all three kinds) ----------
create or replace function public.refresh_encyclopedia_stats()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.encyclopedia_stats set
    published = case kind
      when 'hadith_story' then (select count(*) from public.hadith_stories where status = 'published')
      when 'person' then (select count(*) from public.people where status = 'published')
      else (select count(*) from public.historical_communities where status = 'published') end,
    under_review = case kind
      when 'hadith_story' then (select count(*) from public.hadith_stories where status in ('draft', 'in_review', 'approved', 'correction'))
      when 'person' then (select count(*) from public.people where status in ('draft', 'in_review', 'approved', 'correction'))
      else (select count(*) from public.historical_communities where status in ('draft', 'in_review', 'approved', 'correction')) end;
  return null;
end $$;
revoke execute on function public.refresh_encyclopedia_stats(), public.guard_people_encyclopedia(), public.guard_community_subject(),
  public.guard_person_claims() from public, anon, authenticated;
create trigger people_stats after insert or update or delete on public.people for each statement execute function public.refresh_encyclopedia_stats();
create trigger historical_communities_stats after insert or update or delete on public.historical_communities for each statement execute function public.refresh_encyclopedia_stats();
update public.encyclopedia_stats s set
  published = case s.kind when 'hadith_story' then 0 when 'person' then (select count(*) from public.people where status = 'published') else (select count(*) from public.historical_communities where status = 'published') end,
  under_review = case s.kind when 'hadith_story' then 0 when 'person' then (select count(*) from public.people where status in ('draft', 'in_review', 'approved', 'correction')) else (select count(*) from public.historical_communities where status in ('draft', 'in_review', 'approved', 'correction')) end;

-- ---------- Person claims: access ----------
alter table public.person_claims enable row level security;
alter table public.person_claims force row level security;
revoke all on public.person_claims from anon, authenticated;
grant select on public.person_claims to anon, authenticated;
grant insert, update, delete on public.person_claims to authenticated;
create policy read_published on public.person_claims for select using (public.is_staff() or public.person_is_published(person_id));
create policy editor_insert on public.person_claims for insert to authenticated with check (public.has_role('editor'));
create policy editor_update on public.person_claims for update to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy editor_delete on public.person_claims for delete to authenticated using (public.has_role('editor'));
create trigger a0_stamp_author before insert or update on public.person_claims for each row execute function public.stamp_author('created_by');
create trigger person_claims_audit after insert or update or delete on public.person_claims for each row execute function public.audit();
