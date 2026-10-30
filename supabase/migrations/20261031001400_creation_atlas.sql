-- The Creation Atlas (عالم الخلق): humans, jinn, Iblis and the shayatin, angels, animals, the heavens and the earth.
-- Every factual row carries an evidence class (what revelation establishes, what authentic hadith adds, what scholars
-- interpret, what is not established), a claim when it states something, a scholarly approval and a version.
-- Visuals are abstract, environmental or diagrammatic: never a figure of a prophet, an angel, a jinn or the unseen.

create table public.creation_categories (
  id text primary key check (id in ('humans', 'jinn', 'iblis_shayatin', 'angels', 'animals', 'heavens_earth')),
  name_en text not null,
  name_ar text not null,
  position smallint not null unique
);
insert into public.creation_categories (id, name_en, name_ar, position) values
  ('humans', 'Human beings', 'الإنس', 1),
  ('jinn', 'Jinn', 'الجن', 2),
  ('iblis_shayatin', 'Iblis and the shayatin', 'إبليس والشياطين', 3),
  ('angels', 'Angels', 'الملائكة', 4),
  ('animals', 'Animals in the Quran', 'الحيوان في القرآن', 5),
  ('heavens_earth', 'The heavens, the earth and other creations', 'السماوات والأرض', 6);

create table public.creation_profiles (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.creation_categories (id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_en text not null,
  name_ar text not null,
  classification text,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.creation_profile_public(pid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.creation_profiles where id = pid and status = 'published');
$$;

-- Items share one shape. field_key (on characteristics) covers the profile template's single-value fields.
do $$
declare t text;
begin
  foreach t in array array['creation_characteristics', 'creation_abilities', 'creation_limitations', 'creation_interactions',
    'creation_lessons', 'creation_misconceptions', 'creation_source_references'] loop
    execute format($f$
      create table public.%I (
        id uuid primary key default gen_random_uuid(),
        profile_id uuid not null references public.creation_profiles (id) on delete cascade,
        position smallint not null default 1,
        title text,
        body_md text not null default '',
        known boolean not null default true,
        evidence_class text not null check (evidence_class in ('revelation', 'authentic_hadith', 'scholarly_interpretation', 'not_established')),
        claim_id uuid references public.evidence_claims (id),
        version integer not null default 1,
        status public.publication_status not null default 'draft',
        created_by uuid references auth.users (id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (known = (evidence_class <> 'not_established')),
        check (not known or claim_id is not null)
      )$f$, t);
  end loop;
end $$;
alter table public.creation_characteristics add column field_key text not null default 'nature' check (field_key in (
  'origin', 'purpose', 'nature', 'relationship_with_humans', 'chronological_position', 'location', 'vocabulary'));
alter table public.creation_misconceptions add column question text not null default '' check (char_length(question) > 0 or status = 'draft');
alter table public.creation_lessons add column everyday_application text;

-- The knowledge graph: every edge rests on evidence and a review.
create table public.creation_relationships (
  id uuid primary key default gen_random_uuid(),
  from_kind text not null check (from_kind in ('creation', 'person', 'event', 'command', 'community', 'concept')),
  from_ref text not null,
  relation text not null check (char_length(relation) between 2 and 80),
  to_kind text not null check (to_kind in ('creation', 'person', 'event', 'command', 'community', 'concept')),
  to_ref text not null,
  claim_id uuid not null references public.evidence_claims (id),
  evidence_class text not null check (evidence_class in ('revelation', 'authentic_hadith', 'scholarly_interpretation')),
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creation_stories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.creation_profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null,
  title_ar text,
  summary text,
  script_id uuid references public.story_scripts (id) on delete set null, -- narrated through the story engine
  claim_id uuid references public.evidence_claims (id),
  position smallint not null default 1,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creation_visual_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.creation_profiles (id) on delete cascade,
  story_id uuid references public.creation_stories (id) on delete cascade,
  kind text not null check (kind in ('abstract', 'environmental', 'diagram', 'calligraphic')),
  asset_id uuid references public.assets (id),
  animation_key text,
  alt_text text not null check (char_length(alt_text) >= 3),
  depicts_unseen boolean not null default false check (depicts_unseen = false), -- never a literal angel, jinn, Iblis or the unseen
  status public.publication_status not null default 'draft',
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(asset_id, animation_key) = 1),
  check (num_nonnulls(profile_id, story_id) >= 1),
  check (status <> 'published' or approved_by is not null)
);

-- ---------- Publishing ----------
create or replace function public.guard_creation_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  cid uuid := (to_jsonb(new) ->> 'claim_id')::uuid;
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'published' and to_jsonb(new) - 'updated_at' - 'status' <> to_jsonb(old) - 'updated_at' - 'status' then
    raise exception 'a published creation entry cannot be edited in place; move it to correction first' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'published' and to_jsonb(new) - 'updated_at' - 'status' - 'version' <> to_jsonb(old) - 'updated_at' - 'status' - 'version' then
    new.version := old.version + 1;
  end if;
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  if cid is not null and not exists (select 1 from public.evidence_claims where id = cid and status in ('approved', 'published')) then
    raise exception 'no evidence, no publish: claim % is not approved', cid using errcode = 'P0001';
  end if;
  if tg_table_name = 'creation_profiles' then
    if not exists (select 1 from public.creation_characteristics where profile_id = new.id and status = 'published') then
      raise exception 'a profile needs at least one published, evidenced entry before it is published' using errcode = 'P0001';
    end if;
  end if;
  if not public.latest_review_approved('creation', new.id) then
    raise exception 'no review, no publish: % % lacks a scholarly approval', tg_table_name, new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.guard_creation_publish() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['creation_profiles', 'creation_characteristics', 'creation_abilities', 'creation_limitations', 'creation_interactions',
    'creation_lessons', 'creation_misconceptions', 'creation_source_references', 'creation_relationships', 'creation_stories', 'creation_visual_assets'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.guard_creation_publish()', t || '_guard', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit()', t || '_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    execute format('create policy staff_update on public.%I for update to authenticated using (public.has_role(''editor'') or public.has_role(''scholarly_reviewer'')) with check (public.has_role(''editor'') or public.has_role(''scholarly_reviewer''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
  -- Items are public only when they and their profile are published.
  foreach t in array array['creation_characteristics', 'creation_abilities', 'creation_limitations', 'creation_interactions',
    'creation_lessons', 'creation_misconceptions', 'creation_source_references'] loop
    execute format('create policy read_published on public.%I for select using (public.is_staff() or (status = ''published'' and public.creation_profile_public(profile_id)))', t);
  end loop;
end $$;
create policy read_published on public.creation_profiles for select using (public.is_staff() or status = 'published');
create policy read_published on public.creation_relationships for select using (public.is_staff() or status = 'published');
create policy read_published on public.creation_stories for select using (public.is_staff() or status = 'published');
create policy read_published on public.creation_visual_assets for select using (public.is_staff() or status = 'published');

alter table public.creation_categories enable row level security;
alter table public.creation_categories force row level security;
revoke all on public.creation_categories from anon, authenticated;
grant select on public.creation_categories to anon, authenticated;
create policy read_all on public.creation_categories for select using (true);
