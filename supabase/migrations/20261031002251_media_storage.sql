-- @supabase-only
set search_path = public, extensions;

-- Media Library storage rules (Supabase Storage; skipped by the PGlite harness, which tests media_object_writable()).
-- The media bucket keeps its layout: pending/<file id>/... is private to staff, everything else is public.
-- Uploads go only into pending/<file id>/ of a pending file version; a file reaches assets/<file id>/ (public) only
-- when its version is ready (scan resolved, confirmed non-figurative, approved in religious review) and its asset is
-- approved or published. GIF joins the accepted types; PDF stays for documents uploaded before the library.

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'application/pdf'],
    file_size_limit = 10485760
where id = 'media';

drop policy if exists media_staff_insert on storage.objects;
drop policy if exists media_staff_update on storage.objects;

create policy media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.media_object_writable(name));
-- A move is an update of the object name: the source must be in the bucket, the destination must be writable.
create policy media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.has_role('editor'))
  with check (bucket_id = 'media' and public.media_object_writable(name));
