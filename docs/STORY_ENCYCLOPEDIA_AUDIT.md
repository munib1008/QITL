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

1. **Hadith Stories library**: no table or page for authenticated hadith narratives as stories (title, narrator, collection reference, grading
   scholar, summary, Quran connections, lessons, link to person/community/event). Only grade-gated entries.
2. **People and Communities encyclopedia pages**: `people` and `historical_communities` rows exist but there is no public page per person
   or community, no "identity not established / traditional identification" presentation, no list by kind.
3. **Story chapters with their own references and depth modes**: story_sections carry steps; there is no chapter object with its own
   verse references, no One-Minute / Complete / Deep Study / Kids / Life Lessons switch, no chapter deep links.
4. **Story coverage dashboard**: verified from records (never checkboxes): Quran passages indexed, hadith verified, drafted, scholar approved,
   EN/AR/UR reviewed, media approved, published; per prophet, person, community, event.
5. **Source-change invalidation**: a change to a claim, reference, grading or tafsir link must mark dependent summaries, translations and
   audio as needing review.
6. **Unified story search** with facets (prophet, person, community, event, hadith story, parable, surah/verse, theme, life challenge).
7. **Automated story checks** (missing refs, duplicate stories, unsupported names, hadith grading gaps, broken links) in CI and admin.

## Phases

- A (this run, two parallel branches): `mod/hadith-people` = gaps 1, 2, 6; `mod/story-chapters` = gaps 3, 4, 5, 7.
- B (needs reviewers and licences, not code): populate and review Priority A stories (Adam, Nuh, Ibrahim, Yusuf, Musa, Isa, Muhammad), then the
  remaining prophets, people, communities, hadith stories. Content is entered through the admin studios and published only after the
  scholarly, language and media reviews. Nothing is seeded as published.
- Sources: Quran Foundation, QuranEnc, Quranic Arabic Corpus, sunnah.com remain gated by `docs/LICENSING.md` and `docs/PERMISSION_REQUESTS.md`.
