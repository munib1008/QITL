set search_path = public, extensions;

-- Hardening from the Supabase security advisor.

-- Pin the search_path of the remaining functions.
alter function public.touch_updated_at() set search_path = public, extensions;
alter function public.quran_immutable() set search_path = public, extensions;
alter function public.grade_is_authentic(text) set search_path = public, extensions;
alter function public.check_quran_range() set search_path = public, extensions;
alter function public.progress_complete() set search_path = public, extensions;
alter function public.normalize_arabic(text) set search_path = public, extensions;
alter function public.normalize_latin(text) set search_path = public, extensions;

-- Trigger-only and internal functions are not part of the API.
revoke execute on function public.check_asset_rights(), public.index_event(), public.index_story(),
  public.latest_review_approved(text, uuid), public.check_region_area(), public.quran_immutable(),
  public.check_quran_range(), public.progress_complete(), public.touch_updated_at() from public, anon, authenticated;

-- Moderation needs a signed-in moderator (checked inside); anonymous callers never reach it.
revoke execute on function public.moderate(text, uuid, text, text) from public, anon;

-- has_role(), is_staff() and source_publishable() stay executable: RLS policies call them as the querying role,
-- and they reveal only facts about the caller or a public licence state. unsubscribe() is public by design.
