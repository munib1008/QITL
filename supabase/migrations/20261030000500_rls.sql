set search_path = public, extensions;

-- Row level security for every table. Default deny: a table without a policy is unreadable by anon/authenticated.
-- Public reading: only published (or catalogue) rows. Personal data: owner only. Staff writes: by role.
-- Source and text tables are never publicly writable; imports run with the service role.

do $$
declare t text;
begin
  -- PostGIS's spatial_ref_sys is owned by the extension (and by supabase_admin on Supabase): leave it alone.
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Table privileges: RLS decides rows; grants decide verbs. Start from none (Supabase's default
-- privileges grant everything to anon and authenticated), then grant exactly what is needed.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
revoke select on public.audit_logs, public.rate_limit_events, public.role_assignments, public.moderation_actions,
  public.bans, public.appeals, public.data_jobs, public.reports, public.source_import_jobs, public.private_notes,
  public.reading_progress, public.bookmarks, public.notifications, public.notification_prefs, public.discussion_follows,
  public.saved_collections, public.saved_collection_items, public.user_blocks, public.legal_acceptances,
  public.comment_revisions, public.correction_requests from anon;
grant insert, update, delete on public.bookmarks, public.reading_progress, public.private_notes, public.saved_collections,
  public.saved_collection_items, public.discussion_follows, public.user_blocks, public.reactions to authenticated;
grant insert, update on public.discussions, public.comments, public.profiles, public.notification_prefs, public.notifications to authenticated;
grant insert on public.reports, public.appeals, public.data_jobs, public.legal_acceptances, public.correction_requests to authenticated;
grant insert, update, delete on public.evidence_claims, public.claim_references, public.people, public.person_aliases,
  public.relationships, public.locations, public.place_geometries, public.historical_events, public.event_people,
  public.event_places, public.event_relationships, public.event_claims, public.topics, public.stories, public.chapters,
  public.chapter_claims, public.event_stories, public.taggings, public.glossary_terms, public.assets, public.asset_links,
  public.revision_notes, public.site_settings, public.feature_flags, public.sources, public.legal_documents to authenticated;
grant insert on public.editorial_reviews to authenticated;
grant update on public.correction_requests, public.appeals to authenticated;
grant insert, delete on public.role_assignments to authenticated;
grant select on public.role_assignments, public.audit_logs, public.moderation_actions, public.bans, public.reports,
  public.appeals, public.data_jobs, public.source_import_jobs, public.comment_revisions to authenticated;
grant insert, update on public.bans to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.moderate(text, uuid, text, text), public.export_my_data() to authenticated;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;
-- Internal helpers are for triggers only, not for direct calls through the API.
revoke execute on function public.throttle(text, integer, integer), public.is_banned(uuid), public.audit(),
  public.handle_new_user(), public.snapshot_version(), public.guard_entity_publish(), public.guard_claim_status(),
  public.check_reviewer(), public.before_comment(), public.before_discussion(), public.before_report(),
  public.after_report(), public.after_comment() from public, anon, authenticated;

-- ---------- Catalogue and text (read: public, published or rights-cleared; write: service role only) ----------
create policy read_all on public.hadith_collections for select using (true);
create policy read_all on public.quran_surahs for select using (true);
create policy read_all on public.quran_verses for select using (true);
create policy read_all on public.approximate_polygon_constraints for select using (true);
create policy read_cleared on public.quran_translations for select using (public.source_publishable(source_id));
create policy read_cleared on public.tafsir_entries for select using (public.source_publishable(source_id));
create policy read_cleared on public.hadith_translations for select using (public.source_publishable(source_id));
create policy read_published on public.hadith_entries for select using (status = 'published' or public.is_staff());
create policy read_published on public.hadith_books for select using (true);
create policy read_published on public.hadith_chapters for select using (true);
create policy read_published on public.hadith_number_variants for select using (exists (select 1 from public.hadith_entries h where h.id = hadith_id and (h.status = 'published' or public.is_staff())));
create policy read_published on public.hadith_gradings for select using (exists (select 1 from public.hadith_entries h where h.id = hadith_id and (h.status = 'published' or public.is_staff())));
create policy read_sources on public.sources for select using (true);
create policy staff_write on public.sources for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy read_versions on public.source_versions for select using (true);
create policy admin_read on public.source_import_jobs for select to authenticated using (public.has_role('admin'));

-- ---------- Editorial content: public sees published; staff see all; editors draft; reviewers review ----------
do $$
declare t text;
begin
  foreach t in array array['people', 'relationships', 'locations', 'place_geometries', 'historical_events', 'stories', 'chapters', 'glossary_terms', 'assets'] loop
    execute format('create policy read_published on public.%I for select using (status = ''published'' or public.is_staff())', t);
    execute format('create policy editor_insert on public.%I for insert to authenticated with check (public.has_role(''editor'') and status in (''draft'', ''in_review''))', t);
    -- Editors move content between draft and review; publishing is guarded by triggers (evidence + review).
    execute format('create policy editor_update on public.%I for update to authenticated using (public.has_role(''editor'') or public.has_role(''scholarly_reviewer'')) with check (public.has_role(''editor'') or public.has_role(''scholarly_reviewer''))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using (public.has_role(''admin'') and status <> ''published'')', t);
  end loop;
end $$;

-- Approved claims are the evidence behind published content, so readers must see them too.
create policy read_published on public.evidence_claims for select using (status in ('approved', 'published') or public.is_staff());
create policy editor_insert on public.evidence_claims for insert to authenticated with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.evidence_claims for update to authenticated using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.evidence_claims for delete to authenticated using (public.has_role('admin') and status not in ('approved', 'published'));

do $$
declare t text;
begin
  -- Link tables follow their parents: public when the parent is visible, writable by editors.
  foreach t in array array['claim_references', 'person_aliases', 'event_people', 'event_places', 'event_relationships', 'event_claims', 'chapter_claims', 'event_stories', 'taggings', 'asset_links', 'topics'] loop
    execute format('create policy read_all on public.%I for select using (true)', t);
    execute format('create policy editor_write on public.%I for all to authenticated using (public.has_role(''editor'')) with check (public.has_role(''editor''))', t);
  end loop;
end $$;

create policy read_reviews on public.editorial_reviews for select to authenticated using (public.is_staff());
create policy reviewer_insert on public.editorial_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.has_role('scholarly_reviewer'));

create policy read_versions on public.content_versions for select using (true);
create policy read_public_notes on public.revision_notes for select using (public or public.is_staff());
create policy editor_write on public.revision_notes for insert to authenticated with check (public.has_role('editor') and created_by = auth.uid());

create policy submit_correction on public.correction_requests for insert to authenticated with check (submitted_by = auth.uid() and status = 'open');
create policy read_own_or_staff on public.correction_requests for select to authenticated using (submitted_by = auth.uid() or public.is_staff());
create policy staff_resolve on public.correction_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy admin_read on public.audit_logs for select to authenticated using (public.has_role('admin'));
-- audit_logs, rate_limit_events: no insert/update/delete policy; only security-definer triggers write them.

-- ---------- Roles ----------
create policy read_own_or_admin on public.role_assignments for select to authenticated using (user_id = auth.uid() or public.has_role('admin'));
create policy admin_grant on public.role_assignments for insert to authenticated with check (public.has_role('admin') and granted_by = auth.uid());
create policy admin_revoke on public.role_assignments for delete to authenticated using (public.has_role('admin') and user_id <> auth.uid());

-- ---------- Profiles ----------
create policy read_profiles on public.profiles for select using (true);
create policy update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Personal data: owner only (no staff read, not even admins) ----------
do $$
declare t text;
begin
  foreach t in array array['bookmarks', 'reading_progress', 'private_notes', 'saved_collections', 'discussion_follows', 'notification_prefs', 'legal_acceptances'] loop
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
create policy owner_items on public.saved_collection_items for all to authenticated
  using (exists (select 1 from public.saved_collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.saved_collections c where c.id = collection_id and c.user_id = auth.uid())
    and exists (select 1 from public.bookmarks b where b.id = bookmark_id and b.user_id = auth.uid()));
create policy owner_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy owner_mark_read on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owner_blocks on public.user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy owner_jobs on public.data_jobs for select to authenticated using (user_id = auth.uid() or public.has_role('admin'));
create policy owner_request on public.data_jobs for insert to authenticated with check (user_id = auth.uid() and status = 'requested');

-- ---------- Discussion ----------
create policy read_discussions on public.discussions for select using (status in ('open', 'locked') or public.has_role('moderator') or created_by = auth.uid());
create policy start_discussion on public.discussions for insert to authenticated with check (created_by = auth.uid());
create policy moderate_discussion on public.discussions for update to authenticated using (public.has_role('moderator')) with check (public.has_role('moderator'));

-- Hidden and removed comments stay readable as rows (they keep their place); comments_public blanks the body.
create policy read_comments on public.comments for select using (
  exists (select 1 from public.discussions d where d.id = discussion_id and (d.status in ('open', 'locked') or public.has_role('moderator')))
);
create policy post_comment on public.comments for insert to authenticated with check (author_id = auth.uid() and status = 'visible');
-- Authors edit their own visible comment within 30 minutes; status is not theirs to change.
create policy edit_own_comment on public.comments for update to authenticated
  using (author_id = auth.uid() and status = 'visible' and created_at > now() - interval '30 minutes')
  with check (author_id = auth.uid() and status = 'visible');
-- Authors delete their own comment (a hard delete of their words; replies stay attached to the thread).
create policy delete_own_comment on public.comments for delete to authenticated using (author_id = auth.uid());
create policy moderator_update on public.comments for update to authenticated using (public.has_role('moderator')) with check (public.has_role('moderator'));

create policy read_revisions on public.comment_revisions for select to authenticated using (public.has_role('moderator'));
create policy read_reactions on public.reactions for select using (true);
create policy own_reactions on public.reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy file_report on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy read_reports on public.reports for select to authenticated using (reporter_id = auth.uid() or public.has_role('moderator'));
create policy read_moderation on public.moderation_actions for select to authenticated using (public.has_role('moderator'));
create policy read_bans on public.bans for select to authenticated using (user_id = auth.uid() or public.has_role('moderator'));
create policy issue_bans on public.bans for insert to authenticated with check (public.has_role('moderator') and created_by = auth.uid());
create policy lift_bans on public.bans for update to authenticated using (public.has_role('moderator')) with check (public.has_role('moderator'));
create policy own_appeals on public.appeals for insert to authenticated with check (user_id = auth.uid());
create policy read_appeals on public.appeals for select to authenticated using (user_id = auth.uid() or public.has_role('moderator'));
create policy decide_appeals on public.appeals for update to authenticated using (public.has_role('moderator')) with check (public.has_role('moderator'));

-- ---------- Platform ----------
create policy read_flags on public.feature_flags for select using (true);
create policy admin_flags on public.feature_flags for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy read_settings on public.site_settings for select using (true);
create policy admin_settings on public.site_settings for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy read_legal on public.legal_documents for select using (published_at is not null or public.has_role('admin'));
create policy admin_legal on public.legal_documents for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
