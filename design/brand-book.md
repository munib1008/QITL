> **Historical document.** Written for ZIQ, the project's earlier name; the product is now **QITL — Quran in Timeline**. It is kept unchanged as a record. Where it differs from the current implementation, the current documents win: `docs/IMPLEMENTATION_STATUS.md`, `docs/FEATURE_ACCEPTANCE_MATRIX.md`, `docs/LICENSING.md`. In particular, religious evidence now draws only on the Quran, Sahih al-Bukhari, Sahih Muslim, and narrations of Jami' at-Tirmidhi and Sunan Ibn Majah individually graded authentic (the public hadith catalogue lists these four collections).

# ZIQ brand book

ZIQ is a free, public Islamic knowledge atlas: the Quran, authenticated Sunni Hadith, the prophets, genealogy, chronology and geography in one calm, scholarly reading experience. The design system exists to make one thing unmistakable on every screen: **what Allah and His Messenger ﷺ have told us, what scholars interpret, what historians estimate, and what remains unknown.**

## Principles

1. **Evidence first.** Every claim, date, location and genealogical edge carries an `EvidenceLabel` and a visible `CitationChip`. Citations are never hover-only.
2. **Honest uncertainty.** Unknown is a designed state, not a gap. Undated sacred history sits on a relative-order track; ambiguous places are regions or "Unknown location", never pins; the Last Hour has no countdown and no year.
3. **Calm, not sensational.** An editorial atlas, not a SaaS dashboard, a game or an end-times site. No streaks, badges or confetti for worship or reading. The Journey's glass and glow are the one immersive exception, and they follow the Journey rules below.
4. **No depictions.** Never draw, photograph or silhouette a prophet, Companion or the Ahl al-Bayt. Use calligraphy, geometry and maps.
5. **Arabic is first-class.** RTL is designed, not mirrored by accident; Quran text gets its own typography and is never altered.

## Content fundamentals

- **Voice:** plain, precise, respectful, third person. Short declarative sentences. No hype ("incredible", "shocking"), no speculation dressed as fact, no contemporary geopolitical guessing about the Last Hour.
- **Hedging is vocabulary, not tone.** Use the fixed words: "The Quran states…", "An authentic narration reports…", "Scholars differ…", "Historians estimate…", "This is not known." Never "probably" on a scriptural claim.
- **Honorifics (always):** Allah (never "God" in UI copy; translations keep the translator's wording) · Prophet Muhammad ﷺ (render the ligature U+FDFA, not "(pbuh)") · other prophets (عليه السلام) on first mention per view · Companions (رضي الله عنه / عنها). In Arabic UI use the Arabic forms.
- **Casing:** sentence case for headings, buttons and labels ("Begin with Adam", "Open the Atlas"). Eyebrows are uppercase Latin only — never transform Arabic.
- **Transliteration:** one scheme site-wide (e.g. Sahih al-Bukhari, Abu Dawud, Nasa'i); show the Arabic name beside the transliteration on detail pages.
- **No emoji** anywhere in UI or content.
- **Demo content:** every fixture is tagged DEMO and uses placeholders ("[Scholar name]", "No. —"). Never invent a verse, narration, grading, date, coordinate or lineage — not even as lorem ipsum.
- **Unbuilt features** are hidden or shown `disabled` with "Coming soon"; never mocked as working.

## Colour

- Grounds: `surface` (ivory / deep ink) for pages; `surface-raised` for cards and drawers; `surface-sunken` for wells and compare columns.
- Text: `ink` for body and Arabic; `ink-muted` for metadata, translator lines, captions. Both hold ≥4.5:1 on every surface in both themes.
- `brand` (evergreen in light, sage in dark) is the primary action and Quran fill; text on it is `on-brand`. `brand-deep` is the evergreen band for the home hero and footer, with `on-brand-deep` text.
- `brass` is a restrained accent: ornament, timeline markers, routes, the selected-tab underline. In light it is a fill only (2.6:1) — brass words are set in `brass-ink`. Use brass on at most one element per view region.
- `sage` / `sage-soft` / `sage-ink`: regions, lanes, hover and selected washes, tags.
- Evidence colours `ev-quran`, `ev-hadith`, `ev-scholar`, `ev-estimate`, `ev-disputed`, `ev-unknown` always travel with their word, mark and border style — see the Evidence model section. Status colours (`status-*`) always travel with a word or icon; success is teal-blue, off the red–green axis.
- Map: `map-point`, `map-region` (+ `slate` hatch), `map-route`, `map-hypothesis`. Keep base tiles desaturated so these read.
- Outside the Journey, use no gradients or glow. Never use neon or "glowing" end-times imagery anywhere.

## Journey mode (glass)

The home-page journey from Adam to the passing of the Prophet ﷺ (`HomePage`, `JourneyTimeline`, `ProphetJourneyCard`) uses the `journey` theme: a deep teal-black ground (`surface`), frosted panels (`glass-fill`, `glass-stroke`, `glass-highlight`) and four lights (`glow-emerald`, `glow-teal`, `glow-cyan`, `glow-gold`).

- Use it only for the home journey and other immersive overviews. Reading pages (Quran reader, Hadith, stories, search, admin) stay on solid light or dark surfaces.
- Long text sits on `glass-fill-strong`: surah lists, Quran and Hadith text, anything over three lines. Thin `glass-fill` is for heads, pills and the rail. Every text token meets 4.5:1 on the worst case (glass over the brightest glow).
- Glow is light, not ink. The progress line runs `glow-emerald` → `glow-teal` → `glow-gold`. The active node takes `shadow-glow-active`. Show at most one cyan edge per viewport (card hover).
- Motion: reveal once, a soft pulse on the active node, a sheen every 9 seconds, slow parallax on the geometric lattice. No particles, light streaks or tilt behind Arabic text. All of it stops under `prefers-reduced-motion`; glass turns solid under `prefers-reduced-transparency` or when blur is unsupported.
- Motifs are geometric rosettes only. Nothing figurative, not even animals or objects from a story.

## Typography

- Display and long-form: Source Serif 4 — `display-xl` (home hero only), `display-lg` page titles, `heading-1`/`heading-2`, `reading` for story prose at `measure-reading`.
- Interface: IBM Plex Sans with IBM Plex Sans Arabic — `heading-3`, `body`, `body-sm`, `label`, `eyebrow`; `arabic-ui` when the interface language is Arabic.
- Quran: Amiri Quran (fallback Amiri, Noto Naskh Arabic) — `quran-ayah` in the reader, `quran-inline` in drawers. User-scalable 24–48px. Never italic, letter-spaced, truncated, line-clamped or set in a UI font.
- Hadith and tafsir Arabic: Noto Naskh Arabic — `naskh-text`.
- References and numbers: IBM Plex Mono — `reference` in `CitationChip`; always `dir="ltr"` inside RTL text.
- All faces are SIL Open Font License, loaded from Google Fonts (`components/bundle.css` imports them). For production self-host the woff2 files under the OFL; never ship unlicensed Quran fonts.

## Spacing, layout and shape

- 4px base: `space-1`…`space-9`. Cards pad `space-5` desktop, `space-4` mobile; mobile gutter `space-4` (16px), desktop `space-6`.
- Breakpoints `bp-sm` 480, `bp-md` 768 (drawer replaces bottom sheet), `bp-lg` 1024 (timeline + map split), `bp-xl` 1440 (content max; atlas keeps growing). Works from 320px with no horizontal scroll.
- Radii are small and editorial: `radius-xs` labels and chips, `radius-sm` controls, `radius-md` cards, `radius-lg` drawers, `radius-pill` genealogy nodes and avatars.
- **Borders before shadows.** Cards use a `hairline` border; only floating layers take `shadow-float` / `shadow-drawer`. Controls use `border` (≥3:1).
- Ornament: the eight-point star (`ZIQ.Star`) and quiet geometric lattices at low contrast, used as section marks and empty-state art. Never behind Arabic text.

## States and interaction

- Focus: 2px solid `focus` ring, 2px offset, on every interactive element; never removed.
- Hover: `sage-soft` wash; pressed: 1px nudge; disabled: 45% opacity + `not-allowed`, plus a reason in text where it matters.
- Every data view has loading (`Skeleton`), empty (plain sentence + next step), error (what failed + Retry) and unauthorised (why + sign-in) states.
- Motion: 150–250ms ease-out for drawers and map camera; timeline/map sync animates the camera only. All motion is non-essential and stops under `prefers-reduced-motion`.
- **Timeline is vertical**, from Adam at the top to today at the bottom (`VerticalTimeline`). Sacred history before recorded chronology is a relative-order era with no years. A brass break marks where dated chronology begins. Everything after it shows CE and AH with a precision mark. The axis is ordered, never scaled, and is labelled "not to scale".
- Signed-out bookmark/note/comment → sign-in with `returnTo`; the original action completes only after the user confirms.

## RTL and language

- Use logical CSS properties only (`margin-inline-start`, `inset-inline-end`). Set `dir` on `<html>` from the interface language, and `dir="rtl" lang="ar"` on every Arabic block inside English pages.
- Mirror navigation, drawers and timelines in RTL; do not mirror maps, the eight-point star, numbers or citation strings.
- Arabic line heights are taller (`arabic-ui` 28px on 16px). Design so Urdu (Nastaliq, even taller) can slot in.

## Imagery

- Allowed: calligraphy, geometric abstraction, maps, photographs of real manuscripts and places with source credit and licence.
- Not allowed: any depiction of prophets or Companions, AI-generated "ancient" scenes, fake archival photography, apocalyptic imagery, stock "glowing Quran" visuals.
- Every image needs alt text, credit, licence and an approval record in the CMS.

## Iconography

- Line icons on a 16px grid, 1.5px stroke, square-ish joins, drawn inline in `components/bundle.js` (bookmark, copy, share, source, discuss, search, close, check, alert, flag). Icons inherit `currentColor`; meaning-carrying icons meet 3:1.
- Evidence marks (star, circle, half circle, ≈, split diamond, ?) are reserved for `EvidenceLabel` and `ZIQ.EvidenceMark` — do not reuse them as decoration.
- No logo has been provided yet: set the name "ZIQ" in Source Serif 4 at display weight until a mark is supplied.

## Accessibility

WCAG 2.2 AA minimum: text ≥4.5:1 in both themes (verified for every text token on every surface), non-text ≥3:1, targets ≥44px on touch, full keyboard paths (timeline has a list view; map and graph have text alternatives), visible captions on every chart, no colour-only meaning.
