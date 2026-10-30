-- Independent permissions for the production pipeline (story production, translation, narration) and verified
-- muftis. Enum values are added in their own migration: PostgreSQL cannot use a new enum value in the transaction
-- that adds it.
alter type public.app_role add value if not exists 'translation_reviewer';
alter type public.app_role add value if not exists 'audio_producer';
alter type public.app_role add value if not exists 'mufti';
