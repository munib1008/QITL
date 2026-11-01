-- In-app notifications for Mufti Q&A (backlog 27a). The existing `notifications` table (discussion replies) gets a
-- title, a same-site link and a delivery channel; the Q&A triggers below write rows into it:
--   * the asker, when an answer to their question is published, and when their question is closed;
--   * a mufti, when a question is assigned to them;
--   * an applicant, when staff move their scholar application (migration 20261031002610).
-- Text is a title (the question's own title, which the recipient is already allowed to see) and a path. Never an answer,
-- a note or a name. `channel` is 'in_app' for every row written here; an email sender (blocked on a provider) can read the
-- unsent rows (emailed_at is null) or write 'email' rows later without a schema change.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in
  ('reply', 'thread_activity', 'moderation', 'correction', 'system', 'mufti_assigned', 'mufti_answered', 'mufti_closed', 'mufti_application'));
alter table public.notifications add column if not exists channel text not null default 'in_app' check (channel in ('in_app', 'email'));
alter table public.notifications add column if not exists title text check (title is null or char_length(title) between 1 and 160);
alter table public.notifications add column if not exists link text check (link is null or (link ~ '^/[A-Za-z0-9_./-]{0,200}$' and link !~ '^//' and link !~ '\.\.'));
create index if not exists notifications_unread on public.notifications (user_id, created_at desc) where read_at is null;

-- Readers mark their own rows read and change nothing else; rows are written only by the triggers below.
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify_mufti_assigned()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare q text;
begin
  select title into q from public.mufti_questions where id = new.question_id;
  insert into public.notifications (user_id, kind, channel, title, link)
  values (new.mufti_id, 'mufti_assigned', 'in_app', nullif(left(coalesce(q, ''), 160), ''), '/mufti/questions/' || new.question_id::text);
  return new;
end $$;
create trigger mufti_assignments_notify after insert on public.mufti_assignments for each row execute function public.notify_mufti_assigned();

create or replace function public.notify_mufti_answer_published()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare asker uuid; q text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select asker_id, title into asker, q from public.mufti_questions where id = new.question_id;
    if asker is not null then
      insert into public.notifications (user_id, kind, channel, title, link)
      values (asker, 'mufti_answered', 'in_app', nullif(left(coalesce(q, ''), 160), ''), '/community/questions/' || new.question_id::text);
    end if;
  end if;
  return new;
end $$;
create trigger mufti_answers_notify after insert or update of status on public.mufti_answers for each row execute function public.notify_mufti_answer_published();

create or replace function public.notify_mufti_question_closed()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    insert into public.notifications (user_id, kind, channel, title, link)
    values (new.asker_id, 'mufti_closed', 'in_app', left(new.title, 160), '/community/questions/' || new.id::text);
  end if;
  return new;
end $$;
create trigger mufti_questions_notify after update of status on public.mufti_questions for each row execute function public.notify_mufti_question_closed();

revoke execute on function public.notify_mufti_assigned(), public.notify_mufti_answer_published(), public.notify_mufti_question_closed() from public, anon, authenticated;
