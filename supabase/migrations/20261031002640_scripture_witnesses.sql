set search_path = public, extensions;

-- Ancient scriptures research layer (docs/LINEAGE.md): a registry of earlier-scripture textual witnesses for COMPARATIVE
-- research. It is a reference table, not a library: it holds a name, a language, a broad scholarly dating (or nothing),
-- a short description and a mandatory LIMITATION. It never stores the text of any scripture, and no row says that a
-- surviving manuscript is the original Tawrah, Zabur or Injil. A genealogical claim may cite a witness
-- (claim_references.kind = 'scripture') with an exact locator; such a claim is displayed as "ancient biblical
-- manuscripts" evidence, which is an earlier-scripture textual witness and NOT independently authenticated Islamic
-- revelation. Publishing a witness needs a scholarly review plus the historical/scientific review pathway.

-- ---------- 1. The registry ----------
create table public.scripture_witnesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$' and char_length(slug) between 3 and 80),
  layer text not null check (layer in ('tawrah', 'zabur', 'injil')),
  kind text not null check (kind in ('manuscript_tradition', 'manuscript_collection', 'translation_tradition', 'codex', 'papyri')),
  name_en text not null check (char_length(name_en) between 3 and 160),
  name_ar text check (name_ar is null or char_length(name_ar) between 2 and 160),
  name_ur text check (name_ur is null or char_length(name_ur) between 2 and 160),
  language text not null check (char_length(language) between 2 and 120),
  -- A BROAD scholarly range, or nothing. NULL is shown as "Not established"; a date is never guessed.
  dating_note text check (dating_note is null or char_length(dating_note) between 3 and 300),
  what_it_is text not null check (char_length(btrim(what_it_is)) between 20 and 700),
  -- Mandatory: what this witness cannot show.
  limitation text not null check (char_length(btrim(limitation)) between 40 and 700),
  sort_order smallint not null default 0,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No scripture text is stored: the descriptive columns carry no Hebrew, Greek or Arabic script (the names in
  -- name_ar / name_ur are the only Arabic-script columns, and are limited to 160 characters).
  check (what_it_is !~ '[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]'),
  check (limitation !~ '[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]'),
  check (name_en !~ '[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]'),
  check (dating_note is null or dating_note !~ '[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]'),
  check (language !~ '[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]')
);
create index scripture_witnesses_layer on public.scripture_witnesses (layer, sort_order);
create trigger scripture_witnesses_touch before update on public.scripture_witnesses for each row execute function public.touch_updated_at();
create trigger scripture_witnesses_audit after insert or update or delete on public.scripture_witnesses for each row execute function public.audit();

-- ---------- 2. Historical/scientific review pathway ----------
create table public.scripture_historical_reviews (
  id uuid primary key default gen_random_uuid(),
  witness_id uuid not null references public.scripture_witnesses (id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
create index scripture_historical_reviews_witness on public.scripture_historical_reviews (witness_id, created_at desc);
create trigger scripture_historical_reviews_audit after insert on public.scripture_historical_reviews for each row execute function public.audit();

create or replace function public.check_scripture_historical_reviewer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.role_assignments where user_id = new.reviewer_id and role in ('science_reviewer', 'admin')) then
    raise exception 'only a historical/scientific reviewer may sign the historical review of a scripture witness' using errcode = '42501';
  end if;
  if exists (select 1 from public.scripture_witnesses w where w.id = new.witness_id and w.created_by = new.reviewer_id) then
    raise exception 'a reviewer cannot review their own record' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger scripture_historical_reviews_check before insert on public.scripture_historical_reviews for each row execute function public.check_scripture_historical_reviewer();

create or replace function public.scripture_historical_approved(wid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select decision = 'approved' from public.scripture_historical_reviews where witness_id = wid order by created_at desc, id desc limit 1), false);
$$;

-- ---------- 3. Publish guard and freeze ----------
create or replace function public.lineage_freeze_published()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published'
     and (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'a published % is fixed: move it to correction first', tg_table_name using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger scripture_witnesses_freeze before update on public.scripture_witnesses for each row execute function public.lineage_freeze_published();

create or replace function public.guard_scripture_witness_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  if not public.latest_review_approved('scripture_witness', new.id) then
    raise exception 'no review, no publish: scripture witness % lacks a scholarly approval', new.id using errcode = 'P0001';
  end if;
  if not public.scripture_historical_approved(new.id) then
    raise exception 'no review, no publish: scripture witness % lacks the historical review', new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger scripture_witnesses_guard before insert or update on public.scripture_witnesses for each row execute function public.guard_scripture_witness_publish();

-- ---------- 4. Claims may cite a witness, with an exact locator ----------
alter table public.claim_references add column scripture_witness_id uuid references public.scripture_witnesses (id) on delete restrict;
alter table public.claim_references drop constraint claim_references_kind_check;
alter table public.claim_references add constraint claim_references_kind_check check (kind in ('quran', 'hadith', 'tafsir', 'history', 'scholar', 'scripture'));
-- A scripture citation names a witness AND an exact place in it (book, chapter, verse or folio: it must contain a
-- number). No text of the passage is stored: the note is a short pointer, never a quotation.
alter table public.claim_references add constraint claim_references_scripture_check check (
  (kind = 'scripture') = (scripture_witness_id is not null)
  and (kind <> 'scripture' or (locator is not null and locator ~ '[0-9]' and char_length(locator) between 3 and 200 and locator !~ '[֐-׿Ͱ-Ͽἀ-῿؀-ۿ]'))
  and (kind <> 'scripture' or note is null or char_length(note) <= 300)
);

-- A claim that cites an earlier-scripture witness cites only PUBLISHED witnesses when it is approved.
create or replace function public.guard_claim_scripture_witnesses()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status in ('approved', 'published') and (tg_op = 'INSERT' or old.status is distinct from new.status) and exists (
    select 1 from public.claim_references r join public.scripture_witnesses w on w.id = r.scripture_witness_id
    where r.claim_id = new.id and w.status <> 'published'
  ) then
    raise exception 'a claim that cites a scripture witness cites only published witnesses' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger evidence_claims_scripture_guard before insert or update on public.evidence_claims for each row execute function public.guard_claim_scripture_witnesses();

-- ---------- 5. Row-level security ----------
alter table public.scripture_witnesses enable row level security;
alter table public.scripture_historical_reviews enable row level security;
alter table public.scripture_witnesses force row level security;
alter table public.scripture_historical_reviews force row level security;

revoke all on public.scripture_witnesses, public.scripture_historical_reviews from anon, authenticated;
grant select on public.scripture_witnesses to anon, authenticated;
grant insert, update, delete on public.scripture_witnesses to authenticated;
grant select, insert on public.scripture_historical_reviews to authenticated;

create policy read_published on public.scripture_witnesses for select using (status = 'published' or public.event_universe_staff());
create policy editor_insert on public.scripture_witnesses for insert to authenticated
  with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.scripture_witnesses for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.scripture_witnesses for delete to authenticated
  using (public.has_role('admin') and status <> 'published');

create policy staff_read on public.scripture_historical_reviews for select to authenticated using (public.event_universe_staff());
create policy reviewer_insert on public.scripture_historical_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.has_role('science_reviewer'));

-- ---------- 6. Review type and author registration ----------
insert into public.review_entity_types (type, module) values ('scripture_witness', 'lineage');
insert into public.review_entity_authors (entity_type, table_name, author_column) values ('scripture_witness', 'scripture_witnesses', 'created_by');
create trigger a0_stamp_author before insert or update on public.scripture_witnesses for each row execute function public.stamp_author('created_by');

revoke execute on function public.check_scripture_historical_reviewer(), public.guard_scripture_witness_publish(),
  public.guard_claim_scripture_witnesses(), public.lineage_freeze_published() from public, anon, authenticated;
