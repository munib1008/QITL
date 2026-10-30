-- Verified Quran, Hadith and multilingual interpretation engine.
-- Keeps three things apart: revelation (quran_verses, immutable), human translation / commentary text (stored
-- unmodified with attribution, shown only when its licence is cleared), and QITL's own explanatory summaries (human or
-- AI-assisted drafts that publish only after every check and a scholarly approval). Reuses sources, source_versions,
-- quran_*, tafsir_entries, hadith_*, evidence_claims and editorial_reviews.

-- ---------- Licences: a read view over sources (the licence record stays on the source) ----------
create view public.source_licences with (security_invoker = true) as
select s.id as source_id, s.type, s.work, s.edition, s.author, s.publisher, s.language, s.rights_status, s.license_text, s.license_url,
       s.attribution, s.verification_status, s.verified_at, public.source_publishable(s.id) as displayable,
       (select v.version from public.source_versions v where v.source_id = s.id and v.is_current) as current_version,
       (select v.checksum_sha256 from public.source_versions v where v.source_id = s.id and v.is_current) as current_checksum
from public.sources s;

-- ---------- Translators, commentators and the edition registry ----------
create table public.translator_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) > 1),
  name_ar text,
  died text, -- as printed in the edition, e.g. '150 AH / 767 CE'; never estimated here
  description text,
  created_at timestamptz not null default now(),
  unique (name)
);

-- Every candidate edition is registered before anything is imported. It is displayed only when it is verified
-- (translator, edition, year, origin checked) and its source licence is cleared.
create table public.translation_editions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quran_translation', 'tafsir', 'early_tafsir', 'hadith_translation', 'hadith_commentary')),
  language text not null check (language ~ '^[a-z]{2}(-[A-Za-z]{2,4})?$'),
  title text not null,
  title_ar text,
  translator_id uuid references public.translator_profiles (id),
  publication_year smallint check (publication_year between 600 and 2100),
  edition text,
  origin text not null check (origin in ('qurancomplex', 'quran_foundation', 'quranenc', 'tanzil', 'sunnah_com', 'publisher', 'other')),
  origin_ref text, -- the provider's identifier, e.g. a QuranEnc translation key
  source_id uuid references public.sources (id),
  historical_period text,
  reliability_note text, -- e.g. for early tafsir: contains unattributed reports and Isra'iliyyat; not evidence by itself
  registry_status text not null default 'candidate' check (registry_status in ('candidate', 'verified', 'rejected')),
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  position smallint,
  created_at timestamptz not null default now(),
  check ((registry_status = 'verified') = (verified_at is not null and verified_by is not null)),
  check (kind <> 'early_tafsir' or reliability_note is not null),
  check (registry_status <> 'verified' or source_id is not null)
);
create unique index translation_editions_origin on public.translation_editions (origin, origin_ref) where origin_ref is not null;

create or replace function public.edition_displayable(eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.translation_editions e where e.id = eid and e.registry_status = 'verified' and public.source_publishable(e.source_id));
$$;

alter table public.quran_translations add column edition_id uuid references public.translation_editions (id);

-- Tafsir passages carry their edition and review flags; the oldest commentary is not the most authentic.
alter table public.tafsir_entries add column edition_id uuid references public.translation_editions (id);
alter table public.tafsir_entries add column flags text[] not null default '{}'
  check (flags <@ array['weak_narration', 'israiliyyat', 'disputed', 'unattributed']::text[]);
alter table public.tafsir_entries add column review_note text;

-- ---------- Word by word ----------
create table public.quran_word_morphology (
  surah_id smallint not null,
  ayah_no smallint not null,
  word_no smallint not null check (word_no >= 1),
  text_ar text not null,
  transliteration text,
  root text, -- Arabic letters, e.g. 'ح م د'
  lemma text,
  pos text not null, -- part of speech as tagged by the source corpus
  features jsonb not null default '{}', -- person, gender, number, case, mood, form, ...
  literal_gloss text,
  source_version_id uuid not null references public.source_versions (id),
  primary key (surah_id, ayah_no, word_no),
  foreign key (surah_id, ayah_no) references public.quran_verses (surah_id, ayah_no)
);
create index quran_word_morphology_root on public.quran_word_morphology (root);
create index quran_word_morphology_lemma on public.quran_word_morphology (lemma);

-- Every other place the same lemma appears.
create view public.quran_word_occurrences with (security_invoker = true) as
select lemma, root, surah_id, ayah_no, word_no, text_ar from public.quran_word_morphology where lemma is not null;

-- The meaning of a word in one verse, as reviewed (kept apart from the root's general meaning).
create table public.quran_word_senses (
  id uuid primary key default gen_random_uuid(),
  surah_id smallint not null,
  ayah_no smallint not null,
  word_no smallint not null,
  root_meaning text,
  contextual_meaning text not null,
  explanation_md text,
  claim_id uuid references public.evidence_claims (id),
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (surah_id, ayah_no, word_no) references public.quran_word_morphology (surah_id, ayah_no, word_no)
);

-- ---------- Hadith commentary: only where the scholar actually discussed that narration ----------
create table public.hadith_commentary_links (
  id uuid primary key default gen_random_uuid(),
  hadith_id uuid not null references public.hadith_entries (id) on delete cascade,
  edition_id uuid not null references public.translation_editions (id),
  locator text not null check (char_length(locator) > 1), -- volume/page or chapter in the named edition
  excerpt_ar text,
  excerpt_translation text,
  translation_language text,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (hadith_id, edition_id, locator)
);
create or replace function public.check_commentary_edition()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.translation_editions where id = new.edition_id and kind = 'hadith_commentary') then
    raise exception 'a hadith commentary link must name a hadith commentary edition' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger hadith_commentary_links_edition before insert or update on public.hadith_commentary_links for each row execute function public.check_commentary_edition();

-- ---------- Comparisons and explanations ----------
create table public.translation_comparisons (
  id uuid primary key default gen_random_uuid(),
  surah_id smallint not null,
  ayah_from smallint not null,
  ayah_to smallint not null,
  edition_ids uuid[] not null check (cardinality(edition_ids) between 1 and 11),
  created_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ayah_to >= ayah_from),
  foreign key (surah_id, ayah_from) references public.quran_verses (surah_id, ayah_no)
);

-- QITL Explanatory Summary: never a "most accurate translation", never an average of translations.
create table public.interpretation_explanations (
  id uuid primary key default gen_random_uuid(),
  surah_id smallint,
  ayah_from smallint,
  ayah_to smallint,
  hadith_id uuid references public.hadith_entries (id),
  language text not null check (language in ('en', 'ar', 'ur')),
  title text not null,
  body_md text not null,
  origin text not null check (origin in ('human', 'ai_assisted')),
  model text, -- the model that drafted it, when AI-assisted
  prompt_version text,
  inputs jsonb not null default '{}', -- edition ids, tafsir ids and the morphology version the draft was built from
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((surah_id is not null and ayah_from is not null and ayah_to >= ayah_from) or hadith_id is not null),
  check (origin = 'human' or (model is not null and prompt_version is not null))
);
create trigger interpretation_explanations_touch before update on public.interpretation_explanations for each row execute function public.touch_updated_at();
create trigger interpretation_explanations_audit after insert or update or delete on public.interpretation_explanations for each row execute function public.audit();

create table public.interpretation_differences (
  id uuid primary key default gen_random_uuid(),
  explanation_id uuid not null references public.interpretation_explanations (id) on delete cascade,
  term_ar text,
  surah_id smallint,
  ayah_no smallint,
  word_no smallint,
  kind text not null check (kind in ('translation_choice', 'linguistic', 'grammatical', 'exegetical')),
  summary text not null,
  edition_ids uuid[] not null default '{}',
  tafsir_ids uuid[] not null default '{}',
  recognised_disagreement boolean not null default false, -- an established scholarly difference, never suppressed
  position smallint not null default 1
);

-- The eight validation checks. The latest record per check decides; a role may sign only its own checks.
create table public.interpretation_reviews (
  id uuid primary key default gen_random_uuid(),
  explanation_id uuid not null references public.interpretation_explanations (id) on delete cascade,
  explanation_version integer not null,
  check_key text not null check (check_key in ('arabic_source', 'references', 'licensing', 'attribution', 'grammar', 'hadith_grading', 'sunni_scholarly', 'language_quality')),
  passed boolean not null,
  reviewer_id uuid not null references auth.users (id),
  note text,
  created_at timestamptz not null default now()
);
create index interpretation_reviews_latest on public.interpretation_reviews (explanation_id, check_key, created_at desc);

create or replace function public.interpretation_checks_passed(eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  with e as (select id, version from public.interpretation_explanations where id = eid),
  latest as (
    select distinct on (r.check_key) r.check_key, r.passed, r.explanation_version
    from public.interpretation_reviews r where r.explanation_id = eid order by r.check_key, r.created_at desc
  )
  select count(*) = 8 and bool_and(l.passed and l.explanation_version = (select version from e)) from latest l;
$$;

create or replace function public.guard_interpretation()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Any change to the text is a new version: earlier checks no longer count and dependants go stale.
  if tg_op = 'UPDATE' and (new.body_md is distinct from old.body_md or new.title is distinct from old.title) then
    if old.status = 'published' and new.status = 'published' then
      raise exception 'a published explanation cannot be edited in place; move it to correction first' using errcode = 'P0001';
    end if;
    new.version := old.version + 1;
    perform public.mark_dependants_stale('interpretation', new.id, new.version);
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not public.interpretation_checks_passed(new.id) then
      raise exception 'no checks, no publish: all eight validation checks must pass on this version' using errcode = 'P0001';
    end if;
    if not public.latest_review_approved('interpretation', new.id) then
      raise exception 'no review, no publish: interpretation % lacks a scholarly approval', new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- ---------- Dependencies: when a source changes, everything built from it is flagged ----------
create table public.content_dependency_versions (
  id uuid primary key default gen_random_uuid(),
  dependant_type text not null,
  dependant_id uuid not null,
  source_type text not null,
  source_id uuid not null,
  source_version integer not null,
  stale boolean not null default false,
  flagged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dependant_type, dependant_id, source_type, source_id)
);
create index content_dependency_source on public.content_dependency_versions (source_type, source_id);

create or replace function public.mark_dependants_stale(stype text, sid uuid, new_version integer)
returns void language sql security definer set search_path = public, extensions as $$
  update public.content_dependency_versions set stale = true, flagged_at = now()
  where source_type = stype and source_id = sid and source_version < new_version and not stale;
$$;

create trigger interpretation_explanations_guard before insert or update on public.interpretation_explanations for each row execute function public.guard_interpretation();
create trigger quran_word_senses_guard before insert or update on public.quran_word_senses for each row execute function public.guard_entity_publish();
create trigger quran_word_senses_touch before update on public.quran_word_senses for each row execute function public.touch_updated_at();

-- Commentary is quoted text: it needs a cleared, verified edition and a scholarly approval.
create or replace function public.guard_commentary_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not public.edition_displayable(new.edition_id) then
      raise exception 'licence pending: commentary edition % is not verified and cleared', new.edition_id using errcode = 'P0001';
    end if;
    if not public.latest_review_approved('hadith_commentary_links', new.id) then
      raise exception 'no review, no publish: commentary link % lacks a scholarly approval', new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger hadith_commentary_links_guard before insert or update on public.hadith_commentary_links for each row execute function public.guard_commentary_publish();

-- Which role signs which check.
create or replace function public.can_sign_check(k text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select case
    when k in ('arabic_source', 'references', 'licensing', 'attribution', 'grammar') then public.has_role('editor') or public.has_role('scholarly_reviewer')
    when k in ('hadith_grading', 'sunni_scholarly') then public.has_role('scholarly_reviewer')
    when k = 'language_quality' then public.has_role('translation_reviewer') or public.has_role('scholarly_reviewer')
    else false end;
$$;

revoke execute on function public.guard_interpretation(), public.guard_commentary_publish(), public.check_commentary_edition(),
  public.mark_dependants_stale(text, uuid, integer) from public, anon, authenticated;

-- ---------- Reviews may now target these entities ----------
alter table public.editorial_reviews drop constraint editorial_reviews_entity_type_check;
alter table public.editorial_reviews add constraint editorial_reviews_entity_type_check
  check (entity_type in ('claim', 'story', 'chapter', 'event', 'relationship', 'place_geometry', 'person', 'story_section', 'quiz', 'media',
    'interpretation', 'quran_word_senses', 'hadith_commentary_links'));

-- ---------- Access ----------
do $$
declare t text;
begin
  foreach t in array array['translator_profiles', 'translation_editions', 'quran_word_morphology', 'quran_word_senses', 'hadith_commentary_links',
    'translation_comparisons', 'interpretation_explanations', 'interpretation_differences', 'interpretation_reviews', 'content_dependency_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
grant select on public.translator_profiles, public.translation_editions, public.quran_word_morphology, public.quran_word_senses,
  public.hadith_commentary_links, public.interpretation_explanations, public.interpretation_differences to anon, authenticated;
grant select, insert, update, delete on public.translator_profiles, public.translation_editions, public.quran_word_senses, public.hadith_commentary_links,
  public.interpretation_explanations, public.interpretation_differences, public.translation_comparisons to authenticated;
grant select, insert on public.interpretation_reviews to authenticated;
grant select on public.content_dependency_versions to authenticated;
grant select on public.source_licences, public.quran_word_occurrences to anon, authenticated;

-- The registry is public metadata (no copyrighted text); editors maintain it.
create policy read_all on public.translator_profiles for select using (true);
create policy editor_write on public.translator_profiles for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy read_all on public.translation_editions for select using (true);
create policy editor_write on public.translation_editions for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));

-- Corpus data is shown only when its source licence is cleared; it is written by the import job only.
create policy read_licensed on public.quran_word_morphology for select using (
  public.is_staff() or exists (select 1 from public.source_versions v where v.id = source_version_id and public.source_publishable(v.source_id)));

create policy read_published on public.quran_word_senses for select using (public.is_staff() or status = 'published');
create policy editor_write on public.quran_word_senses for all to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));

create policy read_published on public.hadith_commentary_links for select using (public.is_staff() or (status = 'published' and public.edition_displayable(edition_id)));
create policy editor_write on public.hadith_commentary_links for all to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));

create policy own_rows on public.translation_comparisons for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy read_published on public.interpretation_explanations for select using (public.is_staff() or status = 'published');
create policy editor_insert on public.interpretation_explanations for insert to authenticated
  with check (public.has_role('editor') and status in ('draft', 'in_review') and created_by = auth.uid());
create policy staff_update on public.interpretation_explanations for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.interpretation_explanations for delete to authenticated using (public.has_role('admin') and status <> 'published');

create policy read_with_parent on public.interpretation_differences for select using (
  exists (select 1 from public.interpretation_explanations e where e.id = explanation_id and (e.status = 'published' or public.is_staff())));
create policy editor_write on public.interpretation_differences for all to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));

create policy staff_read on public.interpretation_reviews for select to authenticated using (public.is_staff() or public.has_role('translation_reviewer'));
create policy sign_own_check on public.interpretation_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.can_sign_check(check_key));

create policy staff_read on public.content_dependency_versions for select to authenticated
  using (public.is_staff() or public.has_role('translation_reviewer') or public.has_role('audio_producer'));
