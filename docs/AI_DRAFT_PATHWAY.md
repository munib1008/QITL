# AI-draft pathway

Status: database layer built, applied to the live project and tested (`tests/db/ai-draft.test.ts`, 9 tests). The public
pages for database AI drafts, the Knowledge Production Studio, workers and the in-place reviewer editor are NOT built
yet (see "Not built" below).

## Three separate facts per story (`stories`)

| Field | Values | Set by |
|---|---|---|
| `visibility` | private_draft, public_ai_draft, public_approved, archived | `publish_ai_draft`, `withdraw_ai_draft`; `public_approved` only with `status = 'published'` |
| `integrity_status` | pending, passed, failed, needs_investigation | ONLY `run_ai_draft_integrity` (a direct update to `passed` is refused) |
| `scholarly_status` | not_reviewed, under_review, changes_requested, approved, rejected, invalidated | `approved` needs a real approving `editorial_reviews` row for the story; an edit after approval becomes `invalidated` |

The existing publish guards (`status = 'published'`: version-bound scholarly approval, no self-review) are unchanged.

## What the integrity check proves (deterministic, in `compute_ai_draft_integrity`)

Chapters exist and have text; every chapter carries a claim; every claim has a source reference; every Quran reference
points at a verse present in the loaded Quran text; hadith references have a record and a grading (otherwise
`needs_investigation`); no quoted-dialogue pattern. It does NOT judge religious interpretation. A pass means "sources
exist and match", never "a scholar agrees".

## Reading

Anonymous readers get an AI draft only through `public_ai_drafts()` and `public_ai_draft(slug)` (security definer; the
tables stay closed). Both return `scholarly_status` so the page can show "AI Draft — Under Review" and never a verified
badge. Editing a chapter or story title sends a public AI draft back to private and `pending`.

## Live state (2026-11-02)

159 imported story drafts marked `ai_generated`, all passed the integrity check; none made public in the database yet
(the file-based `/drafts` preview is the public surface today).

## Not built

Public pages reading these functions, the AI Knowledge Production Studio and durable workers, the reviewer rich-text
editor with inline comments and immutable revisions UI, the editorial-assistant actions, and the admin metrics.
