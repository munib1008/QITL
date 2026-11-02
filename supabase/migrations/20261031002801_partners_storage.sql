-- @supabase-only
set search_path = public, extensions;

-- Learning Partners: PRIVATE bucket for qualification evidence (ijazah scans, certificates, identity documents).
-- Objects live at <partner id>/<file name>. Nothing here is ever publicly readable; there is no public URL and no public policy.
-- Read: that partner's owner/admin members and staff. Write/delete: that partner's owner/admin. Skipped by the PGlite harness
-- (storage schema); covered by the deployment checklist in docs/LEARNING_PARTNERS.md.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-docs', 'partner-docs', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy partner_docs_read_member on storage.objects for select to authenticated
  using (bucket_id = 'partner-docs' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                          then public.partner_has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']) else false end);
create policy partner_docs_read_staff on storage.objects for select to authenticated
  using (bucket_id = 'partner-docs' and public.has_role('moderator'));
create policy partner_docs_insert_member on storage.objects for insert to authenticated
  with check (bucket_id = 'partner-docs' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                               then public.partner_has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']) else false end);
create policy partner_docs_delete_member on storage.objects for delete to authenticated
  using (bucket_id = 'partner-docs' and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                          then public.partner_has_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']) else false end);
