> **Historical document.** Written for ZIQ, the project's earlier name; the product is now **QITL — Quran in Timeline**. It is kept unchanged as a record. Where it differs from the current implementation, the current documents win: `docs/IMPLEMENTATION_STATUS.md`, `docs/FEATURE_ACCEPTANCE_MATRIX.md`, `docs/LICENSING.md`. In particular, religious evidence now draws only on the Quran, Sahih al-Bukhari, Sahih Muslim, and narrations of Jami' at-Tirmidhi and Sunan Ibn Majah individually graded authentic (the public hadith catalogue lists these four collections).

# PROMPT 2 — ZIQ END-TO-END FULL STACK PLATFORM BUILD (IMPLEMENT ALL FEATURES)
Target repository: https://github.com/zivarallc-code/ZIQ
Role: Act as principal full-stack architect, senior Next.js engineer, Postgres/Supabase architect, search/graph/geospatial engineer, accessibility/security engineer and technical lead.
Dependencies: Follow MASTER_BUILD_PROMPT.md and PROMPT_1_DESIGN_UX.md. First inspect repository, preserve its existing work and execute in small testable commits. Goal is functional, secure, maintainable code with actual wiring, not visuals and mocked interactions.

PRODUCT CONTRACT
ZIQ is free and browsable without registration: Quran, seven Sunni hadith catalogs, stories, prophets, genealogy, cross-referenced timeline, historical atlas, authentic Last Hour references, comparison and search. Optional accounts only for bookmarks, private notes, tracking story progress and reading milestones, discussion/comments, subscriptions/follows and notifications. Admin/editors/moderators/reviewers require permissions. Never fabricate Quran/Hadith, chronology, GPS coordinates, descendant records, source authenticity or a date for the Last Hour. Every claim and relationship gets provenance; translation rights and source licenses must be verified.

STACK
Use Next.js App Router, React, TypeScript strict, Tailwind, accessible UI primitives, PostgreSQL via Supabase (recommended) and PostGIS, Supabase Auth and Supabase Storage (for licensed/admin-controlled media), RLS, MapLibre for geospatial map, Cytoscape/React Flow for genealogy, custom virtualized scalable timeline, TanStack Query or equivalent for client interactions and Postgres FTS for initial search. Edge/deployed functions for long jobs; queue and cron for source ingestion and stale references. Build with secure SSR public routes, SEO structured data/sitemaps, CSP, caching, observability, and tests. Use SQL migrations and generated database types. Avoid exposing Supabase service_role keys to browser.

DATABASE SCHEMA WITH REAL RELATIONSHIPS
1. sources(id, type, work, edition, publisher, source_url, rights_status, license_text/url, checksum, language, verification status, verified_at), source_versions; source_import_jobs.
2. quran_surahs(id, Arabic/romanized/transliterated names, ayah_count), quran_verses(surah_id, ayah_no, immutable source_verification, Arabic), quran_translations(verse PK pair, translator, edition, text, legal_status), tafsir_entries + references.
3. hadith_collections, hadith_books, hadith_chapters, hadith_entries(collection_id, numbering_system, canonical_number, source_version, Arabic, URL), hadith_translations and hadith_gradings(hadith_id, grading_scholar, grade, source/citation, variance). Implement grade aggregation that does not erase scholarly differences.
4. people, aliases, roles, relationships(person1, person2, kind, claim_id, provenance, confidence), traditions/differences. Parent-child relations must never derive automatically from text without review.
5. historical_events(title, slug, category, date_precision exact/range/estimated/relative/unknown, BCE/CE/AH dates/ranges with safe schema, narrative status, reviewed status, claims), event_people, event_stories, event_places, event_relationships; locations(name, modern reference, type), place_geometries(geometry PostGIS, precision point/region/route/unknown, confidence, source_id, version), approximate_polygon_constraints. Unknown locations have NULL geometry, not fabricated pins. Foreign keys and transactions guarantee cross-view consistency.
6. stories, chapters, chapter_claims, event/story links, topics, taggings, glossaries, asset_links, content_versions, revision_notes.
7. evidence_claims, claim_references (exact Quran ayah or Hadith source/grading, tafsir/history refs), editorial_reviews, approved_by, provenance, publication_status, history, conflict resolution, audit_logs. Publish guards: no approved evidence, no publish.
8. auth user profile separate from auth.users, roles and role_assignments, bookmarks (target type/id unique per user), progress(chapter, percent, completed_at), private_notes, saved_collections, user_followed_threads, notifications, notification_prefs.
9. discussions(thread tied to content type/id/optional claim_id), comments(parent_id threaded, status, citations, edited_at), reactions, flags/reports, moderation_queue, blocks, bans, appeals, rate_limit_audit, comment_revision_history. Implement anti-spam throttling and PII-safe moderation logs.
10. feature_flags, site_settings, theme/content controls, translations, legal version acceptance, data-export/deletion jobs. Build precise indices, unique constraints and integrity checks.
Include design ER diagram, seed data scripts, reversible migrations when feasible, database tests and per-table RLS policies.

BACKEND/API CONTRACT — WIRE EVERY FEATURE
Read public data through cached server components or public read-only APIs limited to approved/published records. Provide typed routes/server actions:
GET /api/search?q=... with facets, pagination and Arabic normalizations
GET /api/stories/:slug with chapters/claim references
GET /api/events?era&source&confidence&bounds
GET /api/atlas/places?bbox&zoom&era... returning geospatial GeoJSON, plus details/sources
GET /api/people/:id/graph?depth=... with evidence-rich edges
GET /api/quran/:surah/:ayah and compare translations (authorized rights)
GET /api/hadith/:collection/:number with chain/gradings
GET /api/last-hour with authentic classification and unknown future dates
POST/DELETE /api/me/bookmarks, PATCH /api/me/progress, CRUD /api/me/notes; all auth protected
GET/POST /api/discussions; GET/POST/PATCH/DELETE /api/discussions/:id/comments (author/edit window/moderator rules), POST /api/reports, POST /api/follows
Admin-only CRUD for stories, claims, refs, geometry, genealogical edges, legal licenses, editorial approvals and moderation; audit every mutation. Server-side payload validation with Zod, authorization checks plus RLS, idempotency where needed and rate limits.
If using Supabase directly for CRUD, still implement server authorization and RLS with tests. Enforce that anonymous visitors cannot write comments/bookmarks and cannot read private notes. Never create publicly writable source tables.

REQUIRED FRONTEND WIRING
Home feature cards -> real routes; browse -> published story index; chapter -> claim + evidence drawer; evidence drawer -> accurate Quran/Hadith record; event -> timeline selection + atlas camera, map popup -> event/person/story; genealogy edge -> underlying reviewed claim; search result -> canonical detail page; source compare -> actual licensed translation entries; Last Hour card -> evidence and classification.
Bookmark click logged out -> sign-in -> returnTo original page -> automatically save after successful auth only after user action is preserved and confirmed. Logged in bookmark toggle persists, handles duplicate clicks and refresh. Reading progress persists per chapter, visible in my-library, resume chapter deep-links. Notes private (RLS), autosave with feedback and no silent loss. Discussion comments threaded and tied to reviewed content; citations helper; edit/delete permissions; report button -> moderator queue, hidden/removed state; respectful public reading without auth. Follow thread -> notification preference and digest with unsubscribe.
Admin create/edit -> draft -> reviewer -> publish -> public page and graph/map/timeline all update using same source-backed entity. Corrections -> history diff and links. Content/CMS image selection via Supabase Storage with copyright, credits, alt text and approval metadata. Owner can edit visual home/section text but cannot bypass evidence verification for religious claims. Use feature flags; avoid exposing unbuilt sections as live.

SUPABASE SETUP REQUIREMENTS
Create /supabase/migrations/*.sql, RLS policies, seed-safe demo dataset, SQL RPC functions where necessary, Storage policies, indexes, PostGIS extension and typed client/server helpers. Env example:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key)
SUPABASE_SERVICE_ROLE_KEY (SERVER ONLY; never NEXT_PUBLIC)
DATABASE_URL (SERVER ONLY)
NEXT_PUBLIC_SITE_URL
MAP_TILES_URL
MAP_TILES_API_KEY (only when provider requires; separate safe public token)
EMAIL_FROM / mail provider credentials (server-only if enabled)
Do not embed real secrets in git. Provide documented Supabase dashboard setup, OAuth redirect config, auth callbacks, email templates, DB provisioning, backups and restore checks; only require project connection when ready to deploy. If no credentials yet, run against local Supabase/Postgres, record external blocker rather than fake integration.

SECURITY / PRIVACY / COMMUNITY
Content Security Policy, validation, sanitized rich-text markdown, CSRF/session protection, secure cookies, origin checks, file upload scanning/size/type controls, proper account export/deletion workflow, RLS tests, rate limiting, logging without private note content, delete cascading, role separation [visitor, user, moderator, editor, scholarly_reviewer, admin]. Abuse handling, reporting, respectful disagreement policy, no AI-generated fatwas posted as verified knowledge. Verification of a scholar's identity is a manual admin process.

SOURCE INGESTION / AUTHENTICITY RULES
No wholesale scraping. Respect publishers' licenses/robots/API terms. Create source adapters for legally available editions, version pinning and checksums. Curated reviewed data only; no synthetic surah/hadith/lineage content. Store Arabic original and translation as distinct entities. Seven Hadith collections are a catalog, NOT seven universally authentic full collections. Keep chain of grading authority, potential dispute, hadith numbering variants. Quran and Arabic canonical copy must be validated against a trusted verified source. Source lines should resolve to persistent citation anchors. Add corrections workflow.
Historical chronology: represent unknown dates properly, use date ranges/relative sequence for early prophets; do not guess Adam's age/year. Prophetic biography dates only where supported. Last Hour is future-event relation graph with text-grounded ordering, never an apocalyptic countdown. If a future sign mentions a region but not exact spot, map broad region with note or "unknown"; never precise geolocation.

IMPLEMENTATION ORDER
0. Audit repo, create issue checklist and preserve existing commits.
1. Scaffold Next.js, design-system tokens, complete routes and responsive shell based on PROMPT_1_DESIGN_UX.md; tests/CI, docs.
2. Supabase/local DB migrations, RLS, source registry, content editor/review/publish engine; sample VERIFIED content with publication gates, API tests.
3. Quran/translation (licensed), Hadith/grades and search + evidence drawer wired.
4. Story/prophet pages with timeline, map/GeoJSON layers, uncertain geometry, source-backed genealogy; synchronized navigation.
5. Auth, bookmark/progress/notes and contextual discussions, reporting/moderation, notifications with unsubscribe.
6. Admin content/visual assets/licensing management, source ingestion, error corrections and audit log.
7. Arabic RTL, accessibility, SEO, mobile, observability, security test/audit, E2E and deployment.
Do not stop at phase 1; implement each phase completely and accurately, but if source licensing or service credentials block actual deployment, document the blocker and leave those features visibly unavailable rather than forge data.

TEST MATRIX
Unit: chronology bounds, year-zero handling, Hijri approximation, source references, grade disagreements, translation licensing, graph identity, map geometry, absence of fabricated coordinates.
Integration: RLS for each table, guest vs user vs admin privileges; content review gating; cross-view updates; CRUD/comment moderation; auth return flow; storage policies; rate limiting and API validation.
E2E (Playwright): anonymous enters story, navigates timeline to map to verse/hadith and back; guest bookmark prompts login, after auth persists; signed-in progress/notes retained; user posts/discusses and reports, moderator acts; editor adds cited unknown-date event with approximate polygon and reviewer approves; Arabic RTL interactions and mobile visual regression. Run lint, tsc, tests and build in CI.
Perf: lazy-load map/graph, virtualize timeline, optimize imagery, accessible text-only fallback, CDN caching, SEO metadata/sitemap/OG cards and no leaking private user data.

DELIVERABLES
Working code and well-organized folders; README with exact dev/start/deploy steps; .env.example (no credentials); migrations and seeds; typed interfaces, API docs, ER diagram, threat model, content/editorial policy and license register; screenshots and test results, CI workflow. Deploy only when secrets and content rights are configured. Show a final implementation matrix: fully working, blocked by source rights, blocked by credentials, upcoming; never call placeholders 'complete'. Open review PR if collaborative workflow available; do not destroy earlier code or data.
