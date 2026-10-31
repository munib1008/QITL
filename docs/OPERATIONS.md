# Operations

How to deploy and run QITL, what to configure, how to back up and restore, and what to do in an incident. Security
findings and controls are in `docs/SECURITY.md`; first-time Supabase setup is in `docs/engineering/supabase-setup.md`.

## Deploy

1. **Checks** (CI runs them on every pull request): `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`.
2. **Database first.** Review new files in `supabase/migrations/`, take a backup (below), then `supabase db push`. Migrations
   are forward-only; a fix is a new migration.
3. **App.** Deploy the Next.js app (`pnpm build`, `pnpm start` on Node 20+, or Vercel). The middleware must run: it sets
   the CSP nonce, the language and the API rate limits, and refreshes the session.
4. **Verify** within 10 minutes:
   - `curl -sI https://<site>/ | grep -i content-security-policy` shows `'nonce-…'` and no `'unsafe-inline'` in `script-src`;
   - the home page, a prophet page, `/quran/1`, `/ar` and `/ur` load without console errors;
   - `curl -s https://<site>/api/search?q=musa` answers 200 with `RateLimit-Limit`;
   - the error log has no new `server_error` or `csp_violation` lines.
5. **Roll back** the app by redeploying the previous build. Roll back a CSP problem without a redeploy by setting
   `CSP_MODE=report-only` and restarting (violations are then only reported); fix, then return to `enforce`.

## Environment variables

`.env.example` lists every variable. Server-only values must never be prefixed `NEXT_PUBLIC_`.

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | yes | canonical URL, auth redirects, HSTS/upgrade-insecure-requests when https |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | for accounts and the database | Supabase project; its origin is added to the CSP |
| `SUPABASE_SERVICE_ROLE_KEY` | server | for deletion/export jobs | bypasses RLS; trusted jobs only |
| `DATABASE_URL` | server | for migrations and scripts | direct Postgres |
| `NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | public | optional | map tiles; origin added to the CSP |
| `NEXT_PUBLIC_AUTH_GOOGLE` | public | optional | show Google sign-in |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | server | optional | AI-assisted drafts |
| `LARA_ACCESS_KEY_ID`, `LARA_ACCESS_KEY_SECRET` | server | optional | machine translation |
| `NARRATION_PROVIDER` (+ provider keys) | server | optional | narration audio |
| `CSP_MODE` | server | optional | `enforce` (default) or `report-only` |
| `RATE_LIMIT_STORE` | server | optional | `memory` (default) or `upstash` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | server | optional | shared rate-limit store (any Upstash-compatible Redis REST endpoint; a free tier or self-hosted proxy is enough) |
| `RATE_LIMIT_<BUCKET>` | server | optional | override a bucket, e.g. `RATE_LIMIT_SEARCH=30/60` (buckets: API, SEARCH, MUTATION, TOKEN, REPORT, USER, USER_MUTATION) |
| `RATE_LIMIT_DISABLED` | server | optional | `1` turns the HTTP limits off (never in production; the DB throttle stays) |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | server | optional | error reports (Sentry, GlitchTip or self-hosted); scrubbed |
| `NEXT_PUBLIC_ANALYTICS_URL` | public | optional | privacy-safe analytics collector; empty = off |
| `QITL_E2E_FIXTURES` | server | tests only | enables test fixtures; never set in production |

Rotate a leaked secret at its provider first, then update the host's environment and redeploy. A leaked
`SUPABASE_SERVICE_ROLE_KEY` is an incident (below).

## Scheduled jobs

| Job | Schedule (UTC) | What | How |
|---|---|---|---|
| `qitl-purge-expired-dream-requests` | daily 03:17 | `public.purge_expired_dream_requests()`: deletes dream requests past `retain_until` with all child rows | pg_cron, migration `20261031002360_retention_schedule.sql` |
| `qitl-purge-rate-limit-events` | daily 03:27 | `public.purge_rate_limit_events()`: throttle log older than 2 days | pg_cron, same migration |

The migration schedules both when pg_cron is available and is a no-op (with a NOTICE) otherwise. On Supabase:
**Database → Extensions → pg_cron → enable**, then re-run the migration body (or `supabase db push` on a fresh project).
Check:

```sql
select jobname, schedule, active from cron.job where jobname like 'qitl-%';
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
```

Without pg_cron, run both functions daily with the service role from another trusted scheduler (a server cron calling
`select public.purge_expired_dream_requests(); select public.purge_rate_limit_events();` over `DATABASE_URL`). The dreams
privacy notice promises deletion, so a failed run is an incident.

## Media library: video clips

Migration `20261031002510_media_video.sql` is a normal migration. `20261031002511_media_video_storage.sql` is
`@supabase-only` (it widens the `media` bucket's allowed types to include `video/webm` and `video/mp4`; the size limit stays
10 MB, a clip is held to 8 MB by the app and the database): apply it on the Supabase project, the local test database skips
it. Clips are served from the public storage origin like images, so the storage egress and the bucket backup grow with them.
No transcoding happens anywhere: a clip is stored as uploaded, so ask editors to export with no location metadata. Video
is never autoplayed and is not seeded; the licence for a clip is recorded as an `image`-type content permission
(the registry has no separate video type).

## Backups and restore

- **Point-in-time recovery** (Supabase Pro) is the primary backup. Otherwise schedule a daily logical dump off the
  platform: `supabase db dump -f schema.sql && supabase db dump --data-only -f data.sql` (or `pg_dump "$DATABASE_URL"`),
  encrypted at rest, kept 30 days. Storage buckets (narration audio, assets) are backed up separately (`supabase storage`
  download or the S3 API).
- **Dreams retention applies to backups too:** keep dumps no longer than the shortest dream retention (30 days), so a
  restore never brings back a request its owner had deleted. After any restore, run `select public.purge_expired_dream_requests();`.
- **Monthly restore check:** create a scratch project, `supabase db push`, restore the data dump, then
  `select count(*) from public.quran_verses` (6236 once imported), spot-check published stories with their claims and
  references, and confirm `select count(*) from public.dream_requests where retain_until < now()` is 0 after the purge.
- The Quran text can always be re-verified against `content/quran/source.json` (sha256).

## Monitoring

- Logs are one JSON object per line (`level`, `event`, `ts`, allow-listed fields). Useful events: `server_error`,
  `db_error`, `csp_violation`, `rate_limit_store_failed`, `db_throttle_missing`, `error_report_failed`.
- Alert on: any `server_error` burst (> 10 in 5 min), `csp_violation` after a deploy, sustained 429s from one bucket, a
  failed `cron.job_run_details` row.
- Error reports (when `SENTRY_DSN` is set) never contain request bodies, query strings, emails, ids or private text; on
  dream, mufti, notes and account routes the message itself is withheld. Do not add free-text fields to log calls.

## Incident response

1. **Triage** (severity: S1 data exposure or content tampering, S2 outage, S3 degraded). Open an incident note with times in UTC.
2. **Contain:**
   - Leaked service-role key or JWT secret: rotate in Supabase (Project settings → API), update the host env, redeploy;
     review `public.audit_logs` and Supabase logs for use since the leak.
   - Tampered or unreviewed content published: unpublish (set `status` back to `draft`/`in_review`), check
     `audit_logs` and `editorial_reviews` for the actor, revoke their roles (`delete from public.role_assignments ...`) and
     record why in `moderation_actions`/the incident note.
   - Abuse or flood: lower the bucket (`RATE_LIMIT_<BUCKET>`), switch to the shared store, block at the host's firewall;
     ban accounts through the moderation tools.
   - XSS or CSP bypass: keep CSP enforced; remove the content; ship the fix; never relax the policy as a workaround.
   - Private data exposure (notes, dream requests, mufti questions): stop the leak first (revoke a grant, disable a
     route with a feature flag), then assess which users and fields were exposed.
3. **Eradicate and recover:** fix with a migration or code change, deploy, verify (Deploy step 4), restore from backup
   only if data was destroyed (and purge expired dream requests afterwards).
4. **Notify:** personal data breaches may need notifying the supervisory authority within 72 hours (GDPR art. 33) and
   the affected users without undue delay; scholarly content errors are corrected publicly through the corrections page.
5. **Review** within a week: timeline, root cause, the test that would have caught it (add it), and update
   `docs/SECURITY.md`.
