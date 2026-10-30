-- Three independent language preferences (docs/proposals/2026-10-31-briefs-review.md section 1, docs/I18N.md).
-- Reuses the existing per-user storage; no new table:
--   interface language        -> public.profiles.locale (already 'en' | 'ar' | 'ur'; mirrors the qitl-locale cookie)
--   narration language        -> public.story_playback_preferences.language (existing; now limited to en/ar/ur)
--   Quran translation language -> public.story_playback_preferences.quran_translation_language (new)
-- story_playback_preferences is private to its reader (RLS own-row policies in 20261031001300_narration.sql); profiles
-- is publicly readable, which is why only the interface language lives there.
-- A preference never makes text appear: a translation or narration is shown only from a licensed, reviewed edition.

alter table public.story_playback_preferences
  add column quran_translation_language text not null default 'en'
    check (quran_translation_language in ('en', 'ur', 'none'));

-- NOT VALID: enforced for every new write without failing on any legacy row.
alter table public.story_playback_preferences
  add constraint story_playback_preferences_language_check check (language in ('en', 'ar', 'ur')) not valid;

comment on column public.profiles.locale is 'Interface language (en, ar, ur). Mirrors the qitl-locale cookie.';
comment on column public.story_playback_preferences.language is 'Narration language (en, ar, ur).';
comment on column public.story_playback_preferences.quran_translation_language is
  'Quran translation shown under the Arabic (en, ur, or none = the Arabic alone). Shown only from a cleared, reviewed edition.';
