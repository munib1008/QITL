set search_path = public, extensions;

-- Qira'at & Ahruf Learning Centre, part 1: the ten canonical readers (al-Qurra') and their twenty transmitters (al-Ruwat).
--
-- Reference rows only: Arabic and transliterated NAMES, seeded as DRAFT. No dates, no biographies, no chains of
-- transmission and no readings. They become public only after a scholarly reviewer approves each row and an editor
-- publishes it (the guard below). Review entity types are registered in review_entity_types; the shared
-- editorial_reviews constraints are not touched.

insert into public.review_entity_types (type, module) values
  ('qiraat_reader', 'qiraat'), ('qiraat_riwayah', 'qiraat'), ('transmission_route', 'qiraat'),
  ('qiraat_variant', 'qiraat'), ('reciter', 'qiraat'), ('audio_recording', 'qiraat'), ('qiraat_misconception', 'qiraat');

create table public.qiraat (
  id text primary key check (id ~ '^[a-z_]{2,40}$'),
  position smallint not null unique check (position between 1 and 10),
  name_ar text not null check (char_length(name_ar) between 2 and 80),
  name_translit text not null check (char_length(name_translit) between 2 and 80),
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.riwayat (
  id text primary key check (id ~ '^[a-z_]{2,40}$'),
  qiraah_id text not null references public.qiraat (id) on delete restrict,
  position smallint not null check (position between 1 and 2),
  name_ar text not null check (char_length(name_ar) between 2 and 80),
  name_translit text not null check (char_length(name_translit) between 2 and 80),
  status public.publication_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (qiraah_id, position)
);

-- Names only, as listed in the brief (2026-10-31). Draft: pending scholarly review.
insert into public.qiraat (id, position, name_ar, name_translit) values
  ('nafi', 1, 'نافع', 'Nafi'''),
  ('ibn_kathir', 2, 'ابن كثير', 'Ibn Kathir'),
  ('abu_amr', 3, 'أبو عمرو', 'Abu ''Amr'),
  ('ibn_amir', 4, 'ابن عامر', 'Ibn ''Amir'),
  ('asim', 5, 'عاصم', '''Asim'),
  ('hamzah', 6, 'حمزة', 'Hamzah'),
  ('kisai', 7, 'الكسائي', 'al-Kisa''i'),
  ('abu_jafar', 8, 'أبو جعفر', 'Abu Ja''far'),
  ('yaqub', 9, 'يعقوب', 'Ya''qub'),
  ('khalaf_ashir', 10, 'خلف العاشر', 'Khalaf al-''Ashir');

insert into public.riwayat (id, qiraah_id, position, name_ar, name_translit) values
  ('qalun', 'nafi', 1, 'قالون', 'Qalun'),
  ('warsh', 'nafi', 2, 'ورش', 'Warsh'),
  ('bazzi', 'ibn_kathir', 1, 'البزي', 'al-Bazzi'),
  ('qunbul', 'ibn_kathir', 2, 'قنبل', 'Qunbul'),
  ('duri_abu_amr', 'abu_amr', 1, 'الدوري', 'al-Duri'),
  ('susi', 'abu_amr', 2, 'السوسي', 'al-Susi'),
  ('hisham', 'ibn_amir', 1, 'هشام', 'Hisham'),
  ('ibn_dhakwan', 'ibn_amir', 2, 'ابن ذكوان', 'Ibn Dhakwan'),
  ('shubah', 'asim', 1, 'شعبة', 'Shu''bah'),
  ('hafs', 'asim', 2, 'حفص', 'Hafs'),
  ('khalaf', 'hamzah', 1, 'خلف', 'Khalaf'),
  ('khallad', 'hamzah', 2, 'خلاد', 'Khallad'),
  ('abu_al_harith', 'kisai', 1, 'أبو الحارث', 'Abu al-Harith'),
  ('duri_kisai', 'kisai', 2, 'الدوري', 'al-Duri'),
  ('ibn_wardan', 'abu_jafar', 1, 'ابن وردان', 'Ibn Wardan'),
  ('ibn_jammaz', 'abu_jafar', 2, 'ابن جماز', 'Ibn Jammaz'),
  ('ruways', 'yaqub', 1, 'رويس', 'Ruways'),
  ('rawh', 'yaqub', 2, 'روح', 'Rawh'),
  ('ishaq', 'khalaf_ashir', 1, 'إسحاق', 'Ishaq'),
  ('idris', 'khalaf_ashir', 2, 'إدريس', 'Idris');

-- ---------- Shared helpers for the module ----------

-- Published rows cannot be edited in place; drafts bump updated_at. Publishing needs the latest scholarly review of
-- the row to be an approval (editorial_reviews, entity type given as the trigger argument).
create or replace function public.qiraat_guard_reviewed()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := tg_argv[0];
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published record cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.latest_review_approved(etype, new.id::uuid) then
      raise exception 'no review, no publish: % % needs a scholarly approval', etype, new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- The text-id tables (qiraat, riwayat) are reviewed under a uuid derived from their id, so editorial_reviews (uuid)
-- can hold them: public.qiraat_ref_uuid('riwayah', 'hafs').
create or replace function public.qiraat_ref_uuid(kind text, ref text)
returns uuid language sql immutable as $$
  select (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4) || '-' || substr(h, 17, 4) || '-' || substr(h, 21, 12))::uuid
  from (select md5('qiraat:' || kind || ':' || ref) as h) x;
$$;

create or replace function public.qiraat_guard_reference()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := tg_argv[0];
  kind text := case etype when 'qiraat_reader' then 'reader' else 'riwayah' end;
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published record cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'reference ids are permanent' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not public.latest_review_approved(etype, public.qiraat_ref_uuid(kind, new.id)) then
      raise exception 'no review, no publish: % % needs a scholarly approval', etype, new.id using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger qiraat_guard before insert or update on public.qiraat for each row execute function public.qiraat_guard_reference('qiraat_reader');
create trigger riwayat_guard before insert or update on public.riwayat for each row execute function public.qiraat_guard_reference('qiraat_riwayah');
create trigger qiraat_audit after insert or update or delete on public.qiraat for each row execute function public.audit();
create trigger riwayat_audit after insert or update or delete on public.riwayat for each row execute function public.audit();

do $$
declare t text;
begin
  foreach t in array array['qiraat', 'riwayat'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update on public.%I to authenticated', t);
    execute format('create policy read_published on public.%I for select using (status = ''published'' or public.is_staff())', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
  end loop;
end $$;
