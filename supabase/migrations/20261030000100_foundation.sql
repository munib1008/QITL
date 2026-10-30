-- ZIQ foundation: extensions, enums, profiles, roles and the helpers every RLS policy uses.
-- Runs on Supabase (auth schema provided) and on the PGlite test harness (auth schema stubbed in tests/db/harness.ts).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists postgis;

-- ---------- Enums ----------
create type public.evidence_kind as enum ('quran', 'hadith', 'scholar', 'estimate', 'disputed', 'unknown');
create type public.publication_status as enum ('draft', 'in_review', 'approved', 'published', 'correction', 'rejected', 'archived');
create type public.date_precision as enum ('exact', 'range', 'estimated', 'relative', 'unknown');
create type public.geometry_precision as enum ('point', 'region', 'route', 'hypothesis', 'unknown');
create type public.rights_status as enum ('unknown', 'requested', 'cleared', 'denied', 'public_domain');
create type public.app_role as enum ('user', 'moderator', 'editor', 'scholarly_reviewer', 'admin');
create type public.content_type as enum ('journey_stop', 'story', 'chapter', 'quran_verse', 'hadith', 'event', 'place', 'person');

-- ---------- Profiles (separate from auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Reader' check (char_length(display_name) between 1 and 60),
  locale text not null default 'en' check (locale in ('en', 'ar', 'ur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles beyond 'user'. Scholar identity and credentials are verified by an admin, by hand, before a role is granted.
create table public.role_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null check (role <> 'user'),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  credential_note text check (char_length(credential_note) <= 500),
  primary key (user_id, role)
);

-- ---------- Helpers ----------
create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    r = 'user' or exists (
      select 1 from public.role_assignments ra
      where ra.user_id = auth.uid() and (ra.role = r or ra.role = 'admin')
    )
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = auth.uid() and ra.role in ('editor', 'scholarly_reviewer', 'admin')
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- ---------- Audit log (append-only; written by triggers; never contains private note bodies) ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  changes jsonb,
  at timestamptz not null default now()
);
create index audit_logs_entity on public.audit_logs (entity_type, entity_id, at desc);

create or replace function public.audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  old_rec jsonb;
  diff jsonb;
begin
  rec := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_rec := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', old_rec -> k, 'to', rec -> k)) into diff
    from jsonb_object_keys(rec) k where rec -> k is distinct from old_rec -> k;
  else
    diff := coalesce(rec, old_rec);
  end if;
  insert into public.audit_logs (actor, action, entity_type, entity_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(rec ->> 'id', old_rec ->> 'id', rec ->> 'user_id', old_rec ->> 'user_id', '?'), diff);
  return coalesce(new, old);
end $$;

create trigger role_assignments_audit after insert or update or delete on public.role_assignments
  for each row execute function public.audit();
