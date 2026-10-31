set search_path = public, extensions;

-- Media Library and the asset approval workflow.
--
-- Reuses public.assets (depicts_person always false; approved_by required to publish), asset_links, sources and
-- content_permissions (the licence registry), editorial_reviews + review_entity_types (one INSERT below) and the
-- per-module visual tables that reference assets (story_media, scene_visual_assets, creation_visual_assets,
-- lifestyle_infographics). Storage policies for the media bucket are in 20261031002251_media_storage.sql
-- (@supabase-only); the path rule they call, media_object_writable(), lives here so it is tested.
--
-- Every uploaded file is a row in asset_files (one row per version). Workflow of a file version:
--   pending (in the private pending/<file id>/ folder)
--     -> scan resolved: 'clean' (recorded by the server with the service role) or 'skipped_acknowledged' (an admin,
--        when no scanner is configured or the scanner failed); 'infected' never leaves pending
--     -> non-figurative confirmation (an editor: no prophets, angels, jinn, the unseen, no human figures)
--     -> religious review (editorial_reviews, entity type 'media_file', by a scholarly reviewer who did not upload it)
--   -> the asset is approved (approved_by is stamped with the acting editor), the file moves to assets/<file id>/
--      and becomes 'active', then the asset is published.
-- Replacing the file of a published asset uploads a new version; activating it supersedes the old version, whose
-- objects are kept until the admin-triggered cleanup finds them unreferenced (media_cleanup_candidates).

-- ---------- File versions ----------
create table public.asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  version integer not null check (version >= 1),
  storage_path text not null unique check (storage_path ~ '^(pending|assets)/[0-9a-f-]{36}/original\.(png|jpg|webp|svg|gif)$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif')),
  bytes integer not null check (bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  -- Responsive WebP renditions next to the original: [{"w": 640, "h": 427, "name": "w640.webp", "bytes": 12345}, ...]
  variants jsonb not null default '[]' check (jsonb_typeof(variants) = 'array'),
  sanitised boolean not null default false, -- SVG: scripts, foreign objects, event handlers and external references removed
  state text not null default 'pending' check (state in ('pending', 'active', 'superseded', 'rejected', 'deleted')),
  scan_status text not null default 'not_scanned' check (scan_status in ('not_scanned', 'clean', 'infected', 'failed', 'skipped_acknowledged')),
  scan_engine text check (char_length(scan_engine) <= 200),
  scanned_at timestamptz,
  scan_ack_by uuid references auth.users (id) on delete set null,
  scan_ack_at timestamptz,
  non_figurative_confirmed boolean not null default false,
  non_figurative_by uuid references auth.users (id) on delete set null,
  non_figurative_at timestamptz,
  superseded_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, version),
  check ((scan_status = 'skipped_acknowledged') = (scan_ack_by is not null)),
  check (non_figurative_confirmed = (non_figurative_by is not null)),
  check (state <> 'active' or storage_path like 'assets/%'),
  check (state <> 'pending' or storage_path like 'pending/%'),
  check (storage_path like '%/' || id::text || '/%')
);
create index asset_files_asset on public.asset_files (asset_id, version desc);

-- ---------- Asset columns ----------
alter table public.assets
  add column file_id uuid references public.asset_files (id) on delete set null,
  add column permission_id uuid references public.content_permissions (id) on delete restrict,
  add column category text not null default 'other' check (category in ('background', 'infographic', 'map', 'diagram', 'manuscript', 'calligraphy', 'pattern', 'landscape', 'architecture', 'object', 'other')),
  add column alt_text_ar text check (char_length(alt_text_ar) between 3 and 500),
  add column alt_text_ur text check (char_length(alt_text_ur) between 3 and 500),
  add column caption_en text check (char_length(caption_en) <= 500),
  add column caption_ar text check (char_length(caption_ar) <= 500),
  add column caption_ur text check (char_length(caption_ur) <= 500),
  add column approved_at timestamptz,
  add column published_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.assets drop constraint assets_mime_type_check;
alter table public.assets add constraint assets_mime_type_check
  check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'application/pdf'));
alter table public.assets add constraint assets_alt_text_len check (char_length(alt_text) <= 500);
create index assets_file on public.assets (file_id);

insert into public.review_entity_types (type, module) values ('media_file', 'media_library');

-- ---------- Helpers ----------
-- Trusted writers: the service role (server jobs) and the database owner (migrations, security-definer triggers).
create or replace function public.media_trusted()
returns boolean language sql stable as $$
  select current_user not in ('anon', 'authenticated');
$$;

-- A licence lets the image be shown: the asset's source is rights-cleared, or its content permission (for this source,
-- asset type image) is APPROVED, or CONDITIONAL with the attribution text recorded.
create or replace function public.media_licence_allowed(sid uuid, pid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.source_publishable(sid) or (pid is not null and exists (
    select 1 from public.content_permissions p
    where p.id = pid and p.source_id = sid and p.asset_type = 'image' and public.content_permission_allowed(p.id)));
$$;

-- A file version may go public: its scan is resolved, an editor confirmed it is non-figurative and the latest
-- religious review of this version is an approval.
create or replace function public.media_file_ready(fid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.asset_files f where f.id = fid and f.state in ('pending', 'active')
    and f.scan_status in ('clean', 'skipped_acknowledged') and f.non_figurative_confirmed)
    and public.latest_review_approved('media_file', fid);
$$;

create or replace function public.media_asset_status(aid uuid)
returns public.publication_status language sql stable security definer set search_path = public, extensions as $$
  select status from public.assets where id = aid;
$$;

-- The storage path rule (called by the storage.objects policies): editors write only into pending/<file id>/ of a
-- pending file version, and into assets/<file id>/ only for a ready file of an approved or published asset.
create or replace function public.media_object_writable(object_name text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  parts text[] := string_to_array(object_name, '/');
  fid uuid;
  f public.asset_files;
begin
  if not public.has_role('editor') or array_length(parts, 1) <> 3 or parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[3] !~ '^(original\.(png|jpg|webp|svg|gif)|w[0-9]{2,4}\.webp)$' then
    return false;
  end if;
  fid := parts[2]::uuid;
  select * into f from public.asset_files where id = fid;
  if not found then
    return false;
  end if;
  if parts[1] = 'pending' then
    return f.state = 'pending';
  elsif parts[1] = 'assets' then
    return f.state in ('pending', 'active') and public.media_file_ready(fid) and public.media_asset_status(f.asset_id) in ('approved', 'published');
  end if;
  return false;
end $$;

-- ---------- Guards ----------
-- Security invoker on purpose: current_user is the caller's API role, so "trusted" means the service role or owner.
create or replace function public.guard_asset_file()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  trusted boolean := public.media_trusted();
  astatus public.publication_status;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if not trusted then
      new.created_by := auth.uid();
      if new.state <> 'pending' or new.scan_status <> 'not_scanned' or new.scan_engine is not null or new.scanned_at is not null
         or new.scan_ack_by is not null or new.non_figurative_confirmed or new.superseded_at is not null then
        raise exception 'a new file version starts pending, unscanned and unconfirmed' using errcode = '42501';
      end if;
    end if;
    select coalesce(max(version), 0) + 1 into new.version from public.asset_files where asset_id = new.asset_id;
    return new;
  end if;

  if new.id <> old.id or new.asset_id <> old.asset_id or new.version <> old.version or new.sha256 <> old.sha256 or new.mime_type <> old.mime_type
     or new.bytes <> old.bytes or new.width <> old.width or new.height <> old.height or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at or new.sanitised <> old.sanitised then
    raise exception 'a file version is immutable; upload a new version instead' using errcode = 'P0001';
  end if;
  if new.variants <> old.variants and not trusted and old.state <> 'pending' then
    raise exception 'renditions change only while the version is pending' using errcode = 'P0001';
  end if;

  -- Scan results come from the server's scanner (service role) only; an admin may acknowledge a skipped scan.
  if (new.scan_status, new.scan_engine, new.scanned_at) is distinct from (old.scan_status, old.scan_engine, old.scanned_at)
     or new.scan_ack_by is distinct from old.scan_ack_by or new.scan_ack_at is distinct from old.scan_ack_at then
    if not trusted then
      if new.scan_status = 'skipped_acknowledged' and old.scan_status in ('not_scanned', 'failed')
         and (new.scan_engine, new.scanned_at) is not distinct from (old.scan_engine, old.scanned_at) then
        if not public.has_role('admin') then
          raise exception 'only an admin may acknowledge an unscanned upload' using errcode = '42501';
        end if;
        new.scan_ack_by := auth.uid();
        new.scan_ack_at := now();
      else
        raise exception 'scan results are recorded by the server scanner only' using errcode = '42501';
      end if;
    elsif new.scan_status <> 'skipped_acknowledged' then
      new.scan_ack_by := null;
      new.scan_ack_at := null;
    end if;
  end if;
  if new.scan_status = 'infected' and new.state in ('active') then
    raise exception 'an infected file never leaves pending' using errcode = 'P0001';
  end if;

  -- The non-figurative confirmation is stamped with the acting editor and frozen once the version is public.
  if new.non_figurative_confirmed is distinct from old.non_figurative_confirmed
     or new.non_figurative_by is distinct from old.non_figurative_by or new.non_figurative_at is distinct from old.non_figurative_at then
    if old.state <> 'pending' then
      raise exception 'the confirmation is frozen once the version leaves pending' using errcode = 'P0001';
    end if;
    if new.non_figurative_confirmed then
      new.non_figurative_by := coalesce(auth.uid(), new.non_figurative_by);
      new.non_figurative_at := now();
    else
      new.non_figurative_by := null;
      new.non_figurative_at := null;
    end if;
  end if;

  -- State machine.
  if new.state <> old.state or new.storage_path <> old.storage_path then
    astatus := public.media_asset_status(new.asset_id);
    if new.storage_path <> old.storage_path and split_part(new.storage_path, '/', 3) <> split_part(old.storage_path, '/', 3) then
      raise exception 'a moved file keeps its name' using errcode = 'P0001';
    end if;
    if old.state = 'pending' and new.state = 'active' then
      if not public.media_file_ready(new.id) or astatus not in ('approved', 'published') then
        raise exception 'a version goes public only when scanned, confirmed non-figurative, approved in review and its asset is approved' using errcode = 'P0001';
      end if;
    elsif old.state = 'active' and new.state = 'pending' then
      if exists (select 1 from public.assets a where a.file_id = new.id and a.status = 'published') then
        raise exception 'the file of a published asset cannot be withdrawn; withdraw the asset first' using errcode = 'P0001';
      end if;
    elsif old.state = 'active' and new.state = 'superseded' then
      if exists (select 1 from public.assets a where a.file_id = new.id) then
        raise exception 'the current file of an asset cannot be superseded' using errcode = 'P0001';
      end if;
      new.superseded_at := now();
    elsif old.state = 'pending' and new.state = 'rejected' then
      if exists (select 1 from public.assets a where a.file_id = new.id and a.status in ('approved', 'published')) then
        raise exception 'the current file of an approved asset cannot be rejected' using errcode = 'P0001';
      end if;
    elsif new.state = 'deleted' and old.state in ('superseded', 'rejected', 'pending') then
      if not (trusted or public.has_role('admin')) then
        raise exception 'only an admin removes files' using errcode = '42501';
      end if;
      if exists (select 1 from public.assets a where a.file_id = new.id and a.status in ('approved', 'published')) then
        raise exception 'a file in use cannot be removed' using errcode = 'P0001';
      end if;
    elsif new.state = old.state and new.state in ('pending', 'active') then
      null; -- a move inside the state's own folder is caught by the path checks
    else
      raise exception 'file version cannot go from % to %', old.state, new.state using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger asset_files_guard before insert or update on public.asset_files for each row execute function public.guard_asset_file();
create trigger asset_files_audit after insert or update or delete on public.asset_files for each row execute function public.audit();

-- Asset guard: the current file decides storage_path, mime type and size; approval stamps approved_by with the acting
-- editor; publishing needs approval, a public ready file and an allowed licence; a published asset changes only by
-- swapping in a newer ready file or by leaving published (correction, archived). Correction clears the approval, so a
-- corrected asset is approved again before it is republished.
create or replace function public.guard_asset()
returns trigger language plpgsql set search_path = public, extensions as $$
declare
  trusted boolean := public.media_trusted();
  f public.asset_files;
begin
  new.updated_at := now();
  -- depicts_person = true is refused by the table's own check constraint (no figurative depiction, ever).
  if new.file_id is not null then
    select * into f from public.asset_files where id = new.file_id;
    if not found or f.asset_id <> new.id then
      raise exception 'the file belongs to another asset' using errcode = 'P0001';
    end if;
    if f.state in ('rejected', 'deleted', 'superseded') then
      raise exception 'a % file version cannot be the current file', f.state using errcode = 'P0001';
    end if;
    new.storage_path := f.storage_path;
    new.mime_type := f.mime_type;
    new.bytes := f.bytes;
  end if;

  if tg_op = 'INSERT' then
    if not trusted then
      new.created_by := auth.uid();
      new.approved_by := null;
      new.approved_at := null;
      new.published_at := null;
      if new.status not in ('draft', 'in_review') then
        raise exception 'a new asset starts as a draft' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    raise exception 'authorship is permanent' using errcode = 'P0001';
  end if;

  -- Published: only a newer file swap, or leaving published.
  if old.status = 'published' and new.status = 'published' then
    if to_jsonb(new) - array['file_id', 'storage_path', 'mime_type', 'bytes', 'updated_at'] <> to_jsonb(old) - array['file_id', 'storage_path', 'mime_type', 'bytes', 'updated_at'] then
      raise exception 'a published asset cannot be edited in place; move it to correction first' using errcode = 'P0001';
    end if;
    if new.file_id is distinct from old.file_id and (f.state <> 'active' or not public.media_file_ready(f.id)) then
      raise exception 'the replacement version is not ready (scan, non-figurative confirmation, review, activation)' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- approved_by is never typed in: it is stamped on approval and cleared when the asset goes back.
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if not (trusted or public.has_role('editor')) then
      raise exception 'only an editor approves media' using errcode = '42501';
    end if;
    if new.file_id is null or not public.media_file_ready(new.file_id) then
      raise exception 'approval needs a scanned file, the non-figurative confirmation and an approving religious review' using errcode = 'P0001';
    end if;
    if not public.media_licence_allowed(new.source_id, new.permission_id) then
      raise exception 'the image licence is not cleared (source rights or an allowed content permission)' using errcode = 'P0001';
    end if;
    new.approved_by := case when trusted then coalesce(auth.uid(), new.approved_by) else auth.uid() end;
    new.approved_at := now();
  elsif new.status in ('draft', 'in_review', 'rejected', 'correction') then
    new.approved_by := null;
    new.approved_at := null;
  elsif not trusted and (new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at) then
    raise exception 'approved_by is stamped by the database' using errcode = '42501';
  end if;

  if new.status = 'published' then
    if old.status <> 'approved' or new.approved_by is null then
      raise exception 'publishing needs an approved asset (approved_by)' using errcode = 'P0001';
    end if;
    if new.file_id is null or f.state <> 'active' or not public.media_file_ready(f.id) then
      raise exception 'publishing needs an active, reviewed file outside pending/' using errcode = 'P0001';
    end if;
    if not public.media_licence_allowed(new.source_id, new.permission_id) then
      raise exception 'the image licence is not cleared (source rights or an allowed content permission)' using errcode = 'P0001';
    end if;
    new.published_at := now();
  end if;
  if new.status = 'in_review' and old.status is distinct from 'in_review' then
    if new.file_id is null then
      raise exception 'upload a file before review' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger assets_guard before insert or update on public.assets for each row execute function public.guard_asset();
create trigger assets_audit after insert or update or delete on public.assets for each row execute function public.audit();

-- The licence rule now accepts either a cleared source or an allowed content permission for the image.
create or replace function public.check_asset_rights()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'published' and not public.media_licence_allowed(new.source_id, new.permission_id) then
    raise exception 'image source rights are not cleared' using errcode = 'P0001';
  end if;
  if new.permission_id is not null and not exists (
    select 1 from public.content_permissions p where p.id = new.permission_id and p.source_id = new.source_id and p.asset_type = 'image'
  ) then
    raise exception 'the content permission must be an image permission of the same source' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- After a file swap on an asset, the previously active version is superseded (kept until the cleanup removes it).
create or replace function public.after_asset_file_swap()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.file_id is distinct from old.file_id and new.file_id is not null then
    update public.asset_files set state = 'superseded'
    where asset_id = new.id and id <> new.file_id and state = 'active';
  end if;
  return null;
end $$;
create trigger assets_file_swap after update of file_id on public.assets for each row execute function public.after_asset_file_swap();

-- A reviewer never reviews a file they uploaded, and the file must exist.
create or replace function public.media_check_self_review()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  author uuid;
begin
  if new.entity_type <> 'media_file' then
    return new;
  end if;
  select created_by into author from public.asset_files where id = new.entity_id;
  if not found then
    raise exception 'no such file version' using errcode = 'P0001';
  end if;
  if author = new.reviewer_id then
    raise exception 'a reviewer cannot review a file they uploaded' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger editorial_reviews_media_self before insert on public.editorial_reviews for each row execute function public.media_check_self_review();

-- ---------- Usage: where each asset is used ----------
create view public.asset_usage with (security_invoker = true) as
select l.asset_id, 'knowledge'::text as module, l.entity_type::text as entity_type, l.entity_id, 'link'::text as role, null::text as status
from public.asset_links l
union all
select m.asset_id, 'storytelling', case when m.person_id is not null then 'person' else 'event' end, coalesce(m.person_id, m.event_id)::text, m.role, m.status::text
from public.story_media m where m.asset_id is not null
union all
select v.asset_id, 'narration', 'scene', v.scene_id::text, v.role, null
from public.scene_visual_assets v
union all
select c.asset_id, 'creation_atlas', case when c.story_id is not null then 'creation_story' else 'creation_profile' end, c.id::text, c.kind, c.status::text
from public.creation_visual_assets c where c.asset_id is not null
union all
select i.asset_id, 'life_through_ages', 'lifestyle_infographic', i.id::text, i.kind, i.status::text
from public.lifestyle_infographics i where i.asset_id is not null;

-- ---------- Public rendering: only published assets with an active file and an allowed licence ----------
create view public.media_public with (security_invoker = true) as
select a.id, a.kind, a.category, a.alt_text, a.alt_text_ar, a.alt_text_ur, a.caption_en, a.caption_ar, a.caption_ur, a.credit,
       f.id as file_id, f.version, f.storage_path, f.mime_type, f.width, f.height, f.variants,
       coalesce(p.attribution_text, s.attribution) as attribution, coalesce(p.licence_ref, s.license_text) as licence, s.license_url
from public.assets a
join public.asset_files f on f.id = a.file_id and f.state = 'active' and f.storage_path like 'assets/%'
join public.sources s on s.id = a.source_id
left join public.content_permissions p on p.id = a.permission_id
where a.status = 'published' and a.depicts_person = false and public.media_licence_allowed(a.source_id, a.permission_id);

-- ---------- Cleanup: files nothing references any more (admin-triggered, dry run first) ----------
create or replace function public.media_cleanup_candidates(grace_days integer default 7)
returns table (file_id uuid, asset_id uuid, storage_path text, variants jsonb, state text, reason text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.has_role('admin') then
    raise exception 'only an admin runs the media cleanup' using errcode = '42501';
  end if;
  return query
  select f.id, f.asset_id, f.storage_path, f.variants, f.state,
         case when f.state = 'superseded' then 'superseded version, no longer the current file'
              when f.state = 'rejected' then 'rejected version'
              else 'file of a ' || a.status::text || ' asset that nothing uses' end
  from public.asset_files f
  join public.assets a on a.id = f.asset_id
  where not exists (select 1 from public.assets x where x.file_id = f.id and x.status in ('approved', 'published', 'correction'))
    and (
      (f.state = 'superseded' and f.superseded_at < now() - make_interval(days => grace_days))
      or (f.state = 'rejected' and f.updated_at < now() - make_interval(days => grace_days))
      or (f.state = 'pending' and a.status in ('rejected', 'archived') and a.updated_at < now() - make_interval(days => grace_days)
          and not exists (select 1 from public.asset_usage u where u.asset_id = a.id))
    )
  order by f.created_at;
end $$;

-- ---------- RLS and grants ----------
alter table public.asset_files enable row level security;
alter table public.asset_files force row level security;
revoke all on public.asset_files from anon, authenticated;
grant select on public.asset_files to anon, authenticated;
grant insert, update, delete on public.asset_files to authenticated;
grant select on public.asset_usage to authenticated;
grant select on public.media_public to anon, authenticated;
create policy read_public on public.asset_files for select
  using (public.is_staff() or (state = 'active' and public.media_asset_status(asset_id) = 'published'));
create policy editor_insert on public.asset_files for insert to authenticated with check (public.has_role('editor'));
create policy editor_update on public.asset_files for update to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy admin_delete on public.asset_files for delete to authenticated using (public.has_role('admin') and state in ('rejected', 'deleted'));

revoke execute on function public.guard_asset_file(), public.guard_asset(), public.after_asset_file_swap(), public.media_check_self_review()
  from public, anon, authenticated;
revoke execute on function public.media_cleanup_candidates(integer) from public, anon;
grant execute on function public.media_cleanup_candidates(integer) to authenticated;
