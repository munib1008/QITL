set search_path = public, extensions;

-- Qira'at & Ahruf Learning Centre, part 2: text editions, transmission routes, variants, reciters and recordings.
--
-- Nothing here is seeded but the one edition QITL already shows (Tanzil Uthmani 1.1, Hafs 'an 'Asim). Every other
-- riwayah has no edition until its text is licensed. A variant's per-riwayah reading is stored text copied from a
-- licensed edition (it must occur in that edition's verse), never typed in. A recording is public only when its
-- permission allows display and its riwayah matches the text it is shown with (unless it is an explained comparison).

-- ---------- Text editions: one row per edition of the Quran text ----------
create table public.quran_text_editions (
  id uuid primary key default gen_random_uuid(),
  riwayah_id text not null references public.riwayat (id) on delete restrict,
  title text not null check (char_length(title) between 3 and 200),
  source_id uuid not null references public.sources (id) on delete restrict,
  source_version_id uuid references public.source_versions (id) on delete restrict,
  permission_id uuid references public.content_permissions (id) on delete restrict,
  is_default boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index quran_text_editions_one_default on public.quran_text_editions (is_default) where is_default;

create or replace function public.guard_quran_text_edition()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  p public.content_permissions;
begin
  new.updated_at := now();
  if new.source_version_id is not null and not exists (select 1 from public.source_versions v where v.id = new.source_version_id and v.source_id = new.source_id) then
    raise exception 'the edition''s version belongs to another source' using errcode = 'P0001';
  end if;
  if new.permission_id is not null then
    select * into p from public.content_permissions where id = new.permission_id;
    if p.source_id <> new.source_id or p.asset_type <> 'text' then
      raise exception 'an edition''s permission must be the text permission of its own source' using errcode = 'P0001';
    end if;
    if p.riwayah_id is not null and p.riwayah_id <> new.riwayah_id then
      raise exception 'the permission covers riwayah %, not %', p.riwayah_id, new.riwayah_id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger quran_text_editions_guard before insert or update on public.quran_text_editions for each row execute function public.guard_quran_text_edition();
create trigger quran_text_editions_audit after insert or update or delete on public.quran_text_editions for each row execute function public.audit();

create or replace function public.quran_edition_allowed(eid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.quran_text_editions e where e.id = eid and e.permission_id is not null and public.content_permission_allowed(e.permission_id));
$$;

insert into public.quran_text_editions (riwayah_id, title, source_id, source_version_id, permission_id, is_default, notes)
select 'hafs', 'Tanzil Quran Text (Uthmani), version 1.1', s.id,
       (select v.id from public.source_versions v where v.source_id = s.id and v.checksum_sha256 = 'bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8' limit 1),
       (select p.id from public.content_permissions p where p.source_id = s.id and p.asset_type = 'text' and p.scope = 'hafs'),
       true, 'The text the Quran reader shows (content/quran, pinned by checksum).'
from public.sources s where s.type = 'quran_text' and s.work = 'Tanzil Quran Text (Uthmani)' and s.edition = 'Uthmani'
limit 1;

-- Verse text of editions other than the one in quran_verses (which holds a single text). Written ONLY by an import
-- job (no API grants), only for an edition whose permission allows it, and never edited.
create table public.quran_edition_verses (
  edition_id uuid not null references public.quran_text_editions (id) on delete restrict,
  surah smallint not null check (surah between 1 and 114),
  ayah smallint not null check (ayah between 1 and 286),
  text_ar text not null check (char_length(text_ar) > 0),
  primary key (edition_id, surah, ayah)
);
create or replace function public.guard_quran_edition_verse()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'edition verses are immutable; import a new edition instead' using errcode = 'P0001';
  end if;
  if not public.quran_edition_allowed(new.edition_id) then
    raise exception 'this edition''s licence does not allow importing its text' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger quran_edition_verses_guard before insert or update on public.quran_edition_verses for each row execute function public.guard_quran_edition_verse();

-- The Arabic of an ayah in a given edition: quran_edition_verses, or quran_verses when the edition's version is the one stored there.
create or replace function public.quran_edition_ayah(eid uuid, s smallint, a smallint)
returns text language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select text_ar from public.quran_edition_verses where edition_id = eid and surah = s and ayah = a),
    (select v.text_ar from public.quran_verses v join public.quran_text_editions e on e.id = eid
       where v.surah_id = s and v.ayah_no = a and v.source_version_id = e.source_version_id));
$$;

-- ---------- Transmission routes (turuq): editor-entered with citations; none seeded ----------
create table public.transmission_routes (
  id uuid primary key default gen_random_uuid(),
  riwayah_id text not null references public.riwayat (id) on delete restrict,
  name_translit text not null check (char_length(name_translit) between 2 and 200),
  name_ar text check (char_length(name_ar) <= 200),
  description text check (char_length(description) <= 4000),
  claim_id uuid references public.evidence_claims (id) on delete restrict,
  source_id uuid references public.sources (id) on delete restrict,
  locator text check (char_length(locator) <= 500),
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (claim_id is not null or (source_id is not null and locator is not null)) -- every route carries its citation
);

-- ---------- Misconceptions: a question answered only by an approved evidence claim ----------
create table public.qiraat_misconceptions (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 5 and 300),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 100),
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Variants ----------
create table public.qiraat_variants (
  id uuid primary key default gen_random_uuid(),
  surah smallint not null check (surah between 1 and 114),
  ayah smallint not null check (ayah between 1 and 286),
  word_position smallint not null check (word_position between 1 and 200),
  kind text not null check (kind in ('pronunciation', 'vocalization', 'morphology', 'word_form', 'meaning')),
  editor_note text check (char_length(editor_note) <= 2000), -- internal; public explanation comes only from approved claims
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index qiraat_variants_ref on public.qiraat_variants (surah, ayah, word_position);

create table public.qiraat_variant_readings (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.qiraat_variants (id) on delete cascade,
  riwayah_id text not null references public.riwayat (id) on delete restrict,
  edition_id uuid not null references public.quran_text_editions (id) on delete restrict,
  reading_text text not null check (char_length(reading_text) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (variant_id, riwayah_id)
);

create table public.qiraat_variant_claims (
  variant_id uuid not null references public.qiraat_variants (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  position smallint not null default 1 check (position between 1 and 20),
  primary key (variant_id, claim_id)
);

create or replace function public.guard_variant_reading()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  vid uuid := coalesce(new.variant_id, old.variant_id);
  v public.qiraat_variants := (select x from public.qiraat_variants x where x.id = vid);
  e public.quran_text_editions;
  verse text;
begin
  if v.status = 'published' then
    raise exception 'a published variant''s readings cannot change; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  select * into e from public.quran_text_editions where id = new.edition_id;
  if e.riwayah_id <> new.riwayah_id then
    raise exception 'a reading of % must come from an edition of %, not %', new.riwayah_id, new.riwayah_id, e.riwayah_id using errcode = 'P0001';
  end if;
  if not public.quran_edition_allowed(e.id) then
    raise exception 'the edition''s licence does not allow using its text (needs APPROVED, or CONDITIONAL with attribution recorded)' using errcode = 'P0001';
  end if;
  verse := public.quran_edition_ayah(e.id, v.surah, v.ayah);
  if verse is null or strpos(verse, new.reading_text) = 0 then
    raise exception 'the reading must be copied from the edition''s text of %:%, and it is not found there', v.surah, v.ayah using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger qiraat_variant_readings_guard before insert or update or delete on public.qiraat_variant_readings for each row execute function public.guard_variant_reading();

create or replace function public.guard_variant_claim()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.qiraat_variants where id = coalesce(new.variant_id, old.variant_id) and status = 'published') then
    raise exception 'a published variant''s explanation claims cannot change; move it to correction first' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger qiraat_variant_claims_guard before insert or update or delete on public.qiraat_variant_claims for each row execute function public.guard_variant_claim();

create or replace function public.guard_qiraat_variant()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published variant cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'published'
     and to_jsonb(new) - 'updated_at' - 'status' - 'version' <> to_jsonb(old) - 'updated_at' - 'status' - 'version' then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'a variant is published only after its readings, claims and review exist' using errcode = 'P0001';
  end if;
  if (select count(distinct riwayah_id) from public.qiraat_variant_readings where variant_id = new.id) < 2 then
    raise exception 'a variant needs readings from at least two riwayat' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.qiraat_variant_readings r where r.variant_id = new.id and not public.quran_edition_allowed(r.edition_id)) then
    raise exception 'every reading''s edition must be APPROVED, or CONDITIONAL with attribution recorded' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.qiraat_variant_claims where variant_id = new.id) then
    raise exception 'no evidence, no publish: a variant needs an explanation claim' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.qiraat_variant_claims vc join public.evidence_claims c on c.id = vc.claim_id
             where vc.variant_id = new.id and c.status not in ('approved', 'published')) then
    raise exception 'no evidence, no publish: every explanation claim must be approved' using errcode = 'P0001';
  end if;
  if not public.latest_review_approved('qiraat_variant', new.id) then
    raise exception 'no review, no publish: the variant needs a scholarly approval' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger qiraat_variants_guard before insert or update on public.qiraat_variants for each row execute function public.guard_qiraat_variant();

-- ---------- Reciters and recordings ----------
create table public.reciters (
  id uuid primary key default gen_random_uuid(),
  name_translit text not null check (char_length(name_translit) between 2 and 200),
  name_ar text check (char_length(name_ar) <= 200),
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audio_recordings (
  id uuid primary key default gen_random_uuid(),
  reciter_id uuid not null references public.reciters (id) on delete restrict,
  riwayah_id text not null references public.riwayat (id) on delete restrict,
  source_id uuid not null references public.sources (id) on delete restrict,
  permission_id uuid not null references public.content_permissions (id) on delete restrict,
  surah smallint check (surah between 1 and 114), -- null: a whole-Quran stream
  url text not null check (url ~ '^https://'),
  url_kind text not null default 'file' check (url_kind in ('file', 'stream')),
  shown_with_edition_id uuid references public.quran_text_editions (id) on delete restrict,
  is_comparison boolean not null default false,
  comparison_note text check (char_length(comparison_note) <= 2000),
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_comparison or char_length(comparison_note) >= 20)
);
create index audio_recordings_lookup on public.audio_recordings (riwayah_id, surah);

create or replace function public.guard_audio_recording()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  p public.content_permissions := (select x from public.content_permissions x where x.id = new.permission_id);
  text_riwayah text := (select riwayah_id from public.quran_text_editions where id = new.shown_with_edition_id);
begin
  if p.asset_type <> 'recording' or p.source_id <> new.source_id then
    raise exception 'a recording needs the recording permission of its own source' using errcode = 'P0001';
  end if;
  if p.riwayah_id is not null and p.riwayah_id <> new.riwayah_id then
    raise exception 'the permission covers riwayah %, not %', p.riwayah_id, new.riwayah_id using errcode = 'P0001';
  end if;
  if text_riwayah is not null and text_riwayah <> new.riwayah_id and not (new.is_comparison and new.comparison_note is not null) then
    raise exception 'riwayah mismatch: a % recording cannot be shown with a % text unless it is an explained educational comparison', new.riwayah_id, text_riwayah using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published recording cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.content_permission_allowed(new.permission_id) then
      raise exception 'the recording''s permission does not allow display (needs APPROVED, or CONDITIONAL with attribution recorded)' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.reciters where id = new.reciter_id and status = 'published') then
      raise exception 'publish the reciter first' using errcode = 'P0001';
    end if;
    if not public.latest_review_approved('audio_recording', new.id) then
      raise exception 'no review, no publish: the recording needs a scholarly approval' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger audio_recordings_guard before insert or update on public.audio_recordings for each row execute function public.guard_audio_recording();

create trigger transmission_routes_guard before insert or update on public.transmission_routes for each row execute function public.qiraat_guard_reviewed('transmission_route');
create trigger reciters_guard before insert or update on public.reciters for each row execute function public.qiraat_guard_reviewed('reciter');

-- A transmission route citing a claim needs that claim approved before it is published.
create or replace function public.guard_route_claim()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'published' and new.claim_id is not null
     and not exists (select 1 from public.evidence_claims where id = new.claim_id and status in ('approved', 'published')) then
    raise exception 'no evidence, no publish: the record''s claim is not approved' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger transmission_routes_claim before insert or update on public.transmission_routes for each row execute function public.guard_route_claim();
create trigger qiraat_misconceptions_guard before insert or update on public.qiraat_misconceptions for each row execute function public.qiraat_guard_reviewed('qiraat_misconception');
create trigger qiraat_misconceptions_claim before insert or update on public.qiraat_misconceptions for each row execute function public.guard_route_claim();

do $$
declare t text;
begin
  foreach t in array array['transmission_routes', 'qiraat_misconceptions', 'qiraat_variants', 'qiraat_variant_readings', 'qiraat_variant_claims', 'reciters', 'audio_recordings'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
  end loop;
end $$;

-- A reviewer may not approve a qiraat record they created (the shared check covers claims only).
create or replace function public.qiraat_check_self_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  tbl text := case new.entity_type when 'transmission_route' then 'transmission_routes' when 'qiraat_variant' then 'qiraat_variants'
    when 'reciter' then 'reciters' when 'audio_recording' then 'audio_recordings' when 'qiraat_misconception' then 'qiraat_misconceptions' end;
  author uuid;
begin
  if tbl is null then
    return new;
  end if;
  execute format('select created_by from public.%I where id = $1', tbl) into author using new.entity_id;
  if author is not null and author = new.reviewer_id then
    raise exception 'a reviewer cannot review their own record' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger editorial_reviews_qiraat_self before insert on public.editorial_reviews for each row execute function public.qiraat_check_self_review();

revoke execute on function public.guard_quran_text_edition(), public.guard_quran_edition_verse(), public.guard_variant_reading(), public.guard_variant_claim(),
  public.guard_qiraat_variant(), public.guard_audio_recording(), public.guard_route_claim(), public.qiraat_check_self_review(),
  public.qiraat_guard_reviewed(), public.qiraat_guard_reference() from public, anon, authenticated;

-- ---------- RLS ----------
create or replace function public.qiraat_variant_public(vid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.qiraat_variants where id = vid and status = 'published')
    and not exists (select 1 from public.qiraat_variant_readings r where r.variant_id = vid and not public.quran_edition_allowed(r.edition_id));
$$;

alter table public.quran_text_editions enable row level security;
alter table public.quran_text_editions force row level security;
revoke all on public.quran_text_editions from anon, authenticated;
grant select on public.quran_text_editions to anon, authenticated;
grant insert, update, delete on public.quran_text_editions to authenticated;
create policy read_all on public.quran_text_editions for select using (true); -- registry metadata, no text
create policy admin_write on public.quran_text_editions for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

alter table public.quran_edition_verses enable row level security;
alter table public.quran_edition_verses force row level security;
revoke all on public.quran_edition_verses from anon, authenticated;
grant select on public.quran_edition_verses to anon, authenticated;
create policy read_allowed on public.quran_edition_verses for select using (public.quran_edition_allowed(edition_id));

do $$
declare t text;
begin
  foreach t in array array['transmission_routes', 'qiraat_misconceptions', 'qiraat_variants', 'reciters', 'audio_recordings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
end $$;
create policy read_published on public.transmission_routes for select using (public.is_staff() or status = 'published');
-- A variant is public only while published AND every reading's edition still allows display.
create policy read_published on public.qiraat_variants for select using (public.is_staff() or public.qiraat_variant_public(id));
create policy read_published on public.qiraat_misconceptions for select using (public.is_staff() or status = 'published');
create policy read_published on public.reciters for select using (public.is_staff() or status = 'published');
-- A recording is public only while published AND its permission still allows display (a downgrade hides it at once).
create policy read_published on public.audio_recordings for select using (public.is_staff() or (status = 'published' and public.content_permission_allowed(permission_id)));

do $$
declare t text;
begin
  foreach t in array array['qiraat_variant_readings', 'qiraat_variant_claims'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy read_with_parent on public.%I for select using (public.is_staff() or public.qiraat_variant_public(variant_id))', t);
    execute format('create policy editor_write on public.%I for all to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
  end loop;
end $$;
