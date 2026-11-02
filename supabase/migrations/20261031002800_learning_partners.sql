-- Learning Partners: a registration, directory and inquiry platform for Quran, Arabic and Islamic-education providers.
--
-- QITL is NOT a payment platform. Nothing here takes, holds, splits or invoices money: a price is a statement the
-- provider makes, shown with the line "Course arrangements, fees and payments are handled directly with the provider."
-- Provider text is the provider's own claim until a staff verification says otherwise, and the three verifications
-- (identity, qualifications, religious/scholarly) are separate: none implies another, and none vouches for teaching quality.
--
-- Who may do what:
--   anon / any visitor   approved listings, their published services, pricing, availability, PUBLIC contact methods, the
--                        qualification entries a provider chose to show, and verified verification kinds. Nothing else.
--   partner members      owner/admin: profile, contacts, services, documents, team; instructor: services, pricing,
--                        availability; inquiry_manager (with owner/admin): the inquiry inbox. Members never set a status.
--   learners             their own inquiries and messages; a report of a provider.
--   moderator / admin    review. listing_status moves only through partner_transition(): a moderator can request
--                        information or changes, start verification and suspend; ONLY an administrator approves or
--                        rejects, and nobody decides a listing they are a member of. Religious/scholarly verification is
--                        an administrator decision. Every staff decision and every staff look at private data is audited.
-- Columns with provider-private or staff-only content live in their own tables (partner_review_notes,
-- partner_qualification_files, contact methods flagged private) so a column grant never has to tell one reader from another.
-- Fixture and seed text is neutral; no ratings, reviews or statistics exist anywhere in this schema.

-- ---------- Shared checks ----------
create or replace function public.partner_codes_ok(c text[])
returns boolean language sql immutable as $$
  select c is not null and cardinality(c) between 1 and 12 and not exists (select 1 from unnest(c) x where x !~ '^[a-z]{2,3}$');
$$;

-- ---------- Taxonomy (admin-managed, trilingual) ----------
create table public.partner_service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  track text not null check (track in ('quran', 'arabic', 'islamic')),
  name_en text not null check (char_length(name_en) between 2 and 120),
  name_ar text not null check (char_length(name_ar) between 2 and 120),
  name_ur text not null check (char_length(name_ur) between 2 and 120),
  active boolean not null default true,
  sort_order integer not null default 100,
  merged_into uuid references public.partner_service_categories (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merged_into is null or merged_into <> id)
);
create trigger partner_categories_touch before update on public.partner_service_categories for each row execute function public.touch_updated_at();

-- ---------- Listings ----------
create table public.learning_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  provider_type text not null check (provider_type in ('islamic_institution', 'quran_center', 'arabic_institute', 'independent_quran_teacher',
    'independent_arabic_tutor', 'islamic_studies_educator', 'community_org', 'nonprofit_initiative', 'online_provider')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  country text not null check (country ~ '^[A-Z]{2}$'),
  city text check (city is null or char_length(city) between 1 and 80),
  service_area text check (service_area is null or char_length(service_area) between 2 and 200),
  languages text[] not null check (public.partner_codes_ok(languages)),
  short_description text check (short_description is null or char_length(short_description) between 20 and 280),
  long_description text check (long_description is null or char_length(long_description) <= 4000),
  years_experience smallint check (years_experience is null or years_experience between 0 and 80),
  listing_status text not null default 'draft' check (listing_status in ('draft', 'submitted', 'information_requested', 'under_verification',
    'approved', 'changes_requested', 'suspended', 'rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  first_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index learning_partners_directory on public.learning_partners (country, city) where listing_status = 'approved';
create index learning_partners_status on public.learning_partners (listing_status, submitted_at);

create table public.partner_members (
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'instructor', 'inquiry_manager')),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
create unique index partner_members_one_owner on public.partner_members (partner_id) where role = 'owner';
create index partner_members_user on public.partner_members (user_id);

-- ---------- Visibility helpers (boolean only; used inside policies) ----------
create or replace function public.partner_has_role(p_partner uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select auth.uid() is not null and p_partner is not null and exists (
    select 1 from public.partner_members m where m.partner_id = p_partner and m.user_id = auth.uid() and m.role = any (p_roles));
$$;
create or replace function public.partner_is_member(p_partner uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.partner_has_role(p_partner, array['owner', 'admin', 'instructor', 'inquiry_manager']);
$$;
create or replace function public.partner_is_approved(p_partner uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select lp.listing_status = 'approved' from public.learning_partners lp where lp.id = p_partner), false);
$$;

-- ---------- Contact methods: private by default ----------
create table public.partner_contact_methods (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  kind text not null check (kind in ('email', 'phone', 'whatsapp', 'telegram', 'website', 'social', 'address')),
  label text check (label is null or char_length(label) <= 60),
  value text not null check (char_length(value) between 3 and 300),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'website' or value ~ '^https://[^[:space:]<>"]{4,250}$'),
  check (kind <> 'social' or value ~ '^https://[^[:space:]<>"]{4,250}$'),
  check (kind <> 'email' or value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
create index partner_contact_partner on public.partner_contact_methods (partner_id);

-- ---------- Services, pricing, availability ----------
create table public.partner_services (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  category_id uuid not null references public.partner_service_categories (id),
  title text not null check (char_length(title) between 3 and 140),
  description text check (description is null or char_length(description) <= 2000),
  level text not null default 'all_levels' check (level in ('beginner', 'intermediate', 'advanced', 'all_levels')),
  audience text not null default 'all' check (audience in ('all', 'children', 'teens', 'adults')),
  mode text not null check (mode in ('online', 'in_person', 'hybrid')),
  group_type text not null check (group_type in ('individual', 'group', 'both')),
  duration_minutes smallint check (duration_minutes is null or duration_minutes between 5 and 600),
  language text not null check (language ~ '^[a-z]{2,3}$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partner_services_partner on public.partner_services (partner_id, status);
create index partner_services_category on public.partner_services (category_id) where status = 'published';
create trigger partner_services_touch before update on public.partner_services for each row execute function public.touch_updated_at();

create or replace function public.partner_of_service(p_service uuid)
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select s.partner_id from public.partner_services s where s.id = p_service;
$$;

create or replace function public.partner_service_is_public(p_service uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.partner_services s join public.learning_partners lp on lp.id = s.partner_id
                 where s.id = p_service and s.status = 'published' and lp.listing_status = 'approved');
$$;

create table public.partner_service_pricing (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.partner_services (id) on delete cascade,
  pricing_type text not null check (pricing_type in ('free', 'per_class', 'hourly', 'monthly', 'course', 'package', 'donation', 'on_request')),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  amount numeric(10, 2) check (amount is null or (amount > 0 and amount <= 1000000)),
  unit text check (unit is null or unit in ('class', 'hour', 'month', 'course', 'package')),
  classes_included smallint check (classes_included is null or classes_included between 1 and 1000),
  registration_fee numeric(10, 2) check (registration_fee is null or (registration_fee >= 0 and registration_fee <= 1000000)),
  materials_fee numeric(10, 2) check (materials_fee is null or (materials_fee >= 0 and materials_fee <= 1000000)),
  fees_note text check (fees_note is null or char_length(fees_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- free, donation and on request carry no amount, currency, unit, included classes or fees.
  constraint partner_pricing_no_amount check (pricing_type not in ('free', 'donation', 'on_request') or
    (amount is null and currency is null and unit is null and classes_included is null and registration_fee is null and materials_fee is null)),
  -- every priced type states an amount in a currency, and the unit that goes with the type.
  constraint partner_pricing_priced check (pricing_type in ('free', 'donation', 'on_request') or
    (amount is not null and currency is not null and unit is not null and unit = case pricing_type when 'per_class' then 'class' when 'hourly' then 'hour'
       when 'monthly' then 'month' when 'course' then 'course' else 'package' end)),
  constraint partner_pricing_package check (pricing_type <> 'package' or coalesce(classes_included, 0) >= 2)
);
create index partner_pricing_service on public.partner_service_pricing (service_id);
create trigger partner_pricing_touch before update on public.partner_service_pricing for each row execute function public.touch_updated_at();

create table public.partner_service_availability (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.partner_services (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index partner_availability_service on public.partner_service_availability (service_id);

-- ---------- Qualifications and their private evidence ----------
create table public.partner_qualifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  kind text not null default 'certificate' check (kind in ('ijazah', 'degree', 'certificate', 'other')),
  title text not null check (char_length(title) between 3 and 160),
  issuer text check (issuer is null or char_length(issuer) between 2 and 160),
  year smallint check (year is null or year between 1900 and 2100),
  claim text check (claim is null or char_length(claim) <= 500),
  status text not null default 'unverified' check (status in ('unverified', 'verified', 'rejected')),
  show_publicly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partner_qualifications_partner on public.partner_qualifications (partner_id);

-- Evidence files live in the PRIVATE storage bucket partner-docs (migration ...002801). Only the path is here, and this
-- table is readable by the provider's owner/admin and staff only; there is no public document, ever.
create table public.partner_qualification_files (
  qualification_id uuid primary key references public.partner_qualifications (id) on delete cascade,
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$' and storage_path !~ '\.\.'),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = partner_id::text)
);

-- ---------- Verifications: three separate kinds ----------
create table public.partner_verifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  kind text not null check (kind in ('identity', 'qualifications', 'religious_scholarly')),
  status text not null default 'requested' check (status in ('requested', 'in_review', 'verified', 'rejected', 'revoked')),
  scope_statement text check (scope_statement is null or char_length(scope_statement) between 4 and 400), -- what exactly was checked
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (partner_id, kind),
  check (status <> 'verified' or (decided_at is not null and scope_statement is not null))
);

-- Messages from staff to the provider about a decision. Everything here is meant for the provider to read.
create table public.partner_review_notes (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  subject text not null check (subject ~ '^(listing|identity|qualifications|religious_scholarly|qualification:[0-9a-f-]{36})$'),
  note text not null check (char_length(note) between 4 and 1000),
  author uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index partner_review_notes_partner on public.partner_review_notes (partner_id, created_at desc);

-- ---------- Inquiries ----------
create table public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  service_id uuid references public.partner_services (id) on delete set null,
  learner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_alias text check (learner_alias is null or char_length(learner_alias) between 1 and 40), -- how the learner wants to be addressed
  for_child boolean not null default false,                                                       -- a parent or guardian writes for a child
  subject text not null check (char_length(subject) between 3 and 140),
  message text not null check (char_length(message) between 10 and 2000),
  consent boolean not null check (consent),                                                      -- the learner agreed to share this with the provider
  consent_version text not null check (char_length(consent_version) between 1 and 20),
  consented_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'viewed', 'responded', 'follow_up', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partner_inquiries_partner on public.partner_inquiries (partner_id, status, created_at desc);
create index partner_inquiries_learner on public.partner_inquiries (learner_id, created_at desc);

create table public.partner_inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.partner_inquiries (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sender_side text not null default 'learner' check (sender_side in ('learner', 'partner')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index partner_inquiry_messages_inquiry on public.partner_inquiry_messages (inquiry_id, created_at);

create or replace function public.partner_inquiry_party(p_inquiry uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select auth.uid() is not null and exists (
    select 1 from public.partner_inquiries i where i.id = p_inquiry and (
      i.learner_id = auth.uid() or public.partner_has_role(i.partner_id, array['owner', 'admin', 'inquiry_manager']) or public.has_role('moderator')));
$$;

-- ---------- Reports and audit ----------
create table public.partner_reports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.learning_partners (id) on delete cascade,
  reporter_id uuid default auth.uid() references auth.users (id) on delete set null,
  reason text not null check (reason in ('misleading_claims', 'inappropriate_conduct', 'safeguarding', 'payment_pressure', 'impersonation', 'other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('actioned', 'dismissed') or char_length(coalesce(decision_note, '')) >= 4)
);
create unique index partner_reports_one_open on public.partner_reports (reporter_id, partner_id) where status in ('open', 'reviewing');
create index partner_reports_status on public.partner_reports (status, created_at);

create table public.partner_audit_logs (
  id bigint generated always as identity primary key,
  actor uuid,
  partner_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail jsonb,
  at timestamptz not null default now()
);
create index partner_audit_partner on public.partner_audit_logs (partner_id, at desc);

create or replace function public.partner_audit_write(p_partner uuid, p_action text, p_type text, p_entity text, p_detail jsonb)
returns void language sql security definer set search_path = public, extensions as $$
  insert into public.partner_audit_logs (actor, partner_id, action, entity_type, entity_id, detail) values (auth.uid(), p_partner, p_action, p_type, p_entity, p_detail);
$$;

-- ---------- Notifications: kinds ----------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in
  ('reply', 'thread_activity', 'moderation', 'correction', 'system', 'mufti_assigned', 'mufti_answered', 'mufti_closed', 'mufti_application',
   'partner_listing', 'partner_inquiry', 'partner_reply'));

create or replace function public.partner_notify(p_user uuid, p_kind text, p_link text)
returns void language sql security definer set search_path = public, extensions as $$
  insert into public.notifications (user_id, kind, channel, title, link) values (p_user, p_kind, 'in_app', null, p_link);
$$;

-- ==========================================================================================================
-- Guards
-- ==========================================================================================================
create or replace function public.guard_partner()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  actor uuid := auth.uid();
  flag boolean := coalesce(current_setting('qitl.partner_transition', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if actor is null then raise exception 'sign in required' using errcode = '42501'; end if;
    if public.is_banned(actor) then raise exception 'listings are suspended for this account' using errcode = '42501'; end if;
    perform public.throttle('partner_create', 2, 5);
    new.listing_status := 'draft';
    new.submitted_at := null; new.approved_at := null; new.first_approved_at := null;
    return new;
  end if;
  if new.id is distinct from old.id then raise exception 'a listing id cannot change' using errcode = 'P0001'; end if;
  if (new.listing_status, new.submitted_at, new.approved_at, new.first_approved_at) is distinct from
     (old.listing_status, old.submitted_at, old.approved_at, old.first_approved_at) and not flag and actor is not null then
    raise exception 'listing status moves only through partner_transition()' using errcode = '42501';
  end if;
  if actor is not null and not flag then
    if old.first_approved_at is not null and new.slug is distinct from old.slug and not public.has_role('admin') then
      raise exception 'the address of a published listing does not change' using errcode = 'P0001';
    end if;
    -- Editing the identity of an approved listing sends it back to review (it leaves the directory until approved again).
    if old.listing_status = 'approved' and not public.has_role('moderator') and
       (new.display_name, new.provider_type, new.country, new.city, new.short_description, new.long_description, new.years_experience)
       is distinct from (old.display_name, old.provider_type, old.country, old.city, old.short_description, old.long_description, old.years_experience) then
      new.listing_status := 'submitted';
      new.submitted_at := now();
      perform public.partner_audit_write(old.id, 'key_edit_rereview', 'learning_partners', old.id::text, jsonb_build_object('from', 'approved', 'to', 'submitted'));
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger learning_partners_guard before insert or update on public.learning_partners for each row execute function public.guard_partner();

create or replace function public.after_partner_insert()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.partner_members (partner_id, user_id, role, added_by) values (new.id, auth.uid(), 'owner', auth.uid());
  return new;
end $$;
create trigger learning_partners_owner after insert on public.learning_partners for each row execute function public.after_partner_insert();

create or replace function public.guard_partner_member()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.role = 'owner' and not exists (select 1 from public.learning_partners lp where lp.id = new.partner_id and lp.created_at >= now() - interval '5 seconds') then
      raise exception 'a listing has one owner' using errcode = 'P0001';
    end if;
    new.added_by := auth.uid();
    return new;
  end if;
  if old.role = 'owner' and auth.uid() is not null and exists (select 1 from public.learning_partners lp where lp.id = old.partner_id) then raise exception 'the owner stays on the listing' using errcode = '42501'; end if;
  return old;
end $$;
create trigger partner_members_ins before insert on public.partner_members for each row execute function public.guard_partner_member();
create trigger partner_members_del before delete on public.partner_members for each row execute function public.guard_partner_member();

-- Qualifications: a provider edits the claim, never the verdict. Changing what is claimed drops any earlier verdict.
create or replace function public.guard_partner_qualification()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare flag boolean := coalesce(current_setting('qitl.partner_review', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.status := 'unverified';
    return new;
  end if;
  if new.partner_id is distinct from old.partner_id then raise exception 'a qualification stays with its listing' using errcode = 'P0001'; end if;
  if new.status is distinct from old.status and not flag and auth.uid() is not null then
    raise exception 'a qualification is verified by staff only' using errcode = '42501';
  end if;
  if not flag and (new.kind, new.title, new.issuer, new.year, new.claim) is distinct from (old.kind, old.title, old.issuer, old.year, old.claim) then
    new.status := 'unverified';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger partner_qualifications_guard before insert or update on public.partner_qualifications for each row execute function public.guard_partner_qualification();

-- A replaced evidence file also drops the verdict.
create or replace function public.after_partner_file()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.partner_qualifications set status = 'unverified' where id = new.qualification_id and status <> 'unverified';
  return new;
end $$;
create trigger partner_files_reset after insert or update on public.partner_qualification_files for each row execute function public.after_partner_file();

-- A service must reference a live (active) category, and an unmerged one.
create or replace function public.guard_partner_service()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE' and new.partner_id is distinct from old.partner_id then raise exception 'a service stays with its listing' using errcode = 'P0001'; end if;
  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id then
    if not exists (select 1 from public.partner_service_categories c where c.id = new.category_id and c.active and c.merged_into is null) then
      raise exception 'choose an active category' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger partner_services_guard before insert or update on public.partner_services for each row execute function public.guard_partner_service();

-- Inquiries
create or replace function public.guard_partner_inquiry()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare actor uuid := auth.uid(); links integer;
begin
  if tg_op = 'INSERT' then
    if actor is null or new.learner_id is distinct from actor then raise exception 'an inquiry is sent in your own name' using errcode = '42501'; end if;
    if public.is_banned(actor) then raise exception 'inquiries are suspended for this account' using errcode = '42501'; end if;
    if not public.partner_is_approved(new.partner_id) then raise exception 'this provider is not accepting inquiries' using errcode = 'P0001'; end if;
    if public.partner_is_member(new.partner_id) then raise exception 'members cannot send an inquiry to their own listing' using errcode = 'P0001'; end if;
    if new.service_id is not null and not exists (select 1 from public.partner_services s where s.id = new.service_id and s.partner_id = new.partner_id and s.status = 'published') then
      raise exception 'that service is not offered by this provider' using errcode = 'P0001';
    end if;
    links := (char_length(lower(new.message)) - char_length(replace(lower(new.message), 'http', ''))) / 4;
    if links > 2 then raise exception 'too many links in the message' using errcode = 'P0001'; end if;
    if exists (select 1 from public.partner_inquiries i where i.learner_id = actor and i.message = new.message and i.created_at > now() - interval '1 day') then
      raise exception 'you already sent this message' using errcode = 'P0001';
    end if;
    perform public.throttle('partner_inquiry', 2, 6);
    if (select count(*) from public.partner_inquiries i where i.learner_id = actor and i.partner_id = new.partner_id and i.status in ('new', 'viewed', 'responded', 'follow_up')) >= 3 then
      raise exception 'rate_limited: you already have open inquiries with this provider' using errcode = 'P0429';
    end if;
    new.status := 'new';
    new.consented_at := now();
    return new;
  end if;
  -- UPDATE: only the status moves.
  if (new.partner_id, new.service_id, new.learner_id, new.learner_alias, new.for_child, new.subject, new.message, new.consent, new.consent_version, new.consented_at, new.created_at)
     is distinct from (old.partner_id, old.service_id, old.learner_id, old.learner_alias, old.for_child, old.subject, old.message, old.consent, old.consent_version, old.consented_at, old.created_at) then
    raise exception 'an inquiry cannot be edited' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and actor is not null then
    if public.partner_has_role(old.partner_id, array['owner', 'admin', 'inquiry_manager']) then
      if new.status not in ('viewed', 'responded', 'follow_up', 'closed', 'spam') then raise exception 'that status is not available' using errcode = 'P0001'; end if;
    elsif old.learner_id = actor then
      if new.status <> 'closed' or old.status = 'spam' then raise exception 'a learner can only close their inquiry' using errcode = 'P0001'; end if;
    elsif public.has_role('moderator') then
      if new.status not in ('closed', 'spam') then raise exception 'staff can only close or mark spam' using errcode = 'P0001'; end if;
    else
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger partner_inquiries_guard before insert or update on public.partner_inquiries for each row execute function public.guard_partner_inquiry();

create or replace function public.after_partner_inquiry()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare m record;
begin
  for m in select user_id from public.partner_members where partner_id = new.partner_id and role in ('owner', 'admin', 'inquiry_manager') loop
    perform public.partner_notify(m.user_id, 'partner_inquiry', '/partners/dashboard/inquiries');
  end loop;
  return new;
end $$;
create trigger partner_inquiries_notify after insert on public.partner_inquiries for each row execute function public.after_partner_inquiry();

create or replace function public.guard_partner_message()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare actor uuid := auth.uid(); i public.partner_inquiries%rowtype; side text;
begin
  select * into i from public.partner_inquiries where id = new.inquiry_id;
  if not found then raise exception 'no such inquiry' using errcode = 'P0002'; end if;
  if actor is null or new.sender_id is distinct from actor then raise exception 'a message is sent in your own name' using errcode = '42501'; end if;
  if i.learner_id = actor then side := 'learner';
  elsif public.partner_has_role(i.partner_id, array['owner', 'admin', 'inquiry_manager']) then side := 'partner';
  else raise exception 'not allowed' using errcode = '42501'; end if;
  if public.is_banned(actor) then raise exception 'messages are suspended for this account' using errcode = '42501'; end if;
  if i.status in ('closed', 'spam') then raise exception 'this inquiry is closed' using errcode = 'P0001'; end if;
  perform public.throttle('partner_message', 10, 60);
  new.sender_side := side;
  return new;
end $$;
create trigger partner_inquiry_messages_guard before insert on public.partner_inquiry_messages for each row execute function public.guard_partner_message();

create or replace function public.after_partner_message()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare i public.partner_inquiries%rowtype; m record;
begin
  select * into i from public.partner_inquiries where id = new.inquiry_id;
  if new.sender_side = 'partner' then
    update public.partner_inquiries set status = 'responded', updated_at = now() where id = i.id and status in ('new', 'viewed', 'follow_up');
    perform public.partner_notify(i.learner_id, 'partner_reply', '/partners/inquiries');
  else
    for m in select user_id from public.partner_members where partner_id = i.partner_id and role in ('owner', 'admin', 'inquiry_manager') loop
      perform public.partner_notify(m.user_id, 'partner_inquiry', '/partners/dashboard/inquiries');
    end loop;
  end if;
  return new;
end $$;
create trigger partner_inquiry_messages_after after insert on public.partner_inquiry_messages for each row execute function public.after_partner_message();

-- Reports
create or replace function public.guard_partner_report()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.reporter_id is distinct from auth.uid() then raise exception 'a report is made in your own name' using errcode = '42501'; end if;
    if public.is_banned(auth.uid()) then raise exception 'reports are suspended for this account' using errcode = '42501'; end if;
    if not public.partner_is_approved(new.partner_id) then raise exception 'only a published listing can be reported' using errcode = 'P0001'; end if;
    if public.partner_is_member(new.partner_id) then raise exception 'members cannot report their own listing' using errcode = 'P0001'; end if;
    perform public.throttle('partner_report', 3, 10);
    new.status := 'open'; new.decision_note := null; new.handled_by := null;
    return new;
  end if;
  if not public.has_role('moderator') then raise exception 'only staff handle a report' using errcode = '42501'; end if;
  if (new.partner_id, new.reporter_id, new.reason, new.details, new.created_at) is distinct from (old.partner_id, old.reporter_id, old.reason, old.details, old.created_at) then
    raise exception 'a report cannot be edited' using errcode = 'P0001';
  end if;
  if not ((old.status = 'open' and new.status = 'reviewing') or (old.status in ('open', 'reviewing') and new.status in ('actioned', 'dismissed')) or new.status = old.status) then
    raise exception 'a report moves open, reviewing, then actioned or dismissed' using errcode = 'P0001';
  end if;
  new.handled_by := auth.uid();
  new.updated_at := now();
  if new.status is distinct from old.status then
    perform public.partner_audit_write(old.partner_id, 'report_' || new.status, 'partner_reports', old.id::text, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger partner_reports_guard before insert or update on public.partner_reports for each row execute function public.guard_partner_report();

-- Taxonomy changes are audited.
create or replace function public.audit_partner_category()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.partner_audit_write(null, 'category_' || lower(tg_op), 'partner_service_categories', new.id::text, jsonb_build_object('slug', new.slug, 'active', new.active, 'merged_into', new.merged_into));
  return new;
end $$;
create trigger partner_categories_audit after insert or update on public.partner_service_categories for each row execute function public.audit_partner_category();

-- ==========================================================================================================
-- Staff and provider actions as functions (the only way a status, verdict or merge changes)
-- ==========================================================================================================
create or replace function public.partner_transition(p_partner uuid, p_to text, p_note text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  actor uuid := auth.uid();
  adm boolean := public.has_role('admin');
  stf boolean := public.has_role('moderator');
  mgr boolean := public.partner_has_role(p_partner, array['owner', 'admin']);
  lp public.learning_partners%rowtype;
  ok boolean := false;
  m record;
begin
  if actor is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not (mgr or stf) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into lp from public.learning_partners where id = p_partner for update;
  if not found then raise exception 'no such listing' using errcode = 'P0002'; end if;
  if p_to not in ('draft', 'submitted', 'information_requested', 'under_verification', 'approved', 'changes_requested', 'suspended', 'rejected') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  -- Nobody decides a listing they belong to.
  if stf and public.partner_is_member(p_partner) and p_to not in ('draft', 'submitted') then
    raise exception 'staff cannot decide a listing they are a member of' using errcode = '42501';
  end if;
  if mgr and ((lp.listing_status in ('draft', 'changes_requested', 'information_requested') and p_to = 'submitted') or (lp.listing_status = 'approved' and p_to = 'draft')) then ok := true; end if;
  if stf and not ok then
    ok := (lp.listing_status = 'submitted' and p_to = 'under_verification')
       or (lp.listing_status in ('submitted', 'under_verification') and p_to in ('information_requested', 'changes_requested'))
       or (lp.listing_status in ('approved', 'submitted', 'under_verification') and p_to = 'suspended');
  end if;
  if adm and not ok then
    ok := (lp.listing_status in ('submitted', 'under_verification') and p_to in ('approved', 'rejected'))
       or (lp.listing_status = 'suspended' and p_to in ('approved', 'under_verification'))
       or (lp.listing_status = 'rejected' and p_to = 'under_verification');
  end if;
  if not ok then
    if p_to = 'approved' and not adm then raise exception 'only an administrator approves a listing' using errcode = '42501'; end if;
    raise exception 'a listing cannot move from % to %', lp.listing_status, p_to using errcode = 'P0001';
  end if;
  if p_to in ('information_requested', 'changes_requested', 'rejected', 'suspended') and char_length(coalesce(trim(p_note), '')) < 4 then
    raise exception 'say why, so the provider can act on it' using errcode = 'P0001';
  end if;
  if p_to = 'submitted' then
    if lp.short_description is null then raise exception 'add a short description before submitting' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.partner_contact_methods c where c.partner_id = p_partner) then raise exception 'add a way to contact you before submitting' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.partner_services s where s.partner_id = p_partner and s.status in ('draft', 'published')) then raise exception 'add at least one service before submitting' using errcode = 'P0001'; end if;
  end if;
  perform set_config('qitl.partner_transition', 'on', true);
  update public.learning_partners set listing_status = p_to,
    submitted_at = case when p_to = 'submitted' then now() else submitted_at end,
    approved_at = case when p_to = 'approved' then now() when p_to in ('draft', 'suspended', 'rejected') then null else approved_at end,
    first_approved_at = case when p_to = 'approved' then coalesce(first_approved_at, now()) else first_approved_at end
  where id = p_partner;
  perform set_config('qitl.partner_transition', 'off', true);
  if nullif(trim(coalesce(p_note, '')), '') is not null and char_length(trim(p_note)) >= 4 then
    insert into public.partner_review_notes (partner_id, subject, note, author) values (p_partner, 'listing', left(trim(p_note), 1000), actor);
  end if;
  perform public.partner_audit_write(p_partner, 'status_' || p_to, 'learning_partners', p_partner::text, jsonb_build_object('from', lp.listing_status, 'to', p_to, 'by_staff', stf));
  if stf then
    for m in select user_id from public.partner_members where partner_id = p_partner and role in ('owner', 'admin') loop
      perform public.partner_notify(m.user_id, 'partner_listing', '/partners/dashboard');
    end loop;
  end if;
  return p_to;
end $$;

create or replace function public.partner_request_verification(p_partner uuid, p_kind text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cur text;
begin
  if not public.partner_has_role(p_partner, array['owner', 'admin']) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('identity', 'qualifications', 'religious_scholarly') then raise exception 'unknown verification' using errcode = '22023'; end if;
  select status into cur from public.partner_verifications where partner_id = p_partner and kind = p_kind;
  if cur is null or cur in ('rejected', 'revoked') then perform public.throttle('partner_verification', 3, 10); end if;
  if cur is null then
    insert into public.partner_verifications (partner_id, kind, status) values (p_partner, p_kind, 'requested');
  elsif cur in ('rejected', 'revoked') then
    update public.partner_verifications set status = 'requested', requested_at = now(), decided_at = null, scope_statement = null where partner_id = p_partner and kind = p_kind;
  else
    raise exception 'this verification is already % ', cur using errcode = 'P0001';
  end if;
  perform public.partner_audit_write(p_partner, 'verification_requested', 'partner_verifications', p_kind, null);
end $$;

create or replace function public.partner_decide_verification(p_partner uuid, p_kind text, p_status text, p_note text, p_scope text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cur text; m record;
begin
  if not public.has_role('moderator') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind = 'religious_scholarly' and not public.has_role('admin') then raise exception 'only an administrator decides religious/scholarly verification' using errcode = '42501'; end if;
  if public.partner_is_member(p_partner) then raise exception 'staff cannot decide a listing they are a member of' using errcode = '42501'; end if;
  if p_status not in ('in_review', 'verified', 'rejected', 'revoked') then raise exception 'unknown verification status' using errcode = '22023'; end if;
  select status into cur from public.partner_verifications where partner_id = p_partner and kind = p_kind;
  if cur is null then raise exception 'no such verification request' using errcode = 'P0002'; end if;
  if not ((cur = 'requested' and p_status = 'in_review') or (cur in ('requested', 'in_review') and p_status in ('verified', 'rejected')) or (cur = 'verified' and p_status = 'revoked')) then
    raise exception 'a verification cannot move from % to %', cur, p_status using errcode = 'P0001';
  end if;
  if p_status in ('verified', 'rejected', 'revoked') and char_length(coalesce(trim(p_note), '')) < 4 then raise exception 'record the decision' using errcode = 'P0001'; end if;
  if p_status = 'verified' and char_length(coalesce(trim(p_scope), '')) < 4 then raise exception 'state exactly what was verified' using errcode = 'P0001'; end if;
  update public.partner_verifications set status = p_status, decided_at = case when p_status = 'in_review' then null else now() end,
    scope_statement = case when p_status = 'verified' then left(trim(p_scope), 400) when p_status in ('rejected', 'revoked') then null else scope_statement end
  where partner_id = p_partner and kind = p_kind;
  if char_length(coalesce(trim(p_note), '')) >= 4 then
    insert into public.partner_review_notes (partner_id, subject, note, author) values (p_partner, p_kind, left(trim(p_note), 1000), auth.uid());
  end if;
  perform public.partner_audit_write(p_partner, 'verification_' || p_status, 'partner_verifications', p_kind, jsonb_build_object('from', cur, 'to', p_status));
  for m in select user_id from public.partner_members where partner_id = p_partner and role in ('owner', 'admin') loop
    perform public.partner_notify(m.user_id, 'partner_listing', '/partners/dashboard');
  end loop;
end $$;

create or replace function public.partner_review_qualification(p_qualification uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare q public.partner_qualifications%rowtype;
begin
  if not public.has_role('moderator') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('verified', 'rejected', 'unverified') then raise exception 'unknown status' using errcode = '22023'; end if;
  select * into q from public.partner_qualifications where id = p_qualification;
  if not found then raise exception 'no such qualification' using errcode = 'P0002'; end if;
  if public.partner_is_member(q.partner_id) then raise exception 'staff cannot decide a listing they are a member of' using errcode = '42501'; end if;
  if p_status = 'rejected' and char_length(coalesce(trim(p_note), '')) < 4 then raise exception 'say why' using errcode = 'P0001'; end if;
  perform set_config('qitl.partner_review', 'on', true);
  update public.partner_qualifications set status = p_status where id = p_qualification;
  perform set_config('qitl.partner_review', 'off', true);
  if char_length(coalesce(trim(p_note), '')) >= 4 then
    insert into public.partner_review_notes (partner_id, subject, note, author) values (q.partner_id, 'qualification:' || q.id::text, left(trim(p_note), 1000), auth.uid());
  end if;
  perform public.partner_audit_write(q.partner_id, 'qualification_' || p_status, 'partner_qualifications', q.id::text, jsonb_build_object('from', q.status, 'to', p_status));
end $$;

create or replace function public.partner_merge_category(p_from uuid, p_to uuid)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  if not public.has_role('admin') then raise exception 'only an administrator manages the taxonomy' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'choose two different categories' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.partner_service_categories where id = p_to and active and merged_into is null) then raise exception 'the target must be an active category' using errcode = 'P0001'; end if;
  update public.partner_services set category_id = p_to where category_id = p_from;
  get diagnostics n = row_count;
  update public.partner_service_categories set active = false, merged_into = p_to where id = p_from;
  update public.partner_service_categories set merged_into = p_to where merged_into = p_from;
  perform public.partner_audit_write(null, 'category_merged', 'partner_service_categories', p_from::text, jsonb_build_object('into', p_to, 'services_moved', n));
  return n;
end $$;

-- A staff member opening a provider's private data (contacts, documents, inquiries) is logged by the page that does it.
create or replace function public.partner_log_access(p_partner uuid, p_what text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role('moderator') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_what not in ('contacts', 'documents', 'inquiries', 'profile') then raise exception 'unknown area' using errcode = '22023'; end if;
  perform public.partner_audit_write(p_partner, 'staff_viewed_' || p_what, 'learning_partners', p_partner::text, null);
end $$;

-- ==========================================================================================================
-- Public directory view: approved listings only, with what the filters need. Runs with the caller's rights.
-- ==========================================================================================================
create view public.partner_directory with (security_invoker = true) as
select p.id, p.slug, p.display_name, p.provider_type, p.country, p.city, p.service_area, p.languages, p.short_description, p.years_experience, p.approved_at,
  coalesce((select array_agg(distinct s.category_id) from public.partner_services s where s.partner_id = p.id and s.status = 'published'), '{}') as category_ids,
  coalesce((select array_agg(distinct s.mode) from public.partner_services s where s.partner_id = p.id and s.status = 'published'), '{}') as modes,
  coalesce((select array_agg(distinct s.group_type) from public.partner_services s where s.partner_id = p.id and s.status = 'published'), '{}') as group_types,
  coalesce((select array_agg(distinct s.level) from public.partner_services s where s.partner_id = p.id and s.status = 'published'), '{}') as levels,
  coalesce((select array_agg(distinct s.language) from public.partner_services s where s.partner_id = p.id and s.status = 'published'), '{}') as teaching_languages,
  exists (select 1 from public.partner_services s join public.partner_service_pricing pr on pr.service_id = s.id where s.partner_id = p.id and s.status = 'published' and pr.pricing_type = 'free') as has_free,
  exists (select 1 from public.partner_services s join public.partner_service_pricing pr on pr.service_id = s.id where s.partner_id = p.id and s.status = 'published' and pr.pricing_type not in ('free', 'donation', 'on_request')) as has_paid,
  (select count(*) from public.partner_services s where s.partner_id = p.id and s.status = 'published')::integer as service_count
from public.learning_partners p
where p.listing_status = 'approved';

-- ==========================================================================================================
-- Privileges and RLS
-- ==========================================================================================================
revoke all on public.partner_service_categories, public.learning_partners, public.partner_members, public.partner_contact_methods, public.partner_services,
  public.partner_service_pricing, public.partner_service_availability, public.partner_qualifications, public.partner_qualification_files,
  public.partner_verifications, public.partner_review_notes, public.partner_inquiries, public.partner_inquiry_messages, public.partner_reports,
  public.partner_audit_logs, public.partner_directory from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['partner_service_categories', 'learning_partners', 'partner_members', 'partner_contact_methods', 'partner_services',
    'partner_service_pricing', 'partner_service_availability', 'partner_qualifications', 'partner_qualification_files', 'partner_verifications',
    'partner_review_notes', 'partner_inquiries', 'partner_inquiry_messages', 'partner_reports', 'partner_audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Reads
grant select on public.partner_service_categories, public.learning_partners, public.partner_contact_methods, public.partner_services,
  public.partner_service_pricing, public.partner_service_availability, public.partner_qualifications, public.partner_verifications, public.partner_directory to anon, authenticated;
grant select on public.partner_members, public.partner_qualification_files, public.partner_review_notes, public.partner_inquiries,
  public.partner_inquiry_messages, public.partner_reports, public.partner_audit_logs to authenticated;
-- Writes (column lists keep every verdict and status out of reach)
grant insert (slug, provider_type, display_name, country, city, service_area, languages, short_description, long_description, years_experience) on public.learning_partners to authenticated;
grant update (slug, provider_type, display_name, country, city, service_area, languages, short_description, long_description, years_experience) on public.learning_partners to authenticated;
grant delete on public.learning_partners to authenticated;
grant insert (partner_id, user_id, role) on public.partner_members to authenticated;
grant delete on public.partner_members to authenticated;
grant insert (partner_id, kind, label, value, is_public), update (kind, label, value, is_public), delete on public.partner_contact_methods to authenticated;
grant insert (partner_id, category_id, title, description, level, audience, mode, group_type, duration_minutes, language, status) on public.partner_services to authenticated;
grant update (category_id, title, description, level, audience, mode, group_type, duration_minutes, language, status) on public.partner_services to authenticated;
grant delete on public.partner_services to authenticated;
grant insert (service_id, pricing_type, currency, amount, unit, classes_included, registration_fee, materials_fee, fees_note) on public.partner_service_pricing to authenticated;
grant update (pricing_type, currency, amount, unit, classes_included, registration_fee, materials_fee, fees_note) on public.partner_service_pricing to authenticated;
grant delete on public.partner_service_pricing to authenticated;
grant insert (service_id, weekday, start_time, end_time, timezone, note) on public.partner_service_availability to authenticated;
grant update (weekday, start_time, end_time, timezone, note) on public.partner_service_availability to authenticated;
grant delete on public.partner_service_availability to authenticated;
grant insert (partner_id, kind, title, issuer, year, claim, show_publicly) on public.partner_qualifications to authenticated;
grant update (kind, title, issuer, year, claim, show_publicly) on public.partner_qualifications to authenticated;
grant delete on public.partner_qualifications to authenticated;
grant insert (qualification_id, partner_id, storage_path, mime_type, size_bytes) on public.partner_qualification_files to authenticated;
grant update (storage_path, mime_type, size_bytes) on public.partner_qualification_files to authenticated;
grant delete on public.partner_qualification_files to authenticated;
grant insert (partner_id, service_id, learner_alias, for_child, subject, message, consent, consent_version) on public.partner_inquiries to authenticated;
grant update (status) on public.partner_inquiries to authenticated;
grant insert (inquiry_id, body) on public.partner_inquiry_messages to authenticated;
grant insert (partner_id, reason, details) on public.partner_reports to authenticated;
grant update (status, decision_note) on public.partner_reports to authenticated;
grant insert, update, delete on public.partner_service_categories to authenticated;

-- Categories: a public taxonomy; admins manage it.
create policy read_all on public.partner_service_categories for select using (true);
create policy admin_write on public.partner_service_categories for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- Listings
create policy read_approved on public.learning_partners for select to anon, authenticated using (listing_status = 'approved');
create policy read_member on public.learning_partners for select to authenticated using (public.partner_is_member(id));
create policy read_staff on public.learning_partners for select to authenticated using (public.has_role('moderator'));
create policy create_own on public.learning_partners for insert to authenticated with check (listing_status = 'draft');
create policy edit_manager on public.learning_partners for update to authenticated
  using (public.partner_has_role(id, array['owner', 'admin']) and listing_status not in ('suspended', 'rejected'))
  with check (public.partner_has_role(id, array['owner', 'admin']));
create policy delete_draft on public.learning_partners for delete to authenticated
  using (listing_status = 'draft' and public.partner_has_role(id, array['owner']));

-- Members
create policy read_team on public.partner_members for select to authenticated
  using (user_id = auth.uid() or public.partner_has_role(partner_id, array['owner', 'admin']) or public.has_role('moderator'));
create policy owner_adds on public.partner_members for insert to authenticated
  with check (public.partner_has_role(partner_id, array['owner']) and role in ('admin', 'instructor', 'inquiry_manager'));
create policy owner_removes_or_leaves on public.partner_members for delete to authenticated
  using (role <> 'owner' and (public.partner_has_role(partner_id, array['owner']) or user_id = auth.uid()));

-- Contact methods: public ones only for an approved listing; the rest for the people who run it.
create policy read_public on public.partner_contact_methods for select to anon, authenticated using (is_public and public.partner_is_approved(partner_id));
create policy read_member on public.partner_contact_methods for select to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin', 'inquiry_manager']));
create policy read_staff on public.partner_contact_methods for select to authenticated using (public.has_role('moderator'));
create policy manager_write on public.partner_contact_methods for insert to authenticated with check (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy manager_update on public.partner_contact_methods for update to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin'])) with check (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy manager_delete on public.partner_contact_methods for delete to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));

-- Services
create policy read_public on public.partner_services for select to anon, authenticated using (status = 'published' and public.partner_is_approved(partner_id));
create policy read_member on public.partner_services for select to authenticated using (public.partner_is_member(partner_id));
create policy read_staff on public.partner_services for select to authenticated using (public.has_role('moderator'));
create policy teach_insert on public.partner_services for insert to authenticated with check (public.partner_has_role(partner_id, array['owner', 'admin', 'instructor']));
create policy teach_update on public.partner_services for update to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin', 'instructor'])) with check (public.partner_has_role(partner_id, array['owner', 'admin', 'instructor']));
create policy teach_delete on public.partner_services for delete to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin', 'instructor']));

-- Pricing and availability follow their service.
create policy read_public on public.partner_service_pricing for select to anon, authenticated using (public.partner_service_is_public(service_id));
create policy read_member on public.partner_service_pricing for select to authenticated using (public.partner_is_member(public.partner_of_service(service_id)));
create policy read_staff on public.partner_service_pricing for select to authenticated using (public.has_role('moderator'));
create policy teach_insert on public.partner_service_pricing for insert to authenticated with check (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor']));
create policy teach_update on public.partner_service_pricing for update to authenticated using (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor'])) with check (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor']));
create policy teach_delete on public.partner_service_pricing for delete to authenticated using (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor']));

create policy read_public on public.partner_service_availability for select to anon, authenticated using (public.partner_service_is_public(service_id));
create policy read_member on public.partner_service_availability for select to authenticated using (public.partner_is_member(public.partner_of_service(service_id)));
create policy read_staff on public.partner_service_availability for select to authenticated using (public.has_role('moderator'));
create policy teach_insert on public.partner_service_availability for insert to authenticated with check (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor']));
create policy teach_update on public.partner_service_availability for update to authenticated using (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor'])) with check (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor']));
create policy teach_delete on public.partner_service_availability for delete to authenticated using (public.partner_has_role(public.partner_of_service(service_id), array['owner', 'admin', 'instructor']));

-- Qualifications: an entry is public only for an approved listing AND when the provider chose to show it.
create policy read_public on public.partner_qualifications for select to anon, authenticated using (show_publicly and public.partner_is_approved(partner_id));
create policy read_member on public.partner_qualifications for select to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy read_staff on public.partner_qualifications for select to authenticated using (public.has_role('moderator'));
create policy manager_insert on public.partner_qualifications for insert to authenticated with check (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy manager_update on public.partner_qualifications for update to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin'])) with check (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy manager_delete on public.partner_qualifications for delete to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));

-- Evidence: provider owner/admin and staff only. Never public.
create policy read_member on public.partner_qualification_files for select to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy read_staff on public.partner_qualification_files for select to authenticated using (public.has_role('moderator'));
create policy manager_insert on public.partner_qualification_files for insert to authenticated
  with check (public.partner_has_role(partner_id, array['owner', 'admin']) and exists (select 1 from public.partner_qualifications q where q.id = qualification_id and q.partner_id = partner_qualification_files.partner_id));
create policy manager_update on public.partner_qualification_files for update to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin'])) with check (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy manager_delete on public.partner_qualification_files for delete to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));

-- Verifications: only a verified kind of an approved listing is public; requests and verdicts go through functions.
create policy read_public on public.partner_verifications for select to anon, authenticated using (status = 'verified' and public.partner_is_approved(partner_id));
create policy read_member on public.partner_verifications for select to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy read_staff on public.partner_verifications for select to authenticated using (public.has_role('moderator'));

create policy read_member on public.partner_review_notes for select to authenticated using (public.partner_has_role(partner_id, array['owner', 'admin']));
create policy read_staff on public.partner_review_notes for select to authenticated using (public.has_role('moderator'));

-- Inquiries
create policy read_party on public.partner_inquiries for select to authenticated
  using (learner_id = auth.uid() or public.partner_has_role(partner_id, array['owner', 'admin', 'inquiry_manager']) or public.has_role('moderator'));
create policy send_own on public.partner_inquiries for insert to authenticated with check (learner_id = auth.uid() and consent and status = 'new');
create policy update_party on public.partner_inquiries for update to authenticated
  using (learner_id = auth.uid() or public.partner_has_role(partner_id, array['owner', 'admin', 'inquiry_manager']) or public.has_role('moderator'))
  with check (learner_id = auth.uid() or public.partner_has_role(partner_id, array['owner', 'admin', 'inquiry_manager']) or public.has_role('moderator'));
create policy read_party on public.partner_inquiry_messages for select to authenticated using (public.partner_inquiry_party(inquiry_id));
create policy send_party on public.partner_inquiry_messages for insert to authenticated with check (sender_id = auth.uid() and public.partner_inquiry_party(inquiry_id));

-- Reports: the reporter and staff. The provider never sees who reported.
create policy read_own_or_staff on public.partner_reports for select to authenticated using (reporter_id = auth.uid() or public.has_role('moderator'));
create policy report_own on public.partner_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy staff_handle on public.partner_reports for update to authenticated using (public.has_role('moderator')) with check (public.has_role('moderator'));

create policy admin_read on public.partner_audit_logs for select to authenticated using (public.has_role('admin'));

-- ---------- Functions: who can call what ----------
revoke execute on function
  public.partner_codes_ok(text[]), public.partner_has_role(uuid, text[]), public.partner_is_member(uuid), public.partner_is_approved(uuid), public.partner_of_service(uuid),
  public.partner_service_is_public(uuid), public.partner_inquiry_party(uuid), public.partner_audit_write(uuid, text, text, text, jsonb), public.partner_notify(uuid, text, text),
  public.guard_partner(), public.after_partner_insert(), public.guard_partner_member(), public.guard_partner_qualification(), public.after_partner_file(),
  public.guard_partner_service(), public.guard_partner_inquiry(), public.after_partner_inquiry(), public.guard_partner_message(), public.after_partner_message(),
  public.guard_partner_report(), public.audit_partner_category(),
  public.partner_transition(uuid, text, text), public.partner_request_verification(uuid, text), public.partner_decide_verification(uuid, text, text, text, text),
  public.partner_review_qualification(uuid, text, text), public.partner_merge_category(uuid, uuid), public.partner_log_access(uuid, text)
  from public, anon, authenticated;
-- Visibility questions used inside policies: booleans only.
grant execute on function public.partner_codes_ok(text[]), public.partner_has_role(uuid, text[]), public.partner_is_member(uuid), public.partner_is_approved(uuid),
  public.partner_service_is_public(uuid), public.partner_inquiry_party(uuid) to anon, authenticated;
grant execute on function public.partner_of_service(uuid) to authenticated;
grant execute on function public.partner_transition(uuid, text, text), public.partner_request_verification(uuid, text), public.partner_decide_verification(uuid, text, text, text, text),
  public.partner_review_qualification(uuid, text, text), public.partner_merge_category(uuid, uuid), public.partner_log_access(uuid, text) to authenticated;

-- ---------- Seed taxonomy (admin-managed afterwards; names are plain descriptions, not claims) ----------
insert into public.partner_service_categories (slug, track, name_en, name_ar, name_ur, sort_order) values
  ('quran_reading', 'quran', 'Quran reading (Nazirah)', 'تعليم قراءة القرآن (الناظرة)', 'ناظرہ قرآن', 10),
  ('tajweed', 'quran', 'Tajweed', 'التجويد', 'تجوید', 20),
  ('hifz', 'quran', 'Quran memorisation (Hifz)', 'حفظ القرآن الكريم', 'حفظِ قرآن', 30),
  ('hifz_revision', 'quran', 'Memorisation revision (Muraja''ah)', 'مراجعة المحفوظ', 'حفظ کی دہرائی', 40),
  ('qiraat', 'quran', 'Qira''at (recitation traditions)', 'القراءات', 'قراءات', 50),
  ('ijazah_quran', 'quran', 'Ijazah in Quran recitation', 'الإجازة في القرآن الكريم', 'قرآن میں اجازہ', 60),
  ('quran_children', 'quran', 'Quran for children', 'القرآن للأطفال', 'بچوں کے لیے قرآن', 70),
  ('quran_adult_beginners', 'quran', 'Quran for adult beginners and new Muslims', 'القرآن للكبار المبتدئين والمسلمين الجدد', 'بالغ مبتدیوں اور نو مسلموں کے لیے قرآن', 80),
  ('arabic_msa', 'arabic', 'Modern Standard Arabic', 'اللغة العربية الفصحى المعاصرة', 'جدید معیاری عربی', 110),
  ('quranic_arabic', 'arabic', 'Quranic Arabic', 'العربية القرآنية', 'قرآنی عربی', 120),
  ('arabic_grammar', 'arabic', 'Arabic grammar (Nahw and Sarf)', 'النحو والصرف', 'نحو و صرف', 130),
  ('arabic_reading_writing', 'arabic', 'Arabic reading and writing', 'القراءة والكتابة بالعربية', 'عربی پڑھنا اور لکھنا', 140),
  ('arabic_spoken', 'arabic', 'Spoken Arabic', 'العربية المحكية', 'بول چال کی عربی', 150),
  ('arabic_children', 'arabic', 'Arabic for children', 'العربية للأطفال', 'بچوں کے لیے عربی', 160),
  ('arabic_classical_texts', 'arabic', 'Classical Arabic texts', 'النصوص العربية الكلاسيكية', 'کلاسیکی عربی متون', 170),
  ('aqidah', 'islamic', 'Aqidah (creed)', 'العقيدة', 'عقیدہ', 210),
  ('fiqh_worship', 'islamic', 'Fiqh of worship (educational study)', 'فقه العبادات (دراسة تعليمية)', 'فقہِ عبادات (تعلیمی مطالعہ)', 220),
  ('seerah', 'islamic', 'Seerah of the Prophet ﷺ', 'السيرة النبوية', 'سیرتِ نبوی', 230),
  ('hadith_studies', 'islamic', 'Hadith studies', 'علوم الحديث', 'علومِ حدیث', 240),
  ('tafsir_studies', 'islamic', 'Tafsir studies', 'علوم التفسير', 'علومِ تفسیر', 250),
  ('islamic_history', 'islamic', 'Islamic history', 'التاريخ الإسلامي', 'اسلامی تاریخ', 260),
  ('new_muslim_foundations', 'islamic', 'New Muslim foundations', 'أساسيات للمسلمين الجدد', 'نو مسلموں کے لیے بنیادی تعلیم', 270),
  ('islamic_children', 'islamic', 'Islamic studies for children', 'الدراسات الإسلامية للأطفال', 'بچوں کے لیے اسلامی تعلیم', 280),
  ('adab_tazkiyah', 'islamic', 'Character and spiritual education (Adab and Tazkiyah)', 'الآداب والتزكية', 'آداب و تزکیہ', 290)
on conflict (slug) do nothing;
