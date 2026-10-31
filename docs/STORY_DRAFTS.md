# Story drafts: workflow and review checklist

Branch `mod/stories-a` (2026-11-01). Priority A, first batch: **Adam**, **Nuh**, **Yusuf**. The other batch (Ibrahim, Musa, Isa,
Muhammad) is written on `mod/stories-b` in the same format. Files: `content/stories/<slug>.draft.json`; format and validator rules:
`content/stories/SCHEMA.md`; code: `src/lib/stories/draft.ts`, `draft-load.ts`, `draft-import.ts`; commands: `pnpm check:drafts`,
`pnpm import:drafts`.

**Status of the content: DRAFT. Nothing here has been reviewed by a scholar, nothing is published, no one has signed anything off.**
It is English only (Arabic and Urdu are for translators). It was written from the Quran text in `content/quran` (Tanzil Uthmani) in
the drafter's own words; no published translation was quoted and no tafsir, hadith or later tradition was used for the story texts.
The drafter's reading of the Arabic is a reading; verifying it is the reviewers' job (see the checklist).

## The workflow

1. **Draft** (`content/stories/<slug>.draft.json`, by a drafter or an assistant). `pnpm check:drafts` must be clean.
2. **Scholarly review of the file** (before import): a scholar reads each chapter against the cited ayat, using the checklist below, and
   records findings as comments in the pull request or as edits to the draft. The drafter fixes and re-runs the check.
3. **Import as draft** (`pnpm import:drafts` is a dry run; `--db` writes draft rows; the service-role key comes from the environment of
   whoever runs it). Imported rows are `draft` and invisible to readers. Importing is not publication and is not review.
4. **Review in the platform** (existing flow, unchanged): editors check claims and references in `/admin/stories`; a scholarly
   reviewer approves each claim and then the chapter (`/admin/review`); the database refuses to publish a chapter or a story without
   an approved review of the exact version, without approved claims, or with an open re-review flag; nobody reviews their own work.
5. **Translation and language review** (EN reviewed first, then AR and UR) and media review follow the same gates (`docs/STORY_COVERAGE.md`).
6. **Publication** happens only after all of the above, by the existing publish action. Nothing in this branch publishes anything.

A re-import after a scholar's edit is safe: only draft rows are changed; reviewed or published rows are skipped and reported.

## How a chapter is built (so reviewers know what to look for)

- `claims` are the sentence-level statements of what the verses say, each with its Quran references. Every sentence of the summary,
  complete story, deep study, kids text and lessons carries a claim marker (`[c3]`), so a reviewer can follow any sentence to the
  verses behind it. The markers are removed from the stored text on import; the claim ids are kept.
- The modes restate the same claims. They never add a fact. Kids mode, summary and lessons may not introduce a name or a number that no
  claim contains (checked mechanically).
- `lessons_md` is always labelled *Educational interpretation (not scripture)*, and no lesson promises a worldly outcome.
- `unknowns_md` lists what the verses do **not** say (ages, places, names, sizes, numbers, order). Traditional identifications appear
  only there, in a sentence that says *Named in later tradition, not in the Quranic text*.
- Chapters are a reading order, **not** a chronology the Quran claims. For Adam and Nuh, passages from several surahs are grouped by
  theme; for Yusuf, one surah tells the story in order, so the chapters follow it.

## Review checklist for scholars (per chapter)

1. **Verses.** Do the listed verses really contain what each claim says? Is any claim stronger than its ayat (a word added, a
   tense or pronoun resolved that the Arabic leaves open)? Check every claim's verse range, not only the chapter's.
2. **Pronouns and speakers.** Where the Arabic does not name a speaker or the referent of a pronoun, the draft says so (for example
   12:52-53, 12:42, 12:28-29, 12:95, 2:36 "from it"). Confirm the wording or choose another.
3. **Words with more than one reading** (`khalifah`, `tannur`, `dusur`, `waqar`, `hamma` in 12:24, `tawaffani` in 12:101, `rabbi` in
   12:23). The draft leaves several of these open. Decide how the page should word each.
4. **Omissions.** Does the chapter leave out something the verses say that readers need? (Known omissions are listed in the
   uncertainties of each file, for example 12:1-3, 12:102-111, 11:35, 11:49, 15:27, 15:41.)
5. **No added facts.** Anything not in the cited ayat: a name, a number, a place, a reason, an emotion, a sequence? Chapter
   order and grouping are a reading order; is any sentence implying a chronology the Quran does not give?
6. **No depiction.** No description of the appearance of any prophet, angel or jinn; no dress; nothing a picture could be drawn from.
7. **Theology and etiquette.** Wording about prophets (for example the "slip" in Adam's chapter, 12:24, the placing of the cup in
   12:70-76) is cautious and gives no verdict; confirm that is acceptable or amend it. No legal or medical ruling anywhere.
8. **Kids mode** is simple but still only restates the claims. Is anything frightening or misleading for a child?
9. **Lessons** are marked as interpretation and are modest. Could any be read as scripture or as a promise?
10. **Unknowns and tradition.** Every "Named in later tradition" line is accurate and used only as a label; add the hadith that should
    be linked later (each with a named grader) to the "Hadith to add later" entry rather than into the text.
11. **Titles and honorifics.** The drafts write the bare name; honorifics are added when the page is rendered. `title_ar` is only the
    well-known Arabic name.
12. **Sign-off.** Record the reviewer's name, the version reviewed and the decision in the platform review flow, not in the file.

## What reviewers should look at first

The claims where the drafter had to choose between readings are listed in the report that accompanied the branch and at the top of
each file's `uncertainties_en`. In short: 12:24, 12:52-53, 12:42, 12:23, 12:70-76, 12:99-100, 12:101, 2:30, 2:36, 11:46, 11:40,
54:13, 71:13, 71:25 and the claim that 15:28-29 / 38:71-72 describe the same event as the prostration to Adam.

## Known limits

- The validator is a gate against common mistakes, not a proof of accuracy.
- Story-level `uncertainties_en` has no database column; it stays in the file and in this document.
- Importing links the story to its inventory event when the event row exists; nothing else is derived.
- The importer has been tested against PGlite with the real migrations (`tests/db/story-drafts.test.ts`); it has **not** been run
  against any Supabase project.
