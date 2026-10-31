# Editorial policy and licence register

## Editorial policy

1. **No evidence, no publish.** Every religious claim rests on cited evidence: an ayah, a narration with its named grading, or a named scholar's work with a locator. The database refuses to publish otherwise.
2. **Two people, two roles.** An editor drafts; a scholarly reviewer approves. A reviewer never approves their own claim. Reviewers are listed on the review board only after an admin has verified their identity and credentials by hand.
3. **Say how sure.** Every claim, date, place and family link carries one of six evidence labels: Quran, authentic hadith, scholarly interpretation, historical estimate, disputed, unknown. "This is not known" is a valid answer.
4. **Show disagreement.** When gradings or positions differ, all of them are shown with their sources. Nothing is collapsed into a single badge.
5. **No invention.** No dates for undated sacred history, no years for the Last Hour, no pins for unlocated places, no generations that the sources do not give, no "last descendant".
6. **No depictions** of prophets, Companions or the Ahl al-Bayt. Geometry, calligraphy and maps only.
7. **No rulings.** QITL does not issue fatwas, and nothing produced by software is published as verified knowledge.
8. **Corrections are public.** Accepted corrections go through review again and carry a public revision note; earlier versions are kept.
9. **Drafts say so.** Unreviewed content is labelled "Draft — pending scholarly review". Demo fixtures are labelled DEMO and contain placeholders, never invented text.

## Licence register

Status of every external source the app uses or plans to use. Nothing is shown to readers until its row says **cleared** (or public domain), and the database enforces this for translations, tafsir and hadith text.

| Source | Use | Licence | Status | Notes |
|---|---|---|---|---|
| Tanzil Quran Text (Uthmani) | Quran Arabic | Creative Commons Attribution 3.0, verbatim copying only, with attribution and link to tanzil.net | **Not imported yet** | Run `scripts/import-quran.ts --pin` after reading the current terms; then the Arabic appears everywhere it is cited |
| Quran translations (any) | Translation beside the Arabic | Per edition | **Not cleared** | UI shows "Translation unavailable — licence pending" |
| Tafsir (any) | Scholarly interpretation | Per work | **Not cleared** | |
| Hadith collections and translations (four collections: Bukhari, Muslim, Tirmidhi, Ibn Majah; see docs/LICENSING.md) | Narrations, numbering, translations | Per edition | **Not cleared** | Catalogue names only are in the database |
| Hadith gradings | Per-narration grades by named scholars | Per work cited | **Not cleared** | |
| Map tiles | Atlas base map | Per provider | **Not configured** | Map stays off until a provider and attribution are set |
| Source Serif 4, IBM Plex Sans, IBM Plex Sans Arabic, IBM Plex Mono, Amiri, Amiri Quran, Noto Naskh Arabic | Typography | SIL Open Font License 1.1 | **Cleared** | Self-hosted by `next/font` at build time |
| Journey content (`content/journey/journey.draft.json`) | Home journey and prophet pages | QITL's own | **Draft** | Pending scholarly review; every ayah range and hadith number to be verified against pinned editions |
| maplibre-gl | Map rendering | BSD-3-Clause | **Cleared** | |

To clear a source: add it in **Editorial → Sources and licences**, record the licence URL and text, verify the edition and checksum, then set rights to `cleared`.
