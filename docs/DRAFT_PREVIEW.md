# Draft preview (`/drafts`): staff note

Decision of the owner, 2026-11-01: unreviewed AI-written story drafts may be shown publicly **only** as a clearly separate
"Draft preview", never mixed with reviewed knowledge, with the review status kept **pending**.

## What it is

- `/drafts` (list, grouped by type, `?type=` filter, optional `?q=` search) and `/drafts/<slug>` (the draft), in English, Arabic
  and Urdu chrome. The draft text itself is English and marked `lang="en"` inside Arabic and Urdu pages.
- Data: `src/generated/story-drafts.json`, written from `content/stories/*.draft.json` by `pnpm drafts:index`
  (`scripts/build-draft-index.ts`). The pages import that file at build time; they never read `content/stories`, never touch the
  database and write nothing. Only drafts without validator errors are included; the file holds only what the pages show
  (including the Arabic of the cited ayat, verbatim from `content/quran`).
- Every page carries a banner that cannot be dismissed: "Draft preview — review pending. Written by an AI assistant from the
  Quran text and checked only by automated rules; NOT yet reviewed by a scholar." (AR and UR in `src/lib/i18n/modules/draftPreview.ts`.)
- Each draft has an "AI pre-review" (counts from the validator at index time, the rules with no finding) and the scholars' 12-point
  checklist, **unchecked**. The status is "Pending"; there is never an approval, a reviewer name or a date.
- Kept out of: the sitemap, Explore, the home page and the unified search. Robots: `noindex, nofollow` in the page metadata and in
  an `X-Robots-Tag` header (`next.config.ts`). One discreet link each from the About page and the empty `/stories` list.

## What staff must do

1. **After adding or changing a draft** (or `docs/STORY_DRAFTS.md`'s checklist): `pnpm check:drafts`, then `pnpm drafts:index`, and
   commit `src/generated/story-drafts.json` with the change. `tests/unit/draft-preview.test.ts` fails while the committed index is
   stale (`pnpm drafts:index --check` does the same from the shell). After merging several draft branches, run it once more.
2. **The preview is not publication.** To publish a story it must still go through the normal route, unchanged:
   `pnpm import:drafts --db` (draft rows) → editors check claims in `/admin/stories` → scholarly review in `/admin/review`
   (claims, then each chapter, by someone who is not the author) → publish. The database refuses to publish without an approved
   review of the exact version. Showing a draft in `/drafts` records nothing in `editorial_reviews` and does not change any status.
3. When a story is published, remove or keep its draft file as you see fit; the preview lists whatever is in `content/stories`.
   If a published story should no longer appear as a draft, delete its `.draft.json` and re-run `pnpm drafts:index`.
4. Never reword the banner to suggest review, accuracy or approval. The unit test refuses "reviewed", "verified" and "authentic"
   (English) and their Arabic and Urdu equivalents in the interface strings, except the negated "NOT yet reviewed".

## Limits

- A single JSON file holds all drafts (about 0.8 MB for seven drafts). With ~160 drafts it may reach several MB; if so split it per
  story (the page code reads it through `src/lib/stories/draft-data.ts` only).
- `robots.txt` still allows `/drafts` so crawlers can see the `noindex`; blocking the path would not stop indexing of the URL.
