set search_path = public, extensions;

-- The Complete Quranic Timeline & Event Universe (docs/EVENT_COVERAGE.md).
-- Extends historical_events (no parallel tables) with a track, an ordering kind that says HOW an item is ordered
-- (and never invents a date), a name-source flag, and the tables that carry verse references, cited identification
-- claims, connections and merge redirects. Drafts are invisible to the public; publishing needs approved claims, a
-- scholarly review and, for a historians' dated estimate, a separate historical/scientific review.

-- ---------- 1. historical_events: track, ordering, names ----------
alter table public.historical_events
  add column track text,
  add column ordering_kind text,
  add column relative_position integer,
  add column name_source text not null default 'quran',
  add column dating_method text,
  add column merged_into uuid references public.historical_events (id) on delete restrict;

alter table public.historical_events
  add constraint historical_events_track_check check (track is null or track in ('prophets', 'people', 'communities', 'events', 'parables', 'seerah')),
  add constraint historical_events_ordering_kind_check check (ordering_kind is null or ordering_kind in ('relative', 'disputed', 'unassigned', 'dated_estimate')),
  add constraint historical_events_name_source_check check (name_source in ('quran', 'later_tradition')),
  add constraint historical_events_position_check check (relative_position is null or relative_position >= 0),
  add constraint historical_events_method_check check (dating_method is null or char_length(dating_method) between 3 and 600),
  -- An event with a track has an ordering kind; an event without one (the first reviewed events) carries none of these.
  add constraint historical_events_universe_shape check (
    (track is null and ordering_kind is null and relative_position is null and dating_method is null and merged_into is null)
    or (track is not null and ordering_kind is not null)
  ),
  -- Relative order is a position and nothing else; every other kind has no position.
  add constraint historical_events_position_kind check ((ordering_kind = 'relative') = (relative_position is not null)),
  -- NO INVENTED DATES. Only a historians' dated estimate carries years; every other kind has none at all, and a
  -- relative item is marked relative, anything else unknown.
  add constraint historical_events_kind_precision check (
    ordering_kind is null
    or (ordering_kind = 'relative' and date_precision = 'relative')
    or (ordering_kind in ('disputed', 'unassigned') and date_precision = 'unknown')
    or (ordering_kind = 'dated_estimate' and date_precision in ('estimated', 'range'))
  ),
  -- Only the seerah and the major events (the Elephant, the Hijrah, ...) can have a historians' estimate. Prophets,
  -- people, communities and parables never get a date, and a parable is never ordered at all.
  add constraint historical_events_dated_tracks check (ordering_kind is distinct from 'dated_estimate' or track in ('events', 'seerah')),
  add constraint historical_events_parables_undated check (track is distinct from 'parables' or ordering_kind = 'unassigned'),
  add constraint historical_events_estimate_basis check (ordering_kind is distinct from 'dated_estimate' or dating_method is not null),
  add constraint historical_events_merged_archived check (merged_into is null or status = 'archived');

create index historical_events_track on public.historical_events (track, status) where track is not null;

-- A relative item also fills the older relative_order column, which the existing date_precision check requires.
create or replace function public.event_universe_defaults()
returns trigger language plpgsql as $$
begin
  if new.ordering_kind = 'relative' and new.relative_order is null then
    new.relative_order := new.relative_position;
  end if;
  return new;
end $$;
create trigger a1_event_universe_defaults before insert or update on public.historical_events for each row execute function public.event_universe_defaults();

-- ---------- Helpers for policies ----------
create or replace function public.event_is_published(eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.historical_events e where e.id = eid and e.status = 'published');
$$;

-- Staff, plus the historical/scientific reviewer who signs dated estimates.
create or replace function public.event_universe_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_staff() or public.has_role('science_reviewer');
$$;

create policy science_read_universe on public.historical_events for select to authenticated
  using (track is not null and public.has_role('science_reviewer'));

-- ---------- 2. Verse references ----------
create table public.event_verse_refs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.historical_events (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  ayah_from smallint not null check (ayah_from >= 1),
  ayah_to smallint not null,
  claim_id uuid references public.evidence_claims (id) on delete restrict,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  check (ayah_to >= ayah_from),
  unique (event_id, surah, ayah_from, ayah_to)
);
create index event_verse_refs_event on public.event_verse_refs (event_id, position);
create index event_verse_refs_surah on public.event_verse_refs (surah, ayah_from);
create trigger event_verse_refs_audit after insert or update or delete on public.event_verse_refs for each row execute function public.audit();

-- Where the Quran text is imported the range must end inside the surah (the unit tests check every seeded reference
-- against the imported text itself). A published event's references are fixed: correct it first.
create or replace function public.check_event_verse_ref()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  eid uuid := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
begin
  if tg_op <> 'DELETE' and exists (select 1 from public.quran_verses v where v.surah_id = new.surah)
     and not exists (select 1 from public.quran_verses v where v.surah_id = new.surah and v.ayah_no = new.ayah_to) then
    raise exception 'verse reference %:%-% is outside the surah', new.surah, new.ayah_from, new.ayah_to using errcode = 'P0001';
  end if;
  if exists (select 1 from public.historical_events e where e.id = eid and e.status = 'published' and e.track is not null) then
    raise exception 'a published event''s verse references are fixed: move it to correction first' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger event_verse_refs_check before insert or update or delete on public.event_verse_refs for each row execute function public.check_event_verse_ref();

-- ---------- 3. Identification, name and ordering claims ----------
-- A traditional identification (who Dhul-Qarnayn was, which people a verse refers to, a name the text does not give)
-- or a view on ordering is never part of the event itself: it is a separate cited claim with its own standing and
-- review. Disputed views are listed together.
create table public.event_identifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.historical_events (id) on delete cascade,
  kind text not null check (kind in ('identification', 'name', 'ordering', 'dating')),
  subject text not null check (char_length(subject) between 2 and 300),
  view text not null check (char_length(view) between 2 and 600),
  standing text not null default 'disputed' check (standing in ('disputed', 'widely_held', 'minority', 'later_tradition')),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, kind, subject, view)
);
create index event_identifications_event on public.event_identifications (event_id, kind);
create trigger event_identifications_audit after insert or update or delete on public.event_identifications for each row execute function public.audit();

-- ---------- 4. Connections (map and genealogy links) ----------
create table public.event_connections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.historical_events (id) on delete cascade,
  target_kind text not null check (target_kind in ('event', 'person', 'community', 'place')),
  target_event_id uuid references public.historical_events (id) on delete cascade,
  person_id uuid references public.people (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  kind text not null check (kind in ('involves', 'takes_place_at', 'same_community', 'related', 'lineage')),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (target_kind in ('event', 'community') and target_event_id is not null and person_id is null and location_id is null)
    or (target_kind = 'person' and person_id is not null and target_event_id is null and location_id is null)
    or (target_kind = 'place' and location_id is not null and target_event_id is null and person_id is null)
  ),
  check (target_event_id is null or target_event_id <> event_id),
  check (kind <> 'takes_place_at' or target_kind = 'place')
);
create unique index event_connections_unique on public.event_connections (event_id, target_kind, coalesce(target_event_id, person_id, location_id), kind);
create index event_connections_event on public.event_connections (event_id);
create trigger event_connections_audit after insert or update or delete on public.event_connections for each row execute function public.audit();

-- A community connection points at an item of the communities track.
create or replace function public.check_event_connection()
returns trigger language plpgsql as $$
begin
  if new.target_kind = 'community' and not exists (select 1 from public.historical_events e where e.id = new.target_event_id and e.track = 'communities') then
    raise exception 'a community connection must point at an event of the communities track' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger event_connections_target before insert or update on public.event_connections for each row execute function public.check_event_connection();

-- ---------- 5. Dated estimates: the historical/scientific review pathway ----------
-- Class C (historians' estimates) are checked by a science reviewer: the named publication, the dating method and the
-- explicit "historians' estimate" label. This is separate from the scholarly review of the religious content.
create table public.event_dating_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.historical_events (id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index event_dating_reviews_event on public.event_dating_reviews (event_id, created_at desc);
create trigger event_dating_reviews_audit after insert on public.event_dating_reviews for each row execute function public.audit();

create or replace function public.check_event_dating_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('science_reviewer', 'admin')) then
    raise exception 'only a historical/scientific reviewer may review a dated estimate' using errcode = '42501';
  end if;
  if exists (select 1 from public.historical_events e where e.id = new.event_id and e.created_by = new.reviewer_id) then
    raise exception 'a reviewer cannot review their own record' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger event_dating_reviews_check before insert on public.event_dating_reviews for each row execute function public.check_event_dating_reviewer();

create or replace function public.event_dating_approved(eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select decision = 'approved' from public.event_dating_reviews where event_id = eid order by created_at desc, id desc limit 1), false);
$$;

-- ---------- 6. Merge redirects ----------
create table public.event_redirects (
  old_slug text primary key check (old_slug ~ '^[a-z0-9-]+$'),
  event_id uuid not null references public.historical_events (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create trigger event_redirects_audit after insert or update or delete on public.event_redirects for each row execute function public.audit();

-- ---------- 7. Counts (public, no content) ----------
-- The designed empty state says how many inventory items are under review without exposing a single title.
create table public.event_universe_stats (
  track text primary key check (track in ('prophets', 'people', 'communities', 'events', 'parables', 'seerah')),
  published integer not null default 0,
  under_review integer not null default 0
);
insert into public.event_universe_stats (track) values ('prophets'), ('people'), ('communities'), ('events'), ('parables'), ('seerah');

create or replace function public.refresh_event_universe_stats()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.event_universe_stats s set
    published = (select count(*) from public.historical_events e where e.track = s.track and e.status = 'published'),
    under_review = (select count(*) from public.historical_events e where e.track = s.track and e.status in ('draft', 'in_review', 'approved', 'correction'));
  return null;
end $$;
create trigger historical_events_universe_stats after insert or update or delete on public.historical_events
  for each statement execute function public.refresh_event_universe_stats();
revoke execute on function public.refresh_event_universe_stats() from public, anon, authenticated;

-- ---------- 8. Publish guards ----------
create or replace function public.event_claims_ok(cids uuid[])
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(bool_and(c.status in ('approved', 'published')), false)
  from unnest(cids) u(id) join public.evidence_claims c on c.id = u.id;
$$;

create or replace function public.guard_event_universe_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  n_refs integer;
  n_open integer;
  n_basis integer;
  n_views integer;
begin
  if new.track is null then
    return new;
  end if;
  -- A published event's track, ordering and dating are fixed until it is moved to correction.
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and (new.track, new.ordering_kind, new.relative_position, new.name_source, new.date_precision, new.start_year, new.end_year, new.dating_method)
         is distinct from (old.track, old.ordering_kind, old.relative_position, old.name_source, old.date_precision, old.start_year, old.end_year, old.dating_method) then
    raise exception 'a published event''s track, order and dating are fixed: move it to correction first' using errcode = 'P0001';
  end if;
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  -- Verses: at least one, each resting on an approved claim.
  select count(*), count(*) filter (where r.claim_id is null or c.status not in ('approved', 'published'))
    into n_refs, n_open
    from public.event_verse_refs r left join public.evidence_claims c on c.id = r.claim_id where r.event_id = new.id;
  if n_refs = 0 then
    raise exception 'no verses, no publish: event % has no verified verse reference', new.id using errcode = 'P0001';
  end if;
  if n_open > 0 then
    raise exception 'no evidence, no publish: event % has % verse reference(s) without an approved claim', new.id, n_open using errcode = 'P0001';
  end if;

  -- A name the Quranic text does not give is cited as such.
  if new.name_source = 'later_tradition' and not exists (
    select 1 from public.event_identifications i
    where i.event_id = new.id and i.kind = 'name' and i.status = 'published'
  ) then
    raise exception 'a name from later tradition needs a cited name claim before publishing' using errcode = 'P0001';
  end if;

  -- Ordering: relative order and disputed order rest on cited claims; unassigned says "not established" and needs none.
  select count(*), count(distinct i.view) into n_basis, n_views
    from public.event_identifications i
    where i.event_id = new.id and i.kind = 'ordering' and i.status = 'published';
  if new.ordering_kind = 'relative' and n_basis < 1 then
    raise exception 'relative order needs a cited ordering claim' using errcode = 'P0001';
  end if;
  if new.ordering_kind = 'disputed' and n_views < 2 then
    raise exception 'a disputed order lists at least two cited views' using errcode = 'P0001';
  end if;

  -- A historians' estimate: a named publication and method, class C evidence, and the historical/scientific review.
  if new.ordering_kind = 'dated_estimate' then
    -- The estimate rests on a published 'dating' claim of this event (event_identifications, kind 'dating').
    if not exists (select 1 from public.event_identifications i where i.event_id = new.id and i.kind = 'dating' and i.status = 'published') then
      raise exception 'a dated estimate needs a published dating claim' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.event_identifications i join public.evidence_claims c on c.id = i.claim_id
      where i.event_id = new.id and i.kind = 'dating' and i.status = 'published' and c.evidence = 'estimate'
    ) then
      raise exception 'a dated estimate is evidence class C (historians'' estimate)' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.event_identifications i join public.claim_references r on r.claim_id = i.claim_id
      where i.event_id = new.id and i.kind = 'dating' and i.status = 'published' and r.kind in ('history', 'scholar') and r.source_id is not null and r.locator is not null
    ) then
      raise exception 'a dated estimate cites a named publication (source and locator)' using errcode = 'P0001';
    end if;
    if not public.event_dating_approved(new.id) then
      raise exception 'no review, no publish: the dating lacks a historical/scientific review' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger historical_events_universe_guard before insert or update on public.historical_events for each row execute function public.guard_event_universe_publish();

-- Identifications and connections: an approved claim and a scholarly review; an identification of a person, place or
-- name is never a "Quran" claim (if the Quran says it, it is a verse reference, not an identification).
create or replace function public.guard_event_child_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := case tg_table_name when 'event_identifications' then 'event_identification' else 'event_connection' end;
  claim record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  select c.status, c.evidence into claim from public.evidence_claims c where c.id = new.claim_id;
  if claim.status is null or claim.status not in ('approved', 'published') then
    raise exception 'no evidence, no publish: % % has an unapproved claim', etype, new.id using errcode = 'P0001';
  end if;
  if tg_table_name = 'event_identifications' and new.kind in ('identification', 'name') and claim.evidence = 'quran' then
    raise exception 'an identification or later-tradition name is not a Quranic claim: cite the tradition and mark it disputed or later' using errcode = 'P0001';
  end if;
  if not public.latest_review_approved(etype, new.id) then
    raise exception 'no review, no publish: % % lacks a scholarly approval', etype, new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger event_identifications_guard before insert or update on public.event_identifications for each row execute function public.guard_event_child_publish();
create trigger event_connections_guard before insert or update on public.event_connections for each row execute function public.guard_event_child_publish();
revoke execute on function public.guard_event_universe_publish(), public.guard_event_child_publish(), public.check_event_verse_ref(), public.check_event_dating_reviewer() from public, anon, authenticated;

-- ---------- 9. Merge ----------
-- Two events that are the same: the target keeps the claims, verse references, identifications, connections and links of
-- both; the source is archived and its slug redirects to the target. A published source needs an admin.
create or replace function public.merge_events(source uuid, target uuid, reason text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  s record;
  t record;
begin
  if not (public.has_role('editor') or public.has_role('admin')) then
    raise exception 'only an editor or an admin may merge events' using errcode = '42501';
  end if;
  if source = target then
    raise exception 'an event cannot be merged into itself' using errcode = 'P0001';
  end if;
  select * into s from public.historical_events where id = source for update;
  select * into t from public.historical_events where id = target for update;
  if s.id is null or t.id is null then
    raise exception 'both events must exist' using errcode = 'P0001';
  end if;
  if s.status = 'published' and not public.has_role('admin') then
    raise exception 'only an admin merges a published event' using errcode = '42501';
  end if;
  if t.status in ('archived', 'rejected') or t.merged_into is not null then
    raise exception 'the target event is archived' using errcode = 'P0001';
  end if;
  if t.status = 'published' then
    raise exception 'the target is published: move it to correction before merging into it' using errcode = 'P0001';
  end if;
  if s.merged_into is not null then
    raise exception 'the source event was already merged' using errcode = 'P0001';
  end if;
  if s.track is distinct from t.track then
    raise exception 'events of different tracks are not the same event' using errcode = 'P0001';
  end if;

  -- The source leaves the public view first.
  update public.historical_events set status = 'archived', merged_into = target where id = source;

  insert into public.event_redirects (old_slug, event_id, created_by) values (s.slug, target, auth.uid());
  update public.event_redirects set event_id = target where event_id = source;

  -- Verse references, identifications and connections move unless the target already holds the same one.
  delete from public.event_verse_refs a using public.event_verse_refs b
    where a.event_id = source and b.event_id = target and (a.surah, a.ayah_from, a.ayah_to) = (b.surah, b.ayah_from, b.ayah_to);
  update public.event_verse_refs set event_id = target where event_id = source;
  delete from public.event_identifications a using public.event_identifications b
    where a.event_id = source and b.event_id = target and (a.kind, a.subject, a.view) = (b.kind, b.subject, b.view);
  update public.event_identifications set event_id = target where event_id = source;
  -- A connection between the two disappears; the rest move over.
  delete from public.event_connections where (event_id = source and target_event_id = target) or (event_id = target and target_event_id = source);
  delete from public.event_connections a using public.event_connections b
    where a.event_id = source and b.event_id = target and (a.target_kind, coalesce(a.target_event_id, a.person_id, a.location_id), a.kind)
      = (b.target_kind, coalesce(b.target_event_id, b.person_id, b.location_id), b.kind);
  update public.event_connections set event_id = target where event_id = source;
  delete from public.event_connections a using public.event_connections b
    where a.target_event_id = source and b.target_event_id = target and a.event_id = b.event_id and a.target_kind = b.target_kind and a.kind = b.kind;
  update public.event_connections set target_event_id = target where target_event_id = source;

  -- Links and claims are kept (the source's own claim becomes one of the target's).
  insert into public.event_people (event_id, person_id, role) select target, person_id, role from public.event_people where event_id = source on conflict do nothing;
  insert into public.event_places (event_id, location_id) select target, location_id from public.event_places where event_id = source on conflict do nothing;
  insert into public.event_stories (event_id, story_id) select target, story_id from public.event_stories where event_id = source on conflict do nothing;
  insert into public.event_claims (event_id, claim_id) select target, claim_id from public.event_claims where event_id = source on conflict do nothing;
  if s.claim_id is not null and s.claim_id is distinct from t.claim_id then
    insert into public.event_claims (event_id, claim_id) values (target, s.claim_id) on conflict do nothing;
  end if;
  insert into public.event_relationships (from_event, to_event, kind, claim_id)
    select target, to_event, kind, claim_id from public.event_relationships where from_event = source and to_event <> target on conflict do nothing;
  insert into public.event_relationships (from_event, to_event, kind, claim_id)
    select from_event, target, kind, claim_id from public.event_relationships where to_event = source and from_event <> target on conflict do nothing;

  insert into public.revision_notes (entity_type, entity_id, note, is_correction, public, created_by)
    values ('event', target, 'Merged with "' || s.title || '" (' || s.slug || ')' || coalesce(': ' || reason, '.'), false, true, auth.uid());
  return target;
end $$;
revoke execute on function public.merge_events(uuid, uuid, text) from public, anon;
grant execute on function public.merge_events(uuid, uuid, text) to authenticated;

-- ---------- 10. Row-level security ----------
alter table public.event_verse_refs enable row level security;
alter table public.event_identifications enable row level security;
alter table public.event_connections enable row level security;
alter table public.event_dating_reviews enable row level security;
alter table public.event_redirects enable row level security;
alter table public.event_universe_stats enable row level security;
alter table public.event_verse_refs force row level security;
alter table public.event_identifications force row level security;
alter table public.event_connections force row level security;
alter table public.event_dating_reviews force row level security;
alter table public.event_redirects force row level security;
alter table public.event_universe_stats force row level security;

revoke all on public.event_verse_refs, public.event_identifications, public.event_connections, public.event_dating_reviews,
  public.event_redirects, public.event_universe_stats from anon, authenticated;
grant select on public.event_verse_refs, public.event_identifications, public.event_connections, public.event_redirects, public.event_universe_stats to anon, authenticated;
grant select, insert on public.event_dating_reviews to authenticated;
grant insert, update, delete on public.event_verse_refs, public.event_identifications, public.event_connections to authenticated;
grant insert, delete on public.event_redirects to authenticated;

-- References follow the event: public only while the event is published.
create policy read_published on public.event_verse_refs for select using (public.event_is_published(event_id) or public.event_universe_staff());
create policy editor_write on public.event_verse_refs for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));

-- Identifications and connections are public when they and their event are published.
create policy read_published on public.event_identifications for select
  using (public.event_universe_staff() or (status = 'published' and public.event_is_published(event_id)));
create policy editor_insert on public.event_identifications for insert to authenticated
  with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.event_identifications for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.event_identifications for delete to authenticated
  using (public.has_role('admin') and status <> 'published');

create policy read_published on public.event_connections for select
  using (public.event_universe_staff() or (status = 'published' and public.event_is_published(event_id)));
create policy editor_insert on public.event_connections for insert to authenticated
  with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.event_connections for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.event_connections for delete to authenticated
  using (public.has_role('admin') and status <> 'published');

create policy staff_read on public.event_dating_reviews for select to authenticated using (public.event_universe_staff());
create policy reviewer_insert on public.event_dating_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.has_role('science_reviewer'));

-- A redirect is public only when it leads to a published event.
create policy read_published on public.event_redirects for select using (public.event_is_published(event_id) or public.event_universe_staff());
create policy admin_write on public.event_redirects for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
-- Counts only (no titles, no slugs): readable by anyone; written only by the trigger above.
create policy read_counts on public.event_universe_stats for select using (true);

-- ---------- 11. Review types and author registration ----------
insert into public.review_entity_types (type, module) values ('event_identification', 'event_universe'), ('event_connection', 'event_universe');
insert into public.review_entity_authors (entity_type, table_name, author_column) values
  ('event_identification', 'event_identifications', 'created_by'),
  ('event_connection', 'event_connections', 'created_by');
create trigger a0_stamp_author before insert or update on public.event_identifications for each row execute function public.stamp_author('created_by');
create trigger a0_stamp_author before insert or update on public.event_connections for each row execute function public.stamp_author('created_by');
