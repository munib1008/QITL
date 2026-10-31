# Responsive design system and mobile test report

Last updated 2026-10-31. Covers the mobile-first pass over the whole site and the follow-up for the atlas, genealogy and admin. Screenshots (WebP): `docs/responsive/before/` and
`docs/responsive/after/` (English and Arabic, at 360, 768 and 1440 px, for every route below).

## Breakpoints and tokens

Layouts are fluid (grid, flex, `clamp()`); no layout targets a phone model. The tokens live in `src/styles/mobile.css`:

| Token | Value | Use |
|---|---|---|
| `--gutter` | `clamp(16px, 4vw, 40px)` | page side padding |
| `--content-max` | 1200px, 1360px at 1600px and up | page width |
| `--reading-max` | 72ch | prose measure |
| `--tap` | 44px | minimum height/width of primary controls |
| `--bottom-nav-h` | 64px (+ `env(safe-area-inset-bottom)`) | bottom bar, reserved as body padding |
| `--fs-h1`, `--fs-h2`, `--fs-body`, `--fs-ar-verse` | `clamp()` scales | headings, body, Quranic Arabic |

| Range | Behaviour |
|---|---|
| 320–600px | single column; bottom navigation; compact sticky header (logo, search, theme, language, menu); glass blur dropped for performance (tint kept); footer links 44px tall |
| 601–1023px | adaptive columns where content allows; bottom navigation stays |
| 1024px and up | full header with section links; no bottom bar; two-column reading pages with sticky side panels |
| 1600px and up | wider content cap |

Portrait and landscape both use the same fluid rules. `viewport-fit=cover` plus `env(safe-area-inset-bottom)` keeps the
bottom bar clear of the home indicator on notched phones.

## Navigation

- **Bottom navigation** (`src/components/shell/BottomNav.tsx`) under 1024px: Home, Timeline, Quran, Explore, Profile, each an
  icon with a visible label and `aria-current` on the current destination. The body reserves its height, so it never covers
  content (tested: the last footer link ends above it).
- **Explore** opens a bottom sheet: a modal dialog with focus moved in, Tab trapped, Esc / backdrop to close and focus returned
  to the button. It lists prophets, stories, events, hadith, atlas, genealogy, Last Hour, community (discussion and Mufti Q&A),
  Learn Quranic Arabic and search.
- **Profile** goes to the account when signed in, otherwise to sign-in with `returnTo` set to the current page.
- Desktop keeps the full header navigation unchanged.

## Timeline (signature feature)

- Single column with the spine on the start side (left in English, right in Arabic, via logical properties); no alternating sides.
- Each stop is a native disclosure (`<details>`): tapping opens its card **in place** with summary, date and its certainty,
  place and its certainty, Quran citations, Read the story and Show on the atlas. It works without JavaScript. Before this pass
  the selected card rendered below the entire list on phones, out of view.
- A sticky bar shows the chapter (era) in view, a jump-to-era menu and a progress bar. The stop crossing the middle of the screen
  is highlighted. Stops fade in as they arrive.
- Intersection Observer only, native scrolling, no scroll hijacking. Reduced motion, Save-Data and low-core devices get no
  reveal animation.

## Story pages

- `ChapterNav` (sticky): "Chapter n of N", previous / next chapter (44px buttons, focus moves to the chapter heading), a progress
  bar and **Resume reading**. The resume point is kept in this browser only; signed-in progress belongs to the account.
- Prophet pages use it over Full story, Outline, Quran, Sunnah, Places, Discussion. Event pages use it over the A–G sections of
  the story.
- Source citations and review status are never collapsed away.

## Quran reader

- Arabic size control (24–48px, remembered); full-width verses; 44px ayah actions.
- Previous / next surah navigation with surah names.
- The Arabic text itself is still not imported (see blockers in `docs/IMPLEMENTATION_STATUS.md`). Word-by-word data, tafsir and
  translations need licences.

## Atlas

- The map column comes first on phones and tablets; the text list of places (grouped by certainty) stays on the page as the
  accessible alternative.
- Without a tile provider the atlas shows a **schematic** (`src/components/atlas/AtlasSchematic.tsx`): left to right (right to left
  in Arabic) is journey order and each row is how certain the place is (verified place, approximate region, historical hypothesis,
  disputed location). It says on screen and in each place panel that no position is a geographic coordinate. Unknown places are
  listed under the drawing, never drawn. No coordinate is invented. With a tile provider configured, the MapLibre map is used as before.
- Touch pan (one finger), pinch-zoom (two fingers), mouse drag, ctrl/trackpad-pinch wheel, arrow keys and +/-/0 on the focused
  drawing, plus 44px **Zoom in / Zoom out / Reset view** buttons stacked in the inline-end top corner of the drawing with a polite
  live announcement of the zoom level. A plain wheel still scrolls the page. A press that moved is never treated as a tap.
- Tapping a place opens a **place sheet** (`src/components/ui/Sheet.tsx`, native modal `<dialog>`): a bottom sheet that sits above the
  bottom navigation on phones and tablets, a side panel on desktop. Focus moves to its title, Esc / Close / the backdrop close it and
  focus returns to the place that opened it. The grip expands it to near full height and shrinks it again, by drag or as a button
  (`aria-expanded`); dragging the half sheet down closes it. It keeps the certainty label in words, lists other stops at the same place
  and links to the story and to the timeline.
- The legend is a disclosure, collapsed on phones and tablets and open on desktop.
- Opened from a story (`/atlas?focus=<id>`, e.g. "Show on the atlas"), the page offers **Return to the story of …** and centres and rings
  that stop in the drawing.

## Genealogy explorer

- `src/components/genealogy/GenealogyExplorer.tsx` draws the reviewed graph from the `person_graph` RPC: parents above, children below,
  spouses and siblings beside (generations come only from the edges given; nothing is inferred).
- Same pan/zoom controls as the atlas. At 360px it opens at 100% scale centred on the chosen person, so names stay readable and the
  rest of the graph is reached by panning instead of being squeezed onto the screen.
- **Focus mode**: tapping (or Enter/Space on) a person selects them; a panel lists their direct links with the relation and the line's
  certainty in words, can show only their direct links, and links to re-centre the graph on them when they are a prophet with a page.
- **Branches**: any person's branch can be collapsed and expanded (`aria-expanded`); a collapsed person shows "+n hidden below".
- Established (sourced) lines are solid, disputed lines double (and labelled "disputed"), unknown links dotted (labelled "unknown");
  competing lines are all shown and say so. The relationship list below stays as the text alternative.
- Without a database the page still says so. For the browser tests only, `QITL_E2E_FIXTURES=1` (set by `playwright.config.ts`)
  supplies a synthetic graph of "Test" people when Supabase is not configured; the page then shows a banner saying they are not real
  relationships (`src/lib/e2e-fixtures.ts`).

## Admin on phones

- The editorial navigation is a collapsible "Editorial menu" (native disclosure naming the current page) under 1024px; the side
  column from 1024px. Links, buttons, inputs and selects are 44px tall under 1024px.
- The sources, roles and audit tables become **cards** at 600px and below (each cell labelled with its column); the version diff stays a
  table inside a focusable, labelled horizontal-scroll region (`.zq-table-scroll`).
- The story editor and the new-event form have **Full-screen editing** on phones and tablets: the same form, lifted into a full-screen
  view with a sticky title bar and Done (Esc also leaves; focus returns to the button). Only layout changes: every save, review and
  approval step is the same component and the same API call.

## Automated tests

| Suite | What it checks |
|---|---|
| `tests/e2e/responsive.spec.ts` | 31 routes × English and Arabic × 320, 360, 414, 768, 1024, 1440 px: HTTP status, no sideways page scroll (and names the elements that overflow), no control under 24×24 px at phone widths, nothing hidden behind the bottom bar. `SHOTS=after` saves screenshots; `AUDIT=1` writes a register instead of failing. |
| `tests/e2e/mobile.spec.ts` | 360px interactions: bottom navigation (labels, 44px targets, current page, hidden on desktop), Explore sheet focus handling, footer clearance, timeline stop expansion and story link, jump-to-era and progress, chapter next / previous / resume, Arabic RTL with axe, axe with the sheet open. |
| `tests/e2e/explorers.spec.ts` | 360px: atlas zoom buttons (44px, not overlapping, clear of the bottom bar), touch pan and pinch, legend disclosure, unknown places listed not drawn; the place sheet (keyboard open, certainty in words, above the bottom bar, expand by button and shrink by drag, Esc returns focus, Close); Return to story; Arabic atlas order; genealogy focus mode, branch collapse/expand, distinct line styles, keyboard pan and selection (fixture graph); admin layout (real `/admin`, plus the admin markup with the site's real stylesheets: collapsible menu, table cards, 44px controls, full-screen editor). axe on each. |
| `tests/unit/explorers.test.tsx` | Pan/zoom maths, genealogy generations and branch collapse, explorer focus mode, atlas schematic (unknown places never drawn, zoom/reset), admin menu and full-screen editor. |
| `tests/e2e/journey.spec.ts`, `pages.spec.ts` | Run in both the desktop (1440) and mobile (Pixel 7, 390) projects, with axe on the main pages. |

### Issue register (audit before the fixes, 2026-10-31)

| # | Page | Width | Problem | Severity | Status |
|---|---|---|---|---|---|
| 1 | /prophets/nuh (and any prophet with a long place label) | 320–360 | page scrolled sideways 20–60px: no-wrap evidence label pushed the hero grid wider than the screen (EN and AR) | High | Fixed: hero column `min-width: 0`, evidence/era labels wrap under 600px |
| 2 | Every page footer | ≤ 414 | footer links 20px tall | Medium | Fixed: 44px rows on touch widths |
| 3 | /timeline | ≤ 1023 | selected stop's card rendered after the whole list, out of view | High | Fixed: cards open in place |
| 4 | All reading pages | ≤ 479 | "Accounts coming soon" pill crowded the header | Medium | Fixed: account moved to the bottom bar's Profile |
| 5 | All pages | ≤ 1023 | no persistent primary navigation; sections only through the menu | High | Fixed: bottom navigation and Explore sheet |
| 6 | Story pages | all | no chapter progress, next/previous or resume | Medium | Fixed: ChapterNav |
| 7 | /quran/[n] | all | no previous/next surah | Medium | Fixed |
| 8 | Page heads | ≤ 600 | 18px display-serif lead and 32px+ titles used most of the first screen | Low | Fixed: smaller on phones |

After the fixes the responsive sweep passes for all 62 route/locale runs at all six widths.

## Not done in this pass (honest list)

- **Atlas with real geography**: the pan/zoom, place sheet and legend work on the schematic. The geographic MapLibre map (only when a tile
  provider is configured) keeps MapLibre's own gestures and popups; it does not use the place sheet yet. No reviewed place geometries are
  published, so it has not been tried with data.
- **Admin tools with real data in the browser tests**: the admin tools need a signed-in editor and the database, which the e2e server
  does not have. The admin layout test therefore checks the real `/admin` page (not configured) and the admin markup rendered with the
  site's real stylesheets; the React components themselves are covered by unit tests. Review queue and moderation lists are already
  card-style lists, not tables.
- **Learn Quranic Arabic**: `/learn` describes the lesson system; its lessons need the licensed word-by-word corpus and reviewed
  lessons, so no lesson content is shown.
- **Real-device testing** has not been done; all results here are from Playwright (Chromium) emulation and Lighthouse's emulated phone.
- **Performance**: see "Performance measurements" below for what was measured. No improvement is claimed without a number.

## Performance measurements

Lighthouse 13.6.0, mobile form factor (Lighthouse's emulated Moto G Power, simulated slow 4G and 4x CPU slowdown), headless Chromium
156 (Playwright's `chrome-headless-shell`; the installed Chrome 155 failed every performance run with `NO_NAVSTART`), against
`next build` + `next start -p 3207` on the development PC, 2026-10-31. Three runs per page; the table gives the median and every run.
The PC was shared with other build and test jobs: Lighthouse's CPU benchmark index varied from 488 to 970 between runs, so differences
of this size between the two columns are mostly machine load, not the code. LCP is Lighthouse's simulated value; "observed" is the LCP
measured in the trace. CLS and TBT are as reported.

**Before** (branch base `feat/platform-foundation` 9748750):

| Page | Performance | Accessibility | LCP (observed) | CLS | TBT | Performance runs | CPU benchmark |
|---|---|---|---|---|---|---|---|
| `/` | 74 | 100 | 2.0 s (1.3 s) | 0 | 1,289 ms | 74 / 70 / 74 | 870 / 755 / 681 |
| `/timeline` | 79 | 99 | 1.4 s (1.1 s) | 0.002 | 588 ms | 79 / 75 / 85 | 726 / 672 / 728 |
| `/prophets/yusuf` | 72 | 100 | 2.2 s (2.5 s) | 0.031 | 946 ms | 78 / 62 / 72 | 602 / 542 / 617 |
| `/quran/1` | 86 | 100 | 1.3 s (0.7 s) | 0 | 502 ms | 87 / 86 / 83 | 711 / 681 / 620 |

**After** this pass:

| Page | Performance | Accessibility | LCP (observed) | CLS | TBT | Performance runs | CPU benchmark |
|---|---|---|---|---|---|---|---|
| `/` | 70 | 100 | 2.2 s (1.3 s) | 0 | 1,555 ms | 72 / 64 / 70 | 830 / 488 / 845 |
| `/timeline` | 79 | 100 | 3.3 s (1.1 s) | 0.002 | 524 ms | 79 / 85 / 75 | 636 / 813 / 559 |
| `/prophets/yusuf` | 90 | 100 | 1.6 s (0.8 s) | 0 | 366 ms | 90 / 92 / 90 | 842 / 885 / 838 |
| `/quran/1` | 98 | 100 | 1.1 s (0.6 s) | 0 | 151 ms | 95 / 98 / 99 | 731 / 832 / 970 |

What was found and changed:

- **Auth client loaded on every page.** Every page downloaded and ran a 55 KB chunk (93% unused; 130–220 ms of main-thread work in the
  traces) containing the Supabase auth client, even with Supabase not configured. Cause: the bottom bar's Profile link and the header
  account link prefetched `/sign-in` / `/account`, whose client code includes the auth client. Both links now use `prefetch={false}`
  (the session check in `useSession` was already lazy). After the change the chunk is not requested on any of the four pages (requests on
  `/`: 33 → 28). This is the only intentional performance change; the score differences above are within the load noise described.
- **Timeline accessibility 99 → 100**: the date legend's heading was an `h3` straight after the page's `h1`; it is now an `h2` styled the
  same.
- `/timeline` simulated LCP is bimodal (1.4 s or 3.0–3.6 s) in both columns (base run 2 was 3.6 s): it depends on whether Lighthouse's
  simulation chains the LCP paragraph to a web-font request. The observed LCP is about 1.1 s in both.
- Not fixed: `/` has the largest TBT (0.9–2.9 s). Its long tasks are the document's first style and layout pass (about 1 s at 4x
  slowdown) and hydration, not one script. Reducing it needs work on the home journey's markup and styles; it is left as a follow-up.
- The atlas schematic, genealogy explorer and their stylesheet load only on `/atlas` and `/genealogy` (route chunks of 4.5 KB each).
