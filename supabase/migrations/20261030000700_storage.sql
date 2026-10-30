-- @supabase-only
-- Storage buckets and policies (Supabase Storage). Skipped by the PGlite test harness.
-- media: approved, licensed images; public read, staff write. exports: user data exports; owner read only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']),
  ('exports', 'exports', false, 52428800, array['application/json'])
on conflict (id) do nothing;

-- Approved files live outside pending/; uploads waiting for approval are visible to staff only.
create policy media_public_read on storage.objects for select using (bucket_id = 'media' and coalesce((storage.foldername(name))[1], '') <> 'pending');
create policy media_staff_read_pending on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_staff());
create policy media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.has_role('editor') and (storage.foldername(name))[1] = 'pending');
create policy media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.has_role('editor'));
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.has_role('admin'));

-- Exports live under exports/<user id>/...; only that user can read them. They are written by the server job.
create policy exports_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
