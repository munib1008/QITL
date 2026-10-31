set search_path = public, extensions;

-- Follow-up to the security sweep (20261031002350): three gaps in the search and media migrations merged after it.
-- tests/db/security.test.ts found them.

-- 1. search_sources is configuration, written only by migrations: row level security on AND forced, no API access.
alter table public.search_sources force row level security;

-- 2. media_asset_status() returned an asset's workflow status to anyone who could call it (anon included). The public
--    read policy only needs a yes/no answer, so give it a boolean and keep the status function for signed-in editors
--    (the file guard trigger runs as the caller and reads it).
create or replace function public.media_asset_is_published(aid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.assets where id = aid and status = 'published');
$$;
grant execute on function public.media_asset_is_published(uuid) to anon, authenticated;

drop policy if exists read_public on public.asset_files;
create policy read_public on public.asset_files for select
  using (public.is_staff() or (state = 'active' and public.media_asset_is_published(asset_id)));

revoke execute on function public.media_asset_status(uuid) from public, anon;
grant execute on function public.media_asset_status(uuid) to authenticated;

-- 3. A reviewer cannot review a media file they uploaded: register its author column (the registry drives
--    no_self_review(); media_check_self_review() from the media migration stays as a second line).
insert into public.review_entity_authors (entity_type, table_name, author_column)
select 'media_file', 'asset_files', 'created_by'
where exists (select 1 from public.review_entity_types where type = 'media_file')
on conflict do nothing;
