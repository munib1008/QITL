set search_path = public, extensions;

-- Content licence registry: one row per source x asset type (x scope, e.g. one riwayah), alongside sources and the
-- source_licences view (both unchanged).
--
--   APPROVED             an admin checked the licence or written permission and signed it off (verified_by = that admin)
--   CONDITIONAL          usable under the recorded conditions (a published licence with conditions)
--   PERMISSION_REQUIRED  no licence found / page not readable / terms unclear: ask the rights holder in writing
--   BLOCKED              may not be used
--
-- Rules enforced here: only an admin sets APPROVED, and the database stamps verified_by / verified_at with that admin;
-- APPROVED needs a licence or written-permission reference and an evidence URL; CONDITIONAL needs its conditions. Nothing
-- is APPROVED merely because it is downloadable, and nothing seeded below is APPROVED or verified: the owner signs off.
-- "Allowed for display" (content_permission_allowed) = APPROVED, or CONDITIONAL with the attribution text recorded.

create table public.content_permissions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete restrict,
  asset_type text not null check (asset_type in ('text', 'recording', 'font', 'image', 'translation', 'tafsir', 'metadata', 'api')),
  scope text not null default 'all' check (scope ~ '^[a-z0-9_-]{1,60}$'), -- e.g. a riwayah id, a font family
  status text not null default 'PERMISSION_REQUIRED' check (status in ('APPROVED', 'CONDITIONAL', 'PERMISSION_REQUIRED', 'BLOCKED')),
  rights_holder text check (char_length(rights_holder) <= 300),
  official_url text check (official_url ~ '^https://'),
  edition_version text check (char_length(edition_version) <= 200),
  riwayah_id text references public.riwayat (id) on delete restrict,
  qiraah_riwayah_note text check (char_length(qiraah_riwayah_note) <= 300), -- as the provider names it, when it maps to no single row
  licence_ref text check (char_length(licence_ref) <= 500),                 -- licence name/version or written-permission reference
  commercial_use text not null default 'unknown' check (commercial_use in ('allowed', 'conditional', 'not_allowed', 'unknown')),
  local_hosting text not null default 'unknown' check (local_hosting in ('allowed', 'conditional', 'not_allowed', 'unknown')),
  modification text not null default 'unknown' check (modification in ('allowed', 'conditional', 'not_allowed', 'unknown')),
  offline_distribution text not null default 'unknown' check (offline_distribution in ('allowed', 'conditional', 'not_allowed', 'unknown')),
  derivative_sync text not null default 'unknown' check (derivative_sync in ('allowed', 'conditional', 'not_allowed', 'unknown')),
  attribution_required boolean, -- null = not stated
  attribution_text text check (char_length(attribution_text) <= 1000),
  api_cache_limits text check (char_length(api_cache_limits) <= 2000),
  obligations text check (char_length(obligations) <= 2000), -- renewal, reporting, update, notification duties
  conditions text check (char_length(conditions) <= 4000),
  evidence_url text check (evidence_url ~ '^https://'),
  evidence_summary text check (char_length(evidence_summary) <= 4000), -- what the evidence page says, as read
  evidence_checked_on date,
  notes text check (char_length(notes) <= 4000),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, asset_type, scope),
  check ((verified_at is null) = (verified_by is null)),
  check (status <> 'APPROVED' or (verified_by is not null and licence_ref is not null and evidence_url is not null)),
  check (status <> 'CONDITIONAL' or conditions is not null),
  check (attribution_required is distinct from true or status not in ('APPROVED') or attribution_text is not null)
);
create index content_permissions_source on public.content_permissions (source_id);

-- Only an admin approves or verifies, and the stamp is always the acting admin and the current time.
create or replace function public.guard_content_permission()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  is_admin boolean := exists (select 1 from public.role_assignments where user_id = auth.uid() and role = 'admin');
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    new.created_by := old.created_by;
  end if;
  if new.status = 'APPROVED' or new.verified_by is not null then
    if (tg_op = 'INSERT' or new.status is distinct from old.status or new.verified_by is distinct from old.verified_by
        or (old.status = 'APPROVED' and to_jsonb(new) - 'updated_at' - 'verified_at' - 'verified_by' <> to_jsonb(old) - 'updated_at' - 'verified_at' - 'verified_by'))
       and not is_admin then
      raise exception 'only an admin may approve or verify a content permission' using errcode = '42501';
    end if;
  end if;
  if is_admin and (new.status = 'APPROVED' or new.verified_by is not null)
     and (tg_op = 'INSERT' or to_jsonb(new) - 'updated_at' - 'verified_at' - 'verified_by' <> to_jsonb(old) - 'updated_at' - 'verified_at' - 'verified_by'
          or new.verified_by is distinct from old.verified_by) then
    new.verified_by := auth.uid();
    new.verified_at := now();
  end if;
  return new;
end $$;
create trigger content_permissions_guard before insert or update on public.content_permissions for each row execute function public.guard_content_permission();
create trigger content_permissions_audit after insert or update or delete on public.content_permissions for each row execute function public.audit();
revoke execute on function public.guard_content_permission() from public, anon, authenticated;

create or replace function public.content_permission_allowed(pid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.content_permissions p where p.id = pid
    and (p.status = 'APPROVED' or (p.status = 'CONDITIONAL' and p.attribution_text is not null)));
$$;

-- Registry view for the admin page and docs: every source with its per-asset permissions.
create view public.content_licence_registry with (security_invoker = true) as
select p.id as permission_id, s.id as source_id, s.type as source_type, s.work, s.publisher, s.rights_status, p.asset_type, p.scope, p.status,
       p.rights_holder, p.official_url, p.edition_version, p.riwayah_id, p.qiraah_riwayah_note, p.licence_ref, p.commercial_use, p.local_hosting,
       p.modification, p.offline_distribution, p.derivative_sync, p.attribution_required, p.attribution_text, p.api_cache_limits, p.obligations,
       p.conditions, p.evidence_url, p.evidence_summary, p.evidence_checked_on, p.notes, p.verified_at, p.verified_by,
       public.content_permission_allowed(p.id) as allowed
from public.content_permissions p join public.sources s on s.id = p.source_id;

alter table public.content_permissions enable row level security;
alter table public.content_permissions force row level security;
revoke all on public.content_permissions from anon, authenticated;
grant select on public.content_permissions, public.content_licence_registry to anon, authenticated;
grant insert, update, delete on public.content_permissions to authenticated;
-- Licence metadata is public (no copyrighted text); admins manage it.
create policy read_all on public.content_permissions for select using (true);
create policy admin_insert on public.content_permissions for insert to authenticated with check (public.has_role('admin'));
create policy admin_update on public.content_permissions for update to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy admin_delete on public.content_permissions for delete to authenticated using (public.has_role('admin') and status <> 'APPROVED');

-- ---------- Seed: sources (reused when the importer already registered them) ----------
-- Every row below comes from a page read on 2026-10-31 (docs/LICENSING.md). verified_by is null on all of them.
insert into public.sources (type, work, edition, publisher, source_url, language, license_text, license_url, attribution, notes)
select * from (values
  ('quran_text', 'Tanzil Quran Text (Uthmani)', 'Uthmani', 'Tanzil Project', 'https://tanzil.net/', 'ar',
   'Tanzil Quran Text (Uthmani), Copyright (C) 2007-2026 Tanzil Project. License: Creative Commons Attribution 3.0. Verbatim copies only (the text may not be changed); the source (Tanzil Project) is credited and linked to tanzil.net; the copyright notice is reproduced in derived files.',
   'https://tanzil.net/docs/text_license', 'Tanzil Project, tanzil.net', null),
  ('quran_text', 'King Fahd Complex Quran developer platform', 'Unicode texts and fonts, several riwayat', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', 'ar',
   null, null, null, 'Licence registry seed 2026-10-31: no licence or terms of use found on the platform page.'),
  ('other', 'King Fahd Complex Quran audio library', null, 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-audios/', 'ar',
   null, null, null, 'Licence registry seed 2026-10-31: free public-use statement on the page; see content_permissions.'),
  ('other', 'Quran Foundation Content APIs', null, 'Quran Foundation', 'https://api-docs.quran.foundation/', 'en',
   null, 'https://api-docs.quran.foundation/legal/developer-terms/', null, 'Licence registry seed 2026-10-31.'),
  ('quran_translation', 'QuranEnc translations of the meanings', null, 'QuranEnc.com', 'https://quranenc.com/', 'en',
   null, 'https://quranenc.com/en/home/api/', null, 'Licence registry seed 2026-10-31.'),
  ('hadith_collection', 'sunnah.com API', null, 'sunnah.com', 'https://sunnah.com/', 'ar',
   null, null, null, 'Licence registry seed 2026-10-31: the developers page refused the request (HTTP 403).'),
  ('other', 'Quranic Arabic Corpus', 'Morphology 0.4', 'Quranic Arabic Corpus (maintained by the quran.com team)', 'https://corpus.quran.com/', 'ar',
   null, 'https://corpus.quran.com/license.jsp', null, 'Licence registry seed 2026-10-31.'),
  ('other', 'Self-hosted interface fonts (SIL OFL 1.1)', 'src/app/fonts and next/font build-time copies', null, null, 'ar',
   'SIL Open Font License 1.1', 'https://openfontlicense.org/open-font-license-official-text/', null, 'Licence registry seed 2026-10-31.')
) as v(type, work, edition, publisher, source_url, language, license_text, license_url, attribution, notes)
where not exists (select 1 from public.sources s where s.type = v.type and s.work = v.work and s.edition is not distinct from v.edition);

-- The Tanzil version the reader shows (content/quran/source.json): reused when the importer already recorded it.
insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current)
select s.id, 'Uthmani 1.1', 'bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8', '2026-10-31T01:12:14.601Z',
       'https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true',
       not exists (select 1 from public.source_versions x where x.source_id = s.id and x.is_current)
from public.sources s
where s.type = 'quran_text' and s.work = 'Tanzil Quran Text (Uthmani)' and s.edition = 'Uthmani'
  and not exists (select 1 from public.source_versions x where x.source_id = s.id and x.checksum_sha256 = 'bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8');

-- ---------- Seed: permissions (none APPROVED, none verified) ----------
create temporary table seed_perm (
  work text, asset_type text, scope text, status text, rights_holder text, official_url text, edition_version text, riwayah_id text,
  qiraah_riwayah_note text, licence_ref text, commercial_use text, local_hosting text, modification text, offline_distribution text,
  derivative_sync text, attribution_required boolean, attribution_text text, api_cache_limits text, obligations text, conditions text,
  evidence_url text, evidence_summary text, notes text
);

insert into seed_perm values
-- Tanzil
('Tanzil Quran Text (Uthmani)', 'text', 'hafs', 'CONDITIONAL', 'Tanzil Project', 'https://tanzil.net/', 'Uthmani 1.1', 'hafs', null,
 'Creative Commons Attribution 3.0 (Tanzil Quran text licence)', 'unknown', 'allowed', 'not_allowed', 'allowed', 'conditional', true,
 'Arabic text: Tanzil Quran Text (Uthmani), version 1.1, from the Tanzil Project (tanzil.net), © 2007–2026 Tanzil Project, CC BY 3.0, reproduced verbatim.',
 null, 'Keep the copyright notice in every verbatim copy and reproduce it appropriately in derived files; the page asks users to check tanzil.net/updates for corrections.',
 'Verbatim copies only (changing the text is not allowed); the source (Tanzil Project) clearly indicated; a link to tanzil.net; the copyright notice kept in copies and in files derived from or containing a substantial portion of the text.',
 'https://tanzil.net/docs/text_license',
 'Licence: Creative Commons Attribution 3.0. Permission to copy and distribute verbatim copies; changing the text is not allowed; usable in any website or application provided the source (Tanzil Project) is clearly indicated and a link is made to tanzil.net; the copyright notice is included in verbatim copies and reproduced in derived files. The page does not address commercial use.',
 'Riwayah: Hafs ''an ''Asim (the Uthmani text the reader shows). Commercial use is not addressed on the licence page.'),
-- King Fahd Complex developer platform (texts, fonts, tafsir)
('King Fahd Complex Quran developer platform', 'text', 'hafs', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'hafs', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'The platform page lists Unicode texts and fonts for Hafs, Warsh, Shu''bah, Qalun, al-Susi, al-Bazzi and al-Duri in Excel, CSV, HTML5, SQL, XML, JSON, TXT and PDF with file hashes. It contains no licence or terms of use; the footer reads "all rights reserved" (جميع الحقوق محفوظة). https://qurancomplex.gov.sa/techquran/dev returned HTTP 404 on 2026-10-31.',
 'Ask the Complex (info@qurancomplex.gov.sa) for written permission covering web display, local hosting and attribution wording.'),
('King Fahd Complex Quran developer platform', 'text', 'warsh', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'warsh', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Listed on the platform page (Warsh text and font). No licence or terms of use on the page; footer "all rights reserved".', 'Written permission needed before any import.'),
('King Fahd Complex Quran developer platform', 'text', 'shubah', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'shubah', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Listed on the platform page (Shu''bah text and font). No licence or terms of use on the page; footer "all rights reserved".', 'Written permission needed before any import.'),
('King Fahd Complex Quran developer platform', 'text', 'qalun', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'qalun', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Listed on the platform page (Qalun text and font). No licence or terms of use on the page; footer "all rights reserved".', 'Written permission needed before any import.'),
('King Fahd Complex Quran developer platform', 'text', 'susi', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'susi', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Listed on the platform page (al-Susi text and font). No licence or terms of use on the page; footer "all rights reserved".', 'Written permission needed before any import.'),
('King Fahd Complex Quran developer platform', 'text', 'bazzi', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'bazzi', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Listed on the platform page (al-Bazzi text and font). No licence or terms of use on the page; footer "all rights reserved".', 'Written permission needed before any import.'),
('King Fahd Complex Quran developer platform', 'text', 'duri', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, null,
 'al-Duri (the page says "Douri" without naming the reader: al-Duri transmits from both Abu ''Amr and al-Kisa''i)',
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Listed on the platform page (al-Duri text and font). No licence or terms of use on the page; footer "all rights reserved".', 'Confirm with the Complex which al-Duri this is, and ask for written permission.'),
('King Fahd Complex Quran developer platform', 'font', 'kfgqpc-fonts', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, null, 'Fonts for each listed riwayah',
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Unicode Uthmanic fonts are offered per riwayah; no font licence is stated on the page.', 'Not used by QITL. Written permission needed.'),
('King Fahd Complex Quran developer platform', 'tafsir', 'tafseer-muyassar', 'PERMISSION_REQUIRED', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-dev/', null, 'hafs', null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://qurancomplex.gov.sa/quran-dev/',
 'Tafseer Muyassar is offered for use in developers'' applications and research ("لاستخدامها في محتوى تطبيقاتهم ... وبحوثهم"); this describes intended use, not a licence.', 'Written permission needed before any import.'),
-- King Fahd Complex audio library
('King Fahd Complex Quran audio library', 'recording', 'hafs', 'CONDITIONAL', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-audios/', null, 'hafs', null,
 'Public-use statement on the audio library page, based on the approval of the Minister of Islamic Affairs, Dawah and Guidance', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null,
 'Read each recording''s own page for download and hosting conditions before use; the Complex disclaims responsibility for technical or software errors.',
 'Free public use of the digital copies in computer applications, radio broadcast sites and channels, websites and the work of government and private bodies, inside and outside Saudi Arabia. Downloading, local hosting, redistribution and attribution are not stated on the listing page.',
 'https://qurancomplex.gov.sa/quran-audios/',
 'Wording read 2026-10-31 (fragments): "بناء على موافقة معالي وزير الشؤون الإسلامية والدعوة والإرشاد"; "يتشـرَّف المجمع بإتاحة النسخ الرقمية ... للاستخدام العام مجاناً"; "في التطبيقات الحاسوبية ومواقع وقنوات البث الإذاعي، ومواقع الإنترنت، وأعمال الجهات الحكومية"; "وذلك داخل المملكة العربية السعودية وخارجها"; "والمجمع ليس مسؤولاً عن الأخطاء الفنية، أو البرمجية". Riwayat listed: Hafs ''an ''Asim (5 reciters), Shu''bah ''an ''Asim, Qalun ''an Nafi'', al-Susi ''an Abi ''Amr, al-Duri ''an Abi ''Amr. Warsh is not listed.',
 'No attribution text recorded yet, so not allowed for display until the owner records one.'),
('King Fahd Complex Quran audio library', 'recording', 'shubah', 'CONDITIONAL', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-audios/', null, 'shubah', null,
 'Public-use statement on the audio library page (see the Hafs row)', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null,
 'As the Hafs row.', 'As the Hafs row: free public use in applications, broadcast and websites, inside and outside Saudi Arabia; hosting and redistribution not stated.',
 'https://qurancomplex.gov.sa/quran-audios/', 'Listed: Shu''bah ''an ''Asim (one reciter).', 'No attribution text recorded yet.'),
('King Fahd Complex Quran audio library', 'recording', 'qalun', 'CONDITIONAL', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-audios/', null, 'qalun', null,
 'Public-use statement on the audio library page (see the Hafs row)', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null,
 'As the Hafs row.', 'As the Hafs row: free public use in applications, broadcast and websites, inside and outside Saudi Arabia; hosting and redistribution not stated.',
 'https://qurancomplex.gov.sa/quran-audios/', 'Listed: Qalun ''an Nafi'' (one reciter).', 'No attribution text recorded yet.'),
('King Fahd Complex Quran audio library', 'recording', 'susi', 'CONDITIONAL', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-audios/', null, 'susi', null,
 'Public-use statement on the audio library page (see the Hafs row)', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null,
 'As the Hafs row.', 'As the Hafs row: free public use in applications, broadcast and websites, inside and outside Saudi Arabia; hosting and redistribution not stated.',
 'https://qurancomplex.gov.sa/quran-audios/', 'Listed: al-Susi ''an Abi ''Amr (one reciter).', 'No attribution text recorded yet.'),
('King Fahd Complex Quran audio library', 'recording', 'duri_abu_amr', 'CONDITIONAL', 'King Fahd Glorious Qur''an Printing Complex', 'https://qurancomplex.gov.sa/quran-audios/', null, 'duri_abu_amr', null,
 'Public-use statement on the audio library page (see the Hafs row)', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null,
 'As the Hafs row.', 'As the Hafs row: free public use in applications, broadcast and websites, inside and outside Saudi Arabia; hosting and redistribution not stated.',
 'https://qurancomplex.gov.sa/quran-audios/', 'Listed: al-Duri ''an Abi ''Amr (one reciter).', 'No attribution text recorded yet.'),
-- Quran Foundation
('Quran Foundation Content APIs', 'api', 'content-apis', 'CONDITIONAL', 'Quran Foundation', 'https://api-docs.quran.foundation/', 'Developer Terms, last updated 2026-10-11', null, null,
 'Quran Foundation Developer Terms (last updated 2026-10-11)', 'conditional', 'conditional', 'not_allowed', 'not_allowed', 'conditional', true, null,
 'No caching or storing of QF Content for more than 1 week unless through the Content Sync APIs (sync at least every 7 days when connected); prepackaged databases or build-time bundles are not authorised; font files and Mushaf images may be bundled only as part of the application; published rate limits apply.',
 'Report actual or suspected unauthorised access or data exposure to developers@quran.com within 24 hours; provide logs and architecture information for audits on written notice; delete QF Content and user data on termination; migrate when endpoints change; a public privacy policy and terms of use are required.',
 'Non-exclusive, revocable licence solely to operate applications giving beneficial Quranic experiences; credit Quran Foundation in a reasonably accessible place; Quran text never modified; paid apps, ads and donations allowed when QF Content appears only in the end-user experience; selling or redistributing raw data needs a signed commercial licence.',
 'https://api-docs.quran.foundation/legal/developer-terms/',
 'Read 2026-10-31: licence "solely to develop and operate Applications that provide beneficial Quranic experiences to end users"; 1-week cache limit except Content Sync; credit Quran Foundation; redistribution of QF Content as a dataset needs a signed commercial licence; breach reports within 24 hours; audit on notice.',
 'Attribution wording to be chosen by the owner. API credentials (QF_CLIENT_ID / QF_CLIENT_SECRET) not issued yet.'),
('Quran Foundation Content APIs', 'translation', 'third-party-translations', 'PERMISSION_REQUIRED', null, 'https://api-docs.quran.foundation/', null, null, null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://api-docs.quran.foundation/legal/developer-terms/',
 'The terms cover "QF Content it owns"; they do not address translations, tafsir or audio owned by third parties.', 'Each translation''s own rights holder must be identified and cleared per edition.'),
-- QuranEnc
('QuranEnc translations of the meanings', 'translation', 'all', 'CONDITIONAL', 'QuranEnc.com and each translation''s publisher', 'https://quranenc.com/', null, null, null,
 'QuranEnc "Terms and Policies" on the API page', 'unknown', 'allowed', 'not_allowed', 'conditional', 'not_allowed', true, null, null,
 'Mention the version number when re-publishing; notify QuranEnc.com of any note on a translation; update to the latest version issued by QuranEnc.com; no inappropriate advertisements with translations of the meanings.',
 'Translations may be downloaded and re-published with no modification, addition or deletion, clearly referring to the publisher and the source (QuranEnc.com), mentioning the version number, notifying QuranEnc of notes and keeping the translation updated.',
 'https://quranenc.com/en/home/api/',
 'Read 2026-10-31: "Contents of the translations can be downloaded and re-published, with the following terms and conditions"; "No modification, addition, or deletion of the content"; "Clearly referring to the publisher and the source (QuranEnc.com)"; version number; notify notes; update to the latest version. Commercial use not addressed; no key or agreement mentioned.',
 'Per-edition: the attribution names that edition''s publisher. Commercial use is not addressed.'),
('QuranEnc translations of the meanings', 'api', 'api', 'CONDITIONAL', 'QuranEnc.com', 'https://quranenc.com/en/home/api/', null, null, null,
 'QuranEnc "Terms and Policies" on the API page', 'unknown', 'allowed', 'not_allowed', 'conditional', 'not_allowed', true, null,
 'The page states no rate limits, key or caching rule; version and update endpoints exist to track new translation versions.',
 'Keep translations updated to the latest QuranEnc version; notify notes on translations.', 'Same terms as the translation row.',
 'https://quranenc.com/en/home/api/', 'No registration or API key is mentioned on the page.', 'The interpretation module''s adapter expects QURANENC_API_KEY; confirm whether a key or agreement is needed.'),
('QuranEnc translations of the meanings', 'tafsir', 'all', 'PERMISSION_REQUIRED', 'QuranEnc.com', 'https://quranenc.com/en/home/api/', null, null, null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://quranenc.com/en/home/api/',
 'The API serves tafsir as well, but the terms on the page speak of "the translations" only.', 'Ask QuranEnc whether the same terms cover tafsir.'),
-- sunnah.com
('sunnah.com API', 'api', 'api', 'PERMISSION_REQUIRED', 'sunnah.com', 'https://sunnah.com/developers', null, null, null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://sunnah.com/developers',
 'https://sunnah.com/developers returned HTTP 403 to the fetch on 2026-10-31; the repository README (https://github.com/sunnah-com/api) states no terms. Search results (not the page itself) say keys are requested through an issue on the sunnah-com/api GitHub repository and that no offline dump is available.',
 'Request a key and written terms; SUNNAH_API_KEY not set.'),
('sunnah.com API', 'text', 'hadith', 'PERMISSION_REQUIRED', 'sunnah.com', 'https://sunnah.com/', null, null, null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://sunnah.com/developers',
 'No terms could be read (HTTP 403).', 'Hadith text stays referenced only ("licence pending") until cleared.'),
('sunnah.com API', 'translation', 'hadith', 'PERMISSION_REQUIRED', 'sunnah.com and each translation''s rights holder', 'https://sunnah.com/', null, null, null,
 null, 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', null, null, null, null, null, 'https://sunnah.com/developers',
 'No terms could be read (HTTP 403).', null),
-- Quranic Arabic Corpus
('Quranic Arabic Corpus', 'metadata', 'morphology', 'CONDITIONAL', 'Kais Dukes (maintained by the quran.com team)', 'https://corpus.quran.com/', 'Morphology 0.4', 'hafs', null,
 'GNU General Public License v3 (licence page) plus the download terms of use', 'allowed', 'allowed', 'not_allowed', 'allowed', 'conditional', true, null, null,
 'Keep the copyright notice in verbatim copies and derived works; GPL obligations apply to distributed derivative works.',
 'Verbatim copies only (changing the file is not allowed); the source (the Quranic Arabic Corpus) clearly indicated; a link to corpus.quran.com; the notice reproduced in derived works; GPL v3 copyleft for modified or derived works.',
 'https://corpus.quran.com/download/',
 'Licence page (https://corpus.quran.com/license.jsp) reproduces GNU GPL v3, copyright Kais Dukes 2009-2017, maintained by the quran.com team. Download terms: "Permission is granted to copy and distribute verbatim copies of this file, but CHANGING IT IS NOT ALLOWED"; source clearly indicated; link to corpus.quran.com; notice in derived works.',
 'Confirm that GPL copyleft suits the site before importing (the morphology is word data for the Hafs text).'),
-- Fonts
('Self-hosted interface fonts (SIL OFL 1.1)', 'font', 'noto-naskh-arabic', 'CONDITIONAL', 'Noto project authors (Google Fonts distribution)', null, 'Noto Naskh Arabic v44, Arabic subset, variable', null, null,
 'SIL Open Font License 1.1', 'conditional', 'allowed', 'conditional', 'allowed', 'conditional', null, null, null,
 'Each copy must carry the copyright notice and the licence; modified versions may not use a Reserved Font Name without written permission.',
 'Use, embedding and redistribution allowed with the copyright notice and the OFL; the font may not be sold by itself; derivatives stay under the OFL.',
 'https://openfontlicense.org/open-font-license-official-text/',
 'OFL 1.1 read 2026-10-31. src/app/fonts/README.md: downloaded unmodified from Google Fonts, loaded with next/font/local.',
 'Missing: the OFL text and copyright notice are not stored next to the .woff2 file in src/app/fonts.'),
('Self-hosted interface fonts (SIL OFL 1.1)', 'font', 'noto-nastaliq-urdu', 'CONDITIONAL', 'Noto project authors (Google Fonts distribution)', null, 'Noto Nastaliq Urdu v23, Arabic subset, variable', null, null,
 'SIL Open Font License 1.1', 'conditional', 'allowed', 'conditional', 'allowed', 'conditional', null, null, null,
 'As Noto Naskh Arabic.', 'As Noto Naskh Arabic.', 'https://openfontlicense.org/open-font-license-official-text/',
 'OFL 1.1 read 2026-10-31. src/app/fonts/README.md: downloaded unmodified from Google Fonts.',
 'Missing: the OFL text and copyright notice are not stored next to the .woff2 file in src/app/fonts.'),
('Self-hosted interface fonts (SIL OFL 1.1)', 'font', 'next-font-google', 'CONDITIONAL', 'Each family''s authors (Google Fonts distribution)', null, 'Source Serif 4, IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Mono, Amiri Quran, Amiri', null, null,
 'SIL Open Font License 1.1 (as stated in src/app/fonts.ts)', 'conditional', 'allowed', 'conditional', 'allowed', 'conditional', null, null, null,
 'As Noto Naskh Arabic.', 'As Noto Naskh Arabic.', 'https://openfontlicense.org/open-font-license-official-text/',
 'OFL 1.1 read 2026-10-31; each family''s licence was not checked separately today.', 'Self-hosted at build time by next/font/google.');

insert into public.content_permissions (source_id, asset_type, scope, status, rights_holder, official_url, edition_version, riwayah_id, qiraah_riwayah_note,
  licence_ref, commercial_use, local_hosting, modification, offline_distribution, derivative_sync, attribution_required, attribution_text, api_cache_limits,
  obligations, conditions, evidence_url, evidence_summary, evidence_checked_on, notes)
select s.id, p.asset_type, p.scope, p.status, p.rights_holder, p.official_url, p.edition_version, p.riwayah_id, p.qiraah_riwayah_note,
  p.licence_ref, p.commercial_use, p.local_hosting, p.modification, p.offline_distribution, p.derivative_sync, p.attribution_required, p.attribution_text, p.api_cache_limits,
  p.obligations, p.conditions, p.evidence_url, p.evidence_summary, date '2026-10-31', p.notes
from seed_perm p
join lateral (select id from public.sources x where x.work = p.work order by x.created_at limit 1) s on true
on conflict (source_id, asset_type, scope) do nothing;
drop table seed_perm;
