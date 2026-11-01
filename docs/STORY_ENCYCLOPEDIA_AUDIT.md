# Story Encyclopedia: audit and plan (2026-11-01)

Brief: complete Quranic stories (prophets, people, communities, events) and authentic Hadith stories, one evidence graph, depth modes,
coverage dashboard. Rule from the brief and from QITL: complete coverage means every *supported* fact, never invented detail; unknown stays
"Not established"; nothing is published without scholarly review.

## What already exists (do not rebuild)

| Brief item | Already in QITL |
|---|---|
| 25 prophets, 29-stop journey, story steps with a Quran reference each | `content/journey`, `/prophets/[id]`, `story_sections` (step_group, step_role, claim_id, audience, everyday_example) |
| Events, people, communities, parables, major events, seerah; verified verse ranges; coverage 93.7% | Event Universe: `historical_events` (+track), `event_verse_refs`, `event_identifications`, `event_connections`, `/timeline?view=complete`, `/events/[slug]`, `docs/EVENT_COVERAGE.md`, `/admin/events/coverage` |
| Evidence graph claim -> reference, no evidence no publish, reviews, no self-review | `evidence_claims`, `claim_references`, `editorial_reviews`, `review_entity_types/authors` |
| Hadith (4 collections, individual grading rule) | `hadith_collections/books/chapters/entries/gradings/translations/commentary_links` |
| Tafsir incl. Tafsir Muqatil, classical tafsir links | `tafsir_entries`, interpretation engine |
| Story Studio, scripts, scenes, translation (Lara), narration, versions, player | `story_scripts/scenes/translations/media/publication_versions`, `/stories/[slug]`, `/admin/studio`, Story Player |
| Life lessons, safety, modern application | Life Guidance (`guidance_*`), `story_sections.everyday_example`, Life Through the Ages |
| Visual layer, media review | media library, Creation Atlas, concept packs (review only) |
| EN/AR/UR, search, reading progress | i18n modules, unified search, Quran progress |

## Gaps (what this phase builds)

1. **Hadith Stories library** (DONE on `mod/hadith-people`, 2026-11-01: `/hadith-stories`, `/admin/hadith-stories`, migration `20261031002520`; no story is published, nothing is seeded): no table or page for authenticated hadith narratives as stories (title, narrator, collection reference, grading
   scholar, summary, Quran connections, lessons, link to person/community/event). Only grade-gated entries.
2. **People and Communities encyclopedia pages** (DONE on `mod/hadith-people`, 2026-11-01: `/people`, `/communities`, migration `20261031002521`; no record is published, nothing is seeded; the editors' screen for `encyclopedia_kind`, the Event Universe item, aliases and `person_claims` is built on `mod/people-admin`, 2026-11-01: `/admin/people`, `/admin/communities`): `people` and `historical_communities` rows exist but there is no public page per person
   or community, no "identity not established / traditional identification" presentation, no list by kind.
3. **Story chapters with their own references and depth modes**: story_sections carry steps; there is no chapter object with its own
   verse references, no One-Minute / Complete / Deep Study / Kids / Life Lessons switch, no chapter deep links.
   **DONE on `mod/story-chapters` (2026-11-01)**: `chapters` extended (anchor, event link, five mode texts, unknowns, version, author),
   reader with `?mode=`, chapter list and sheet, admin chapter manager. See `docs/STORY_COVERAGE.md` section 1.
4. **Story coverage dashboard**: verified from records (never checkboxes): Quran passages indexed, hadith verified, drafted, scholar approved,
   EN/AR/UR reviewed, media approved, published; per prophet, person, community, event.
   **DONE (2026-11-01)**: `/admin/stories/coverage`, staff-only derived functions, `docs/STORY_COVERAGE.md` section 3.
5. **Source-change invalidation**: a change to a claim, reference, grading or tafsir link must mark dependent summaries, translations and
   audio as needing review.
   **DONE (2026-11-01)**: triggers on `content_dependency_versions`, the Needs re-review queue, `docs/STORY_COVERAGE.md` section 2.
6. **Unified story search** (DONE on `mod/hadith-people`, 2026-11-01: typed results and the type / track / surah facets, migration `20261031002522`) with facets (prophet, person, community, event, hadith story, parable, surah/verse, theme, life challenge).
7. **Automated story checks** (missing refs, duplicate stories, unsupported names, hadith grading gaps, broken links) in CI and admin.
   **DONE (2026-11-01)**: `src/lib/stories/checks.ts`, `pnpm check:stories`, shown on the coverage page, `docs/STORY_COVERAGE.md` section 4.

Gaps 1, 2 and 6 belong to `mod/hadith-people`.

## Phases

- A (this run, two parallel branches; gaps 1, 2 and 6 are built on `mod/hadith-people`, gaps 3, 4, 5 and 7 remain on `mod/story-chapters`): `mod/hadith-people` = gaps 1, 2, 6; `mod/story-chapters` = gaps 3, 4, 5, 7.
- B (needs reviewers and licences, not code): populate and review Priority A stories (Adam, Nuh, Ibrahim, Yusuf, Musa, Isa, Muhammad), then the
  remaining prophets, people, communities, hadith stories. Content is entered through the admin studios and published only after the
  scholarly, language and media reviews. Nothing is seeded as published.
- Sources: Quran Foundation, QuranEnc, Quranic Arabic Corpus, sunnah.com remain gated by `docs/LICENSING.md` and `docs/PERMISSION_REQUESTS.md`.

## People and Communities admin (`mod/people-admin`, 2026-11-01)

`/admin/people` and `/admin/communities` (editor, scholarly reviewer, admin; editors write). No migration: the screen uses the tables, RLS,
guards and audit triggers of `20261031002521` and the existing review flow.

- Reads: `GET /api/admin/people?view=list|detail|events|claims` under the caller's own session (RLS decides what is visible).
  Event Universe items are listed per track (prophets for a prophet, people for anyone else, communities for a community).
- Writes (editors, same-origin, per-user rate limit, zod): `POST /api/admin/people` (group, subject item), `/aliases`, `/claims`
  (attach an existing claim by id, never a verse), `/status` (send for review, publish, correction with a public note).
  Scholarly approval of a person uses the existing `/api/admin/review`.
- Refusals are returned in the database's words (`no evidence, no publish: ...`, `no review, no publish: ...`, the prophet-label and
  track rules). The shared `dbError` strips the part of a guard message before the first colon, so the new `status` route returns the
  full message instead of changing the shared helper.
- Findings (not fixed here, no migration): `person_aliases` has no audit trigger and no published-record freeze, so alias edits are not
  in the audit trail and the database alone would accept an alias change on a published person (the route refuses it). A follow-up
  migration should add `audit()` and a freeze trigger like `guard_person_claims`.
- Not built: creating a person or community (no seed data by instruction); editing a community's name, era or evidence claim (Life
  Through the Ages owns that).

## Lineage and earlier scriptures (added with `mod/lineage`)

The Adam-to-Muhammad lineage is a structure with no content: evidence classes are derived, gaps and competing accounts are
stored and cited, a chain mixing incompatible traditions is refused, and nothing is published until reviewed. The scripture
witness registry is comparative research with a mandatory limitation per entry and no scripture text. Full model, rules and
open items: `docs/LINEAGE.md`.
