set search_path = public, extensions;

-- The AI-draft pathway (docs/AI_DRAFT_PATHWAY.md). Three SEPARATE facts about a story, never one boolean:
--   visibility          who can read it            private_draft | public_ai_draft | public_approved | archived
--   integrity_status    automated source checks    pending | passed | failed | needs_investigation
--   scholarly_status    human religious review     not_reviewed | under_review | changes_requested | approved | rejected | invalidated
-- The existing publish guards are NOT relaxed: status = 'published' still needs a version-bound scholarly approval and no
-- self-review. A public AI draft is a different, explicitly labelled pathway: it is read only through the two functions
-- below (no RLS policy on stories/chapters/claims is widened), only after the deterministic integrity check passed, and it
-- can never carry a scholar-approved state unless a real editorial review exists.

alter table public.stories
  add column visibility text not null default 'private_draft' check (visibility in ('private_draft', 'public_ai_draft', 'public_approved', 'archived')),
  add column integrity_status text not null default 'pending' check (integrity_status in ('pending', 'passed', 'failed', 'needs_investigation')),
  add column integrity_report jsonb,
  add column integrity_checked_at timestamptz,
  add column scholarly_status text not null default 'not_reviewed' check (scholarly_status in ('not_reviewed', 'under_review', 'changes_requested', 'approved', 'rejected', 'invalidated')),
  add column ai_generated boolean not null default false,
  add column ai_model text check (ai_model is null or char_length(ai_model) <= 80),
  add column prompt_version text check (prompt_version is null or char_length(prompt_version) <= 40),
  add column ai_published_at timestamptz;
create index stories_visibility on public.stories (visibility, integrity_status);

-- ---------- Guard ----------
create or replace function public.stories_ai_guard()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- integrity 'passed' is written only by run_ai_draft_integrity (which sets a transaction-local flag).
  if new.integrity_status = 'passed' and (tg_op = 'INSERT' or old.integrity_status is distinct from 'passed')
     and coalesce(current_setting('qitl.integrity_fn', true), '') <> '1' then
    raise exception 'integrity can only be marked passed by the automated check' using errcode = 'P0001';
  end if;
  -- a scholar-approved state needs a real approving editorial review of this story.
  if new.scholarly_status = 'approved' and (tg_op = 'INSERT' or old.scholarly_status is distinct from 'approved')
     and not public.latest_review_approved('story', new.id) then
    raise exception 'scholarly approval needs an approving editorial review' using errcode = 'P0001';
  end if;
  if new.visibility = 'public_approved' and new.status <> 'published' then
    raise exception 'public_approved is the published, scholar-approved state' using errcode = 'P0001';
  end if;
  if new.visibility = 'public_ai_draft' then
    if not new.ai_generated then raise exception 'only AI-authored text uses the AI-draft pathway' using errcode = 'P0001'; end if;
    if new.integrity_status <> 'passed' then raise exception 'a public AI draft needs a passed source-integrity check' using errcode = 'P0001'; end if;
    if new.scholarly_status in ('rejected') then raise exception 'a rejected draft is not public' using errcode = 'P0001'; end if;
  end if;
  -- an edit after approval never inherits the approval; the integrity check must run again.
  if tg_op = 'UPDATE' and (new.title, new.summary) is distinct from (old.title, old.summary) then
    if old.scholarly_status = 'approved' then new.scholarly_status := 'invalidated'; end if;
    if new.integrity_status = 'passed' and old.integrity_status = 'passed' and coalesce(current_setting('qitl.integrity_fn', true), '') <> '1' then
      new.integrity_status := 'pending';
      if new.visibility = 'public_ai_draft' then new.visibility := 'private_draft'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger stories_z_ai_guard before insert or update on public.stories for each row execute function public.stories_ai_guard();

-- A chapter or claim edit also sends a public AI draft back for re-checking.
create or replace function public.ai_draft_content_changed()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare sid uuid;
begin
  sid := coalesce(new.story_id, old.story_id);
  update public.stories set integrity_status = 'pending', visibility = case when visibility = 'public_ai_draft' then 'private_draft' else visibility end,
    scholarly_status = case when scholarly_status = 'approved' then 'invalidated' else scholarly_status end
  where id = sid and ai_generated and (integrity_status <> 'pending' or visibility = 'public_ai_draft' or scholarly_status = 'approved')
    and coalesce(current_setting('qitl.integrity_fn', true), '') <> '1' and coalesce(current_setting('qitl.import', true), '') <> '1';
  return coalesce(new, old);
end $$;
create trigger chapters_ai_changed after update of body_md, summary_md, deep_md, kids_md, lessons_md, unknowns_md, title on public.chapters for each row execute function public.ai_draft_content_changed();

-- ---------- Deterministic integrity check ----------
create or replace function public.compute_ai_draft_integrity(p_story uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  fails jsonb := '[]'::jsonb;
  investigate jsonb := '[]'::jsonb;
  n integer;
begin
  if not exists (select 1 from public.stories where id = p_story) then
    return jsonb_build_object('passed', false, 'failures', jsonb_build_array('story not found'), 'investigate', '[]'::jsonb);
  end if;
  select count(*) into n from public.chapters where story_id = p_story;
  if n = 0 then fails := fails || to_jsonb('the story has no chapters'::text); end if;
  select count(*) into n from public.chapters where story_id = p_story and char_length(btrim(coalesce(body_md, ''))) < 40;
  if n > 0 then fails := fails || to_jsonb(n || ' chapter(s) have no substantive text'); end if;
  select count(*) into n from public.chapters c where c.story_id = p_story and not exists (select 1 from public.chapter_claims cc where cc.chapter_id = c.id);
  if n > 0 then fails := fails || to_jsonb(n || ' chapter(s) carry no evidence claim'); end if;
  select count(*) into n from public.chapter_claims cc join public.chapters c on c.id = cc.chapter_id
    where c.story_id = p_story and not exists (select 1 from public.claim_references r where r.claim_id = cc.claim_id);
  if n > 0 then fails := fails || to_jsonb(n || ' claim(s) have no source reference'); end if;
  select count(*) into n from public.claim_references r join public.chapter_claims cc on cc.claim_id = r.claim_id join public.chapters c on c.id = cc.chapter_id
    where c.story_id = p_story and r.kind = 'quran' and (r.quran_surah is null or r.quran_ayah_from is null
      or not exists (select 1 from public.quran_verses v where v.surah_id = r.quran_surah and v.ayah_no = r.quran_ayah_from)
      or not exists (select 1 from public.quran_verses v where v.surah_id = r.quran_surah and v.ayah_no = coalesce(r.quran_ayah_to, r.quran_ayah_from)));
  if n > 0 then fails := fails || to_jsonb(n || ' Quran reference(s) do not match a verse in the loaded Quran text'); end if;
  -- Hadith may be cited only with an individual grading record; anything else needs a person to look.
  select count(*) into n from public.claim_references r join public.chapter_claims cc on cc.claim_id = r.claim_id join public.chapters c on c.id = cc.chapter_id
    where c.story_id = p_story and r.kind = 'hadith' and (r.hadith_id is null or r.hadith_grading_id is null);
  if n > 0 then investigate := investigate || to_jsonb(n || ' hadith reference(s) lack a record or grading'); end if;
  select count(*) into n from public.chapters c where c.story_id = p_story and
    (coalesce(c.body_md, '') || coalesce(c.deep_md, '') || coalesce(c.kids_md, '')) ~* '(\mhe said\M|\mshe said\M|\mreplied\M)\s*:\s*["“]';
  if n > 0 then investigate := investigate || to_jsonb(n || ' chapter(s) contain what looks like invented dialogue'); end if;
  return jsonb_build_object('passed', jsonb_array_length(fails) = 0 and jsonb_array_length(investigate) = 0, 'failures', fails, 'investigate', investigate);
end $$;

create or replace function public.run_ai_draft_integrity(p_story uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; st text;
begin
  if not (public.has_role('editor') or public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator runs the integrity check' using errcode = '42501';
  end if;
  r := public.compute_ai_draft_integrity(p_story);
  st := case when (r ->> 'passed')::boolean then 'passed' when jsonb_array_length(r -> 'failures') > 0 then 'failed' else 'needs_investigation' end;
  perform set_config('qitl.integrity_fn', '1', true);
  update public.stories set integrity_status = st, integrity_report = r, integrity_checked_at = now(),
    visibility = case when st <> 'passed' and visibility = 'public_ai_draft' then 'private_draft' else visibility end
  where id = p_story;
  perform set_config('qitl.integrity_fn', '0', true);
  return r || jsonb_build_object('status', st);
end $$;

create or replace function public.publish_ai_draft(p_story uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.has_role('editor') or public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator publishes an AI draft' using errcode = '42501';
  end if;
  update public.stories set visibility = 'public_ai_draft', ai_published_at = coalesce(ai_published_at, now()) where id = p_story and status <> 'published';
  if not found then raise exception 'story not found or already published through review' using errcode = 'P0001'; end if;
end $$;

create or replace function public.withdraw_ai_draft(p_story uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.has_role('editor') or public.has_role('admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'only an editor or administrator withdraws an AI draft' using errcode = '42501';
  end if;
  update public.stories set visibility = 'private_draft' where id = p_story and visibility = 'public_ai_draft';
end $$;

-- ---------- Public read API (the only way anon reads an AI draft) ----------
create or replace function public.public_ai_drafts()
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'title', title, 'title_ar', title_ar, 'summary', summary,
    'scholarly_status', scholarly_status, 'ai_model', ai_model, 'published_at', ai_published_at, 'updated_at', updated_at) order by title), '[]'::jsonb)
  from public.stories where visibility = 'public_ai_draft' and integrity_status = 'passed' and ai_generated and status <> 'published' and scholarly_status <> 'rejected';
$$;

create or replace function public.public_ai_draft(p_slug text)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'slug', s.slug, 'title', s.title, 'title_ar', s.title_ar, 'summary', s.summary,
    'scholarly_status', s.scholarly_status, 'ai_model', s.ai_model, 'prompt_version', s.prompt_version,
    'integrity_checked_at', s.integrity_checked_at, 'updated_at', s.updated_at, 'version', s.version,
    'chapters', coalesce((select jsonb_agg(jsonb_build_object(
        'position', c.position, 'anchor', c.anchor, 'title', c.title, 'summary_md', c.summary_md, 'body_md', c.body_md,
        'deep_md', c.deep_md, 'kids_md', c.kids_md, 'lessons_md', c.lessons_md, 'unknowns_md', c.unknowns_md,
        'claims', coalesce((select jsonb_agg(jsonb_build_object('anchor', cc.anchor, 'statement', ec.statement, 'evidence', ec.evidence,
            'refs', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'surah', r.quran_surah, 'from', r.quran_ayah_from, 'to', r.quran_ayah_to, 'locator', r.locator, 'note', r.note))
              from public.claim_references r where r.claim_id = ec.id), '[]'::jsonb)) order by cc.anchor)
          from public.chapter_claims cc join public.evidence_claims ec on ec.id = cc.claim_id where cc.chapter_id = c.id), '[]'::jsonb)
      ) order by c.position) from public.chapters c where c.story_id = s.id), '[]'::jsonb))
  from public.stories s
  where s.slug = p_slug and s.visibility = 'public_ai_draft' and s.integrity_status = 'passed' and s.ai_generated and s.status <> 'published' and s.scholarly_status <> 'rejected';
$$;

revoke execute on function public.stories_ai_guard(), public.ai_draft_content_changed(), public.compute_ai_draft_integrity(uuid) from public, anon, authenticated;
revoke execute on function public.run_ai_draft_integrity(uuid), public.publish_ai_draft(uuid), public.withdraw_ai_draft(uuid) from public, anon;
grant execute on function public.run_ai_draft_integrity(uuid), public.publish_ai_draft(uuid), public.withdraw_ai_draft(uuid) to authenticated;
grant execute on function public.public_ai_drafts(), public.public_ai_draft(text) to anon, authenticated;
