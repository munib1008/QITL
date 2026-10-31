-- @supabase-only
set search_path = public, extensions;

-- The media bucket also holds video clips. The bucket keeps the 10 MB ceiling of the images (a clip is limited to 8 MB
-- by the app and by asset_files_video_rules), so the size limit does not change; only the allowed types do.
-- The pending/ vs assets/ layout and the storage policies of 20261031002251 are unchanged.

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'application/pdf', 'video/webm', 'video/mp4'],
    file_size_limit = 10485760
where id = 'media';
