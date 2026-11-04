set search_path = public, extensions;

-- Signs in Creation: Quran & Science Discovery Center. docs/QURAN_SCIENCE.md.
-- A research registry on how Quranic passages about the natural world relate to established science. It is NOT a list of
-- "scientific miracle" claims. Three assessments are kept SEPARATE and are never combined into a score:
--   (1) scientific evidence state        (science_claims.evidence_state; reviewer-recorded in science_claim_assessments)
--   (2) textual interpretation strength  (quran_science_links.interpretation_strength)
--   (3) strength of the proposed connection (quran_science_links.connection_strength, a reviewer-set category, never computed)
-- plus one relationship classification (quran_science_links.relationship). Metaphysical matters (angels, jinn, the unseen,
-- the resurrection) are 'outside_empirical_science' and never described as awaiting laboratory proof.
--
--  * A year, DOI or publication needs a recorded verified_source (a URL). The integrity check fails otherwise.
--  * 'Verified' is reachable only through TWO separate, version-bound human reviews by two different appointed people:
--    science_expert_reviews (role science_reviewer) and science_scholarly_reviews (role scholarly_reviewer). No self-review.
--    A review must be recorded by the signed-in reviewer themself, so no job, AI or service key can create one.
--  * Changing any classification or rating sends the topic back for re-review (both approvals invalidated, off the public pages).
--  * Public reading is only through security-definer functions (public_science_*); the tables stay closed to anon.
--  * Hadith and tafsir wording are never stored here: an interpretation row is attributed and carries 'needs_source' until a
--    source is recorded, and holds no summary text while it needs a source.

-- ---------- Text guard (mirrors src/lib/science/validator.ts; tests/db/science.test.ts compares them on shared samples) ----------
create or replace function public.science_text_ok(t text)
returns boolean language sql immutable as $$
  select t is null or not (
       t ~* '\mproof\s+score\M'
    or t ~* 'scientific\s+miracles?\s+(is\s+|are\s+)?(proven|proved|confirmed)'
    or t ~* '\m(science|scientists|research|modern science)\s+(has\s+|have\s+)?(proved|proven|confirmed)\M[^.]{0,60}\m(angels?|jinn|the unseen|resurrection|allah|god)\M'
    or t ~* '\m(proves?|proved|proven)\M[^.]{0,40}\m(the existence of|that)\M[^.]{0,30}\m(angels?|jinn|the unseen|resurrection)\M'
    or t ~* '\m(future|later|coming|upcoming|further)\s+(science|research|discoveries|studies|findings)\s+(will|shall)\s+(confirm|prove|verify|show)'
    or t ~* '\m(will|shall)\s+(one day\s+|eventually\s+|surely\s+)?(prove|confirm|verify)\s+(the\s+)?(quran|verse|this)\M'
    or t ~* '\m(awaiting|awaits?|pending|until)\s+(laboratory|scientific|empirical)\s+(proof|confirmation|verification)'
    or t ~* '\mcures?\s+(all|every|any)\M'
    or t ~* '\mguarantee[sd]?\s+(healing|cure|recovery)'
    or t ~* '\m\d{1,3}\s*%\s*(confidence|certain|certainty|sure|proven|accurate|match)'
    or t ~* '\mconfidence\s+(score|level|rating)?\s*(of|:|=)?\s*\d'
    or t ~* 'معجزة علمية (مثبتة|ثابتة)|ثبت علميا أن'
    or t ~ 'سائنسی معجزہ ثابت|سائنس نے ثابت کر دیا'
  );
$$;

create or replace function public.science_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_staff() or exists (select 1 from public.role_assignments ra where ra.user_id = auth.uid() and ra.role = 'science_reviewer');
$$;

-- ---------- 1. Topics ----------
create table public.science_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,80}$'),
  title_en text not null check (char_length(title_en) between 3 and 200 and public.science_text_ok(title_en)),
  title_ar text not null check (char_length(title_ar) between 2 and 200 and public.science_text_ok(title_ar)),
  title_ur text not null check (char_length(title_ur) between 2 and 200 and public.science_text_ok(title_ur)),
  discipline text not null check (discipline in ('cosmology', 'astronomy', 'earth_science', 'oceanography', 'hydrology', 'biology', 'embryology', 'geology', 'physics', 'metaphysics')),
  -- 'unseen' topics are classified outside empirical science and are never described as awaiting laboratory proof
  topic_kind text not null default 'natural' check (topic_kind in ('natural', 'unseen')),
  summary_en text check (summary_en is null or (char_length(summary_en) <= 1500 and public.science_text_ok(summary_en))),
  phenomenon_en text check (phenomenon_en is null or (char_length(phenomenon_en) <= 3000 and public.science_text_ok(phenomenon_en))),
  limitations_en text check (limitations_en is null or (char_length(limitations_en) <= 3000 and public.science_text_ok(limitations_en))),
  alternatives_en text check (alternatives_en is null or (char_length(alternatives_en) <= 3000 and public.science_text_ok(alternatives_en))),
  conclusion_en text check (conclusion_en is null or (char_length(conclusion_en) <= 2000 and public.science_text_ok(conclusion_en))),
  -- the required "What This Evidence Does Not Establish" section, in all three languages
  does_not_establish_en text not null check (char_length(does_not_establish_en) between 20 and 2000 and public.science_text_ok(does_not_establish_en)),
  does_not_establish_ar text not null check (char_length(does_not_establish_ar) between 10 and 2000 and public.science_text_ok(does_not_establish_ar)),
  does_not_establish_ur text not null check (char_length(does_not_establish_ur) between 10 and 2000 and public.science_text_ok(does_not_establish_ur)),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  classification_version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  visibility text not null default 'private_draft' check (visibility in ('private_draft', 'public_ai_draft', 'public_approved', 'archived')),
  integrity_status text not null default 'pending' check (integrity_status in ('pending', 'passed', 'failed', 'needs_investigation')),
  integrity_report jsonb,
  integrity_checked_at timestamptz,
  -- two SEPARATE reviews: the religious relationship, and the science
  scholarly_status text not null default 'not_reviewed' check (scholarly_status in ('not_reviewed', 'under_review', 'changes_requested', 'approved', 'rejected', 'invalidated')),
  scientific_review text not null default 'not_reviewed' check (scientific_review in ('not_reviewed', 'under_review', 'changes_requested', 'approved', 'rejected', 'invalidated')),
  ai_generated boolean not null default false,
  ai_model text check (ai_model is null or char_length(ai_model) <= 80),
  prompt_version text check (prompt_version is null or char_length(prompt_version) <= 40),
  ai_published_at timestamptz,
  withdrawn_reason text check (withdrawn_reason is null or char_length(withdrawn_reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index science_topics_visibility on public.science_topics (visibility, status);

-- ---------- 2. Claims: the scientific statement and its evidence state ----------
create table public.science_claims (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  claim_en text not null check (char_length(claim_en) between 5 and 1200 and public.science_text_ok(claim_en)),
  claim_kind text not null default 'observation' check (claim_kind in ('observation', 'theory', 'mechanism', 'historical', 'metaphysical')),
  -- (1) scientific evidence state. 'unassessed' until a reviewer records an assessment.
  evidence_state text not null default 'unassessed' check (evidence_state in
    ('unassessed', 'established', 'well_supported', 'emerging_evidence', 'hypothesis', 'speculative', 'unsupported_or_contradicted', 'outside_empirical_science')),
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index science_claims_topic on public.science_claims (topic_id, position);

create table public.science_claim_assessments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.science_claims (id) on delete cascade,
  evidence_state text not null check (evidence_state in
    ('established', 'well_supported', 'emerging_evidence', 'hypothesis', 'speculative', 'unsupported_or_contradicted', 'outside_empirical_science')),
  rationale text not null check (char_length(rationale) between 10 and 2000 and public.science_text_ok(rationale)),
  basis_url text check (basis_url is null or basis_url ~ '^https?://'),
  assessor_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------- 3. Publications (a citation needs a DOI or a URL; shown only when verified) ----------
create table public.science_publications (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 400),
  authors text[] not null default '{}',
  doi text check (doi is null or doi ~ '^10\.\d{4,9}/\S+$'),
  year smallint check (year is null or year between 1 and 2100),
  url text check (url is null or url ~ '^https?://'),
  -- where this citation was checked (URL) and what was checked; required before a year or DOI may be set
  verified_source text check (verified_source is null or verified_source ~ '^https?://'),
  verified_note text check (verified_note is null or char_length(verified_note) <= 600),
  -- settable only by a science reviewer or an administrator (guard trigger)
  verified boolean not null default false,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint science_publication_has_locator check (doi is not null or url is not null),
  constraint science_publication_year_needs_source check ((doi is null and year is null) or verified_source is not null),
  constraint science_publication_verified_needs_source check (not verified or (verified_source is not null and verified_note is not null))
);

-- ---------- 4. Discovery history ----------
create table public.science_discoveries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  title_en text not null check (char_length(title_en) between 3 and 300 and public.science_text_ok(title_en)),
  summary_en text check (summary_en is null or (char_length(summary_en) <= 1500 and public.science_text_ok(summary_en))),
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.science_discovery_milestones (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references public.science_discoveries (id) on delete cascade,
  kind text not null check (kind in ('observation', 'hypothesis', 'experiment', 'confirmation', 'refinement', 'consensus')),
  label_en text not null check (char_length(label_en) between 3 and 400 and public.science_text_ok(label_en)),
  year smallint check (year is null or year between 1 and 2100),
  publication_id uuid references public.science_publications (id) on delete set null,
  verified_source text check (verified_source is null or verified_source ~ '^https?://'),
  verified_note text check (verified_note is null or char_length(verified_note) <= 600),
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint science_milestone_year_needs_source check (year is null or (verified_source is not null and verified_note is not null))
);

-- ---------- 5. Evidence and open questions ----------
create table public.science_evidence (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  claim_id uuid references public.science_claims (id) on delete set null,
  publication_id uuid references public.science_publications (id) on delete set null,
  evidence_kind text not null default 'review_article' check (evidence_kind in ('observation', 'measurement', 'review_article', 'consensus_statement', 'textbook', 'other')),
  summary_en text not null check (char_length(summary_en) between 5 and 1500 and public.science_text_ok(summary_en)),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_status = 'needs_source' or publication_id is not null)
);

create table public.science_open_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  question_en text not null check (char_length(question_en) between 5 and 600 and public.science_text_ok(question_en)),
  known_en text check (known_en is null or (char_length(known_en) <= 1500 and public.science_text_ok(known_en))),
  uncertain_en text check (uncertain_en is null or (char_length(uncertain_en) <= 1500 and public.science_text_ok(uncertain_en))),
  competing_en text check (competing_en is null or (char_length(competing_en) <= 1500 and public.science_text_ok(competing_en))),
  testability text not null default 'unassessed' check (testability in ('unassessed', 'testable', 'partly_testable', 'not_testable')),
  why_connection_en text check (why_connection_en is null or (char_length(why_connection_en) <= 1500 and public.science_text_ok(why_connection_en))),
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 6. The Quran link (many to many; one row per verse) ----------
create table public.quran_science_links (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  surah_id smallint not null,
  ayah_no smallint not null,
  -- Arabic words exactly as they appear in the verse text of the loaded corpus (checked by the guard)
  arabic_terms text[] not null default '{}',
  -- relationship classification
  relationship text not null default 'unassessed' check (relationship in
    ('unassessed', 'scientifically_established', 'consistent_interpretation', 'interpretation_debated', 'active_research', 'not_scientifically_testable', 'unsupported_claim')),
  -- (2) textual interpretation strength
  interpretation_strength text not null default 'unassessed' check (interpretation_strength in
    ('unassessed', 'explicit_textual_description', 'strongly_supported_linguistic_reading', 'plausible_interpretive_connection', 'disputed_interpretation', 'weak_or_strained', 'unsupported')),
  -- (3) strength of the proposed connection: a reviewer-set category, never computed from the other two
  connection_strength text not null default 'unassessed' check (connection_strength in ('unassessed', 'strong', 'moderate', 'limited', 'tentative', 'none_claimed')),
  note_en text check (note_en is null or (char_length(note_en) <= 1500 and public.science_text_ok(note_en))),
  position integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no),
  unique (topic_id, surah_id, ayah_no)
);
create index quran_science_links_verse on public.quran_science_links (surah_id, ayah_no);

-- Attributed interpretations. No wording is stored until a source is recorded; a classical scholar is never given a modern reading.
create table public.quran_science_interpretations (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.quran_science_links (id) on delete cascade,
  scholar_name text check (scholar_name is null or char_length(scholar_name) between 2 and 160),
  work_title text check (work_title is null or char_length(work_title) <= 300),
  locator text check (locator is null or char_length(locator) <= 200),
  era text not null check (era in ('classical', 'contemporary')),
  -- null = not established. True only with a recorded source.
  proposed_after_discovery boolean,
  source_id uuid references public.sources (id),
  summary_en text check (summary_en is null or (char_length(summary_en) <= 1500 and public.science_text_ok(summary_en))),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint science_interp_sourced check (evidence_status = 'sourced' or (summary_en is null and proposed_after_discovery is null and source_id is null)),
  constraint science_interp_source_needs_source check (evidence_status = 'needs_source' or (source_id is not null and scholar_name is not null and work_title is not null))
);

-- ---------- 7. Visual assets, localizations, history ----------
create table public.science_visual_assets (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  kind text not null check (kind in ('diagram', 'chart', 'photograph', 'video', 'animation')),
  title_en text not null check (char_length(title_en) between 3 and 200 and public.science_text_ok(title_en)),
  asset_ref text check (asset_ref is null or char_length(asset_ref) <= 500),
  alt_text_en text not null check (char_length(alt_text_en) between 10 and 600),
  credit text check (credit is null or char_length(credit) <= 300),
  licence_status text not null default 'needs_licence' check (licence_status in ('needs_licence', 'cleared')),
  -- prophets, angels and jinn are never depicted
  depicts_sacred_figure boolean not null default false check (depicts_sacred_figure = false),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (licence_status = 'needs_licence' or (asset_ref is not null and credit is not null))
);

create table public.science_localizations (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  language text not null check (language in ('ar', 'ur')),
  field text not null check (field in ('summary', 'phenomenon', 'limitations', 'alternatives', 'conclusion')),
  body text not null check (char_length(body) between 2 and 3000 and public.science_text_ok(body)),
  origin text not null default 'ai_draft' check (origin in ('ai_draft', 'human')),
  translator_reviewed boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, language, field)
);

-- Append-only: written by triggers, never by an API role.
create table public.science_revision_history (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  topic_version integer not null,
  action text not null check (char_length(action) <= 80),
  actor uuid,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index science_revision_history_topic on public.science_revision_history (topic_id, created_at desc);

-- ---------- 8. The two SEPARATE reviews ----------
create table public.science_expert_reviews (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  topic_version integer not null default 1,
  scope text not null default 'overall' check (scope in ('overall', 'evidence_state', 'citations', 'dates')),
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index science_expert_reviews_topic on public.science_expert_reviews (topic_id, created_at desc);

create table public.science_scholarly_reviews (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.science_topics (id) on delete cascade,
  topic_version integer not null default 1,
  scope text not null default 'overall' check (scope in ('overall', 'interpretation', 'relationship')),
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index science_scholarly_reviews_topic on public.science_scholarly_reviews (topic_id, created_at desc);

-- ---------- 9. Helpers ----------
-- Workflow columns, not content.
create or replace function public.science_content(rec jsonb)
returns jsonb language sql immutable as $$
  select rec - 'status' - 'updated_at' - 'version' - 'visibility' - 'integrity_status' - 'integrity_report' - 'integrity_checked_at'
    - 'scholarly_status' - 'scientific_review' - 'ai_published_at' - 'needs_rereview' - 'rereview_reason' - 'classification_version' - 'withdrawn_reason';
$$;

-- The latest OVERALL review of the CURRENT version must approve; each pathway is separate.
create or replace function public.science_scientific_ok(tid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select r.decision = 'approved' from public.science_expert_reviews r
    where r.topic_id = tid and r.scope = 'overall' and r.topic_version = (select t.version from public.science_topics t where t.id = tid)
    order by r.created_at desc, r.id desc limit 1), false);
$$;
create or replace function public.science_scholarly_ok(tid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select r.decision = 'approved' from public.science_scholarly_reviews r
    where r.topic_id = tid and r.scope = 'overall' and r.topic_version = (select t.version from public.science_topics t where t.id = tid)
    order by r.created_at desc, r.id desc limit 1), false);
$$;
-- Two different people must have approved.
create or replace function public.science_approvers_distinct(tid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select (select r.reviewer_id from public.science_expert_reviews r where r.topic_id = tid and r.scope = 'overall' order by r.created_at desc, r.id desc limit 1)
      is distinct from
         (select r.reviewer_id from public.science_scholarly_reviews r where r.topic_id = tid and r.scope = 'overall' order by r.created_at desc, r.id desc limit 1);
$$;

create or replace function public.science_topic_visible(tid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.science_topics n where n.id = tid and (
    (n.status = 'published' and n.visibility = 'public_approved')
    or (n.visibility = 'public_ai_draft' and n.integrity_status = 'passed' and n.ai_generated
        and n.scholarly_status <> 'rejected' and n.scientific_review <> 'rejected')));
$$;

create or replace function public.science_has_role(r text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select auth.uid() is not null and exists (select 1 from public.role_assignments ra where ra.user_id = auth.uid() and ra.role::text = r);
$$;

create or replace function public.science_snapshot(tid uuid, act text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare t public.science_topics;
begin
  select * into t from public.science_topics where id = tid;
  if not found then return; end if;
  insert into public.science_revision_history (topic_id, topic_version, action, actor, snapshot)
  values (tid, t.version, act, auth.uid(), jsonb_build_object(
    'topic', public.science_content(to_jsonb(t)) || jsonb_build_object('status', t.status, 'visibility', t.visibility, 'scholarly_status', t.scholarly_status, 'scientific_review', t.scientific_review),
    'claims', coalesce((select jsonb_agg(to_jsonb(c) order by c.position, c.created_at) from public.science_claims c where c.topic_id = tid), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l) order by l.position, l.surah_id, l.ayah_no) from public.quran_science_links l where l.topic_id = tid), '[]'::jsonb)));
end $$;

-- ---------- 10. Guards ----------
create or replace function public.science_guard_topic()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  changed boolean := false;
  fn boolean := coalesce(current_setting('qitl.science_integrity_fn', true), '') = '1';
  sys boolean := coalesce(current_setting('qitl.science_system', true), '') = '1' or coalesce(current_setting('qitl.import', true), '') = '1';
begin
  if tg_op = 'UPDATE' then
    changed := public.science_content(to_jsonb(new)) is distinct from public.science_content(to_jsonb(old));
    if changed and old.status = 'published' and new.status = 'published' then
      raise exception 'a published topic is fixed: move it to correction first' using errcode = 'P0001';
    end if;
    if changed then
      new.version := old.version + 1;
      if old.scholarly_status = 'approved' then new.scholarly_status := 'invalidated'; end if;
      if old.scientific_review = 'approved' then new.scientific_review := 'invalidated'; end if;
      if not fn and old.integrity_status = 'passed' and new.integrity_status = 'passed' then new.integrity_status := 'pending'; end if;
      if new.visibility in ('public_ai_draft', 'public_approved') and new.status <> 'published' then new.visibility := 'private_draft'; end if;
    end if;
    if old.status = 'published' and new.status <> 'published' and new.visibility = 'public_approved' then
      new.visibility := 'private_draft';
      if new.scholarly_status = 'approved' then new.scholarly_status := 'invalidated'; end if;
      if new.scientific_review = 'approved' then new.scientific_review := 'invalidated'; end if;
    end if;
  end if;
  new.updated_at := now();

  if new.integrity_status = 'passed' and (tg_op = 'INSERT' or old.integrity_status is distinct from 'passed') and not fn then
    raise exception 'integrity can only be marked passed by the automated check' using errcode = 'P0001';
  end if;
  if new.scholarly_status = 'approved' and (tg_op = 'INSERT' or old.scholarly_status is distinct from 'approved')
     and not (tg_op = 'UPDATE' and public.science_scholarly_ok(new.id)) then
    raise exception 'scholarly approval needs an approving scholarly review of this version' using errcode = 'P0001';
  end if;
  if new.scientific_review = 'approved' and (tg_op = 'INSERT' or old.scientific_review is distinct from 'approved')
     and not (tg_op = 'UPDATE' and public.science_scientific_ok(new.id)) then
    raise exception 'scientific approval needs an approving scientific review of this version' using errcode = 'P0001';
  end if;
  if new.visibility = 'public_approved' and new.status <> 'published' then
    raise exception 'public_approved is the published state: it needs both reviews' using errcode = 'P0001';
  end if;
  if new.visibility = 'public_ai_draft' then
    if not new.ai_generated then raise exception 'only AI-authored text uses the AI-draft pathway' using errcode = 'P0001'; end if;
    if new.integrity_status <> 'passed' then raise exception 'a public AI draft needs a passed integrity check' using errcode = 'P0001'; end if;
    if new.scholarly_status = 'rejected' or new.scientific_review = 'rejected' then raise exception 'a rejected draft is not public' using errcode = 'P0001'; end if;
  end if;

  -- Publishing = VERIFIED: both separate reviews of this version, by two different appointed people, plus the integrity check.
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if tg_op = 'INSERT' or not public.science_scientific_ok(new.id) then
      raise exception 'no scientific review, no publish: the topic needs an approving scientific review of this version' using errcode = 'P0001';
    end if;
    if not public.science_scholarly_ok(new.id) then
      raise exception 'no scholarly review, no publish: the Quran-and-science relationship needs an approving scholarly review of this version' using errcode = 'P0001';
    end if;
    if not public.science_approvers_distinct(new.id) then
      raise exception 'the scientific and the scholarly approval must come from two different people' using errcode = 'P0001';
    end if;
    if new.integrity_status <> 'passed' then
      raise exception 'no integrity, no publish: run the integrity check first' using errcode = 'P0001';
    end if;
    if new.needs_rereview then
      raise exception 'flagged for re-review: record new approving reviews first' using errcode = 'P0001';
    end if;
    new.visibility := 'public_approved';
    new.scholarly_status := 'approved';
    new.scientific_review := 'approved';
  end if;
  if tg_op = 'UPDATE' and new.needs_rereview = false and old.needs_rereview = true and not sys
     and not (public.science_scientific_ok(new.id) and public.science_scholarly_ok(new.id)) then
    raise exception 'the re-review flag clears only when both reviews approve the current version' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.science_topic_after()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    perform public.science_snapshot(new.id, 'created');
  elsif public.science_content(to_jsonb(new)) is distinct from public.science_content(to_jsonb(old)) then
    perform public.science_snapshot(new.id, 'content_changed');
  elsif (new.status, new.visibility) is distinct from (old.status, old.visibility) then
    perform public.science_snapshot(new.id, 'status:' || new.status || '/' || new.visibility);
  end if;
  return null;
end $$;

-- A topic's children: no edits while it is published; any edit bumps the topic version, withdraws its approvals and marks it
-- unchecked. A change of classification or rating also flags it for re-review.
create or replace function public.science_touch_topic(tid uuid, classification boolean, why text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform set_config('qitl.science_system', '1', true);
  update public.science_topics set
    version = version + 1,
    classification_version = classification_version + case when classification then 1 else 0 end,
    needs_rereview = needs_rereview or classification,
    rereview_reason = case when classification then why else rereview_reason end,
    scholarly_status = case when scholarly_status = 'approved' then 'invalidated' else scholarly_status end,
    scientific_review = case when scientific_review = 'approved' then 'invalidated' else scientific_review end,
    integrity_status = case when integrity_status = 'passed' then 'pending' else integrity_status end,
    visibility = case when visibility in ('public_ai_draft', 'public_approved') then 'private_draft' else visibility end,
    status = case when status = 'published' then 'correction'::public.publication_status else status end,
    updated_at = now()
  where id = tid;
  perform set_config('qitl.science_system', '0', true);
end $$;

create or replace function public.science_guard_child()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  tid uuid;
  sys boolean := coalesce(current_setting('qitl.science_system', true), '') = '1' or coalesce(current_setting('qitl.import', true), '') = '1';
  cls boolean := false;
  pub boolean;
  v text;
  term text;
begin
  tid := case tg_table_name
    when 'science_discovery_milestones' then (select d.topic_id from public.science_discoveries d where d.id = (r ->> 'discovery_id')::uuid)
    when 'quran_science_interpretations' then (select l.topic_id from public.quran_science_links l where l.id = (r ->> 'link_id')::uuid)
    else (r ->> 'topic_id')::uuid end;
  if tid is null then
    -- a parent that is being deleted by cascade
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select (t.status = 'published') into pub from public.science_topics t where t.id = tid;
  if pub and not sys then
    raise exception 'a published topic is fixed: move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op <> 'DELETE' then new.updated_at := now(); end if;

  if tg_table_name = 'science_claims' then
    cls := tg_op = 'INSERT' and (r ->> 'evidence_state') <> 'unassessed' or tg_op = 'UPDATE' and (r ->> 'evidence_state') is distinct from (o ->> 'evidence_state')
           or tg_op = 'DELETE';
    if tg_op <> 'DELETE' and exists (select 1 from public.science_topics t where t.id = tid and t.topic_kind = 'unseen')
       and new.evidence_state not in ('unassessed', 'outside_empirical_science') then
      raise exception 'metaphysical matters are classified outside empirical science' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'quran_science_links' then
    cls := tg_op = 'INSERT' and ((r ->> 'relationship') <> 'unassessed' or (r ->> 'interpretation_strength') <> 'unassessed' or (r ->> 'connection_strength') <> 'unassessed')
           or tg_op = 'UPDATE' and ((r ->> 'relationship'), (r ->> 'interpretation_strength'), (r ->> 'connection_strength'), (r ->> 'surah_id'), (r ->> 'ayah_no'))
                                    is distinct from ((o ->> 'relationship'), (o ->> 'interpretation_strength'), (o ->> 'connection_strength'), (o ->> 'surah_id'), (o ->> 'ayah_no'))
           or tg_op = 'DELETE';
    if tg_op <> 'DELETE' then
      -- Arabic terms only as they appear in the loaded corpus text of that verse
      select text_ar into v from public.quran_verses where surah_id = new.surah_id and ayah_no = new.ayah_no;
      foreach term in array new.arabic_terms loop
        if position(term in v) = 0 then
          raise exception 'Arabic term "%" does not appear in the corpus text of %:%', term, new.surah_id, new.ayah_no using errcode = 'P0001';
        end if;
      end loop;
      if exists (select 1 from public.science_topics t where t.id = tid and t.topic_kind = 'unseen')
         and new.relationship not in ('unassessed', 'not_scientifically_testable') then
        raise exception 'metaphysical matters are not scientifically testable: classify the relationship accordingly' using errcode = 'P0001';
      end if;
    end if;
  elsif tg_table_name = 'science_publications' and tg_op <> 'DELETE' then
    if new.verified and (tg_op = 'INSERT' or not old.verified) then
      if not (public.science_has_role('science_reviewer') or public.science_has_role('admin') or coalesce(auth.role(), '') = 'service_role' and sys) then
        raise exception 'only a science reviewer verifies a citation' using errcode = '42501';
      end if;
      new.verified_by := auth.uid();
      new.verified_at := now();
    end if;
    if tg_op = 'UPDATE' and old.verified and new.verified
       and (new.title, new.authors, new.doi, new.year, new.url, new.verified_source) is distinct from (old.title, old.authors, old.doi, old.year, old.url, old.verified_source) then
      new.verified := false; new.verified_by := null; new.verified_at := null;
    end if;
  end if;

  perform public.science_touch_topic(tid, cls, 'a rating or classification changed');
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Review insert: version captured by the database, appointed role checked, signed in as that reviewer, no self-review.
create or replace function public.check_science_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  want text := case tg_table_name when 'science_expert_reviews' then 'science_reviewer' else 'scholarly_reviewer' end;
  t public.science_topics;
begin
  select * into t from public.science_topics where id = new.topic_id;
  if not found then raise exception 'no such topic' using errcode = 'P0001'; end if;
  if auth.uid() is null or new.reviewer_id is distinct from auth.uid() then
    raise exception 'a review is recorded by the signed-in reviewer themself' using errcode = '42501';
  end if;
  if not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role::text = want) then
    raise exception 'only an appointed % may record this review', want using errcode = '42501';
  end if;
  if t.created_by is not null and t.created_by = new.reviewer_id then
    raise exception 'a reviewer cannot review their own topic' using errcode = '42501';
  end if;
  new.topic_version := t.version;
  return new;
end $$;

create or replace function public.apply_science_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare col text := case tg_table_name when 'science_expert_reviews' then 'scientific_review' else 'scholarly_status' end;
begin
  perform set_config('qitl.science_system', '1', true);
  if new.scope = 'overall' then
    -- a rejection also takes a public AI draft off the public pages
    execute format('update public.science_topics set %I = $2, visibility = case when $2 = ''rejected'' and visibility = ''public_ai_draft'' then ''private_draft'' else visibility end where id = $1', col)
      using new.topic_id, case new.decision when 'approved' then 'approved' when 'changes_requested' then 'changes_requested' else 'rejected' end;
  end if;
  -- the flag clears only when both approve the current version
  update public.science_topics set needs_rereview = false, rereview_reason = null
   where id = new.topic_id and needs_rereview and public.science_scientific_ok(id) and public.science_scholarly_ok(id);
  perform set_config('qitl.science_system', '0', true);
  perform public.science_snapshot(new.topic_id, 'review:' || tg_table_name || ':' || new.decision);
  return null;
end $$;

-- A reviewer's recorded evidence-state assessment sets the claim's state (and flags the topic through the child guard).
create or replace function public.check_science_assessment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; author uuid;
begin
  if auth.uid() is null or new.assessor_id is distinct from auth.uid() then
    raise exception 'an assessment is recorded by the signed-in reviewer themself' using errcode = '42501';
  end if;
  if not public.science_has_role('science_reviewer') then raise exception 'only a science reviewer assesses an evidence state' using errcode = '42501'; end if;
  select c.topic_id, t.created_by into tid, author from public.science_claims c join public.science_topics t on t.id = c.topic_id where c.id = new.claim_id;
  if author is not null and author = new.assessor_id then raise exception 'a reviewer cannot assess their own topic' using errcode = '42501'; end if;
  if exists (select 1 from public.science_topics t where t.id = tid and t.topic_kind = 'unseen') and new.evidence_state <> 'outside_empirical_science' then
    raise exception 'metaphysical matters are classified outside empirical science' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.science_topics t where t.id = tid and t.status = 'published') then
    raise exception 'a published topic is fixed: move it to correction first' using errcode = 'P0001';
  end if;
  return new;
end $$;
create or replace function public.apply_science_assessment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.science_claims set evidence_state = new.evidence_state where id = new.claim_id;
  return null;
end $$;

-- ---------- 11. Integrity check (deterministic; never judges the religious interpretation or the science) ----------
create or replace function public.compute_science_integrity(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare fails jsonb := '[]'::jsonb; t public.science_topics;
begin
  select * into t from public.science_topics where id = p_id;
  if not found then return jsonb_build_object('passed', false, 'failures', jsonb_build_array('record not found'), 'investigate', '[]'::jsonb); end if;
  if coalesce(t.does_not_establish_en, '') = '' or coalesce(t.does_not_establish_ar, '') = '' or coalesce(t.does_not_establish_ur, '') = '' then
    fails := fails || to_jsonb('the "What This Evidence Does Not Establish" section is missing in English, Arabic or Urdu'::text);
  end if;
  if not exists (select 1 from public.quran_science_links l where l.topic_id = p_id) then fails := fails || to_jsonb('no Quran passage is linked'::text); end if;
  if exists (select 1 from public.science_discovery_milestones m join public.science_discoveries d on d.id = m.discovery_id
             where d.topic_id = p_id and m.year is not null and (m.verified_source is null or m.verified_source !~ '^https?://')) then
    fails := fails || to_jsonb('a discovery year has no verified source'::text);
  end if;
  if exists (select 1 from public.science_publications p where p.topic_id = p_id and (p.doi is not null or p.year is not null) and p.verified_source is null) then
    fails := fails || to_jsonb('a publication shows a DOI or year without a verified source'::text);
  end if;
  if exists (select 1 from public.science_publications p where p.topic_id = p_id and p.doi is null and p.url is null) then
    fails := fails || to_jsonb('a citation has neither a DOI nor a URL'::text);
  end if;
  if exists (select 1 from public.science_evidence e left join public.science_publications p on p.id = e.publication_id
             where e.topic_id = p_id and e.evidence_status = 'sourced' and (p.id is null or not p.verified)) then
    fails := fails || to_jsonb('evidence marked sourced rests on a publication that is not verified'::text);
  end if;
  if exists (select 1 from public.quran_science_links l where l.topic_id = p_id and l.relationship = 'scientifically_established'
             and not exists (select 1 from public.science_claims c where c.topic_id = p_id and c.evidence_state in ('established', 'well_supported'))) then
    fails := fails || to_jsonb('a link is classified Scientifically Established but no claim of the topic has an Established or Well Supported evidence state'::text);
  end if;
  if exists (select 1 from public.quran_science_links l where l.topic_id = p_id and l.relationship = 'scientifically_established'
             and l.interpretation_strength in ('weak_or_strained', 'unsupported', 'disputed_interpretation')) then
    fails := fails || to_jsonb('a link is classified Scientifically Established although its interpretation is disputed, weak or unsupported'::text);
  end if;
  if t.topic_kind = 'unseen' and (exists (select 1 from public.science_claims c where c.topic_id = p_id and c.evidence_state not in ('unassessed', 'outside_empirical_science'))
      or exists (select 1 from public.quran_science_links l where l.topic_id = p_id and l.relationship not in ('unassessed', 'not_scientifically_testable'))) then
    fails := fails || to_jsonb('a metaphysical topic must be classified outside empirical science and not scientifically testable'::text);
  end if;
  if exists (select 1 from public.quran_science_interpretations i join public.quran_science_links l on l.id = i.link_id
             where l.topic_id = p_id and i.era = 'classical' and i.proposed_after_discovery is true) then
    fails := fails || to_jsonb('a classical scholar is credited with a reading proposed after a modern discovery'::text);
  end if;
  return jsonb_build_object('passed', jsonb_array_length(fails) = 0, 'failures', fails, 'investigate', '[]'::jsonb);
end $$;

create or replace function public.run_science_integrity(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; st text;
begin
  if not (public.has_role('editor') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator runs the integrity check' using errcode = '42501';
  end if;
  r := public.compute_science_integrity(p_id);
  st := case when (r ->> 'passed')::boolean then 'passed' else 'failed' end;
  perform set_config('qitl.science_integrity_fn', '1', true);
  update public.science_topics set integrity_status = st, integrity_report = r, integrity_checked_at = now(),
    visibility = case when st <> 'passed' and visibility = 'public_ai_draft' then 'private_draft' else visibility end where id = p_id;
  perform set_config('qitl.science_integrity_fn', '0', true);
  return r || jsonb_build_object('status', st);
end $$;

create or replace function public.publish_science_ai_draft(p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare rc integer;
begin
  if not (public.has_role('editor') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator publishes an AI draft' using errcode = '42501';
  end if;
  update public.science_topics set visibility = 'public_ai_draft', ai_published_at = coalesce(ai_published_at, now()) where id = p_id and status <> 'published';
  get diagnostics rc = row_count;
  if rc = 0 then raise exception 'record not found or already published through review' using errcode = 'P0001'; end if;
end $$;

-- Withdrawal: off the public pages; a published topic goes to correction. The reason is kept.
create or replace function public.withdraw_science_topic(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.has_role('editor') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator withdraws a topic' using errcode = '42501';
  end if;
  perform set_config('qitl.science_system', '1', true);
  update public.science_topics set visibility = 'private_draft', withdrawn_reason = left(p_reason, 500),
    scholarly_status = case when scholarly_status = 'approved' then 'invalidated' else scholarly_status end,
    scientific_review = case when scientific_review = 'approved' then 'invalidated' else scientific_review end,
    status = case when status = 'published' then 'correction'::public.publication_status else status end
  where id = p_id;
  perform set_config('qitl.science_system', '0', true);
end $$;

-- ---------- 12. Public read API (the only way anon reads a topic) ----------
create or replace function public.science_milestones_json(tid uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'discovery', d.title_en, 'kind', m.kind, 'label', m.label_en, 'year', m.year,
      'verified_source', case when m.year is not null then m.verified_source end, 'verified_note', case when m.year is not null then m.verified_note end)
    order by m.year nulls last, d.position, m.position, m.created_at), '[]'::jsonb)
  from public.science_discovery_milestones m join public.science_discoveries d on d.id = m.discovery_id where d.topic_id = tid;
$$;

create or replace function public.public_science_topics()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', n.slug, 'title', jsonb_build_object('en', n.title_en, 'ar', n.title_ar, 'ur', n.title_ur), 'discipline', n.discipline, 'topic_kind', n.topic_kind,
    'summary', n.summary_en, 'scholarly_status', n.scholarly_status, 'scientific_review', n.scientific_review, 'ai_generated', n.ai_generated,
    'published', n.status = 'published', 'needs_rereview', n.needs_rereview, 'updated_at', n.updated_at,
    'links', coalesce((select jsonb_agg(jsonb_build_object('surah', l.surah_id, 'ayah', l.ayah_no, 'relationship', l.relationship,
        'interpretation_strength', l.interpretation_strength, 'connection_strength', l.connection_strength) order by l.position, l.surah_id, l.ayah_no)
      from public.quran_science_links l where l.topic_id = n.id), '[]'::jsonb),
    'evidence_states', coalesce((select jsonb_agg(distinct c.evidence_state) from public.science_claims c where c.topic_id = n.id), '[]'::jsonb),
    'milestones', public.science_milestones_json(n.id)) order by n.created_at, n.slug), '[]'::jsonb)
  from public.science_topics n where public.science_topic_visible(n.id);
$$;

create or replace function public.public_science_topic(p_slug text)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'slug', n.slug, 'title', jsonb_build_object('en', n.title_en, 'ar', n.title_ar, 'ur', n.title_ur), 'discipline', n.discipline, 'topic_kind', n.topic_kind,
    'summary', n.summary_en, 'phenomenon', n.phenomenon_en, 'limitations', n.limitations_en, 'alternatives', n.alternatives_en, 'conclusion', n.conclusion_en,
    'does_not_establish', jsonb_build_object('en', n.does_not_establish_en, 'ar', n.does_not_establish_ar, 'ur', n.does_not_establish_ur),
    'scholarly_status', n.scholarly_status, 'scientific_review', n.scientific_review, 'ai_generated', n.ai_generated, 'ai_model', n.ai_model,
    'published', n.status = 'published', 'needs_rereview', n.needs_rereview, 'version', n.version, 'classification_version', n.classification_version, 'updated_at', n.updated_at,
    'claims', coalesce((select jsonb_agg(jsonb_build_object('claim', c.claim_en, 'kind', c.claim_kind, 'evidence_state', c.evidence_state) order by c.position, c.created_at)
      from public.science_claims c where c.topic_id = n.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('surah', l.surah_id, 'ayah', l.ayah_no, 'terms', to_jsonb(l.arabic_terms), 'relationship', l.relationship,
        'interpretation_strength', l.interpretation_strength, 'connection_strength', l.connection_strength, 'note', l.note_en,
        'interpretations', coalesce((select jsonb_agg(jsonb_build_object('era', i.era, 'evidence_status', i.evidence_status,
            'scholar', case when i.evidence_status = 'sourced' then i.scholar_name end, 'work', case when i.evidence_status = 'sourced' then i.work_title end,
            'locator', case when i.evidence_status = 'sourced' then i.locator end, 'summary', case when i.evidence_status = 'sourced' then i.summary_en end,
            'proposed_after_discovery', i.proposed_after_discovery) order by i.era, i.created_at)
          from public.quran_science_interpretations i where i.link_id = l.id), '[]'::jsonb)) order by l.position, l.surah_id, l.ayah_no)
      from public.quran_science_links l where l.topic_id = n.id), '[]'::jsonb),
    'milestones', public.science_milestones_json(n.id),
    -- a publication is shown only when a science reviewer verified it
    'publications', coalesce((select jsonb_agg(jsonb_build_object('title', p.title, 'authors', to_jsonb(p.authors), 'doi', p.doi, 'year', p.year, 'url', p.url,
        'verified_source', p.verified_source) order by p.year nulls last, p.title)
      from public.science_publications p where p.topic_id = n.id and p.verified), '[]'::jsonb),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('kind', e.evidence_kind, 'summary', e.summary_en, 'evidence_status', e.evidence_status,
        'cited', e.publication_id is not null and exists (select 1 from public.science_publications p where p.id = e.publication_id and p.verified)) order by e.created_at)
      from public.science_evidence e where e.topic_id = n.id), '[]'::jsonb),
    'open_questions', coalesce((select jsonb_agg(jsonb_build_object('question', q.question_en, 'known', q.known_en, 'uncertain', q.uncertain_en, 'competing', q.competing_en,
        'testability', q.testability, 'why_connection', q.why_connection_en) order by q.position, q.created_at)
      from public.science_open_questions q where q.topic_id = n.id), '[]'::jsonb),
    'visuals', coalesce((select jsonb_agg(jsonb_build_object('kind', v.kind, 'title', v.title_en, 'alt', v.alt_text_en, 'credit', v.credit,
        'asset_ref', case when v.licence_status = 'cleared' then v.asset_ref end, 'licence_status', v.licence_status) order by v.created_at)
      from public.science_visual_assets v where v.topic_id = n.id), '[]'::jsonb),
    'localizations', coalesce((select jsonb_agg(jsonb_build_object('language', x.language, 'field', x.field, 'body', x.body, 'origin', x.origin, 'translator_reviewed', x.translator_reviewed))
      from public.science_localizations x where x.topic_id = n.id), '[]'::jsonb),
    'reviews', jsonb_build_object(
      'scientific', (select jsonb_build_object('decision', r.decision, 'current_version', r.topic_version = n.version, 'on', r.created_at)
        from public.science_expert_reviews r where r.topic_id = n.id and r.scope = 'overall' order by r.created_at desc, r.id desc limit 1),
      'scholarly', (select jsonb_build_object('decision', r.decision, 'current_version', r.topic_version = n.version, 'on', r.created_at)
        from public.science_scholarly_reviews r where r.topic_id = n.id and r.scope = 'overall' order by r.created_at desc, r.id desc limit 1))
  )
  from public.science_topics n where n.slug = p_slug and public.science_topic_visible(n.id);
$$;

create or replace function public.public_science_questions()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'topic', n.slug, 'topic_title', jsonb_build_object('en', n.title_en, 'ar', n.title_ar, 'ur', n.title_ur), 'topic_kind', n.topic_kind,
    'question', q.question_en, 'known', q.known_en, 'uncertain', q.uncertain_en, 'competing', q.competing_en, 'testability', q.testability,
    'why_connection', q.why_connection_en, 'scholarly_status', n.scholarly_status, 'scientific_review', n.scientific_review, 'published', n.status = 'published')
    order by n.created_at, q.position, q.created_at), '[]'::jsonb)
  from public.science_open_questions q join public.science_topics n on n.id = q.topic_id where public.science_topic_visible(n.id);
$$;

-- The two-layer timeline. Layer A: the Quran passage and the recorded interpretation history. Layer B: scientific development.
create or replace function public.public_science_timeline()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', n.slug, 'title', jsonb_build_object('en', n.title_en, 'ar', n.title_ar, 'ur', n.title_ur), 'topic_kind', n.topic_kind,
    'scholarly_status', n.scholarly_status, 'scientific_review', n.scientific_review, 'published', n.status = 'published',
    'layer_a', coalesce((select jsonb_agg(jsonb_build_object('surah', l.surah_id, 'ayah', l.ayah_no, 'era', i.era, 'scholar', i.scholar_name, 'work', i.work_title,
        'proposed_after_discovery', i.proposed_after_discovery) order by l.position, l.surah_id, l.ayah_no, i.era)
      from public.quran_science_links l left join public.quran_science_interpretations i on i.link_id = l.id and i.evidence_status = 'sourced' where l.topic_id = n.id), '[]'::jsonb),
    'layer_b', public.science_milestones_json(n.id)) order by n.created_at, n.slug), '[]'::jsonb)
  from public.science_topics n where public.science_topic_visible(n.id);
$$;

-- ---------- 13. Row-level security and triggers ----------
do $$
declare t text;
begin
  foreach t in array array['science_topics', 'science_claims', 'science_claim_assessments', 'science_publications', 'science_discoveries', 'science_discovery_milestones',
      'science_evidence', 'science_open_questions', 'quran_science_links', 'quran_science_interpretations', 'science_visual_assets', 'science_localizations',
      'science_expert_reviews', 'science_scholarly_reviews'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
  end loop;
  foreach t in array array['science_topics', 'science_claims', 'science_publications', 'science_discoveries', 'science_discovery_milestones', 'science_evidence',
      'science_open_questions', 'quran_science_links', 'quran_science_interpretations', 'science_visual_assets', 'science_localizations'] loop
    execute format('create trigger a0_stamp_author before insert or update on public.%I for each row execute function public.stamp_author(%L)', t, 'created_by');
  end loop;
  foreach t in array array['science_claims', 'science_publications', 'science_discoveries', 'science_discovery_milestones', 'science_evidence',
      'science_open_questions', 'quran_science_links', 'quran_science_interpretations', 'science_visual_assets', 'science_localizations'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.science_guard_child()', t || '_guard', t);
  end loop;

  foreach t in array array['science_topics', 'science_claims', 'science_claim_assessments', 'science_publications', 'science_discoveries', 'science_discovery_milestones',
      'science_evidence', 'science_open_questions', 'quran_science_links', 'quran_science_interpretations', 'science_visual_assets', 'science_localizations',
      'science_revision_history', 'science_expert_reviews', 'science_scholarly_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.science_staff())', t);
  end loop;

  -- editors write the draft content; deletes are an administrator's, and never on a published topic
  foreach t in array array['science_topics', 'science_claims', 'science_publications', 'science_discoveries', 'science_discovery_milestones', 'science_evidence',
      'science_open_questions', 'quran_science_links', 'quran_science_interpretations', 'science_visual_assets', 'science_localizations'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor''))', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin''))', t);
  end loop;
end $$;

-- topic status: only an editor sets a draft / in-review / correction state; publishing is guarded by the trigger
create trigger science_topics_guard before insert or update on public.science_topics for each row execute function public.science_guard_topic();
create trigger science_topics_after after insert or update on public.science_topics for each row execute function public.science_topic_after();

-- a science reviewer verifies citations (the guard allows only the verified flag and a note to change without un-verifying)
create policy reviewer_verify on public.science_publications for update to authenticated using (public.science_has_role('science_reviewer')) with check (public.science_has_role('science_reviewer'));

grant insert on public.science_claim_assessments to authenticated;
create policy reviewer_insert on public.science_claim_assessments for insert to authenticated with check (assessor_id = auth.uid() and public.science_has_role('science_reviewer'));
create trigger science_claim_assessments_check before insert on public.science_claim_assessments for each row execute function public.check_science_assessment();
create trigger science_claim_assessments_apply after insert on public.science_claim_assessments for each row execute function public.apply_science_assessment();

grant insert on public.science_expert_reviews, public.science_scholarly_reviews to authenticated;
create policy reviewer_insert on public.science_expert_reviews for insert to authenticated with check (reviewer_id = auth.uid() and public.science_has_role('science_reviewer'));
create policy reviewer_insert on public.science_scholarly_reviews for insert to authenticated with check (reviewer_id = auth.uid() and public.science_has_role('scholarly_reviewer'));
create trigger science_expert_reviews_check before insert on public.science_expert_reviews for each row execute function public.check_science_review();
create trigger science_scholarly_reviews_check before insert on public.science_scholarly_reviews for each row execute function public.check_science_review();
create trigger science_expert_reviews_apply after insert on public.science_expert_reviews for each row execute function public.apply_science_review();
create trigger science_scholarly_reviews_apply after insert on public.science_scholarly_reviews for each row execute function public.apply_science_review();

-- ---------- 14. Function privileges ----------
revoke execute on function public.science_guard_topic(), public.science_topic_after(), public.science_guard_child(), public.check_science_review(), public.apply_science_review(),
  public.check_science_assessment(), public.apply_science_assessment(), public.science_touch_topic(uuid, boolean, text), public.science_snapshot(uuid, text),
  public.science_scientific_ok(uuid), public.science_scholarly_ok(uuid), public.science_approvers_distinct(uuid),
  public.compute_science_integrity(uuid), public.science_milestones_json(uuid) from public, anon, authenticated;
revoke execute on function public.run_science_integrity(uuid), public.publish_science_ai_draft(uuid), public.withdraw_science_topic(uuid, text) from public, anon;
grant execute on function public.run_science_integrity(uuid), public.publish_science_ai_draft(uuid), public.withdraw_science_topic(uuid, text) to authenticated;
grant execute on function public.public_science_topics(), public.public_science_topic(text), public.public_science_questions(), public.public_science_timeline() to anon, authenticated;
