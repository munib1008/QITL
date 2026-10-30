# Component library

Every React component in `src/components`, with its TypeScript props contract (copied from source), its states, accessibility notes, and the `design/components/*.md` spec it implements. The reference implementation in `design/reference/bundle.js` was ported, not imported; where the port's props differ from `design/reference/index.d.ts`, the difference is listed under "Delta from the reference". Styles live in `src/styles/components.css` (shared), `home.css`, `prophet.css` and `pages.css`, all reading tokens from `src/styles/tokens.css`.

## Shared state vocabulary

| State | Rendering rule (all components) |
|---|---|
| Hover | `sage-soft` wash on buttons, list rows, filter pills and secondary or quiet buttons; links underline or darken to `ink` |
| Focus | 2px solid `--focus` outline, 2px offset (`:focus-visible` in `globals.css`); never removed. Stretched-link cards move the ring to the card with `:has(:focus-visible)` |
| Pressed | `.zq-btn:active` nudges 1px down; toggles expose `aria-pressed` or `aria-expanded` |
| Disabled | 45% opacity, `cursor: not-allowed`, and a visible reason where it matters ("Accounts coming soon") |
| Loading | `Skeleton` shaped like the content, or a button with `aria-busy` and a verb label ("Sending", "Saving", "Posting") |
| Empty | `EmptyState`: a label, one sentence, the next step |
| Error | Text with `Icon.alert` in `status-danger` (`.zq-error`, `role="alert"`), plus Retry where a retry makes sense |

## Coverage of the design specs

| Spec in `design/components/` | Implemented by |
|---|---|
| Button | `Button`, `ButtonLink` (and the `.zq-btn` classes used directly by pages) |
| CitationChip | `CitationChip` |
| Comment | `Comment` |
| EditorialStatus | `EditorialStatus`, `DraftBadge` |
| EventCard | `EventCard` (exported, not used by any page yet) |
| EvidenceDrawer | `EvidenceDrawer` |
| EvidenceLabel | `EvidenceLabel`, `EvidenceMark` |
| GenealogyLink | `GenealogyLink` |
| HadithCard | `HadithCard` |
| HadithGrade | `HadithGrade` |
| HomePage | `src/app/[locale]/page.tsx` + `JourneyHeader` |
| JourneyTimeline | `JourneyTimeline` |
| MapLegend | `MapLegend` |
| ProphetCard | `ProphetCard` |
| ProphetJourneyCard | `ProphetJourneyCard` |
| ProphetPage | `src/app/[locale]/prophets/[id]/page.tsx` |
| SearchField | `SearchField` |
| Skeleton | `Skeleton` |
| TextField | `TextField` |
| Toast | `Toast` |
| VerseCard | `VerseCard` (+ `CardActions`) |
| VerticalTimeline | `VerticalTimeline` |

Components with no design spec (designed in code): `CardActions`, `EraTag`, `DemoTag`, `EmptyState`, `ComingSoonTag`, `IconButton`, `Markdown`, every account, community, atlas, quran, shell and admin component.

---

## ui

### Button, ButtonLink (`ui/Button.tsx`)

Spec: `Button.md`.

```ts
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;   // default "secondary"
  size?: "md" | "sm";        // default "md"
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

// ButtonLink
{ href: string; variant?: ButtonVariant; size?: "md" | "sm"; icon?: IconName; className?: string; children: ReactNode }
  & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">
```

| State | Rendering |
|---|---|
| Default | primary = `brand` fill, `on-brand` text; secondary = `surface-raised` + `border`; quiet = transparent; danger = `status-danger` outline and text |
| Hover | primary darkens 12% toward `ink`; secondary and quiet take `sage-soft` |
| Pressed | 1px nudge |
| Disabled | 45% opacity, `not-allowed`, no nudge (also matches `aria-disabled="true"`) |
| Loading | disabled, `aria-busy`, spinner replaces the icon, label kept |

Sizes: md is `control-height` 40px; sm is 32px (touch targets reach 44px only through surrounding padding, see the accessibility checklist). Accessibility: one primary per view; unbuilt features render disabled with a visible "Coming soon" note. Most pages use the `.zq-btn` classes on plain `<button>`/`<Link>` elements instead of these components.

Delta from the reference: `icon` accepts every `IconName` (adds `bookmarked`, `close`, `alert`, `flag`, `chevronUp`, `chevronDown`); `onClick`, `type` and `disabled` come from the HTML attributes.

### CardActions (`ui/CardActions.tsx`, client)

No spec (from the VerseCard action row).

```ts
export interface CardActionsProps {
  reference: string;
  bookmark?: BookmarkTarget;
  sourceHref?: string;
  discussHref?: string;
}
```

Renders Bookmark (icon variant), "Copy reference" ("Copied" / "Copy failed" for 2s, `aria-live="polite"`), "Source" link, "Discuss" link. Actions without a target are omitted, never mocked. Group has `role="group" aria-label="Actions"`.

### EvidenceDrawer (`ui/EvidenceDrawer.tsx`, client)

Spec: `EvidenceDrawer.md`.

```ts
export interface EvidenceTab { label: string; count?: number; content: ReactNode; }

export interface EvidenceDrawerProps {
  claim: string;
  status?: EvidenceKind;
  tabs: EvidenceTab[];
  footer?: ReactNode;
  onClose: () => void;
  /** Theme of the scrim and panel; the journey uses its own glass theme. */
  theme?: "journey" | "light" | "dark";
}
```

| State | Rendering |
|---|---|
| Open | Portal into `document.body`; scrim `--scrim`; side drawer (max 440px, from the inline end) at ≥768px, bottom sheet (top corners rounded, max 85vh) below |
| Empty tab | The tab stays; its content says so ("No narration attached to this stop yet.") |
| Footer | `footer` prop, else the default "Reviewed content · see methodology" |

Accessibility: `role="dialog" aria-modal="true"`, labelled by the "Evidence" eyebrow, described by the claim; focus moves to Close on open, Tab is trapped, Esc and scrim click close, focus returns to the trigger; body scroll is locked; tabs follow the ARIA tab pattern (ArrowLeft, ArrowRight, Home, End; roving `tabIndex`); the panel is focusable (`tabIndex=0`).

Delta from the reference: `onClose` is required; adds `theme`. Arrow keys are not swapped in RTL.

### Markdown, safeHref (`ui/Markdown.tsx`)

No spec. `Markdown({ source }: { source: string })` renders paragraphs, `##`/`###` headings, `-` and `1.` lists, bold, italic and links as React elements, so raw HTML shows as text. `safeHref(href: string): string | null` allows same-origin paths, `#` anchors and https links (other origins open with `rel="noopener noreferrer"`).

### VerticalTimeline (`ui/VerticalTimeline.tsx`)

Spec: `VerticalTimeline.md`.

```ts
export interface TimelineItem {
  id: string;
  title: string;
  precision?: DatePrecision;
  dateLabel?: string;
  evidence?: EvidenceKind;
  href: string;
}
export interface TimelineEra {
  title: string;
  kind: "relative" | "dated" | "undated-future";
  note?: string;
  items: TimelineItem[];
  breakAfter?: string;
}
// component
{ eras: TimelineEra[]; today?: string | false; selected?: string; label?: string }  // label default "Timeline from Adam to today"
```

| State | Rendering |
|---|---|
| Relative era | Dotted spine, diamond marks, note default "Relative order only — no dates are known" |
| Dated era | Solid evergreen spine; marks by precision (dot, bar, hatched bar, dotted ring) |
| Undated-future era | Dashed spine; note default "No date is known. Order follows the texts only." (no caller uses it yet) |
| Break | Brass double rule with `breakAfter` text, `role="separator"` |
| Selected | `aria-current`, brass outline |
| Hover | `sage-soft` row wash |
| Today | Closing line "Today" + `today` text; hidden with `false` |

Accessibility: an ordered list of links (the list is the keyboard and screen-reader view); "Ordered from Adam to today · not to scale" is visible text; marks are `aria-hidden`, precision is in the visible date label.

Delta from the reference: items are links (`href`, `scroll={false}`) rather than buttons with `onClick`/`selected`; selection is a component prop. No virtualisation or sticky era headings yet.

### Cards (`ui/cards.tsx`)

#### VerseCard

Spec: `VerseCard.md`.

```ts
export interface VerseCardProps {
  surahName: string;
  reference: string;
  /** Arabic from the verified canonical source only. Null renders the "pending verified source" state. */
  arabic: string | null;
  translation?: string;
  translator?: string;
  edition?: string;
  licence?: "cleared" | "pending";
  demo?: boolean;
  actions?: Omit<CardActionsProps, "reference"> | false;
}
```

| State | Rendering |
|---|---|
| Arabic present | `quran-ayah` styling (`.zq-ar-quran`), `lang="ar" dir="rtl"` |
| Arabic null | "Arabic text not loaded — waiting for the verified Quran source to be imported." (`data-testid="arabic-pending"`) |
| Licence not cleared | No translation; "Translation unavailable — licence pending" |
| Licence cleared | Translation + "Translation: [translator] · [edition]" (or "Arabic only") |
| Demo | `DemoTag` "DEMO" |
| Actions | `CardActions` unless `actions === false` |

Delta from the reference: `arabic` may be `null`; `actions` is an object of targets instead of a boolean with `onBookmark`/`onDiscuss`; no `bookmarked` prop (the button loads its own state).

#### HadithCard

Spec: `HadithCard.md`.

```ts
export interface HadithCardProps {
  collection: string;
  number: string;
  numbering?: string;
  arabic?: string;
  translation?: string;
  gradings?: HadithGradeProps[];
  demo?: boolean;
  actions?: Omit<CardActionsProps, "reference"> | false;
}
```

States: zero gradings renders one `HadithGrade` with no props ("Grade not recorded", unknown mark); Arabic in `naskh-text` (`.zq-ar-naskh`, `lang="ar" dir="rtl"`); "Numbering: [system]" when given. The gradings list has `aria-label="Gradings"`.

#### EventCard

Spec: `EventCard.md`. Exported but not used by any route yet.

```ts
export type DatePrecision = "exact" | "range" | "estimated" | "relative" | "unknown";
export interface EventCardProps {
  title: string;
  category?: string;
  summary?: string;
  precision: DatePrecision;
  dateLabel?: string;
  start?: number;
  end?: number;
  place?: string;
  evidence?: EvidenceKind;
  references?: string[];
}
```

The mini track (`role="img"`, labelled with `PRECISION_TEXT`) draws dot, bar, hatched bar, diamond or dotted band; `place` missing → "Location: Unknown location". Track positions use `inset-inline-start`, so they mirror in RTL.

#### ProphetCard

Spec: `ProphetCard.md`.

```ts
export interface ProphetCardProps {
  name: string;
  arabicName?: string;
  honorific?: string;   // default "(عليه السلام)"
  order?: string;       // "Relative order: …" or "Order: unknown"
  mentions?: ReactNode;
  href: string;
}
```

The whole card is one link with the focus ring on the card; the visual is the eight-point `Star`, never a figure. Delta: `href` required; `mentions` is a node.

#### Comment

Spec: `Comment.md`.

```ts
export interface CommentProps {
  author: string;
  role?: string;
  time: string;
  body?: string;
  citation?: string;
  edited?: boolean;
  status?: "visible" | "hidden" | "removed";
  demo?: boolean;
  /** Present only when the viewer may act; otherwise the actions render disabled with the reason. */
  actions?: ReactNode;
}
```

| State | Rendering |
|---|---|
| Visible | Avatar initials (decorative), author, optional role as an `EditorialStatus`, time, "· edited", body, "Cites" chip, actions |
| Hidden | "Hidden while a moderator reviews a report." in place |
| Removed | "Removed by a moderator for breaking the discussion guidelines." in place |

Delta: `onReport` replaced by an `actions` slot. The doc comment says actions "render disabled with the reason", but callers omit them for signed-out readers.

#### IconButton

```ts
{ icon: keyof typeof Icon; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>
```

A `.zq-iconbtn` text-and-icon button (icon is decorative; the text is the name).

### Evidence primitives (`ui/evidence.tsx`)

Spec: `EvidenceLabel.md`, `CitationChip.md`, `HadithGrade.md`, `EditorialStatus.md`.

```ts
export interface EvidenceLabelProps {
  kind: EvidenceKind;
  lang?: "en" | "ar";   // chooses EVIDENCE_TEXT[lang]
  title?: string;
  children?: ReactNode; // overrides the word
}

export interface CitationChipProps {
  kind?: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}

export interface HadithGradeProps {
  grade?: string;
  grader?: string;
  source?: string;
  authentic?: boolean;
  varies?: boolean;
}

// EraTag
{ label: string; certainty: EraCertainty }
// EditorialStatus
export type EditorialState = "draft" | "in_review" | "approved" | "published" | "correction" | "rejected";
{ status: EditorialState; children?: ReactNode }
// DraftBadge
{ status: string }   // renders nothing for "published" or "approved"
// DemoTag: no props
```

| Component | States and accessibility |
|---|---|
| EvidenceLabel | Six kinds by word + mark + border (table in [brand-and-tokens.md](brand-and-tokens.md)); mark `aria-hidden`; `data-evidence` for tests; never hover-only |
| CitationChip | `href` → link; `onClick` → button; neither → static span (`.zq-chip-static`, default cursor, no hover change). Reference text always in `<span dir="ltr">`, mono. Optional kind prefix ("Surah", "Quran", "Cites", "About") |
| HadithGrade | `hadith` label only when `authentic` and `grader`; `scholar` when a grade exists otherwise; `unknown` "Grade not recorded" when none; "graded by **X**", source chip, "· Graded differently by other scholars" when `varies` |
| EraTag | Mark (`aria-hidden`), label, "· [ERA_TEXT]"; `data-certainty` |
| EditorialStatus | Word always shown; dot fill empty (draft, correction), half (in review), full (approved, published), square (changes requested) |
| DraftBadge | `EditorialStatus` "in_review" worded "Draft content — pending scholarly review"; `data-testid="draft-badge"` |

### Icons and motifs (`ui/icons.tsx`)

```ts
export const Icon = { bookmark, bookmarked, copy, share, source, discuss, search, close, check, alert, flag, chevronUp, chevronDown };
export type IconName = keyof typeof Icon;
export function Star(p: SVGProps<SVGSVGElement>);
export function EvidenceMark({ kind, ...p }: SVGProps<SVGSVGElement> & { kind: EvidenceKind });
export function Rosette({ points = 8, className }: { points?: 8 | 10 | 12; className?: string });
```

All are 16px-grid line icons (1.5px stroke, `currentColor`), `aria-hidden` and `focusable="false"`. Evidence marks are reserved for evidence labels. See [asset-and-image-guidelines.md](asset-and-image-guidelines.md) for the motif rules.

### Misc (`ui/misc.tsx`)

#### MapLegend

Spec: `MapLegend.md`.

```ts
export type LegendItem = "point" | "region" | "unknown" | "hypothesis" | "route";
{ title?: string; items?: LegendItem[]; attribution: string }
// title default "Location certainty"; items default ["point", "region", "unknown", "hypothesis"]
```

Words: "Verified point", "Approximate region", "Unknown location", "Historical hypothesis", "Approximate route", each with its swatch (`aria-hidden`); attribution always rendered. `section aria-label="Map legend"`. Not yet: collapsing to a button on mobile.

#### GenealogyLink

Spec: `GenealogyLink.md`.

```ts
export interface GenealogyNodeData {
  name: string;
  generation?: string;
  current?: boolean;
  unknown?: boolean;
  href?: string;
}
{ from: GenealogyNodeData; to: GenealogyNodeData; relation?: string; status?: "verified" | "disputed" | "unknown"; evidence?: ReactNode }
// relation default "parent of"; status default "verified"
```

Edge: relation word above, line (solid, 4px double, dotted), "Sourced link" / "Disputed link" / "Unknown link" below. The group has `role="group"` and an `aria-label` "[from] to [to]: [link text]". Nodes with `href` (and not current) are links; the current node is text with `aria-current`. Delta: `href` replaces `onClick`; adds the `evidence` slot.

#### TextField, SearchField

Spec: `TextField.md`, `SearchField.md`.

```ts
// TextField
{ label: string; id: string; help?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>
// SearchField
{ label?: string; placeholder?: string; defaultValue?: string; maxWidth?: number; id?: string }
// label default "Search ZIQ"; placeholder "Search prophets, surahs, hadith, places…"; maxWidth 520; id "zq-q"
```

TextField: label always visible above; help or error below linked by `aria-describedby`; error replaces help, adds `Icon.alert` and `aria-invalid`; `dir="auto"` should be passed for user text that may be Arabic (callers pass `dir="rtl"` for Arabic titles and `dir="ltr"` for ids). SearchField: `role="search"` GET form to `/search`, visually hidden label, works without JavaScript. Delta: TextField requires `id`; SearchField uses `defaultValue`.

#### Skeleton, Toast, EmptyState, ComingSoonTag

```ts
// Skeleton
{ width?: number | string; height?: number; round?: boolean }   // width "100%", height 16
// Toast
{ tone?: "info" | "success" | "error"; action?: string; onAction?: () => void; children: ReactNode }
// EmptyState
{ label?: ReactNode; title: string; children?: ReactNode; tone?: "unknown" | "soon" }  // data-testid="empty-state"
// ComingSoonTag
{ children?: ReactNode }   // default "Coming soon"
```

Skeleton is `aria-hidden` (callers set `aria-busy` on the region); shimmer stops under reduced motion. Toast: `role="alert"` for errors, else `role="status"`; check or alert icon; optional action button. EmptyState "soon" tone has a dashed border. Not yet: the 10-second skeleton-to-error switch from `Skeleton.md`, and a recovery action on error toasts (`Toast.md`).

---

## journey

### JourneyTimeline (`journey/JourneyTimeline.tsx`, client)

Spec: `JourneyTimeline.md`.

```ts
export type JourneyFilter = "all" | "prophet" | "milestone" | "dated";
export const JOURNEY_FILTERS: Array<[JourneyFilter, string]>;  // Complete journey, Prophets, Key events, Dated history
export function matchesFilter(it: JourneyItem, f: JourneyFilter): boolean;
export const HOLD_MS = 1200;
export const HYSTERESIS_PX = 48;
export const FOCUS_LINE = 0.4;
export function pickActive(distances: Array<{ id: string; d: number }>, current: string): string;

export interface JourneyTimelineProps {
  eras: JourneyEra[];
  intro?: ReactNode;
  initialActive?: string;
  scrollSync?: boolean;   // default true
  endLabel?: string | false;
  endNote?: string;
  endActions?: ReactNode;
  draft?: boolean;        // default true; sets the drawer footer wording
  label?: string;         // default "Journey of the prophets"
}
```

| State | Rendering |
|---|---|
| Active stop | Card expanded, node gold with `shadow-glow-active` and pulse, line filled to it, rail item `aria-current` |
| Inactive stop | Head row only |
| Filter | Pill `aria-pressed`; hidden stops removed; progress shows "n / visible" |
| Reveal | Only stops below the fold at load fade in; scrolled-past stops revealed |
| Drawer open | Scroll-sync paused; `EvidenceDrawer theme="journey"` with Quran, Hadith, Context tabs |
| Reduced motion | No reveal, pulse, sheen, parallax; jumps without smooth scroll |

Layout by container width: below 860px one column with the spine at the inline start and a sticky progress pill (`role="progressbar"` with value, min, max); from 860px centred line, alternating cards, the era and its certainty on the empty side; from 1180px a sticky "Your journey" rail (`nav aria-label="Jump to a stop"`) replaces the pill. Nodes are buttons labelled "[name] — show details" or "— details shown" with `aria-expanded`.

Delta from the reference: no `theme` or `filters` props (filters are always on); adds `endNote` and `draft`.

### ProphetJourneyCard (`journey/ProphetJourneyCard.tsx`)

Spec: `ProphetJourneyCard.md`.

```ts
export interface ProphetJourneyCardProps {
  item: JourneyItem;
  expanded?: boolean;     // default true
  onToggle?: () => void;
  onEvidence?: () => void;
}
```

Head: rosette (8/10/12 points; emerald for milestones; hidden under 860px), "Chapter NN" or "Milestone NN", `EraTag`, name + honorific (`lang="ar"`), Arabic name + subtitle, toggle button (`aria-expanded`, "Expand/Collapse [name]"). Body: age marker, summary, milestones list, "Related surahs" on `glass-fill-strong` (number, name, Arabic, "Named after him", passage chips) or "Sources" list for milestones, place with its certainty mark and word, evidence labels, disputed-order label, scholarly note, "Explore story" link and "View evidence" button.

Delta: takes the whole `item: JourneyItem` instead of flattened props; `onExplore` replaced by a link to `/prophets/[id]`.

---

## account

| Component | Contract | States | Accessibility |
|---|---|---|---|
| `useSession()` (`account/useSession.ts`) | `type SessionState = { status: "loading" } \| { status: "unavailable" } \| { status: "signed_out" } \| { status: "signed_in"; user: User }` | `unavailable` when Supabase env vars are missing; auth client loaded on demand | — |
| `BookmarkButton` | `{ target: BookmarkTarget; variant?: "button" \| "icon" }` | loading (disabled, `aria-busy`); unavailable (disabled + "Accounts coming soon", linked by `aria-describedby`); signed out (navigates to sign-in with intent); confirming ("You are signed in. Save this bookmark?" + Save bookmark / Not now); saved/not saved (`aria-pressed`, filled icon, "Saved"/"Bookmark"); unknown (disabled until loaded); error (rollback + `role="alert"` message) | Native buttons; one bookmarks request per page shared by every button |
| `NoteEditor` | `{ target: BookmarkTarget }` | loading (hidden); unavailable ("Notes need an account, and accounts are not open on this site yet."); signed out (sign-in link); idle "Only you can read this note."; "Saving…"; "Saved. Only you can read this note."; error "Not saved. Your text is still here." + Retry | Label is the "Private note" heading; status line is `role="status"` linked by `aria-describedby`; 20,000-character limit; unsaved-changes warning on leave |
| `ChapterProgress` | `{ chapterId: string }` | Renders only when signed in; "Your reading progress is saved to your library as you read." / "Progress saved: N%" / "Chapter completed. Saved to your library." | `aria-live="polite"` |
| `CopyCitationButton` | `{ text: string; label?: string }` (label default "Cite this page") | idle, "Citation copied", "Copy failed" (2s) | `aria-live="polite"` |
| `ShareButton` | `{ title: string; path: string }` | Native share; fallback copy "Link copied" (2s) | `aria-live="polite"` |
| `SignInForm` | no props (reads `returnTo`, `intent`, `error` from the URL) | not configured, idle, sending, sent, error, callback errors (copy in [screen-specifications.md](screen-specifications.md)) | `TextField` with help and error; errors `role="alert"`; sent card `role="status"` |
| `AccountDashboard` | `{ email: string; names: Record<string, string> }` | per-section skeleton, empty copy, partial-error line, digest saving states, delete confirmation phrase, deletion progress | Sections labelled by headings; status lines `role="status"`; destructive button `danger` and disabled until the phrase matches |

`BookmarkTarget` (from `src/lib/validation.ts`):

```ts
export const BookmarkTargetType = z.enum(["journey_stop", "story", "chapter", "quran_verse", "hadith", "event", "place", "person"]);
export const BookmarkTarget = z.object({
  type: BookmarkTargetType,
  id: z.string().min(1).max(120).regex(/^[A-Za-z0-9:_.-]+$/),
});
```

No design spec covers these; account is listed as still to design.

## community

| Component | Contract | States | Accessibility |
|---|---|---|---|
| `DiscussionPreview` | `{ contentType: BookmarkTargetType; contentId: string }` | loading (two skeletons, `aria-busy`); unavailable (503 → "Coming soon", "Discussions are not open yet."); error ("Discussions could not be loaded." + Retry); list or "No discussion yet."; signed in → "Start a discussion" form (min 4, max 160 characters, "Starting"); signed out → "Sign in to join the discussion"; always "Comments are readers' views, not verified knowledge." + guidelines link | Form labelled; errors `role="alert"` |
| `DiscussionThread` | `{ id: string }` | loading, unavailable, missing, error + Retry, empty "No comments yet.", locked tag, follow toggle (`aria-pressed`), threaded comments (indent 24px per level, max 3, logical margin), reply, edit (30 minutes), delete (browser confirm), report form, toasts | Report form is a `fieldset` with a `legend` and radio buttons; Report toggles `aria-expanded`; toast container fixed at the inline-end bottom |
| `CommentForm` (internal) | `{ label: string; initial?: string; submitLabel: string; onSubmit: (body: string, citation: string) => Promise<void>; onCancel?: () => void }` | busy "Posting", error line; citation field (`dir="ltr"`, pattern) hidden when editing | Visible labels; help text linked |
| `ReportForm` (internal) | `{ onSubmit: (reason: string, details: string) => Promise<void>; onCancel: () => void }` | Reasons radio group, details up to 1,000 characters, "Send report" (danger), Cancel | As above |

Implements `Comment.md` through `Comment`.

## atlas

| Component | Contract | States | Accessibility |
|---|---|---|---|
| `AtlasMapLoader` | `{ tilesUrl: string; attribution: string }` (dynamic import, `ssr: false`) | `Skeleton` 420px while MapLibre and its CSS load | — |
| `AtlasMap` | `interface Props { tilesUrl: string; attribution: string }` | loading, ready, `no_data` overlay "No reviewed places are published yet.", `error` overlay "The map could not be loaded." | Canvas region labelled "Atlas map. The list beside the map is the text alternative."; cooperative gestures; MapLibre attribution expanded (`compact: false`); popups built with DOM text nodes |

Layers: regions (`map-region` fill 0.45 + `slate` edge), hypotheses (`map-hypothesis` dotted line), routes (`map-route` dashed), points (`map-point` circle with `surface-raised` stroke). Base raster desaturated (−0.7) at 0.85 opacity. Unknown places are never drawn. Spec: `MapLegend.md` (legend only; the atlas itself is still to design).

## quran

### AyahReader (`quran/AyahReader.tsx`, client)

```ts
{ surah: number; surahName: string; verses: Array<{ ayah: number; text: string }>; links: Record<number, Array<{ id: string; name: string }>> }
```

Text size group (`role="group" aria-label="Arabic text size"`): "A−"/"A+" buttons labelled "Smaller/Larger Arabic text", disabled at 24px and 48px; `<output aria-live="polite">` shows the size; persisted in `localStorage` (`ziq-quran-size`). Each ayah is an `<li id="ayah-N">` with `scroll-margin-top`, the Arabic paragraph (`lang="ar" dir="rtl"`, max `measure-arabic`), and an action group: citation chip, bookmark (icon), copy reference ("Copied" for 1.5s), links to journey stops. No design spec (Quran reader still to design); follows the `quran-ayah` rules.

## shell

| Component | Contract | Notes |
|---|---|---|
| `ReadingPage` | `{ locale: string; crumbs?: Crumb[]; title?: ReactNode; kicker?: ReactNode; lead?: ReactNode; meta?: ReactNode; query?: string; children: ReactNode }` with `export interface Crumb { href?: string; label: string; }` | Header, breadcrumb (`ol aria-label="Breadcrumb"`, last item `aria-current="page"`), page head, `main#main`, footer |
| `JourneyHeader` | `{ locale: string }` | Glass header for the home page (see [information-architecture.md](information-architecture.md)) |
| `ReadingHeader` | `{ locale: string; query?: string }` | Brand, search, theme, language, account, menu, section row |
| `SiteFooter` | `{ locale: string }` | Principles, draft-Arabic notice, two link groups |
| `mainNav(t)` | returns `NavLink[]` with `export interface NavLink { href: string; label: string; }` | Nine sections |
| `MobileMenu` | `{ links: NavLink[]; label: string }` | Disclosure: `aria-expanded`, `aria-controls`, Esc closes and refocuses the button, closes on route change; links have 44px height |
| `LangToggle` | `{ locale: "en" \| "ar"; label: string }` | "EN · ع"; `aria-label` "Language: العربية" or "Language: English"; sets the `ziq-locale` cookie |
| `ThemeToggle` | `{ labels: { label: string; light: string; dark: string; system: string } }` | Cycles System → Light → Dark; `aria-label` "Theme: [current]"; text hidden under 480px |
| `AccountLink` | `{ signInLabel: string; accountLabel: string }` | Four session states; unavailable state is a disabled button with a `title` tooltip |
| `InfoPageView` | `{ params: Promise<{ locale: string }>; slug: string; crumbs?: Array<{ href?: string; label: string }> }`; `infoMetadata(slug)` | Renders `INFO_PAGES[slug]`, with a `role="note"` banner for legal drafts |
| `ServiceWorker` | no props | Registers `/sw.js` in production only |

## admin

All in `admin/tools.tsx` (client) except `AdminNav`. No design spec (admin still to design); `EditorialStatus` is the only designed primitive they use.

| Component | Contract | Behaviour |
|---|---|---|
| `AdminNav` | `{ roles: Role[] }` with `export type Role = "moderator" \| "editor" \| "scholarly_reviewer" \| "admin"` | Role list eyebrow; links filtered by role; `aria-current="page"` |
| `ReviewQueue` | `{ canReview: boolean; canEdit: boolean }` | Lists claims, events, stories, chapters, relationships in draft, in review, approved, correction or rejected; buttons by role and state; History opens `VersionDiff` |
| `VersionDiff` | `{ versions: Array<{ version: number; snapshot: Record<string, unknown>; created_at: string }> }` | Table with caption (visually hidden), `th scope`, `<del>`/`<ins>` per changed field |
| `NewEventForm` | none | Flow D form (fieldsets: Date, Claim and citations, Place) |
| `ModerationQueue` | none | Hide, Remove (danger), Restore, Dismiss reports |
| `CorrectionsQueue` | none | Accept, Reject, Duplicate with a prompted resolution note |
| `SourcesRegister` | none | Table of sources with a rights-status select per row (labelled "Rights status of [work]"); Add a source form; new sources start with rights "unknown" |
| `RolesManager` | none | Grant a role by user id with an identity-check note; Revoke (browser confirm) |
| `AuditTrail` | none | Table: When, Who, Action, Entity, Changed fields |
| `StoryComposer` | none | New story (draft); add chapter with supporting claim ids |
| `RelationshipEditor` | none | Add person; add family link with claim id, competing-lines group, tradition; "descendant of (generations not established)" |

Shared admin states: list `Skeleton`; "Could not load: [message]"; feedback line `role="status"` or `role="alert"`. Several actions use `window.prompt` and `window.confirm`, which are accessible but unstyled; a designed confirmation dialog is still to come.
