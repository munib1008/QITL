# Story coverage: chapters, depth modes, invalidation, dashboard and checks

Branch `mod/story-chapters` (2026-11-01), gaps 3, 4, 5 and 7 of `docs/STORY_ENCYCLOPEDIA_AUDIT.md`.
Migrations `20261031002550_story_chapters.sql`, `…002551_story_source_invalidation.sql`, `…002552_story_coverage.sql`.
No content is seeded and nothing is generated: every chapter text is written and reviewed by people.

## 1. Chapters and depth modes (gap 3)

**No parallel table.** The chapter object already existed (`stories` -> `chapters` -> `chapter_claims` -> `evidence_claims` ->
`claim_references`, review types `story` and `chapter`). The migration extends `chapters` and `stories`:

| Column | Meaning |
|---|---|
| `chapters.anchor` | the chapter's own link, `/stories/<slug>#chapter-<anchor>`; defaults to the position; unique per story |
| `chapters.event_id` | optional link to a timeline event (`historical_events`); also `event_stories` links a story to events |
| `body_md` | **Complete story** (the existing column) |
| `summary_md` | **One-minute summary** |
| `deep_md` | **Deep study**: scholarly detail added to the complete story |
| `kids_md` | **Kids mode** (rests on the same claims; story sections keep their `audience = kids` adaptations) |
| `lessons_md` | **Life lessons**: always shown labelled as educational interpretation |
| `unknowns_md` | what the sources do not establish ("Sources and uncertainties") |
| `chapters.version`, `stories.version`, `editorial_reviews.entity_version` | a scholarly review binds to the version it was given for |
| `chapters.created_by` | stamped author; `chapter` is registered in `review_entity_authors`, so nobody approves their own chapter |

A chapter's **verse references** are not typed twice: they are the Quran references of its claims
(`chapter_verse_refs`, a read-only `security_invoker` view) and render as `ayahHash` deep links.

**Publish guards** (trigger `chapters_rules`, plus the existing generic guard): every claim approved, at least one Quran or
authentic-hadith reference among them, an approved scholarly review **of this version** (editing a draft after its review
makes a new version, so the approval no longer counts; so does a later "changes requested"), no open re-review flag, no
self-review. **A published chapter or story is frozen**, and so are the claims behind a published chapter: move it to
correction first. Stories follow the same version/freeze/review rules.

**Reader** (`/stories/[slug]`, `ChapterReader`): mode switch (radio group, arrow keys follow the reading direction, `?mode=`
wins over the mode remembered in `localStorage`, storage errors are caught), sticky chapter list (side column from 1024 px,
bottom sheet below), reading progress kept in this browser (`qitl-story-read:<slug>`), per chapter a collapsible sources panel
(open in Deep study), "Sources and uncertainties" last. A mode without reviewed text renders "Not established yet"; **no mode
is derived from another** (a kids text or a summary is not an abbreviation of the complete text). The prophet and event
pages show the same switch over their section-based story (`StoryView`: summary, complete, deep, kids, lessons; the older
"Young learners" level remains a toggle) and list the chapters of the full story with their anchors.

**Admin**: `/admin/stories` has `ChapterManager` (chapters, claims, event link, the five texts, send for review, publish, move
to correction with a public note; shows "scholar-approved (this version)" and re-review flags) and the **Needs re-review**
queue. Reviewing uses the existing review board (`/admin/review`).

## 2. Source-change invalidation (gap 5)

Reuses `content_dependency_versions` (added: `reason`, `cleared_at`, `cleared_by`). When a source changes **materially**, every
dependant that was already reviewed or published (drafts are never flagged) gets a row with the reason and the time:

| Source change | Dependants flagged |
|---|---|
| claim text or evidence class changes; claim leaves approved/published | chapters, stories (summary), story sections, quizzes, media, scripts, **translations** of those scripts, audio |
| claim reference (Quran range, hadith, **tafsir link**, history/scholar source) added, changed or removed on an approved claim | the same, through the claim |
| hadith grading recorded (dissenting ones too), changed or removed | the same, for every claim citing the narration |
| hadith commentary link unpublished or changed | the same |
| verse reference of an event added, changed or removed | chapters, sections, scripts and stories of that event |

The **published snapshot stays frozen**: flagging never edits a dependant. Audio is flagged, not switched off. A flagged chapter or
story cannot be (re)published until a scholarly reviewer approves it again **after** the flag, and only while all its claims are
approved again. The queue is `story_needs_rereview()` (staff only). Limits: `tafsir_entries` text is not linked to claims by id, so
a tafsir link is a `claim_references` row of kind `tafsir`; the public page shows no "under re-review" notice (the flag is staff data).

## 3. Coverage dashboard (gap 4): `/admin/stories/coverage`

Staff only (the page checks the role; the functions return nothing to anyone else and are not executable by `anon`). All counts
are derived on every load by `story_coverage_by_subject()`, `story_coverage_counts()` and `story_coverage_refs()`; there is
no checkbox. `story_coverage_public` (a `security_invoker` view) gives anonymous callers published counts only, never a title.

The register is the Event Universe (159 items; tracks prophets 25, people, communities, events, parables, seerah). A prophet's
story is found through its person (`people.slug` = the item's slug; the journey spells `dhulkifl` and `zakariya`), through
`event_stories`, or through a chapter's own event link.

| Metric | Source (derived) |
|---|---|
| **Discovered** | the item exists in `historical_events` with a track (a title alone is nothing else) |
| **Researched** | it has verse references **and** claims, any status |
| **Reviewed** | a chapter (version-bound) or section has a scholarly approval, or the item itself does |
| **Published** | the item is published **and** at least one chapter or section is published |
| Quran passages indexed | ayat covered by `event_verse_refs` or a chapter's claims, against the register of `content/events/narrative-ranges.json` and the inventory; "verified" = resting on an approved claim |
| Claims approved / all | `evidence_claims` reachable from the item (event claims, verse-reference claims, chapter claims, section claims) |
| Hadith verified / linked | `claim_references` of kind hadith; verified = approved claim, named sahih/hasan grading, one of Bukhari, Muslim, Tirmidhi, Ibn Majah |
| Chapters drafted / scholar-approved / published | drafted = any mode text written; approved = latest review approves **this version**; published = status |
| Sections drafted / approved / published | full-audience `story_sections` |
| EN / AR / UR reviewed | `story_scripts` of that language, published, and (translations) both `translation_reviews` approved for the current version |
| Media approved | `story_media.approved_by` set |
| Needs re-review | open rows in `content_dependency_versions` for the item's chapters, sections and scripts |
| Unresolved questions | chapters' `unknowns_md`, open correction requests, the re-review queue, ranges still to research |

## 4. Automated checks (gap 7)

`src/lib/stories/checks.ts` (pure) is used by `scripts/check-stories.ts` (`pnpm check:stories`; `--db` adds the database through
`story_check_inputs()` with the service role, `--json`, `--strict`), by `tests/unit/story-checks.test.ts` (run in CI: the real content must
have no error or warning), by `tests/db/story-chapters.test.ts` (over real rows) and by the coverage page. The checks report;
they change nothing.

| Check | Reports |
|---|---|
| missing Quran references | inventory items, chapters, sections and published events with no Quran/hadith reference; chapters with no claims |
| verse ids outside the surah | any range past the end of its surah (against `content/quran`), in the inventory, journey, chapters and events |
| duplicate stories | identical verse sets (warning); near-identical sets, Jaccard >= 0.9 (note). A prophet and one episode of his story are not duplicates |
| non-prophet labelled prophet | people, events, journey stops or text calling a known non-prophet a prophet (the 25 are the inventory's `prophets` track) |
| unsupported chronology | a year on an item that is only ordered; a date without a citing claim; a date written in chapter text |
| hadith grading gaps | a collection outside the four, no grading cited, a grading that is not sahih or hasan |
| unlicensed source content | a cited source whose rights are not cleared or public domain |
| contradictory genealogy | a person who is their own ancestor; parent and sibling/spouse of the same person (competing disputed alternatives are exempt) |
| unreviewed translations | a published/approved translation without both reviews of its version |
| broken internal links | links in chapter and section text to pages, prophets, events, stories, surahs or ayat that do not exist |
| unapproved claim (extra) | a reviewed or published unit resting on a claim that is not approved |

Judgement calls: a date-looking number in text is a warning, not an error; "needs a human look" beats a silent pass.
