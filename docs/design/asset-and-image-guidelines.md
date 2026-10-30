# Asset and image guidelines

What imagery ZIQ may and may not use, the geometric motif system that replaces figurative art, the Open Graph card, fonts and their licences, the database and storage constraints on uploaded assets, and the approval workflow. Rules come from `CLAUDE.md` (content rule 7), [design/brand-book.md](../../design/brand-book.md) ("Imagery", "Iconography") and the migrations in `supabase/migrations/`.

## Imagery rules

| Allowed | Not allowed |
|---|---|
| Calligraphy, credited and licensed | Any depiction of a prophet, a Companion or a member of the Ahl al-Bayt: drawing, painting, photograph, silhouette, shadow, back view, faceless figure, hand or glowing outline |
| Geometric abstraction (the motifs below) | Animals, people or objects drawn from a story as illustration, even stylised (the Journey rules forbid "even animals or objects from a story") |
| Maps and map tiles from a recorded, licensed provider | AI-generated "ancient" scenes, reconstructions or "historical" photographs |
| Photographs of real manuscripts and real places, with source credit and licence | Fake archival photography, aged filters presented as old |
| Diagrams drawn from reviewed data (timeline marks, region hatching, genealogy lines) | Apocalyptic, sensational or "glowing" end-times imagery; contemporary geopolitical imagery for the Last Hour |
| | Stock "glowing Quran" or light-ray visuals; neon; emoji |
| | Any image placed behind Arabic text |

Additional rules:

- Quran text is never rendered as an image to avoid the verified-text pipeline. A calligraphy image is decorative or illustrative; the Quran text itself is always shown from the pinned import.
- No image carries a claim on its own. If an image supports a claim (a manuscript page, a site photograph), it sits next to the claim's evidence label and citation.
- Demo or placeholder imagery is tagged DEMO and uses geometry only.

## Geometric motif system

All motifs are inline SVG in `src/components/ui/icons.tsx`, drawn in `currentColor`, `aria-hidden="true"` and `focusable="false"`. They are decoration and never the only carrier of meaning.

| Motif | Construction | Used for |
|---|---|---|
| `Star` (eight-point khatam) | Two 10×10 squares on a 16px grid, the second rotated 45° | `ProphetCard` mark; the Quran evidence mark (reserved: as an evidence mark it appears only inside `EvidenceLabel`); the Open Graph card (outline version) |
| `Rosette` 8 | 16-vertex star polygon, outer radius 11 on a 24px box, inner radius 0.58 × 11, inner circle 0.45 × inner radius, stroke 1.1 | Default stop motif; prophet page head mark; 404 page; "Interactive atlas" feature card |
| `Rosette` 10 | inner radius 0.66 × 11 | Per-stop variety (`points: 10` in the journey JSON); "Evidence first" feature card |
| `Rosette` 12 | inner radius 0.72 × 11 | Per-stop variety; "Connected genealogy" feature card; story cover cards on `/stories` |
| Journey lattice | 96px tile: two overlapping 36px squares (one rotated 45°) and four connecting lines, gold stroke at 10% opacity, masked to fade out by 85% height; slow parallax | Background of the Journey section only |

Rules:

- Stops choose 8, 10 or 12 points through the journey `points` field; milestones render the rosette in `glow-emerald`, prophets in the default colour, the active node in `glow-gold`.
- The journey node rosette, page-head rosette and feature-card rosettes are the only "illustration" on the site.
- Evidence marks (star, filled circle, half circle, two waves, split diamond, ?) are reserved for `EvidenceLabel` and `EvidenceMark`; never reuse them as ornament.
- Ornament stays low-contrast and is never placed behind Arabic text. The lattice sits behind the Journey, whose text is on glass panels (`glass-fill` heads, `glass-fill-strong` for any text longer than three lines).
- Brass or gold ornament: at most one brass element per view region.
- Do not mirror motifs in RTL.

### Logo

No logo has been supplied. The interim mark is a "Z" in Source Serif 4 inside an outlined square (emerald on the home header, `brand` on reading pages), next to the word "ZIQ". Replace both headers and the Open Graph card together when a real mark exists.

### Icons

Line icons on a 16px grid, 1.5px stroke, inheriting `currentColor`: bookmark, bookmarked, copy, share, source, discuss, search, close, check, alert, flag, chevron up and down. Meaning-carrying icons meet 3:1 against their background. Every icon sits beside a visible word or inside a control with an accessible name.

## Open Graph card

`src/app/opengraph-image.tsx` (Next.js `ImageResponse`), referenced from the root metadata (`openGraph.images: ["/opengraph-image"]`, `twitter.card: "summary_large_image"`).

| Property | Value |
|---|---|
| Size | 1200 × 630 PNG |
| Alt | "ZIQ — The Islamic Knowledge Atlas" |
| Background | Journey `surface` `#061519` |
| Mark | Eight-point star as two outlined squares, stroke `#e6c88d` (Journey `brass`), 140px |
| Wordmark | "ZIQ", 96px, weight 600, letter-spacing 24, `#f2f8f4` (Journey `ink`) |
| Tagline | "Explore the story. Follow the evidence.", 36px, `#98b7b0` (Journey `ink-muted`) |
| Rules | No figures, no photography, no Arabic set without a loaded Arabic font |

The card uses literal hex values because `next/og` cannot read CSS variables; keep them in step with the Journey tokens by hand. It loads no custom font, so the wordmark renders in the image renderer's default face rather than Source Serif 4. Per-page cards (for example one per prophet) are not built; if added, they reuse this composition with the page title and never a depiction.

## Fonts

All faces are SIL Open Font License 1.1. They are loaded in `src/app/fonts.ts` with `next/font/google`, which downloads them at build time and self-hosts them, so no request goes to Google at runtime. Each exposes a `--ff-*` variable that `tokens.css` uses inside the `--font-*` stacks.

| Face | Role | Weights loaded | Subsets | Variable | Preload |
|---|---|---|---|---|---|
| Source Serif 4 | Display, headings, `reading` prose | 400, 500, 600 | latin | `--ff-serif` | yes |
| IBM Plex Sans | Interface | 400, 600 | latin | `--ff-plex` | yes |
| IBM Plex Sans Arabic | Arabic interface (`arabic-ui`) | 400, 600 | arabic | `--ff-plex-ar` | yes |
| IBM Plex Mono | References, numbers (`reference`) | 500 | latin | `--ff-mono` | yes |
| Amiri Quran | Quran text (`quran-ayah`, `quran-inline`) | 400 | arabic | `--ff-amiri-quran` | no |
| Amiri | Quran fallback | 400, 700 | arabic | `--ff-amiri` | no |
| Noto Naskh Arabic | Hadith and tafsir Arabic (`naskh-text`); serif fallback for Arabic in display | 400, 600 | arabic | `--ff-naskh` | no |

Rules:

- Never ship an unlicensed font, and never a Quran font whose licence forbids embedding or modification.
- Do not add a face without recording its licence here and in the source register (`sources.type = "other"` or a dedicated entry).
- All faces use `display: "swap"`; the Arabic faces skip preload because most pages show little Arabic above the fold.
- Quran text is never set in a UI face, italic, letter-spaced, truncated or clamped.
- The design prototypes import the same families from Google Fonts for convenience; production does not.

## Uploaded assets

### The `assets` table (`supabase/migrations/20261030000300_knowledge.sql`)

| Column | Constraint | Meaning |
|---|---|---|
| `storage_path` | not null, unique | Path inside the `media` bucket |
| `kind` | `image`, `manuscript`, `map` or `document` | What the asset is |
| `alt_text` | not null, at least 3 characters | Required for every asset, decorative or not |
| `credit` | not null | Visible credit line |
| `source_id` | not null, references `sources` | Links to the source register, which holds the licence, licence URL, attribution and rights status |
| `mime_type` | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` or `application/pdf` | Allowed formats |
| `bytes` | 1 to 10,485,760 (10 MiB) | Size limit |
| `depicts_person` | not null, default false, check `depicts_person = false` | The database refuses any asset flagged as depicting a person |
| `status` | `publication_status`, default `draft` | Workflow state |
| `approved_by` | references `auth.users` | Who approved it |
| `created_by`, `created_at` | — | Provenance |

`asset_links (asset_id, entity_type, entity_id, position)` attaches an asset to any `content_type` (journey stop, story, chapter, verse, hadith, event, place, person) in order.

Row-level security: readers see assets with `status = 'published'`; staff see all; editors insert only in `draft` or `in_review`; editors and reviewers update; admins delete unpublished rows. Link rows are publicly readable and editor-writable.

### Storage buckets (`supabase/migrations/20261030000700_storage.sql`)

| Bucket | Public | Size limit | Allowed types | Policies |
|---|---|---|---|---|
| `media` | yes | 10 MiB | png, jpeg, webp, svg+xml, pdf | Public read; editors upload only under `pending/`; editors update; admins delete |
| `exports` | no | 50 MiB | json | The owner reads `exports/<user id>/…`; written by a server job (the current export route streams the file directly instead) |

### Approval workflow

| # | Step | Who | Check |
|---|---|---|---|
| 1 | Register the source (work, author, licence text and URL, attribution) and set its rights status | Admin (`/admin/sources`) | Nothing from a source is shown until its rights are `cleared` or `public_domain` |
| 2 | Upload the file to `media/pending/<name>` | Editor | Bucket enforces type and 10 MiB |
| 3 | Create the `assets` row: kind, alt text, credit, source, mime type, size; `depicts_person` stays false | Editor | Database enforces alt text, allowed type, size and no depiction |
| 4 | Check the image against the rules above (no figure, no AI "ancient" scene, no image behind Arabic) and the licence against the source register | Editor | Manual |
| 5 | Move the row to `in_review` | Editor | — |
| 6 | Approve: set `approved_by` and `status = 'published'` | Scholarly reviewer or admin | Manual |
| 7 | Move the file out of `pending/` and attach it with `asset_links` | Editor | — |
| 8 | Render with its alt text, the credit and the licence visible beside it | Front end | Credit and licence are never hover-only |

Gaps to close before any image ships:

- There is no admin screen for uploading or approving assets; steps 2–7 need direct database and storage access today.
- Publishing an asset is not guarded by a trigger: unlike stories, events and geometries, nothing in the database requires `approved_by` or a cleared source before `status = 'published'`.
- The `media` bucket is public, so a file under `pending/` is readable by anyone who knows its path before approval.
- `depicts_person` is a self-declared flag; the database cannot detect a depiction, so step 4 is the real control.
- No public component renders assets yet.

### Alt text

- Describe what the image shows and why it is there: "Folio from a manuscript of [work], [library], showing [section]". Use placeholders like these until real metadata exists; never invent a manuscript, library or date.
- For calligraphy, name the text by reference ("Calligraphy of [reference]") rather than retyping Quran Arabic into the alt attribute.
- For maps, state the region and certainty in words ("Approximate region, hatched; exact site not established").
- Purely decorative motifs are inline SVG with `aria-hidden` and need no alt; uploaded assets always carry alt text because the database requires it.

### Map imagery

Base tiles come from the provider in `NEXT_PUBLIC_MAP_TILES_URL`, with its credit in `NEXT_PUBLIC_MAP_ATTRIBUTION`; both must be set or the map stays off. Record the provider as a `sources` row of type `map_tiles` with its licence. Tiles are desaturated (raster saturation −0.7, opacity 0.85) so ZIQ's certainty layers read clearly, and the attribution stays visible in the MapLibre control and in `MapLegend`.

## Screenshots and design QA artefacts

Screenshots of the current build live in [screenshots/](screenshots/) at 1440px and 390px: home hero, home journey, the Yusuf page (English and Arabic interface) and the timeline. They contain only geometric motifs, text and schematic maps. Regenerate them after any visual change to these pages, and never commit screenshots that include personal data (signed-in libraries, notes, emails).
