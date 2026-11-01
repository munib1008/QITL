# Execution state (resume here)

Last updated: 2026-11-01. A new session reads this file first, then `docs/FEATURE_ACCEPTANCE_MATRIX.md` and `docs/MASTER_COMPLETION_BACKLOG.md`.
Do not re-audit what is marked verified below; re-run the checks instead.

## How work ships
- Source branch `feat/platform-foundation`; deploy with `git push qitl feat/platform-foundation:main` (Vercel builds https://qitl.vercel.app).
- Feature work happens in git worktrees under `.wt/<name>` on `mod/*` branches; the main session merges (`git merge --no-ff`), applies migrations to Supabase
  (project `upqyzcijlfbusadlgivf`, via `apply_migration` with the file's SQL; files marked `@supabase-only` are skipped by the local test database), tests, pushes, verifies.
- Checks before a push: `tsc --noEmit`, `eslint src tests scripts --quiet`, `vitest run --no-file-parallelism` (DB suites), `next build`
  (Playwright runs against `next start`: rebuild first), `pnpm check:drafts`. Re-run load-induced Playwright timeouts alone.
- Needs the owner (never do these yourself): costs, licences and permissions, `SUPABASE_SERVICE_ROLE_KEY`, Auth settings, first admin grant,
  appointing reviewers, publishing any religious content, irreversible production changes.

## Hard rules (unchanged)
Evidence only from the Quran, Sahih al-Bukhari, Sahih Muslim and individually graded sahih narrations of Tirmidhi/Ibn Majah. Never fabricate verses, hadith, dates,
names, lineage or citations. No depiction of prophets, angels, jinn. Unknown reads "Not established". Nothing AI-written or unreviewed is published. No medical claims or
dosages. Quran Arabic verbatim (Tanzil, credited). No scraping of unlicensed texts or audio. Secrets never in code.

## Applied to production Supabase (through)
Foundation to `20261031002500` (security follow-up), Shifa `002400/002410`, Event Universe `002450/002451`, media video `002510/002511`, hadith stories + people/communities +
typed search `002520/002521/002522`, story chapters + invalidation + coverage `002550/002551/002552`, inventory additions `002580`.
Unapplied (in repo/branches): none known after the last merge. People-admin added no migration.

## Status by priority area
| # | Area | State |
|---|---|---|
| 1 | Audit | Done: `docs/FINAL_PLATFORM_AUDIT.md`, `docs/STORY_ENCYCLOPEDIA_AUDIT.md` |
| 2 | Security and foundations | Built and tested (RLS forced, nonce CSP, review/no-self-review registry). Open: real-device and live-Supabase checks; `person_aliases` audit trigger and published-person freeze: migration 20261031002630 (branch `mod/perf-visual`, not yet applied) |
| 3 | Primary sources | Quran Arabic (Tanzil) imported; hadith/translation/tafsir structure built but EMPTY pending licences (`docs/LICENSING.md`, `docs/PERMISSION_REQUESTS.md`: emails drafted, not sent) |
| 4 | Multilingual UI | EN/AR/UR interface complete as DRAFT strings (translator review pending); reader preferences independent (interface/translation/narration) |
| 5 | Timeline and stories | Journey (29), Complete Timeline + Event Universe (159 draft items), chapters/depth modes, coverage dashboard, hadith stories, people/communities pages and admin: built. Content: 7 Quran-only story drafts in `content/stories` (validated, unreviewed, not imported); reading packs in `docs/review-packs` |
| 6 | Interactive learning | Story Player, narration plumbing, media library incl. video: built; no audio provider/licensed ambience; concept image/GIF packs are review-only (`design/concepts`, blocked from the site) |
| 7 | Specialised learning | Life Guidance, Shifa, dreams, Life Through the Ages: built, empty by design |
| 8 | User/scholar/admin tools | Mufti Q&A, CMS studios, review queues, people/communities admin: built; no admin user or reviewer exists yet |
| 9 | Verification | Last full Playwright run on a quiet machine: 792 passed / 4 failed (3 fixed, 1 load-flaky `i18n.spec.ts` hash test passes alone). Vitest 949+ pass |

## Next actions, in order
1. Owner: Supabase Auth URL settings; grant first `admin`; appoint scholarly + science reviewers; send permission emails; provide service-role key for `pnpm import:drafts --db`.
2. After 1: import the seven drafts as drafts (`pnpm import:drafts --db`), scholars review in `/admin/stories` using `docs/review-packs`.
3. Arabic/Urdu story text via the Story Studio translation job (Lara keys) and translator review; hadith entries after permissions; then remaining prophets, people, communities, hadith stories.
4. Quiet-machine full test run recorded in `PRODUCTION_READINESS.md`; counsel review of legal pages; backup/restore rehearsal.
5. Small follow-ups: Muhammad/Isa/Musa drafts need scholar attribution check; admin editor forms still English-only.

## Completion indicators (kept separate on purpose)
"Verified completion" means every agreed requirement passes its acceptance criteria. A working platform is not a finished one while content, approval and licences are missing, so
the indicators are NOT merged into one percentage. Derive them from records, not from this file:
| Indicator | Where it is measured | Now |
|---|---|---|
| Engineering | `tsc`, eslint, vitest, build, Playwright (last full run 792 passed), `docs/FEATURE_ACCEPTANCE_MATRIX.md` statuses | Built and verified in tests; live-Supabase and real-device checks outstanding |
| Content | `/admin/stories/coverage`, `/admin/events/coverage`, `docs/STORY_COVERAGE.md` (discovered / researched / reviewed / published kept apart) | Published: 0. Drafts: 7 stories, 159 event shells, 14 Shifa topics (titles only) |
| Scholarly approval | `editorial_reviews`, module review tables | 0 approvals; no reviewer appointed |
| Licensing | `/admin/licences`, `docs/LICENSING.md` | Tanzil Arabic cleared (conditional); every other text/audio source blocked or pending |
| Production readiness | `docs/PRODUCTION_READINESS.md` | Deployed; owner actions (Auth, admin, reviewers, legal review, backup rehearsal) pending |
