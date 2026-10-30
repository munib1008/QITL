# Brand and tokens

This document describes QITL's brand principles, voice and the complete design-token inventory, and how tokens travel from the design handoff into the running Next.js app. It summarises and links the sources of truth; where this document and `design/` disagree, `design/` wins (see [design/README.md](../../design/README.md)).

| Source | What it owns |
|---|---|
| [design/brand-book.md](../../design/brand-book.md) | Principles, content rules, colour, type, Journey (glass) rules, RTL, imagery, accessibility |
| [design/evidence-model.md](../../design/evidence-model.md) | The six evidence kinds; how dates, places, genealogy and gradings are shown |
| [design/tokens/tokens.json](../../design/tokens/tokens.json) | Every token value in three themes (the tables below are generated from it) |
| [design/components/*.md](../../design/components) | Per-component behaviour |
| `scripts/build-tokens.ts` | The generator that turns `tokens.json` into `src/styles/tokens.css` and `src/styles/tokens.generated.ts` |

## Principles

1. **Evidence first.** Every claim, date, location and genealogical edge carries an `EvidenceLabel` and a visible `CitationChip`. Citations are never hover-only.
2. **Honest uncertainty.** "Unknown" is a designed state, not a gap. Undated sacred history sits on a relative-order track; ambiguous places are regions or "Location unknown", never pins; the Last Hour has no countdown and no year.
3. **Calm, not sensational.** An editorial atlas: no streaks, badges, confetti, neon or end-times imagery. The home Journey's glass and glow are the single immersive exception.
4. **No depictions.** No prophet, Companion or member of the Ahl al-Bayt is drawn, photographed or silhouetted. Geometry, calligraphy and maps only (see [asset-and-image-guidelines.md](asset-and-image-guidelines.md)).
5. **Arabic is first-class.** RTL is designed, not mirrored by accident; Quran text has its own typography and is never altered.
6. **Nothing unbuilt looks built.** Unwired features render disabled, "Coming soon" or a designed "not configured" state.

## Voice

| Rule | Do | Do not |
|---|---|---|
| Register | Plain, precise, respectful, third person; short declarative sentences | Hype ("incredible", "shocking"), speculation dressed as fact |
| Hedging is vocabulary | "The Quran states…", "An authentic narration reports…", "Scholars differ…", "Historians estimate…", "This is not known." | "Probably" on a scriptural claim |
| Casing | Sentence case for headings, buttons, labels ("Begin the journey", "Show on the atlas") | Title Case; uppercase-transforming Arabic |
| Eyebrows | Uppercase Latin only, `eyebrow` style in `brass-ink` | Uppercase on any element with `lang="ar"` (globals.css resets `text-transform` and `letter-spacing` on `[lang="ar"]`) |
| Transliteration | One scheme site-wide (Sahih al-Bukhari, Abu Dawud, Nasa'i), with the Arabic name beside it on detail pages | Mixed schemes |
| Emoji | Never | Anywhere in UI or content |
| Demo data | Tagged DEMO (`DemoTag`) or "Draft content — pending scholarly review" (`DraftBadge`); placeholders such as "[Scholar name]" or "No. —" | Invented verses, narrations, gradings, dates, coordinates or lineage, even as lorem ipsum |
| Empty states | A plain sentence plus the next step (the `EmptyState` component) | Blank areas, apologies, or mocked content |

Fixed vocabulary used by the code (`src/content/labels.ts`, `src/components/ui/cards.tsx`):

| Concept | Values and their words |
|---|---|
| Era certainty (`ERA_TEXT`) | relative "Chronological position" · estimate "Historians' estimate" · traditional "Traditional estimate" · exact "Established date" · unknown "Date unknown" · disputed "Date disputed" |
| Place certainty (`PLACE_TEXT`) | point "Verified place" · region "Approximate region" · hypothesis "Historical hypothesis" · disputed "Disputed location" · unknown "Location unknown" |
| Date precision (`PRECISION_TEXT`) | exact "Exact date" · range "Date range" · estimated "Estimated" · relative "Relative order only" · unknown "Date unknown" |
| Editorial status (`STATUS_TEXT`) | draft "Draft" · in_review "In scholarly review" · approved "Approved" · published "Published" · correction "Correction pending" · rejected "Changes requested" |

## Honorifics

| Who | English UI | Arabic UI | Notes |
|---|---|---|---|
| Allah | "Allah" | الله | Never "God" in UI copy; licensed translations keep the translator's wording |
| The Prophet Muhammad | ﷺ (U+FDFA ligature) | ﷺ | Never "(pbuh)"; used in copy such as "milestones of the final Messenger ﷺ" |
| Other prophets | (عليه السلام) | (عليه السلام) | On first mention per view. Journey data carries it in the `honorific` field; components render it with `lang="ar"` |
| Companions | (رضي الله عنه) / (رضي الله عنها) | same | Required wherever a Companion is named (for example Fatimah (رضي الله عنها) in genealogy copy) |

`ProphetCard` defaults the honorific to "(عليه السلام)" when none is passed; pass ﷺ explicitly for the Prophet Muhammad.

## How tokens flow

```
design/tokens/tokens.json            (single source of truth; edited in the design system, re-exported)
        │
        ▼  pnpm tokens   (tsx scripts/build-tokens.ts; also runs first in `pnpm build`)
        ├──► src/styles/tokens.css            CSS custom properties per theme + .type-* classes
        └──► src/styles/tokens.generated.ts   TOKENS: token names, breakpoints, families, type styles
                       │
                       ▼
             tailwind.config.ts  qitlPreset    every value → var(--token)
                       │
                       ▼
             src/app/globals.css  @import tokens.css, components.css, home.css, prophet.css, pages.css
```

What `scripts/build-tokens.ts` emits:

| Output | Content |
|---|---|
| `:root, [data-theme="light"] { … }` | Every colour and shadow token at its light value |
| `[data-theme="dark"] { … color-scheme: dark }` | Dark values |
| `[data-theme="journey"], html:has(> body > [data-theme="journey"]) { … }` | Journey values; a page that owns the journey theme also themes `<html>` so the scrollbar and overscroll match |
| `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { … } }` | With no explicit choice the system preference wins |
| `:root { --space-*, --radius-*, --bp-*, --measure-*, --control-height, --header-height, --z-*, --font-* }` | Theme-independent tokens |
| `--font-<family>` | Built from the `next/font` variables (`--ff-serif`, `--ff-plex`, `--ff-plex-ar`, `--ff-mono`, `--ff-amiri-quran`, `--ff-amiri`, `--ff-naskh`) with the literal family names as fallbacks |
| `.type-<style>` | One class per type style: `font: <weight> <size>/<line-height> var(--font-<family>)` plus letter-spacing |
| `tokens.generated.ts` | `TOKENS.colors`, `shadows`, `spacing`, `radius`, `breakpoints` (`sm/md/lg/xl`), `zIndex`, `families`, `typeStyles` |

Tailwind preset (`qitlPreset` in `tailwind.config.ts`): `screens` = `bp-sm/md/lg/xl`; `colors` = every colour token name (`bg-surface-raised`, `text-ink-muted`); `spacing` strips the `space-` prefix (`p-4` = `var(--space-4)`); `borderRadius` strips `radius-`; `boxShadow` strips `shadow-`; `zIndex` strips `z-`; `fontFamily` = `display | sans | quran | naskh | mono`; `maxWidth.reading` and `maxWidth.arabic`. No hex value appears in a component; the one exception is the Open Graph image (`src/app/opengraph-image.tsx`), which cannot read CSS variables and copies Journey values by hand.

Theme selection at runtime:

| Situation | Mechanism |
|---|---|
| No choice made | `:root:not([data-theme])` follows `prefers-color-scheme` |
| Reader chose light or dark | `ThemeToggle` (System → Light → Dark) stores `qitl-theme` in `localStorage`; an inline script in `src/app/[locale]/layout.tsx` applies `data-theme` on `<html>` before first paint |
| Home page | The page wrapper and `JourneyTimeline` set `data-theme="journey"` on themselves; the theme toggle is not shown on the home header |
| Evidence drawer | Takes an optional `theme` prop and sets `data-theme` on its own scrim (the Journey passes `journey`) |

`design/tokens/tokens.css` is the design-side generated copy; the app reads only `src/styles/tokens.css`. Never hand-edit either; change `tokens.json` and run `pnpm tokens`.

## Colour

All values below are generated from `design/tokens/tokens.json`. A value in braces is an alias that resolves to another token in the same theme.

| Token | Light | Dark | Journey | Usage |
|---|---|---|---|---|
| `surface` | `#f7f3ea` | `#0b171b` | `#061519` | Page background (ivory in light, ink in dark). Reading surfaces for stories, Quran and Hadith. |
| `surface-raised` | `#fffdf8` | `#122326` | `rgba(15,42,49,0.58)` | Cards, drawers, popovers, map popups resting on `surface`. |
| `surface-sunken` | `#efe9dc` | `#081114` | `rgba(0,0,0,0.28)` | Wells: search field fill, translation-compare columns, code/reference blocks, skeleton base. |
| `surface-inverse` | `#0c2927` | `#f7f3ea` | `#eaf4ef` | Toasts and the rare inverse band. Text on it is `ink-inverse`. |
| `brand-deep` | `#0c2927` | `#1a4a45` | `#0b2e2a` | Evergreen band: home hero, global footer, cover block. Text on it is always `on-brand-deep` (ivory). |
| `on-brand-deep` | `#f7f3ea` | `#f7f3ea` | `#f2f5f3` | Ivory text and marks on `brand-deep` (13.9:1 light, 9.0:1 dark). |
| `ink` | `#0b171b` | `#f7f3ea` | `#f2f8f4` | Primary text on `surface`, `surface-raised`, `surface-sunken` (≥14.6:1 both themes). |
| `ink-muted` | `#55635f` | `#a8beb2` | `#98b7b0` | Secondary text: metadata, captions, translator and edition lines, on all three surfaces (≥5.2:1 light, ≥8.2:1 dark). |
| `ink-inverse` | `#f7f3ea` | `#0b171b` | `#061519` | Text on `surface-inverse`. |
| `brand` | `#0c2927` | `#a8beb2` | `#6de2c0` | Primary action fill, Quran evidence fill, active nav, links. Evergreen in light; sage in dark so it stays a strong figure. Text on it is `on-brand`. |
| `on-brand` | `#f7f3ea` | `#0b171b` | `#04140f` | Text and icons on `brand` fills (13.9:1 light, 9.3:1 dark). |
| `brass` | `#b8944d` | `#c9a764` | `#e6c88d` | Restrained gold accent: geometric ornament, active timeline marker, map routes, selected-state underline. A FILL or mark only in light (2.6:1 on ivory) — never body text there; use `brass-ink`. Text on a brass fill is `ink`/`#0b171b` (6.4:1). |
| `brass-ink` | `#7a5a1e` | `#d4b26e` | `#e6c88d` | Brass as text: scholarly-interpretation label, eyebrow labels, accent links on all surfaces (≥5.2:1 light, ≥8.0:1 dark). |
| `sage` | `#a8beb2` | `#3d5a4e` | `#2a5a55` | Approximate-region fill on the atlas (with hatch), genealogy generation lanes, quiet tags. Decorative fill; never the only carrier of meaning. |
| `sage-soft` | `#dce5df` | `#18302d` | `rgba(109,226,192,0.12)` | Selected rows, hover wash on list items and timeline lanes, highlighted ayah background. |
| `sage-ink` | `#3d5a4e` | `#a8beb2` | `#a5f0d6` | Text on `sage-soft` and the surfaces: tag labels, hadith evidence mark (≥6.2:1). |
| `slate` | `#5e716d` | `#8fa39c` | `#8ea6ae` | Icons, historical-estimate marks and timeline ticks (≥4.2:1 light, ≥6.0:1 dark). Text only on `surface` and `surface-raised` in light. |
| `hairline` | `#d9d2c3` | `#24383a` | `rgba(167,188,192,0.18)` | Decorative dividers between sections and list rows. Not for control borders. |
| `border` | `#6e7e79` | `#6f8580` | `#6e8a92` | Control borders (inputs, secondary buttons, evidence label outlines): ≥3:1 on all surfaces in both themes. |
| `focus` | `#0c2927` | `#d4b26e` | `#e6c88d` | 2px solid focus ring with 2px offset on every interactive element; ≥8:1 on every surface in all three themes (gold in Journey). |
| `ev-quran` | `{brand}` | `{brand}` | `{brand}` | Quran evidence label: solid fill + eight-point star mark. |
| `ev-hadith` | `{sage-ink}` | `{sage-ink}` | `{sage-ink}` | Authenticated Hadith label: solid 1.5px outline + filled circle mark. |
| `ev-scholar` | `{brass-ink}` | `{brass-ink}` | `{brass-ink}` | Scholarly interpretation label: solid outline + half-filled circle mark. |
| `ev-estimate` | `{slate}` | `{slate}` | `{slate}` | Historical estimate label: dashed outline + ≈ mark. |
| `ev-disputed` | `#7a4e00` | `#e0b45c` | `#e8b85c` | Disputed label: double outline + split-diamond mark (6.0:1 light, 8.4:1 dark). |
| `ev-unknown` | `{ink-muted}` | `{ink-muted}` | `{ink-muted}` | Unknown label: dotted outline + ? mark. Also unknown-date and unknown-location states. |
| `status-info` | `#1f4e79` | `#8cb8e0` | `#8cb8e0` | Info text/icons (notices, 'under review'); always with a word. |
| `status-success` | `#1d5c73` | `#7fc3d6` | `#7fc3d6` | Success (saved, published). Teal-blue, off the red–green axis; always with a word or check icon. |
| `status-warning` | `#7a4e00` | `#e0b45c` | `#e8b85c` | Warnings (licence pending, edit window closing); always with a word. |
| `status-danger` | `#a3360f` | `#f08f6b` | `#f08f6b` | Errors, destructive actions, removed comments; always with a word or icon (≥5.6:1). |
| `map-point` | `{brand}` | `{brand}` | `{brand}` | Verified-point pin fill on the atlas. |
| `map-region` | `{sage}` | `{sage}` | `{sage}` | Approximate-region polygon fill (with diagonal hatch in `slate`). |
| `map-route` | `{brass}` | `{brass}` | `{brass}` | Migration/journey routes; dashed when the route is approximate. |
| `map-hypothesis` | `{brass-ink}` | `{brass-ink}` | `{brass-ink}` | Historical-hypothesis outline: dotted, no fill. |
| `scrim` | `rgba(11,23,27,0.48)` | `rgba(0,0,0,0.6)` | `rgba(2,6,12,0.72)` | Overlay behind drawers, bottom sheets and modals. |
| `glass-fill` | `rgba(255,253,248,0.72)` | `rgba(18,35,38,0.72)` | `rgba(15,42,49,0.58)` | Frosted panel fill for Journey cards, hero panels and the progress rail. Always paired with backdrop blur; falls back to `glass-fill-strong` where blur is unsupported or reduced transparency is requested. |
| `glass-fill-strong` | `#fffdf8` | `#122326` | `rgba(9,30,35,0.92)` | Opaque-enough glass for long text (summaries, surah lists) and the no-blur fallback. Quran and Hadith full text always sit on this or a solid surface, never on thin glass. |
| `glass-stroke` | `rgba(12,41,39,0.14)` | `rgba(168,190,178,0.22)` | `rgba(197,255,237,0.17)` | 1px edge of glass panels. Decorative; controls on glass still use `border`. |
| `glass-highlight` | `rgba(255,255,255,0.9)` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.14)` | Inset top-edge highlight and the slow sheen sweep across glass. |
| `glow-emerald` | `#1f7a5a` | `#3ddc97` | `#6de2c0` | Start of the timeline progress line, active node glow, primary glow. A light, never a text colour on its own. |
| `glow-teal` | `#1f6f73` | `#2cc4b4` | `#2cc4b4` | Middle of the progress line; ambient background glow. |
| `glow-cyan` | `#1f4e79` | `#5ce1e6` | `#5ce1e6` | Hover edge light on glass cards; focus ring in Journey. Use sparingly — one cyan accent per viewport. |
| `glow-gold` | `#b8944d` | `#d9b56a` | `#e6c88d` | End of the progress line, active-node ring, geometric motifs, era dividers. |

Colour rules:

- Pages sit on `surface`; cards and drawers on `surface-raised`; wells, compare columns and skeleton bases on `surface-sunken`.
- `brand` is the primary action and the Quran evidence fill; text on it is `on-brand`. `brand-deep` is the evergreen band; text on it is `on-brand-deep`.
- `brass` is a fill or mark only in light (2.6:1 on ivory); brass words use `brass-ink`. At most one brass element per view region.
- Status colours always travel with a word or icon; success is teal-blue, off the red–green axis.
- Outside the Journey: no gradients and no glow.
- Long text on glass sits on `glass-fill-strong`; thin `glass-fill` is for heads, pills and the rail.

## Typography

Families (from `type.families`; at runtime each is prefixed by its `next/font` variable):

| Family token | Stack in tokens.json |
|---|---|
| `display` | `"Source Serif 4", "Noto Naskh Arabic", Georgia, serif` |
| `sans` | `"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, sans-serif` |
| `quran` | `"Amiri Quran", "Amiri", "Noto Naskh Arabic", serif` |
| `naskh` | `"Noto Naskh Arabic", "Amiri", serif` |
| `mono` | `"IBM Plex Mono", ui-monospace, monospace` |

Type styles:

| Style | Family | Size / line height | Weight | Letter spacing | Usage |
|---|---|---|---|---|---|
| `display-xl` | display | 64px / 68px | 500 | -0.02em | Home hero only. 40px/44px below 768px. |
| `display-lg` | display | 44px / 50px | 500 | -0.01em | Page titles: prophet profile, story title, surah title. 32px/38px on mobile. |
| `heading-1` | display | 32px / 40px | 600 | 0 | Section headings within long-form pages. |
| `heading-2` | display | 24px / 32px | 600 | 0 | Chapter and card-group headings. |
| `reading` | display | 19px / 32px | 400 | 0 | Long-form story and methodology prose; max measure `measure-reading`. |
| `heading-3` | sans | 18px / 26px | 600 | 0 | Card titles, drawer titles. |
| `body` | sans | 16px / 24px | 400 | 0 | Default UI and translation text. |
| `body-sm` | sans | 14px / 20px | 400 | 0 | Card summaries, metadata, comments. |
| `label` | sans | 13px / 18px | 600 | 0.01em | Evidence labels, buttons-sm, tags, legend items. |
| `eyebrow` | sans | 12px / 16px | 600 | 0.08em | Uppercase section kickers in `brass-ink`. Latin only — never uppercase-transform Arabic. |
| `quran-ayah` | quran | 32px / 2.1 | 400 | 0 | Quran Arabic in the reader and verse cards, dir=rtl, lang=ar. User-scalable 24–48px. Never letter-spaced, never italic, never truncated. |
| `quran-inline` | quran | 24px / 2 | 400 | 0 | Quran Arabic inside evidence drawers and compact cards. |
| `naskh-text` | naskh | 22px / 1.9 | 400 | 0 | Hadith Arabic matn and isnad, tafsir Arabic. |
| `arabic-ui` | sans | 16px / 28px | 400 | 0 | Arabic interface text (IBM Plex Sans Arabic) when the UI language is ar. Line height is taller than Latin body. |
| `reference` | mono | 13px / 18px | 500 | 0 | Citation chips, canonical numbers, numbering-system notes, admin IDs. |

Rules: Quran text (`quran-ayah`, `quran-inline`) is never italic, letter-spaced, truncated, line-clamped or set in a UI font, and is user-scalable from 24 to 48px in the reader. References use `reference` (IBM Plex Mono) and are always `dir="ltr"`. In code, `display-xl` is not applied through `.type-display-xl`: the hero heading uses `clamp(42px, 6.4vw, 80px)` in `src/styles/home.css` (see the inconsistency list at the end of this document).

## Spacing

| Token | Value | Usage |
|---|---|---|
| `space-1` | `4px` | Icon-to-label gap, label inner vertical padding. |
| `space-2` | `8px` | Chip padding, tight stacks inside cards. |
| `space-3` | `12px` | Control horizontal padding, list-row padding. |
| `space-4` | `16px` | Card padding on mobile, mobile page gutter, default gap. |
| `space-5` | `24px` | Card padding on desktop, gap between cards. |
| `space-6` | `32px` | Desktop page gutter, section inner spacing. |
| `space-7` | `48px` | Between page sections. |
| `space-8` | `64px` | Hero vertical padding, large section breaks. |
| `space-9` | `96px` | Home hero top padding on wide screens. |

Cards pad `space-5` on desktop and `space-4` on mobile; the mobile gutter is `space-4`; reading pages use `max(4vw, 16px)` side padding.

## Radius

| Token | Value | Usage |
|---|---|---|
| `radius-xs` | `2px` | Evidence labels, citation chips, timeline ticks. |
| `radius-sm` | `4px` | Buttons, inputs, tags. |
| `radius-md` | `8px` | Cards, map popups, toasts. |
| `radius-lg` | `12px` | Drawers and bottom sheets (top corners only on mobile). |
| `radius-pill` | `999px` | Avatars, toggle tracks, genealogy nodes. |

## Shadow

Borders before shadows: cards use a `hairline` border; only floating layers take a shadow.

| Token | Light | Dark | Journey | Usage |
|---|---|---|---|---|
| `shadow-float` | `0 8px 24px rgba(11,23,27,0.14)` | `0 8px 24px rgba(0,0,0,0.5)` | `0 12px 32px rgba(0,0,0,0.55)` | Map popups, menus, toasts. |
| `shadow-drawer` | `0 0 48px rgba(11,23,27,0.22)` | `0 0 48px rgba(0,0,0,0.6)` | `0 0 56px rgba(0,0,0,0.7)` | Evidence drawer, bottom sheets, modals. |
| `shadow-glow` | `0 8px 24px rgba(11,23,27,0.10)` | `0 12px 32px rgba(0,0,0,0.5)` | `0 0 24px rgba(61,220,151,0.14), 0 16px 40px rgba(0,0,0,0.55)` | Floating glass cards in the Journey. |
| `shadow-glow-active` | `0 0 0 3px rgba(184,148,77,0.35)` | `0 0 0 3px rgba(217,181,106,0.35), 0 0 24px rgba(61,220,151,0.25)` | `0 0 0 3px rgba(217,181,106,0.4), 0 0 32px rgba(61,220,151,0.35)` | The active timeline node and the expanded card. |

## Breakpoints

| Token | Value | Usage |
|---|---|---|
| `bp-sm` | `480px` | Large phones: 2-up chips, inline actions. |
| `bp-md` | `768px` | Tablet: side drawer replaces bottom sheet; 2-column card grids. |
| `bp-lg` | `1024px` | Desktop: persistent nav, timeline+map split view. |
| `bp-xl` | `1440px` | Content max width; beyond it the atlas and timeline grow, text does not. |

The Journey timeline does not use these: it uses container queries at 860px and 1180px on its own width (see [responsive-rtl-accessibility.md](responsive-rtl-accessibility.md)).

## Sizes

| Token | Value | Usage |
|---|---|---|
| `measure-reading` | `68ch` | Max width of story prose and translations. |
| `measure-arabic` | `40em` | Max width of Arabic Quran/Hadith blocks. |
| `control-height` | `40px` | Buttons and inputs; 44px touch target via padding on mobile. |
| `header-height` | `64px` | Global shell header; 56px on mobile. |

## Z-index

| Token | Value | Usage |
|---|---|---|
| `z-map-controls` | `10` | Map legend, zoom and epoch slider over the map canvas. |
| `z-header` | `50` | Sticky global header. |
| `z-drawer` | `100` | Evidence drawer, bottom sheet, modal and their scrim. |
| `z-toast` | `200` | Toasts above everything. |

Two hard-coded layers exist outside the scale: the Journey progress pill (`z-index: 3`) and filter bar (`z-index: 4`) inside the timeline's own stacking context.

## Motion

`tokens.json` has no motion group. Durations live in the brand book (150–250ms ease-out for drawers and the map camera) and directly in CSS and code. This is the current inventory, so a future `motion` token group can adopt it:

| Use | Duration / value | Where |
|---|---|---|
| Button background on hover | 150ms | `.zq-btn` in `src/styles/components.css` |
| Button pressed | 1px downward nudge | `.zq-btn:active` |
| Journey card hover, border, shadow | 250ms ease | `.zq-jc` |
| Journey node colour, border | 200ms; shadow 300ms | `.zq-jt-node` |
| Journey filter pill | 200ms | `.zq-jt-filter` |
| Progress line fill | 600ms `cubic-bezier(.2,.7,.2,1)` | `.zq-jt-fill` |
| Reveal on scroll (once) | 600ms opacity and 24px translate | `.zq-rv` |
| Active node pulse | 2.8s loop | `@keyframes zq-pulse` |
| Glass sheen | 9s loop | `@keyframes zq-sheen` on `.zq-glass::after` |
| Lattice parallax | scroll × −0.08 | `JourneyTimeline` scroll handler |
| Skeleton shimmer | 1.4s loop | `.zq-skel::after` |
| Button spinner | 0.8s loop | `.zq-spin` |
| Copy / "Copied" feedback | 1.5–2s | `CardActions`, `CopyCitationButton`, `AyahReader` |
| Toast lifetime | 4s | `DiscussionThread` |
| Scroll-sync hold after a click | 1200ms (`HOLD_MS`) | `JourneyTimeline` |
| Scroll-sync hysteresis | 48px (`HYSTERESIS_PX`) | `JourneyTimeline` |
| Focus line | 40% of viewport height (`FOCUS_LINE`) | `JourneyTimeline` |

Under `prefers-reduced-motion: reduce`, `globals.css` cuts every animation and transition to 0.01ms and disables smooth scrolling; component CSS additionally removes the sheen, pulse and reveal, and the timeline stops parallax and uses `behavior: "auto"` for jumps.

## The six evidence kinds

Every kind is told apart by word, mark and border style. Colour repeats the meaning; it never carries it alone.

| Kind | Word (en) | Word (ar, in code) | Mark | Border | Colour token | CSS class |
|---|---|---|---|---|---|---|
| `quran` | Quran | القرآن | Eight-point star (`Star`) | Solid fill | `ev-quran` (= `brand`), text `on-brand` | `.zq-ev-quran` |
| `hadith` | Authentic Hadith | حديث صحيح | Filled circle | 1.5px solid outline | `ev-hadith` (= `sage-ink`) | `.zq-ev-hadith` |
| `scholar` | Scholarly interpretation | تفسير العلماء | Half-filled circle | 1.5px solid outline | `ev-scholar` (= `brass-ink`) | `.zq-ev-scholar` |
| `estimate` | Historical estimate | تقدير تاريخي | Two waves (≈) | Dashed | `ev-estimate` (= `slate`) | `.zq-ev-estimate` |
| `disputed` | Disputed | مختلف فيه | Split diamond | 3px double | `ev-disputed` | `.zq-ev-disputed` |
| `unknown` | Unknown | غير معلوم | ? | 2px dotted | `ev-unknown` (= `ink-muted`) | `.zq-ev-unknown` |

The Arabic words are a first draft pending review by a qualified translator (`src/lib/i18n/dict.ts`). `hadith` means a narration graded sahih or hasan by a named scholar for that narration; `HadithGrade` shows `hadith` only when `authentic` is true and a `grader` is named, `scholar` when a grade exists without that, and `unknown` ("Grade not recorded") when none is recorded.

The same "word + shape + line style" rule applies to the other uncertainty vocabularies:

| Vocabulary | Shapes and lines |
|---|---|
| Date precision (timeline marks) | exact = dot · range = solid bar · estimated = hatched dashed bar · relative = diamond on the relative-order track · unknown = dotted ring or band |
| Place certainty (atlas, legend) | verified point = filled pin · approximate region = sage fill with slate diagonal hatch · historical hypothesis = dotted brass outline, no fill · approximate route = dashed brass line · unknown = dashed "?" ring, listed beside the map |
| Genealogy edge | sourced = solid line, "Sourced link" · disputed = double line, "Disputed link" · unknown = dotted line, "Unknown link" |
| Editorial status | draft = empty dot · in review = half dot · approved and published = full dot · changes requested = square dot; the word is always shown |

## No colour carries meaning alone

- Evidence, date precision, place certainty, genealogy edges and editorial status always render a word next to their shape or line style. Screen readers get the word; the marks are `aria-hidden`.
- Status messages pair colour with an icon (`Icon.alert`, `Icon.check`) or a word ("Not saved. Your text is still here.").
- Map layers differ by geometry and line pattern as well as colour; the permanent `MapLegend` names each one.
- Disabled controls use 45% opacity plus `not-allowed`, and where the reason matters a visible note ("Accounts coming soon").
- Success is teal-blue and danger is red-orange, so the two never rely on a red–green distinction.

## Known gaps between tokens and code

| Gap | Detail |
|---|---|
| No motion tokens | Durations are hard-coded in CSS (table above). |
| Hero size | `display-xl` is 64/68px (40/44px under 768px); `.zq-hero h1` uses `clamp(42px, 6.4vw, 80px)/1.04`. |
| Extra breakpoints | CSS also uses 479/480px, 640px, 767/768px, 860/861px and 1024px media queries; 640px and 860px are not tokens. |
| Content width | Reading pages cap at 1200px (`.pp-wrap`) and the Journey body at 1280px, below the 1440px `bp-xl` content maximum. |
| Header height | `header-height` is 64px; the home glass header is 72px tall (`.zq-nav`). |
| Open Graph image | Uses literal Journey hex values because `next/og` cannot read CSS variables. |
