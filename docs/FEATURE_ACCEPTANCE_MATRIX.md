# Feature acceptance matrix

Audit of the code at `bb01e69` (2026-10-31), updated as work lands. A feature is judged on code plus tests, never on the
existence of a table or route. Statuses:

- **Complete and verified**: working end to end, covered by passing tests.
- **Implemented but defective**: built, with a known fault.
- **Partially implemented**: some of the required behaviour is missing.
- **Not implemented**
- **Blocked by external dependency**: the code is ready but needs a licence, a credential or a service.
- **Requires scholarly review**: the feature works; it shows nothing religious until reviewers approve content.

"Tests" names the suites that cover it: `db` = PGlite database tests (`tests/db`), `unit` = Vitest, `e2e` = Playwright
(desktop 1440 px and mobile 390 px projects, axe where noted), `sweep` = the responsive sweep (`tests/e2e/responsive.spec.ts`:
every route × EN/AR/UR × 320–1440 px).

## Core reading

| Feature | Existing implementation | Missing | Dependencies | Priority | Tests | Status |
|---|---|---|---|---|---|---|
| Home journey (29 stops, Adam → Muhammad ﷺ) | `src/app/[locale]/page.tsx`, `components/journey`, `content/journey` | Some stop summaries still "being drafted" | Scholarly review of `content/journey/journey.draft.json` | High | e2e journey + axe, sweep | Requires scholarly review |
| Vertical timeline | `timeline/page.tsx`, `VerticalTimeline`, `TimelineEnhancer`, lifestyle layers | Reviewed events from the database (none published) | Reviewed events | High | e2e mobile, sweep | Complete and verified (structure); events Require scholarly review |
| Complete Timeline & Event Universe (research atlas of every identified Quranic narrative event, person and community; six tracks, order never invented) | `/timeline?view=complete`, `/events/[slug]`, `src/lib/events`, `src/components/timeline`, `/admin/events/universe`, `/admin/events/coverage`, migrations `…002450`/`…002451`, `docs/EVENT_COVERAGE.md` | All 159 inventory items are drafts, so the public sees the designed empty state with counts; claims, ordering claims, identification claims and dated estimates await editors and reviewers; 25 ranges still to research | Scholarly review (and science review for any dated estimate) | High | db events + security, unit events (references checked against the Quran text), e2e event-universe + axe EN/AR/UR 360/1440, sweep | Requires scholarly review |
| Quran text (114 surahs, 6,236 ayat) | Tanzil Uthmani 1.1 (Hafs) in `content/quran`, checksum-pinned, attribution on every page | Database copy in `quran_verses` | `SUPABASE_SERVICE_ROLE_KEY` to run `scripts/import-quran.ts --db` | Critical | unit importer, e2e reader, byte-for-byte comparison against the download | Complete and verified (site); database copy Blocked by external dependency |
| Quran reader UX (navigation, copy, progress, saved verses, long-surah performance) | Size control, ayah anchors, 3-second highlight, Study panel, riwayah indicator | Jump-to-ayah, copy with attribution, progress, saved verses list | — | Critical | e2e ayah-highlight, interpretation | Partially implemented (work in progress: `fin/reader`) |
| Recitation audio | Riwayah-matched player slot; permission-gated `audio_recordings` | Licensed recordings | King Fahd Complex audio: attribution wording + hosting answer (`docs/LICENSING.md`) | High | db qiraat | Blocked by external dependency |
| Translations comparison (10 editions + Muqatil as 11th historical tafsir) | Study panel, edition registry, QuranEnc / Quran Foundation adapters (not run) | Any licensed edition imported | QuranEnc (conditional, per edition), Quran Foundation credentials; Muqatil edition and rights unknown | Critical | unit interpretation, e2e study sheet | Blocked by external dependency |
| Word by word, morphology | Schema + Study tab | Data | Quranic Arabic Corpus (GPL: owner decision) or Quran Foundation word data | High | db production | Blocked by external dependency |
| Tafsir | Schema with flags (Isra'iliyyat, weak, disputed), Study tab | Licensed tafsir | Per-edition licences | High | db, unit | Blocked by external dependency |
| QITL explanatory summaries | Eight signed checks, AI draft route (off without key) | Reviewed summaries | Scholars; `ANTHROPIC_API_KEY` for drafting | High | db production | Requires scholarly review |
| Hadith catalogue (4 collections) | Catalogue pages, references "licence pending", grading model | Hadith text and translations | sunnah.com key and written terms | Critical | db rls, e2e axe | Blocked by external dependency |
| Qira'at and Ahruf centre | `/qiraat`, `/qiraat/compare`, 10 readers / 20 transmitters (draft), variant and audio guards | Approved names, variants, other riwayat texts | Scholarly approval; King Fahd Complex written permission for other riwayat | High | db qiraat (20), e2e + axe | Requires scholarly review / Blocked by external dependency |

## Stories and knowledge

| Feature | Existing implementation | Missing | Dependencies | Priority | Tests | Status |
|---|---|---|---|---|---|---|
| Prophet pages (25) | Hero, chapter nav, outline, Quran passages, places, discussion, "Their Life & Times" | Story sections A–G content | Reviewed claims and sections | High | e2e pages + axe, sweep | Requires scholarly review |
| Story structure (A–G, kids/young/full, quizzes, reflections) | `story_sections`, `StoryView`, `QuizBlock`, admin story editor | Content | Reviewers | High | db story, unit story | Requires scholarly review |
| Quranic events encyclopedia | `/events`, `/events/[slug]` | Published events | Reviewers | High | e2e | Requires scholarly review |
| Story Production Studio | `/admin/studio` (+ translations, audio), Lara route, narration provider interface, AI draft (off without key) | Live Lara and TTS runs; a TTS provider | `LARA_ACCESS_KEY_ID/SECRET`, a licensed TTS provider, `ANTHROPIC_API_KEY` | High | unit player-api (not-configured paths) | Blocked by external dependency |
| Story Player (read / listen / immersive / kids) | `components/player`, preferences, progress, captions, ducking | Published scripts and approved audio | Studio output, TTS | High | unit player (33), e2e fixture page | Complete and verified (with fixtures); live content Requires scholarly review |
| Creation Atlas | `/creation`, `/creation/[slug]`, comparison, graph, misconceptions, admin | Content | Reviewers | High | db creation, unit, e2e + axe | Requires scholarly review |
| Life Guidance | `/guidance`, `/guidance/[slug]`, three layers, safety notes, 10 draft topics | Lessons; private "save lesson" | Reviewers | High | db guidance (14), unit, e2e | Requires scholarly review |
| Dream Understanding | `/dreams`, private requests, consent, scholar workflow, second opinions, export/delete, redacted audit | Scheduled retention purge | pg_cron schedule (work in progress: `fin/security`) | Medium | db (19), unit, e2e | Implemented but defective (purge not scheduled) → in progress |
| Life Through the Ages | Hub, food, day, compare, longevity, A/B/C/D evidence model, two review pathways, 25 profile shells | Research content | Scholarly + science reviewers | Medium | db lifestyle (23), unit, e2e | Requires scholarly review |
| Atlas | Schematic map with pan/zoom, place sheet, uncertainty labels; MapLibre when tiles configured | Real map tiles; published geometries | `NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`; reviewers | High | e2e explorers, sweep | Blocked by external dependency |
| Genealogy | Pan/zoom, focus person, branches, established/disputed lines, list view | Reviewed relationships | Reviewers | High | e2e explorers (fixture graph) | Requires scholarly review |
| Last Hour explorer | `/last-hour`, no dates | Reviewed signs | Reviewers | Medium | e2e | Requires scholarly review |
| Learn Quranic Arabic | `/learn` describes the lesson system | Lessons, word data | Word-by-word licence; reviewers | Medium | sweep | Blocked by external dependency |

## People and services

| Feature | Existing implementation | Missing | Dependencies | Priority | Tests | Status |
|---|---|---|---|---|---|---|
| Accounts (passwordless, returnTo) | Supabase auth flows | Production check of sign-in | Supabase Auth URL settings (owner) | High | unit | Partially implemented (unverified on production) |
| Dashboard (bookmarks, notes, progress, language prefs, my questions, dream history, export, delete) | `/account` and panels | Saved verses list, story/vocabulary progress views | — | High | db rls | Partially implemented (saved verses in `fin/reader`) |
| Community discussions + moderation | Threads, reports, moderation, bans, appeals | — | — | Medium | db rls | Complete and verified (database); live use needs accounts |
| Mufti Q&A | Ask, assign, answer with citations, independent review, verified badge, private questions | Notifications to askers; scholar application form | Verified muftis (owner) | High | db production, unit, e2e | Partially implemented |
| Search | Prophets, surah names, aliases, Arabic without vowel marks | Quran text, new modules, typo tolerance, Urdu | — | High | e2e search | Partially implemented (work in progress: `fin/search`) |

## Platform

| Feature | Existing implementation | Missing | Dependencies | Priority | Tests | Status |
|---|---|---|---|---|---|---|
| Three languages (EN / AR / UR) | Routing (`/ar`, `/ur`), RTL, Nastaliq, three preferences | Urdu strings in modules (fall back to English); English islands not marked `lang="en"` | Qualified translators for AR/UR review | Critical | unit i18n, e2e urdu, sweep | Partially implemented (work in progress: `fin/i18n`) |
| Navigation to every module | Bottom bar + Explore sheet (phones) | Desktop header did not list the newer modules; home grid said "Coming soon" | — | High | sweep | Implemented but defective → fixed on 2026-10-31 (shared `src/lib/nav.ts`) |
| Unified design system | Tokens, glass components, mobile layer, logo | Admin pages less polished | — | Medium | sweep, axe | Partially implemented |
| Media library | `assets` table + rules | Upload, validation, variants, approval screen | Optional `MALWARE_SCAN_URL` | High | — | Not implemented (work in progress: `fin/media`) |
| Admin CMS | Review queue, editors for every module, licences, users, audit, moderation | Landing content, navigation and feature flags editable from admin; media | — | High | db, e2e admin layout | Partially implemented |
| Licence registry | `/admin/licences`, `content_permissions`, `docs/LICENSING.md` | Owner sign-off on 29 rows | Owner | Critical | db qiraat | Complete and verified (sign-off pending) |
| Story chapters, depth modes, source-change invalidation, coverage dashboard and automated story checks (audit gaps 3, 4, 5, 7) | `chapters`/`stories` extended (anchor, event link, five mode texts, unknowns, version, author), `/stories/[slug]` reader (`?mode=`, chapter list and sheet, progress, sources panel, Sources and uncertainties), mode switch on prophet/event pages, `/admin/stories` (chapter manager, Needs re-review queue), `/admin/stories/coverage`, `pnpm check:stories`, migrations `…002550`-`…002552`, `docs/STORY_COVERAGE.md` | All content (no chapter is published; every mode renders "not established" until reviewers approve text); AR/UR interface strings are drafts; public pages show no "under re-review" notice (the flag is staff data) | Scholarly review of chapter texts | High | db story-chapters (+ security, rls, story), unit story-checks + story-chapters, e2e story-chapters + axe EN/AR/UR 390/1440, sweep | Built; empty by design |
| Shifa (healing and wellbeing: Quranic healing, authentic ruqyah, prophetic remedies, wellbeing) | Four-layer evidence model (A Quran, B authentic hadith, C research, D traditional/hypothesis), dual religious and clinical review bound to the version, no dosage or instruction text, safety notes required, 14 draft topic titles, public pages, admin, links from Life Guidance and prophet pages | All content (none published), recitation (no approved recordings), qualified Arabic/Urdu review of safety wording | Scholarly and science reviewers; clinician for AR/UR | High | db shifa, unit, e2e | Built; empty by design |
| Security | RLS forced everywhere, publish guards, CSP (with unsafe-inline), DB throttle | Nonce CSP, API rate limiting, role-escalation sweep, monitoring | — | Critical | db rls/production | Partially implemented (work in progress: `fin/security`) |
| Responsive + accessibility | Mobile shell, sweep at 6 widths × 3 languages, axe on main pages | Real-device testing, visual regression baselines | Devices | High | sweep, axe | Complete and verified (emulated) |
| Performance | Lighthouse recorded in `docs/RESPONSIVE.md` | Home page TBT | — | Medium | — | Partially implemented |
| Email digest | Preferences, tokens, queue | Sender | Email provider | Low | db | Not implemented |
| Analytics / monitoring | — | Privacy-safe analytics, error tracking | Optional `SENTRY_DSN` | Medium | — | Not implemented (work in progress: `fin/security`) |
