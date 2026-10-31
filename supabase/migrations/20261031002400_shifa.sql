set search_path = public, extensions;

-- Shifa (شفاء): Healing Through the Quran, Sunnah & Nature.
--
-- This migration is STRUCTURE ONLY. It ships no remedy, health claim, dosage, supplication, verse, hadith, citation or
-- scholarly statement. Editors create records; a record is published only after review, and the database refuses to
-- publish one that breaks the rules below.
--
-- Evidence layers (kept apart on every record, never merged):
--   A  what the Quran says              needs an approved evidence_claims row established by a Quran reference
--   B  what authentic hadith record     needs an approved claim resting only on Bukhari, Muslim, or a narration individually
--                                       graded sahih in Tirmidhi or Ibn Majah
--   C  what modern research reports     the ONLY layer that may state a health effect; needs a named publication, a citation,
--                                       a study type, a population and stated limitations
--   D  traditional use or hypothesis    never presented as established: must carry is_traditional and/or is_hypothesis
-- A mention of a food or herb in scripture is a record, not a treatment claim: A and B rows carry no free text of their own
-- (only their approved claim), cannot state a health effect, and the page shows them apart from C.
--
-- No dosage and no "take X for Y" instruction anywhere: free-text columns refuse amounts with units, per-day frequencies and
-- imperative treatment instructions; there is no personalised-advice field and nothing is generated.
--
-- Two review pathways (as Life Through the Ages): religious (scholarly_reviewer) for A/B, scholarly notes, supplications
-- and ruqyah; clinical (science_reviewer) for C/D and every health statement. A record that needs both needs both.
-- A review binds to the version it was given for: editing the record afterwards makes the approval stale.
-- A reviewer never reviews a record they or the author of any of its parts wrote.
--
-- Ruqyah is limited to the Quran and to supplications from the allowed hadith sources; the conditions for a permissible
-- ruqyah are scholarly notes (named scholar + work), not editor opinion. Nothing here diagnoses or attributes anything to
-- jinn, the evil eye or magic.

insert into public.review_entity_types (type, module) values
  ('shifa_topic', 'shifa'), ('shifa_entry', 'shifa'), ('shifa_safety_note', 'shifa'), ('shifa_link', 'shifa');

-- ---------- Helpers ----------
create or replace function public.shifa_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_staff() or public.has_role('science_reviewer');
$$;

-- No amount with a unit and no per-day frequency: there is no dosage in this module.
create or replace function public.shifa_no_dosage(t text)
returns boolean language sql immutable as $$
  select t is null or not (
    t ~* '(^|[^[:alnum:]])[0-9٠-٩۰-۹]+([.,][0-9٠-٩۰-۹]+)?[[:space:]]*(mg|mcg|µg|gm|g|kg|ml|cc|iu|tsp|tbsp|teaspoons?|tablespoons?|spoonfuls?|capsules?|tablets?|pills?|drops?|grams?|milligrams?|litres?|liters?|cups?|glass(es)?|dates|seeds|pieces)([^[:alpha:]]|$)'
    or t ~* '(once|twice|thrice|times)[[:space:]]+(a|per|each|every)[[:space:]]+(day|night|week|morning|evening|hour|meal)'
    or t ~* '(daily|nightly|weekly)[[:space:]]+(dose|amount|intake)|recommended[[:space:]]+(dose|amount)'
  );
$$;

-- No imperative treatment instruction, and no guarantee or promised cure.
create or replace function public.shifa_no_instruction(t text)
returns boolean language sql immutable as $$
  select t is null or not (
    t ~* '(^|[.!?;:])[[:space:]]*(take|drink|eat|apply|mix|swallow|rub|inhale|consume|boil|dissolve|sip|chew)[[:space:]]'
    or t ~* '(you|we|patients|readers|everyone|one)[[:space:]]+(should|must|can|could|may|need to|ought to)[[:space:]]+(take|drink|eat|apply|consume|mix|swallow)'
    or t ~* '(guarantee[ds]?|miracle cure|cure-all|will cure|always cures|certain cure|sure cure)'
  );
$$;

create or replace function public.shifa_hadith_claim_ok(cid uuid)
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
    )
    and not exists (select 1 from public.claim_references where claim_id = cid and kind not in ('hadith', 'quran'));
$$;

-- ---------- Topics: a navigation subject (e.g. a food or a practice). Title only; no summary, so no claim hides here. ----------
create table public.shifa_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  section text not null check (section in ('quranic_healing', 'ruqyah', 'prophetic_remedies', 'wellbeing')),
  title_en text not null check (char_length(title_en) between 2 and 120),
  title_ar text check (char_length(title_ar) between 2 and 120),
  icon_key text not null default 'leaf' check (icon_key in ('leaf', 'vessel', 'water', 'light', 'pattern', 'calligraphy', 'moon', 'scale')),
  position smallint not null default 100,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifa_topics_text check (public.shifa_no_dosage(title_en) and public.shifa_no_instruction(title_en))
);

create or replace function public.shifa_topic_public(tid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.shifa_topics where id = tid and status = 'published');
$$;

-- ---------- Entries: one practice, remedy, supplication, lesson, misconception or lifestyle item under a topic ----------
create table public.shifa_entries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.shifa_topics (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  kind text not null check (kind in ('practice', 'remedy', 'supplication', 'lesson', 'misconception', 'lifestyle')),
  title_en text not null check (char_length(title_en) between 2 and 160),
  title_ar text check (char_length(title_ar) between 2 and 160),
  position smallint not null default 1,
  last_reviewed_at date,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, slug),
  constraint shifa_entries_text check (public.shifa_no_dosage(title_en) and public.shifa_no_instruction(title_en))
);
create index shifa_entries_topic on public.shifa_entries (topic_id, position);

create or replace function public.shifa_entry_public(eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.shifa_entries e join public.shifa_topics t on t.id = e.topic_id
    where e.id = eid and e.status = 'published' and t.status = 'published');
$$;

-- ---------- Layers: the per-layer rows of an entry ----------
create table public.shifa_layers (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.shifa_entries (id) on delete cascade,
  evidence_category text not null check (evidence_category in ('A', 'B', 'C', 'D')),
  position smallint not null default 1,
  claim_id uuid references public.evidence_claims (id) on delete restrict,   -- A and B only
  finding text check (char_length(finding) <= 4000),                           -- C: what the research reports; D: the traditional use or hypothesis
  publication text check (char_length(publication) between 2 and 500),         -- C
  citation text check (char_length(citation) between 3 and 1000),              -- C (D may cite a historical source)
  study_type text check (study_type in ('randomised_trial', 'systematic_review', 'meta_analysis', 'cohort', 'case_control', 'case_report', 'laboratory', 'animal', 'other')),
  population text check (char_length(population) <= 500),                      -- C: who or what was studied (people, species, cells)
  limitations text check (char_length(limitations) <= 2000),                   -- C: size, species, what was studied, conflicts of interest
  url text check (url ~ '^https://'),
  states_health_effect boolean not null default false,                         -- only a C row may say a health effect was reported
  is_traditional boolean not null default false,                               -- D
  is_hypothesis boolean not null default false,                                -- D
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A and B hold their approved claim and nothing else: scripture is shown as a record, never as a health statement.
  constraint shifa_layers_ab_shape check (evidence_category not in ('A', 'B') or (
    finding is null and publication is null and citation is null and study_type is null and population is null
    and limitations is null and url is null and not states_health_effect and not is_traditional and not is_hypothesis)),
  constraint shifa_layers_c_shape check (evidence_category <> 'C' or (claim_id is null and not is_traditional and not is_hypothesis)),
  constraint shifa_layers_d_shape check (evidence_category <> 'D' or (
    claim_id is null and not states_health_effect and publication is null and study_type is null and population is null)),
  constraint shifa_layers_text check (
    public.shifa_no_dosage(finding) and public.shifa_no_instruction(finding)
    and public.shifa_no_dosage(limitations) and public.shifa_no_instruction(limitations)
    and public.shifa_no_dosage(population) and public.shifa_no_dosage(citation) and public.shifa_no_dosage(publication))
);
create index shifa_layers_entry on public.shifa_layers (entry_id, evidence_category, position);

-- ---------- Scholarly notes: conditions and explanations belong to a named scholar and work, not to the editor ----------
create table public.shifa_scholarly_notes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.shifa_entries (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  scholar_name text not null check (char_length(scholar_name) between 2 and 200),
  work_title text not null check (char_length(work_title) between 2 and 300),
  source_id uuid references public.sources (id),
  locator text check (char_length(locator) <= 200),
  position smallint not null default 1,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entry_id, claim_id)
);
create index shifa_scholarly_notes_entry on public.shifa_scholarly_notes (entry_id, position);

-- ---------- Safety notes ----------
create table public.shifa_safety_notes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.shifa_topics (id) on delete cascade,
  entry_id uuid references public.shifa_entries (id) on delete cascade,
  kind text not null check (kind in ('general', 'pregnancy_children', 'interactions', 'emergency', 'mental_health', 'crisis', 'ruling_referral')),
  body_en text not null check (char_length(body_en) between 10 and 2000),
  body_ar text check (char_length(body_ar) <= 2000),
  position smallint not null default 1,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifa_safety_notes_text check (public.shifa_no_dosage(body_en) and public.shifa_no_dosage(body_ar))
);
create index shifa_safety_notes_topic on public.shifa_safety_notes (topic_id, position);

-- ---------- Links: to people, events, stories, Life Guidance topics and foods (no free text) ----------
create table public.shifa_links (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.shifa_topics (id) on delete cascade,
  entry_id uuid references public.shifa_entries (id) on delete cascade,
  target_kind text not null check (target_kind in ('person', 'event', 'story', 'guidance_topic', 'food')),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  guidance_topic_id uuid references public.guidance_topics (id) on delete cascade,
  food_id uuid references public.historical_foods (id) on delete cascade,
  position smallint not null default 1,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(person_id, event_id, story_id, guidance_topic_id, food_id) = 1),
  check ((target_kind = 'person') = (person_id is not null)),
  check ((target_kind = 'event') = (event_id is not null)),
  check ((target_kind = 'story') = (story_id is not null)),
  check ((target_kind = 'guidance_topic') = (guidance_topic_id is not null)),
  check ((target_kind = 'food') = (food_id is not null))
);
create index shifa_links_person on public.shifa_links (person_id) where person_id is not null;
create index shifa_links_guidance on public.shifa_links (guidance_topic_id) where guidance_topic_id is not null;

-- ---------- Reviews: two pathways ----------
create table public.shifa_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('shifa_topic', 'shifa_entry', 'shifa_safety_note', 'shifa_link')),
  entity_id uuid not null,
  entity_version integer not null default 1,   -- set by the database to the version being reviewed
  pathway text not null check (pathway in ('religious', 'clinical')),
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index shifa_reviews_entity on public.shifa_reviews (entity_type, entity_id, pathway, created_at desc);

create or replace function public.shifa_table(t text)
returns text language sql immutable as $$
  select case t when 'shifa_topic' then 'shifa_topics' when 'shifa_entry' then 'shifa_entries'
    when 'shifa_safety_note' then 'shifa_safety_notes' when 'shifa_link' then 'shifa_links' end;
$$;

create or replace function public.shifa_record(t text, eid uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  tbl text := public.shifa_table(t);
  rec jsonb;
begin
  if tbl is null then
    return null;
  end if;
  execute format('select to_jsonb(x) from public.%I x where id = $1', tbl) into rec using eid;
  return rec;
end $$;

-- Everyone who wrote the record or any part of it (an entry's layers and scholarly notes).
create or replace function public.shifa_authors(t text, eid uuid)
returns uuid[] language plpgsql stable security definer set search_path = public, extensions as $$
declare
  out uuid[] := '{}';
  rec jsonb := public.shifa_record(t, eid);
begin
  if rec is null then
    return out;
  end if;
  if rec ->> 'created_by' is not null then out := out || (rec ->> 'created_by')::uuid; end if;
  if t = 'shifa_entry' then
    out := out || coalesce((select array_agg(created_by) from public.shifa_layers where entry_id = eid and created_by is not null), '{}')
               || coalesce((select array_agg(created_by) from public.shifa_scholarly_notes where entry_id = eid and created_by is not null), '{}');
  end if;
  return out;
end $$;

-- Which reviews a record needs. Religious: A/B, scholarly notes, supplications, Quranic healing and ruqyah.
-- Clinical: C/D, remedies, lifestyle items and anything in the remedies or wellbeing sections. Both when both apply.
create or replace function public.shifa_required_pathways(t text, rec jsonb)
returns text[] language plpgsql stable security definer set search_path = public, extensions as $$
declare
  sec text;
  cats text[];
  out text[] := '{}';
begin
  if t = 'shifa_topic' then
    sec := rec ->> 'section';
    out := array['religious'];
    if sec in ('prophetic_remedies', 'wellbeing') then out := out || 'clinical'::text; end if;
    return out;
  elsif t = 'shifa_safety_note' then
    return case when rec ->> 'kind' = 'ruling_referral' then array['religious'] else array['clinical'] end;
  elsif t = 'shifa_link' then
    return array['religious'];
  end if;
  select section into sec from public.shifa_topics where id = (rec ->> 'topic_id')::uuid;
  select coalesce(array_agg(distinct evidence_category), '{}') into cats from public.shifa_layers where entry_id = (rec ->> 'id')::uuid;
  if cats && array['A', 'B'] or rec ->> 'kind' = 'supplication' or sec in ('quranic_healing', 'ruqyah')
     or exists (select 1 from public.shifa_scholarly_notes where entry_id = (rec ->> 'id')::uuid) then
    out := out || 'religious'::text;
  end if;
  if cats && array['C', 'D'] or rec ->> 'kind' in ('remedy', 'lifestyle') or sec in ('prophetic_remedies', 'wellbeing') then
    out := out || 'clinical'::text;
  end if;
  if cardinality(out) = 0 then out := array['religious']; end if;
  return out;
end $$;

-- The latest review of this pathway, for the version being published, must approve.
create or replace function public.shifa_review_ok(t text, eid uuid, p text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select r.decision = 'approved' from public.shifa_reviews r
    where r.entity_type = t and r.entity_id = eid and r.pathway = p
      and r.entity_version = (public.shifa_record(t, eid) ->> 'version')::int
    order by r.created_at desc, r.id desc limit 1), false);
$$;

create or replace function public.check_shifa_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  rec jsonb := public.shifa_record(new.entity_type, new.entity_id);
begin
  if rec is null then
    raise exception 'no % record %', new.entity_type, new.entity_id using errcode = 'P0001';
  end if;
  new.entity_version := (rec ->> 'version')::int;
  if new.pathway = 'religious' and not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('scholarly_reviewer', 'admin')) then
    raise exception 'only a scholarly reviewer may record a religious review' using errcode = '42501';
  end if;
  if new.pathway = 'clinical' and not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('science_reviewer', 'admin')) then
    raise exception 'only a science reviewer may record a clinical review' using errcode = '42501';
  end if;
  if new.reviewer_id = any (public.shifa_authors(new.entity_type, new.entity_id)) then
    raise exception 'a reviewer cannot review their own record' using errcode = '42501';
  end if;
  if not (new.pathway = any (public.shifa_required_pathways(new.entity_type, rec))) then
    raise exception 'the % review is not required for this record', new.pathway using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger shifa_reviews_check before insert on public.shifa_reviews for each row execute function public.check_shifa_reviewer();
create trigger shifa_reviews_audit after insert on public.shifa_reviews for each row execute function public.audit();

-- ---------- Publishing ----------
create or replace function public.guard_shifa_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := case tg_table_name when 'shifa_topics' then 'shifa_topic' when 'shifa_entries' then 'shifa_entry'
    when 'shifa_safety_notes' then 'shifa_safety_note' else 'shifa_link' end;
  rec jsonb := to_jsonb(new);
  l public.shifa_layers;
  n public.shifa_scholarly_notes;
  claim public.evidence_claims;
  sec text;
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

  if tg_table_name = 'shifa_topics' then
    if not exists (select 1 from public.shifa_entries where topic_id = new.id and status = 'published') then
      raise exception 'a topic needs at least one published entry before it is published' using errcode = 'P0001';
    end if;
    if new.section = 'wellbeing' and not (
      exists (select 1 from public.shifa_safety_notes where topic_id = new.id and status = 'published' and kind = 'mental_health')
      and exists (select 1 from public.shifa_safety_notes where topic_id = new.id and status = 'published' and kind = 'crisis')
    ) then
      raise exception 'a wellbeing topic needs a published mental-health note and a published crisis note before it is published' using errcode = 'P0001';
    end if;

  elsif tg_table_name = 'shifa_entries' then
    select section into sec from public.shifa_topics where id = new.topic_id;
    if not exists (select 1 from public.shifa_layers where entry_id = new.id)
       and not exists (select 1 from public.shifa_scholarly_notes where entry_id = new.id) then
      raise exception 'no evidence, no publish: an entry needs at least one evidence layer' using errcode = 'P0001';
    end if;
    for l in select * from public.shifa_layers where entry_id = new.id loop
      if l.evidence_category in ('A', 'B') then
        if l.claim_id is null then
          raise exception 'no evidence, no publish: a class % layer needs an approved evidence claim', l.evidence_category using errcode = 'P0001';
        end if;
        select * into claim from public.evidence_claims where id = l.claim_id;
        if claim.id is null or claim.status not in ('approved', 'published') then
          raise exception 'no evidence, no publish: claim % is not approved', l.claim_id using errcode = 'P0001';
        end if;
        if l.evidence_category = 'A' and (claim.evidence <> 'quran' or not exists (select 1 from public.claim_references where claim_id = l.claim_id and kind = 'quran')) then
          raise exception 'class A needs a claim established by a Quran reference' using errcode = 'P0001';
        end if;
        if l.evidence_category = 'B' and (claim.evidence <> 'hadith' or not public.shifa_hadith_claim_ok(l.claim_id)) then
          raise exception 'class B needs a claim resting only on Bukhari, Muslim, or a narration individually graded sahih in Tirmidhi or Ibn Majah' using errcode = 'P0001';
        end if;
      elsif l.evidence_category = 'C' then
        if coalesce(btrim(l.finding), '') = '' or l.publication is null or l.citation is null or l.study_type is null or coalesce(btrim(l.population), '') = '' then
          raise exception 'class C needs the finding, a named publication, a citation, the study type and the population' using errcode = 'P0001';
        end if;
        if char_length(btrim(coalesce(l.limitations, ''))) < 20 then
          raise exception 'class C must state its limitations (size, species or population, what was studied, conflicts)' using errcode = 'P0001';
        end if;
      else
        if coalesce(btrim(l.finding), '') = '' then
          raise exception 'a class D layer needs its statement' using errcode = 'P0001';
        end if;
        if not (l.is_traditional or l.is_hypothesis) then
          raise exception 'a class D layer is published only flagged as traditional use or hypothesis, never as established' using errcode = 'P0001';
        end if;
      end if;
    end loop;
    for n in select * from public.shifa_scholarly_notes where entry_id = new.id loop
      select * into claim from public.evidence_claims where id = n.claim_id;
      if claim.id is null or claim.status not in ('approved', 'published') then
        raise exception 'no evidence, no publish: scholarly claim % is not approved', n.claim_id using errcode = 'P0001';
      end if;
      if claim.evidence <> 'scholar' then
        raise exception 'a scholarly note must rest on a claim of class scholarly interpretation' using errcode = 'P0001';
      end if;
    end loop;
    if new.kind = 'supplication' and not exists (select 1 from public.shifa_layers where entry_id = new.id and evidence_category in ('A', 'B')) then
      raise exception 'a supplication comes only from the Quran (A) or authentic hadith (B)' using errcode = 'P0001';
    end if;
    if sec = 'ruqyah' then
      if exists (select 1 from public.shifa_layers where entry_id = new.id and evidence_category in ('C', 'D')) then
        raise exception 'ruqyah entries rest only on the Quran and authentic hadith (A/B) and named scholars' using errcode = 'P0001';
      end if;
      if new.kind in ('practice', 'lesson', 'misconception') and not exists (select 1 from public.shifa_scholarly_notes where entry_id = new.id) then
        raise exception 'the conditions of ruqyah are scholarly claims: add a note with a named scholar and work' using errcode = 'P0001';
      end if;
    end if;
    if new.kind = 'remedy' or sec = 'prophetic_remedies' then
      if not exists (select 1 from public.shifa_safety_notes where status = 'published' and kind = 'general' and (topic_id = new.topic_id and (entry_id is null or entry_id = new.id)))
         or not exists (select 1 from public.shifa_safety_notes where status = 'published' and kind = 'interactions' and (topic_id = new.topic_id and (entry_id is null or entry_id = new.id))) then
        raise exception 'a remedy page needs a published general safety note and a published interactions note before it is published' using errcode = 'P0001';
      end if;
    end if;
    new.last_reviewed_at := current_date;

  elsif tg_table_name = 'shifa_safety_notes' then
    if new.entry_id is not null and not exists (select 1 from public.shifa_entries where id = new.entry_id and topic_id = new.topic_id) then
      raise exception 'the entry of a safety note belongs to the same topic' using errcode = 'P0001';
    end if;

  elsif tg_table_name = 'shifa_links' then
    if new.entry_id is not null and not exists (select 1 from public.shifa_entries where id = new.entry_id and topic_id = new.topic_id) then
      raise exception 'the entry of a link belongs to the same topic' using errcode = 'P0001';
    end if;
  end if;

  foreach p in array public.shifa_required_pathways(etype, rec) loop
    if not public.shifa_review_ok(etype, new.id, p) then
      raise exception 'no review, no publish: % % needs an approved % review of this version', etype, new.id,
        case p when 'religious' then 'religious (scholarly)' else 'clinical (science)' end using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

-- The parts of a published entry are frozen with it (move the entry to correction first); changing them while it is
-- still a draft makes the entry a new version, so earlier approvals no longer count.
create or replace function public.guard_shifa_parts()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  ids uuid[] := array[]::uuid[];
  eid uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then ids := ids || old.entry_id; end if;
  if tg_op in ('UPDATE', 'INSERT') and not (new.entry_id = any (ids)) then ids := ids || new.entry_id; end if;
  foreach eid in array ids loop
    if exists (select 1 from public.shifa_entries where id = eid and status = 'published') then
      raise exception 'the layers of a published entry cannot change; move the entry to correction first' using errcode = 'P0001';
    end if;
  end loop;
  foreach eid in array ids loop
    update public.shifa_entries set version = version + 1 where id = eid;
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

revoke execute on function public.guard_shifa_publish(), public.guard_shifa_parts(), public.check_shifa_reviewer(),
  public.shifa_record(text, uuid), public.shifa_authors(text, uuid), public.shifa_required_pathways(text, jsonb),
  public.shifa_review_ok(text, uuid, text), public.shifa_hadith_claim_ok(uuid) from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['shifa_topics', 'shifa_entries', 'shifa_safety_notes', 'shifa_links'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_shifa_publish()', t || '_guard', t);
  end loop;
  foreach t in array array['shifa_layers', 'shifa_scholarly_notes'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_shifa_parts()', t || '_guard', t);
  end loop;
  -- The author column is the database's record (docs/SECURITY.md): stamped on insert, never changed after.
  foreach t in array array['shifa_topics', 'shifa_entries', 'shifa_layers', 'shifa_scholarly_notes', 'shifa_safety_notes', 'shifa_links'] loop
    execute format('create trigger a0_stamp_author before insert or update on public.%I for each row execute function public.stamp_author(%L)', t, 'created_by');
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
  end loop;
  foreach t in array array['shifa_topics', 'shifa_entries', 'shifa_safety_notes', 'shifa_links'] loop
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
  foreach t in array array['shifa_layers', 'shifa_scholarly_notes'] loop
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor''))', t);
    execute format('create policy editor_delete on public.%I for delete to authenticated using (public.has_role(''editor''))', t);
  end loop;
end $$;

-- Register the author columns: a reviewer never reviews a record they wrote (tests/db/security.test.ts fails otherwise).
insert into public.review_entity_authors (entity_type, table_name, author_column) values
  ('shifa_topic', 'shifa_topics', 'created_by'),
  ('shifa_entry', 'shifa_entries', 'created_by'),
  ('shifa_entry', 'shifa_layers', 'created_by'),
  ('shifa_entry', 'shifa_scholarly_notes', 'created_by'),
  ('shifa_safety_note', 'shifa_safety_notes', 'created_by'),
  ('shifa_link', 'shifa_links', 'created_by');

-- ---------- Visibility: any visitor reads published records of a published topic; staff read everything ----------
create policy read_published on public.shifa_topics for select using (public.shifa_staff() or status = 'published');
create policy read_published on public.shifa_entries for select using (public.shifa_staff() or (status = 'published' and public.shifa_topic_public(topic_id)));
create policy read_published on public.shifa_safety_notes for select using (public.shifa_staff() or (status = 'published' and public.shifa_topic_public(topic_id)));
create policy read_published on public.shifa_links for select using (
  public.shifa_staff() or (status = 'published' and public.shifa_topic_public(topic_id) and (entry_id is null or public.shifa_entry_public(entry_id))));
create policy read_published on public.shifa_layers for select using (public.shifa_staff() or public.shifa_entry_public(entry_id));
create policy read_published on public.shifa_scholarly_notes for select using (public.shifa_staff() or public.shifa_entry_public(entry_id));

alter table public.shifa_reviews enable row level security;
alter table public.shifa_reviews force row level security;
revoke all on public.shifa_reviews from anon, authenticated;
grant select, insert on public.shifa_reviews to authenticated;
create policy staff_read on public.shifa_reviews for select to authenticated using (public.shifa_staff());
create policy reviewer_insert on public.shifa_reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and (
    (pathway = 'religious' and public.has_role('scholarly_reviewer')) or
    (pathway = 'clinical' and public.has_role('science_reviewer'))));
