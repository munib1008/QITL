set search_path = public, extensions;

-- Claims and evidence, people and genealogy, events and chronology, places and geometry, stories.
-- One source-backed entity feeds the story, timeline, atlas and graph, so the views cannot disagree.

-- ---------- Evidence claims ----------
create table public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  statement text not null check (char_length(statement) between 5 and 2000),
  evidence public.evidence_kind not null,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger evidence_claims_touch before update on public.evidence_claims for each row execute function public.touch_updated_at();
create trigger evidence_claims_audit after insert or update or delete on public.evidence_claims for each row execute function public.audit();

create table public.claim_references (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.evidence_claims (id) on delete cascade,
  kind text not null check (kind in ('quran', 'hadith', 'tafsir', 'history', 'scholar')),
  quran_surah smallint,
  quran_ayah_from smallint,
  quran_ayah_to smallint,
  hadith_id uuid references public.hadith_entries (id),
  hadith_grading_id uuid references public.hadith_gradings (id),
  source_id uuid references public.sources (id),
  locator text, -- page, volume, section within the source
  note text,
  created_at timestamptz not null default now(),
  foreign key (quran_surah, quran_ayah_from) references public.quran_verses (surah_id, ayah_no),
  check (kind <> 'quran' or (quran_surah is not null and quran_ayah_from is not null and coalesce(quran_ayah_to, quran_ayah_from) >= quran_ayah_from)),
  check (kind <> 'hadith' or hadith_id is not null),
  check (kind not in ('tafsir', 'history', 'scholar') or (source_id is not null and locator is not null))
);
create index claim_references_claim on public.claim_references (claim_id);
create trigger claim_references_audit after insert or update or delete on public.claim_references for each row execute function public.audit();

-- A Quran reference must end inside the surah.
create or replace function public.check_quran_range()
returns trigger language plpgsql as $$
begin
  if new.kind = 'quran' and new.quran_ayah_to is not null and not exists (
    select 1 from public.quran_verses v where v.surah_id = new.quran_surah and v.ayah_no = new.quran_ayah_to
  ) then
    raise exception 'quran reference % : % – % is outside the surah', new.quran_surah, new.quran_ayah_from, new.quran_ayah_to using errcode = 'P0001';
  end if;
  -- A hadith reference cites the grading it relies on, and that grading must belong to the same narration.
  if new.kind = 'hadith' and new.hadith_grading_id is not null and not exists (
    select 1 from public.hadith_gradings g where g.id = new.hadith_grading_id and g.hadith_id = new.hadith_id
  ) then
    raise exception 'hadith grading does not belong to the cited narration' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger claim_references_check before insert or update on public.claim_references for each row execute function public.check_quran_range();

-- ---------- Editorial review ----------
create table public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('claim', 'story', 'chapter', 'event', 'relationship', 'place_geometry', 'person')),
  entity_id uuid not null,
  reviewer_id uuid not null references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text,
  created_at timestamptz not null default now()
);
create index editorial_reviews_entity on public.editorial_reviews (entity_type, entity_id, created_at desc);
create trigger editorial_reviews_audit after insert on public.editorial_reviews for each row execute function public.audit();

-- Reviews are recorded only by scholarly reviewers (or admins) and never by the claim's author.
create or replace function public.check_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('scholarly_reviewer', 'admin')) then
    raise exception 'only a scholarly reviewer may record a review' using errcode = '42501';
  end if;
  if new.entity_type = 'claim' and exists (select 1 from public.evidence_claims where id = new.entity_id and created_by = new.reviewer_id) then
    raise exception 'a reviewer cannot approve their own claim' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger editorial_reviews_check before insert on public.editorial_reviews for each row execute function public.check_reviewer();

create or replace function public.latest_review_approved(t text, eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select decision = 'approved' from public.editorial_reviews where entity_type = t and entity_id = eid order by created_at desc limit 1), false);
$$;

-- Publish guard for claims: an approved claim needs at least one reference and a reviewer's approval.
create or replace function public.guard_claim_status()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status in ('approved', 'published') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if not exists (select 1 from public.claim_references where claim_id = new.id) then
      raise exception 'no evidence, no publish: claim % has no references', new.id using errcode = 'P0001';
    end if;
    if not public.latest_review_approved('claim', new.id) then
      raise exception 'no review, no publish: claim % lacks a scholarly approval', new.id using errcode = 'P0001';
    end if;
    new.approved_at := coalesce(new.approved_at, now());
  end if;
  return new;
end $$;
create trigger evidence_claims_guard before insert or update on public.evidence_claims for each row execute function public.guard_claim_status();

-- ---------- People and genealogy ----------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en text not null,
  name_ar text not null,
  kind text not null check (kind in ('prophet', 'companion', 'ahl_al_bayt', 'scholar', 'historical', 'other')),
  honorific text,
  summary text,
  status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger people_touch before update on public.people for each row execute function public.touch_updated_at();
create trigger people_audit after insert or update or delete on public.people for each row execute function public.audit();

create table public.person_aliases (
  person_id uuid not null references public.people (id) on delete cascade,
  alias text not null,
  language text not null,
  primary key (person_id, alias)
);

-- Every edge rests on a claim. Edges are created by editors only, never derived from text automatically.
create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  person_from uuid not null references public.people (id) on delete restrict,
  person_to uuid not null references public.people (id) on delete restrict,
  kind text not null check (kind in ('parent_of', 'spouse_of', 'sibling_of', 'descendant_of')),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  confidence public.evidence_kind not null,
  competing_group uuid, -- edges in one group are competing genealogical interpretations, shown together
  tradition text,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (person_from <> person_to),
  check (competing_group is null or confidence = 'disputed')
);
create unique index relationships_unique on public.relationships (person_from, person_to, kind, claim_id);
create trigger relationships_audit after insert or update or delete on public.relationships for each row execute function public.audit();

-- ---------- Places ----------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en text not null,
  name_ar text,
  modern_reference text,
  type text not null check (type in ('city', 'region', 'mountain', 'body_of_water', 'site', 'route', 'other')),
  status public.publication_status not null default 'draft',
  created_at timestamptz not null default now()
);
create trigger locations_audit after insert or update or delete on public.locations for each row execute function public.audit();

-- Minimum area for an "approximate region", so a region can never pass as a disguised pin.
create table public.approximate_polygon_constraints (
  location_type text primary key,
  min_area_km2 numeric not null check (min_area_km2 > 0)
);
insert into public.approximate_polygon_constraints values
  ('city', 1), ('region', 500), ('mountain', 5), ('body_of_water', 5), ('site', 0.5), ('route', 1), ('other', 1);

create table public.place_geometries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  geom geometry(Geometry, 4326), -- NULL for unknown: an unknown place is never given a coordinate
  precision public.geometry_precision not null,
  confidence public.evidence_kind not null,
  claim_id uuid references public.evidence_claims (id) on delete restrict,
  source_id uuid references public.sources (id),
  era_label text,
  valid_from_year integer, -- astronomical year numbering (1 BCE = 0); null when not dated
  valid_to_year integer,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((precision = 'unknown') = (geom is null)),
  check (precision = 'unknown' or (claim_id is not null and source_id is not null)),
  check (precision <> 'point' or confidence in ('quran', 'hadith', 'scholar', 'estimate')),
  check (precision <> 'point' or geometrytype(geom) = 'POINT'),
  check (precision not in ('region', 'hypothesis') or geometrytype(geom) in ('POLYGON', 'MULTIPOLYGON')),
  check (precision <> 'route' or geometrytype(geom) in ('LINESTRING', 'MULTILINESTRING')),
  check (geom is null or (st_isvalid(geom) and st_srid(geom) = 4326)),
  check (valid_to_year is null or valid_from_year is null or valid_to_year >= valid_from_year)
);
create index place_geometries_geom on public.place_geometries using gist (geom);
create index place_geometries_location on public.place_geometries (location_id);
create trigger place_geometries_audit after insert or update or delete on public.place_geometries for each row execute function public.audit();

create or replace function public.check_region_area()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  min_km2 numeric;
  area_km2 numeric;
begin
  if new.precision in ('region', 'hypothesis') then
    select c.min_area_km2 into min_km2
    from public.locations l join public.approximate_polygon_constraints c on c.location_type = l.type
    where l.id = new.location_id;
    area_km2 := st_area(new.geom::geography) / 1e6;
    if area_km2 < coalesce(min_km2, 1) then
      raise exception 'approximate region is too small (% km²) for its location type; use a verified point with a source or widen the region', round(area_km2, 3) using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger place_geometries_area before insert or update on public.place_geometries for each row execute function public.check_region_area();

-- ---------- Events and chronology ----------
create table public.historical_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  title_ar text,
  summary text,
  category text not null check (category in ('sacred_history', 'prophetic_life', 'islamic_history', 'last_hour_minor', 'last_hour_major')),
  date_precision public.date_precision not null,
  relative_order integer, -- position on the relative-order track (sacred history and Last Hour order)
  -- Astronomical year numbering (1 BCE = 0, 2 BCE = -1) avoids the missing year zero; displayed as BCE/CE.
  start_year integer,
  end_year integer,
  start_ah numeric(6, 1),
  end_ah numeric(6, 1),
  date_note text,
  claim_id uuid references public.evidence_claims (id) on delete restrict,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Undated sacred history and anything not dated carry no years at all.
  check (date_precision not in ('relative', 'unknown') or (start_year is null and end_year is null and start_ah is null and end_ah is null)),
  check (date_precision <> 'relative' or relative_order is not null),
  check (date_precision <> 'exact' or (start_year is not null and (end_year is null or end_year = start_year))),
  check (date_precision not in ('range', 'estimated') or (start_year is not null and end_year is not null and end_year >= start_year)),
  -- The Last Hour has no date, ever.
  check (category not in ('last_hour_minor', 'last_hour_major') or (date_precision in ('relative', 'unknown') and start_year is null and end_year is null and start_ah is null and end_ah is null)),
  -- A sacred-history event before recorded chronology is relative or unknown.
  check (category <> 'sacred_history' or date_precision in ('relative', 'unknown', 'estimated'))
);
create trigger historical_events_touch before update on public.historical_events for each row execute function public.touch_updated_at();
create trigger historical_events_audit after insert or update or delete on public.historical_events for each row execute function public.audit();

create table public.event_people (
  event_id uuid not null references public.historical_events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  role text,
  primary key (event_id, person_id)
);
create table public.event_places (
  event_id uuid not null references public.historical_events (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete restrict,
  primary key (event_id, location_id)
);
create table public.event_relationships (
  from_event uuid not null references public.historical_events (id) on delete cascade,
  to_event uuid not null references public.historical_events (id) on delete cascade,
  kind text not null check (kind in ('before', 'after', 'during', 'part_of', 'follows_in_text')),
  claim_id uuid references public.evidence_claims (id),
  primary key (from_event, to_event, kind),
  check (from_event <> to_event)
);
create table public.event_claims (
  event_id uuid not null references public.historical_events (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  primary key (event_id, claim_id)
);

-- ---------- Stories ----------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_en text not null,
  name_ar text
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  title_ar text,
  summary text not null,
  person_id uuid references public.people (id) on delete set null,
  status public.publication_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stories_touch before update on public.stories for each row execute function public.touch_updated_at();
create trigger stories_audit after insert or update or delete on public.stories for each row execute function public.audit();

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  position smallint not null check (position >= 1),
  title text not null,
  body_md text not null default '',
  status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, position)
);
create trigger chapters_touch before update on public.chapters for each row execute function public.touch_updated_at();
create trigger chapters_audit after insert or update or delete on public.chapters for each row execute function public.audit();

create table public.chapter_claims (
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  anchor text, -- the paragraph or sentence anchor in body_md
  primary key (chapter_id, claim_id)
);
create table public.event_stories (
  event_id uuid not null references public.historical_events (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  primary key (event_id, story_id)
);
create table public.taggings (
  topic_id uuid not null references public.topics (id) on delete cascade,
  entity_type public.content_type not null,
  entity_id text not null,
  primary key (topic_id, entity_type, entity_id)
);
create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  term_ar text,
  definition text not null,
  claim_id uuid references public.evidence_claims (id),
  status public.publication_status not null default 'draft'
);

-- ---------- Media ----------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  kind text not null check (kind in ('image', 'manuscript', 'map', 'document')),
  alt_text text not null check (char_length(alt_text) >= 3),
  credit text not null,
  source_id uuid not null references public.sources (id),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf')),
  bytes integer not null check (bytes between 1 and 10485760),
  depicts_person boolean not null default false check (depicts_person = false), -- no figurative depiction, ever
  status public.publication_status not null default 'draft',
  approved_by uuid references auth.users (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status <> 'published' or approved_by is not null)
);

-- A published image needs a source whose rights are cleared (or public domain).
create or replace function public.check_asset_rights()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'published' and not public.source_publishable(new.source_id) then
    raise exception 'image source rights are not cleared' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger assets_rights before insert or update on public.assets for each row execute function public.check_asset_rights();

create table public.asset_links (
  asset_id uuid not null references public.assets (id) on delete cascade,
  entity_type public.content_type not null,
  entity_id text not null,
  position smallint not null default 1,
  primary key (asset_id, entity_type, entity_id)
);

-- ---------- Versions and corrections ----------
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);

create table public.revision_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  note text not null,
  is_correction boolean not null default false,
  public boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  submitted_by uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 10 and 5000),
  evidence text,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'duplicate')),
  resolution_note text,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Snapshot every published or corrected entity so corrections show a diff.
create or replace function public.snapshot_version()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status in ('published', 'correction') and (tg_op = 'INSERT' or old is distinct from new) then
    insert into public.content_versions (entity_type, entity_id, version, snapshot, created_by)
    values (
      tg_table_name, new.id,
      coalesce((select max(version) from public.content_versions where entity_type = tg_table_name and entity_id = new.id), 0) + 1,
      to_jsonb(new), auth.uid()
    );
  end if;
  return new;
end $$;

-- Publish guard for entities: every linked claim approved, at least one claim, and a scholarly approval.
create or replace function public.guard_entity_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  n_claims integer;
  n_unapproved integer;
  etype text := case tg_table_name when 'stories' then 'story' when 'chapters' then 'chapter' when 'historical_events' then 'event' when 'relationships' then 'relationship' when 'place_geometries' then 'place_geometry' else tg_table_name end;
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

create trigger stories_guard before insert or update on public.stories for each row execute function public.guard_entity_publish();
create trigger chapters_guard before insert or update on public.chapters for each row execute function public.guard_entity_publish();
create trigger historical_events_guard before insert or update on public.historical_events for each row execute function public.guard_entity_publish();
create trigger relationships_guard before insert or update on public.relationships for each row execute function public.guard_entity_publish();
create trigger place_geometries_guard before insert or update on public.place_geometries for each row execute function public.guard_entity_publish();

create trigger stories_version after insert or update on public.stories for each row execute function public.snapshot_version();
create trigger chapters_version after insert or update on public.chapters for each row execute function public.snapshot_version();
create trigger historical_events_version after insert or update on public.historical_events for each row execute function public.snapshot_version();
create trigger evidence_claims_version after insert or update on public.evidence_claims for each row execute function public.snapshot_version();
