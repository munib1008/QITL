# Security

Findings of the security and operations hardening pass (branch `fin/security`, 2026-10-31) and how each was resolved.
The threat model (assets, threats, controls) is `docs/engineering/threat-model.md`; operating the site (deploy, env vars,
backups, incidents) is `docs/OPERATIONS.md`.

## Findings and resolutions

| # | Issue | Severity | Resolution | Test |
|---|---|---|---|---|
| 1 | Scripts allowed with `'unsafe-inline'`: any HTML injection would execute. | High | Nonce-based CSP built per request in the middleware: `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'`; the theme script carries the nonce; `connect-src`/`img-src`/`media-src` limited to self, the Supabase project and the tile server; violations reported to `/api/csp-report`; `CSP_MODE=report-only` for trials. | `tests/unit/security.test.ts`, `tests/e2e/csp.spec.ts`, `tests/e2e/console.spec.ts` |
| 2 | Editorial self-approval: `editorial_reviews` refused self-review only for claims (and qiraat). A user holding editor + scholarly reviewer could approve their own story, event, relationship, place, story section, quiz, media, interpretation, word sense, commentary link, narration script, creation entry, guidance topic/lesson/link/safety note or dream response, and then publish it. | High | `review_entity_authors` registry (review type → table + author column, several tables per type allowed) and one trigger `editorial_reviews_no_self_review` for every type. A test fails for any new review type that is not registered. | `tests/db/security.test.ts` §4 |
| 3 | The author column (`created_by`) was whatever the client sent: an editor could leave it empty or name a colleague, which also defeated the existing claim and qiraat self-review checks. | High | `stamp_author()` trigger on every registered table: on insert through the API it is the acting user, and it cannot be changed later (service-role jobs and `ON DELETE SET NULL` unaffected). | §4 "author column is stamped" |
| 4 | Translation reviews and interpretation check sign-offs had no self-review rule. | Medium | `translation_reviews_not_self`: a human translation is never reviewed by its translator (a Lara machine translation is still checked by the translation reviewer who requested it, by the module's design). `interpretation_reviews_not_self`: the author never signs the substantive checks (hadith grading, Sunni scholarly, language quality); the editorial checks stay signable by the drafting editor, as designed, and publishing still needs another reviewer (#2). | §4 |
| 5 | Supabase's default privileges grant every new table and view to `anon`/`authenticated` (ALL, including TRUNCATE, which RLS does not cover). `search_index`, `story_sections`, `story_quizzes`, `story_media`, `quiz_questions` and the views `source_licences`, `content_licence_registry`, `quran_word_occurrences` kept anon INSERT/UPDATE/DELETE/TRUNCATE; module tables kept TRUNCATE for authenticated. RLS still blocked row writes, so this was defence in depth, not an open hole. | Medium | Migration sweep: no TRUNCATE/REFERENCES/TRIGGER for API roles, no writes through views, no anon writes, and authenticated keeps a write verb only where a policy can allow it. The DB tests now replay Supabase's default privileges (`createDb({ supabaseDefaults: true })`) so a forgotten revoke fails CI. | §1 |
| 6 | `quran_edition_ayah()` (SECURITY DEFINER) was executable by anyone and returned an edition's Arabic text past the licence gate on `quran_edition_verses`. | Medium | Execute revoked from `public`, `anon`, `authenticated` (the guard trigger that uses it runs as the owner). A test lists every definer function anon can call that is not a yes/no visibility helper. | §1 |
| 7 | The service worker cached private pages (dream requests, mufti questions and answers, review boards) in the browser's Cache Storage, and missed the `/ur` prefix for account and admin pages: readable later on a shared device. | Medium | `public/sw.js` never caches those sections in any language; cache bumped to `qitl-pages-v2`, so every copy cached by v1 is deleted on activation. | manual (service worker), regex in `sw.js` |
| 8 | No HTTP rate limiting: anonymous endpoints (search, reads, unsubscribe) and paid calls (Claude drafts, Lara translation, narration) were unthrottled; the DB throttle covered comments, discussions, reports and dream requests only. | Medium | Sliding-window limiter (`src/lib/security/rate-limit.ts`): per IP in the middleware for every `/api` request (tighter buckets for search, mutations, token and report endpoints), per user in `requireUser`; memory store by default, Upstash-compatible REST store for multi-instance hosting; 429 with `Retry-After` and `RateLimit-*`. Paid and export actions also go through `public.throttle_action()` (database throttle, across instances). | `tests/unit/security.test.ts`, §5 |
| 9 | Dream requests past their retention date were deleted only if someone ran `purge_expired_dream_requests()` by hand. | Medium | `pg_cron` job `qitl-purge-expired-dream-requests` daily 03:17 UTC; the migration is a no-op (with a NOTICE) where pg_cron is unavailable, e.g. PGlite. | §5 |
| 10 | Markdown links: `safeHref` accepted `/\host`, which browsers normalise to `//host` (an off-site link that looks internal). | Low | Backslashes and control characters are refused; tests run XSS payloads through every Markdown construct. | `tests/unit/sanitize.test.tsx` |
| 11 | JSON-LD was inlined with `JSON.stringify`, so a value containing `</script>` could close the element (today the values are static). | Low | `jsonForScript()` escapes `<`, `>`, `&`, U+2028/9. | `tests/unit/sanitize.test.tsx` |
| 12 | Narration and ambience approvals stored whatever `approved_by` the client sent. | Low | `stamp_approver()` records the acting user. | §4 (trigger installed) |
| 13 | `rate_limit_events` grew without bound. | Low | `purge_rate_limit_events()` (older than 2 days), scheduled daily with pg_cron. | §5 |
| 14 | Server errors went to `console.error` unstructured; no error tracking; no rule keeping private text out of logs. | Low | Structured JSON logging and optional Sentry-compatible reporting with scrubbing (below). | `tests/unit/security.test.ts` "monitoring" |
| 15 | A database 429 had no `Retry-After`. | Low | `dbError()` sets `Retry-After: 60`. | unit |

Checked and found sound (no change): RLS enabled and forced on every table; every view `security_invoker`; owner-only
personal tables; no definer function callable through the API writes `role_assignments`; no non-admin role can grant,
change or revoke a role; admins grant only in their own name and cannot revoke their own admin role; muftis cannot verify
or dream-qualify themselves; only an admin approves a content permission; the existing claim, dream-response, mufti
answer, lifestyle and qiraat self-review rules; CSRF origin checks; `safeReturnTo()`.

## Content Security Policy

Built per request in `src/middleware.ts` with `src/lib/security/csp.ts`. A fresh 128-bit nonce goes on the request
(`x-nonce` and the CSP header, so Next.js stamps its own scripts) and on the response. The root layout reads it with
`headers()` for the pre-paint theme script.

```
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: <supabase> <tiles>; font-src 'self'; connect-src 'self' <supabase> <supabase ws> <tiles> [<analytics>];
media-src 'self' blob: <supabase>; worker-src 'self' blob:; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none';
base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests (https only); report-uri /api/csp-report
```

- Styles keep `'unsafe-inline'` (React style attributes, next/font); a style nonce would disable it.
- API routes and `/auth/*` get `default-src 'none'; frame-ancestors 'none'` from `next.config.ts`; `/sw.js` gets a same-origin policy.
- Rollout: run the suite with `CSP_MODE=report-only` first (violations are logged, nothing is blocked), then enforce (the default).
- **Cost:** a nonce cannot be served from a prebuilt HTML file, so every page now renders per request (`ƒ` in the build output) instead of being statically generated or ISR-cached. Supabase reads on public pages therefore run per request. If load grows, cache data (not HTML) with `unstable_cache`/`fetch` revalidation, or put a CDN in front for the API JSON. Do not go back to `'unsafe-inline'`.

## Rate limiting

| Bucket | Key | Default | Where |
|---|---|---|---|
| `api` | IP | 300 / 60 s | every `/api` request (middleware) |
| `search` | IP | 60 / 60 s | `/api/search` |
| `mutation` | IP | 60 / 60 s | non-GET `/api` |
| `token` | IP | 20 / 60 s | `/api/unsubscribe` |
| `report` | IP | 30 / 60 s | `/api/csp-report` |
| `user` | user id | 240 / 60 s | every signed-in call (`requireUser`) |
| `userMutation` | user id | 60 / 60 s | signed-in writes |
| DB `throttle_action` | user id | ai_draft 6/min 60/h, translate 10/min 100/h, narrate 30/min 300/h, export 3/min 20/h | paid and export routes |
| DB `throttle` (existing) | user id | comment 5/60, discussion 2/10, report 5/30, dream_request 3/10 | triggers |

Override any HTTP bucket with `RATE_LIMIT_<BUCKET>="<n>/<seconds>"`. The IP is the first `X-Forwarded-For` hop: on a
host that does not set that header itself (Vercel, Netlify and most proxies do), clients could rotate it, so keep the
host's own DDoS protection on. A failing remote store fails open and logs `rate_limit_store_failed`.

## Content sanitisation

Every place editor or user text reaches the page:

| Text | Rendered by | Notes |
|---|---|---|
| Story chapters, creation entries, lifestyle evidence, interpretation explanations, mufti answers, dream responses, study panel notes, admin previews | `src/components/ui/Markdown.tsx` | Builds React elements; raw HTML is shown as text; links only same-site paths, `#anchors` or `https:` (no `//`, backslash or control characters); external links get `rel="noopener noreferrer"`. |
| Comments, discussion titles, profile names, questions, dream request text | plain React text nodes | Escaped by React. |
| Source and licence URLs | `<a href>` | The database only accepts `https://` URLs (check constraints). |
| JSON-LD | `jsonForScript()` | Escaped for inline script. |

There is no `dangerouslySetInnerHTML` with user or editor content (only the constant theme script and JSON-LD).

## Monitoring, logging and analytics

- `src/lib/observability/errors.ts`: `logEvent/logWarn/logError` write one JSON line with allow-listed keys only;
  `reportError` (also wired to Next's `onRequestError` in `src/instrumentation.ts`) logs and, when `SENTRY_DSN` is set,
  posts a Sentry envelope (no SDK, server side only, 2 s timeout).
- `src/lib/observability/scrub.ts` is the single rule set: no bodies, headers, cookies, query strings, IPs, emails or user
  ids; ids in paths become `:id`; on private routes (`dreams`, `mufti`, `me`, `account`, `community/questions`,
  `review-board`, and their admin APIs) the error message is withheld entirely, because a database error can quote the
  row it failed on; elsewhere row detail, emails, tokens and long numbers are redacted.
- `src/lib/observability/analytics.ts` + `<Analytics />`: off unless `NEXT_PUBLIC_ANALYTICS_URL` is set; fixed event
  names, path without query or ids, locale; never on private or staff pages; honours Do Not Track and Global Privacy
  Control; no cookies or identifiers. The collector origin is added to `connect-src` only when set.
- Browser-side errors are not reported (that would need a third-party script); the console test catches them in CI.

## Residual risks

- Pages are dynamically rendered because of the nonce (see CSP, "Cost").
- In-memory rate limits are per server instance; use the Upstash-compatible store for a hard limit across instances.
- Upload malware scanning is still not implemented (uploads are staff-only, image/PDF/audio types).
- Reviewer identity verification remains a manual admin process by design.
- pg_cron must be enabled on the Supabase project for retention to run (`docs/OPERATIONS.md`); without it the jobs must
  be run by another trusted scheduler.
