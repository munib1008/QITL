# Redesign: implementation and audit

Branch `feat/asma-dial` (the redesign foundation plus the Names of Allah dial, on top of `feat/asma-al-husna`).
Everything below was verified on a production build (`pnpm build`) with the Playwright e2e fixtures, Chromium, English, Arabic and Urdu.

## What changed

| Area | Change | Files |
|---|---|---|
| Theme | One light theme. `dark` and `journey` collapse to the same values; `<html data-theme="light">` is fixed; the theme toggle and the prefers-color-scheme paths are inert. | `design/tokens/tokens.json`, `src/app/[locale]/layout.tsx`, `src/components/shell/{SiteHeader,toggles}.tsx` |
| Type | One interface typeface, Inter, for display, interface and numbers. Scripture keeps its own Arabic faces (Amiri Quran, Naskh); IBM Plex Sans Arabic is the Arabic UI face. | `src/app/fonts.ts`, `scripts/build-tokens.ts` |
| Depth | Soft elevation tokens (`shadow-raised*`, `shadow-inset`), applied to cards, buttons, inputs, chips. | `tokens.json`, `src/styles/components.css`, `timeline.css` |
| Home | Journey dial: a tick per stop, a hand, live search, auto-play that never starts under reduced motion. | `src/components/journey/JourneyDial.tsx`, `src/app/[locale]/page.tsx` |
| Timeline | When nothing reviewed is published (or `?draft=1`): a scroll story with a sticky era stage, seven category filters with depth badges, hover preview and pinned focus card, and the future signs. | `src/components/redesign/EraScrollTimeline.tsx`, `src/app/[locale]/timeline/page.tsx` |
| Last Hour | Ten major signs and two related entries as labelled draft content: no date, no countdown, order not stated, hadith numbers `No. —`. | `src/components/redesign/DraftLastHour.tsx`, `content/last-hour/signs.draft.json` |
| Lineage | Adam to Muhammad ﷺ as a scroll-lit line. Unknown stretches are gaps with no names; links are drawn by source (solid, dashed, dotted). | `src/components/redesign/LineageLine.tsx`, `content/lineage/lineage.draft.json` |
| Names of Allah | A dial of the Names in the educational list with a labelled range input, AI-draft marker, link to each Name page. Counts what it shows; claims no total. | `src/components/asma/NamesDial.tsx`, `src/content/asmaDial.ts`, `src/app/[locale]/asma/page.tsx` |
| Content layer | Typed, validated loaders for the draft content. A schema error fails the build. | `src/content/draftAtlas.ts` |
| Strings | `modules/redesign.ts`, English plus Arabic and Urdu drafts (registered in `registry.ts`; the coverage test enforces them). | `src/lib/i18n/modules/redesign.ts` |
| Wiring | `?draft=1` on `/timeline?view=complete` and `/lineage` forces the draft view (fixtures otherwise win in e2e); `/lineage` and `/asma` added to the sitemap; routes added to the crawl list. | `src/app/sitemap.ts`, `tests/e2e/routes.ts` |

## Audit findings, all fixed

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Dimmed states (`opacity: .55` on off chips, `.25` on filtered lineage rows) failed WCAG colour contrast (axe `color-contrast`). | High | Dimming now uses the inset shadow and muted ink on the sunken surface; text keeps 4.5:1. |
| 2 | The "Read the signs in full" link was under the 24px target size (axe `target-size`). | Medium | `.rd-link` gives it a 44px target. |
| 3 | On narrow screens the focus card changed height with the scroll position, which moved the page under the reading line, which changed the card again: a scroll feedback loop (the filter chip never became "stable"). | High | Fixed card heights below 860px and `overflow-anchor: none`; verified 18/18 over three repeats. |
| 4 | The home logo wordmark was drawn for the old dark journey theme and read as pale-on-pale. | Medium | Light tone in the header; the dark-variant selectors for the removed themes are gone from `pages.css`. |
| 5 | A system dark preference could have mixed dark values from `lineage.css` with the light page. | Medium | `data-theme="light"` is fixed on `<html>`, so `:root:not([data-theme])` never matches. |
| 6 | After merging `origin/main`, the new numbered home index and the progress line used `--glow-gold` / `--glow-emerald` as text colour; on the light surface that was 3.4:1 (axe `color-contrast`). | High | Both tokens are now the text-safe teal `#1f6670` (5.8:1). |
| 7 | The 29 dial ticks were 16px buttons (below the repo's 24px target rule, and overlapping on diagonals at phone width); the Names dial had 99 of them. | High | Ticks are decorative. The dial is driven by a labelled range input, Previous, Next and Auto-play (keyboard and assistive technology); a click on the ring picks the nearest stop for pointer users. |
| 8 | `csp.spec.ts` tested the removed pre-paint theme script. | Low | Replaced by a test that a stored dark choice or a dark system preference never changes the page. |

## Verification

- Unit and component tests: 75 files, 1605 tests, all passing (run on the merged branch before the final dial change; the changed tests were re-run) (includes new `draft-atlas`, `redesign-ui`, i18n coverage, contrast tests).
- Type check and lint: clean for every file changed in this branch. The remaining ESLint warnings are in test files this branch does not touch.
- E2E: `tests/e2e/redesign.spec.ts` (five scenarios in en, ar, ur at 390px and 1440px: dial, timeline filter, lineage, Last Hour, Names dial; axe WCAG 2.2 AA; no sideways scroll; no dated future signs), plus the existing `pages`, `event-universe`, `lineage`, `journey` and `asma` specs.

## Content-rule compliance (CLAUDE.md)

| Rule | State |
|---|---|
| No fabricated religious content | Titles, refs and Names come from the repo's own inventory and registry. The ten signs and the lineage are labelled DRAFT. |
| Hadith numbers | Every hadith source reads `No. —` until a reviewer pins it (`draft-atlas.test.ts` enforces it). |
| Dates | Only the dated milestones carry a date, labelled exact, traditional or estimate. Parables are never placed. The future has no date and no countdown (e2e checks the text). |
| Lineage | Gaps are shown as gaps; no count or names are invented. Names from Adnan to the Prophet ﷺ are the classical sira and are flagged for pinning to Ibn Hisham. |
| No depiction | Icons are geometric marks only. |
| Names of Allah | The dial states no total and the page keeps the recognition note; the list is the AI-draft registry. |

## Open items for the review board and operations

1. Scholarly review of `content/last-hour/signs.draft.json`, `content/lineage/lineage.draft.json` and `content/events/placement.draft.json`; hadith numbers to pin.
2. Arabic and Urdu strings in `modules/redesign.ts` are drafts and need a qualified translator.
3. The Asma schema migration `20261031002900_asma_al_husna.sql` is in the repo but must be applied by operations; until then the Names pages show the not-connected state and the dial uses the draft registry.
4. Visual regression baselines (`tests/e2e/visual.spec.ts-snapshots`) are Windows images and are skipped on Linux; they are now stale and must be regenerated on the CI image (`pnpm test:visual --update-snapshots`).
5. The home page's journey section (`JourneyTimeline`) still has its glass styling; it renders on the light surface but has not been redrawn.
