# Supabase setup and deployment

Everything database-backed (accounts, bookmarks, notes, progress, discussion, moderation, the editorial tools, stories, events, atlas geometry, genealogy, hadith, Last Hour, full search) needs a Supabase project. Without one the site still runs: reading the journey, prophet pages, timeline, place lists and search over the journey all work, and every database feature shows a visible "not configured" state.

## 1. Create the project

1. Create a Supabase project (region close to most readers). Note the project URL, the anon (publishable) key and the service role key.
2. **Database → Extensions**: PostGIS is enabled by the first migration (`create extension if not exists postgis`). If your project restricts extension creation, enable `postgis` and `pg_trgm` in the dashboard first.

## 2. Apply the migrations

With the Supabase CLI, from the repo root:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

`supabase db push` applies every file in `supabase/migrations/` in order. The same migrations are exercised by `pnpm test` against PGlite with PostGIS, except `…0700_storage.sql`, which needs Supabase Storage.

## 3. Auth

- **Authentication → URL configuration**: Site URL = `NEXT_PUBLIC_SITE_URL`; add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for development) to the redirect allow-list.
- **Email**: enable the email provider with "Confirm email" on. Configure custom SMTP for production so sign-in links come from your domain. Suggested magic-link template: subject "Your ZIQ sign-in link", body with `{{ .ConfirmationURL }}` and a line saying the link works once and expires.
- **Google (optional)**: enable the provider with your OAuth client, add the Supabase callback URL to the Google console, then set `NEXT_PUBLIC_AUTH_GOOGLE=1`.

## 4. First admin

Sign in once on the site, then in the SQL editor:

```sql
insert into public.role_assignments (user_id, role, credential_note)
select id, 'admin', 'Project owner' from auth.users where email = '<your email>';
```

Further roles are granted in **Editorial → Users and roles**. Verify identity, and for scholarly reviewers credentials, before granting a role.

## 5. Environment

Copy `.env.example` to `.env.local` (development) or set the same variables on the host. `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are server-only and must never be prefixed `NEXT_PUBLIC_`.

## 6. Content

1. Read the Tanzil terms at https://tanzil.net/download/, then import the verified Quran text: `pnpm tsx scripts/import-quran.ts --pin`. Commit `content/quran/` (the text is verbatim and checksummed), or run the import in CI with `--expect-sha256 <hex>`.
2. Register every other source (translations, tafsir, hadith editions, map tiles) in **Editorial → Sources and licences** and clear its rights before importing anything from it.
3. Turn features on in `feature_flags` only once they have reviewed content.

## 7. Deploy

The app is a standard Next.js 15 app (`pnpm build`, `pnpm start`), and runs on any Node host or on Vercel. Middleware must run (it selects the interface language and refreshes the session). CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit, database, build, end-to-end and accessibility tests on every pull request.

## 8. Backups and restore checks

- Enable point-in-time recovery (Pro plan) or schedule daily logical backups: `supabase db dump --data-only > backup.sql`.
- Monthly restore check: create a scratch project, `supabase db push`, restore the dump, and run `select count(*) from public.quran_verses` (expect 6236 once imported) and a spot check of published stories, claims and their references.
- The Quran text can always be re-verified against `content/quran/source.json` (sha256).
