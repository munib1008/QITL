set search_path = public, extensions;

-- Media Library: short video clips (WebM VP8/VP9/AV1 and MP4 H.264).
--
-- Clips use the same tables, review type ('media_file'), RLS, scan/quarantine flow, non-figurative confirmation,
-- no-self-review rule and publish guards as images; nothing in those is changed. What changes:
--   * asset_files / assets accept video/webm and video/mp4 (and the original.webm / original.mp4 file names);
--   * assets.kind accepts 'video', and a video asset is exactly an asset whose file is a video;
--   * a video clip is at most 8 MB (images keep the 10 MB rule), has no renditions, and an asset that is a video needs a
--     real description (alt text of at least 20 characters) and an English caption, whatever its status;
--   * media_object_writable() accepts the two new original file names.
-- The app enforces the 20-second limit when the container states a duration; the database does not store the duration.
-- The bucket allowed types are in 20261031002511_media_video_storage.sql (@supabase-only).

-- ---------- asset_files ----------
alter table public.asset_files drop constraint asset_files_storage_path_check;
alter table public.asset_files add constraint asset_files_storage_path_check
  check (storage_path ~ '^(pending|assets)/[0-9a-f-]{36}/original\.(png|jpg|webp|svg|gif|webm|mp4)$');
alter table public.asset_files drop constraint asset_files_mime_type_check;
alter table public.asset_files add constraint asset_files_mime_type_check
  check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'video/webm', 'video/mp4'));
-- A clip's extension matches its type, is at most 8 MB and has no WebP renditions.
alter table public.asset_files add constraint asset_files_video_rules
  check (
    (mime_type = 'video/webm') = (storage_path ~ '/original\.webm$')
    and (mime_type = 'video/mp4') = (storage_path ~ '/original\.mp4$')
    and (mime_type not like 'video/%' or (bytes <= 8388608 and variants = '[]'::jsonb and not sanitised))
  );

-- ---------- assets ----------
alter table public.assets drop constraint assets_mime_type_check;
alter table public.assets add constraint assets_mime_type_check
  check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'application/pdf', 'video/webm', 'video/mp4'));
alter table public.assets drop constraint assets_kind_check;
alter table public.assets add constraint assets_kind_check check (kind in ('image', 'manuscript', 'map', 'document', 'video'));
-- A video asset is an asset whose file is a video (so a file swap cannot turn an image into a clip or back), it is at
-- most 8 MB, and it carries a description and an English caption.
alter table public.assets add constraint assets_video_rules
  check (
    (kind = 'video') = (mime_type like 'video/%')
    and (mime_type not like 'video/%' or (bytes <= 8388608 and char_length(alt_text) >= 20 and char_length(btrim(coalesce(caption_en, ''))) >= 3))
  );

-- ---------- storage path rule ----------
create or replace function public.media_object_writable(object_name text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  parts text[] := string_to_array(object_name, '/');
  fid uuid;
  f public.asset_files;
begin
  if not public.has_role('editor') or array_length(parts, 1) <> 3 or parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or parts[3] !~ '^(original\.(png|jpg|webp|svg|gif|webm|mp4)|w[0-9]{2,4}\.webp)$' then
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
