# Platform audit (2026-10-31)

Audit of the repository against the agreed specifications, done by reading the code and running the tests. It replaces the
statements in `docs/IMPLEMENTATION_STATUS.md` that had gone stale; per-feature status is in
`docs/FEATURE_ACCEPTANCE_MATRIX.md`, open work in `docs/MASTER_COMPLETION_BACKLOG.md`.

## Inventory (at `bb01e69`, before the final batch of merges)

81 pages, 66 API routes, 30 migrations (now 35+), 41 test files, 97 component files. Production: https://qitl.vercel.app
(Vercel, deployed from `munib1008/QITL` main); database: Supabase project `supabase-crimson-anchor`, every migration applied.

## Baseline before changes (measured)

| Check | Result |
|---|---|
| `tsc --noEmit`, `eslint src tests` | clean |
| Unit and database tests (Vitest) | 387 passed |
| `next build` | compiled |
| Playwright (desktop 1440 + mobile 390 projects) | 403 passed, 3 failed, 194 skipped (skips: desktop-only specs in the mobile project) |

The three failures were: two in my own `ayah-highlight` spec (they checked for the glow after the page had loaded, so a slow
load hid it) and one study-panel layout test that needed its animation to finish. All three were test weaknesses under heavy
machine load, not product defects; they were rewritten to record the glow when it is applied and to measure after animations,
and they pass alone.

## Findings and what was done

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | Desktop header listed only 10 sections; the newer modules were reachable on phones only. The home page's three section cards were labelled "Coming soon". | High | One list of sections (`src/lib/nav.ts`) now feeds the phone Explore sheet, a new desktop "Explore" menu and the home grid |
| 2 | Active documents still said ZIQ and listed seven hadith collections, against the four-collection evidence policy | Medium | README, editorial policy and screen specification corrected; historical ZIQ documents kept unchanged under a "Historical document" notice |
| 3 | `docs/IMPLEMENTATION_STATUS.md` said features were "not built yet" that are live | Medium | Section marked superseded; matrix and backlog added |
| 4 | Security guard tests (added by the security work) failed on migrations merged after it: `search_sources` RLS not forced; `media_asset_status()` readable by anon; `media_file` reviews had no author registration (a reviewer could review their own upload) | High | Migration `20261031002500` fixes all three; applied to Supabase; tests pass |
| 5 | Vercel production builds failed on `next/font/google` for two fonts (not reproducible locally because of a font cache) | High | The two fonts are self-hosted (OFL files stored beside them) |
| 6 | Nonce-based CSP makes every page render per request | Medium (trade-off) | Accepted for the stronger policy; documented in `docs/SECURITY.md`. Watch hosting cost and time-to-first-byte |
| 7 | Dream requests were never deleted after their retention date | High (privacy) | pg_cron job scheduled in production (verified: 2 `qitl-` jobs) |
| 8 | Self-approval was possible across modules for a user holding both editor and reviewer roles | High | Registry-driven no-self-review trigger, author stamping; tests enforce registration of every new reviewed table |

## Verification limits (said plainly)

- Playwright runs were executed against `next start` on this machine with several builds running at once. Several specs timed
  out only under that load and passed when run alone; a clean full run on a quiet machine has not been recorded.
- No test has run against a live Supabase project with real users: sign-in, signed-in progress sync, uploads to Storage, the
  Lara and TTS integrations and the malware scanner were exercised only through their not-configured paths and database tests.
- Responsive and accessibility checks use Playwright emulation and axe, not real devices or a screen reader.
- Lighthouse numbers are in `docs/RESPONSIVE.md`; they were taken on a shared machine and are indicative only.
