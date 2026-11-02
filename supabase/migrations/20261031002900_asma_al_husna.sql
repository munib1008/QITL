set search_path = public, extensions;

-- Asma' al-Husna (the Names of Allah): research registry, computed Quran occurrences, evidence placeholders, duas, learning.
-- docs/ASMA_AL_HUSNA.md. STRUCTURE plus an AI-draft pathway. Nothing here is reviewed, and nothing says which transmitted
-- enumeration is authentic or that the Names are limited to a number.
--
--  * Counts are never typed: occurrences are written only by asma_replace_occurrences (admin or service role), and the
--    per-measure summaries are derived from the occurrence rows by the database. Measures A (exact surface form),
--    B (reviewed accepted variants) and C (related root) are separate, never merged, and C is never a Divine Name.
--  * Hadith and dua wording are never stored as text: evidence rows are references to existing hadith_entries +
--    hadith_gradings (Bukhari, Muslim, or a narration individually graded sahih in Tirmidhi / Ibn Majah) or a
--    'needs_source' placeholder that the pages show as unavailable. Category A duas carry a reference (a Quran verse that
--    exists in quran_verses, or a graded hadith record), never wording. Category B duas carry the personal-wording label.
--  * Publication: a version-bound approving scholarly review (no self-review), the passed integrity check and the
--    published-record freeze. A public AI draft is a separate, labelled pathway read only through security-definer
--    functions (no table policy is widened). Changing a Name's classification or the counting methodology sends the Name
--    and its dependent rows back for re-review.

-- ---------- Text guard (mirrors src/lib/asma/text-validator.ts; tests/db/asma.test.ts compares them on shared samples) ----------
create or replace function public.asma_text_ok(t text)
returns boolean language sql immutable as $$
  select t is null or not (
       t ~* '\mguarantee[sd]?\M'
    or t ~* '\m(will|shall)\s+(surely|certainly|definitely|always)\s+(be\s+)?(answer|accept|grant|fulfil|fulfill|respond)'
    or t ~* '\m(never|cannot)\s+(be\s+)?(rejected|refused)\M'
    or t ~* '\m(reward|rewards|hasanat|good deeds|blessings?)\s+(of|for)\s+(reciting|saying|repeating|memori[sz]ing)'
    or t ~* '\m(reciting|repeating|saying|memori[sz]ing)\M[^.]{0,60}\m(earns?|brings?|grants?|gives?|wins?|secures?)\M[^.]{0,40}\m(reward|rewards|hasanat|paradise|jannah|forgiveness|wealth|provision|healing|cure|protection|barakah|blessing)'
    or t ~* '\m(cures?|heals?|removes?|erases?)\s+(all|every|any)\M'
    or t ~* '\menters?\s+(paradise|jannah)\M'
    or t ~* '\m(\d+|one hundred|a hundred|a thousand|one thousand|seven|three|twenty-one|forty|ninety-nine)\s*(times|x)\M'
    or t ~* '\m\d+\s*(recitations|repetitions)\M'
    or t ~* '\m(best|special|blessed|ideal)\s+(time|times|hour|hours|moment|night|nights|day|days)\M'
    or t ~* '\m(recite|read|say|repeat|call upon)\M[^.]{0,40}\m(after|before|during|at)\s+(fajr|dhuhr|zuhr|asr|maghrib|isha|tahajjud|dawn|midnight|sunset)\M'
    or t ~* '\m(after|before|during|at)\s+(fajr|dhuhr|zuhr|asr|maghrib|isha|tahajjud|dawn|midnight|sunset)\M[^.]{0,50}\m(recite|read|say|repeat|call upon)'
    or t ~* '\m(only|exactly|just|limited to|no more than)\s+(99|ninety-nine)\M'
    or t ~ 'مضمون|يضمن|ضمان|حتما|حتماً'
    or t ~ '(\d+|[٠-٩]+)\s*(مرة|مرات|مره)|مائة\s+مرة|ألف\s+مرة'
    or t ~ '(أفضل|أحسن|أنسب)\s+(وقت|ساعة|ليلة|يوم)'
    or t ~ 'ضمانت|یقینی طور پر قبول|ضرور قبول|لازمی قبول|کبھی رد نہیں'
    or t ~ '(\d+|[٠-٩۰-۹]+)\s*(بار|مرتبہ|دفعہ)|سو\s+بار|ہزار\s+بار'
    or t ~ 'پڑھنے\s+(کا|سے)\s+(ثواب|اجر)|ثواب\s+ملتا'
    or t ~ 'صرف\s+(99|۹۹|ننانوے)\s+(نام|اسماء)'
  );
$$;

create or replace function public.asma_staff()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_staff();
$$;

-- ---------- 1. Counting methodology (policy + corpus edition + query version; one is current) ----------
create table public.divine_name_occurrence_methodologies (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (version ~ '^[a-z0-9._-]{3,60}$'),
  normalisation_policy text not null,
  tokenisation_policy text not null,
  query_version text not null,
  edition_source text not null,
  edition_version text not null,
  edition_sha256 text not null check (edition_sha256 ~ '^[0-9a-f]{64}$'),
  edition_content_sha256 text not null check (edition_content_sha256 ~ '^[0-9a-f]{64}$'),
  description text not null check (char_length(description) between 10 and 1500 and public.asma_text_ok(description)),
  is_current boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index divine_name_methodology_one_current on public.divine_name_occurrence_methodologies (is_current) where is_current;

-- ---------- 2. The Names ----------
create table public.divine_names (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,60}$'),
  name_ar text not null check (char_length(name_ar) between 2 and 60),
  name_ar_vowelled text not null check (char_length(name_ar_vowelled) between 2 and 90),
  transliteration text not null check (char_length(transliteration) between 2 and 60),
  rendering_en text check (rendering_en is null or (char_length(rendering_en) between 2 and 200 and public.asma_text_ok(rendering_en))),
  rendering_ar text check (rendering_ar is null or (char_length(rendering_ar) between 2 and 200 and public.asma_text_ok(rendering_ar))),
  rendering_ur text check (rendering_ur is null or (char_length(rendering_ur) between 2 and 200 and public.asma_text_ok(rendering_ur))),
  root text check (root is null or root ~ '^[ء-ي](-[ء-ي]){2,3}$'),
  -- the registered exact surface forms (measure A), normalised; a change is a classification change
  surface_forms text[] not null default '{}',
  recognition_status text not null default 'educational_list' check (recognition_status in ('educational_list', 'disputed_candidate', 'under_research')),
  recognition_basis text not null default 'Educational list - enumeration not established by this platform' check (char_length(recognition_basis) between 10 and 400 and public.asma_text_ok(recognition_basis)),
  last_research_review date,
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  classification_version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  visibility text not null default 'private_draft' check (visibility in ('private_draft', 'public_ai_draft', 'public_approved', 'archived')),
  integrity_status text not null default 'pending' check (integrity_status in ('pending', 'passed', 'failed', 'needs_investigation')),
  integrity_report jsonb,
  integrity_checked_at timestamptz,
  scholarly_status text not null default 'not_reviewed' check (scholarly_status in ('not_reviewed', 'under_review', 'changes_requested', 'approved', 'rejected', 'invalidated')),
  ai_generated boolean not null default false,
  ai_model text check (ai_model is null or char_length(ai_model) <= 80),
  prompt_version text check (prompt_version is null or char_length(prompt_version) <= 40),
  ai_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index divine_names_visibility on public.divine_names (visibility, status);

-- ---------- 3. Parts of a Name ----------
create table public.divine_name_aliases (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 80),
  language text not null check (language in ('ar', 'en', 'ur')),
  kind text not null check (kind in ('spelling', 'transliteration', 'alternate_form')),
  created_at timestamptz not null default now(),
  unique (name_id, alias, language)
);

create table public.divine_name_translations (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  language text not null check (language in ('en', 'ar', 'ur')),
  kind text not null check (kind in ('rendering', 'explanation')),
  body text not null check (char_length(body) between 2 and 1200 and public.asma_text_ok(body)),
  origin text not null default 'ai_draft' check (origin in ('ai_draft', 'human')),
  source_id uuid references public.sources (id),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_status = 'needs_source' or source_id is not null)
);

create table public.divine_name_linguistics (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  aspect text not null check (aspect in ('root', 'pattern', 'grammar', 'morphology', 'usage_note')),
  language text not null check (language in ('en', 'ar', 'ur')),
  body text not null check (char_length(body) between 2 and 1200 and public.asma_text_ok(body)),
  source_id uuid references public.sources (id),
  locator text check (locator is null or char_length(locator) <= 200),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_status = 'needs_source' or source_id is not null)
);

-- Computed lexical occurrences. Written only by asma_replace_occurrences. A match is lexical: referent_status records
-- whether a reviewer confirmed that the word refers to Allah in that verse.
create table public.divine_name_quran_occurrences (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  methodology_id uuid not null references public.divine_name_occurrence_methodologies (id) on delete restrict,
  surah_id smallint not null,
  ayah_no smallint not null,
  token_index integer not null check (token_index >= 1),
  measure text not null check (measure in ('A', 'B', 'C')),
  relation text not null check (relation in ('direct', 'related')),
  matched_form text not null,
  raw_word text not null,
  root text,
  referent_status text not null default 'unreviewed' check (referent_status in ('unreviewed', 'confirmed_allah', 'refers_to_other', 'disputed')),
  referent_note text check (referent_note is null or char_length(referent_note) <= 500),
  referent_reviewer uuid references auth.users (id) on delete set null,
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no),
  check ((measure = 'C') = (relation = 'related')),
  check ((measure = 'C') = (root is not null)),
  unique (name_id, methodology_id, surah_id, ayah_no, token_index)
);
create index divine_name_occurrences_verse on public.divine_name_quran_occurrences (surah_id, ayah_no);
create index divine_name_occurrences_name on public.divine_name_quran_occurrences (name_id, methodology_id, measure, surah_id, ayah_no);

-- Provenance and counts per name and measure, DERIVED from the occurrence rows by asma_replace_occurrences.
create table public.divine_name_count_summaries (
  name_id uuid not null references public.divine_names (id) on delete cascade,
  methodology_id uuid not null references public.divine_name_occurrence_methodologies (id) on delete restrict,
  measure text not null check (measure in ('A', 'B', 'C')),
  occurrence_count integer not null check (occurrence_count >= 0),
  verse_count integer not null check (verse_count >= 0),
  query_hash text not null check (query_hash ~ '^[0-9a-f]{64}$'),
  computed_at timestamptz not null default now(),
  stale boolean not null default false,
  primary key (name_id, methodology_id, measure)
);

create table public.divine_name_hadith_evidence (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  purpose text not null check (purpose in ('enumeration', 'attribute', 'dua', 'other')),
  hadith_id uuid references public.hadith_entries (id),
  hadith_grading_id uuid references public.hadith_gradings (id),
  -- A label only (for example the collection, to be completed by a reviewer). Never narration text.
  reference_label text check (reference_label is null or (char_length(reference_label) <= 160 and public.asma_text_ok(reference_label))),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((evidence_status = 'sourced') = (hadith_id is not null and hadith_grading_id is not null)),
  check (evidence_status = 'sourced' or (hadith_id is null and hadith_grading_id is null))
);

create table public.divine_name_tafsir_links (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  source_id uuid references public.sources (id),
  locator text check (locator is null or char_length(locator) <= 200),
  surah_id smallint,
  ayah_no smallint,
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no),
  check ((surah_id is null) = (ayah_no is null)),
  check (evidence_status = 'needs_source' or (source_id is not null and locator is not null))
);

-- Attributed positions. There is deliberately no numeric column: positions are never scored or ranked.
create table public.divine_name_scholarly_positions (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  topic text not null check (topic in ('enumeration', 'inclusion', 'meaning', 'usage')),
  scholar_name text check (scholar_name is null or char_length(scholar_name) between 2 and 120),
  work_title text check (work_title is null or char_length(work_title) between 2 and 200),
  locator text check (locator is null or char_length(locator) <= 200),
  position_summary text check (position_summary is null or (char_length(position_summary) between 10 and 1200 and public.asma_text_ok(position_summary)
    and position_summary !~* '(confidence|score|ranking|ranked|more likely|most likely|\d+\s*%)')),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_status = 'needs_source' or (scholar_name is not null and work_title is not null and locator is not null and position_summary is not null))
);

create table public.divine_name_relationships (
  id uuid primary key default gen_random_uuid(),
  name_id uuid not null references public.divine_names (id) on delete cascade,
  related_name_id uuid not null references public.divine_names (id) on delete cascade,
  kind text not null check (kind in ('frequently_paired', 'related_meaning', 'contrast_in_wording')),
  -- a Quran verse that contains both forms is the only evidence this module accepts for a pairing
  surah_id smallint,
  ayah_no smallint,
  note text check (note is null or (char_length(note) <= 500 and public.asma_text_ok(note))),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no),
  check (name_id <> related_name_id),
  check ((surah_id is null) = (ayah_no is null)),
  check (evidence_status = 'needs_source' or surah_id is not null),
  unique (name_id, related_name_id, kind)
);

create table public.divine_name_misconceptions (
  id uuid primary key default gen_random_uuid(),
  name_id uuid references public.divine_names (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,60}$'),
  -- The claim as people state it. Quoted ONLY here, in order to correct it; the content guard is lifted for this column alone.
  claim_text text not null check (char_length(claim_text) between 5 and 400),
  correction_text text check (correction_text is null or (char_length(correction_text) between 10 and 1200 and public.asma_text_ok(correction_text))),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_status = 'needs_source' or correction_text is not null)
);

-- ---------- 4. Duas ----------
-- Category A: the wording lives in an existing source record (a Quran verse in quran_verses, or a graded hadith record); this
-- row holds a REFERENCE, never wording. Category B: personal wording, labelled, never presented as a quoted dua.
create table public.authentic_duas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,60}$'),
  category text not null check (category in ('A', 'B')),
  title_en text check (title_en is null or (char_length(title_en) between 2 and 160 and public.asma_text_ok(title_en))),
  title_ar text check (title_ar is null or (char_length(title_ar) between 2 and 160 and public.asma_text_ok(title_ar))),
  title_ur text check (title_ur is null or (char_length(title_ur) between 2 and 160 and public.asma_text_ok(title_ur))),
  -- category A reference
  surah_id smallint,
  ayah_from smallint,
  ayah_to smallint,
  hadith_id uuid references public.hadith_entries (id),
  hadith_grading_id uuid references public.hadith_gradings (id),
  reference_label text check (reference_label is null or (char_length(reference_label) <= 160 and public.asma_text_ok(reference_label))),
  -- category B wording
  personal_wording text check (personal_wording is null or (char_length(personal_wording) between 5 and 600 and public.asma_text_ok(personal_wording))),
  wording_label text check (wording_label is null or wording_label = 'Suggested personal wording — not a quoted Quranic verse or Prophetic dua'),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  visibility text not null default 'private_draft' check (visibility in ('private_draft', 'public_ai_draft', 'public_approved', 'archived')),
  integrity_status text not null default 'pending' check (integrity_status in ('pending', 'passed', 'failed', 'needs_investigation')),
  integrity_report jsonb,
  integrity_checked_at timestamptz,
  scholarly_status text not null default 'not_reviewed' check (scholarly_status in ('not_reviewed', 'under_review', 'changes_requested', 'approved', 'rejected', 'invalidated')),
  ai_generated boolean not null default false,
  ai_model text check (ai_model is null or char_length(ai_model) <= 80),
  prompt_version text check (prompt_version is null or char_length(prompt_version) <= 40),
  ai_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (surah_id, ayah_from) references public.quran_verses (surah_id, ayah_no),
  foreign key (surah_id, ayah_to) references public.quran_verses (surah_id, ayah_no),
  check ((surah_id is null) = (ayah_from is null)),
  check (ayah_to is null or (ayah_from is not null and ayah_to >= ayah_from)),
  check (category = 'B' or (personal_wording is null and wording_label is null)),
  check (category = 'A' or (surah_id is null and hadith_id is null and hadith_grading_id is null and personal_wording is not null and wording_label is not null)),
  check ((hadith_id is null) = (hadith_grading_id is null)),
  check (not (surah_id is not null and hadith_id is not null)),
  check (category = 'B' or (evidence_status = 'sourced') = (surah_id is not null or hadith_id is not null))
);

create table public.dua_life_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,60}$'),
  title_en text check (title_en is null or (char_length(title_en) between 2 and 120 and public.asma_text_ok(title_en))),
  title_ar text check (title_ar is null or (char_length(title_ar) between 2 and 120 and public.asma_text_ok(title_ar))),
  title_ur text check (title_ur is null or (char_length(title_ur) between 2 and 120 and public.asma_text_ok(title_ur))),
  position integer not null default 0,
  status public.publication_status not null default 'draft',
  version integer not null default 1,
  needs_rereview boolean not null default false,
  rereview_reason text,
  visibility text not null default 'private_draft' check (visibility in ('private_draft', 'public_ai_draft', 'public_approved', 'archived')),
  integrity_status text not null default 'pending' check (integrity_status in ('pending', 'passed', 'failed', 'needs_investigation')),
  integrity_report jsonb,
  integrity_checked_at timestamptz,
  scholarly_status text not null default 'not_reviewed' check (scholarly_status in ('not_reviewed', 'under_review', 'changes_requested', 'approved', 'rejected', 'invalidated')),
  ai_generated boolean not null default false,
  ai_model text check (ai_model is null or char_length(ai_model) <= 80),
  prompt_version text check (prompt_version is null or char_length(prompt_version) <= 40),
  ai_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dua_divine_name_links (
  dua_id uuid not null references public.authentic_duas (id) on delete cascade,
  name_id uuid not null references public.divine_names (id) on delete cascade,
  note text check (note is null or (char_length(note) <= 300 and public.asma_text_ok(note))),
  primary key (dua_id, name_id)
);

create table public.dua_topic_links (
  dua_id uuid not null references public.authentic_duas (id) on delete cascade,
  topic_id uuid not null references public.dua_life_topics (id) on delete cascade,
  primary key (dua_id, topic_id)
);

-- A life-situation pathway to a Name. The evidence accepted here is a Quran verse that exists in quran_verses.
create table public.divine_name_topic_links (
  topic_id uuid not null references public.dua_life_topics (id) on delete cascade,
  name_id uuid not null references public.divine_names (id) on delete cascade,
  surah_id smallint,
  ayah_no smallint,
  basis text check (basis is null or (char_length(basis) <= 300 and public.asma_text_ok(basis))),
  evidence_status text not null default 'needs_source' check (evidence_status in ('sourced', 'needs_source')),
  primary key (topic_id, name_id),
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no),
  check ((surah_id is null) = (ayah_no is null)),
  check (evidence_status = 'needs_source' or surah_id is not null)
);

-- ---------- 5. Reviews: version-bound, scholarly, never by an author of the record ----------
create table public.divine_name_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('divine_name', 'divine_name_translation', 'divine_name_linguistic', 'divine_name_hadith_evidence',
    'divine_name_tafsir_link', 'divine_name_scholarly_position', 'divine_name_relationship', 'divine_name_misconception', 'authentic_dua', 'dua_life_topic')),
  entity_id uuid not null,
  entity_version integer not null default 1,
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index divine_name_reviews_entity on public.divine_name_reviews (entity_type, entity_id, created_at desc);

-- ---------- 6. Private learning ----------
create table public.user_divine_name_learning (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name_id uuid not null references public.divine_names (id) on delete cascade,
  saved boolean not null default false,
  note text check (note is null or char_length(note) <= 2000),
  box smallint not null default 0 check (box between 0 and 5),
  due_at timestamptz,
  last_reviewed_at timestamptz,
  times_seen integer not null default 0 check (times_seen >= 0),
  times_recalled integer not null default 0 check (times_recalled >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, name_id),
  check (times_recalled <= times_seen)
);

create table public.user_dua_bookmarks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dua_id uuid not null references public.authentic_duas (id) on delete cascade,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  primary key (user_id, dua_id)
);

-- ---------- 7. Helpers ----------
create or replace function public.asma_table(t text)
returns text language sql immutable as $$
  select case t when 'divine_name' then 'divine_names' when 'divine_name_translation' then 'divine_name_translations'
    when 'divine_name_linguistic' then 'divine_name_linguistics' when 'divine_name_hadith_evidence' then 'divine_name_hadith_evidence'
    when 'divine_name_tafsir_link' then 'divine_name_tafsir_links' when 'divine_name_scholarly_position' then 'divine_name_scholarly_positions'
    when 'divine_name_relationship' then 'divine_name_relationships' when 'divine_name_misconception' then 'divine_name_misconceptions'
    when 'authentic_dua' then 'authentic_duas' when 'dua_life_topic' then 'dua_life_topics' end;
$$;

create or replace function public.asma_record(t text, eid uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb; tbl text := public.asma_table(t);
begin
  if tbl is null then return null; end if;
  execute format('select to_jsonb(x) from public.%I x where x.id = $1', tbl) into r using eid;
  return r;
end $$;

-- The latest review for the CURRENT version must approve.
create or replace function public.asma_review_ok(t text, eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select r.decision = 'approved' from public.divine_name_reviews r
    where r.entity_type = t and r.entity_id = eid and r.entity_version = (public.asma_record(t, eid) ->> 'version')::int
    order by r.created_at desc, r.id desc limit 1), false);
$$;

create or replace function public.asma_name_public(nid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.divine_names n where n.id = nid and n.status = 'published' and n.visibility = 'public_approved');
$$;

-- Visible to any reader: published, or a labelled public AI draft that passed the integrity check.
create or replace function public.asma_name_visible(nid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.divine_names n where n.id = nid and (
    (n.status = 'published' and n.visibility = 'public_approved')
    or (n.visibility = 'public_ai_draft' and n.integrity_status = 'passed' and n.ai_generated and n.scholarly_status <> 'rejected')));
$$;

create or replace function public.asma_dua_visible(did uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.authentic_duas d where d.id = did and (
    (d.status = 'published' and d.visibility = 'public_approved')
    or (d.visibility = 'public_ai_draft' and d.integrity_status = 'passed' and d.ai_generated and d.scholarly_status <> 'rejected')));
$$;

-- Child tables that depend on a Name (re-review flags land on these).
create or replace function public.asma_flag_name_dependents(nid uuid, reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  perform set_config('qitl.asma_system', '1', true);
  foreach t in array array['divine_name_translations', 'divine_name_linguistics', 'divine_name_hadith_evidence', 'divine_name_tafsir_links',
      'divine_name_scholarly_positions', 'divine_name_relationships', 'divine_name_misconceptions'] loop
    execute format('update public.%I set needs_rereview = true, rereview_reason = $2, status = case when status = ''published'' then ''correction''::public.publication_status else status end where %s = $1',
      t, case when t = 'divine_name_relationships' then 'name_id = $1 or related_name_id' else 'name_id' end) using nid, reason;
  end loop;
  update public.divine_name_count_summaries set stale = true where name_id = nid;
  perform set_config('qitl.asma_system', '0', true);
end $$;

-- ---------- 8. Guards ----------
-- Columns that are workflow state, not content.
create or replace function public.asma_content(rec jsonb)
returns jsonb language sql immutable as $$
  select rec - 'status' - 'updated_at' - 'version' - 'visibility' - 'integrity_status' - 'integrity_report' - 'integrity_checked_at'
    - 'scholarly_status' - 'ai_published_at' - 'needs_rereview' - 'rereview_reason' - 'last_research_review' - 'classification_version';
$$;

-- Top-level records: divine_names, authentic_duas, dua_life_topics.
create or replace function public.asma_guard_top()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := case tg_table_name when 'divine_names' then 'divine_name' when 'authentic_duas' then 'authentic_dua' else 'dua_life_topic' end;
  changed boolean := false;
  fn boolean := coalesce(current_setting('qitl.asma_integrity_fn', true), '') = '1';
  sys boolean := coalesce(current_setting('qitl.asma_system', true), '') = '1' or coalesce(current_setting('qitl.import', true), '') = '1';
  cls boolean := false;
begin
  if tg_op = 'UPDATE' then
    changed := public.asma_content(to_jsonb(new)) is distinct from public.asma_content(to_jsonb(old));
    if changed and old.status = 'published' and new.status = 'published' then
      raise exception 'a published record is fixed: move it to correction first' using errcode = 'P0001';
    end if;
    if changed then
      new.version := old.version + 1;
      if old.scholarly_status = 'approved' then new.scholarly_status := 'invalidated'; end if;
      if not fn and old.integrity_status = 'passed' and new.integrity_status = 'passed' then new.integrity_status := 'pending'; end if;
      if new.visibility in ('public_ai_draft', 'public_approved') and new.status <> 'published' then new.visibility := 'private_draft'; end if;
    end if;
    if tg_table_name = 'divine_names' then
      cls := (new.recognition_status, new.surface_forms, new.root, new.name_ar) is distinct from (old.recognition_status, old.surface_forms, old.root, old.name_ar);
      if cls then
        new.classification_version := old.classification_version + 1;
        new.needs_rereview := true;
        new.rereview_reason := 'classification or counting query changed';
        if new.scholarly_status = 'approved' then new.scholarly_status := 'invalidated'; end if;
        if new.visibility in ('public_ai_draft', 'public_approved') then new.visibility := 'private_draft'; end if;
      end if;
    end if;
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status = 'published' and new.status <> 'published' and new.visibility = 'public_approved' then
    new.visibility := 'private_draft';
    if new.scholarly_status = 'approved' then new.scholarly_status := 'invalidated'; end if;
  end if;

  if new.integrity_status = 'passed' and (tg_op = 'INSERT' or old.integrity_status is distinct from 'passed') and not fn then
    raise exception 'integrity can only be marked passed by the automated check' using errcode = 'P0001';
  end if;
  if new.scholarly_status = 'approved' and (tg_op = 'INSERT' or old.scholarly_status is distinct from 'approved')
     and not (tg_op = 'UPDATE' and public.asma_review_ok(etype, new.id)) then
    raise exception 'scholarly approval needs an approving review of this version' using errcode = 'P0001';
  end if;
  if new.visibility = 'public_approved' and new.status <> 'published' then
    raise exception 'public_approved is the published, scholar-approved state' using errcode = 'P0001';
  end if;
  if new.visibility = 'public_ai_draft' then
    if not new.ai_generated then raise exception 'only AI-authored text uses the AI-draft pathway' using errcode = 'P0001'; end if;
    if new.integrity_status <> 'passed' then raise exception 'a public AI draft needs a passed integrity check' using errcode = 'P0001'; end if;
    if new.scholarly_status = 'rejected' then raise exception 'a rejected draft is not public' using errcode = 'P0001'; end if;
  end if;

  -- Publishing: a version-bound approving review AND the passed check; counts must be derived (names).
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if tg_op = 'INSERT' or not public.asma_review_ok(etype, new.id) then
      raise exception 'no review, no publish: % needs an approving scholarly review of this version', etype using errcode = 'P0001';
    end if;
    if new.integrity_status <> 'passed' then
      raise exception 'no integrity, no publish: run the integrity check first' using errcode = 'P0001';
    end if;
    if new.needs_rereview then
      raise exception 'flagged for re-review: record a new approving review, then clear the flag' using errcode = 'P0001';
    end if;
    if etype = 'divine_name' and not public.asma_counts_consistent(new.id) then
      raise exception 'counts must be computed: run the occurrence computation for the current methodology' using errcode = 'P0001';
    end if;
    new.visibility := 'public_approved';
    new.scholarly_status := 'approved';
  end if;
  if tg_op = 'UPDATE' and new.needs_rereview = false and old.needs_rereview = true and not sys
     and not public.asma_review_ok(etype, new.id) then
    raise exception 'the re-review flag clears only with an approving review of the current version' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Rows hanging off one Name or record and published with it.
create or replace function public.asma_guard_child()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := case tg_table_name
    when 'divine_name_translations' then 'divine_name_translation' when 'divine_name_linguistics' then 'divine_name_linguistic'
    when 'divine_name_hadith_evidence' then 'divine_name_hadith_evidence' when 'divine_name_tafsir_links' then 'divine_name_tafsir_link'
    when 'divine_name_scholarly_positions' then 'divine_name_scholarly_position' when 'divine_name_relationships' then 'divine_name_relationship'
    else 'divine_name_misconception' end;
  sys boolean := coalesce(current_setting('qitl.asma_system', true), '') = '1' or coalesce(current_setting('qitl.import', true), '') = '1';
  h record;
begin
  if tg_op = 'UPDATE' then
    if public.asma_content(to_jsonb(new)) is distinct from public.asma_content(to_jsonb(old)) then
      if old.status = 'published' and new.status = 'published' then
        raise exception 'a published record is fixed: move it to correction first' using errcode = 'P0001';
      end if;
      new.version := old.version + 1;
    end if;
  end if;
  new.updated_at := now();

  -- A grading must belong to the cited narration and be an authentic grade from an allowed collection.
  if tg_table_name = 'divine_name_hadith_evidence' then
   if new.hadith_id is not null and new.hadith_grading_id is not null then
    select e.collection_id, g.hadith_id as g_hadith, g.grade into h
    from public.hadith_entries e left join public.hadith_gradings g on g.id = new.hadith_grading_id where e.id = new.hadith_id;
    if h.g_hadith is distinct from new.hadith_id then
      raise exception 'hadith grading does not belong to the cited narration' using errcode = 'P0001';
    end if;
    if not (h.collection_id in ('bukhari', 'muslim') or (h.collection_id in ('tirmidhi', 'ibnmajah') and h.grade in ('sahih', 'sahih li-ghayrihi'))) then
      raise exception 'hadith evidence is accepted only from Bukhari, Muslim, or a narration individually graded sahih in Tirmidhi or Ibn Majah' using errcode = 'P0001';
    end if;
   end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if new.evidence_status <> 'sourced' then
      raise exception 'a "needs source" placeholder is never published as content' using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' or not public.asma_review_ok(etype, new.id) then
      raise exception 'no review, no publish: % needs an approving scholarly review of this version', etype using errcode = 'P0001';
    end if;
    if new.needs_rereview then
      raise exception 'flagged for re-review: record a new approving review first' using errcode = 'P0001';
    end if;
    if not public.asma_name_public(new.name_id) and etype <> 'divine_name_misconception' then
      raise exception 'publish the Name first' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.needs_rereview = false and old.needs_rereview = true and not sys
     and not public.asma_review_ok(etype, new.id) then
    raise exception 'the re-review flag clears only with an approving review of the current version' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Aliases and link tables follow their parent record (tg_argv[0] = the parent column, tg_argv[1] = the parent table): no edits while it is published.
create or replace function public.asma_guard_part()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  pub boolean;
begin
  execute format('select exists (select 1 from public.%I p where p.id = $1 and p.status = ''published'')', tg_argv[1]) into pub using (r ->> tg_argv[0])::uuid;
  if pub and coalesce(current_setting('qitl.asma_system', true), '') <> '1' then
    raise exception 'a published record is fixed: move it to correction first' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Review insert: version captured by the database, role checked, no self-review.
create or replace function public.check_asma_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  rec jsonb := public.asma_record(new.entity_type, new.entity_id);
  author uuid;
begin
  if rec is null then raise exception 'no % record %', new.entity_type, new.entity_id using errcode = 'P0001'; end if;
  new.entity_version := (rec ->> 'version')::int;
  if not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('scholarly_reviewer', 'admin')) then
    raise exception 'only a scholarly reviewer may record a review' using errcode = '42501';
  end if;
  author := nullif(rec ->> 'created_by', '')::uuid;
  if author is not null and author = new.reviewer_id then
    raise exception 'a reviewer cannot review their own record' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.apply_asma_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare tbl text := public.asma_table(new.entity_type);
begin
  if new.entity_type in ('divine_name', 'authentic_dua', 'dua_life_topic') then
    execute format('update public.%I set scholarly_status = $2 where id = $1', tbl)
      using new.entity_id, case new.decision when 'approved' then 'approved' when 'changes_requested' then 'changes_requested' else 'rejected' end;
  end if;
  return null;
end $$;

create trigger divine_name_reviews_check before insert on public.divine_name_reviews for each row execute function public.check_asma_reviewer();
create trigger divine_name_reviews_apply after insert on public.divine_name_reviews for each row execute function public.apply_asma_review();
create trigger divine_name_reviews_audit after insert on public.divine_name_reviews for each row execute function public.audit();

-- Counts are consistent when each measure of the current methodology has a summary equal to its rows.
create or replace function public.asma_counts_consistent(nid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select (select count(*) from public.divine_name_count_summaries s join public.divine_name_occurrence_methodologies m on m.id = s.methodology_id
            where s.name_id = nid and m.is_current and not s.stale) = 3
    and not exists (
      select 1 from public.divine_name_count_summaries s join public.divine_name_occurrence_methodologies m on m.id = s.methodology_id
      where s.name_id = nid and m.is_current and (
        s.occurrence_count <> (select count(*) from public.divine_name_quran_occurrences o where o.name_id = nid and o.methodology_id = s.methodology_id and o.measure = s.measure)
        or s.verse_count <> (select count(distinct (o.surah_id, o.ayah_no)) from public.divine_name_quran_occurrences o where o.name_id = nid and o.methodology_id = s.methodology_id and o.measure = s.measure)));
$$;

-- A change of Name classification re-flags everything that depends on it.
create or replace function public.asma_after_name_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.classification_version is distinct from old.classification_version then
    perform public.asma_flag_name_dependents(new.id, 'the Name''s classification or counting query changed');
  end if;
  return null;
end $$;
create trigger divine_names_after_change after update on public.divine_names for each row execute function public.asma_after_name_change();

-- A new current counting methodology sends every Name back for re-review.
create or replace function public.asma_methodology_changed()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare n record;
begin
  if new.is_current and (tg_op = 'INSERT' or not old.is_current) then
    perform set_config('qitl.asma_system', '1', true);
    for n in select id from public.divine_names loop
      update public.divine_names set needs_rereview = true, rereview_reason = 'counting methodology changed to ' || new.version,
        scholarly_status = case when scholarly_status = 'approved' then 'invalidated' else scholarly_status end,
        visibility = case when visibility in ('public_ai_draft', 'public_approved') then 'private_draft' else visibility end,
        status = case when status = 'published' then 'correction'::public.publication_status else status end
      where id = n.id;
      perform public.asma_flag_name_dependents(n.id, 'counting methodology changed to ' || new.version);
    end loop;
    perform set_config('qitl.asma_system', '0', true);
  end if;
  return null;
end $$;
create trigger divine_name_methodology_changed after insert or update of is_current on public.divine_name_occurrence_methodologies for each row execute function public.asma_methodology_changed();

-- ---------- 9. Computing counts: the only write path for occurrences ----------
-- Rows come from src/lib/asma (the engine); the database checks shape and derives the summaries from the rows it stored.
create or replace function public.asma_replace_occurrences(p_name uuid, p_methodology uuid, p_query_hash text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m text;
begin
  if not (public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an administrator or the import job computes occurrences' using errcode = '42501';
  end if;
  if not exists (select 1 from public.divine_names where id = p_name) then raise exception 'no such Name' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.divine_name_occurrence_methodologies where id = p_methodology) then raise exception 'no such methodology' using errcode = 'P0001'; end if;
  delete from public.divine_name_quran_occurrences where name_id = p_name and methodology_id = p_methodology;
  insert into public.divine_name_quran_occurrences (name_id, methodology_id, surah_id, ayah_no, token_index, measure, relation, matched_form, raw_word, root)
  select p_name, p_methodology, (r ->> 'surah')::smallint, (r ->> 'ayah')::smallint, (r ->> 'token')::int, r ->> 'measure', r ->> 'relation',
         r ->> 'form', r ->> 'raw', nullif(r ->> 'root', '')
  from jsonb_array_elements(p_rows) r;
  for m in select unnest(array['A', 'B', 'C']) loop
    insert into public.divine_name_count_summaries (name_id, methodology_id, measure, occurrence_count, verse_count, query_hash, computed_at, stale)
    select p_name, p_methodology, m, count(*), count(distinct (surah_id, ayah_no)), p_query_hash, now(), false
    from public.divine_name_quran_occurrences where name_id = p_name and methodology_id = p_methodology and measure = m
    on conflict (name_id, methodology_id, measure) do update set occurrence_count = excluded.occurrence_count, verse_count = excluded.verse_count,
      query_hash = excluded.query_hash, computed_at = now(), stale = false;
  end loop;
  return (select jsonb_object_agg(measure, occurrence_count) from public.divine_name_count_summaries where name_id = p_name and methodology_id = p_methodology);
end $$;

-- A reviewer's judgement of what a matching word refers to. Never automatic.
create or replace function public.asma_set_referent(p_occurrence uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.has_role('scholarly_reviewer') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only a scholarly reviewer records what a word refers to' using errcode = '42501';
  end if;
  if p_status not in ('unreviewed', 'confirmed_allah', 'refers_to_other', 'disputed') then raise exception 'bad referent status' using errcode = 'P0001'; end if;
  if p_status <> 'unreviewed' and not exists (select 1 from public.divine_name_quran_occurrences o where o.id = p_occurrence and o.measure in ('A', 'B')) then
    raise exception 'only A and B occurrences carry a referent judgement' using errcode = 'P0001';
  end if;
  update public.divine_name_quran_occurrences set referent_status = p_status, referent_note = p_note, referent_reviewer = auth.uid() where id = p_occurrence;
end $$;

-- ---------- 10. AI-draft integrity (deterministic) ----------
create or replace function public.compute_asma_integrity(p_type text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare fails jsonb := '[]'::jsonb; rec jsonb := public.asma_record(p_type, p_id);
begin
  if rec is null then return jsonb_build_object('passed', false, 'failures', jsonb_build_array('record not found'), 'investigate', '[]'::jsonb); end if;
  if p_type = 'divine_name' then
    if coalesce(rec ->> 'rendering_en', '') = '' or coalesce(rec ->> 'rendering_ar', '') = '' or coalesce(rec ->> 'rendering_ur', '') = '' then fails := fails || to_jsonb('a rendering is missing in English, Arabic or Urdu'::text); end if;
    if jsonb_array_length(rec -> 'surface_forms') = 0 then fails := fails || to_jsonb('no registered exact surface form'::text); end if;
    if not public.asma_counts_consistent(p_id) then fails := fails || to_jsonb('counts are not computed for the current methodology (or do not match their occurrence rows)'::text); end if;
    if rec ->> 'recognition_status' not in ('educational_list', 'disputed_candidate', 'under_research') then fails := fails || to_jsonb('recognition status missing'::text); end if;
    if exists (select 1 from public.divine_name_hadith_evidence e where e.name_id = p_id and e.evidence_status = 'sourced' and (e.hadith_id is null or e.hadith_grading_id is null)) then fails := fails || to_jsonb('a hadith reference lacks a record or grading'::text); end if;
  elsif p_type = 'authentic_dua' then
    if rec ->> 'category' = 'A' and rec ->> 'evidence_status' = 'sourced' and (rec ->> 'surah_id') is null and (rec ->> 'hadith_id') is null then fails := fails || to_jsonb('a sourced category A dua has no source record'::text); end if;
    if rec ->> 'category' = 'B' and (rec ->> 'wording_label') is distinct from 'Suggested personal wording — not a quoted Quranic verse or Prophetic dua' then fails := fails || to_jsonb('category B wording lacks its label'::text); end if;
    if coalesce(rec ->> 'title_en', '') = '' or coalesce(rec ->> 'title_ar', '') = '' or coalesce(rec ->> 'title_ur', '') = '' then fails := fails || to_jsonb('a title is missing in English, Arabic or Urdu'::text); end if;
  else
    if coalesce(rec ->> 'title_en', '') = '' or coalesce(rec ->> 'title_ar', '') = '' or coalesce(rec ->> 'title_ur', '') = '' then fails := fails || to_jsonb('a title is missing in English, Arabic or Urdu'::text); end if;
  end if;
  return jsonb_build_object('passed', jsonb_array_length(fails) = 0, 'failures', fails, 'investigate', '[]'::jsonb);
end $$;

create or replace function public.run_asma_integrity(p_type text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; st text; tbl text := public.asma_table(p_type);
begin
  if p_type not in ('divine_name', 'authentic_dua', 'dua_life_topic') then raise exception 'not an AI-draft record type' using errcode = 'P0001'; end if;
  if not (public.has_role('editor') or public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator runs the integrity check' using errcode = '42501';
  end if;
  r := public.compute_asma_integrity(p_type, p_id);
  st := case when (r ->> 'passed')::boolean then 'passed' else 'failed' end;
  perform set_config('qitl.asma_integrity_fn', '1', true);
  execute format('update public.%I set integrity_status = $2, integrity_report = $3, integrity_checked_at = now(), visibility = case when $2 <> ''passed'' and visibility = ''public_ai_draft'' then ''private_draft'' else visibility end where id = $1', tbl)
    using p_id, st, r;
  perform set_config('qitl.asma_integrity_fn', '0', true);
  return r || jsonb_build_object('status', st);
end $$;

create or replace function public.publish_asma_ai_draft(p_type text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tbl text := public.asma_table(p_type); rc integer;
begin
  if p_type not in ('divine_name', 'authentic_dua', 'dua_life_topic') then raise exception 'not an AI-draft record type' using errcode = 'P0001'; end if;
  if not (public.has_role('editor') or public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator publishes an AI draft' using errcode = '42501';
  end if;
  execute format('update public.%I set visibility = ''public_ai_draft'', ai_published_at = coalesce(ai_published_at, now()) where id = $1 and status <> ''published''', tbl) using p_id;
  get diagnostics rc = row_count;
  if rc = 0 then raise exception 'record not found or already published through review' using errcode = 'P0001'; end if;
end $$;

create or replace function public.withdraw_asma_ai_draft(p_type text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tbl text := public.asma_table(p_type);
begin
  if not (public.has_role('editor') or public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator withdraws an AI draft' using errcode = '42501';
  end if;
  execute format('update public.%I set visibility = ''private_draft'' where id = $1 and visibility = ''public_ai_draft''', tbl) using p_id;
end $$;

-- ---------- 11. Public read API (the only way anon reads a Name or a dua that is not published through review) ----------
create or replace function public.asma_summary_json(nid uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_build_object(
    'methodology', m.version, 'normalisation', m.normalisation_policy, 'tokenisation', m.tokenisation_policy, 'queryVersion', m.query_version,
    'edition', jsonb_build_object('source', m.edition_source, 'version', m.edition_version, 'sha256', m.edition_sha256, 'contentSha256', m.edition_content_sha256),
    'measures', (select jsonb_object_agg(s.measure, jsonb_build_object('count', s.occurrence_count, 'verses', s.verse_count, 'queryHash', s.query_hash, 'stale', s.stale))
                 from public.divine_name_count_summaries s where s.name_id = nid and s.methodology_id = m.id)), 'null'::jsonb)
  from public.divine_name_occurrence_methodologies m where m.is_current;
$$;

create or replace function public.public_asma_names()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', n.slug, 'ar', n.name_ar, 'vowelled', n.name_ar_vowelled, 'transliteration', n.transliteration,
    'rendering', jsonb_build_object('en', n.rendering_en, 'ar', n.rendering_ar, 'ur', n.rendering_ur), 'root', n.root,
    'recognition_status', n.recognition_status, 'recognition_basis', n.recognition_basis,
    'scholarly_status', n.scholarly_status, 'ai_generated', n.ai_generated, 'published', n.status = 'published',
    'needs_rereview', n.needs_rereview, 'updated_at', n.updated_at, 'summary', public.asma_summary_json(n.id)) order by n.created_at, n.slug), '[]'::jsonb)
  from public.divine_names n where public.asma_name_visible(n.id);
$$;

create or replace function public.public_asma_name(p_slug text)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'slug', n.slug, 'ar', n.name_ar, 'vowelled', n.name_ar_vowelled, 'transliteration', n.transliteration,
    'rendering', jsonb_build_object('en', n.rendering_en, 'ar', n.rendering_ar, 'ur', n.rendering_ur), 'root', n.root,
    'recognition_status', n.recognition_status, 'recognition_basis', n.recognition_basis, 'scholarly_status', n.scholarly_status,
    'ai_generated', n.ai_generated, 'ai_model', n.ai_model, 'published', n.status = 'published', 'needs_rereview', n.needs_rereview,
    'version', n.version, 'classification_version', n.classification_version, 'last_research_review', n.last_research_review, 'updated_at', n.updated_at,
    'surface_forms', to_jsonb(n.surface_forms), 'summary', public.asma_summary_json(n.id),
    'aliases', coalesce((select jsonb_agg(jsonb_build_object('alias', a.alias, 'language', a.language, 'kind', a.kind) order by a.alias) from public.divine_name_aliases a where a.name_id = n.id), '[]'::jsonb),
    'translations', coalesce((select jsonb_agg(jsonb_build_object('language', t.language, 'kind', t.kind, 'body', t.body, 'origin', t.origin, 'evidence_status', t.evidence_status, 'reviewed', public.asma_review_ok('divine_name_translation', t.id)) order by t.language, t.kind)
      from public.divine_name_translations t where t.name_id = n.id and t.status not in ('rejected', 'archived') and t.evidence_status = 'sourced'), '[]'::jsonb),
    'linguistics', coalesce((select jsonb_agg(jsonb_build_object('aspect', l.aspect, 'language', l.language, 'body', l.body, 'evidence_status', l.evidence_status, 'reviewed', public.asma_review_ok('divine_name_linguistic', l.id)) order by l.aspect)
      from public.divine_name_linguistics l where l.name_id = n.id and l.status not in ('rejected', 'archived') and l.evidence_status = 'sourced'), '[]'::jsonb),
    -- Placeholders and sourced references are reported as STATUS only; no wording of any hadith leaves this function.
    'hadith_evidence', coalesce((select jsonb_agg(jsonb_build_object('purpose', e.purpose, 'evidence_status', e.evidence_status, 'reference_label', e.reference_label,
        'collection', (select h.collection_id from public.hadith_entries h where h.id = e.hadith_id), 'number', (select h.canonical_number from public.hadith_entries h where h.id = e.hadith_id),
        'grading', (select jsonb_build_object('grader', g.grader, 'grade', g.grade_label) from public.hadith_gradings g where g.id = e.hadith_grading_id),
        'reviewed', public.asma_review_ok('divine_name_hadith_evidence', e.id)) order by e.purpose, e.created_at)
      from public.divine_name_hadith_evidence e where e.name_id = n.id and e.status not in ('rejected', 'archived')), '[]'::jsonb),
    'tafsir_links', coalesce((select jsonb_agg(jsonb_build_object('evidence_status', f.evidence_status, 'locator', f.locator, 'surah', f.surah_id, 'ayah', f.ayah_no,
        'work', (select s.work from public.sources s where s.id = f.source_id)) order by f.created_at)
      from public.divine_name_tafsir_links f where f.name_id = n.id and f.status not in ('rejected', 'archived')), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(jsonb_build_object('topic', p.topic, 'evidence_status', p.evidence_status,
        'scholar', case when p.evidence_status = 'sourced' then p.scholar_name end, 'work', case when p.evidence_status = 'sourced' then p.work_title end,
        'locator', case when p.evidence_status = 'sourced' then p.locator end, 'summary', case when p.evidence_status = 'sourced' then p.position_summary end,
        'reviewed', public.asma_review_ok('divine_name_scholarly_position', p.id)) order by p.topic, p.created_at)
      from public.divine_name_scholarly_positions p where p.name_id = n.id and p.status not in ('rejected', 'archived')), '[]'::jsonb),
    'relationships', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'other', o.slug, 'other_ar', o.name_ar, 'other_transliteration', o.transliteration, 'surah', r.surah_id, 'ayah', r.ayah_no,
        'evidence_status', r.evidence_status, 'note', case when r.evidence_status = 'sourced' then r.note end) order by o.slug)
      from public.divine_name_relationships r join public.divine_names o on o.id = r.related_name_id
      where r.name_id = n.id and r.status not in ('rejected', 'archived') and public.asma_name_visible(o.id)), '[]'::jsonb),
    'misconceptions', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'claim', c.claim_text, 'correction', case when c.evidence_status = 'sourced' then c.correction_text end,
        'evidence_status', c.evidence_status, 'reviewed', public.asma_review_ok('divine_name_misconception', c.id)) order by c.slug)
      from public.divine_name_misconceptions c where c.name_id = n.id and c.status not in ('rejected', 'archived')), '[]'::jsonb),
    'duas', coalesce((select jsonb_agg(jsonb_build_object('slug', d.slug, 'category', d.category, 'title_en', d.title_en, 'title_ar', d.title_ar, 'title_ur', d.title_ur) order by d.slug)
      from public.dua_divine_name_links l join public.authentic_duas d on d.id = l.dua_id where l.name_id = n.id and public.asma_dua_visible(d.id)), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('slug', t.slug, 'title_en', t.title_en, 'title_ar', t.title_ar, 'title_ur', t.title_ur, 'surah', k.surah_id, 'ayah', k.ayah_no,
        'basis', k.basis, 'evidence_status', k.evidence_status) order by t.position, t.slug)
      from public.divine_name_topic_links k join public.dua_life_topics t on t.id = k.topic_id
      where k.name_id = n.id and t.visibility in ('public_ai_draft', 'public_approved') and t.integrity_status = 'passed' and t.scholarly_status <> 'rejected'), '[]'::jsonb)
  )
  from public.divine_names n where n.slug = p_slug and public.asma_name_visible(n.id);
$$;

-- Occurrences of one Name, one measure at a time, with the verse text (public Quran corpus). Paged.
create or replace function public.public_asma_occurrences(p_slug text, p_measure text, p_limit integer default 100, p_offset integer default 0, p_surah smallint default null)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'measure', p_measure,
    'total', (select count(*) from public.divine_name_quran_occurrences o join public.divine_name_occurrence_methodologies m on m.id = o.methodology_id
              where o.name_id = n.id and m.is_current and o.measure = p_measure and (p_surah is null or o.surah_id = p_surah)),
    'rows', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('surah', o.surah_id, 'ayah', o.ayah_no, 'token', o.token_index, 'form', o.matched_form, 'raw', o.raw_word, 'root', o.root,
             'relation', o.relation, 'referent_status', o.referent_status, 'text', v.text_ar) as x
      from public.divine_name_quran_occurrences o join public.divine_name_occurrence_methodologies m on m.id = o.methodology_id
      join public.quran_verses v on v.surah_id = o.surah_id and v.ayah_no = o.ayah_no
      where o.name_id = n.id and m.is_current and o.measure = p_measure and (p_surah is null or o.surah_id = p_surah)
      order by o.surah_id, o.ayah_no, o.token_index limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) q), '[]'::jsonb))
  from public.divine_names n where n.slug = p_slug and p_measure in ('A', 'B', 'C') and public.asma_name_visible(n.id);
$$;

-- Names with a REVIEWER-CONFIRMED occurrence in a verse (the Quran reader's "Explore this Name" hook). Lexical matches alone never qualify.
create or replace function public.public_asma_names_in_verse(p_surah smallint, p_ayah smallint)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object('slug', n.slug, 'ar', n.name_ar, 'transliteration', n.transliteration)), '[]'::jsonb)
  from public.divine_name_quran_occurrences o join public.divine_names n on n.id = o.name_id
  join public.divine_name_occurrence_methodologies m on m.id = o.methodology_id
  where o.surah_id = p_surah and o.ayah_no = p_ayah and m.is_current and o.measure in ('A', 'B') and o.referent_status = 'confirmed_allah' and public.asma_name_visible(n.id);
$$;

-- Names whose lexical occurrences include a verse (search by verse in the gallery). Lexical only, labelled as such by the page.
create or replace function public.public_asma_lexical_in_verse(p_surah smallint, p_ayah smallint)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', q.slug, 'measure', q.measure) order by q.slug), '[]'::jsonb)
  from (select distinct n.slug, o.measure from public.divine_name_quran_occurrences o join public.divine_names n on n.id = o.name_id
        join public.divine_name_occurrence_methodologies m on m.id = o.methodology_id
        where o.surah_id = p_surah and o.ayah_no = p_ayah and m.is_current and public.asma_name_visible(n.id)) q;
$$;

create or replace function public.public_asma_duas()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', d.slug, 'category', d.category, 'title_en', d.title_en, 'title_ar', d.title_ar, 'title_ur', d.title_ur,
    'evidence_status', d.evidence_status, 'scholarly_status', d.scholarly_status, 'published', d.status = 'published') order by d.slug), '[]'::jsonb)
  from public.authentic_duas d where public.asma_dua_visible(d.id);
$$;

create or replace function public.public_asma_dua(p_slug text)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'slug', d.slug, 'category', d.category, 'title_en', d.title_en, 'title_ar', d.title_ar, 'title_ur', d.title_ur,
    'evidence_status', d.evidence_status, 'scholarly_status', d.scholarly_status, 'published', d.status = 'published', 'updated_at', d.updated_at,
    'source', case when d.surah_id is not null then jsonb_build_object('kind', 'quran', 'surah', d.surah_id, 'from', d.ayah_from, 'to', coalesce(d.ayah_to, d.ayah_from))
                   when d.hadith_id is not null then jsonb_build_object('kind', 'hadith', 'collection', (select h.collection_id from public.hadith_entries h where h.id = d.hadith_id),
                     'number', (select h.canonical_number from public.hadith_entries h where h.id = d.hadith_id),
                     'grading', (select jsonb_build_object('grader', g.grader, 'grade', g.grade_label) from public.hadith_gradings g where g.id = d.hadith_grading_id))
                   else jsonb_build_object('kind', 'none', 'reference_label', d.reference_label) end,
    'personal_wording', d.personal_wording, 'wording_label', d.wording_label,
    'names', coalesce((select jsonb_agg(jsonb_build_object('slug', n.slug, 'ar', n.name_ar, 'transliteration', n.transliteration, 'note', l.note) order by n.slug)
      from public.dua_divine_name_links l join public.divine_names n on n.id = l.name_id where l.dua_id = d.id and public.asma_name_visible(n.id)), '[]'::jsonb))
  from public.authentic_duas d where d.slug = p_slug and public.asma_dua_visible(d.id);
$$;

create or replace function public.public_asma_topics()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', t.slug, 'title_en', t.title_en, 'title_ar', t.title_ar, 'title_ur', t.title_ur,
    'scholarly_status', t.scholarly_status,
    'names', coalesce((select jsonb_agg(jsonb_build_object('slug', n.slug, 'ar', n.name_ar, 'transliteration', n.transliteration, 'surah', k.surah_id, 'ayah', k.ayah_no, 'basis', k.basis, 'evidence_status', k.evidence_status) order by n.slug)
      from public.divine_name_topic_links k join public.divine_names n on n.id = k.name_id where k.topic_id = t.id and public.asma_name_visible(n.id)), '[]'::jsonb)) order by t.position, t.slug), '[]'::jsonb)
  from public.dua_life_topics t where t.visibility in ('public_ai_draft', 'public_approved') and t.integrity_status = 'passed' and t.scholarly_status <> 'rejected';
$$;

-- ---------- 12. Row-level security and triggers ----------
do $$
declare t text;
begin
  -- audit on every table that carries content
  foreach t in array array['divine_names', 'divine_name_aliases', 'divine_name_translations', 'divine_name_linguistics', 'divine_name_hadith_evidence', 'divine_name_tafsir_links',
      'divine_name_scholarly_positions', 'divine_name_relationships', 'divine_name_misconceptions', 'authentic_duas', 'dua_life_topics', 'dua_divine_name_links', 'dua_topic_links',
      'divine_name_topic_links', 'divine_name_occurrence_methodologies'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
  end loop;
  foreach t in array array['divine_names', 'authentic_duas', 'dua_life_topics'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.asma_guard_top()', t || '_guard', t);
  end loop;
  foreach t in array array['divine_name_translations', 'divine_name_linguistics', 'divine_name_hadith_evidence', 'divine_name_tafsir_links', 'divine_name_scholarly_positions', 'divine_name_relationships', 'divine_name_misconceptions'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.asma_guard_child()', t || '_guard', t);
  end loop;
  execute 'create trigger divine_name_aliases_guard before insert or update or delete on public.divine_name_aliases for each row execute function public.asma_guard_part(''name_id'', ''divine_names'')';
  execute 'create trigger dua_divine_name_links_guard before insert or update or delete on public.dua_divine_name_links for each row execute function public.asma_guard_part(''dua_id'', ''authentic_duas'')';
  execute 'create trigger dua_topic_links_guard before insert or update or delete on public.dua_topic_links for each row execute function public.asma_guard_part(''dua_id'', ''authentic_duas'')';
  execute 'create trigger divine_name_topic_links_guard before insert or update or delete on public.divine_name_topic_links for each row execute function public.asma_guard_part(''topic_id'', ''dua_life_topics'')';
  -- the author column is the database's record
  foreach t in array array['divine_names', 'divine_name_translations', 'divine_name_linguistics', 'divine_name_hadith_evidence', 'divine_name_tafsir_links',
      'divine_name_scholarly_positions', 'divine_name_relationships', 'divine_name_misconceptions', 'authentic_duas', 'dua_life_topics'] loop
    execute format('create trigger a0_stamp_author before insert or update on public.%I for each row execute function public.stamp_author(%L)', t, 'created_by');
  end loop;

  foreach t in array array['divine_names', 'divine_name_aliases', 'divine_name_translations', 'divine_name_linguistics', 'divine_name_occurrence_methodologies',
      'divine_name_quran_occurrences', 'divine_name_count_summaries', 'divine_name_hadith_evidence', 'divine_name_tafsir_links', 'divine_name_scholarly_positions',
      'divine_name_relationships', 'divine_name_misconceptions', 'authentic_duas', 'dua_life_topics', 'dua_divine_name_links', 'dua_topic_links', 'divine_name_topic_links',
      'divine_name_reviews', 'user_divine_name_learning', 'user_dua_bookmarks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;

  -- records with a status: staff read everything; anyone reads PUBLISHED records of a published Name (AI drafts: functions only)
  foreach t in array array['divine_names', 'authentic_duas', 'dua_life_topics'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy read_published on public.%I for select using (public.asma_staff() or (status = ''published'' and visibility = ''public_approved''))', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review'') and visibility = ''private_draft'')', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
  foreach t in array array['divine_name_translations', 'divine_name_linguistics', 'divine_name_hadith_evidence', 'divine_name_tafsir_links', 'divine_name_scholarly_positions', 'divine_name_misconceptions'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy read_published on public.%I for select using (public.asma_staff() or (status = ''published'' and public.asma_name_public(name_id)))', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
end $$;

-- relationships (two Names)
grant select on public.divine_name_relationships to anon, authenticated;
grant insert, update, delete on public.divine_name_relationships to authenticated;
create policy read_published on public.divine_name_relationships for select using (public.asma_staff() or (status = 'published' and public.asma_name_public(name_id) and public.asma_name_public(related_name_id)));
create policy editor_insert on public.divine_name_relationships for insert to authenticated with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.divine_name_relationships for update to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy admin_delete on public.divine_name_relationships for delete to authenticated using (public.has_role('admin') and status <> 'published');
-- misconceptions may be general (no Name)
drop policy read_published on public.divine_name_misconceptions;
create policy read_published on public.divine_name_misconceptions for select using (public.asma_staff() or (status = 'published' and (name_id is null or public.asma_name_public(name_id))));

-- parts: follow their parent
grant select on public.divine_name_aliases, public.dua_divine_name_links, public.dua_topic_links, public.divine_name_topic_links to anon, authenticated;
grant insert, update, delete on public.divine_name_aliases, public.dua_divine_name_links, public.dua_topic_links, public.divine_name_topic_links to authenticated;
create policy read_part on public.divine_name_aliases for select using (public.asma_staff() or public.asma_name_public(name_id));
create policy editor_write on public.divine_name_aliases for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy read_part on public.dua_divine_name_links for select using (public.asma_staff() or (public.asma_dua_visible(dua_id) and public.asma_name_public(name_id) and exists (select 1 from public.authentic_duas d where d.id = dua_id and d.status = 'published')));
create policy editor_write on public.dua_divine_name_links for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy read_part on public.dua_topic_links for select using (public.asma_staff());
create policy editor_write on public.dua_topic_links for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy read_part on public.divine_name_topic_links for select using (public.asma_staff() or (public.asma_name_public(name_id) and exists (select 1 from public.dua_life_topics t where t.id = topic_id and t.status = 'published' and t.visibility = 'public_approved')));
create policy editor_write on public.divine_name_topic_links for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));

-- occurrences and summaries: read-only for everyone; the only writer is asma_replace_occurrences
grant select on public.divine_name_quran_occurrences, public.divine_name_count_summaries to anon, authenticated;
create policy read_computed on public.divine_name_quran_occurrences for select using (public.asma_staff() or public.asma_name_public(name_id));
create policy read_computed on public.divine_name_count_summaries for select using (public.asma_staff() or public.asma_name_public(name_id));

-- methodologies: readable by anyone (metadata of the counting policy, no content); admins add one
grant select on public.divine_name_occurrence_methodologies to anon, authenticated;
grant insert, update on public.divine_name_occurrence_methodologies to authenticated;
create policy read_all on public.divine_name_occurrence_methodologies for select using (true);
create policy admin_insert on public.divine_name_occurrence_methodologies for insert to authenticated with check (public.has_role('admin'));
create policy admin_update on public.divine_name_occurrence_methodologies for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- reviews
grant select, insert on public.divine_name_reviews to authenticated;
create policy staff_read on public.divine_name_reviews for select to authenticated using (public.asma_staff());
create policy reviewer_insert on public.divine_name_reviews for insert to authenticated with check (reviewer_id = auth.uid() and public.has_role('scholarly_reviewer'));

-- private learning: the owner only; a Name or dua must be visible to be saved
grant select, insert, update, delete on public.user_divine_name_learning, public.user_dua_bookmarks to authenticated;
create policy own_select on public.user_divine_name_learning for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.user_divine_name_learning for insert to authenticated with check (user_id = auth.uid() and public.asma_name_visible(name_id));
create policy own_update on public.user_divine_name_learning for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_delete on public.user_divine_name_learning for delete to authenticated using (user_id = auth.uid());
create policy own_select on public.user_dua_bookmarks for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.user_dua_bookmarks for insert to authenticated with check (user_id = auth.uid() and public.asma_dua_visible(dua_id));
create policy own_update on public.user_dua_bookmarks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_delete on public.user_dua_bookmarks for delete to authenticated using (user_id = auth.uid());

-- ---------- 13. Function privileges ----------
revoke execute on function public.asma_guard_top(), public.asma_guard_child(), public.asma_guard_part(), public.check_asma_reviewer(), public.apply_asma_review(),
  public.asma_after_name_change(), public.asma_methodology_changed(), public.asma_flag_name_dependents(uuid, text), public.compute_asma_integrity(text, uuid),
  public.asma_record(text, uuid), public.asma_review_ok(text, uuid), public.asma_counts_consistent(uuid), public.asma_summary_json(uuid) from public, anon, authenticated;
revoke execute on function public.asma_replace_occurrences(uuid, uuid, text, jsonb), public.asma_set_referent(uuid, text, text),
  public.run_asma_integrity(text, uuid), public.publish_asma_ai_draft(text, uuid), public.withdraw_asma_ai_draft(text, uuid) from public, anon;
grant execute on function public.asma_replace_occurrences(uuid, uuid, text, jsonb), public.asma_set_referent(uuid, text, text),
  public.run_asma_integrity(text, uuid), public.publish_asma_ai_draft(text, uuid), public.withdraw_asma_ai_draft(text, uuid) to authenticated;
grant execute on function public.public_asma_names(), public.public_asma_name(text), public.public_asma_occurrences(text, text, integer, integer, smallint),
  public.public_asma_names_in_verse(smallint, smallint), public.public_asma_lexical_in_verse(smallint, smallint), public.public_asma_duas(), public.public_asma_dua(text),
  public.public_asma_topics() to anon, authenticated;
