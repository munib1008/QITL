set search_path = public, extensions;

-- Life Through the Ages (حياة عبر العصور): how people lived, ate, worked, built, travelled and aged.
--
-- This migration is STRUCTURE ONLY. It ships no research content: no historical, archaeological, nutritional or
-- demographic statement, no citation, no lifespan and no food attributed to anyone. Editors create records; they are
-- published only after review.
--
-- Evidence model (alongside evidence_claims). Every research row carries an evidence_category:
--   A  Quran-established            needs an approved evidence_claims link whose evidence is 'quran'
--   B  authentic hadith             needs an approved claim whose every hadith reference is in Bukhari or Muslim, or is
--                                   individually graded sahih in Tirmidhi or Ibn Majah
--   C  historical / archaeological / scientific (not religious fact)   needs a named publication citation
--   D  reconstruction / hypothesis  never shown as fact: must carry is_reconstruction and is rendered apart
-- plus a primary citation, publication/edition, dating method, geographic relevance, confidence, language and the
-- last reviewed date (set when it is published).
--
-- Two review pathways: religious (scholarly_reviewer) for A/B, historical/scientific (science_reviewer) for C/D.
-- A record that mixes both needs both. Review rows live in lifestyle_reviews; the entity types are registered in
-- review_entity_types (the shared editorial_reviews constraints are not touched).

-- ---------- Helpers ----------
create or replace function public.lifestyle_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_staff() or public.has_role('science_reviewer');
$$;

-- "Day in this era" segments are parts of the day, never an hourly schedule.
create or replace function public.lifestyle_segments_ok(s jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(s) = 'array' and not exists (
    select 1 from jsonb_array_elements(s) e
    where jsonb_typeof(e) <> 'object'
      or coalesce(e ->> 'part', '') not in ('before_dawn', 'dawn', 'morning', 'midday', 'afternoon', 'sunset', 'evening', 'night')
      or jsonb_typeof(e -> 'text') is distinct from 'string'
      or (e ->> 'text') ~* '([0-9]{1,2}\s*(:|\.)\s*[0-9]{2})|([0-9]{1,2}\s*(am|pm|a\.m\.|p\.m\.))|o''clock|\mhours?\M'
  );
$$;

-- ---------- Eras and communities ----------
create table public.historical_eras (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_en text not null check (char_length(name_en) between 2 and 160),
  name_ar text,
  summary text,
  relative_order integer, -- order on the relative track; eras are never dated through a prophet
  start_year integer,     -- astronomical numbering; only for dated research (category C with a dating method)
  end_year integer,
  check (end_year is null or start_year is null or end_year >= start_year)
);

create table public.historical_communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_en text not null check (char_length(name_en) between 2 and 160),
  name_ar text,
  summary text,
  era_id uuid references public.historical_eras (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null
);

-- ---------- "How They Lived": one profile per person, one row per template field ----------
create table public.prophet_lifestyle_profiles (
  id uuid primary key default gen_random_uuid(),
  person_slug text not null unique check (person_slug ~ '^[a-z0-9-]{2,60}$'),
  person_id uuid unique references public.people (id) on delete set null
);

create table public.prophet_lifestyle_fields (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.prophet_lifestyle_profiles (id) on delete cascade,
  field_key text not null check (field_key in (
    'period', 'region', 'community', 'lifespan', 'daily_activities', 'occupation', 'foods_beverages', 'farming_livestock',
    'clothing_care', 'housing', 'transport', 'family_community', 'customs_leisure', 'education', 'health_treatment',
    'climate', 'worship', 'challenges', 'differences_modern', 'lessons')),
  position smallint not null default 1 check (position between 1 and 50),
  body_md text not null default '',
  known boolean not null default false,
  unique (profile_id, field_key, position),
  check (known or body_md = '') -- "not established" carries no text
);

-- ---------- Food ----------
create table public.historical_foods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_en text not null check (char_length(name_en) between 2 and 160),
  name_ar text,
  food_group text not null default 'other' check (food_group in ('grain', 'fruit', 'vegetable', 'legume', 'dairy', 'meat', 'fish', 'honey', 'oil', 'beverage', 'spice', 'other')),
  summary text
);

create table public.food_evidence_links (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.historical_foods (id) on delete cascade,
  link_kind text not null check (link_kind in ('scripture_mention', 'hadith_mention', 'archaeological_find', 'historical_record', 'nutrition_research', 'reconstruction')),
  statement text not null default '',
  person_id uuid references public.people (id) on delete set null,
  community_id uuid references public.historical_communities (id) on delete set null,
  era_id uuid references public.historical_eras (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  -- Only modern nutrition research (class C) may speak about health. A food in scripture is never a treatment claim.
  health_claim boolean not null default false
);

-- ---------- Occupations, housing, transport, daily activities, health ----------
do $$
declare t text;
begin
  foreach t in array array['historical_occupations', 'historical_housing', 'historical_transport', 'historical_daily_activities', 'historical_health_conditions'] loop
    execute format($f$
      create table public.%I (
        id uuid primary key default gen_random_uuid(),
        slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
        title_en text not null check (char_length(title_en) between 2 and 160),
        title_ar text,
        body_md text not null default '',
        era_id uuid references public.historical_eras (id) on delete set null,
        community_id uuid references public.historical_communities (id) on delete set null,
        person_id uuid references public.people (id) on delete set null,
        location_id uuid references public.locations (id) on delete set null,
        event_id uuid references public.historical_events (id) on delete set null,
        -- Column of the "then and now" comparison tool; null keeps a record out of it.
        comparison_band text check (comparison_band in ('ancient', 'documented', 'contemporary'))
      )$f$, t);
  end loop;
end $$;
alter table public.historical_occupations add column domain text not null default 'other'
  check (domain in ('farming', 'herding', 'crafts', 'trade', 'building', 'seafaring', 'learning', 'household', 'other'));

-- ---------- Lifespan evidence: every kind and measure in its own lane ----------
create table public.historical_lifespan_claims (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quran_statement', 'hadith_statement', 'documented', 'archaeological_estimate', 'modern_life_expectancy', 'modern_verified_max', 'speculative_theory')),
  measure text check (measure in ('years_among_people', 'total_age', 'life_expectancy_at_birth', 'after_childhood', 'maximum')),
  statement text not null default '',
  person_id uuid references public.people (id) on delete set null,
  community_id uuid references public.historical_communities (id) on delete set null,
  era_id uuid references public.historical_eras (id) on delete set null,
  population text,
  value_years numeric(6, 1) check (value_years > 0),
  value_low numeric(6, 1) check (value_low > 0),
  value_high numeric(6, 1) check (value_high > 0),
  value_note text,
  check (value_low is null or value_high is null or value_high >= value_low),
  check (kind = 'speculative_theory' or measure is not null),
  -- A speculative theory carries no number at all.
  check (kind <> 'speculative_theory' or (measure is null and value_years is null and value_low is null and value_high is null)),
  check (kind not in ('quran_statement', 'hadith_statement') or measure in ('years_among_people', 'total_age')),
  check (kind <> 'modern_life_expectancy' or measure in ('life_expectancy_at_birth', 'after_childhood')),
  check (kind <> 'modern_verified_max' or measure = 'maximum'),
  check (kind not in ('documented', 'archaeological_estimate') or measure in ('total_age', 'life_expectancy_at_birth', 'after_childhood', 'maximum'))
);

create table public.demographic_research (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  population text,
  metric text not null check (metric in ('population_size', 'life_expectancy_at_birth', 'life_expectancy_after_childhood', 'mortality', 'fertility', 'stature', 'other')),
  value numeric,
  value_low numeric,
  value_high numeric,
  unit text,
  method_note text,
  era_id uuid references public.historical_eras (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  check (value_low is null or value_high is null or value_high >= value_low)
);

-- ---------- Reconstructions (always class D) ----------
create table public.historical_reconstructions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  kind text not null check (kind in ('day_in_era', 'settlement', 'diet', 'scene', 'other')),
  title_en text not null check (char_length(title_en) between 2 and 160),
  title_ar text,
  intro_md text not null default '',
  segments jsonb not null default '[]'::jsonb check (public.lifestyle_segments_ok(segments)),
  limitations_md text not null default '',
  era_id uuid references public.historical_eras (id) on delete set null,
  community_id uuid references public.historical_communities (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null
);

-- ---------- Infographics: non-figurative only ----------
create table public.lifestyle_infographics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  kind text not null check (kind in ('diagram', 'map', 'chart', 'landscape', 'objects', 'pattern')),
  animation_key text check (animation_key ~ '^[a-z0-9-]{2,60}$'),
  asset_id uuid references public.assets (id),
  alt_text text not null check (char_length(alt_text) >= 3),
  caption text not null default '',
  era_id uuid references public.historical_eras (id) on delete set null,
  community_id uuid references public.historical_communities (id) on delete set null,
  depicts_person boolean not null default false check (depicts_person = false),    -- never a person, let alone a prophet
  depicts_unseen boolean not null default false check (depicts_unseen = false),    -- never angels, jinn or the unseen
  claims_possession boolean not null default false check (claims_possession = false), -- never "this belonged to a prophet"
  check (num_nonnulls(asset_id, animation_key) = 1)
);

-- ---------- Record types and the shared columns ----------
create table public.lifestyle_record_types (
  type text primary key,
  table_name text not null unique,
  has_evidence boolean not null default true,
  position smallint not null unique
);
insert into public.review_entity_types (type, module) values
  ('lifestyle_era', 'life_through_ages'), ('lifestyle_community', 'life_through_ages'), ('lifestyle_profile', 'life_through_ages'),
  ('lifestyle_field', 'life_through_ages'), ('lifestyle_food', 'life_through_ages'), ('lifestyle_food_link', 'life_through_ages'),
  ('lifestyle_occupation', 'life_through_ages'), ('lifestyle_housing', 'life_through_ages'), ('lifestyle_transport', 'life_through_ages'),
  ('lifestyle_activity', 'life_through_ages'), ('lifestyle_health', 'life_through_ages'), ('lifestyle_lifespan', 'life_through_ages'),
  ('lifestyle_demographic', 'life_through_ages'), ('lifestyle_reconstruction', 'life_through_ages'), ('lifestyle_infographic', 'life_through_ages'),
  ('lifestyle_source', 'life_through_ages');
alter table public.lifestyle_record_types add constraint lifestyle_record_types_type_fk foreign key (type) references public.review_entity_types (type);
insert into public.lifestyle_record_types (type, table_name, has_evidence, position) values
  ('lifestyle_era', 'historical_eras', true, 1),
  ('lifestyle_community', 'historical_communities', true, 2),
  ('lifestyle_profile', 'prophet_lifestyle_profiles', false, 3),
  ('lifestyle_field', 'prophet_lifestyle_fields', true, 4),
  ('lifestyle_food', 'historical_foods', true, 5),
  ('lifestyle_food_link', 'food_evidence_links', true, 6),
  ('lifestyle_occupation', 'historical_occupations', true, 7),
  ('lifestyle_housing', 'historical_housing', true, 8),
  ('lifestyle_transport', 'historical_transport', true, 9),
  ('lifestyle_activity', 'historical_daily_activities', true, 10),
  ('lifestyle_health', 'historical_health_conditions', true, 11),
  ('lifestyle_lifespan', 'historical_lifespan_claims', true, 12),
  ('lifestyle_demographic', 'demographic_research', true, 13),
  ('lifestyle_reconstruction', 'historical_reconstructions', true, 14),
  ('lifestyle_infographic', 'lifestyle_infographics', true, 15),
  ('lifestyle_source', 'lifestyle_source_references', false, 16);

create table public.lifestyle_source_references (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null references public.lifestyle_record_types (type),
  entity_id uuid not null,
  source_id uuid references public.sources (id),
  citation text not null check (char_length(citation) between 3 and 1000),
  publication text check (char_length(publication) between 2 and 500),
  edition text,
  locator text,
  url text check (url ~ '^https://'),
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  check (source_id is not null or publication is not null) -- a reference names its publication
);
create index lifestyle_source_references_entity on public.lifestyle_source_references (entity_type, entity_id);

-- Workflow columns on every table; the evidence block on every research table.
do $$
declare r record;
begin
  for r in select * from public.lifestyle_record_types loop
    execute format($f$
      alter table public.%I
        add column version integer not null default 1,
        add column status public.publication_status not null default 'draft',
        add column created_by uuid default auth.uid() references auth.users (id) on delete set null,
        add column created_at timestamptz not null default now(),
        add column updated_at timestamptz not null default now()
    $f$, r.table_name);
    if r.has_evidence then
      execute format($f$
        alter table public.%I
          add column evidence_category text check (evidence_category in ('A', 'B', 'C', 'D')),
          add column claim_id uuid references public.evidence_claims (id) on delete restrict,
          add column source_id uuid references public.sources (id),
          add column primary_citation text check (char_length(primary_citation) between 3 and 1000),
          add column publication text check (char_length(publication) between 2 and 500),
          add column dating_method text check (char_length(dating_method) <= 500),
          add column geographic_relevance text check (char_length(geographic_relevance) <= 500),
          add column confidence text check (confidence in ('high', 'moderate', 'low', 'speculative')),
          add column language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
          add column last_reviewed_at date,
          add column limitations text check (char_length(limitations) <= 2000),
          add column is_reconstruction boolean not null default false,
          add constraint %I check (not is_reconstruction or evidence_category = 'D'),
          add constraint %I check (evidence_category not in ('A', 'B') or confidence is distinct from 'speculative')
      $f$, r.table_name, r.table_name || '_reconstruction_is_d', r.table_name || '_religious_not_speculative');
      if r.table_name <> 'prophet_lifestyle_fields' then
        execute format('alter table public.%I alter column evidence_category set not null', r.table_name);
      end if;
    end if;
  end loop;
end $$;

-- A field is either established (with a category) or "not established" (no category, no text).
alter table public.prophet_lifestyle_fields add constraint prophet_lifestyle_fields_known_category check (known = (evidence_category is not null));
-- Years on an era only from dated research.
alter table public.historical_eras add constraint historical_eras_dated_research
  check ((start_year is null and end_year is null) or (evidence_category = 'C' and dating_method is not null));
-- Food links: the kind fixes the category, and only modern nutrition research may make a health claim.
alter table public.food_evidence_links add constraint food_evidence_links_kind_category check (
  (link_kind = 'scripture_mention' and evidence_category = 'A') or
  (link_kind = 'hadith_mention' and evidence_category = 'B') or
  (link_kind in ('archaeological_find', 'historical_record', 'nutrition_research') and evidence_category = 'C') or
  (link_kind = 'reconstruction' and evidence_category = 'D'));
alter table public.food_evidence_links add constraint food_evidence_links_health_only_research
  check (not health_claim or (link_kind = 'nutrition_research' and evidence_category = 'C'));
-- Lifespan kinds fix the category: the Quran is A, hadith is B, research is C, theories are D.
alter table public.historical_lifespan_claims add constraint historical_lifespan_claims_kind_category check (
  (kind = 'quran_statement' and evidence_category = 'A') or
  (kind = 'hadith_statement' and evidence_category = 'B') or
  (kind in ('documented', 'archaeological_estimate', 'modern_life_expectancy', 'modern_verified_max') and evidence_category = 'C') or
  (kind = 'speculative_theory' and evidence_category = 'D' and confidence is distinct from 'high'));
alter table public.demographic_research add constraint demographic_research_category check (evidence_category in ('C', 'D'));
alter table public.historical_reconstructions add constraint historical_reconstructions_category check (evidence_category = 'D');
-- Health conditions are historical or scientific research, never a religious remedy claim.
alter table public.historical_health_conditions add constraint historical_health_conditions_category check (evidence_category in ('C', 'D'));

create index prophet_lifestyle_fields_profile on public.prophet_lifestyle_fields (profile_id);
create index food_evidence_links_food on public.food_evidence_links (food_id);

-- Resolve the person row from the slug when it exists (people are imported separately).
create or replace function public.lifestyle_profile_person()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.person_id is null then
    new.person_id := (select id from public.people where slug = new.person_slug);
  end if;
  return new;
end $$;
create trigger prophet_lifestyle_profiles_person before insert or update on public.prophet_lifestyle_profiles
  for each row execute function public.lifestyle_profile_person();

-- ---------- Reviews: two pathways ----------
create table public.lifestyle_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null references public.lifestyle_record_types (type),
  entity_id uuid not null,
  pathway text not null check (pathway in ('religious', 'scientific')),
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index lifestyle_reviews_entity on public.lifestyle_reviews (entity_type, entity_id, pathway, created_at desc);

create or replace function public.lifestyle_record(t text, eid uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  tbl text := (select table_name from public.lifestyle_record_types where type = t);
  rec jsonb;
begin
  if tbl is null then
    return null;
  end if;
  execute format('select to_jsonb(x) from public.%I x where id = $1', tbl) into rec using eid;
  return rec;
end $$;

create or replace function public.lifestyle_review_ok(t text, eid uuid, p text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select decision = 'approved' from public.lifestyle_reviews
    where entity_type = t and entity_id = eid and pathway = p order by created_at desc, id desc limit 1), false);
$$;

-- Which reviews a record needs. A/B (and "not established", which is a religious statement about the sources) need
-- the religious review; C/D need the historical/scientific review; a record mixing both needs both.
create or replace function public.lifestyle_required_pathways(t text, rec jsonb)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
declare
  cats text[];
  parent jsonb;
  out text[] := '{}';
begin
  if t = 'lifestyle_profile' then
    select coalesce(array_agg(distinct coalesce(evidence_category, 'N')), '{}') into cats
    from public.prophet_lifestyle_fields where profile_id = (rec ->> 'id')::uuid and status = 'published';
  elsif t = 'lifestyle_food' then
    select array[rec ->> 'evidence_category'] || coalesce(array_agg(distinct evidence_category), '{}') into cats
    from public.food_evidence_links where food_id = (rec ->> 'id')::uuid and status not in ('archived', 'rejected');
  elsif t = 'lifestyle_source' then
    parent := public.lifestyle_record(rec ->> 'entity_type', (rec ->> 'entity_id')::uuid);
    if parent is null or rec ->> 'entity_type' = 'lifestyle_source' then
      return array['religious', 'scientific'];
    end if;
    return public.lifestyle_required_pathways(rec ->> 'entity_type', parent);
  else
    cats := array[coalesce(rec ->> 'evidence_category', 'N')];
  end if;
  if cats && array['A', 'B', 'N'] then out := out || 'religious'::text; end if;
  if cats && array['C', 'D'] then out := out || 'scientific'::text; end if;
  if cardinality(out) = 0 then out := array['religious']; end if;
  return out;
end $$;

create or replace function public.check_lifestyle_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  rec jsonb := public.lifestyle_record(new.entity_type, new.entity_id);
begin
  if rec is null then
    raise exception 'no % record %', new.entity_type, new.entity_id using errcode = 'P0001';
  end if;
  if new.pathway = 'religious' and not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('scholarly_reviewer', 'admin')) then
    raise exception 'only a scholarly reviewer may record a religious review' using errcode = '42501';
  end if;
  if new.pathway = 'scientific' and not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('science_reviewer', 'admin')) then
    raise exception 'only a science reviewer may record a historical/scientific review' using errcode = '42501';
  end if;
  if rec ->> 'created_by' = new.reviewer_id::text then
    raise exception 'a reviewer cannot review their own record' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger lifestyle_reviews_check before insert on public.lifestyle_reviews for each row execute function public.check_lifestyle_reviewer();
create trigger lifestyle_reviews_audit after insert on public.lifestyle_reviews for each row execute function public.audit();

-- ---------- Publishing ----------
create or replace function public.lifestyle_hadith_claim_ok(cid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.claim_references where claim_id = cid and kind = 'hadith')
    and not exists (
      select 1 from public.claim_references r
      join public.hadith_entries h on h.id = r.hadith_id
      left join public.hadith_gradings g on g.id = r.hadith_grading_id
      where r.claim_id = cid and r.kind = 'hadith'
        and not (
          h.collection_id in ('bukhari', 'muslim')
          or (h.collection_id in ('tirmidhi', 'ibnmajah') and g.grade in ('sahih', 'sahih li-ghayrihi'))
        )
    );
$$;

create or replace function public.guard_lifestyle_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  rt public.lifestyle_record_types := (select x from public.lifestyle_record_types x where x.table_name = tg_table_name);
  rec jsonb := to_jsonb(new);
  cat text := to_jsonb(new) ->> 'evidence_category';
  cid uuid := (to_jsonb(new) ->> 'claim_id')::uuid;
  claim public.evidence_claims;
  p text;
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published record cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'published'
     and to_jsonb(new) - 'updated_at' - 'status' - 'version' <> to_jsonb(old) - 'updated_at' - 'status' - 'version' then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  if rt.has_evidence and cat is not null then
    if rec ->> 'confidence' is null then
      raise exception 'a published record states its confidence level' using errcode = 'P0001';
    end if;
    if cat in ('A', 'B') then
      if cid is null then
        raise exception 'no evidence, no publish: a class % record needs an approved evidence claim', cat using errcode = 'P0001';
      end if;
      select * into claim from public.evidence_claims where id = cid;
      if claim.id is null or claim.status not in ('approved', 'published') then
        raise exception 'no evidence, no publish: claim % is not approved', cid using errcode = 'P0001';
      end if;
      if cat = 'A' and (claim.evidence <> 'quran' or not exists (select 1 from public.claim_references where claim_id = cid and kind = 'quran')) then
        raise exception 'class A needs a claim established by a Quran reference' using errcode = 'P0001';
      end if;
      if cat = 'B' and (claim.evidence <> 'hadith' or not public.lifestyle_hadith_claim_ok(cid)) then
        raise exception 'class B needs a claim resting only on Bukhari, Muslim, or a narration individually graded sahih in Tirmidhi or Ibn Majah' using errcode = 'P0001';
      end if;
    elsif cat = 'C' then
      if rec ->> 'publication' is null or rec ->> 'primary_citation' is null then
        raise exception 'class C needs a named publication citation' using errcode = 'P0001';
      end if;
    end if;
    if (cat = 'D') <> (rec ->> 'is_reconstruction')::boolean then
      raise exception 'a class D record is published only with the reconstruction flag (and only class D carries it)' using errcode = 'P0001';
    end if;
    new.last_reviewed_at := current_date;
  end if;

  if tg_table_name = 'prophet_lifestyle_fields' and (rec ->> 'known')::boolean and coalesce(rec ->> 'body_md', '') = '' then
    raise exception 'an established field needs its text' using errcode = 'P0001';
  end if;
  if tg_table_name = 'prophet_lifestyle_profiles' and not exists (
    select 1 from public.prophet_lifestyle_fields where profile_id = new.id and status = 'published' and known
  ) then
    raise exception 'a profile needs at least one published, established field before it is published' using errcode = 'P0001';
  end if;

  foreach p in array public.lifestyle_required_pathways(rt.type, rec) loop
    if not public.lifestyle_review_ok(rt.type, new.id, p) then
      raise exception 'no review, no publish: % % needs an approved % review', rt.type, new.id,
        case p when 'religious' then 'religious (scholarly)' else 'historical/scientific' end using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.guard_lifestyle_publish(), public.check_lifestyle_reviewer(), public.lifestyle_profile_person(),
  public.lifestyle_record(text, uuid), public.lifestyle_required_pathways(text, jsonb) from public, anon, authenticated;

-- ---------- Visibility ----------
create or replace function public.lifestyle_profile_public(pid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.prophet_lifestyle_profiles where id = pid and status = 'published');
$$;
create or replace function public.lifestyle_food_public(fid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.historical_foods where id = fid and status = 'published');
$$;

do $$
declare r record;
begin
  for r in select * from public.lifestyle_record_types loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_lifestyle_publish()', r.table_name || '_guard', r.table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', r.table_name || '_audit', r.table_name);
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('alter table public.%I force row level security', r.table_name);
    execute format('revoke all on public.%I from anon, authenticated', r.table_name);
    execute format('grant select on public.%I to anon, authenticated', r.table_name);
    execute format('grant insert, update, delete on public.%I to authenticated', r.table_name);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', r.table_name);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', r.table_name);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', r.table_name);
    if r.table_name = 'prophet_lifestyle_fields' then
      execute format('create policy read_published on public.%I for select using (public.lifestyle_staff() or (status = ''published'' and public.lifestyle_profile_public(profile_id)))', r.table_name);
    elsif r.table_name = 'food_evidence_links' then
      execute format('create policy read_published on public.%I for select using (public.lifestyle_staff() or (status = ''published'' and public.lifestyle_food_public(food_id)))', r.table_name);
    else
      execute format('create policy read_published on public.%I for select using (public.lifestyle_staff() or status = ''published'')', r.table_name);
    end if;
  end loop;
end $$;

alter table public.lifestyle_record_types enable row level security;
alter table public.lifestyle_record_types force row level security;
revoke all on public.lifestyle_record_types from anon, authenticated;
grant select on public.lifestyle_record_types to anon, authenticated;
create policy read_all on public.lifestyle_record_types for select using (true);

alter table public.lifestyle_reviews enable row level security;
alter table public.lifestyle_reviews force row level security;
revoke all on public.lifestyle_reviews from anon, authenticated;
grant select, insert on public.lifestyle_reviews to authenticated;
create policy staff_read on public.lifestyle_reviews for select to authenticated using (public.lifestyle_staff());
create policy reviewer_insert on public.lifestyle_reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and (
    (pathway = 'religious' and public.has_role('scholarly_reviewer')) or
    (pathway = 'scientific' and public.has_role('science_reviewer'))));
-- Science reviewers can see the registered review types like other staff.
create policy science_read on public.review_entity_types for select to authenticated using (public.has_role('science_reviewer'));
