# Implementation status

What works today, what is blocked and by what. "Working" means wired end to end and covered by tests; nothing marked working is a mock. Last updated with branch `feat/platform-foundation`.

## Fully working (no external service needed)

| Feature | Notes | Tests |
|---|---|---|
| Design tokens (light, dark, journey) generated from `design/tokens/tokens.json` | Tailwind preset maps to CSS variables; CI fails if the CSS is stale | unit |
| Home journey: 29 stops, filters, container-query layouts, sticky rail and progress pill, scroll-sync with hysteresis and hold, evidence panel (dialog, focus trap, Esc, bottom sheet on mobile), reveal and reduced-motion fallbacks, draft badge | Content is the draft journey JSON, validated by Zod at build | unit, e2e, axe |
| Prophet story pages for all 29 stops (`/prophets/[id]`) | Position bar, story outline (Yusuf: 8 movements; summaries pending), related surahs, sources for milestones, schematic place preview, sticky side column | e2e, axe |
| Prophets index, timeline (relative-order track, brass break, CE/AH today), atlas place list by certainty, journey-based search with Arabic and transliteration normalisation | | unit, e2e, axe |
| Global shell: header, search, mobile menu, theme toggle (light/dark/system), language toggle, breadcrumb, footer, skip link, 404, 500, offline page and service worker | | e2e, axe |
| Arabic interface scaffold (`/ar/...`, RTL) | UI strings are a first draft pending a translator's review, and the UI says so | e2e |
| Hadith catalogue (seven collections), information pages (about, methodology, review board, corrections, terms, privacy, accessibility, contact, guidelines) | Legal pages are marked drafts for counsel | axe |
| SEO: metadata, Open Graph card, sitemap, robots, JSON-LD | | build |
| Security headers and CSP | See `docs/engineering/threat-model.md` for the `'unsafe-inline'` follow-up | e2e |

## Built and tested, waiting for credentials (Supabase)

Code, API routes, database schema, RLS and triggers are complete and tested against Postgres + PostGIS (PGlite). The UI shows "not configured" until Supabase is connected.

| Feature | Tested where |
|---|---|
| Passwordless sign-in, `returnTo`, confirmed bookmark intent after sign-in | unit (intent, returnTo); flow needs a live project |
| Bookmarks, reading progress, private notes (autosave, owner-only), export, delete account | database tests (RLS, cascade, export) |
| Discussions: threads, replies, cite-a-verse, edit window, revisions, delete, report, auto-hide, follow, notifications, unsubscribe | database tests |
| Moderation queue and actions, bans, appeals | database tests |
| Editorial: review queue, scholarly approval, publish guard, revision diff, new event with approximate polygon (flow D), stories and chapters, people and relationships, corrections queue, sources and licences, roles, audit trail | database tests (guards, constraints, roles, audit) |
| Stories reader with claims and references, chapter progress | API + database tests |
| Events API, atlas GeoJSON, genealogy graph, Last Hour list, full-text search index | database tests (RPCs, search) |

## Blocked by source rights (deliberately unavailable)

| Feature | Blocker | What the UI shows |
|---|---|---|
| Quran Arabic in the reader, verse cards, compare page, Basmala in the hero | Tanzil import not yet run (needs the owner to accept its terms) | "Arabic not loaded — waiting for the verified Quran source" |
| Quran translations, translation compare | No translation licence cleared | "Translation unavailable — licence pending" |
| Tafsir | No licence cleared | Empty state |
| Hadith text, translations and gradings | No licensed edition imported | "Not published on QITL yet" |
| Journey summaries for Yusuf's story movements | Wording still being drafted (`summary_status` in the JSON) | "Summary being drafted — read the ayat below" |
| Family links on prophet pages and the genealogy explorer | No reviewed relationship claims yet | Empty state with a link to the explorer |

## Blocked by configuration

| Feature | Needs |
|---|---|
| Interactive MapLibre atlas | A tile provider URL and attribution (`NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`) and published geometries |
| Google sign-in | Provider set up in Supabase, `NEXT_PUBLIC_AUTH_GOOGLE=1` |
| Account deletion | `SUPABASE_SERVICE_ROLE_KEY` on the server |

## Known gaps (from the design audit, not yet built)

- `/timeline` reads the journey file only; events published through the editor appear in the events API and search but not yet on the timeline page.
- The surah reader does not yet load licensed translations (the compare page does).
- Discussions attach to a whole page; attaching a thread to one evidence card (`claim_id`) is supported by the schema and API but not by the UI.
- No public revision-history view yet (notes and versions are stored; staff see the diff in the review queue).
- No appeals screen (the table exists; appeals go through the contact page), and My library does not list followed threads yet.
- Skeletons do not switch to an error after a timeout; error toasts have no recovery action; the map legend does not collapse on mobile.
- Timeline items are links, not buttons with atlas-camera sync; the timeline is not virtualised (29 stops today).
- No image upload or approval screen (the `assets` rules and storage policies are in place).
- Motion durations are not tokens; the home headline scales to 80px (prototype) rather than the 64px `display-xl` token; the Open Graph card uses literal colours.

## Upcoming (not built)

- Email digest sender (preferences, tokens and notification queue exist).
- Hadith and other source import adapters (Quran importer exists).
- Analytics (privacy-safe events are specified in `docs/design/screen-specifications.md`; nothing is collected).
- Nonce-based CSP; edge rate limiting; upload malware scanning.
- Visual regression baselines against `design/prototype/home.html` (screenshots of the app are in `docs/design/screenshots/`).
- Arabic interface review by a qualified translator; Urdu.
- Final visual designs for the Quran reader, hadith explorer, atlas, genealogy explorer, Last Hour explorer, account and admin (listed as still to design in `design/README.md`; built here from the design system).
