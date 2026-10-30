# Responsive, RTL and accessibility

How QITL adapts from 320px phones to ultra-wide screens, how the Arabic interface and Arabic content blocks behave, and how the WCAG 2.2 AA target is met and checked. Token values are in [brand-and-tokens.md](brand-and-tokens.md); per-screen layouts in [screen-specifications.md](screen-specifications.md).

## Breakpoints

Design tokens (`bp-*`, mapped to Tailwind `sm/md/lg/xl`):

| Token | Value | Intent |
|---|---|---|
| `bp-sm` | 480px | Large phones: two-up chips, inline actions |
| `bp-md` | 768px | Side drawer replaces the bottom sheet; two-column card grids |
| `bp-lg` | 1024px | Persistent navigation; timeline and map split view |
| `bp-xl` | 1440px | Content maximum; beyond it the atlas and timeline may grow, text does not |

Media queries actually used in CSS:

| Query | File | Effect |
|---|---|---|
| `max-width: 479px` | `components.css`, `pages.css` | Timeline rows stack the evidence label under the title; header button labels hidden (`.zq-hide-sm`); header buttons compact |
| `max-width: 640px` | `prophet.css` | Header search becomes a Search link; prophet head becomes one column; position bar hides the era label |
| `max-width: 767px` | `components.css` | Evidence drawer becomes a bottom sheet (rounded top corners, max 85vh) |
| `max-width: 860px` / `min-width: 861px` | `home.css`, `pages.css` | Home nav links and "Begin exploring" hidden; facts stack; home mobile menu shown |
| `min-width: 1024px` | `pages.css`, `prophet.css` | Section link row shown and mobile menu hidden; `.zq-split` becomes 5fr / 7fr with a sticky side; prophet grid gets the 340px sticky side column (scrolls on its own); admin gets a 220px nav column |

Container queries (Journey only, on `.zq-jt` with `container-type: inline-size`):

| Container width | Layout |
|---|---|
| < 860px | One column; spine at the inline start (19px in); era pills indented 48px; rosette motif hidden in card heads; sticky "n / 29" progress pill (below the 72px glass header) |
| ≥ 860px | Line centred; three-column items (card · 56px node · card); cards alternate sides, max 520px; the empty side shows the era label and certainty ("date opposite"); reveal slides in from the card's side |
| ≥ 1180px | A 200px sticky "Your journey" rail (scrolls within `100vh − 96px`); the progress pill is hidden |

Container queries mean the Journey responds to the space it is given, not to the viewport, so it behaves the same inside a narrower column.

## Behaviour from 320px to ultra-wide

| Width | Shell | Reading pages | Home Journey | Drawer |
|---|---|---|---|---|
| 320–479 | Brand, Search link, theme and language buttons, account and menu buttons, labels hidden | One column; side columns stack under the main column; chip rows wrap or scroll sideways inside their own box (`minmax(0,1fr)` columns) | One column, pill visible | Bottom sheet |
| 480–639 | Button labels visible | Same | Same | Bottom sheet |
| 640–767 | Header search field visible | Prophet head two-column | Same | Bottom sheet |
| 768–859 | Same | Card grids auto-fill at 300px minimum | Same | Side drawer, max 440px |
| 860–1023 | Home nav links visible; reading pages still use the menu | Same | Alternating layout | Side drawer |
| 1024–1179 | Section row visible, menu hidden | Split views (timeline + card, atlas list + map), sticky side column | Alternating | Side drawer |
| 1180–1439 | Same | Same | Rail replaces pill | Side drawer |
| ≥ 1440 | Same | Content stops growing: reading pages cap at 1200px (`.pp-wrap`), Journey body at 1280px, prose at `measure-reading` (68ch), Arabic at `measure-arabic` (40em) | Centred at 1280px | Side drawer |

Guarantees: no horizontal page scroll at 320px (tested on four routes) and at 390px (home); `body { overflow-x: clip }` stops stray overflow from widening the page; grids use `minmax(0, 1fr)` or `min(100%, 300px)` so a long chip row cannot force width; tables sit in `.zq-tablewrap` for their own horizontal scroll.

Not yet built from the brief: the atlas growing beyond 1440px (its column is bounded by the 1200px page), a mobile bottom sheet for the timeline card, and the legend collapsing to a button on small screens.

## RTL

Screenshots of the Arabic interface: [Yusuf, 1440](screenshots/prophet-yusuf-ar-1440.png) and [Yusuf, 390](screenshots/prophet-yusuf-ar-390.png).

### How direction is set

| Level | Rule |
|---|---|
| Page | `<html lang dir>` from the locale segment: `/ar/...` or the `qitl-locale=ar` cookie → `lang="ar" dir="rtl"` |
| Arabic block inside English UI | Every Arabic name, honorific, surah name, Quran text and hadith text carries `lang="ar"`, and block-level Arabic also `dir="rtl"` (for example `<p class="zq-ar-quran" lang="ar" dir="rtl">`) |
| English inside the Arabic UI | Page copy that is still English inside the RTL shell keeps its punctuation in order through `[dir="rtl"] :is(p, h1, h2, h3, li, dd, blockquote) { unicode-bidi: plaintext; }` (`pages.css`): each paragraph takes its direction from its first strong character |
| References | `CitationChip` wraps the reference in `<span dir="ltr">`; reference inputs (compare ref, hadith number, comment citation, admin ids, polygon corners) set `dir="ltr"` |
| User text | `TextField` accepts `dir`; Arabic titles in admin forms use `dir="rtl" lang="ar"` |
| Arabic typography | `[lang="ar"] { letter-spacing: 0; text-transform: none; }` so eyebrows never uppercase or track Arabic; `arabic-ui` uses a 28px line height on 16px |

### Logical properties

All layout CSS uses logical properties so it mirrors automatically: `margin-inline-start`, `padding-inline-start`, `inset-inline-start/end`, `border-inline-start`, `text-align: start/end`. Examples: the Journey spine (`inset-inline-start: 19px`), the timeline spine and marks, the event-card track positions, the mobile menu (`inset-inline-end: 0`), the skip link, comment reply indentation (`marginInlineStart`), toast position (`insetInlineEnd`), the moderation quote border. The one physical rule is the drawer's rounded corners, which has an explicit `[dir="rtl"] .zq-drawer` override.

### What mirrors and what does not

| Mirrors in RTL | Does not mirror |
|---|---|
| Header order, breadcrumb, section row, mobile menu anchor | Maps (MapLibre canvas and coordinates) |
| Timeline and Journey spine (moves to the right), alternating sides, rail border | The eight-point star, rosettes and evidence marks |
| Drawer (opens from the inline end, which is the left in RTL) | Numbers, references and citation strings (`dir="ltr"`) |
| Position bar (Previous at the inline start) | Quran and hadith Arabic (always RTL in both UIs) |
| Comment indentation, toasts, form layouts | The Journey progress gradient (`90deg`, physical) |

Known RTL gaps: the arrow glyphs in "← Previous", "Next →", "Read ayat →" and stop links are literal characters and do not flip; the evidence-drawer tabs use ArrowRight for "next" in both directions; the Arabic interface strings are a draft pending translator review (the footer says so); most page copy is still English inside the Arabic shell; the 404 page always renders the English header and footer.

### Extensibility to Urdu

`dict.ts` is keyed by locale with one shape (`typeof en`), the middleware and `LOCALES` list are the only places that enumerate locales, and Arabic-script blocks are marked per element. Adding `ur` needs a dictionary entry, the locale in `LOCALES` and the middleware, a Nastaliq face under the OFL, and a taller line height than `arabic-ui`.

## Reduced motion and reduced transparency

| Preference | Effect |
|---|---|
| `prefers-reduced-motion: reduce` | Global: every animation and transition shortened to 0.01ms, one iteration, `scroll-behavior: auto` (`globals.css`). Components: no glass sheen, no node pulse, no reveal (all stops visible immediately), no card hover lift, no progress-line transition, no skeleton shimmer or spinner rotation, no button transition. Code: Journey parallax and reveal observers are skipped, rail jumps use `behavior: "auto"`. Tested: no running animation and no hidden stop on the home page. |
| `prefers-reduced-transparency: reduce` | `.zq-glass` uses `glass-fill-strong` and drops `backdrop-filter`. Print does the same and reveals all stops. |
| No blur support | Long text already sits on `glass-fill-strong`; the home header uses `glass-fill-strong` with blur as an enhancement. |

All motion is non-essential: nothing is conveyed only by movement.

## Focus

- Every interactive element gets the 2px `--focus` outline with 2px offset through `:focus-visible`; the focus token is ≥8:1 on every surface in all three themes (gold in Journey).
- Stretched-link cards (home features) move the ring to the card with `.zq-feature:has(.zq-feature-link:focus-visible)`.
- Skip link "Skip to content" is the first focusable element and jumps to `main#main`.
- Focus management: the evidence drawer moves focus to Close, traps Tab, and returns focus to its trigger; the mobile menu returns focus to its button on Esc; filter changes and node clicks keep focus on the pressed control.
- Anchored targets (`#ayah-N`, `#journey`, `#places`) are reachable and ayahs set `scroll-margin-top`.

## Keyboard paths

| Screen | Path |
|---|---|
| Home | Skip link → header (brand, Journey, Explore, Methodology, language, Begin exploring, menu) → hero actions → filter buttons → rail items (≥1180px) → each stop: node button, card toggle, citation chips, Explore story, View evidence → end actions → feature cards → footer |
| Evidence drawer | Close → tab list (arrows, Home, End move between tabs) → tab panel (focusable) → links in the panel; Esc closes |
| Prophet page | Header → breadcrumb → head actions → position bar → "On this page" chips → story chips and Read ayat → verse card actions → discussion → side column (surah chips, genealogy link, note textarea, journey links) |
| Timeline | Each item is a link in reading order; Enter selects it without scrolling; the card's actions follow in the side column |
| Atlas | The place list is the keyboard path; the map canvas supports MapLibre's keyboard pan and zoom when focused |
| Genealogy | Select → Show → edge list (node links, citation chips) |
| Quran reader | Text size buttons → each ayah's chip, bookmark, copy, stop links |
| Thread | Follow → each comment's Reply, Edit, Delete or Report → report radios, details, Send report → comment form |
| Admin | Nav links → queue cards' action buttons in order |

## WCAG 2.2 AA checklist

| Criterion | How QITL meets it | Status |
|---|---|---|
| 1.1.1 Non-text content | Icons and marks are `aria-hidden` next to visible words; schematic map preview is `role="img"` with a text label; the atlas list and genealogy edge list are the text alternatives; the Open Graph image has `alt` | Met |
| 1.3.1 Info and relationships | Headings in order, lists for timelines and results, `dl` for key-value data, tables with captions and `scope`, fieldsets with legends | Met |
| 1.3.2 Meaningful sequence | DOM order matches reading order; the alternating Journey layout is visual only | Met |
| 1.4.1 Use of colour | Evidence, date, place, edge and status vocabularies always include a word and a shape or line style | Met |
| 1.4.3 Contrast (minimum) | Every text token ≥4.5:1 on every surface in both themes (documented in `tokens.json`); brass is never body text in light | Met by token design; not checked per page beyond axe |
| 1.4.4 Resize text, 1.4.10 Reflow | Fluid layout; no horizontal scroll at 320px; Quran text scalable to 48px | Met |
| 1.4.11 Non-text contrast | `border` ≥3:1 for controls; focus ≥8:1 | Met |
| 1.4.12 Text spacing | Heights are minimums, not fixed | Met (not separately tested) |
| 1.4.13 Content on hover or focus | Citations and evidence are always visible; no hover-only content, except the disabled "Sign in" reason, which is only a `title` tooltip | Partial |
| 2.1.1 Keyboard, 2.1.2 No keyboard trap | Native controls throughout; the drawer's trap is intentional and Esc exits | Met |
| 2.2.2 Pause, stop, hide | The Journey's 9s sheen and 2.8s node pulse loop indefinitely; they stop only under reduced motion, with no on-page control | Gap |
| 2.3.3 Animation from interactions (AAA, followed) | Reduced motion removes interaction-triggered motion | Met |
| 2.4.1 Bypass blocks | Skip link | Met |
| 2.4.3 Focus order, 2.4.7 Focus visible | Logical order; always-visible ring | Met |
| 2.4.6 Headings and labels | Every page has one `h1` and labelled landmarks (`nav aria-label`) | Met |
| 2.4.11 Focus not obscured (minimum) | Reading headers are not sticky; on the home page the sticky glass header and progress pill can overlap a focused element near the top | Partial |
| 2.5.7 Dragging movements | Map pan and zoom have keyboard and button alternatives; nothing else drags | Met |
| 2.5.8 Target size (minimum) | Buttons 32–40px; menu links 44px; citation chips and evidence labels are about 22–24px tall | Partial (check chips) |
| 3.1.1, 3.1.2 Language of page and parts | `html lang`; `lang="ar"` on every Arabic run | Met |
| 3.2.3, 3.2.4 Consistent navigation and identification | One shell for all reading pages | Met |
| 3.3.1 Error identification, 3.3.2 Labels | Visible labels; errors in text with an icon and `aria-invalid` (TextField) or `role="alert"` | Met |
| 3.3.7 Redundant entry | `returnTo` and `intent` carry the reader's place through sign-in | Met |
| 3.3.8 Accessible authentication | Email magic link, no password or puzzle | Met |
| 4.1.2 Name, role, value | `aria-pressed`, `aria-expanded`, `aria-current`, `aria-selected`, `role="progressbar"` with values | Met |
| 4.1.3 Status messages | Saves, copies, posts, counts and errors use `role="status"`, `role="alert"` or `aria-live="polite"` | Met |

## Automated checks

| Check | Where | Scope |
|---|---|---|
| axe-core (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) | `tests/e2e/journey.spec.ts` | Home |
| axe-core, same tags | `tests/e2e/pages.spec.ts` | `/prophets`, `/prophets/yusuf`, `/timeline`, `/atlas`, `/quran`, `/quran/12`, `/hadith`, `/genealogy`, `/last-hour`, `/search?q=nuh`, `/methodology`, `/sign-in`, `/community` |
| No horizontal scroll at 320px | `pages.spec.ts` "narrow screens" | `/prophets/yusuf`, `/timeline`, `/quran/12`, `/search?q=musa` |
| No horizontal scroll at 390px, bottom-sheet drawer | `journey.spec.ts` "mobile" | Home |
| RTL page has `dir="rtl" lang="ar"` and no horizontal scroll | `pages.spec.ts` | `/ar/prophets/yusuf` |
| Reduced motion: zero running animations, no hidden stops | `journey.spec.ts` | Home |
| Sticky progress pill (390px) and "Your journey" rail (≥1180px) stay in view deep in the journey | `journey.spec.ts` (with `.zq-jt { overflow: clip }`, which keeps sticky working) | Home |
| Drawer focus in, Esc, focus return | `journey.spec.ts` and `tests/unit/components.test.tsx` | Home, `EvidenceDrawer` |
| No console errors | `tests/e2e/console.spec.ts` | Twelve routes including `/ar`, `/account`, `/admin` |
| Evidence word, visible citations, draft badge, loading button | `tests/unit/components.test.tsx` | Components |
| Projects | `playwright.config.ts` | Every e2e spec runs on "desktop" (1440×900) and "mobile" (Pixel 7, 390×844) |

Not automated yet: contrast per rendered page beyond axe, dark-theme and journey-theme axe runs, Arabic-UI axe runs, keyboard-only walkthroughs of the drawer tabs and admin tools, target-size measurement.
