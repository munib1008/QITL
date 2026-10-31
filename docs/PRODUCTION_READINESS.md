# Production readiness

What is live, what must be done by the owner, and how to deploy. Status of each feature: `docs/FEATURE_ACCEPTANCE_MATRIX.md`.
Security detail: `docs/SECURITY.md`; operations: `docs/OPERATIONS.md`; licences: `docs/LICENSING.md`.

## Deployment

1. Push to `munib1008/QITL` `main`; Vercel builds and deploys automatically (project `qitl`).
2. Migrations are applied to Supabase separately (the repository's `supabase/migrations`, in file order). All existing
   migrations are applied to the production project.
3. The build needs no secrets. Verify after each deploy: `/`, `/quran/1`, `/ar`, `/ur`, `/search`, `/dreams` return 200 and the
   `Content-Security-Policy` header carries a nonce.

## Environment variables (Vercel project settings; none are set unless listed)

| Variable | Purpose | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical URL (`https://qitl.vercel.app`) | set |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | database client | set |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only: account deletion, media scan results, the Quran import to the database | account deletion, media, `import-quran --db` |
| `LARA_ACCESS_KEY_ID`, `LARA_ACCESS_KEY_SECRET` | machine translation of story scripts | Story Studio translation |
| `ANTHROPIC_API_KEY` (`ANTHROPIC_MODEL`) | optional AI drafts (always saved as drafts) | Studio and interpretation drafts |
| `NARRATION_PROVIDER` + the provider's key | speech synthesis | Listen mode (no provider is implemented) |
| `MALWARE_SCAN_URL`, `MALWARE_SCAN_TOKEN` | upload scanning; without it uploads wait for an admin acknowledgement | Media Library |
| `QURANENC_API_KEY`, `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, `SUNNAH_API_KEY` | source adapters (only for editions whose licence is cleared) | translations, hadith |
| `NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | real map tiles | Atlas |
| `CSP_MODE`, `RATE_LIMIT_*`, `UPSTASH_REDIS_REST_URL/TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_ANALYTICS_URL` | optional hardening and monitoring | see `.env.example` |

## Owner-only actions (nothing below can be done by code)

| Action | Where | Unblocks |
|---|---|---|
| Supabase Auth: Site URL `https://qitl.vercel.app`, redirect `https://qitl.vercel.app/auth/callback`; grant yourself `admin` (SQL: insert into `role_assignments`) | Supabase dashboard | sign-in; every admin screen |
| Appoint scholarly reviewers (`scholarly_reviewer`), science reviewers (`science_reviewer`), translation reviewers, audio producers; verify muftis at `/admin/mufti` | `/admin/users` | **every religious or research item: nothing can be published without them** |
| Sign off the licence registry (start with Tanzil) and record credit wording for the conditional sources | `/admin/licences` | audio, translations, word data |
| Written permission: King Fahd Complex (other riwayat texts, audio hosting and credit), sunnah.com (API key and terms) | by email | other riwayat, hadith text |
| Decide Quranic Arabic Corpus (GPL) vs Quran Foundation word data | owner decision | word by word |
| A TTS provider with a commercial-use agreement; licensed ambience recordings | contract | narration |
| Load the Quran text into the database | `.env.local` with the service key, then the command in `docs/LICENSING.md` | database-side Quran features |
| Qualified review of Arabic and Urdu interface text (all drafts) | translators | trilingual release |
| Enable `pg_cron` if absent (it is present in production: 2 retention jobs verified) | Supabase | dream-request retention |

## Content is empty by design

No story, event, lesson, remedy, research record, translation, hadith text or recitation is published. Every module renders a
designed empty state until editors enter sourced content and reviewers approve it. The 5 concept image sets and the motion
clips in `design/concepts/` are not on the site (a test enforces this).

## Known limitations

- Every page renders per request (nonce CSP); monitor cost and first-byte time.
- Rate limiting is per server instance until Upstash is configured.
- Reader performance on very long surahs on slow phones: improved, not solved (`docs/RESPONSIVE.md`).
- Admin editor forms are English only (about 600 strings); the rest of the interface is localised in draft.
- No real-device, screen-reader or load testing; Playwright emulation and axe only.
- The media library accepts images only (no video); the motion clips need a video-capable asset type first.

## Before announcing the site

1. Owner actions above, at least: Auth URLs, admin grant, one scholarly reviewer.
2. A clean full test run on a quiet machine (`pnpm test`, `pnpm test:e2e`), recorded in this file.
3. Legal pages marked "draft for counsel" reviewed by counsel (`/terms`, `/privacy`).
4. A backup and restore rehearsal (`docs/OPERATIONS.md`).
