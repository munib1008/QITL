# Threat model

Scope: the QITL web app (Next.js on a serverless host), Supabase (Postgres, Auth, Storage) and the browser. Method: assets → threats → controls → residual risk.

## Assets

1. **Integrity of religious content**: Quran text, hadith text and gradings, dates, places, lineage. The highest-value asset: a silent alteration does real harm.
2. **Readers' private data**: email, private notes, bookmarks, reading history.
3. **Community health**: discussions free of abuse, spam and misinformation presented as knowledge.
4. **Editorial authority**: the scholarly reviewer role and the publish gate.
5. **Availability** of free public reading.

## Threats and controls

| Threat | Control | Where |
|---|---|---|
| Altered or fabricated Quran text | Imported only from Tanzil, verbatim, checksum pinned in `content/quran/source.json`; app refuses to serve on mismatch; DB rows immutable in place | `scripts/import-quran.ts`, `src/content/quran.ts`, `quran_immutable()` |
| Unreviewed claim published | Triggers refuse publish without referenced, approved claims and a reviewer's approval; no reviewer approves their own work of any review type, and the author column is stamped by the database | `guard_*`, `check_reviewer()`, `no_self_review()`, `stamp_author()` |
| Privilege escalation to editor or reviewer | Roles only via `role_assignments`, insertable only by admins (RLS), audited; identity and credentials checked by hand | RLS, `audit()` |
| Reading someone else's notes or bookmarks | Owner-only RLS on every personal table, forced RLS (`force row level security`), no staff read policy | `…0500_rls` |
| Service role key leak | Server-only env, never `NEXT_PUBLIC_`; used only for account deletion and trusted jobs | `src/lib/supabase/server.ts` |
| CSRF on cookie-authenticated mutations | Origin/Referer must match the site; Supabase cookies are `SameSite=Lax` | `sameOrigin()` in `src/lib/api.ts` |
| XSS through comments or editorial Markdown | React escapes text; Markdown renderer builds elements (no raw HTML), allows only same-site or https links; nonce-based CSP without `'unsafe-inline'` scripts or third-party script origins; `object-src 'none'` | `src/components/ui/Markdown.tsx`, `src/lib/security/csp.ts`, `src/middleware.ts` |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | `next.config.ts` |
| Open redirect after sign-in | `safeReturnTo()` accepts same-site paths only | `src/lib/validation.ts` |
| Malformed or oversized input | Zod on every route; length checks in the DB; `target_id` pattern | `src/lib/validation.ts`, migrations |
| Comment spam and flooding | Per-user DB throttle (`rate_limit_events`); bans; one report per person per item | `throttle()`, `before_comment()` |
| Harassment, misinformation in comments | Reports, auto-hide at three, moderator queue, logged decisions, appeals; comments labelled "not verified knowledge" | `moderate()`, community pages |
| Moderation logs leaking personal content | Logs store ids and reason codes only | `moderation_actions` |
| Private note content in logs | Notes are not audited; API never logs bodies; DB errors are logged by code only | `audit()` scope, `dbError()` |
| Unsafe uploads | Bucket size and MIME limits; editors upload to `pending/`; `assets` requires alt, credit, source; `depicts_person` must be false | `…0700_storage`, `assets` |
| Licence violation (republishing unlicensed translations) | RLS hides text from sources not `cleared`/`public_domain`; UI shows "licence pending" | `source_publishable()` |
| Fabricated coordinates | Unknown places have NULL geometry by constraint; regions have a minimum area; the map lists unknowns beside it | `place_geometries` checks |
| Denial of service on search | Query length capped; results capped at 50; per-IP sliding-window rate limits on every API route | `/api/search`, `search()`, `src/lib/security/rate-limit.ts` |
| Cost abuse of paid AI, translation and narration | Staff roles, plus a per-user database throttle | `throttle_action()` |

## Residual risks and follow-ups

- **Pages render per request** because the CSP carries a per-request nonce; cache data rather than HTML if load grows (`docs/SECURITY.md`).
- **In-memory rate limits are per instance**; configure the Upstash-compatible store for limits shared across instances. Volumetric floods still rely on the host's protections.
- **Upload scanning** (malware) is not implemented; uploads are limited to staff and to image/PDF types.
- **Email digest sending** is not implemented yet (preferences, unsubscribe tokens and the notification queue are).
- **Reviewer identity** is a manual admin process by design; there is no automated credential verification.
