# Master completion backlog

Ordered by release priority (2026-10-31). Each item names what unblocks it: code (we can do it), an owner decision, a
credential or licence, or human review. Status per feature: `docs/FEATURE_ACCEPTANCE_MATRIX.md`.

## Release gate 1: a trustworthy reading platform

| # | Item | Unblocked by | State |
|---|---|---|---|
| 1 | Quran reader completion: jump-to-ayah, copy/share with Tanzil attribution, reading progress, saved verses, long-surah performance | Code | In progress (`fin/reader`) |
| 2 | Unified search incl. Quran Arabic text and every module, EN/AR/UR, typo/transliteration tolerant, never private/unpublished | Code | In progress (`fin/search`) |
| 3 | Urdu interface strings in every module; mark English islands `lang="en"`; language switch keeps the page | Code; then a qualified translator reviews AR/UR | In progress (`fin/i18n`) |
| 4 | Security: nonce CSP, API rate limiting, role-escalation/RLS sweep, sanitisation tests, monitoring adapter, dream retention schedule | Code | In progress (`fin/security`) |
| 5 | Desktop navigation to every module; accurate home section grid | Code | Done 2026-10-31 (`src/lib/nav.ts`) |
| 6 | Sign off the licence registry (Tanzil first) | Owner, at `/admin/licences` | Waiting |
| 7 | Supabase Auth URL settings (Site URL `https://qitl.vercel.app`, redirect `/auth/callback`) and the first admin grant | Owner, Supabase dashboard | Waiting |
| 8 | Load the Quran text into `quran_verses` (`scripts/import-quran.ts --db`) | `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` | Waiting |
| 9 | Recruit at least one qualified Sunni scholarly reviewer; assign `scholarly_reviewer` | Owner | Waiting (blocks every content item below) |

## Release gate 2: reviewed content

| # | Item | Unblocked by |
|---|---|---|
| 10 | Prophet stories A–G for the 25 prophets (claims → sections → review → publish), kids/young levels, quizzes | Editors + reviewers |
| 11 | Quranic events inventory and pages | Editors + reviewers |
| 12 | Journey summaries still "being drafted" | Reviewers |
| 13 | Genealogy relationships, atlas geometries, Last Hour signs | Editors + reviewers |
| 14 | Creation Atlas profiles (humans, jinn, angels, Iblis first) | Editors + reviewers |
| 15 | Life Guidance lessons for the 10 draft topics, with safety notes | Editors + reviewers (+ a mental-health adviser for safety notes) |
| 16 | Qira'at reader names approval; variants once a second licensed riwayah text exists | Reviewers; King Fahd Complex permission |
| 17 | Life Through the Ages research records | Editors + scholarly and science reviewers |

## Release gate 3: licensed sources and media

| # | Item | Unblocked by |
|---|---|---|
| 18 | English and Urdu Quran translations | QuranEnc editions (conditional: no changes, credit, version) or Quran Foundation credentials |
| 19 | Hadith text and translations | sunnah.com API key + written terms |
| 20 | Recitation audio (Hafs first) | King Fahd Complex: credit wording, hosting vs streaming answer |
| 21 | Other riwayat texts (Warsh, Qalun, Shu'bah, …) | King Fahd Complex written permission |
| 22 | Word-by-word / morphology | Decide on Quranic Arabic Corpus (GPL) vs Quran Foundation word data |
| 23 | Tafsir (incl. Tafsir Muqatil ibn Sulayman as the 11th historical reference) | Per-edition licences; Muqatil edition and rights unknown |
| 24 | Media library: upload, validation, variants, approval | Code (in progress `fin/media`); optional `MALWARE_SCAN_URL` |
| 25 | Narration | A TTS provider with a commercial-use agreement; `LARA_ACCESS_KEY_ID/SECRET` for translation; `ANTHROPIC_API_KEY` for drafting |
| 26 | Real map tiles | `NEXT_PUBLIC_MAP_TILES_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` |

## Later

| # | Item | Unblocked by |
|---|---|---|
| 27 | Mufti Q&A notifications and scholar application form; verified muftis | Code (done on `mod/mufti-flags`: in-app notifications, bell + panel, `/mufti/apply`, admin review list); owner verifies muftis; email delivery waits for item 29 |
| 28 | Admin-editable landing content, navigation and feature flags | Code (done on `mod/mufti-flags`: `/admin/site`, versioned and audited; menus wired; the home page must read the text blocks with `homeText()` once `mod/perf-visual` is merged) |
| 29 | Email digest sender | Email provider |
| 30 | Visual regression baselines; real-device testing | Code; devices |
| 31 | Home page performance (TBT) | Code |
| 32 | Learn Quranic Arabic lessons | Word-by-word data + reviewers |
