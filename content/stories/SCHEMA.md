# Story drafts: file format

`content/stories/<slug>.draft.json` holds one **draft** story. Nothing in these files is reviewed, approved or published, and none
may be presented as such. They exist so that scholars can review them and so that, after review, an editor can import them into the
platform (`pnpm import:drafts`, dry run by default). Workflow and the review checklist: `docs/STORY_DRAFTS.md`.

Source of truth for the rules: `src/lib/stories/draft.ts` (zod schema and validator). Check with `pnpm check:drafts`.

## Shape

```jsonc
{
  "slug": "yusuf",                       // kebab-case; must equal the file name
  "title_en": "Yusuf",
  "title_ar": "يوسف",                    // only the well-known Arabic name of the subject (tests/fixtures titles_ar); otherwise null
  "subject": { "type": "prophet", "event_slug": "yusuf" },   // an inventory item on the "prophets" track
  "status": "draft",                     // the only value the schema accepts
  "notes": "DRAFT ... Arabic and Urdu left null for translators ...",   // header comment
  "chapters": [
    {
      "anchor": "the-dream",             // kebab-case, unique in the story; becomes /stories/<slug>#chapter-<anchor>
      "position": 1,                     // 1..n in order
      "title_en": "The dream",
      "event_slug": "yusufs-dream",      // an Event Universe item whose refs contain ALL the chapter's verses, or null
      "verses": [{ "surah": 12, "from": 4, "to": 6 }],
      "claims": [
        { "id": "c1", "statement_en": "...", "verses": [{ "surah": 12, "from": 4, "to": 4 }], "evidence": "quran" }
      ],
      "summary_md": "...",               // One-minute summary
      "body_md": "...",                  // Complete story
      "deep_md": "...",                  // Deep study (may be null)
      "kids_md": "...",                  // Kids mode (may be null)
      "lessons_md": "Educational interpretation (not scripture): ...",   // Life lessons (may be null)
      "unknowns_md": "- ..."             // what the verses do NOT establish
    }
  ],
  "uncertainties_en": ["Hadith to add later: ...", "..."]   // story-level open points
}
```

Arabic and Urdu are never written in these files (only English); they are left for translators.

## What the validator enforces (`pnpm check:drafts`; exit 1 on any error or warning)

**Structure.** Strict schema (unknown keys refused); `status` is `draft`; every claim has `evidence: "quran"` and at least one verse
range; positions run 1..n; anchors and claim ids are unique; the slug equals the file name.

**Verses.** Every range exists in `content/quran` (surah and ayah bounds). A claim's verses lie inside the chapter's verses. A
chapter's verses lie inside the inventory refs of the subject (`content/events/inventory.draft.json`), and inside the refs of its
`event_slug` when it has one. Verses listed for a chapter but cited by no claim are a warning. Inventory ayat that no chapter
covers are listed as information (a reviewer decides). Verse references written in the text (`12:5`) must exist and lie inside the chapter.

**Every sentence rests on a claim.** In `summary_md`, `body_md`, `deep_md`, `kids_md` and `lessons_md` each sentence (or bullet)
carries a marker `[c1]` or `[c1][c2]` or `[c1, c2]` placed **before** the closing full stop. The marker names a claim of the same
chapter. `unknowns_md` and `uncertainties_en` state what is *not* established and need no marker. A claim cited by no text is a
warning. On import the markers are stripped from the stored text; the claim id is kept in `chapter_claims.anchor`.

**Quran only.** No hadith wording (`hadith`, collection names, `narrated by` ...). Hadith that should be added later are listed in
`uncertainties_en` as `Hadith to add later: ...` (at least one such entry is required, even if it says none is expected).

**Modes add no facts.** `summary_md`, `kids_md` and `lessons_md` may only restate claims: every listed name and number word in them
must also be in a claim of the chapter. `lessons_md` must start with `Educational interpretation (not scripture):`.

**Forbidden patterns** (an error; flagged for human review):

| Pattern | Rule |
|---|---|
| numerals, ages, years, durations | no digits in the texts; a number word is allowed only if listed in `tests/fixtures/story-anchors*.json` `numbers` **and** its Arabic anchor occurs in the chapter's verses (eleven stars, seven cows, several years ...) |
| named persons and places | every capitalised word must be a listed name (`names`, with an Arabic anchor that occurs in the chapter's verses; the subject's own name is tested against the whole inventory), a listed common word, or a sentence-opening word. An unknown capitalised word is an error: it may be an invented name |
| names from later tradition | listed in `tradition_names`; refused in the story texts; allowed only in `unknowns_md` / `uncertainties_en`, in a sentence that says `Named in later tradition, not in the Quranic text` |
| invented dialogue | straight double quotation marks only around speech: the sentence must cite a claim that contains a speech verb and the quoted words |
| depiction | no physical description or dress of prophets, angels or jinn (`handsome`, `beautiful`, `robe`, `hair` ...); a body-part word is allowed only if listed in `guarded` and its Arabic anchor is in the verses |
| tradition phrasing | `it is said`, `according to tradition`, `legend`, `isra'iliyyat`, `the Bible` ... in the story texts |
| legal or medical wording, promises of worldly outcomes | refused (`ruling`, `halal`, `cure`, `guarantees success` ...) |
| Arabic script | none in the texts (verse references are enough); `title_ar` is the only Arabic field |

The checks are heuristics: they stop the common mistakes and nothing else. A draft that passes is not accurate until a scholar has read it.

## Anchor fixtures

`tests/fixtures/story-anchors.json` (shared lists: number anchors, opening words, common capitalised words) plus one
`tests/fixtures/story-anchors.<batch>.json` per batch of stories (names, tradition names, `titles_ar`, `guarded`). Anchors are
typed the way the Uthmani text spells the word (for example `شيطن`, not `شيطان`), matched on the light normal form of
`src/lib/events/verify.ts`, and a test checks that each one occurs somewhere in the Quran text.

## Import (`pnpm import:drafts`)

Dry run by default (no database, no key). `--db` writes `stories`, `chapters`, `evidence_claims`, `claim_references` (kind `quran`),
`chapter_claims` and an `event_stories` link, **all with status `draft`**; it needs `SUPABASE_SERVICE_ROLE_KEY` and
`NEXT_PUBLIC_SUPABASE_URL` in the environment. It never approves or publishes and never writes a review. Re-importing changes only
rows that differ; a row that is no longer a draft is skipped. The story-level `uncertainties_en` list stays in the file (the schema
has no column for it).
