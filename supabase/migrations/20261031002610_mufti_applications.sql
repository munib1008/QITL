-- Scholar application (backlog 27b). Anyone signed in may ask to be considered as a mufti. An application is a request to
-- STAFF: it grants no role, creates no profile and verifies nothing. Status runs submitted -> under_review ->
-- verified | declined and is moved only by an administrator; a verified application only tells the administrator
-- who to look at, the mufti role and the profile verification (mufti_profiles) stay separate administrator actions.

create or replace function public.https_links_ok(l text[])
returns boolean language sql immutable as $$
  select cardinality(l) <= 5 and not exists (select 1 from unnest(l) u where u !~ '^https://[^[:space:]<>"]{4,250}$');
$$;

create table public.mufti_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  applicant_name text not null check (char_length(applicant_name) between 2 and 120),
  credentials_md text not null check (char_length(credentials_md) between 20 and 5000), -- ijazah, institutions, positions, as stated
  madhhab text check (madhhab in ('hanafi', 'maliki', 'shafii', 'hanbali', 'other')),
  field text check (field is null or char_length(field) between 2 and 120),
  links text[] not null default '{}' check (public.https_links_ok(links)),
  consent_version text not null check (char_length(consent_version) between 1 and 20),
  consented_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'verified', 'declined')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  handled_by uuid references auth.users (id),
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('verified', 'declined') or char_length(coalesce(decision_note, '')) >= 4)
);
create unique index mufti_applications_one_open on public.mufti_applications (applicant_id) where status in ('submitted', 'under_review');
create index mufti_applications_status on public.mufti_applications (status, created_at);

create or replace function public.guard_mufti_application()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if new.applicant_id is distinct from auth.uid() then raise exception 'an application is made in your own name' using errcode = '42501'; end if;
    if public.is_banned(new.applicant_id) then raise exception 'applications are suspended for this account' using errcode = '42501'; end if;
    if public.is_verified_mufti(new.applicant_id) then raise exception 'you are already a verified mufti' using errcode = 'P0001'; end if;
    perform public.throttle('mufti_application', 2, 3);
    new.status := 'submitted';
    new.decision_note := null;
    new.handled_by := null;
    new.status_changed_at := null;
    new.consented_at := now();
    return new;
  end if;
  -- UPDATE: administrators only, status and note only, along the one allowed path.
  if not public.has_role('admin') then raise exception 'only an administrator decides an application' using errcode = '42501'; end if;
  if (new.applicant_id, new.applicant_name, new.credentials_md, new.madhhab, new.field, new.links, new.consent_version, new.consented_at, new.created_at)
     is distinct from (old.applicant_id, old.applicant_name, old.credentials_md, old.madhhab, old.field, old.links, old.consent_version, old.consented_at, old.created_at) then
    raise exception 'the applicant''s submission cannot be edited' using errcode = 'P0001';
  end if;
  if not ((old.status = 'submitted' and new.status = 'under_review') or (old.status = 'under_review' and new.status in ('verified', 'declined'))) then
    raise exception 'an application moves submitted, under review, then verified or declined' using errcode = 'P0001';
  end if;
  new.handled_by := auth.uid();
  new.status_changed_at := now();
  new.updated_at := now();
  return new;
end $$;
create trigger mufti_applications_guard before insert or update on public.mufti_applications for each row execute function public.guard_mufti_application();

-- Audit: who moved which application to which status. Never the applicant's text. The applicant is told in-app.
create or replace function public.audit_mufti_application()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.audit_logs (actor, action, entity_type, entity_id, changes)
  values (auth.uid(), lower(tg_op), 'mufti_applications', new.id::text,
    case when tg_op = 'INSERT' then jsonb_build_object('status', new.status)
         else jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status)) end);
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.notifications (user_id, kind, channel, title, link) values (new.applicant_id, 'mufti_application', 'in_app', null, '/mufti/apply');
  end if;
  return new;
end $$;
create trigger mufti_applications_audit after insert or update on public.mufti_applications for each row execute function public.audit_mufti_application();
revoke execute on function public.guard_mufti_application(), public.audit_mufti_application() from public, anon, authenticated;

alter table public.mufti_applications enable row level security;
alter table public.mufti_applications force row level security;
revoke all on public.mufti_applications from anon, authenticated;
grant select, insert on public.mufti_applications to authenticated;
grant update (status, decision_note) on public.mufti_applications to authenticated;

create policy read_own_or_staff on public.mufti_applications for select to authenticated
  using (applicant_id = auth.uid() or public.has_role('moderator'));
create policy apply_self on public.mufti_applications for insert to authenticated
  with check (applicant_id = auth.uid() and status = 'submitted');
create policy admin_decide on public.mufti_applications for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
