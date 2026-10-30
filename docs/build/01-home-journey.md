# Build brief 01 — App scaffold and the Home Journey

**For:** Claude Code. Read `CLAUDE.md` first.
**Goal:** a production-quality Next.js app whose home page matches `design/prototype/home.html`, built from typed components that follow `design/components/*.md`, with the Journey content loaded from `content/journey/journey.draft.json`.
**Out of scope:** Supabase, auth, the Quran and Hadith explorers, the atlas, admin. Their nav links go to "Coming soon" pages.

## Phase A — Scaffold

1. Create a Next.js App Router project in the repo root with TypeScript strict, Tailwind, ESLint, Prettier, Vitest with Testing Library, and Playwright. Use pnpm.
2. Generate typed tokens from `design/tokens/tokens.json` with a script (`scripts/build-tokens.ts`) that outputs:
   - `src/styles/tokens.css`, laid out like `design/tokens/tokens.css`, with `[data-theme]` blocks for light, dark and journey;
   - a Tailwind preset mapping colours, spacing, radii, shadows, z-index and font families to `var(--…)`.
   Add a test that fails if any token in the JSON is missing from the CSS.
3. Fonts: load Source Serif 4, IBM Plex Sans, IBM Plex Sans Arabic, Amiri Quran, Amiri, Noto Naskh Arabic and IBM Plex Mono through `next/font` (all OFL). Expose them as `--font-display`, `--font-sans`, `--font-quran`, `--font-naskh` and `--font-mono`.
4. Root layout:
   - `<html lang dir>` driven by locale (`en` now; `ar` scaffolded);
   - a skip link;
   - the theme attribute: the home route uses `data-theme="journey"`, other routes use light/dark from the system preference plus a toggle.

## Phase B — Primitives

Port from `design/reference/bundle.js` into `src/components/ui/*`. Each gets typed props (from `design/reference/index.d.ts`), every state in its spec, and a unit test:

- Button
- EvidenceLabel (the 6 kinds; word, mark and border must all render)
- CitationChip
- EditorialStatus
- EvidenceDrawer (dialog semantics, focus trap, Esc to close, focus returns to the trigger)
- Rosette

## Phase C — Journey

1. `src/content/journey.ts`: a Zod schema for `ziq.journey.v1` and a loader for `content/journey/journey.draft.json`. Fail the build on a schema error. The loader exposes `status: "draft"` so the UI shows the draft badge.
2. `ProphetJourneyCard`:
   - collapsed and expanded states;
   - prophet vs milestone variants;
   - era tag with its certainty mark;
   - age marker, related surahs with passage chips, sources list, place with certainty, evidence labels, disputed-order label;
   - "Explore story" and "View evidence" buttons.
3. `JourneyTimeline` (client component). Follow `design/components/JourneyTimeline.md` exactly:
   - filters: Complete journey / Prophets / Key events / Dated history;
   - container-query layouts at 860px and 1180px; the date shown opposite each card; the sticky rail and progress pill;
   - active stop by scroll position, with a 48px hysteresis and a 1.2s hold after any user action;
   - the progress line fills to the active node;
   - reveal only below the fold;
   - the evidence drawer rendered through a portal;
   - reduced-motion and reduced-transparency fallbacks.
4. The home page at `src/app/page.tsx` contains: Nav, Hero (Basmala from the verified Quran source, not retyped), the JourneyTimeline section, the end panel, feature cards ("Coming soon") and the footer. Use server components for everything except the timeline.
5. "Explore story" links to `/prophets/[id]`, which for now is a "Coming soon" page that shows the stop's data and draft badge.

## Phase D — Quality

- **SEO:** metadata, Open Graph card (geometric, no figures), a sitemap, and JSON-LD `WebSite`.
- **Performance:** home LCP under 2.5s on mid-tier mobile, no layout shift from fonts, total JS for the home page under 120 KB gzip, and `backdrop-filter` disabled on low-end devices via `@supports` plus `prefers-reduced-transparency`.
- **Accessibility:** the axe check has zero violations, and full keyboard traversal works: filters → rail → nodes → card buttons → drawer → back.

## Acceptance tests (Playwright)

1. The home page renders 29 journey stops in this order: Adam … Isa, Muhammad ﷺ, Birth, First revelation, Hijrah, Farewell Pilgrimage, Passing.
2. No stop before "Muhammad" shows a CE/BCE year, except those whose certainty is `estimate`, which are labelled "Historians' estimate".
3. "Key events" shows exactly 5 stops, and "Prophets" shows 24 (25 prophets with Musa & Harun shown together).
4. Clicking a node expands that card and collapses the previous one. The card does not collapse during the following 1.2s of scroll.
5. "View evidence" opens a dialog: focus moves to Close, Esc closes it, and focus returns to the button. At 390px it is a bottom sheet.
6. At 390px there is no horizontal scroll, the layout is a single column, and the progress pill is visible.
7. With `prefers-reduced-motion: reduce`, no element has a running CSS animation and all stops are visible without scrolling them into view.
8. Every expanded card shows at least one evidence label and one citation chip.
9. The draft badge is visible while the content `status` is `draft`.
10. A visual regression snapshot at 1440px and at 390px is within the threshold of the reference screenshots, which are generated from `design/prototype/home.html`.

## Definition of done

Lint, typecheck, unit, e2e and build all pass in CI (GitHub Actions). The PR description includes screenshots at 1440px and 390px and a checklist against this brief. Any deviation from the design is called out with its reason.
