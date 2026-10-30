-- @supabase-only
set search_path = public, extensions;

-- Storage for the Story Player (migration 1300): narration files and licensed ambience, in a private bucket. Readers get
-- short-lived signed URLs, and only for approved audio of a published scene or approved ambience; producers see all.
-- Skipped by the PGlite test harness.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('narration', 'narration', false, 52428800, array['audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav'])
on conflict (id) do nothing;

create policy narration_public_read on storage.objects for select using (
  bucket_id = 'narration' and (
    exists (select 1 from public.narration_audio a where a.storage_path = storage.objects.name and a.status = 'approved' and public.scene_public(a.scene_id))
    or exists (select 1 from public.scene_ambient_audio m where m.storage_path = storage.objects.name and m.approved_by is not null)
    or public.is_producer()));
create policy narration_producer_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'narration' and public.has_role('audio_producer'));
create policy narration_producer_update on storage.objects for update to authenticated
  using (bucket_id = 'narration' and public.has_role('audio_producer'));
create policy narration_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'narration' and public.has_role('admin'));
