# Implementation status

What works today, what is blocked and by what. "Working" means wired end to end and covered by tests; nothing marked working is a mock. Supabase and Vercel are connected (qitl.vercel.app); everything below that needed credentials is now live, waiting for reviewed content.

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

## Storytelling system (new)

- **One structure for every prophet and Quranic event**, sections A–G: introduction facts, before the mission, the calling,
  challenges as Situation → Challenge → Action → Response → Outcome → Lesson, outcome, takeaways (lesson, meaning, everyday
  example labelled as an application) and the full source list, plus a one-minute summary, reflection questions and scholarly notes.
- **Three reading levels** (Kids, Young learners, Full story). Kids and young texts adapt a full section and must rest on the same
  claim; the database refuses anything else and publishes them only after their full section.
- **Evidence rule:** story claims may cite the Quran and narrations from Sahih al-Bukhari, Sahih Muslim, Jami' at-Tirmidhi and Sunan
  Ibn Majah only, and every hadith citation must name an authentic (sahih or hasan) grading by a named scholar. Enforced by the database.
  The public hadith catalogue is the same four collections (2026-10-31; was seven).
- **Quranic events encyclopedia** at /events and /events/[slug], connected to the timeline, people and places. The brief's event list can
  be imported as drafts (titles only) from the Story editor.
- **Quizzes** built only on reviewed claims, with right/wrong feedback and the source, no points; questions lock once published.
- **Symbolic animations** (rain and flood, the sea path, seven harvests, daylight over a cave, foundations rising, palace architecture, the
  beginning of the timeline): SVG, no figures, captions, text alternatives, pause and replay, no autoplay with reduced motion. Each appears only
  after an editor registers it for a story and a scholarly reviewer approves it.
- **Branding:** the QITL logo (light and dark), compact emblem, favicon, Apple icon, web manifest, Open Graph card and loading screen.

No story content, quizzes or media exist yet: they are written in Editorial → Story editor and appear after review.
Still to come for this brief: word-by-word vocabulary (needs a licensed source), cover/infographic image uploads, the kids' "Remember the
story" graphic, story-to-map camera sync, and the Arabic interface for the new pages.

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

## Mobile-first pass (2026-10-31)

See `docs/RESPONSIVE.md` for the design tokens, the issue register, before/after screenshots and the honest list of what
is not done (atlas and genealogy gestures, admin tables as cards, real-device testing, Lighthouse numbers).

## Schema only: interpretation, narration, Creation Atlas, Mufti Q&A (2026-10-31)

Migrations 1150–1600 are applied to Supabase and covered by `tests/db/production.test.ts`. The interpretation tables are used by the Study panel (below); the others have no pages yet.

| Area | Tables | Rules enforced in the database |
|---|---|---|
| Interpretation engine (1200) | `translation_editions`, `translator_profiles`, `source_licences` (view over `sources`), `quran_word_morphology`, `quran_word_senses`, `quran_word_occurrences` (view), `hadith_commentary_links`, `translation_comparisons`, `interpretation_explanations`, `interpretation_differences`, `interpretation_reviews`, `content_dependency_versions`; `tafsir_entries` gains `edition_id`, `flags` (weak narration, Isra'iliyyat, disputed, unattributed) | An edition shows only when verified and its source licence is cleared; early tafsir must carry a reliability note; corpus rows hidden until licensed; an explanation publishes only after all eight checks (Arabic source, references, licensing, attribution, grammar, hadith grading, Sunni scholarly, language quality) pass on its current version, each signed by the right role, plus a scholarly approval; editing makes a new version and flags dependants |
| Story production and narration (1300) | `story_scripts`, `story_scenes`, `scene_claim_references`, `translation_glossary`, `translation_jobs`, `story_translations`, `translation_reviews`, `narration_voices`, `narration_jobs`, `narration_audio`, `scene_ambient_audio`, `scene_visual_assets`, `scene_animation_manifest`, `story_playback_preferences`, `story_playback_progress`, `story_publication_versions` | Every scene but "explore" needs approved claims; a script needs a scholarly approval; a translation publishes only from the current published source version with linguistic and religious reviews; voices need a recorded licence; audio is approved only for the current scene version with a pronunciation check; editing a scene makes its audio stale; idempotency keys on jobs; ambience gain capped at 0.4 |
| Creation Atlas (1400) | `creation_categories` (six, seeded), `creation_profiles`, `creation_characteristics` (template fields), `creation_abilities`, `creation_limitations`, `creation_interactions`, `creation_lessons`, `creation_misconceptions`, `creation_source_references`, `creation_relationships`, `creation_stories`, `creation_visual_assets` | Each entry is classed revelation / authentic hadith / scholarly interpretation / not established; a known statement needs a claim; edges need a claim; visuals can never depict the unseen; scholarly approval to publish |
| Mufti Q&A (1500) | `mufti_profiles`, `mufti_questions`, `mufti_assignments`, `mufti_answers`, `mufti_answer_citations`, `mufti_answer_reviews`, `mufti_question_follows` | Only an admin verifies a mufti; only verified, assigned muftis answer; an answer publishes with a citation and an independent review (never self-review); editing returns it to review; private questions visible to asker, assigned muftis and staff; no "accepted answer" |
| Roles (1150) | `translation_reviewer`, `audio_producer`, `mufti` | |

### Interpretation Explorer and source adapters (branch mod/interpretation, 2026-10-31)

- **Study panel** in the Quran reader (`src/components/quran/StudyPanel.tsx`): a "Study" button per ayah (or, while the
  Arabic is not imported, an ayah picker) opens a bottom sheet below 1024px and a docked column beside the text above it.
  Arabic first, never overlaid. Tabs: Translations (up to 10 editions + the separate early-tafsir slot for Tafsir Muqatil
  ibn Sulayman, labelled commentary, with reliability note and flags), Word by word, Differences explained (four kinds,
  never merged), Tafsir comparison, Hadith (four collections, sahih only by a named grading), Stories & timeline, QITL
  summary (published only; human or AI-assisted with model). Every unlicensed or unimported item shows its designed
  state. Data: `GET /api/quran/[surah]/[ayah]/study` (anonymous, RLS-limited). "Ask a Mufti" shows "coming soon" until
  the Mufti Q&A pages land (`askMuftiHref` in `src/lib/interpretation/state.ts` is ready).
- **Admin:** `/admin/editions` (translator profiles, edition registry, verify) and `/admin/explanations` (editor, the
  eight signed checks per role, differences editor, scholarly approval, AI-draft request).
- **Adapters (code + fixture tests only, never run):** `scripts/import-quran.ts` (King Fahd Complex Hafs JSON or Tanzil
  text/XML; `--accept-terms`; source + pinned version + checksums + retrieved date; stored verses immutable),
  `scripts/import-translation.ts` (QuranEnc, Quran Foundation) and `scripts/import-hadith.ts` (sunnah.com, drafts only),
  both gated on a verified edition with a cleared licence. Keys: `QURANENC_API_KEY`, `QF_CLIENT_ID`/`QF_CLIENT_SECRET`,
  `SUNNAH_API_KEY`. Header names for QuranEnc's key must be confirmed when the access agreement is signed.
- **AI-assisted drafts:** `POST /api/admin/interpretation/draft` (editors; off unless `ANTHROPIC_API_KEY`), inputs only
  stored licensed sources, saved as a draft with model, prompt version and inputs; output presenting an averaged or
  "most accurate" translation is refused.

### External integrations (configured for development only)

- **Lara Translate MCP** (`lara-translate`, https://mcp-v2.laratranslate.com/v1) is registered for Claude Code; it needs the
  OAuth sign-in from an interactive `claude` terminal (`/mcp`). Production translation must use the server-side SDK
  `@translated/lara` with `LARA_ACCESS_KEY_ID` / `LARA_ACCESS_KEY_SECRET` (not set; no worker built yet).
- `bibooks` and `ai-translators` MCP servers were added locally at the owner's request; they are not used by the app.

### Blockers that need the owner

| Blocker | Needed for |
|---|---|
| Choose the Quran text source (King Fahd Complex developer resources, or Tanzil) and accept its terms; Tanzil allows verbatim copies with attribution and no changes | Every Arabic verse, word-by-word, interpretation |
| Licences for each Quran translation (English, Urdu), tafsir (incl. Tafsir Muqatil ibn Sulayman: edition and rights unknown), Quranic Arabic Corpus (GPL: confirm its terms suit the site), sunnah.com API key and terms | Comparison UI, word-by-word, hadith, commentary |
| A TTS provider with a documented commercial-use agreement, and licensed ambience recordings | Narration and Listen / Immersive modes |
| Lara API credentials for production | Translation workflow |
| Qualified scholarly reviewers, translation reviewers and verified muftis | Every publish step; no religious content can go live without them |
| Supabase Auth URL settings (Site URL and `/auth/callback` redirect) and the first admin grant | Sign-in on qitl.vercel.app |

### Superseded: "Not built yet"

This list was true on 2026-10-31 morning. Since then the Story Production Studio and Story Player, Creation Atlas pages,
Mufti Q&A and Dream Understanding pages, Life Guidance, Life Through the Ages, the Quran study panel, search, the media
library, the Quran reader, three-language support and security hardening have all been built and merged. The authoritative,
per-feature status is `docs/FEATURE_ACCEPTANCE_MATRIX.md`; what is still open is in `docs/MASTER_COMPLETION_BACKLOG.md`;
how to deploy and what needs the owner is in `docs/PRODUCTION_READINESS.md`.

## Qira'at & Ahruf Learning Centre and the content licence registry (branch mod/qiraat, 2026-10-31)

- **Licence registry** (migration 2110): `content_permissions` per source × asset type × scope with status APPROVED |
  CONDITIONAL | PERMISSION_REQUIRED | BLOCKED and the rights fields; view `content_licence_registry`; `/admin/licences`.
  Only an admin sets APPROVED or verifies (the database stamps the acting admin); APPROVED needs a licence or
  written-permission reference and evidence. Seeded from pages read on 2026-10-31, none APPROVED, none verified. Report and
  missing-licence list: `docs/LICENSING.md`.
- **Schema** (migrations 2100, 2120): `qiraat` (10 readers) and `riwayat` (20 transmitters), names only, seeded as drafts;
  `quran_text_editions` (Tanzil Hafs v1.1 is the only row), `quran_edition_verses` (import-only, licence-gated, immutable),
  `transmission_routes` (citation required, none seeded), `qiraat_variants` + readings + explanation claims, `qiraat_misconceptions`,
  `reciters`, `audio_recordings`. A reading must be found in its licensed edition's ayah; a variant publishes only with two
  riwayat, approved claims, a scholarly approval and allowing licences; a recording needs its source's recording permission
  for its riwayah, and a text/audio riwayah mismatch is refused unless it is an explained comparison; a licence downgrade hides
  variants and recordings at once (RLS).
- **Pages:** `/qiraat` (ahruf narrations as references, draft distinction panel, readers table from the database, what is
  available, misconceptions from reviewed claims), `/qiraat/compare` (approved variants only, otherwise a designed empty
  state), the riwayah indicator and selector in `/quran/[surah]` (audio only for approved recordings of the same riwayah:
  none exist), `/admin/qiraat`, review-queue entries.
- **Blocked:** every other riwayah's text and all audio (licences, see `docs/LICENSING.md`); hadith text for Bukhari 4991,
  4992 and Muslim 818; routes, variants and explanations need scholars. Audio from another host will also need the CSP's
  `media-src` (falls back to `default-src 'self'`) widened when a recording is approved.
