-- Mufti Q&A. A reader asks (publicly or privately); an admin assigns verified muftis; each mufti answers with
-- citations; answers are independently reviewed before they are public. Several answers may stand side by side with
-- their evidence: there is no "accepted answer" and no automatic winner. Private questions are visible only to the
-- asker, the assigned muftis and staff.

create table public.mufti_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  madhhab text check (madhhab in ('hanafi', 'maliki', 'shafii', 'hanbali', 'other')),
  credentials_md text not null, -- institutions, ijazat, positions, as stated by the mufti
  verified_by uuid references auth.users (id),
  verified_at timestamptz,
  verification_note text, -- how the credentials were checked
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((verified_at is null) = (verified_by is null))
);

create or replace function public.is_verified_mufti(u uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.mufti_profiles where user_id = u and verified_at is not null and active)
     and exists (select 1 from public.role_assignments where user_id = u and role = 'mufti');
$$;

create table public.mufti_questions (
  id uuid primary key default gen_random_uuid(),
  asker_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 8 and 200),
  body text not null check (char_length(body) between 20 and 5000),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  topic_type text check (topic_type in ('quran_verse', 'hadith', 'person', 'event', 'creation', 'general')),
  topic_ref text,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'assigned', 'answered', 'closed', 'rejected')),
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mufti_assignments (
  question_id uuid not null references public.mufti_questions (id) on delete cascade,
  mufti_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid not null references auth.users (id),
  assigned_at timestamptz not null default now(),
  primary key (question_id, mufti_id)
);

create table public.mufti_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.mufti_questions (id) on delete cascade,
  mufti_id uuid not null references auth.users (id),
  body_md text not null check (char_length(body_md) between 20 and 20000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'withdrawn')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'changes_requested', 'rejected')),
  review_note text, -- the independent reviewer's public note, if any
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or review_status = 'approved')
);

create table public.mufti_answer_citations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.mufti_answers (id) on delete cascade,
  kind text not null check (kind in ('quran', 'hadith', 'scholar')),
  quran_surah smallint check (quran_surah between 1 and 114),
  quran_ayah_from smallint,
  quran_ayah_to smallint,
  hadith_id uuid references public.hadith_entries (id),
  work text, -- for a scholarly work: title, edition, volume/page
  locator text,
  note text,
  check ((kind = 'quran') = (quran_surah is not null and quran_ayah_from is not null)),
  check (kind <> 'hadith' or hadith_id is not null),
  check (kind <> 'scholar' or work is not null)
);

create table public.mufti_answer_reviews (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.mufti_answers (id) on delete cascade,
  answer_version integer not null,
  reviewer_id uuid not null references auth.users (id),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  note text,
  created_at timestamptz not null default now()
);

create table public.mufti_question_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.mufti_questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ---------- Rules ----------
create or replace function public.can_see_question(qid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.mufti_questions q where q.id = qid and (
      (q.visibility = 'public' and q.status in ('accepted', 'assigned', 'answered', 'closed'))
      or q.asker_id = auth.uid()
      or public.is_staff() or public.has_role('moderator')
      or exists (select 1 from public.mufti_assignments a where a.question_id = q.id and a.mufti_id = auth.uid())));
$$;

-- An answer is written only by a verified mufti assigned to the question; a reviewer never reviews their own answer;
-- an edited answer needs a new review.
create or replace function public.guard_mufti_answer()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_verified_mufti(new.mufti_id) or not exists (select 1 from public.mufti_assignments where question_id = new.question_id and mufti_id = new.mufti_id) then
      raise exception 'only a verified mufti assigned to this question can answer it' using errcode = 'P0001';
    end if;
  elsif new.body_md is distinct from old.body_md then
    new.version := old.version + 1;
    new.review_status := 'pending';
    if new.status = 'published' then new.status := 'submitted'; end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not exists (select 1 from public.mufti_answer_citations where answer_id = new.id) then
      raise exception 'an answer needs at least one citation before it is published' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.mufti_answer_reviews r where r.answer_id = new.id and r.answer_version = new.version and r.decision = 'approved' and r.reviewer_id <> new.mufti_id) then
      raise exception 'no independent review, no publish' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger mufti_answers_guard before insert or update on public.mufti_answers for each row execute function public.guard_mufti_answer();
create trigger mufti_answers_audit after insert or update or delete on public.mufti_answers for each row execute function public.audit();
create trigger mufti_questions_touch before update on public.mufti_questions for each row execute function public.touch_updated_at();

create or replace function public.apply_answer_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.reviewer_id = (select mufti_id from public.mufti_answers where id = new.answer_id) then
    raise exception 'a reviewer cannot review their own answer' using errcode = 'P0001';
  end if;
  update public.mufti_answers set review_status = new.decision, review_note = coalesce(new.note, review_note)
  where id = new.answer_id and version = new.answer_version;
  return new;
end $$;
create trigger mufti_answer_reviews_apply after insert on public.mufti_answer_reviews for each row execute function public.apply_answer_review();
revoke execute on function public.guard_mufti_answer(), public.apply_answer_review() from public, anon, authenticated;

-- ---------- Access ----------
do $$
declare t text;
begin
  foreach t in array array['mufti_profiles', 'mufti_questions', 'mufti_assignments', 'mufti_answers', 'mufti_answer_citations', 'mufti_answer_reviews', 'mufti_question_follows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
grant select on public.mufti_profiles, public.mufti_questions, public.mufti_answers, public.mufti_answer_citations to anon, authenticated;
grant insert, update on public.mufti_profiles, public.mufti_questions, public.mufti_answers to authenticated;
grant insert, delete on public.mufti_assignments, public.mufti_answer_citations to authenticated;
grant select on public.mufti_assignments, public.mufti_answer_reviews to authenticated;
grant insert on public.mufti_answer_reviews to authenticated;
grant select, insert, delete on public.mufti_question_follows to authenticated;

create policy read_verified on public.mufti_profiles for select using (verified_at is not null or user_id = auth.uid() or public.is_staff());
create policy apply_self on public.mufti_profiles for insert to authenticated with check (user_id = auth.uid() and verified_at is null);
create policy edit_self_or_admin on public.mufti_profiles for update to authenticated
  using (user_id = auth.uid() or public.has_role('admin'))
  with check (public.has_role('admin') or (user_id = auth.uid() and verified_at is null)); -- only an admin verifies

create policy read_visible on public.mufti_questions for select using (asker_id = auth.uid() or public.can_see_question(id));
create policy ask on public.mufti_questions for insert to authenticated with check (asker_id = auth.uid() and status = 'submitted');
create policy staff_moderate on public.mufti_questions for update to authenticated
  using (public.has_role('moderator') or public.has_role('admin')) with check (public.has_role('moderator') or public.has_role('admin'));

create policy read_assignments on public.mufti_assignments for select to authenticated using (public.can_see_question(question_id));
create policy admin_assign on public.mufti_assignments for insert to authenticated
  with check (public.has_role('admin') and assigned_by = auth.uid() and public.is_verified_mufti(mufti_id));
create policy admin_unassign on public.mufti_assignments for delete to authenticated using (public.has_role('admin'));

create policy read_answers on public.mufti_answers for select using (
  mufti_id = auth.uid() or public.is_staff() or (status = 'published' and public.can_see_question(question_id)));
create policy write_own on public.mufti_answers for insert to authenticated with check (mufti_id = auth.uid() and status in ('draft', 'submitted'));
create policy edit_own on public.mufti_answers for update to authenticated using (mufti_id = auth.uid() or public.has_role('scholarly_reviewer'))
  with check (mufti_id = auth.uid() or public.has_role('scholarly_reviewer'));

create policy read_citations on public.mufti_answer_citations for select using (
  exists (select 1 from public.mufti_answers a where a.id = answer_id and (a.mufti_id = auth.uid() or public.is_staff() or (a.status = 'published' and public.can_see_question(a.question_id)))));
create policy cite_own on public.mufti_answer_citations for insert to authenticated with check (
  exists (select 1 from public.mufti_answers a where a.id = answer_id and a.mufti_id = auth.uid() and a.status <> 'published'));
create policy uncite_own on public.mufti_answer_citations for delete to authenticated using (
  exists (select 1 from public.mufti_answers a where a.id = answer_id and a.mufti_id = auth.uid() and a.status <> 'published'));

create policy staff_read on public.mufti_answer_reviews for select to authenticated using (public.is_staff() or reviewer_id = auth.uid());
create policy reviewer_insert on public.mufti_answer_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and (public.has_role('scholarly_reviewer') or public.is_verified_mufti(auth.uid())));

create policy own_follows on public.mufti_question_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_question(question_id));
