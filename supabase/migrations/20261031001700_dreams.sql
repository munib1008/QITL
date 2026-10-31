-- Dream Understanding Centre (تعبير الرؤى): a private request service on the Mufti Q&A model
-- (docs/proposals/2026-10-31-briefs-review.md section 3).
--
-- Privacy is stricter than Q&A. A dream request is personal data:
--   * only the submitter and the qualified scholars assigned to it can read it (administrators assign from metadata
--     only, through dream_admin_queue(), and never see the text);
--   * every request carries a retention limit (retain_until) and purge_expired_dream_requests() deletes it after;
--   * the submitter can export (export_my_dream_data) and delete (cascade) at any time;
--   * audit rows never contain dream text: these tables use audit_redacted(), never the generic audit();
--   * dream text is never indexed for search and never used for training (no search trigger, no export path).
-- No automated interpretation, prediction, classification or symbol dictionary exists anywhere in the schema.

-- ---------- A separate qualification on the mufti profile ----------
alter table public.mufti_profiles
  add column dream_qualified_by uuid references auth.users (id),
  add column dream_qualified_at timestamptz,
  add column dream_qualification_note text check (char_length(dream_qualification_note) <= 1000),
  add constraint mufti_profiles_dream_qual_pair check ((dream_qualified_at is null) = (dream_qualified_by is null)),
  add constraint mufti_profiles_dream_needs_verified check (dream_qualified_at is null or verified_at is not null);

-- Only an administrator grants or removes the dream-interpretation qualification, and records it as their own act.
create or replace function public.guard_dream_qualification()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if (tg_op = 'INSERT' and (new.dream_qualified_at is not null or new.dream_qualified_by is not null or new.dream_qualification_note is not null))
     or (tg_op = 'UPDATE' and (new.dream_qualified_at is distinct from old.dream_qualified_at
                               or new.dream_qualified_by is distinct from old.dream_qualified_by
                               or new.dream_qualification_note is distinct from old.dream_qualification_note)) then
    if not public.has_role('admin') then
      raise exception 'only an administrator grants the dream-interpretation qualification' using errcode = '42501';
    end if;
    if new.dream_qualified_by is not null and new.dream_qualified_by is distinct from auth.uid()
       and (tg_op = 'INSERT' or new.dream_qualified_by is distinct from old.dream_qualified_by) then
      raise exception 'the qualification must be recorded as granted by you' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger mufti_profiles_dream_guard before insert or update on public.mufti_profiles for each row execute function public.guard_dream_qualification();

create or replace function public.is_dream_scholar(u uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_verified_mufti(u)
     and exists (select 1 from public.mufti_profiles where user_id = u and dream_qualified_at is not null);
$$;

-- ---------- Redacting audit: ids, statuses and actors only, never text ----------
create or replace function public.audit_redacted()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  hidden text[] := array['dream_text', 'question', 'body_md', 'note', 'work', 'locator'];
  rec jsonb;
  old_rec jsonb;
  diff jsonb;
begin
  rec := case when tg_op = 'DELETE' then null else to_jsonb(new) - hidden end;
  old_rec := case when tg_op = 'INSERT' then null else to_jsonb(old) - hidden end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', old_rec -> k, 'to', rec -> k)) into diff
    from jsonb_object_keys(rec) k where rec -> k is distinct from old_rec -> k;
  else
    diff := coalesce(rec, old_rec);
  end if;
  insert into public.audit_logs (actor, action, entity_type, entity_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(rec ->> 'id', old_rec ->> 'id', rec ->> 'request_id', old_rec ->> 'request_id', '?'),
          coalesce(diff, '{}'::jsonb) || jsonb_build_object('redacted', true));
  return coalesce(new, old);
end $$;

-- ---------- Tables ----------
create table public.dream_privacy_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  retention_days integer not null default 90 check (retention_days in (30, 90, 180, 365)),
  updated_at timestamptz not null default now()
);

-- All requests are private: there is no public mode.
create table public.dream_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dream_text text not null check (char_length(dream_text) between 20 and 6000),
  question text check (char_length(question) <= 1000),
  language text not null default 'en' check (language in ('en', 'ar', 'ur')),
  status text not null default 'submitted' check (status in ('submitted', 'assigned', 'answered', 'closed', 'declined', 'withdrawn')),
  retain_until timestamptz not null default now() + interval '90 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retain_until > created_at and retain_until <= created_at + interval '366 days')
);
create index dream_requests_user on public.dream_requests (user_id, created_at desc);
create index dream_requests_retain on public.dream_requests (retain_until);

-- Consent is append-only; the latest row of a kind decides. Withdrawing scholar_access removes every scholar's access.
create table public.dream_request_consents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dream_requests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('scholar_access', 'second_opinion')),
  granted boolean not null,
  notice_version text not null check (notice_version ~ '^[a-z0-9.-]{1,20}$'),
  created_at timestamptz not null default clock_timestamp()
);
create index dream_request_consents_req on public.dream_request_consents (request_id, kind, created_at desc);

create table public.dream_request_assignments (
  request_id uuid not null references public.dream_requests (id) on delete cascade,
  scholar_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'reviewer', 'second_opinion')),
  assigned_by uuid not null references auth.users (id),
  assigned_at timestamptz not null default now(),
  primary key (request_id, scholar_id)
);
create index dream_request_assignments_scholar on public.dream_request_assignments (scholar_id);

-- A scholar may answer that the meaning is unknown or that there is insufficient basis; every released response is
-- shown with the fallible-human-judgment notice, and cannot be released until the scholar has acknowledged it.
create table public.dream_scholar_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dream_requests (id) on delete cascade,
  scholar_id uuid not null references auth.users (id),
  outcome text not null check (outcome in ('interpretation', 'meaning_unknown', 'insufficient_basis', 'not_for_interpretation')),
  body_md text not null check (char_length(body_md) between 20 and 8000),
  fallibility_acknowledged boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'released', 'withdrawn')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'changes_requested', 'rejected')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'released' or (review_status = 'approved' and fallibility_acknowledged))
);
create index dream_scholar_responses_req on public.dream_scholar_responses (request_id);

create table public.dream_second_opinions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dream_requests (id) on delete cascade,
  first_response_id uuid not null references public.dream_scholar_responses (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'assigned', 'answered', 'withdrawn')),
  created_at timestamptz not null default now()
);
create unique index dream_second_opinions_one_open on public.dream_second_opinions (request_id) where status in ('requested', 'assigned');
alter table public.dream_scholar_responses add column second_opinion_id uuid references public.dream_second_opinions (id) on delete cascade;

create table public.dream_reference_links (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.dream_scholar_responses (id) on delete cascade,
  kind text not null check (kind in ('quran', 'hadith', 'scholar')),
  quran_surah smallint check (quran_surah between 1 and 114),
  quran_ayah_from smallint check (quran_ayah_from >= 1),
  quran_ayah_to smallint,
  hadith_id uuid references public.hadith_entries (id),
  work text check (char_length(work) <= 300),
  locator text check (char_length(locator) <= 200),
  note text check (char_length(note) <= 500),
  check ((kind = 'quran') = (quran_surah is not null and quran_ayah_from is not null)),
  check (quran_ayah_to is null or quran_ayah_to >= quran_ayah_from),
  check (kind <> 'hadith' or hadith_id is not null),
  check (kind <> 'scholar' or work is not null)
);
create index dream_reference_links_resp on public.dream_reference_links (response_id);

-- Status history holds no dream text: statuses, the actor and a reason code only.
create table public.dream_request_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.dream_requests (id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text check (reason in ('outside_scope', 'insufficient_detail', 'capacity', 'duplicate', 'completed', 'other')),
  changed_by uuid,
  changed_at timestamptz not null default clock_timestamp()
);
create index dream_request_status_history_req on public.dream_request_status_history (request_id, changed_at);

create table public.dream_content_reviews (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.dream_scholar_responses (id) on delete cascade,
  response_version integer not null,
  reviewer_id uuid not null references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index dream_content_reviews_resp on public.dream_content_reviews (response_id);

-- Review targets for the shared editorial machinery (rows, never a constraint edit).
insert into public.review_entity_types (type, module) values ('dream_response', 'dreams') on conflict do nothing;

-- ---------- Access helpers (definer; internal ones are not callable through the API) ----------
create or replace function public.dream_consent_granted(req uuid, k text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select c.granted from public.dream_request_consents c
                   where c.request_id = req and c.kind = k order by c.created_at desc, c.id limit 1), false);
$$;

create or replace function public.is_dream_owner(req uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select auth.uid() is not null and exists (select 1 from public.dream_requests r where r.id = req and r.user_id = auth.uid());
$$;

-- The caller is a currently qualified scholar assigned to the request, and the submitter's consent still stands.
create or replace function public.is_dream_assignee(req uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select auth.uid() is not null
     and exists (select 1 from public.dream_request_assignments a
                 where a.request_id = req and a.scholar_id = auth.uid()
                   and (a.role <> 'second_opinion' or public.dream_consent_granted(req, 'second_opinion')))
     and public.is_dream_scholar(auth.uid())
     and public.dream_consent_granted(req, 'scholar_access');
$$;

create or replace function public.can_see_dream_response(resp uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.dream_scholar_responses s where s.id = resp and (
    s.scholar_id = auth.uid()
    or (s.status in ('submitted', 'released') and public.is_dream_assignee(s.request_id))
    or (s.status = 'released' and public.is_dream_owner(s.request_id))));
$$;

-- ---------- Request lifecycle ----------
create or replace function public.before_dream_request()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare days integer;
begin
  if tg_op = 'INSERT' then
    perform public.throttle('dream_request', 3, 10);
    select retention_days into days from public.dream_privacy_preferences where user_id = new.user_id;
    new.created_at := now();
    new.retain_until := now() + make_interval(days => coalesce(days, 90));
    new.status := 'submitted';
    return new;
  end if;
  if new.dream_text is distinct from old.dream_text or new.question is distinct from old.question
     or new.user_id is distinct from old.user_id or new.language is distinct from old.language or new.created_at is distinct from old.created_at then
    raise exception 'a dream request cannot be edited; delete it and submit a new one' using errcode = 'P0001';
  end if;
  if auth.uid() = old.user_id then
    -- The submitter may withdraw, close an answered request, or shorten the retention period, nothing else.
    if new.status is distinct from old.status and not (
         (new.status = 'withdrawn' and old.status in ('submitted', 'assigned'))
      or (new.status = 'closed' and old.status = 'answered')) then
      raise exception 'that status change is not available to you' using errcode = 'P0001';
    end if;
    if new.retain_until > old.retain_until or new.retain_until <= now() then
      raise exception 'the retention period can only be shortened' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger dream_requests_before before insert or update on public.dream_requests for each row execute function public.before_dream_request();

create or replace function public.dream_status_history()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare r text := nullif(current_setting('qitl.dream_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.dream_request_status_history (request_id, from_status, to_status, changed_by) values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.dream_request_status_history (request_id, from_status, to_status, reason, changed_by) values (new.id, old.status, new.status, r, auth.uid());
  end if;
  return new;
end $$;
create trigger dream_requests_history after insert or update on public.dream_requests for each row execute function public.dream_status_history();
create trigger dream_requests_audit after insert or update or delete on public.dream_requests for each row execute function public.audit_redacted();

-- Submit a request and its scholar-access consent in one transaction. Runs as the caller: RLS applies.
create or replace function public.submit_dream_request(p_dream_text text, p_question text, p_language text, p_notice_version text)
returns uuid language plpgsql security invoker set search_path = public, extensions as $$
declare rid uuid;
begin
  insert into public.dream_requests (user_id, dream_text, question, language)
  values (auth.uid(), p_dream_text, nullif(btrim(p_question), ''), p_language) returning id into rid;
  insert into public.dream_request_consents (request_id, user_id, kind, granted, notice_version)
  values (rid, auth.uid(), 'scholar_access', true, p_notice_version);
  return rid;
end $$;

-- ---------- Assignment ----------
create or replace function public.before_dream_assignment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare req public.dream_requests%rowtype;
begin
  select * into req from public.dream_requests where id = new.request_id;
  if req.user_id = new.scholar_id then
    raise exception 'a scholar cannot be assigned to their own request' using errcode = 'P0001';
  end if;
  if not public.dream_consent_granted(new.request_id, 'scholar_access') then
    raise exception 'the submitter has not consented to scholar access' using errcode = 'P0001';
  end if;
  if new.role = 'second_opinion' then
    if not public.dream_consent_granted(new.request_id, 'second_opinion') then
      raise exception 'the submitter has not consented to a second opinion' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.dream_second_opinions o where o.request_id = new.request_id and o.status = 'requested') then
      raise exception 'no second opinion is waiting for a scholar' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.dream_scholar_responses s where s.request_id = new.request_id and s.scholar_id = new.scholar_id) then
      raise exception 'a second opinion comes from a scholar who has not already responded' using errcode = 'P0001';
    end if;
  elsif req.status not in ('submitted', 'assigned') then
    raise exception 'this request is not open for assignment' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger dream_assignments_before before insert on public.dream_request_assignments for each row execute function public.before_dream_assignment();

create or replace function public.after_dream_assignment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.role = 'second_opinion' then
    update public.dream_second_opinions set status = 'assigned' where request_id = new.request_id and status = 'requested';
  else
    update public.dream_requests set status = 'assigned' where id = new.request_id and status = 'submitted';
  end if;
  return new;
end $$;
create trigger dream_assignments_after after insert on public.dream_request_assignments for each row execute function public.after_dream_assignment();
create trigger dream_assignments_audit after insert or update or delete on public.dream_request_assignments for each row execute function public.audit_redacted();

-- ---------- Responses, review and release ----------
create or replace function public.guard_dream_response()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  arole text;
  rstatus text;
begin
  if tg_op = 'INSERT' then
    select a.role into arole from public.dream_request_assignments a where a.request_id = new.request_id and a.scholar_id = new.scholar_id;
    select status into rstatus from public.dream_requests where id = new.request_id;
    if arole is null or not public.is_dream_scholar(new.scholar_id) then
      raise exception 'only a qualified scholar assigned to this request can respond' using errcode = 'P0001';
    end if;
    if arole = 'reviewer' then
      raise exception 'a reviewer reviews responses and does not write one' using errcode = 'P0001';
    end if;
    if rstatus not in ('assigned', 'answered') then
      raise exception 'this request is not open for responses' using errcode = 'P0001';
    end if;
    if arole = 'second_opinion' then
      if new.second_opinion_id is null or not exists (select 1 from public.dream_second_opinions o where o.id = new.second_opinion_id and o.request_id = new.request_id and o.status = 'assigned') then
        raise exception 'a second opinion response must name the open second-opinion request' using errcode = 'P0001';
      end if;
    elsif new.second_opinion_id is not null then
      raise exception 'only the second-opinion scholar answers a second opinion' using errcode = 'P0001';
    end if;
  else
    if new.request_id is distinct from old.request_id or new.scholar_id is distinct from old.scholar_id or new.second_opinion_id is distinct from old.second_opinion_id then
      raise exception 'a response cannot be moved' using errcode = 'P0001';
    end if;
    if new.body_md is distinct from old.body_md or new.outcome is distinct from old.outcome then
      new.version := old.version + 1;
      new.review_status := 'pending';
      if new.status = 'released' then new.status := 'submitted'; end if;
    end if;
    new.updated_at := now();
  end if;
  if new.status = 'released' and (tg_op = 'INSERT' or old.status <> 'released') then
    if not exists (select 1 from public.dream_content_reviews r where r.response_id = new.id and r.response_version = new.version
                   and r.decision = 'approved' and r.reviewer_id <> new.scholar_id) then
      raise exception 'no independent review, no release' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger dream_responses_guard before insert or update on public.dream_scholar_responses for each row execute function public.guard_dream_response();
create trigger dream_responses_audit after insert or update or delete on public.dream_scholar_responses for each row execute function public.audit_redacted();

create or replace function public.after_dream_response()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'released' and old.status <> 'released' then
    update public.dream_requests set status = 'answered' where id = new.request_id and status = 'assigned';
    if new.second_opinion_id is not null then
      update public.dream_second_opinions set status = 'answered' where id = new.second_opinion_id and status = 'assigned';
    end if;
  end if;
  return new;
end $$;
create trigger dream_responses_after after update on public.dream_scholar_responses for each row execute function public.after_dream_response();

create or replace function public.apply_dream_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare s public.dream_scholar_responses%rowtype;
begin
  select * into s from public.dream_scholar_responses where id = new.response_id;
  if new.reviewer_id = s.scholar_id then
    raise exception 'a reviewer cannot review their own response' using errcode = 'P0001';
  end if;
  if s.status <> 'submitted' or s.version <> new.response_version then
    raise exception 'only the current submitted version can be reviewed' using errcode = 'P0001';
  end if;
  update public.dream_scholar_responses set review_status = new.decision where id = new.response_id and version = new.response_version;
  return new;
end $$;
create trigger dream_reviews_apply after insert on public.dream_content_reviews for each row execute function public.apply_dream_review();
create trigger dream_reviews_audit after insert or update or delete on public.dream_content_reviews for each row execute function public.audit_redacted();

-- ---------- Second opinions ----------
create or replace function public.guard_dream_second_opinion()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.dream_scholar_responses s where s.id = new.first_response_id and s.request_id = new.request_id and s.status = 'released') then
      raise exception 'a second opinion follows a released response' using errcode = 'P0001';
    end if;
    if not public.dream_consent_granted(new.request_id, 'second_opinion') then
      raise exception 'consent to share the request with a second scholar is needed first' using errcode = 'P0001';
    end if;
    new.status := 'requested';
  elsif auth.uid() = old.requested_by and new.status is distinct from old.status and not (new.status = 'withdrawn' and old.status in ('requested', 'assigned')) then
    raise exception 'that status change is not available to you' using errcode = 'P0001';
  elsif new.request_id is distinct from old.request_id or new.first_response_id is distinct from old.first_response_id or new.requested_by is distinct from old.requested_by then
    raise exception 'a second opinion cannot be moved' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger dream_second_opinions_guard before insert or update on public.dream_second_opinions for each row execute function public.guard_dream_second_opinion();
create trigger dream_second_opinions_audit after insert or update or delete on public.dream_second_opinions for each row execute function public.audit_redacted();

-- ---------- Administration: metadata only ----------
create or replace function public.dream_admin_queue()
returns table (id uuid, status text, language text, created_at timestamptz, retain_until timestamptz,
               scholar_access boolean, second_opinion_consent boolean, open_second_opinion uuid, assignees jsonb)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.has_role('admin') then
    raise exception 'administrators only' using errcode = '42501';
  end if;
  return query
    select r.id, r.status, r.language, r.created_at, r.retain_until,
           public.dream_consent_granted(r.id, 'scholar_access'), public.dream_consent_granted(r.id, 'second_opinion'),
           (select o.id from public.dream_second_opinions o where o.request_id = r.id and o.status = 'requested' limit 1),
           coalesce((select jsonb_agg(jsonb_build_object('scholar_id', a.scholar_id, 'role', a.role, 'assigned_at', a.assigned_at) order by a.assigned_at)
                     from public.dream_request_assignments a where a.request_id = r.id), '[]'::jsonb)
    from public.dream_requests r
    where r.status not in ('withdrawn')
    order by r.created_at
    limit 500;
end $$;

create or replace function public.dream_admin_set_status(p_request uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cur text;
begin
  if not public.has_role('admin') then
    raise exception 'administrators only' using errcode = '42501';
  end if;
  select status into cur from public.dream_requests where id = p_request for update;
  if cur is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if not ((p_status = 'declined' and cur in ('submitted', 'assigned')) or (p_status = 'closed' and cur = 'answered')) then
    raise exception 'cannot move a % request to %', cur, p_status using errcode = 'P0001';
  end if;
  perform set_config('qitl.dream_reason', coalesce(p_reason, ''), true);
  update public.dream_requests set status = p_status where id = p_request;
  perform set_config('qitl.dream_reason', '', true);
end $$;

-- ---------- Retention and export ----------
-- Run daily by a trusted scheduler with the service role (e.g. pg_cron or a server job); deletes cascade to every child row.
create or replace function public.purge_expired_dream_requests()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  delete from public.dream_requests where retain_until < now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.export_my_dream_data()
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'exported_at', now(),
    'preferences', (select to_jsonb(p) from public.dream_privacy_preferences p where p.user_id = auth.uid()),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'request', to_jsonb(r),
        'consents', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.dream_request_consents c where c.request_id = r.id), '[]'::jsonb),
        'status_history', coalesce((select jsonb_agg(to_jsonb(h) order by h.changed_at) from public.dream_request_status_history h where h.request_id = r.id), '[]'::jsonb),
        'second_opinions', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.dream_second_opinions o where o.request_id = r.id), '[]'::jsonb),
        'responses', coalesce((
          select jsonb_agg((to_jsonb(s) - 'review_status') || jsonb_build_object('references',
                   coalesce((select jsonb_agg(to_jsonb(l)) from public.dream_reference_links l where l.response_id = s.id), '[]'::jsonb)) order by s.created_at)
          from public.dream_scholar_responses s where s.request_id = r.id and s.status = 'released'), '[]'::jsonb)
      ) order by r.created_at)
      from public.dream_requests r where r.user_id = auth.uid()), '[]'::jsonb));
$$;

-- ---------- Row level security ----------
do $$
declare t text;
begin
  foreach t in array array['dream_privacy_preferences', 'dream_requests', 'dream_request_consents', 'dream_request_assignments',
                           'dream_scholar_responses', 'dream_second_opinions', 'dream_reference_links', 'dream_request_status_history',
                           'dream_content_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
-- Nothing here is readable without signing in.
grant select, insert, update, delete on public.dream_privacy_preferences to authenticated;
grant select, insert, update, delete on public.dream_requests to authenticated;
grant select, insert on public.dream_request_consents to authenticated;
grant select, insert, delete on public.dream_request_assignments to authenticated;
grant select, insert, update on public.dream_scholar_responses to authenticated;
grant select, insert, update on public.dream_second_opinions to authenticated;
grant select, insert, delete on public.dream_reference_links to authenticated;
grant select on public.dream_request_status_history to authenticated;
grant select, insert on public.dream_content_reviews to authenticated;

create policy own_prefs on public.dream_privacy_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy read_own_or_assigned on public.dream_requests for select to authenticated using (user_id = auth.uid() or public.is_dream_assignee(id));
create policy submit_own on public.dream_requests for insert to authenticated with check (user_id = auth.uid() and status = 'submitted');
create policy update_own on public.dream_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy delete_own on public.dream_requests for delete to authenticated using (user_id = auth.uid());

create policy read_own on public.dream_request_consents for select to authenticated using (user_id = auth.uid());
create policy give_own on public.dream_request_consents for insert to authenticated with check (user_id = auth.uid() and public.is_dream_owner(request_id));

create policy read_assignments on public.dream_request_assignments for select to authenticated using (
  public.has_role('admin') or scholar_id = auth.uid() or public.is_dream_owner(request_id) or public.is_dream_assignee(request_id));
create policy admin_assign on public.dream_request_assignments for insert to authenticated
  with check (public.has_role('admin') and assigned_by = auth.uid() and public.is_dream_scholar(scholar_id));
create policy admin_unassign on public.dream_request_assignments for delete to authenticated using (public.has_role('admin'));

create policy read_responses on public.dream_scholar_responses for select to authenticated using (
  scholar_id = auth.uid()
  or (status in ('submitted', 'released') and public.is_dream_assignee(request_id))
  or (status = 'released' and public.is_dream_owner(request_id)));
create policy write_own on public.dream_scholar_responses for insert to authenticated
  with check (scholar_id = auth.uid() and status in ('draft', 'submitted') and public.is_dream_assignee(request_id));
create policy edit_own on public.dream_scholar_responses for update to authenticated
  using (scholar_id = auth.uid() and public.is_dream_assignee(request_id)) with check (scholar_id = auth.uid());

create policy read_second_opinions on public.dream_second_opinions for select to authenticated using (
  requested_by = auth.uid() or public.has_role('admin') or public.is_dream_assignee(request_id));
create policy ask_second_opinion on public.dream_second_opinions for insert to authenticated
  with check (requested_by = auth.uid() and public.is_dream_owner(request_id));
create policy withdraw_own on public.dream_second_opinions for update to authenticated using (requested_by = auth.uid()) with check (requested_by = auth.uid());

create policy read_links on public.dream_reference_links for select to authenticated using (public.can_see_dream_response(response_id));
create policy link_own on public.dream_reference_links for insert to authenticated with check (
  exists (select 1 from public.dream_scholar_responses s where s.id = response_id and s.scholar_id = auth.uid() and s.status <> 'released'));
create policy unlink_own on public.dream_reference_links for delete to authenticated using (
  exists (select 1 from public.dream_scholar_responses s where s.id = response_id and s.scholar_id = auth.uid() and s.status <> 'released'));

create policy read_history on public.dream_request_status_history for select to authenticated using (
  public.is_dream_owner(request_id) or public.is_dream_assignee(request_id) or public.has_role('admin'));

create policy read_reviews on public.dream_content_reviews for select to authenticated using (
  reviewer_id = auth.uid() or exists (select 1 from public.dream_scholar_responses s where s.id = response_id and s.scholar_id = auth.uid()));
create policy review_assigned on public.dream_content_reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and exists (select 1 from public.dream_scholar_responses s where s.id = response_id and public.is_dream_assignee(s.request_id)));

-- Functions: API-callable ones are granted explicitly; trigger and internal helpers are not callable through the API.
revoke execute on function public.guard_dream_qualification(), public.audit_redacted(), public.before_dream_request(),
  public.dream_status_history(), public.before_dream_assignment(), public.after_dream_assignment(), public.guard_dream_response(),
  public.after_dream_response(), public.apply_dream_review(), public.guard_dream_second_opinion(),
  public.dream_consent_granted(uuid, text), public.purge_expired_dream_requests() from public, anon, authenticated;
revoke execute on function public.submit_dream_request(text, text, text, text), public.export_my_dream_data(),
  public.dream_admin_queue(), public.dream_admin_set_status(uuid, text, text) from public, anon;
grant execute on function public.submit_dream_request(text, text, text, text), public.export_my_dream_data(),
  public.dream_admin_queue(), public.dream_admin_set_status(uuid, text, text) to authenticated;
grant execute on function public.purge_expired_dream_requests() to service_role;
