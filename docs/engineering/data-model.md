# Data model

The schema lives in `supabase/migrations/` and is tested against real Postgres with PostGIS (PGlite) in `tests/db/rls.test.ts`. One source-backed entity feeds the story, the timeline, the atlas and the genealogy graph, so those views cannot disagree.

| Migration | Contents |
|---|---|
| `…0100_foundation` | Extensions, enums, `profiles`, `role_assignments`, `has_role()`, `is_staff()`, the audit trigger |
| `…0200_sources_quran_hadith` | Source and licence registry, pinned source versions, import jobs, Quran surahs and verses (immutable), licensed translations, tafsir, the seven hadith collections, books, chapters, narrations, number variants, translations, gradings, `hadith_grade_summary` |
| `…0300_knowledge` | Evidence claims and references, editorial reviews, people and relationships, locations and geometries, events and their links, topics, stories and chapters, assets, versions, revision notes, correction requests, the publish guards |
| `…0400_user_community` | Bookmarks, reading progress, private notes, collections, notification prefs and notifications, discussions, comments, revisions, reactions, follows, reports, moderation actions, blocks, bans, appeals, rate limits, feature flags, site settings, legal documents, data jobs |
| `…0500_rls` | Grants and row level security on every table |
| `…0600_search` | Arabic and Latin normalisation, `search_index`, indexing triggers, `search()` |
| `…0700_storage` | Supabase Storage buckets and policies (Supabase only) |
| `…0800_rpc` | `atlas_places()` and `person_graph()` |

## Entity relationships

```mermaid
erDiagram
  sources ||--o{ source_versions : "pinned by checksum"
  source_versions ||--o{ quran_verses : "text of"
  quran_surahs ||--o{ quran_verses : contains
  quran_verses ||--o{ quran_translations : "translated (licensed)"
  sources ||--o{ quran_translations : licence
  hadith_collections ||--o{ hadith_books : contains
  hadith_books ||--o{ hadith_chapters : contains
  hadith_chapters ||--o{ hadith_entries : contains
  hadith_entries ||--o{ hadith_gradings : "graded by named scholar"
  hadith_entries ||--o{ hadith_translations : "translated (licensed)"
  hadith_entries ||--o{ hadith_number_variants : "numbered in other editions"

  evidence_claims ||--|{ claim_references : "cites (≥1 to publish)"
  claim_references }o--o| quran_verses : "Q s:a–b"
  claim_references }o--o| hadith_entries : narration
  claim_references }o--o| hadith_gradings : "grading relied on"
  claim_references }o--o| sources : "tafsir / history"
  editorial_reviews }o--|| evidence_claims : "approves (reviewer)"

  people ||--o{ relationships : from
  people ||--o{ relationships : to
  relationships }o--|| evidence_claims : "rests on"

  locations ||--o{ place_geometries : "point / region / route / hypothesis / unknown"
  place_geometries }o--o| evidence_claims : "rests on"

  historical_events }o--o| evidence_claims : "rests on"
  historical_events ||--o{ event_claims : ""
  historical_events ||--o{ event_people : ""
  historical_events ||--o{ event_places : ""
  historical_events ||--o{ event_relationships : "before / after / follows_in_text"
  historical_events ||--o{ event_stories : ""

  stories ||--|{ chapters : ""
  chapters ||--o{ chapter_claims : ""
  chapter_claims }o--|| evidence_claims : ""

  profiles ||--o{ bookmarks : owns
  profiles ||--o{ reading_progress : owns
  profiles ||--o{ private_notes : "owns (owner-only)"
  reading_progress }o--|| chapters : ""
  discussions ||--o{ comments : ""
  comments ||--o{ comments : replies
  comments ||--o{ comment_revisions : ""
  comments ||--o{ reports : reported
  discussions ||--o{ discussion_follows : ""
  moderation_actions }o--|| profiles : "by moderator"
```

## Integrity rules enforced by the database

| Rule | Where |
|---|---|
| No evidence, no publish: a claim needs ≥1 reference and a reviewer's approval; a story, chapter, event, relationship or geometry needs approved claims and its own approval | `guard_claim_status()`, `guard_entity_publish()` |
| Only a scholarly reviewer records a review, never on their own claim | `check_reviewer()` and RLS on `editorial_reviews` |
| A Quran reference must exist in the verified text and end inside the surah | foreign key + `check_quran_range()` |
| A hadith reference's grading must belong to the cited narration | `check_quran_range()` |
| Quran Arabic is never edited in place | `quran_immutable()` |
| A translation, tafsir or hadith translation is readable only when its source's rights are `cleared` or `public_domain` | RLS via `source_publishable()` |
| Relative and unknown dates carry no years; the Last Hour never has a date; sacred history is relative, unknown or a labelled estimate; ranges are ordered | `historical_events` check constraints |
| Years use astronomical numbering (1 BCE = 0, 2 BCE = −1), so there is no missing year zero | `start_year`, `end_year` |
| An unknown place has no geometry, and a geometry is never "unknown"; a point needs a claim and a source; regions must be polygons above a minimum area for their location type | `place_geometries` checks, `check_region_area()` |
| Competing genealogical lines share a `competing_group` and are marked disputed; relationships always rest on a claim | `relationships` checks |
| A media asset needs alt text, credit and a source, and can never depict a person | `assets` checks |
| Every published entity is snapshotted, so corrections show a diff | `snapshot_version()` → `content_versions` |
| Editorial changes are audited; private notes never are | `audit()` triggers |
| Comments: rate limited, banned users refused, replies stay in their thread, edits keep revisions, three reports hide | `before_comment()`, `throttle()`, `after_report()` |

## Personal data

Bookmarks, reading progress, private notes, collections, follows, notification preferences and legal acceptances are readable and writable only by their owner (RLS `user_id = auth.uid()`). No staff role, including admin, can read private notes. Deleting the auth user cascades to all of them. `export_my_data()` returns everything a user owns.
