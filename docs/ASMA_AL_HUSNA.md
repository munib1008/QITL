# Asma' al-Husna (the Names of Allah)

Branch `mod/asma-al-husna` (from `feat/platform-foundation` b23c318). Not merged, migration not applied to production, seed not loaded.
Everything written by this module is an **AI draft**: `scholarly_status = not_reviewed`, never badged verified, labelled
"AI Draft — Under Review" (EN/AR/UR) wherever it is shown.

## Rules this module keeps

- Religious evidence only from the Quran, Sahih al-Bukhari, Sahih Muslim and individually graded sahih narrations of Tirmidhi / Ibn Majah.
  Hadith and dua wording is **never stored as text**: a row is a reference to an existing `hadith_entries` + `hadith_gradings` record (the
  database checks the collection and the grade) or a `needs_source` placeholder that pages show as "Unavailable".
- Quran text only from the loaded corpus (`content/quran`, Tanzil Uthmani 1.1, checksum-pinned). Category A duas hold a verse reference; the page
  reads the wording from the corpus. Category B duas carry the label "Suggested personal wording — not a quoted Quranic verse or Prophetic dua"
  (a database check pins the exact string).
- No invented rewards, recitation counts, special times or guaranteed acceptance: a text guard (TypeScript `text-validator.ts`, SQL `asma_text_ok`,
  compared on shared samples in `tests/db/asma.test.ts`) refuses them in every free-text column, lifted only for the quoted claim of a misconception.
- The platform does **not** say which transmitted enumeration is authentic, does not say the Names are limited to 99 or any number, and does not
  convert Quranic verbs or attributes into Names. The registry is "Educational list - enumeration not established by this platform". The
  Bukhari 7392 narration and the scholarly discussion of enumeration are **unpopulated placeholders** (`divine_name_hadith_evidence` /
  `divine_name_scholarly_positions` with `needs_source`).
- Scholarly positions are attributed and never scored (no numeric column; a check refuses "confidence", "score", "ranked", percentages).

## The counting engine (`src/lib/asma`)

Pure TypeScript, tested against the real corpus (`tests/unit/asma-engine.test.ts`). Policy versions: normalisation `asma-norm-v1`,
tokenisation `asma-tok-v1`, query `asma-query-v1`.

| Step | Policy |
|---|---|
| Normalisation | Remove tatweel, diacritics, Quranic annotation signs and small marks; dagger alef restored as alef; alef forms folded to alef; alef maqsura / Persian ya to ya; hamza on waw / ya kept; ta marbuta kept (option `to_ha` exists for exploration only) |
| Tokenisation | Whitespace words; signs without a letter are not words; token index is 1-based over words only |
| Basmala | This corpus file prepends the basmala to the first ayah of surahs 2-8 and 10-114. Those four words are tagged and **never counted**; 1:1 (a verse) and 27:30 (inside a verse) are counted |
| Definite article / clitics | Part of the exact form. "الغفور" does not match "غفور"; a prefixed word is a different surface form. Candidates (article toggled, one prefix particle) are offered to reviewers as exploration, never counted |

Three measures, always separate; there is **no total** anywhere (a test asserts it):

- **A exact surface form**: normalised word equals a registered form (`divine_names.surface_forms`). Lexical only: every occurrence carries
  `referent_status = unreviewed` until a scholarly reviewer sets it (`asma_set_referent`).
- **B accepted variants**: only from published, sourced, reviewed rows of `divine_name_inclusions`. Default empty.
- **C related root**: only from published inclusion rows with a root. Listed apart, `relation = related`, never a Divine Name.

Every result carries the Quran edition, both checksums, the policy versions and a query hash. `validateCountClaim` rejects a hardcoded
(non-computed), unsupported (no provenance), stale (provenance differs) or mismatching count; `findHardcodedCounts` rejects any count-like field in
registry data; `verifyReproducible` re-runs from a freshly loaded corpus and requires byte-identical output.

### Known limits of the engine (read before trusting a number)

- Matching ignores vowels, so a word can equal a Name's letters and be something else. Examples visible in the data: the registered
  "المعز" (Al-Mu'izz) matches the word for goats in 6:143, and "الحكم" (Al-Hakam) matches the letters of "ٱلْحُكْمُ". These are counted under A and
  stay `unreviewed`; the explorer says so on every row. Nothing here decides the referent.
- A recognised Name can be absent as an exact form (for example one that the Quran text carries only without the article): A is 0, the explorer
  can show the article-toggled word as exploration, and a reviewer may add a sourced B row.
- The Uthmani spelling can differ from the ordinary spelling (alef written out). The registry lists such orthographic spellings explicitly
  (`forms`: currently Ar-Rahman and Ar-Ra'uf). Any other Name whose Quranic spelling differs and is not listed would under-count; the dry run shows A = 0
  for those and a reviewer must check them.
- No morphological analyser is in the repo, so C and B cannot be generated: they come only from reviewed lists.
- The count says how many words match under the policy. It is not a claim about how often Allah is named.

## Schema (`supabase/migrations/20261031002900_asma_al_husna.sql`)

Tables (forced RLS, writes revoked from `anon`): `divine_names`, `divine_name_aliases`, `divine_name_translations`, `divine_name_linguistics`,
`divine_name_occurrence_methodologies`, `divine_name_quran_occurrences` (FK to `quran_verses`), `divine_name_count_summaries`,
`divine_name_inclusions`, `divine_name_hadith_evidence`, `divine_name_tafsir_links`, `divine_name_scholarly_positions`, `divine_name_relationships`,
`divine_name_misconceptions`, `authentic_duas`, `dua_life_topics`, `dua_divine_name_links`, `dua_topic_links`, `divine_name_topic_links`,
`divine_name_reviews`, `user_divine_name_learning`, `user_dua_bookmarks`.

- Counts are written only by `asma_replace_occurrences` (administrator or service role); the per-measure summaries are derived by the database
  from the rows it stored, and a hand-edited summary is detected (`asma_counts_consistent`).
- Publication needs an approving **version-bound** scholarly review (`divine_name_reviews`, no self-review, role checked) AND the passed integrity check
  AND the published-record freeze; an edit after approval invalidates it.
- Public AI-draft reading is only through security-definer functions (`public_asma_names`, `public_asma_name`, `public_asma_occurrences`,
  `public_asma_duas`, `public_asma_dua`, `public_asma_topics`, `public_asma_names_in_verse`, `public_asma_confirmed_in_surah`,
  `public_asma_lexical_in_verse`); no table policy is widened. The security sweep lists them as the deliberate read API.
- Changing a Name's recognition status, registered forms, root or Arabic, publishing an inclusion row, or adding a new current methodology sends the
  Name (and dependents) back: `classification_version` +1, `needs_rereview`, approval invalidated, off the public pages, counts marked stale,
  dependents moved to `correction`.

## Loading data

```
pnpm tsx scripts/compute-asma-occurrences.ts            # dry run (default): prints A / B / C for every Name, writes nothing
pnpm tsx scripts/compute-asma-occurrences.ts --verify   # also proves a second run is byte-identical
pnpm tsx scripts/compute-asma-occurrences.ts --db       # needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (owner action)
```

`--db` writes the methodology, any missing Names (private AI drafts; existing rows are never overwritten), the occurrences through the database
function, and the draft life-situation topics. Nothing becomes public: an editor runs the integrity check and chooses "Show as AI draft" in
`/admin/asma`. A stored Name is always recounted from its stored query (its `surface_forms` plus published inclusion rows), never from the draft file.

## Honest status

| Area | Status |
|---|---|
| Counting engine, validators, reproducibility | Built and tested against the real corpus (unit) |
| Schema, guards, RLS, re-review flags | Built and tested (PGlite, incl. the security sweep). **Not applied to Supabase.** |
| 99-name educational registry (Arabic, vowelled, transliteration, EN/AR/UR beginner gloss, root) | Written as DRAFT in `content/asma/names.draft.json`. Glosses, vowelling and roots are AI drafts, unreviewed. **Not loaded** (needs the service role) |
| Computed occurrences | Computed in the dry run and loaded into the test database; **not in any live database** |
| Public pages (hub, gallery, A–M name page, explorer, dua, pathways, Ism al-A'zam, response, learning studio) | Built. Verified in the browser only in their not-connected / unpopulated states and on a test-only fixture page; **never viewed with real data from a live Supabase** |
| Learning studio | Built; progress and notes live on the device (localStorage). Account sync (`user_divine_name_learning`, `user_dua_bookmarks`) exists in the schema but **no UI/API writes to it yet** |
| Admin console `/admin/asma` | Built (registry actions, count verification, review, versioning). Not exercised against a live database or with a real signed-in role |
| Quran reader "Explore this Name" | Built; shows only where a reviewer set `confirmed_allah` (none exists, so none shows) |
| Hadith evidence, tafsir, scholarly positions, linguistics, translations, relationships, misconceptions | Tables and pages exist; **no row exists**; every section reads "Unavailable" |
| Duas | Structure only. No category A dua has a source record; no category B text is shipped. The composer is a private on-device note |
| Al-Ism al-A'zam, "How does Allah respond to dua?" | Placeholder headings only; no content |
| Life-situation pathways | 3 draft topics in `content/asma/topics.draft.json`; a link cites a verse only when that verse contains the Name's computed exact form; otherwise "no verse cited yet" |
| B and C measures | Mechanism complete, **all empty** until a reviewer adds sourced, reviewed inclusion rows |
| Arabic / Urdu strings | Complete key parity (tested) but first drafts needing a qualified translator |
| Scholarly review | **None.** No reviewer exists |

## Placeholders awaiting a scholarly reviewer

1. Every beginner gloss (`rendering_en/ar/ur`), vowelled form and root in `names.draft.json`.
2. The choice of list (which commonly taught names are included, and the two orthographic extra forms).
3. Referent of every matching word (`referent_status` is `unreviewed` for all).
4. Which A-count words are not the Name (for example Al-Mu'izz, Al-Hakam letters); which indefinite forms deserve a sourced B row.
5. Hadith evidence, including the narration the brief names as Bukhari 7392 about the 99 names: `needs_source`, no text, no hadith number entered in any data file.
6. Scholarly positions on enumeration and inclusion; tafsir links; linguistics; relationships; misconceptions and their corrections.
7. All duas (category A needs a verse or graded hadith record; category B wording needs review) and the etiquette-of-dua list.
8. The Al-Ism al-A'zam and dua-response pages; the three life-situation topics and their Name links.
9. Arabic and Urdu interface strings (`asma.ts`, `adminAsma.ts`).

## Verification run for this branch

See the branch's final report for the exact commands and results.
