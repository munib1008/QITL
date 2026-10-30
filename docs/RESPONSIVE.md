# Responsive design system and mobile test report

Last updated 2026-10-31. Covers the mobile-first pass over the whole site. Screenshots (WebP): `docs/responsive/before/` and
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

## Automated tests

| Suite | What it checks |
|---|---|
| `tests/e2e/responsive.spec.ts` | 31 routes × English and Arabic × 320, 360, 414, 768, 1024, 1440 px: HTTP status, no sideways page scroll (and names the elements that overflow), no control under 24×24 px at phone widths, nothing hidden behind the bottom bar. `SHOTS=after` saves screenshots; `AUDIT=1` writes a register instead of failing. |
| `tests/e2e/mobile.spec.ts` | 360px interactions: bottom navigation (labels, 44px targets, current page, hidden on desktop), Explore sheet focus handling, footer clearance, timeline stop expansion and story link, jump-to-era and progress, chapter next / previous / resume, Arabic RTL with axe, axe with the sheet open. |
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

- **Atlas pinch-zoom/pan**: the atlas map is a schematic SVG drawn from database geometry. Browser pinch-zoom works, and the
  text list of places is the accessible alternative. A dedicated zoom/pan control with a bottom-sheet place panel is not built.
- **Genealogy pan/zoom and focus mode**: the graph centres on a chosen person and has a list view; no gesture zoom yet.
- **Admin on mobile**: the admin pages pass the overflow and target checks, but tables are not yet converted to cards.
- **Learn Quranic Arabic**: `/learn` describes the lesson system; its lessons need the licensed word-by-word corpus and reviewed
  lessons, so no lesson content is shown.
- **Real-device testing** has not been done; all results here are from Playwright (Chromium) emulation.
- **Performance**: see "Performance measurements" below for what was measured. No improvement is claimed without a number.
