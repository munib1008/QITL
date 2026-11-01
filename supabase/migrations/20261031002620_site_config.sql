-- Admin-editable site content and module flags (backlog 28). Builds on the existing `site_settings` (key, jsonb value) and
-- `feature_flags` (key, enabled) tables, which nothing wrote to yet.
--
--   * site_settings holds only these keys (the database refuses any other): home hero and intro text blocks, per language
--     ({"en": "...", "ar": "...", "ur": "..."}), and the order of the Explore sections (nav.explore.order).
--   * feature_flags gains module visibility flags `module.<section>`: enabled = false HIDES that section from the menus.
--     No row means visible. A flag never publishes anything: no policy or function outside these tables reads them
--     (tests/db/site-config.test.ts scans for that), so content visibility stays with RLS and the review guards.
--   * Every change is made through an administrator-only function, bumps a version, needs a revision note, is copied to
--     site_config_revisions (append-only history) and written to audit_logs. A revert is a NEW version whose value is
--     copied from an old one; history is never rewritten or deleted.
-- Direct INSERT/UPDATE/DELETE on the two tables is no longer granted to any API role.

alter table public.site_settings add column if not exists version integer not null default 1;
alter table public.site_settings add column if not exists revision_note text;
alter table public.feature_flags add column if not exists version integer not null default 1;
alter table public.feature_flags add column if not exists revision_note text;

create table public.site_config_revisions (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('setting', 'flag')),
  key text not null,
  version integer not null,
  value jsonb not null,
  note text not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (kind, key, version)
);

-- ---------- Validation (the same limits are checked again in src/lib/site-config) ----------
create or replace function public.validate_site_setting(k text, v jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare
  maxlen integer;
  loc text;
  s text;
  h jsonb;
  seen text[] := '{}';
begin
  maxlen := case k
    when 'home.hero.kicker' then 80 when 'home.hero.title' then 120 when 'home.hero.lead' then 400
    when 'home.intro.kicker' then 80 when 'home.intro.title' then 120 when 'home.intro.body' then 800
    else null end;
  if maxlen is not null then
    if jsonb_typeof(v) <> 'object' then raise exception 'a text block is an object with en, ar and ur' using errcode = 'P0001'; end if;
    for loc in select jsonb_object_keys(v) loop
      if loc not in ('en', 'ar', 'ur') then raise exception 'text blocks are written in en, ar or ur only' using errcode = 'P0001'; end if;
      if jsonb_typeof(v -> loc) <> 'string' then raise exception 'text must be a string' using errcode = 'P0001'; end if;
      s := v ->> loc;
      if char_length(s) < 1 or char_length(s) > maxlen then raise exception 'text is 1 to % characters', maxlen using errcode = 'P0001'; end if;
      if s ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception 'control characters are not allowed' using errcode = 'P0001'; end if;
      if s ~ '<[A-Za-z/!?]' then raise exception 'HTML is not allowed; write plain text' using errcode = 'P0001'; end if;
      if s ~* '\]\(\s*(javascript|vbscript|data|file):' then raise exception 'that link is not allowed' using errcode = 'P0001'; end if;
      if k <> 'home.intro.body' and s ~ '[\n\r]' then raise exception 'this text is a single line' using errcode = 'P0001'; end if;
    end loop;
  elsif k = 'nav.explore.order' then
    if jsonb_typeof(v) <> 'object' or (select count(*) from jsonb_object_keys(v)) <> 1 or not (v ? 'hrefs') or jsonb_typeof(v -> 'hrefs') <> 'array' then
      raise exception 'the order is {"hrefs": [...]}' using errcode = 'P0001';
    end if;
    if jsonb_array_length(v -> 'hrefs') > 40 then raise exception 'at most 40 sections' using errcode = 'P0001'; end if;
    for h in select * from jsonb_array_elements(v -> 'hrefs') loop
      if jsonb_typeof(h) <> 'string' or (h #>> '{}') !~ '^/([a-z0-9-]+(/[a-z0-9-]+)*)?$' then raise exception 'each section is a site path such as /stories' using errcode = 'P0001'; end if;
      if (h #>> '{}') = any (seen) then raise exception 'a section is listed twice' using errcode = 'P0001'; end if;
      seen := seen || (h #>> '{}');
    end loop;
  else
    raise exception 'unknown site setting' using errcode = 'P0001';
  end if;
end $$;

-- ---------- Versioning, revision note, history, audit ----------
create or replace function public.site_config_guard()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'site configuration is reverted to an earlier version, never deleted' using errcode = 'P0001';
  end if;
  if tg_table_name = 'site_settings' then
    perform public.validate_site_setting(new.key, new.value);
  elsif tg_op = 'INSERT' and new.key !~ '^module\.[a-z0-9_]{1,50}$' then
    raise exception 'a module flag key looks like module.stories' using errcode = 'P0001';
  end if;
  if new.revision_note is null or char_length(btrim(new.revision_note)) < 4 or char_length(new.revision_note) > 300 then
    raise exception 'every change needs a revision note of 4 to 300 characters' using errcode = 'P0001';
  end if;
  new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.site_config_track()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  kind text := case when tg_table_name = 'site_settings' then 'setting' else 'flag' end;
  newv jsonb := case when tg_table_name = 'site_settings' then to_jsonb(new) -> 'value' else jsonb_build_object('enabled', to_jsonb(new) -> 'enabled') end;
  oldv jsonb := case when tg_op = 'INSERT' then null when tg_table_name = 'site_settings' then to_jsonb(old) -> 'value' else jsonb_build_object('enabled', to_jsonb(old) -> 'enabled') end;
begin
  insert into public.site_config_revisions (kind, key, version, value, note, changed_by)
  values (kind, new.key, new.version, newv, new.revision_note, auth.uid());
  insert into public.audit_logs (actor, action, entity_type, entity_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name, new.key,
          jsonb_build_object('version', new.version, 'note', new.revision_note, 'from', oldv, 'to', newv));
  return new;
end $$;

create trigger site_settings_guard before insert or update or delete on public.site_settings for each row execute function public.site_config_guard();
create trigger site_settings_track after insert or update on public.site_settings for each row execute function public.site_config_track();
create trigger feature_flags_guard before insert or update or delete on public.feature_flags for each row execute function public.site_config_guard();
create trigger feature_flags_track after insert or update on public.feature_flags for each row execute function public.site_config_track();

-- ---------- The only write path: administrator functions ----------
create or replace function public.save_site_setting(p_key text, p_value jsonb, p_note text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v integer;
begin
  if not public.has_role('admin') then raise exception 'only an administrator edits site content' using errcode = '42501'; end if;
  insert into public.site_settings as s (key, value, revision_note) values (p_key, p_value, p_note)
  on conflict (key) do update set value = excluded.value, revision_note = excluded.revision_note
  returning s.version into v;
  return v;
end $$;

create or replace function public.save_feature_flag(p_key text, p_enabled boolean, p_note text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare v integer;
begin
  if not public.has_role('admin') then raise exception 'only an administrator edits site flags' using errcode = '42501'; end if;
  if p_key !~ '^module\.[a-z0-9_]{1,50}$' then raise exception 'a module flag key looks like module.stories' using errcode = 'P0001'; end if;
  insert into public.feature_flags as f (key, enabled, description, revision_note)
  values (p_key, p_enabled, 'Shows or hides this section in the menus. It never publishes content.', p_note)
  on conflict (key) do update set enabled = excluded.enabled, revision_note = excluded.revision_note
  returning f.version into v;
  return v;
end $$;

create or replace function public.revert_site_config(p_kind text, p_key text, p_version integer, p_note text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare r public.site_config_revisions;
begin
  if not public.has_role('admin') then raise exception 'only an administrator reverts site content' using errcode = '42501'; end if;
  select * into r from public.site_config_revisions where kind = p_kind and key = p_key and version = p_version;
  if not found then raise exception 'that version does not exist' using errcode = 'P0001'; end if;
  if p_kind = 'setting' then
    return public.save_site_setting(p_key, r.value, left('Reverted to version ' || p_version || ': ' || coalesce(p_note, ''), 300));
  end if;
  return public.save_feature_flag(p_key, (r.value ->> 'enabled')::boolean, left('Reverted to version ' || p_version || ': ' || coalesce(p_note, ''), 300));
end $$;

revoke execute on function public.site_config_guard(), public.site_config_track(), public.validate_site_setting(text, jsonb) from public, anon, authenticated;
revoke execute on function public.save_site_setting(text, jsonb, text), public.save_feature_flag(text, boolean, text), public.revert_site_config(text, text, integer, text) from public, anon;
grant execute on function public.save_site_setting(text, jsonb, text), public.save_feature_flag(text, boolean, text), public.revert_site_config(text, text, integer, text) to authenticated;

-- ---------- Access ----------
alter table public.site_settings enable row level security;
alter table public.site_settings force row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_flags force row level security;
alter table public.site_config_revisions enable row level security;
alter table public.site_config_revisions force row level security;

revoke all on public.site_settings, public.feature_flags, public.site_config_revisions from anon, authenticated;
grant select on public.site_settings, public.feature_flags to anon, authenticated;
grant select on public.site_config_revisions to authenticated;

drop policy if exists admin_settings on public.site_settings;
drop policy if exists admin_flags on public.feature_flags;
drop policy if exists read_settings on public.site_settings;
-- Only the whitelisted presentation keys are readable by visitors (the guard above admits no other key).
create policy read_public_settings on public.site_settings for select using (key ~ '^(home|nav)\.');
create policy admin_read_revisions on public.site_config_revisions for select to authenticated using (public.has_role('admin'));
