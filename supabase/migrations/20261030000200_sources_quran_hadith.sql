-- Source registry, licences, the Quran and the seven catalogued Hadith collections.
-- Nothing here is seeded with religious text: text arrives only through pinned, checksummed source imports.

-- ---------- Source registry ----------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('quran_text', 'quran_translation', 'tafsir', 'hadith_collection', 'hadith_translation', 'hadith_grading', 'history', 'genealogy', 'geography', 'map_tiles', 'image', 'other')),
  work text not null,
  edition text,
  author text,
  publisher text,
  source_url text check (source_url ~ '^https://'),
  language text not null default 'ar',
  rights_status public.rights_status not null default 'unknown',
  license_text text,
  license_url text check (license_url ~ '^https://'),
  attribution text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((verification_status = 'verified') = (verified_at is not null))
);
create trigger sources_touch before update on public.sources for each row execute function public.touch_updated_at();
create trigger sources_audit after insert or update or delete on public.sources for each row execute function public.audit();

-- One pinned, checksummed version of a source as imported.
create table public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete restrict,
  version text not null,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz not null,
  retrieved_from text not null check (retrieved_from ~ '^https://'),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_id, version)
);
create unique index source_versions_one_current on public.source_versions (source_id) where is_current;

create table public.source_import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requested_by uuid references auth.users (id) on delete set null,
  expected_checksum text check (expected_checksum ~ '^[0-9a-f]{64}$'),
  result_version_id uuid references public.source_versions (id),
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- A licence may be shown publicly only when cleared (or public domain).
create or replace function public.source_publishable(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sources s where s.id = sid and s.rights_status in ('cleared', 'public_domain'));
$$;

-- ---------- Quran ----------
create table public.quran_surahs (
  id smallint primary key check (id between 1 and 114),
  name_ar text not null,
  name_transliterated text not null,
  name_en text,
  ayah_count smallint not null check (ayah_count between 3 and 286),
  source_version_id uuid not null references public.source_versions (id)
);

create table public.quran_verses (
  surah_id smallint not null references public.quran_surahs (id),
  ayah_no smallint not null check (ayah_no >= 1),
  text_ar text not null check (char_length(text_ar) > 0),
  source_version_id uuid not null references public.source_versions (id),
  primary key (surah_id, ayah_no)
);

-- The Arabic is immutable: a new source version replaces rows through a re-import, never an edit.
create or replace function public.quran_immutable()
returns trigger language plpgsql as $$
begin
  if new.text_ar is distinct from old.text_ar and new.source_version_id = old.source_version_id then
    raise exception 'quran_verses.text_ar is immutable; import a new source version instead' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger quran_verses_immutable before update on public.quran_verses for each row execute function public.quran_immutable();

create table public.quran_translations (
  surah_id smallint not null,
  ayah_no smallint not null,
  source_id uuid not null references public.sources (id),
  source_version_id uuid not null references public.source_versions (id),
  translator text not null,
  edition text not null,
  language text not null,
  text text not null,
  primary key (surah_id, ayah_no, source_id),
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no)
);

create table public.tafsir_entries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  surah_id smallint not null,
  ayah_from smallint not null,
  ayah_to smallint not null,
  language text not null,
  text text not null,
  check (ayah_to >= ayah_from),
  foreign key (surah_id, ayah_from) references public.quran_verses (surah_id, ayah_no)
);

-- ---------- Hadith (seven catalogued collections; a collection is a catalogue, never a grade) ----------
create table public.hadith_collections (
  id text primary key check (id in ('bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'muwatta')),
  name_en text not null,
  name_ar text not null,
  compiler text not null,
  position smallint not null unique
);

create table public.hadith_books (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references public.hadith_collections (id),
  number text not null,
  title_en text,
  title_ar text,
  unique (collection_id, number)
);

create table public.hadith_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.hadith_books (id) on delete cascade,
  number text not null,
  title_en text,
  title_ar text,
  unique (book_id, number)
);

create table public.hadith_entries (
  id uuid primary key default gen_random_uuid(),
  collection_id text not null references public.hadith_collections (id),
  chapter_id uuid references public.hadith_chapters (id),
  numbering_system text not null, -- e.g. 'Fu''ad Abd al-Baqi', 'Dar al-Salam'; numbering differs between editions
  canonical_number text not null check (canonical_number ~ '^[0-9]+[a-z]?$'),
  source_version_id uuid not null references public.source_versions (id),
  arabic text not null,
  isnad text,
  source_url text check (source_url ~ '^https://'),
  status public.publication_status not null default 'draft',
  unique (collection_id, numbering_system, canonical_number)
);

create table public.hadith_number_variants (
  hadith_id uuid not null references public.hadith_entries (id) on delete cascade,
  numbering_system text not null,
  number text not null,
  primary key (hadith_id, numbering_system)
);

create table public.hadith_translations (
  hadith_id uuid not null references public.hadith_entries (id) on delete cascade,
  source_id uuid not null references public.sources (id),
  source_version_id uuid not null references public.source_versions (id),
  translator text not null,
  language text not null,
  text text not null,
  primary key (hadith_id, source_id)
);

-- One grading of one narration by one named scholar, with its citation. Several may exist and may differ.
create table public.hadith_gradings (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references public.hadith_entries (id) on delete cascade,
  grader text not null check (char_length(grader) > 1),
  grade text not null check (grade in ('sahih', 'hasan', 'hasan sahih', 'sahih li-ghayrihi', 'hasan li-ghayrihi', 'daif', 'daif jiddan', 'mawdu', 'munkar', 'shadhdh', 'other')),
  grade_label text not null,
  source_id uuid not null references public.sources (id),
  citation text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (hadith_id, grader, source_id)
);

create or replace function public.grade_is_authentic(g text)
returns boolean language sql immutable as $$
  select g in ('sahih', 'hasan', 'hasan sahih', 'sahih li-ghayrihi', 'hasan li-ghayrihi');
$$;

-- Aggregation that keeps every grading: never one badge that erases a dissent.
create view public.hadith_grade_summary with (security_invoker = true) as
select
  h.id as hadith_id,
  count(g.id) as grading_count,
  count(distinct public.grade_is_authentic(g.grade)) > 1 or count(distinct g.grade) > 1 as varies,
  coalesce(bool_and(public.grade_is_authentic(g.grade)), false) and count(g.id) > 0 as all_authentic,
  coalesce(jsonb_agg(jsonb_build_object('grader', g.grader, 'grade', g.grade, 'label', g.grade_label, 'citation', g.citation, 'authentic', public.grade_is_authentic(g.grade)) order by g.created_at) filter (where g.id is not null), '[]'::jsonb) as gradings
from public.hadith_entries h
left join public.hadith_gradings g on g.hadith_id = h.id
group by h.id;

-- The catalogue itself (names only; no narration text).
insert into public.hadith_collections (id, name_en, name_ar, compiler, position) values
  ('bukhari', 'Sahih al-Bukhari', 'صحيح البخاري', 'Muhammad ibn Ismail al-Bukhari', 1),
  ('muslim', 'Sahih Muslim', 'صحيح مسلم', 'Muslim ibn al-Hajjaj', 2),
  ('abudawud', 'Sunan Abi Dawud', 'سنن أبي داود', 'Abu Dawud al-Sijistani', 3),
  ('tirmidhi', 'Jami'' at-Tirmidhi', 'جامع الترمذي', 'Muhammad ibn Isa at-Tirmidhi', 4),
  ('nasai', 'Sunan an-Nasa''i', 'سنن النسائي', 'Ahmad ibn Shu''ayb an-Nasa''i', 5),
  ('ibnmajah', 'Sunan Ibn Majah', 'سنن ابن ماجه', 'Muhammad ibn Yazid Ibn Majah', 6),
  ('muwatta', 'Muwatta Malik', 'موطأ مالك', 'Malik ibn Anas', 7);
