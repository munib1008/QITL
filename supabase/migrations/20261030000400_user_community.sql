set search_path = public, extensions;

-- Personal data (bookmarks, progress, private notes, follows, notifications) and moderated discussion.

-- ---------- Personal ----------
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type public.content_type not null,
  target_id text not null check (target_id ~ '^[A-Za-z0-9:_.-]{1,120}$'),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table public.reading_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  percent numeric(5, 2) not null check (percent between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create or replace function public.progress_complete()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.percent >= 100 and new.completed_at is null then new.completed_at := now(); end if;
  if new.percent < 100 then new.completed_at := null; end if;
  return new;
end $$;
create trigger reading_progress_complete before insert or update on public.reading_progress for each row execute function public.progress_complete();

-- Private by default and by design: only the owner can read; never audited, never logged.
create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type public.content_type not null,
  target_id text not null check (target_id ~ '^[A-Za-z0-9:_.-]{1,120}$'),
  body text not null default '' check (char_length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create trigger private_notes_touch before update on public.private_notes for each row execute function public.touch_updated_at();

create table public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.saved_collection_items (
  collection_id uuid not null references public.saved_collections (id) on delete cascade,
  bookmark_id uuid not null references public.bookmarks (id) on delete cascade,
  primary key (collection_id, bookmark_id)
);

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  digest text not null default 'weekly' check (digest in ('off', 'daily', 'weekly')),
  email_replies boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reply', 'thread_activity', 'moderation', 'correction', 'system')),
  discussion_id uuid,
  comment_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz
);
create index notifications_user on public.notifications (user_id, created_at desc);

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Discussion ----------
create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  content_type public.content_type not null,
  content_id text not null check (content_id ~ '^[A-Za-z0-9:_.-]{1,120}$'),
  claim_id uuid references public.evidence_claims (id) on delete set null,
  title text not null check (char_length(title) between 4 and 160),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'locked', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index discussions_content on public.discussions (content_type, content_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete set null, -- replies outlive a deleted parent
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 5000),
  citation text check (char_length(citation) <= 80),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_discussion on public.comments (discussion_id, created_at);
create index comments_author_time on public.comments (author_id, created_at desc);

create table public.comment_revisions (
  id bigint generated always as identity primary key,
  comment_id uuid not null references public.comments (id) on delete cascade,
  previous_body text not null,
  edited_at timestamptz not null default now()
);

create table public.reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('helpful')),
  primary key (comment_id, user_id, kind)
);

create table public.discussion_follows (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, discussion_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'discussion')),
  target_id uuid not null,
  reason text not null check (reason in ('misleading', 'disrespectful', 'spam', 'personal_information', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open on public.reports (status, created_at) where status = 'open';

-- Moderation log keeps ids and decisions only, never copies of comment bodies or reporter details.
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references auth.users (id),
  target_type text not null check (target_type in ('comment', 'discussion', 'user')),
  target_id uuid not null,
  action text not null check (action in ('hide', 'remove', 'restore', 'dismiss_reports', 'lock', 'ban', 'unban')),
  reason_code text not null check (reason_code in ('misleading', 'disrespectful', 'spam', 'personal_information', 'other', 'appeal_upheld')),
  created_at timestamptz not null default now()
);

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason_code text not null,
  until timestamptz, -- null = until lifted
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);
create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  moderation_action_id uuid references public.moderation_actions (id),
  ban_id uuid references public.bans (id),
  body text not null check (char_length(body) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'upheld', 'denied')),
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index rate_limit_events_user on public.rate_limit_events (user_id, action, at desc);

create or replace function public.is_banned(uid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.bans b where b.user_id = uid and b.lifted_at is null and (b.until is null or b.until > now()));
$$;

-- Anti-spam throttle, enforced in the database so no client can bypass it.
create or replace function public.throttle(action text, per_minute integer, per_hour integer)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  m integer;
  h integer;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select count(*) filter (where at > now() - interval '1 minute'), count(*) into m, h
  from public.rate_limit_events where user_id = uid and rate_limit_events.action = throttle.action and at > now() - interval '1 hour';
  if m >= per_minute or h >= per_hour then
    raise exception 'rate_limited: too many % actions; try again later', action using errcode = 'P0429';
  end if;
  insert into public.rate_limit_events (user_id, action) values (uid, action);
end $$;

create or replace function public.before_comment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if public.is_banned(new.author_id) then raise exception 'posting is suspended for this account' using errcode = '42501'; end if;
    if exists (select 1 from public.discussions d where d.id = new.discussion_id and d.status <> 'open') then
      raise exception 'this discussion is closed' using errcode = 'P0001';
    end if;
    if new.parent_id is not null and not exists (select 1 from public.comments p where p.id = new.parent_id and p.discussion_id = new.discussion_id) then
      raise exception 'reply must belong to the same discussion' using errcode = 'P0001';
    end if;
    perform public.throttle('comment', 5, 60);
    new.status := 'visible';
    new.edited_at := null;
  elsif tg_op = 'UPDATE' and new.body is distinct from old.body then
    insert into public.comment_revisions (comment_id, previous_body) values (old.id, old.body);
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger comments_before before insert or update on public.comments for each row execute function public.before_comment();

create or replace function public.before_discussion()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.is_banned(new.created_by) then raise exception 'posting is suspended for this account' using errcode = '42501'; end if;
  perform public.throttle('discussion', 2, 10);
  new.status := 'open';
  return new;
end $$;
create trigger discussions_before before insert on public.discussions for each row execute function public.before_discussion();

create or replace function public.before_report()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.throttle('report', 5, 30);
  new.status := 'open';
  return new;
end $$;
create trigger reports_before before insert on public.reports for each row execute function public.before_report();

-- Three open reports hide a comment until a moderator reviews it (it keeps its place, with an explanation).
create or replace function public.after_report()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.target_type = 'comment' and (select count(*) from public.reports where target_type = 'comment' and target_id = new.target_id and status = 'open') >= 3 then
    update public.comments set status = 'hidden' where id = new.target_id and status = 'visible';
  end if;
  return new;
end $$;
create trigger reports_after after insert on public.reports for each row execute function public.after_report();

-- Followers (and the parent's author) are notified of new comments.
create or replace function public.after_comment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.notifications (user_id, kind, discussion_id, comment_id)
  select f.user_id, 'thread_activity', new.discussion_id, new.id
  from public.discussion_follows f where f.discussion_id = new.discussion_id and f.user_id <> new.author_id;
  if new.parent_id is not null then
    insert into public.notifications (user_id, kind, discussion_id, comment_id)
    select p.author_id, 'reply', new.discussion_id, new.id from public.comments p
    where p.id = new.parent_id and p.author_id <> new.author_id
      and not exists (select 1 from public.discussion_follows f where f.discussion_id = new.discussion_id and f.user_id = p.author_id);
  end if;
  -- Authors follow their own threads.
  insert into public.discussion_follows (user_id, discussion_id) values (new.author_id, new.discussion_id) on conflict do nothing;
  return new;
end $$;
create trigger comments_after after insert on public.comments for each row execute function public.after_comment();

-- Moderator action applied atomically with its log entry and report resolution.
create or replace function public.moderate(p_target_type text, p_target_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role('moderator') then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_target_type = 'comment' then
    update public.comments set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'visible' else status end
    where id = p_target_id;
  elsif p_target_type = 'discussion' then
    update public.discussions set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'open' when 'lock' then 'locked' else status end
    where id = p_target_id;
  end if;
  update public.reports set status = case when p_action in ('restore', 'dismiss_reports') then 'dismissed' else 'actioned' end
  where target_type = p_target_type and target_id = p_target_id and status = 'open';
  insert into public.moderation_actions (moderator_id, target_type, target_id, action, reason_code)
  values (auth.uid(), p_target_type, p_target_id, p_action, p_reason);
end $$;

-- Public view of comments: hidden/removed bodies are blanked for everyone except moderators.
create view public.comments_public with (security_invoker = true) as
select c.id, c.discussion_id, c.parent_id, c.status, c.created_at, c.edited_at,
  case when c.status = 'visible' or public.has_role('moderator') then c.body end as body,
  case when c.status = 'visible' then c.citation end as citation,
  case when c.status = 'visible' then p.display_name else null end as author_name,
  c.author_id = auth.uid() as is_mine,
  c.author_id = auth.uid() and c.status = 'visible' and c.created_at > now() - interval '30 minutes' as can_edit
from public.comments c left join public.profiles p on p.id = c.author_id;

-- ---------- Platform ----------
create table public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  enabled boolean not null default false,
  description text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
insert into public.feature_flags (key, enabled, description) values
  ('accounts', false, 'Sign-in, bookmarks, notes and progress'),
  ('discussions', false, 'Public discussion threads and comments'),
  ('atlas.map', false, 'Interactive MapLibre atlas (needs a tile provider)'),
  ('quran.translations', false, 'Licensed translations beside the Arabic'),
  ('hadith.explorer', false, 'Hadith collection pages (needs a licensed edition)'),
  ('last_hour', false, 'Last Hour explorer');

-- Owner-editable presentation text (headings, intros). Religious claims never live here.
create table public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy', 'community_guidelines')),
  version text not null,
  body_md text not null,
  published_at timestamptz,
  unique (kind, version)
);
create table public.legal_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.legal_documents (id),
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

create table public.data_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'requested' check (status in ('requested', 'running', 'done', 'failed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  result_path text
);
create unique index data_jobs_one_open on public.data_jobs (user_id, kind) where status in ('requested', 'running');

-- Everything a user owns, as JSON, for "Export my data". Runs as the caller; RLS limits it to their rows.
create or replace function public.export_my_data()
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'bookmarks', coalesce((select jsonb_agg(to_jsonb(b)) from public.bookmarks b where b.user_id = auth.uid()), '[]'),
    'reading_progress', coalesce((select jsonb_agg(to_jsonb(r)) from public.reading_progress r where r.user_id = auth.uid()), '[]'),
    'notes', coalesce((select jsonb_agg(to_jsonb(n)) from public.private_notes n where n.user_id = auth.uid()), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'discussion_id', c.discussion_id, 'body', c.body, 'created_at', c.created_at, 'status', c.status)) from public.comments c where c.author_id = auth.uid()), '[]'),
    'follows', coalesce((select jsonb_agg(to_jsonb(f)) from public.discussion_follows f where f.user_id = auth.uid()), '[]'),
    'notification_prefs', (select to_jsonb(np) - 'unsubscribe_token' from public.notification_prefs np where np.user_id = auth.uid())
  );
$$;

-- One-click unsubscribe from a digest email, by token, without signing in.
create or replace function public.unsubscribe(token uuid)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.notification_prefs set digest = 'off', email_replies = false, updated_at = now() where unsubscribe_token = token;
  return found;
end $$;
