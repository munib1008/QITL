set search_path = public, extensions;

-- Security sweep (docs/SECURITY.md). Four fixes, each covered by tests/db/security.test.ts:
--   1. Least privilege on table grants. Supabase's default privileges grant every new table and view to anon and
--      authenticated (ALL, including TRUNCATE, which row level security does not cover). Several later tables never
--      revoked them. Here: no API role may TRUNCATE anything or write through a view; anon writes nothing; and
--      authenticated keeps a write verb only where a policy can allow it.
--   2. No self-review, everywhere. editorial_reviews refused self-review for claims (and qiraat), but a user who is both
--      an editor and a reviewer could approve their own story, event, script, interpretation, creation entry or
--      guidance lesson. A registry maps each review type to its table and author column; one trigger checks them all.
--      Human translations and the substantive interpretation checks get the same rule.
--      The author column itself is stamped by the database (it was whatever the client sent, or empty).
--   3. Audio approvals are stamped with the acting user (a producer could record someone else as the approver).
--   4. throttle_action(): the database throttle, callable for costly actions (AI drafts, machine translation,
--      narration, exports), and a retention function for the throttle's own log.

-- ---------- 1. Least privilege ----------
do $$
declare
  r record;
  verb text;
begin
  for r in
    select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e') -- PostGIS's own tables and views
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.relname);
    execute format('revoke insert, update, delete on public.%I from anon', r.relname);
    if r.relkind in ('v', 'm') then
      execute format('revoke insert, update, delete on public.%I from authenticated', r.relname);
      continue;
    end if;
    foreach verb in array array['insert', 'update', 'delete'] loop
      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = r.relname and p.cmd in (upper(verb), 'ALL')
          and p.roles && array['authenticated', 'public']::name[]
      ) then
        execute format('revoke %s on public.%I from authenticated', verb, r.relname);
      end if;
    end loop;
  end loop;
end $$;

-- ---------- 2. No self-review ----------
-- Which table (and which column on it) holds the author of a review target. A type may span several tables (creation).
-- Modules register their own rows; tests/db/security.test.ts fails for a review type that has neither a row here nor
-- a stated reason (a table without an author column).
create table public.review_entity_authors (
  entity_type text not null references public.review_entity_types (type) on delete cascade,
  table_name text not null check (table_name ~ '^[a-z_]{2,63}$'),
  author_column text not null default 'created_by' check (author_column ~ '^[a-z_]{2,63}$'),
  primary key (entity_type, table_name)
);
alter table public.review_entity_authors enable row level security;
alter table public.review_entity_authors force row level security;
revoke all on public.review_entity_authors from anon, authenticated;
grant select on public.review_entity_authors to authenticated;
create policy staff_read on public.review_entity_authors for select to authenticated using (public.is_staff());

insert into public.review_entity_authors (entity_type, table_name, author_column)
select v.entity_type, v.table_name, v.author_column
from (values
  ('claim', 'evidence_claims', 'created_by'),
  ('story', 'stories', 'created_by'),
  ('event', 'historical_events', 'created_by'),
  ('relationship', 'relationships', 'created_by'),
  ('place_geometry', 'place_geometries', 'created_by'),
  ('story_section', 'story_sections', 'created_by'),
  ('quiz', 'story_quizzes', 'created_by'),
  ('media', 'story_media', 'created_by'),
  ('interpretation', 'interpretation_explanations', 'created_by'),
  ('quran_word_senses', 'quran_word_senses', 'created_by'),
  ('hadith_commentary_links', 'hadith_commentary_links', 'created_by'),
  ('story_script', 'story_scripts', 'created_by'),
  ('creation', 'creation_profiles', 'created_by'),
  ('creation', 'creation_characteristics', 'created_by'),
  ('creation', 'creation_abilities', 'created_by'),
  ('creation', 'creation_limitations', 'created_by'),
  ('creation', 'creation_interactions', 'created_by'),
  ('creation', 'creation_lessons', 'created_by'),
  ('creation', 'creation_misconceptions', 'created_by'),
  ('creation', 'creation_source_references', 'created_by'),
  ('guidance_topic', 'guidance_topics', 'created_by'),
  ('guidance_lesson', 'guidance_lessons', 'created_by'),
  ('guidance_link', 'guidance_links', 'created_by'),
  ('guidance_safety_note', 'guidance_safety_notes', 'created_by'),
  ('dream_response', 'dream_scholar_responses', 'scholar_id'),
  ('transmission_route', 'transmission_routes', 'created_by'),
  ('qiraat_variant', 'qiraat_variants', 'created_by'),
  ('reciter', 'reciters', 'created_by'),
  ('audio_recording', 'audio_recordings', 'created_by'),
  ('qiraat_misconception', 'qiraat_misconceptions', 'created_by')
) as v(entity_type, table_name, author_column)
-- Only types and columns that exist (a module that is not installed is skipped).
where exists (select 1 from public.review_entity_types t where t.type = v.entity_type)
  and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = v.table_name and c.column_name = v.author_column)
  and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = v.table_name and c.column_name = 'id' and c.data_type = 'uuid');

-- Life Through the Ages registers its tables in lifestyle_record_types; every one of them has created_by.
do $$
begin
  if to_regclass('public.lifestyle_record_types') is not null then
    insert into public.review_entity_authors (entity_type, table_name, author_column)
    select l.type, l.table_name, 'created_by' from public.lifestyle_record_types l
    where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.table_name and c.column_name = 'created_by')
      and exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.table_name and c.column_name = 'id' and c.data_type = 'uuid')
    on conflict do nothing;
  end if;
end $$;

-- The author column is the database's record, not the client's claim: on insert through the API it is the acting user,
-- and nobody changes it afterwards (otherwise an editor could leave it empty, or name a colleague, and then approve
-- their own draft). Trusted jobs with the service role, and ON DELETE SET NULL when an account is deleted, are not
-- affected (auth.uid() is null there).
create or replace function public.stamp_author()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  col text := tg_argv[0];
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new := jsonb_populate_record(new, jsonb_build_object(col, auth.uid()));
  elsif (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
    new := jsonb_populate_record(new, jsonb_build_object(col, to_jsonb(old) -> col));
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in select distinct a.table_name from public.review_entity_authors a where a.author_column = 'created_by' loop
    execute format('create trigger a0_stamp_author before insert or update on public.%I for each row execute function public.stamp_author(%L)', t, 'created_by');
  end loop;
end $$;

create or replace function public.no_self_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  m record;
  author uuid;
begin
  for m in select a.table_name, a.author_column from public.review_entity_authors a where a.entity_type = new.entity_type loop
    if to_regclass(format('public.%I', m.table_name)) is null then
      continue;
    end if;
    execute format('select %I from public.%I where id = $1', m.author_column, m.table_name) into author using new.entity_id;
    if author is not null and author = new.reviewer_id then
      raise exception 'a reviewer cannot review their own record' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
create trigger editorial_reviews_no_self_review before insert on public.editorial_reviews
  for each row execute function public.no_self_review();

-- A human translation is not reviewed by its own translator. (A machine translation is checked by the translation
-- reviewer who requested it, by design; its religious review still needs a scholarly reviewer.)
create or replace function public.translation_review_not_self()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.story_translations t
             where t.translated_script_id = new.translated_script_id and t.translator_id = new.reviewer_id) then
    raise exception 'a reviewer cannot review their own translation' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger translation_reviews_not_self before insert on public.translation_reviews
  for each row execute function public.translation_review_not_self();

-- The substantive checks on an interpretation (hadith grading, Sunni scholarly agreement, language quality) are signed
-- by someone other than its author. The editorial checks (Arabic source, references, licensing, attribution, grammar)
-- may be signed by the drafting editor, by the module's design; publishing still needs another reviewer's approval.
create or replace function public.interpretation_review_not_self()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Someone who may not sign this check at all is refused by the row-level policy (sign_own_check) instead.
  if new.check_key in ('hadith_grading', 'sunni_scholarly', 'language_quality') and public.can_sign_check(new.check_key)
     and exists (select 1 from public.interpretation_explanations e where e.id = new.explanation_id and e.created_by = new.reviewer_id) then
    raise exception 'a reviewer cannot sign checks on their own explanation' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger interpretation_reviews_not_self before insert on public.interpretation_reviews
  for each row execute function public.interpretation_review_not_self();

-- ---------- 3. Approvals are stamped with the acting user ----------
create or replace function public.stamp_approver()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Through the API (auth.uid() set), whoever sets or changes an approval is recorded as the approver. Trusted jobs
  -- with the service role (no auth.uid()) keep the value they pass.
  if auth.uid() is not null and new.approved_by is not null
     and (tg_op = 'INSERT' or new.approved_by is distinct from old.approved_by
          or (to_jsonb(new) ? 'status' and to_jsonb(new) ->> 'status' is distinct from to_jsonb(old) ->> 'status')) then
    new.approved_by := auth.uid();
  end if;
  return new;
end $$;
create trigger narration_audio_stamp_approver before insert or update on public.narration_audio
  for each row execute function public.stamp_approver();
create trigger scene_ambient_audio_stamp_approver before insert or update on public.scene_ambient_audio
  for each row execute function public.stamp_approver();

-- ---------- 4. Database throttle for costly actions, and its retention ----------
-- Per user (auth.uid()), across every server instance: per minute and per hour.
create or replace function public.throttle_action(p_action text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  case p_action
    when 'ai_draft' then perform public.throttle('ai_draft', 6, 60);     -- paid model calls
    when 'translate' then perform public.throttle('translate', 10, 100); -- paid machine translation
    when 'narrate' then perform public.throttle('narrate', 30, 300);     -- paid speech synthesis
    when 'export' then perform public.throttle('export', 3, 20);         -- full personal-data exports
    else raise exception 'unknown throttle action' using errcode = '22023';
  end case;
end $$;

-- The throttle only looks back one hour; keep two days for investigating abuse, then delete.
create or replace function public.purge_rate_limit_events()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  delete from public.rate_limit_events where at < now() - interval '2 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- quran_edition_ayah() reads edition text past the licence gate on quran_edition_verses; it exists for a guard trigger
-- (which runs as the owner) and was callable by anyone through the API.
revoke execute on function public.quran_edition_ayah(uuid, smallint, smallint) from public, anon, authenticated;

revoke execute on function public.no_self_review(), public.stamp_author(), public.translation_review_not_self(), public.interpretation_review_not_self(),
  public.stamp_approver(), public.throttle_action(text), public.purge_rate_limit_events() from public, anon, authenticated;
grant execute on function public.throttle_action(text) to authenticated;
grant execute on function public.purge_rate_limit_events() to service_role;
