set search_path = public, extensions;

-- person_aliases hardening (found by the people admin work, docs/ADMIN_PEOPLE.md):
--
--   1. audit      person_aliases was the only editor-written people table without the audit trigger. Every insert, update and
--                 delete is now written to public.audit_logs like the other tables. The table has no id column, so
--                 audit_logs.entity_id is '?' and the row (person_id, alias, language) is in `changes`.
--   2. freeze     the aliases of a PUBLISHED person cannot be inserted, changed or deleted at the database level, the same rule
--                 as person_claims (guard_person_claims, migration 20261031002521): move the person to correction first.
--                 The admin route already refused this; now a direct client or a script is refused too.
--
-- Additive: no data is changed. The search trigger person_aliases_search (migration 20261031002522) is untouched and still
-- re-indexes the person after every alias change that is allowed. Deleting a person cascades to its aliases; at that point
-- the person row is already gone, so the guard does not block the cascade (same as person_claims).

create or replace function public.guard_person_aliases()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- An update may also move an alias to another person: both the old and the new owner must be unpublished.
  if exists (
    select 1 from public.people
    where status = 'published'
      and id in (case when tg_op = 'INSERT' then null else old.person_id end, case when tg_op = 'DELETE' then null else new.person_id end)
  ) then
    raise exception 'the aliases of a published person cannot change; move the person to correction first' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.guard_person_aliases() from public, anon, authenticated;

create trigger person_aliases_guard before insert or update or delete on public.person_aliases for each row execute function public.guard_person_aliases();
create trigger person_aliases_audit after insert or update or delete on public.person_aliases for each row execute function public.audit();
