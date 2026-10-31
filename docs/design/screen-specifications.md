# Screen specifications

One section per route. Each section gives the purpose, a text wireframe (desktop and mobile), the components used, the exact data inputs, controls and navigation, modal and keyboard behaviour, every state with the copy the code renders, privacy-safe analytics events, and acceptance checkpoints. Component contracts are in [component-library.md](component-library.md); responsive and accessibility rules in [responsive-rtl-accessibility.md](responsive-rtl-accessibility.md).

## Reading this document

Every section starts with a status line:

| Status | Meaning |
|---|---|
| **Wired** | Works today from repository data. |
| **Unavailable state: Supabase** | Without Supabase env vars the screen renders a designed "not configured" state. |
| **Unavailable state: Quran import** | Without `content/quran/` (written by `scripts/import-quran.ts`) the screen renders "Source not imported". The folder is not in the repository. |
| **Unavailable state: map tiles** | Without `NEXT_PUBLIC_MAP_TILES_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` the map is replaced by a "Coming soon" state. |
| **Finalised visual** | Matches a design in `design/` (prototype or component spec). |
| **Designed in code only** | Built from tokens and component specs; `design/README.md` lists the area as still to design (Quran reader, Hadith explorer, atlas, genealogy explorer, Last Hour, account, admin). Treat the layout as provisional. |

Screenshots of the current build: [home hero 1440](screenshots/home-hero-1440.png) · [home hero 390](screenshots/home-hero-390.png) · [home journey 1440](screenshots/home-journey-1440.png) · [home journey 390](screenshots/home-journey-390.png) · [Yusuf 1440](screenshots/prophet-yusuf-1440.png) · [Yusuf 390](screenshots/prophet-yusuf-390.png) · [Yusuf, Arabic UI 1440](screenshots/prophet-yusuf-ar-1440.png) · [Yusuf, Arabic UI 390](screenshots/prophet-yusuf-ar-390.png) · [timeline 1440](screenshots/timeline-1440.png) · [timeline 390](screenshots/timeline-390.png).

### Shared shell (all reading pages)

`ReadingPage` wraps every page except home, the 500 page and `/offline`.

```
Desktop ≥1024                                         Mobile <640
┌──────────────────────────────────────────────┐      ┌──────────────────────────┐
│ [Z] QITL  [ Search QITL…            ] ◐ EN·ع [Sign in]│ [Z] QITL [S] [T] EN·ع [In] [=] │
│ Prophets Timeline Atlas Quran Hadith Stories …│      ├──────────────────────────┤
├──────────────────────────────────────────────┤      │ Home › Section            │
│ Home › Section › Page                         │      │ Kicker                    │
│ Kicker (draft badge / era / chapter)          │      │ H1 title                  │
│ H1 title (display-lg, serif)                  │      │ Lead (serif)              │
│ Lead (serif, max 64ch)                        │      │ Meta chips (wrap)         │
│ Meta: evidence labels · citation chips        │      ├──────────────────────────┤
├──────────────────────────────────────────────┤      │ Page body (1 column)      │
│ Page body                                     │      ├──────────────────────────┤
├──────────────────────────────────────────────┤      │ Footer (stacked columns)  │
│ QITL principles │ About links │ Legal links    │      └──────────────────────────┘
└──────────────────────────────────────────────┘
```

(Mobile sketch key: [S] Search link, [T] theme button, [In] account button, [=] menu button. Desktop shows the theme button as ◐.)

- Skip link "Skip to content" → `#main`, visible on focus.
- Header search is a GET form to `/search`, so it works without JavaScript.
- `AccountLink` states: loading (link with `aria-disabled`), signed out ("Sign in" → `/sign-in?returnTo=<current path>`), signed in ("My library" → `/account`), unavailable (disabled "Sign in", reason only in a `title` tooltip).
- `MobileMenu` below 1024px: a disclosure button (`aria-expanded`, `aria-controls`); Esc closes and returns focus; route change closes it.

### Analytics conventions (not wired)

No analytics library is installed and no event is emitted today. The privacy page promises that "any usage measurement is aggregate and does not identify you or record what you read". When analytics is added, every event below follows these rules:

- No user id, email, IP-derived identifier, note text, comment text, report details or free-text search query. Searches record only `query_length`, `script` (`latin` or `arabic`) and the result count bucket.
- Content identifiers are public slugs only (`stop_id`, `surah`, `collection`); never a bookmark or note id.
- Common properties on every event: `locale` (`en` or `ar`), `theme` (`light`, `dark`, `system`, `journey`), `viewport` (`sm`, `md`, `lg`, `xl`), `signed_in` (boolean).
- Events fire after the action succeeds, never on hover.

---

## Home `/`

Status: **Wired** (journey JSON). Basmala in the hero appears only after the Quran import. Feature cards are labelled "Coming soon". **Finalised visual** (`design/prototype/home.html`, `HomePage.md`). Screenshots: [hero 1440](screenshots/home-hero-1440.png), [hero 390](screenshots/home-hero-390.png), [journey 1440](screenshots/home-journey-1440.png), [journey 390](screenshots/home-journey-390.png).

Purpose: introduce QITL and carry the reader through the 29-stop Journey from Adam (عليه السلام) to the passing of the Prophet ﷺ.

```
Desktop (container ≥1180)
┌─────────────────────────────────────────────────────────────────┐
│ [Z] QITL  Islamic Knowledge Atlas   The Journey  Explore  Methodology   EN·ع [Begin exploring] │
├─────────────────────────────────────────────────────────────────┤
│                    (Basmala, gold, after import)                 │
│                 A JOURNEY THROUGH SACRED HISTORY                 │
│                     From the beginning.                          │
│                   To the final Messenger.                        │
│                       lead paragraph                             │
│              [Begin the journey]  [How it works]                 │
│        24 prophets…  │  5 milestones…  │  Every date labelled    │
├─────────────────────────────────────────────────────────────────┤
│ THE LIVING TIMELINE · Follow the thread of revelation. · draft badge │
│  [Explore by: Complete journey | Prophets | Key events | Dated history] │
│ ┌Your journey┐   card ◄──── ● ────► era / certainty               │
│ │ rail list  │   era / certainty ◄─ ● ─► card                     │
│ └────────────┘   …29 stops… end pill + 3 actions                  │
├─────────────────────────────────────────────────────────────────┤
│ MORE WAYS TO UNDERSTAND · Every story, in context.                │
│ [Interactive atlas] [Evidence first] [Connected genealogy]  each "Coming soon" │
├─────────────────────────────────────────────────────────────────┤
│ QITL — Islamic Knowledge Atlas · principles · About Methodology Privacy Accessibility │
└─────────────────────────────────────────────────────────────────┘

Mobile (<860)
┌──────────────────────────┐
│ [Z] QITL      EN·ع  ☰      │
│ hero, centred, 1 column   │
│ facts stacked             │
│ filter pills (wrap)       │
│ ┌ n / 29 ───────── ┐ sticky│
│ ● card (spine at start)   │
│ ● card                    │
│ feature cards stacked     │
└──────────────────────────┘
```

Components: `JourneyHeader`, `LangToggle`, `MobileMenu`, `JourneyTimeline`, `ProphetJourneyCard`, `EvidenceDrawer`, `DraftBadge`, `Rosette`, `CitationChip`, `EvidenceLabel`, `EraTag`.

Data inputs: `getJourney()` and `journeyStops()` from `content/journey/journey.draft.json`; the fact counts are computed (prophet names split on " & ", milestone count); `basmala()` from the Quran import; JSON-LD `WebSite` with a `SearchAction` to `/search?q=`.

Controls and behaviour:

| Control | Behaviour | Target |
|---|---|---|
| Begin the journey | Anchor | `#journey` |
| How it works | Link | `/methodology` |
| Begin exploring (header) | Link, hidden under 860px | `/prophets` |
| Filter pills | `aria-pressed`; keep the active stop if still visible, else first visible; holds scroll-sync 1.2s | in place |
| Node (rosette) | Selects the stop, expands its card, collapses the previous, holds scroll-sync 1.2s | in place |
| Card toggle | Same as node | in place |
| Rail item (≥1180) | Selects and scrolls the node to centre (smooth unless reduced motion) | in place |
| Explore story | Link | `/prophets/[id]` |
| View evidence | Opens `EvidenceDrawer` (Quran, Hadith, Context) | modal |
| `Q s:a` chip | Link | `/quran/[s]#ayah-[a]` |
| End actions | Continue to the atlas / Explore Quran references / View all prophets | `/atlas`, `/quran`, `/prophets` |
| Feature cards | Whole card is a link (stretched), with "Coming soon" tag | `/atlas`, `/methodology`, `/genealogy` |

Scroll-sync: the stop nearest 40% of the viewport becomes active; another stop takes over only when 48px closer; the active stop keeps focus while the focus line is inside its card; sync is paused while the drawer is open.

Modal and keyboard: the drawer is a portal dialog (`aria-modal`), focus moves to Close, Tab is trapped, Esc or a scrim click closes, focus returns to "View evidence"; tabs use arrow keys, Home and End. All nodes, filters, rail items and links are native buttons or links in DOM order.

States:

| State | Rendering |
|---|---|
| Loading | Server-rendered; no skeleton. Stops below the fold start hidden for the reveal and are shown once seen or scrolled past. |
| Empty | Not possible: the journey schema requires at least one era and item, and a schema error fails the build. |
| Draft content | `DraftBadge` "Draft content — pending scholarly review" under the section heading; drawer footer "Draft — references to be verified and approved by the scholarly reviewer before publishing." |
| Quran not imported | Basmala line omitted. |
| Hadith tab empty | "No narration attached to this stop yet." |
| Reduced motion / transparency | No reveal, pulse, sheen or parallax; glass becomes `glass-fill-strong`. |

Analytics: `journey_filter_changed {filter}`, `journey_stop_selected {stop_id, method: node|rail|scroll}` (scroll sampled at most once per stop per visit), `evidence_drawer_opened {stop_id, surface: "journey"}`, `evidence_tab_viewed {tab}`, `cta_clicked {cta: begin_journey|how_it_works|begin_exploring|continue_atlas|explore_quran|view_prophets}`.

Acceptance: 29 stops in order with the draft badge; Key events shows 5 and Prophets shows 24; clicking a node expands it and holds through 1.2s of scroll; every expanded card shows an evidence label and a citation chip; drawer focus moves to Close, Esc closes and focus returns; no stop before the Prophet ﷺ shows a year unless labelled a historians' estimate; no axe violations; at 390px a single column, a visible progress pill, no horizontal scroll and a bottom-sheet drawer; under reduced motion no running animation and no hidden stop (all covered by `tests/e2e/journey.spec.ts`).

---

## Prophets index `/prophets`

Status: **Wired**. Visual: cards follow `ProphetCard.md`; page composition designed in code.

Purpose: browse every prophet named in the Quran, grouped by journey era.

```
Desktop                                        Mobile
Home › Prophets                                Home › Prophets
[draft badge]                                  [draft badge]
Prophets of Allah                              Prophets of Allah
lead                                           lead
EARLY HUMANITY · era note                      ERA · note
[★ Adam (عليه السلام) آدم ][★ Idris …][…]     [★ card]
   Relative order: 01 on the journey           [★ card]
   [era tag] [Surah … is named after him]      …
NUH AND THE ANCIENT NATIONS …
```

Components: `ReadingPage`, `DraftBadge`, `ProphetCard`, `EraTag`.

Data inputs: journey eras filtered to `type === "prophet"`; the running number becomes "NN on the journey", omitted when the era certainty is `disputed` or `order.disputed` (then the card reads "Order: unknown"); `surahs[].named` gives "Surah X is named after him".

Controls: each card is one link to `/prophets/[id]` with a visible focus ring.

States: no loading or empty state (static). Draft badge always shown while the journey status is not approved or published.

Analytics: `prophet_card_clicked {stop_id, position}`.

Acceptance: every prophet stop appears once; each card shows the honorific, Arabic name and era certainty; no card shows a figure; axe passes; no horizontal scroll at 320px.

---

## Prophet story page `/prophets/[id]`

Status: **Wired** for all 29 ids (static, `dynamicParams = false`). Quran card shows "Arabic text not loaded" until the import. Hadith section is the designed empty state. Bookmark, note and discussion need Supabase. **Finalised visual** (`design/prototype/prophet.html`, `ProphetPage.md`). Screenshots: [1440](screenshots/prophet-yusuf-1440.png), [390](screenshots/prophet-yusuf-390.png), [Arabic UI 1440](screenshots/prophet-yusuf-ar-1440.png), [Arabic UI 390](screenshots/prophet-yusuf-ar-390.png).

Purpose: one prophet's (or milestone's) story with its evidence, places, family, notes and discussion.

```
Desktop ≥1024
Home › Prophets › Yusuf
┌──────────────────────────────────────────────────────────────┐
│ ✸  Chapter 11 of 29 · [era tag] · [draft badge]               │
│    Yusuf (عليه السلام)                                         │
│    يوسف                                                        │
│    subtitle (serif)                                            │
│    [Quran] [Surah 12 Yusuf] [Q 12:3–101] [Approximate region: Egypt] │
│    [Read Surah Yusuf] [Bookmark] [Cite this page] [Share]      │
├──────────────────────────────────────────────────────────────┤
│ ← Previous Yaqub      03 / Ibrahim and his family · 6 of 6    Next → Ayyub │
├──────────────────────────────────────┬───────────────────────┤
│ Story · Quran · Sunnah · Places · Discussion (chips)          │ Related surahs        │
│ The story in N movements                                       │  12 Yusuf يوسف [Q…]   │
│  1 heading · summary · [Quran][Q a:b] Read ayat →              │ Family                │
│ From the Quran: VerseCard (Arabic, licence pending)            │  no reviewed link…    │
│ From the Sunnah: empty state                                   │ Private note          │
│ Places: schematic preview + legend                             │ On the journey        │
│ Discussion: preview + start/sign in                            │  [See on the journey] │
│                                                                │  [On the timeline]    │
└──────────────────────────────────────┴───────────────────────┘

Mobile <640: header search collapses to a Search link; head is one column; position bar shows
Previous / Next only (era label hidden); "On this page" chips scroll sideways; the side column
follows the main column.
```

Components: `ReadingPage`, `Rosette`, `EraTag`, `DraftBadge`, `EvidenceLabel`, `CitationChip`, `BookmarkButton`, `CopyCitationButton`, `ShareButton`, `VerseCard` (+ `CardActions`), `EmptyState`, `MapLegend`, `DiscussionPreview`, `NoteEditor`, the local `AtlasPreview` SVG.

Data inputs: `findStop(id)` (item, prev, next, era, indices, total); `item.story[]`, `surahs[]` or `refs[]`, `place`, `evidence`, `era`; `parseAyahRange` of the first passage → `ayahArabic(surah, from)` and `quranSource()`; `GET /api/me/bookmarks`, `GET /api/me/notes?type=journey_stop&id=…`, `GET /api/discussions?contentType=journey_stop&contentId=…`.

Controls and behaviour:

| Control | Behaviour | Target |
|---|---|---|
| Read Surah [name] / Read the ayat | Link (primary) | `/quran/[n]` or `/quran/[s]#ayah-[a]` |
| Bookmark | See `BookmarkButton` states | `/sign-in?returnTo&intent` when signed out |
| Cite this page | Copies "QITL — [name]. [site]/prophets/[id]"; "Citation copied" or "Copy failed" for 2s (`aria-live`) | clipboard |
| Share | Native share sheet; falls back to copying the URL ("Link copied") | — |
| Position bar | Previous and Next in journey order | `/prophets/[prev|next]` |
| Story step chip, Read ayat → | Link | `/quran/[s]#ayah-[a]` |
| Verse card actions | Bookmark (`quran_verse`), Copy reference, Source | `/quran/[s]#ayah-[a]` |
| Family link | "Open the genealogy explorer" | `/genealogy?focus=[id]` |
| See on the journey / On the timeline | Links | `/#[id]`, `/timeline?selected=[id]` |

States:

| State | Copy |
|---|---|
| No story outline | Label "Outline not written yet"; "No story outline is attached to this page yet." + "An outline appears here only after it is written from the cited ayat and approved by the scholarly reviewers…" |
| Step summary missing | "Summary being drafted — read the ayat below." |
| Arabic not imported | "Arabic text not loaded — waiting for the verified Quran source to be imported." |
| Translation | Always "Translation unavailable — licence pending" on this page |
| Hadith | Label "Not yet attached"; "No narration is attached to this page yet." + "Narrations about [name] appear here only after each one is graded by a named scholar and approved by the review board." |
| Unknown place | "Location unknown: [name]. It is not placed on the map." Preview shows a dashed "?" ring and "Not mapped" |
| Family | "No reviewed family relationship is attached yet. Relationships appear only with a cited, reviewed claim." |
| Note, Supabase missing | "Notes need an account, and accounts are not open on this site yet." |
| Note, signed out | "Sign in to keep private notes. Only you can read them." |
| Discussion | see `DiscussionPreview` states below |
| Unknown id | 404 (not generated) |

Analytics: `prophet_page_viewed {stop_id}`, `citation_chip_clicked {kind: quran, surah}`, `cite_copied {stop_id}`, `share_used {method: native|copy}`, `journey_position_nav {direction: prev|next}`, `bookmark_intent {target_type}` (signed out), `bookmark_saved {target_type}`.

Acceptance: Yusuf is "Chapter 11 of 29" between Yaqub and Ayyub with 8 cited story steps; Previous and Next agree with the journey order; with accounts unconfigured, Bookmark is disabled with "Accounts coming soon"; Sunnah shows the empty state, never an unverified narration; no horizontal scroll at 320px; `/ar/prophets/yusuf` has `dir="rtl"` and no horizontal scroll; axe passes.

---

## Timeline `/timeline?selected=<id>`

Status: **Wired** from the journey JSON (not from `historical_events`). Visual: `VerticalTimeline` is designed; the split page is designed in code. Screenshots: [1440](screenshots/timeline-1440.png), [390](screenshots/timeline-390.png).

Purpose: the master chronology from Adam to today, ordered and not to scale, with a selected-stop card.

```
Desktop ≥1024 (5fr | 7fr)
┌──────────────────────────────┬────────────────────────────────────┐
│ Ordered from Adam to today ·  │ ┌ PROPHET            [era tag] ┐  │ sticky
│ not to scale                  │ │ Nuh (عليه السلام)             │  │
│ EARLY HUMANITY                │ │ summary                       │  │
│ ┊ ◇ Relative order only Adam  │ │ Date  …   Place  …            │  │
│ ┊ ◇ … Idris                   │ │ [Quran] [Q 71:1–28] …         │  │
│ ═══ Recorded chronology begins│ │ [Read the story] [Show on the atlas] [Next: Hud →] │
│ THE FINAL MESSENGER ﷺ         │ └───────────────────────────────┘  │
│ │ ● date label  title [label] │ Date certainty legend (5 marks)     │
│ ○ Today 2026 CE · 1448 AH     │                                     │
│ Last Hour note → explorer     │                                     │
└──────────────────────────────┴────────────────────────────────────┘
Mobile: one column; the timeline first, then the selected card or empty state, then the legend.
```

(The "Today" line is computed from the current date; the values shown are illustrative.)

Components: `ReadingPage`, `DraftBadge`, `VerticalTimeline`, `EraTag`, `EvidenceLabel`, `CitationChip`, `EmptyState`, local `DateLegend`.

Data inputs: `journeyTimeline(getJourney())` maps era certainty to precision (exact → exact, estimate → estimated, traditional → range, unknown → unknown, otherwise relative); an era is `dated` only when every item is dated; the brass break "Recorded chronology begins" follows the last relative era with no year; `todayLabel()` gives "YYYY CE · YYYY AH" (Umm al-Qura calendar via `Intl`); `findStop(selected)`.

Controls: each item is a link to `/timeline?selected=[id]` (`scroll={false}`, `aria-current` when selected, brass outline); card actions Read the story → `/prophets/[id]`, Show on the atlas → `/atlas?focus=[id]`, Next → `/timeline?selected=[next]`; the card region is `aria-live="polite"`.

States: nothing selected → label "Nothing selected", "Select a stop on the timeline." + "Its card, evidence and place appear here. Each stop links to its story and to the atlas."; unknown `selected` value → same empty state. No loading state (server-rendered).

Not built from the brief: zoom, category and source layers, compare, uncertainty-interval rendering beyond marks, map sync, mobile bottom sheet for the card, events from the database, virtualisation.

Analytics: `timeline_item_selected {stop_id, precision}`, `timeline_to_atlas {stop_id}`, `timeline_to_story {stop_id}`.

Acceptance: "not to scale" is visible; relative eras show no year; the break carries no year; Last Hour signs are not placed on the timeline; `?selected=nuh` shows the Nuh card; flow A reaches the atlas from here; axe passes; no horizontal scroll at 320px.

---

## Atlas `/atlas?focus=<id>`

Status: place list **Wired** (journey JSON); map **Unavailable state: map tiles** and, once tiles exist, **Supabase** for geometries. **Designed in code only** (atlas listed as still to design; `MapLegend` is designed).

Purpose: show where events happened with honest certainty; unknown places are listed, never placed.

```
Desktop ≥1024
┌──────────────────────────────┬────────────────────────────────────────┐
│ PLACES ON THE JOURNEY, BY     │ ┌──────────────────────────────────┐  │
│ CERTAINTY                     │ │  MapLibre canvas (desaturated)   │  │
│ text-alternative note         │ │  or "Coming soon" empty state    │  │
│ [Verified place]              │ └──────────────────────────────────┘  │
│   Ibrahim  Makkah …           │ Location certainty legend             │
│ [Approximate region] …        │  ● point ▨ region ? unknown ┈ hypothesis ╌ route │
│ [Historical hypothesis] …     │  attribution line                     │
│ [Disputed location] …         │                                        │
│ [Location unknown] Adam …     │                                        │
└──────────────────────────────┴────────────────────────────────────────┘
Mobile: list first, then the map (or its empty state), then the legend.
```

(Place names in the sketch stand for whatever the journey JSON holds.)

Components: `ReadingPage`, `DraftBadge`, `EvidenceLabel`, `EmptyState`, `AtlasMapLoader` → `AtlasMap`, `MapLegend`, `Skeleton`.

Data inputs: journey stops grouped by `place.certainty` in the order point, region, hypothesis, disputed, unknown (labels use evidence kinds scholar, estimate, estimate, disputed, unknown); `mapConfigured()`; `GET /api/atlas/places` → `atlas_places()` RPC (published geometries; `unknown[]` without geometry).

Controls: list item → `/prophets/[id]#places`; the focused item (`?focus=`) has `aria-current` and bold weight. Map: navigation control (zoom, no compass), cooperative gestures (two-finger pan on touch, modifier-scroll zoom), click on a feature opens a popup with the name, the certainty word and "Source: …".

States:

| State | Copy |
|---|---|
| Tiles not configured | Tag "Coming soon"; "The interactive map is not connected yet." + "The map needs a tile provider and reviewed place geometries. Neither is configured on this site, so no map is shown rather than an invented one. The list of places works now." |
| Map loading | `Skeleton` 420px |
| No published geometry | Overlay "No reviewed places are published yet." + "Places appear on the map once their geometry, source and claim are approved." |
| Map error | Overlay "The map could not be loaded." + "The list of places beside it still works." |
| Legend attribution missing | "No map data provider configured" |

Not built: epoch slider, routes with uncertainty bands, multiple alternate locations, source drawer from a popup, timeline-to-map camera sync, legend collapsing to a button on mobile.

Analytics: `atlas_place_clicked {stop_id, certainty}`, `atlas_feature_opened {precision}`, `atlas_map_state {state: unavailable|no_data|error|ready}`.

Acceptance: unknown places appear only in the list; the legend shows Verified point, Approximate region, Unknown location, Historical hypothesis and Approximate route with an attribution line; `?focus=adam` marks Adam under "Location unknown"; no pin is drawn for an ambiguous place; axe passes.

---

## Genealogy `/genealogy?focus=<slug>`

Status: **Unavailable state: Supabase** (`person_graph` RPC). **Designed in code only** (genealogy explorer listed as still to design; `GenealogyLink` is designed).

Purpose: family links around a person, each edge resting on a cited, reviewed claim.

```
Desktop and mobile (single column)
Home › Genealogy
Genealogy · lead (solid = sourced, double = disputed, dotted = unknown; no "last descendant")
[Centre the graph on ▾ prophet list ] [Show]
┌ How to read the lines ───────────────────────────┐
│ (Person A)──parent of / Sourced link──(Person B)  │
│ (Person A)══ Disputed link ══(Person B)           │
│ (Person A)┈┈ Unknown link ┈┈(Unknown)             │
│ Illustration of the line styles only…             │
└──────────────────────────────────────────────────┘
AROUND [NAME]
┌ (From)──relation──(To)  [evidence label] [citation chips] ┐
│ claim statement · "One of several competing lines; all are shown." │
└───────────────────────────────────────────────────────────┘
```

Components: `ReadingPage`, `GenealogyLink`, `EvidenceLabel`, `CitationChip`, `EmptyState`.

Data inputs: `focus` (default `ibrahim`); `sb.rpc("person_graph", {person_slug, depth: 2})` → nodes `{id, name, nameAr, kind, distance}` and edges `{from, to, kind, confidence, competingGroup, claim {statement, evidence, references}}`; the select lists prophet stops from the journey.

Controls: the select + Show submits a GET form (works without JavaScript); a node that is also a journey stop links to `/genealogy?focus=[slug]`; the current node is plain text with `aria-current`; Quran references link to `/quran/[s]#ayah-[a]`.

States: Supabase missing → label "No reviewed links yet", "The genealogy database is not connected on this site yet." + explanation and a link to the prophet's page; connected but empty → "No reviewed family links are published around this person yet."; the edge list is the text alternative and keyboard path (there is no drawn graph).

Not built: graph canvas, generation lanes, ancestor and descendant views.

Analytics: `genealogy_focus_changed {slug}`, `genealogy_edge_citation_clicked {evidence}`.

Acceptance: no edge renders without a claim; disputed lines show every competing line; no "last descendant" wording anywhere; illustration nodes are labelled as not real; axe passes.

---

## Stories `/stories`

Status: outline list **Wired**; published stories **Unavailable state: Supabase**. **Designed in code only**.

```
Desktop                                             Mobile: same, one column
Stories · lead
[full stories grid] or empty state
STORY OUTLINES ON THE JOURNEY  [draft badge]
[N movements · Yusuf (عليه السلام) · subtitle] [ … ]
```

Components: `ReadingPage`, `Rosette` (12 points) cover, `EmptyState`, `EvidenceLabel`, `DraftBadge`.

Data inputs: `stories` table (`slug, title, title_ar, summary, published_at`, status `published`, newest first); journey stops with `story[]`.

Controls: story card → `/stories/[slug]`; outline card → `/prophets/[id]#story`.

States: no stories (or no Supabase) → label "None published yet", "No full stories are published yet." + "A story is published only when every chapter's claims are cited and approved by the scholarly reviewers."

Analytics: `story_card_clicked {slug|stop_id, kind: story|outline}`.

Acceptance: cover art is geometric only; outlines carry the draft badge; no unpublished story is listed.

## Story reader `/stories/[slug]?chapter=<n>`

Status: **Unavailable state: Supabase** (404 without it). **Designed in code only**.

```
Desktop ≥1024                                      Mobile
Home › Stories › Title                             title, bookmark
Title · summary · [Bookmark]                       Chapter n of N
┌──────────────────────────────┬──────────────┐    prose
│ Chapter n of N               │ Chapters     │    Evidence for this chapter
│ Chapter title (serif)        │ 1. …         │    progress line
│ prose (reading, 68ch)        │ 2. … current │    ← prev · n/N · next →
│ EVIDENCE FOR THIS CHAPTER    │ Private note │    Discussion
│ [statement][label][chips]    │              │    Chapters, Private note
│ Progress saved: 40%          │              │
│ ← Previous · n / N · Next →  │              │
│ Discussion                   │              │
└──────────────────────────────┴──────────────┘
```

Components: `ReadingPage`, `BookmarkButton` (`story`), `Markdown`, `EvidenceLabel`, `CitationChip`, `ChapterProgress`, `NoteEditor` (`chapter`), `DiscussionPreview` (`story`).

Data inputs: `stories` with published `chapters` (`position, title, body_md`), `chapter_claims → evidence_claims → claim_references (+ sources.work)`; `PATCH /api/me/progress`.

Controls: chapter links `?chapter=n` (clamped to 1…N), Previous/Next, chapter list with `aria-current="page"`; Quran chips → `/quran/[s]#ayah-[a]`, other references are static chips "[work], [locator]".

States: unknown or unpublished slug → 404; no published chapters → "This story has no published chapters yet."; progress (signed in only): "Your reading progress is saved to your library as you read." → "Progress saved: N%" → "Chapter completed. Saved to your library."

Analytics: `story_chapter_viewed {slug, chapter}`, `story_chapter_completed {slug, chapter}` (no timing data).

Acceptance: every chapter shows its claims with evidence labels; progress is recorded only for signed-in readers and only moves forward; raw HTML in Markdown is shown as text.

---

## Quran index `/quran`

Status: **Unavailable state: Quran import** (shows the cited-surah fallback). **Designed in code only** (Quran reader listed as still to design).

```
Imported                                     Not imported (today)
Quran · lead · [Quran]                       Quran · lead · [Quran]
Arabic text: source, version. licence        [Source not imported] The verified Quran text…
┌ 1  Name           (Arabic) ┐               SURAHS CITED ON THE JOURNEY
│    N ayat · revelation      │               [2 Al-Baqarah (Arabic)] [7 …] …
└────────────────────────────┘ ×114
```

Data inputs: `surahList()` and `quranSource()` (from `content/quran/surahs.json`, `source.json`); fallback: unique surahs from journey `surahs[]`.

Controls: each row → `/quran/[n]`.

States: not imported → label "Source not imported", "The verified Quran text has not been imported on this site yet." + "The Arabic is never typed in by hand. It is imported from a verified source (Tanzil), pinned by version and checksum, with scripts/import-quran.ts. Until then the reader cannot show the text."

Analytics: `surah_opened {surah, from: index}`.

Acceptance: never shows Arabic that did not come from the checksummed import; 114 rows after import.

## Surah reader `/quran/[surah]#ayah-<n>`

Status: **Unavailable state: Quran import**; translations always licence-pending here; tafsir empty. **Designed in code only**.

```
Desktop                                              Mobile
Home › Quran › Name                                  same, one column
Surah n · Name (Arabic)                              text-size bar wraps
N ayat · revelation                                  Arabic at chosen size,
[Quran] [Translation unavailable — licence pending]  never truncated
┌ On the journey: Yusuf [Q 12:3–101] ┐
TEXT SIZE [A−] 32px [A+]
──────────────────────────────────── #ayah-1
                     Arabic ayah (quran-ayah, RTL, ≤40em)
[Q n:1] [Bookmark] [Copy reference] [Yusuf →]
────────────────────────────────────
Arabic text: source, version, licence
TAFSIR  [Not yet attached] No tafsir is attached to this surah yet.
```

Components: `ReadingPage`, `EvidenceLabel`, `CitationChip`, `AyahReader`, `BookmarkButton` (icon), `EmptyState`.

Data inputs: `surahList()[n-1]`, `surahArabic(n)`, `quranSource()`; journey stops whose passages fall in surah n (ayah → stop links).

Controls: A− / A+ step through 24, 28, 32, 38, 44, 48px (buttons disabled at the ends; size remembered in `localStorage` `qitl-quran-size`; `output` announces the size); per ayah: citation chip (anchor), bookmark, Copy reference ("Copied" for 1.5s), stop links.

States: invalid surah → 404; not imported → label "Source not imported", "The Arabic of this surah is not loaded yet." + "It is shown only from the verified source import, never typed in. Tafsir and translations appear here once licensed and reviewed."; tafsir → label "Not yet attached", "No tafsir is attached to this surah yet." + "Each tafsir excerpt names its scholar and work, and appears only when its licence is cleared."

Not built: translation column (even when a cleared translation exists in the database, this page does not load it), audio, topics per ayah, export citation beyond copy.

Analytics: `quran_text_size_changed {size}`, `ayah_reference_copied {surah}`, `ayah_to_story {surah, stop_id}`.

Acceptance: `#ayah-N` anchors scroll correctly (flow A lands on `/quran/2#ayah-30`); Arabic carries `lang="ar" dir="rtl"`; size range 24–48px; axe passes; no horizontal scroll at 320px.

---

## Hadith index `/hadith`

Status: **Wired** (catalogue). **Designed in code only** (Hadith explorer listed as still to design).

```
Hadith · lead (a collection is not a grade)
[compiler / Sahih al-Bukhari / Arabic / note] ×7 grid
┌ How grading is shown ──────────────────────────────┐
│ [Sahih / Hasan, by a named scholar] [Another grade…] [Grade not recorded] │
│ "Graded differently by other scholars" · methodology link │
└────────────────────────────────────────────────────┘
```

Data inputs: `COLLECTIONS` (id, name, Arabic, compiler, note). Notes treat Bukhari and Muslim contextually and say every other collection is graded narration by narration.

Controls: card → `/hadith/[collection]`; methodology link → `/methodology#hadith`.

Analytics: `hadith_collection_opened {collection}`.

Acceptance: four collections (Bukhari, Muslim, Tirmidhi, Ibn Majah; narrowed from seven on 2026-10-31); no collection-level grade badge.

## Hadith collection `/hadith/[collection]?n=<number>`

Status: **Unavailable state: Supabase** for the list. **Designed in code only**.

```
Home › Hadith › Sahih al-Bukhari
Name (Arabic) · note
Go to a narration by number [      ] (help: numbering differs between editions)
Open Sahih al-Bukhari N →            (after submitting ?n=)
[N  numbering system] list (≤200)  or empty state
```

Data inputs: `hadith_entries (canonical_number, numbering_system)` published, ordered, limit 200.

Controls: GET form `?n=` (pattern digits plus optional letter); then a link to `/hadith/[c]/[n]`; rows → `/hadith/[c]/[number]`.

States: none published or no Supabase → label "Not yet published", "No narrations from [name] are published yet." + "Narrations are added only from a licensed edition, pinned by version, and appear once each grading is recorded with its scholar and source."

Analytics: `hadith_number_lookup {collection}`.

## Hadith narration `/hadith/[collection]/[number]`

Status: **Unavailable state: Supabase**. **Designed in code only**.

```
Home › Hadith › Collection › N
Collection N
┌ COLLECTION                         [Short N] ┐
│ Numbering: system                             │
│ Arabic matn (naskh-text, RTL)                 │
│ translation (only if licence cleared)         │
│ Gradings: [label] graded by X [source] · Graded differently… │
│ [Bookmark] [Copy reference]                   │
└───────────────────────────────────────────────┘
Translation: translator | Translation unavailable — licence pending
┌ Scholars differ on this narration: each grader, grade, citation ┐
DISCUSSION (preview)
```

Components: `HadithCard`, `HadithGrade`, `CardActions`, `EmptyState`, `DiscussionPreview` (`hadith`, id `collection:number`).

Data inputs: `hadith_entries` + `hadith_translations` (RLS returns only rights-cleared sources) + `hadith_gradings (grader, grade, grade_label, citation)`; authentic grades: sahih, hasan, hasan sahih, sahih li-ghayrihi, hasan li-ghayrihi; `varies` when more than one distinct grade.

States: invalid collection or number format → 404; nothing published → label "Not published", "[Name] [n] is not published on QITL yet." + "No reviewed record exists for this number in this collection." or "The hadith database is not connected on this site yet." + "No text is shown rather than an unverified one."; zero gradings → "Grade not recorded".

Analytics: `hadith_viewed {collection}`, `hadith_disagreement_viewed {collection}`.

Acceptance: every recorded grading is listed with grader and source; disagreement panel appears whenever grades differ; no grade inferred from the collection.

---

## Last Hour `/last-hour`

Status: **Unavailable state: Supabase** (explainer always shown). **Designed in code only**.

```
Home › The Last Hour
The Last Hour · lead (its time is known only to Allah; no date, no countdown, no guesses)
[Quran] [Q 7:187] Its knowledge is with Allah alone.
┌ How this page works: 4 rules ┐
MAJOR SIGNS
┌ Order in the texts: n | Order: not stated in the texts ┐
│ Title (Arabic)  summary  [evidence][Q chips]  Date: none is known. │
MINOR SIGNS …
```

Data inputs: `historical_events` with category `last_hour_major` or `last_hour_minor`, status published, ordered by `relative_order` (nulls last), with `evidence_claims` and `claim_references`. The database forbids any year on these rows.

States: none published or no Supabase → label "Not yet published", "No signs are published here yet." + methodology link.

Not built: broad-region map overlays, interpretation-disagreement panel per sign.

Analytics: `last_hour_sign_viewed {slug}` (no scroll-depth tracking).

Acceptance: no year after the current one and no "years remaining", "days left" or countdown wording anywhere in `main` (tested); every sign carries a citation; no imagery.

---

## Compare sources `/compare?ref=<surah:ayah>`

Status: Arabic **Unavailable state: Quran import**; translations **Unavailable state: Supabase** and licence. **Designed in code only**.

```
Desktop (auto-fit columns ≥320px)                   Mobile: stacked
Ayah reference [12:4] [Compare]
┌ ARABIC ORIGINAL [Quran][Q s:a] ┐ ┌ EN · translator ┐ ┌ … ┐
│ Arabic or "not loaded"          │ │ text             │
│ source, version                 │ │ Edition · Licence · Source recorded │
└─────────────────────────────────┘ └──────────────────┘
```

Data inputs: `parseAyahRange(ref)` (default `1:1`); `ayahArabic`, `quranSource`; `quran_translations (translator, edition, language, text, sources(work, license_text, attribution, updated_at))` for that ayah, filtered by RLS to cleared sources.

Controls: GET form with pattern `\d{1,3}:\d{1,3}`.

States: invalid ref → "That is not an ayah reference." + "Write it as surah:ayah, for example 12:4."; Arabic missing → "Arabic not loaded — the verified source has not been imported yet."; no translation → "Licence pending", "No translation is licensed for display yet." + link to the licence register.

Not built: comparing tafsir or scholarly readings (the empty state says it will work the same way); no route links to `/compare` other than the sitemap.

Analytics: `compare_opened {surah}`, `compare_translation_count {count_bucket}`.

Acceptance: every translation shows translator, edition, licence and source date; nothing shows without a cleared licence.

---

## Search `/search?q=<text>&facet=<facet>`

Status: **Wired** over journey content; database index added with Supabase. Visual: `SearchField` designed; results page designed in code.

```
Search · lead
[ Search QITL…                       ]
[All (n)] [Prophets (n)] [Quran (n)] …       (facet pills with counts; only non-zero)
n results for "query" [in the journey content (the full index is not connected…)]
PROPHETS
Yusuf (Arabic)  snippet
```

Data inputs: `searchJourney(q)` (Latin normalisation, Arabic normalisation without vowel marks, alternate spellings) plus `search()` RPC; facets: prophets, milestones, quran, stories, events, hadith, last_hour; query trimmed to 120 characters.

Controls: GET form; facet pills are links with `aria-current`; the result count is a `role="status"` line.

States: no query → "Type a name, a surah, a place or a reference."; no results → "Nothing matched “[query]”." + "Try another spelling (Yusuf, Yousuf, Joseph), the Arabic name (يوسف), or a reference such as 12:4. Browse the prophets or the surahs."; database missing → the count line adds "in the journey content (the full index is not connected on this site yet)". The page is `noindex`.

Analytics: `search_submitted {query_length, script, result_bucket, database: ok|not_configured}`, `search_facet_selected {facet}`, `search_result_clicked {facet, rank}`.

Acceptance: "Joseph" and "يوسف" both find Yusuf; a nonsense query shows guidance; `/api/search?q=` returns 422.

---

## Community `/community`

Status: **Unavailable state: Supabase**. **Designed in code only**.

```
Community · lead (comments are readers' views, not verified knowledge)
Read the discussion guidelines
Thread title
On journey stop yusuf · 3 comments · date [· locked]
```

Data inputs: `discussions (id, title, content_type, content_id, status, created_at, comments(count))`, newest 50.

States: no Supabase → tag "Coming soon", "Discussions are not open yet." + "The community database is not connected on this site yet. Nothing here is mocked."; connected, none → "No discussions yet." + "Start one from any prophet, verse or story page."

Analytics: `thread_opened {from: community}`.

## Thread `/community/[id]`

Status: **Unavailable state: Supabase**. **Designed in code only** (`Comment` is designed).

```
Home › Community › Thread title
[About: yusuf] [Locked by a moderator] [Follow thread]
(R) Reader · date · edited
    body
    [Cites Q 12:4]
    Reply · Edit · Delete | Report
    ↳ reply (indented up to 3 levels)
[Report form: reasons (radio) · details · Send report · Cancel]
Add a comment [textarea] Cite a verse or narration (optional) [Q 12:3 or Bukhari 1]
[Post comment]                                   toast (bottom inline-end)
```

Components: `DiscussionThread`, `Comment`, `IconButton`, `CitationChip`, `Toast`, `Skeleton`, `EmptyState`.

Data inputs: `GET /api/discussions/[id]/comments` (discussion + `comments_public` view: body blanked unless visible, `is_mine`, `can_edit` within 30 minutes); mutations `POST` comments, `PATCH`/`DELETE` comment, `POST /api/reports`, `POST /api/follows`.

Controls: Reply (open threads only), Edit (own, 30 minutes), Delete (own; browser confirm "Delete your comment? This cannot be undone."), Report (others; reasons: Misleading about the sources, Disrespectful, Spam, Shares personal information, Something else; optional details ≤1000), Follow thread (`aria-pressed`). Citation input pattern: `Q s:a[–b]` or "Collection number".

States: loading → skeletons; Supabase missing → "Discussions are not open yet." + "The community database is not connected on this site yet."; 404 → "This discussion does not exist or was removed."; error → "The discussion could not be loaded." + Retry; no comments → "No comments yet."; signed out → "Sign in to comment" (→ `/sign-in?returnTo=/community/[id]`), no action buttons; hidden comment → "Hidden while a moderator reviews a report."; removed → "Removed by a moderator for breaking the discussion guidelines."; toasts "Posted.", "Edited.", "Deleted.", "Reported. A moderator will review it.", "Following. Activity goes to your notifications and digest.", server error text; posting closed → no form.

Analytics: `comment_posted {has_citation, is_reply}`, `comment_reported {reason}`, `thread_followed {follow}`. Never the comment text.

Acceptance: hidden and removed comments keep their place; reading works signed out; a 6th comment within a minute is refused by the database throttle; reports never expose the reporter.

## Discussion guidelines `/community/guidelines`

Status: **Wired** (`INFO_PAGES.guidelines`). See "Info pages" below.

---

## Sign in `/sign-in?returnTo=<path>&intent=<action:type:id>&error=<code>`

Status: **Unavailable state: Supabase**. **Designed in code only** (account listed as still to design).

```
Home › Sign in
Sign in · lead (reading never needs an account…)
[banner: After you sign in you will return to the page and be asked to confirm saving the bookmark.]
[error line]
Email [            ]  help: We email you a one-time sign-in link. No password.
[Email me a sign-in link]
[Continue with Google]      (only when NEXT_PUBLIC_AUTH_GOOGLE=1)
By signing in you agree to the terms and privacy notice…
```

Data inputs: `safeReturnTo(returnTo)` (same-origin path, else `/`), `decodeIntent(intent)` (only `bookmark:<type>:<id>`), `error` (`expired` or other); `supabase.auth.signInWithOtp` with `emailRedirectTo` `/auth/callback?returnTo&intent`.

States: Supabase missing → tag "Coming soon", "Accounts are not open on this site yet." + "Everything is readable without an account. Go back to what you were reading."; sending → button "Sending" (`aria-busy`); sent → "Check your email" + "We sent a sign-in link to [email]. It works once and expires soon. You can close this tab."; send error → "Too many requests. Wait a minute and try again." (429) or "We could not send the link. Check the address and try again."; callback errors → "That sign-in link has expired or was already used. Request a new one." or "Sign-in did not complete. Try again."

Analytics: `sign_in_link_requested {has_intent}`, `sign_in_completed {has_intent}` (from the callback page view). Never the email.

Acceptance: `returnTo` cannot leave the origin; the intent survives the round trip; nothing is saved without the later confirmation.

## My library `/account`

Status: **Unavailable state: Supabase**; signed out with Supabase → redirect to `/sign-in?returnTo=/account`. **Designed in code only**.

```
Desktop and mobile (single column)
My library · lead (only you can see this page)
[error line if any part failed]
┌ Continue reading: Story: Chapter (n%) ┐
BOOKMARKS        Yusuf ………………… [Remove]
READING PROGRESS Story: Chapter …… 40% read | Completed
PRIVATE NOTES    target · first 280 characters…
┌ Notifications: Email digest of followed discussions [Off|Daily|Weekly] ┐
┌ Your data: Signed in as … [Export my data (JSON)] [Sign out]
│ Delete my account [type DELETE MY ACCOUNT] [Delete account permanently] ┐
```

Components: `AccountDashboard`, `Skeleton`, `EmptyState`.

Data inputs: `GET /api/me/bookmarks`, `/api/me/progress`, `/api/me/notes`; `notification_prefs.digest` via the browser client; `POST /api/me/export` (form post, file download); `POST /api/me/delete` with `{confirm}`; journey names for `journey_stop` targets.

States: loading → per-section skeleton; any fetch failed → "Some of your library could not be loaded. Refresh to try again."; no bookmarks → "No bookmarks yet." + "Use Bookmark on any prophet, ayah or story."; no progress → "Progress is recorded as you read published stories."; no notes → "No notes yet. Notes are private: only you can read them."; digest save → "Saving…", "Saved.", "Not saved. Try again."; delete → disabled until the exact phrase is typed; "Deleting…"; failure → server message or "Deletion failed. Nothing was deleted."; 503 when the server key is missing → "Account deletion needs the server key, which is not configured. Contact us to delete your account."; Supabase missing → tag "Coming soon", "Accounts are not open on this site yet." + "Everything is readable without an account."

Not built: followed threads list (the lead promises it), saved places, saved collections, notification inbox, privacy toggles, appeals.

Analytics: `library_viewed`, `bookmark_removed {target_type}`, `data_exported`, `account_deleted` (count only). Never note content.

Acceptance: only the owner's rows are visible (RLS); export downloads `qitl-export-YYYY-MM-DD.json`; delete requires the phrase and signs the reader out.

## Unsubscribed `/account/unsubscribed?ok=<0|1>`

Status: **Wired** page; the token check needs Supabase. Copy: ok → "You are unsubscribed" + "You will not receive digest or reply emails. You can turn them back on from My library."; otherwise → "That link did not work" + "The unsubscribe link is invalid or has already been used. Sign in and change notifications from My library." Reached from `GET|POST /api/unsubscribe?token=` (303 redirect). Analytics: `digest_unsubscribed {ok}`.

---

## Editorial shell `/admin/*`

Status: **Unavailable state: Supabase**; staff role required. **Designed in code only** (admin listed as still to design).

```
Desktop ≥1024 (220px | 1fr)                        Mobile: nav above content
┌────────────────┬──────────────────────────────────────────┐
│ EDITOR · ADMIN │ Page title (display serif)                │
│ Overview       │ description                               │
│ Review queue   │ content (cards, forms, tables)            │
│ New event      │                                           │
│ Stories …      │                                           │
└────────────────┴──────────────────────────────────────────┘
```

Gate (`admin/layout.tsx`, `force-dynamic`, `noindex,nofollow`):

| Situation | Copy |
|---|---|
| Supabase missing | Tag "Not configured"; "The editorial tools need the database." + "Connect Supabase (see the README) to use the editor, review and moderation tools." |
| Signed out | "Sign in to use the editorial tools." + link `/sign-in?returnTo=/admin` + "Access needs an editor, reviewer, moderator or admin role." |
| No role | "You do not have an editorial role." + "Roles are granted by an administrator after verifying identity and, for scholarly reviewers, credentials." |

`AdminNav` shows the reader's roles and only the links their roles allow (admin sees all); every API call is re-checked by `requireRole` and RLS.

| Route | Roles in nav | Content | Data | Empty copy |
|---|---|---|---|---|
| `/admin` | all staff | "Editorial overview": count tiles (Claims, Events, Stories awaiting review; Open reports; Open correction requests) linking to queues; workflow strip Draft → In scholarly review → Approved → Published | `count(*)` per table and status | counts show 0 |
| `/admin/review` | editor, reviewer, admin | `ReviewQueue`: claims, events, stories, chapters, relationships in open states; Send for review, Approve, Request changes (prompt), Mark claim approved, Publish, History (`VersionDiff`) | browser client selects; `POST /api/admin/status`, `/api/admin/review` | "Nothing is waiting." |
| `/admin/events/new` | editor, admin | `NewEventForm` (flow D) | `locations`, `sources`; `POST /api/admin/events` | — |
| `/admin/stories` | editor, admin | `StoryComposer`: new story, add chapter with claim ids | `stories`, `chapters`, `chapter_claims` | — |
| `/admin/relationships` | editor, admin | `RelationshipEditor`: add person, add family link (claim id, competing group, tradition) | `people`, `relationships` | — |
| `/admin/moderation` | moderator, admin | `ModerationQueue`: open reports oldest first, body (moderators see hidden bodies), reporter note; Hide, Remove, Restore, Dismiss reports | `GET/POST /api/admin/moderate` | "No open reports." |
| `/admin/corrections` | editor, admin | `CorrectionsQueue`: Accept, Reject, Duplicate, each with a resolution note | `GET/PATCH /api/admin/corrections` | "No open correction requests." |
| `/admin/sources` | admin | `SourcesRegister`: table with rights status select; Add a source form | `sources` | — |
| `/admin/users` | admin | `RolesManager`: grant a role by user id with an identity-check note; revoke | `role_assignments` | — |
| `/admin/audit` | admin | `AuditTrail`: recent audit log rows | `audit_logs` | — |

Shared states: list loading → `Skeleton`; load error → "Could not load: [message]"; action feedback → `role="status"` or `role="alert"` line; database refusals surface verbatim (for example "no evidence, no publish: …").

Not built: timeline editor, map polygon drawing (typed coordinates only), hadith grading editor, asset upload and approval, revision-note entry in the review queue (the API accepts `revisionNote`, the UI never sends one), place-geometry review (the queue does not list `place_geometries`).

Analytics (staff, aggregate): `admin_action {action: send_for_review|approve|request_changes|publish|moderate|resolve_correction, entity_type, result: ok|refused}`. Never content, comment bodies or user ids.

Acceptance: non-staff never see a tool; publishing without approved, referenced claims and a reviewer approval is refused by the database; every role grant is audited.

---

## Info pages

Routes: `/about`, `/methodology`, `/review-board`, `/corrections`, `/terms`, `/privacy`, `/accessibility`, `/contact`, `/community/guidelines`. Status: **Wired** (`InfoPageView` + `INFO_PAGES`). **Designed in code only**.

```
Home › Title
Title · lead
[Draft for review by the site owner and legal counsel before launch. Not yet in force.]   (terms, privacy)
prose (h2, p, ul)
```

Content facts the pages state: the review board lists nobody yet and only ever lists verified people; corrections are published with a revision note ("Published corrections: None yet."); privacy promises no tracking cookies for reading, private notes unreadable by staff, export and deletion from My library, aggregate-only analytics; contact says an address will be published before launch.

Analytics: `info_page_viewed {slug}`.

Acceptance: legal drafts carry the banner; no religious claim is made on these pages; `/methodology#hadith` and `#licences` anchors exist.

## 404

Route: any unmatched path (`[...rest]` calls `notFound()`; also unknown prophet ids, surahs outside 1–114, bad hadith numbers, unpublished stories). Status: **Wired**.

```
[Z] QITL header
        ✸
        404
  This page is not here.
  It may have moved, or the address may be mistyped. Nothing on QITL is removed without a revision note.
  [ Search QITL… ]
  Home · Prophets · Quran
footer
```

Analytics: `not_found_viewed {path_group}` (first path segment only). Acceptance: HTTP 404 with the heading (tested).

## 500

Route: `src/app/[locale]/error.tsx`. Status: **Wired**. No header or footer (renders inside the locale layout only).

Copy: "500", "Something went wrong on our side.", "The page could not be loaded. Try again; if it keeps failing, the rest of QITL still works.", optional "Reference: [digest]", buttons Try again (`reset()`) and Home. Logs only the digest. Analytics: `error_viewed {digest_present}`.

## Offline `/offline`

Status: **Wired** in production builds (`public/sw.js` registers only when `NODE_ENV === "production"`). Network-first for page navigations; falls back to a cached copy, then `/offline`; never caches `/api`, `/admin`, `/account`, `/sign-in` or `/auth`. Copy: "Offline", "You are offline.", "Pages you opened before may still be available. Reconnect to read the rest.", link "Try again" → `/`. `noindex`. Analytics: none (offline).
