# API reference

All routes live under `src/app/api`. Payloads are validated on the server with Zod (`src/lib/validation.ts`); the database enforces the same rules again through row level security (RLS) and triggers, so the API is never the only lock.

Conventions:

- JSON in and out. Errors are `{ "error": string, "code": string, "issues"?: object }`.
- **Public reads** return only published or rights-cleared rows and are cacheable (`Cache-Control: public, s-maxage=…`).
- **Personal and staff routes** need a signed-in Supabase session cookie, and every mutation must come from this site (`Origin`/`Referer` check against `NEXT_PUBLIC_SITE_URL`). Responses are `no-store`.
- When Supabase is not configured, database-backed routes answer `503 not_configured` instead of pretending.

| Status | Code | Meaning |
|---|---|---|
| 400 | `bad_json` | Body is not JSON |
| 401 | `unauthorized` | Sign in required |
| 403 | `bad_origin` / `forbidden` / `edit_window` | Cross-site request, missing role or RLS refusal, or the 30-minute edit window has passed |
| 404 | `not_found` | Not found or not published |
| 409 | `duplicate` | Unique constraint |
| 422 | `invalid` / `rule` / `constraint` / `missing_reference` | Validation, editorial rule ("no evidence, no publish"), check constraint or foreign key |
| 429 | `rate_limited` | Database throttle (comments 5/min and 60/h, threads 2/min and 10/h, reports 5/min and 30/h) |
| 503 | `not_configured` / `source_not_imported` | Supabase or the verified Quran import is missing |

## Public, read-only

| Method and path | Query | Returns |
|---|---|---|
| `GET /api/journey` | | The journey content (`ziq.journey.v1`) with its `status` (draft until reviewed) |
| `GET /api/search` | `q` (1–120 chars), `facet` (comma list), `page` | `{ q, total, page, facets: {name: count}, database: "ok" \| "not_configured" \| "error", results: SearchHit[] }`. Journey content is always searched; the database index is added when configured. Arabic is normalised (vowel marks, letter forms) and transliterations match by trigram. |
| `GET /api/stories/:slug` | | A published story, its published chapters, each chapter's claims and their references |
| `GET /api/events` | `category`, `precision`, `from`, `to` (astronomical years; 1 BCE = 0) | Published events with people, places, date precision. A year filter never returns undated events. |
| `GET /api/atlas/places` | `bbox` (`minLng,minLat,maxLng,maxLat`), `year` | GeoJSON `FeatureCollection` of published geometries, plus `unknown: [{slug, name}]` for places with no geometry (listed, never placed) |
| `GET /api/people/:slug/graph` | `depth` (1–4) | `{ focus, nodes[], edges[] }`; every edge carries its claim, evidence kind and references |
| `GET /api/quran/:surah/:ayah` | | `{ reference, arabic, source: {name, version, license, url}, translations[] }`. Arabic only from the pinned import; translations only when their licence is cleared (RLS). |
| `GET /api/hadith/:collection/:number` | `numbering` | The narration with every grading (never collapsed), number variants and licensed translations. `ambiguous: true` when numbering systems collide. |
| `GET /api/last-hour` | | `{ date: null, note, signs[] }`. Signs in text order where the texts give one. Never a date. |
| `GET /api/discussions` | `contentType`, `contentId`, `page` | Public thread list with comment counts |
| `GET /api/discussions/:id/comments` | | The thread and its comments from `comments_public` (hidden and removed comments keep their place with the body blanked) |
| `GET/POST /api/unsubscribe` | `token` | One-click digest unsubscribe (RFC 8058); redirects to `/account/unsubscribed` |

## Personal (signed in)

| Method and path | Body | Notes |
|---|---|---|
| `GET /api/me/bookmarks` | | All bookmarks, or `?type&id` → `{ saved }` |
| `POST /api/me/bookmarks` | `{ type, id }` | Idempotent: a repeat click does not duplicate |
| `DELETE /api/me/bookmarks` | `{ type, id }` | |
| `GET /api/me/progress` | | Reading progress with chapter and story |
| `PATCH /api/me/progress` | `{ chapterId, percent }` | Only moves forward unless `percent` is 0; `completed_at` is set at 100 |
| `GET /api/me/notes` | | All notes, or `?type&id` → the note for a target |
| `POST /api/me/notes` | `{ target: {type, id}, body }` | Create or replace (autosave). Owner-only by RLS; bodies are never logged or audited. |
| `PATCH/DELETE /api/me/notes/:id` | `{ body }` | |
| `POST /api/me/export` | | Downloads everything the account owns as JSON (`export_my_data()`, runs as the user) |
| `POST /api/me/delete` | `{ confirm: "DELETE MY ACCOUNT" }` | Deletes the auth user with the service role; foreign keys cascade |
| `POST /api/discussions` | `{ contentType, contentId, claimId?, title }` | Starts a thread and follows it |
| `POST /api/discussions/:id/comments` | `{ body, parentId?, citation? }` | `citation` must look like `Q 12:3` or `Bukhari 1`. Banned users and closed threads are refused by the database. |
| `PATCH /api/discussions/:id/comments/:commentId` | `{ body }` | Author only, within 30 minutes, while visible. The previous text is kept in `comment_revisions`. |
| `DELETE /api/discussions/:id/comments/:commentId` | | Author only. Replies stay in the thread. |
| `POST /api/reports` | `{ targetType, targetId, reason, details? }` | One report per person per item. Three open reports hide a comment until a moderator reviews it. |
| `POST /api/follows` | `{ discussionId, follow }` | Followed threads feed notifications and the digest |

## Staff

| Method and path | Role | Body |
|---|---|---|
| `GET/POST /api/admin/moderate` | moderator | `{ targetType, targetId, action: hide \| remove \| restore \| dismiss_reports \| lock, reason }`. Applied by `moderate()` in one transaction with its log entry; the log keeps ids, not text. |
| `POST /api/admin/review` | scholarly_reviewer | `{ entityType, entityId, decision: approved \| changes_requested \| rejected, comment? }`. A reviewer cannot approve their own claim. |
| `POST /api/admin/status` | editor | `{ entityType, entityId, status, revisionNote? }`. Publishing is refused unless every linked claim is referenced and approved and a reviewer approved the entity. A correction needs a public revision note. |
| `POST /api/admin/events` | editor | Flow D: event, claim, references, optional place with an approximate polygon (`[[lng, lat], …]`) or `unknown`. Everything is created as a draft. |
| `GET/PATCH /api/admin/corrections` | editor | Correction queue and resolution. `POST` (any signed-in user) submits a correction. |

Other staff writes (sources, roles, stories, chapters, people, relationships) go straight to Supabase from the admin tools; RLS allows them only for the right role, and triggers audit them.

## Auth

`GET /auth/callback?code&returnTo&intent` exchanges a magic-link or OAuth code for a session and returns to `returnTo` (same-site paths only). A pending intent such as `bookmark:quran_verse:12:4` is carried back as `?intent=`; the page asks the reader to confirm before saving anything.
