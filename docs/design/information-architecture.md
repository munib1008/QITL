# Information architecture

The complete site map of QITL, the route that implements each area today, how the Arabic locale works, how views link to each other, and the content model behind them. Screen-level detail is in [screen-specifications.md](screen-specifications.md); flows are in [interaction-flows.md](interaction-flows.md).

Status words used in this document:

| Word | Meaning |
|---|---|
| **Wired** | Works today from data that ships with the repository (journey JSON, info pages, catalogue constants). |
| **Needs Supabase** | Implemented against the database; without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` it renders a designed "not configured" or "Coming soon" state. |
| **Needs import** | Needs the verified Quran import (`scripts/import-quran.ts` writing `content/quran/`); the folder is not in the repository, so these screens show "Source not imported". |
| **Needs map tiles** | Needs `NEXT_PUBLIC_MAP_TILES_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION`. |
| **No finalised visual** | Built in code, but `design/README.md` lists the area as still to design. |

## Site map

```
/                                   Home (Journey, glass theme)
├── /prophets                       Prophets index
│   └── /prophets/[id]              Prophet story page (29 static ids from the journey)
├── /timeline?selected=<id>         Master timeline, Adam to today
├── /atlas?focus=<id>               Atlas: place list + map
├── /genealogy?focus=<slug>         Genealogy explorer
├── /stories                        Stories library
│   └── /stories/[slug]?chapter=<n> Story reader
├── /quran                          Surah list
│   └── /quran/[surah]#ayah-<n>     Ayah reader (1–114, static)
├── /hadith                         Seven collections
│   └── /hadith/[collection]?n=<n>  Collection page
│       └── /hadith/[collection]/[number]  One narration
├── /last-hour                      Signs of the Last Hour
├── /compare?ref=<surah:ayah>       Compare translations
├── /search?q=<text>&facet=<f>      Faceted search
├── /community                      Discussions
│   ├── /community/[id]             Thread (uuid)
│   └── /community/guidelines       Discussion guidelines
├── /sign-in?returnTo=&intent=&error=   Passwordless sign-in
├── /auth/callback                  (route handler, no page)
├── /account                        My library
│   └── /account/unsubscribed?ok=   Unsubscribe result
├── /admin                          Editorial shell (role-gated)
│   ├── /admin/review   /admin/events/new   /admin/stories   /admin/relationships
│   └── /admin/moderation   /admin/corrections   /admin/sources   /admin/users   /admin/audit
├── /about  /methodology  /review-board  /corrections  /terms  /privacy  /accessibility  /contact
├── /offline                        Service-worker fallback
├── 404 (not-found.tsx; any unmatched path via [...rest])
└── 500 (error.tsx)
```

Every page route exists twice: under the English default and under `/ar` (see "Locale mechanism").

## The 15 areas of the brief

| # | Brief area | Routes | Status today | Finalised visual in `design/` |
|---|---|---|---|---|
| 1 | Global shell | `ReadingHeader`, `JourneyHeader`, `SiteFooter`, `MobileMenu`, breadcrumb in `ReadingPage`, skip link, `ServiceWorker` | Wired. Account entry shows a disabled "Sign in" without Supabase | Partly: the home nav and prophet-page header are designed; the reading shell on other pages extends them |
| 2 | Home | `/` | Wired (journey JSON). Feature cards labelled "Coming soon" | Yes (`HomePage`, `JourneyTimeline`, `ProphetJourneyCard`) |
| 3 | Interactive timeline | `/timeline?selected=<stop id>` | Wired from the journey JSON. Zoom, layers, compare and map sync are not built | Component only (`VerticalTimeline`); page composition is new |
| 4 | Atlas | `/atlas?focus=<stop id>` | Place list wired; map needs tiles and Supabase | No (listed as still to design); `MapLegend` is designed |
| 5 | Prophets index and profile | `/prophets`, `/prophets/[id]` | Wired. Quran card needs import; hadith section is the designed empty state | Profile yes (`ProphetPage`); index uses `ProphetCard` |
| 6 | Genealogy explorer | `/genealogy?focus=<slug>` | Needs Supabase (`person_graph` RPC) | No; `GenealogyLink` is designed |
| 7 | Stories | `/stories`, `/stories/[slug]?chapter=<n>` | Index lists journey outlines (wired); full stories need Supabase | No |
| 8 | Quran explorer | `/quran`, `/quran/[surah]` | Needs import; translations and tafsir show licence-pending states | No (listed as still to design) |
| 9 | Hadith explorer | `/hadith`, `/hadith/[collection]`, `/hadith/[collection]/[number]` | Catalogue wired; narrations need Supabase | No (listed as still to design); `HadithCard`, `HadithGrade` designed |
| 10 | Last Hour explorer | `/last-hour` | Needs Supabase; renders the explainer and an empty state | No (listed as still to design) |
| 11 | Compare and search | `/compare?ref=`, `/search?q=&facet=` | Search wired over journey content, extended by the database index; compare shows Arabic only after import and translations only once licensed | No; `SearchField` designed |
| 12 | Community | `/community`, `/community/[id]`, `/community/guidelines` | Guidelines wired; threads need Supabase | `Comment` designed; pages not |
| 13 | Auth and account | `/sign-in`, `/auth/callback`, `/account`, `/account/unsubscribed` | Needs Supabase | No (listed as still to design); `TextField` designed |
| 14 | Editorial and admin | `/admin/*` | Needs Supabase and a staff role | No (listed as still to design); `EditorialStatus` designed |
| 15 | About, methodology, legal, errors | `/about`, `/methodology`, `/review-board`, `/corrections`, `/terms`, `/privacy`, `/accessibility`, `/contact`, 404, 500, `/offline` | Wired (static content in `src/content/pages.tsx`); legal pages carry a "Draft for review…" banner | No |

Brief items with no route yet: timeline zoom, compare mode, source layers and map sync; the map's epoch slider and source drawer; saved places and saved collections (tables exist: `saved_collections`, `saved_collection_items`); a notifications inbox (`notifications` table exists); appeals (`appeals` table exists); a public "Report an error" control (the API `POST /api/admin/corrections` exists, no UI calls it); a map polygon editor (the event form takes typed coordinates); a hadith grading editor; an asset upload screen.

Home copy note: the brief proposed the hero "Explore the story. Follow the evidence." with "Begin with Adam" and "Open the Atlas". The finalised `design/components/HomePage.md` supersedes it with "From the beginning. / To the final Messenger.", "Begin the journey" and "How it works"; the code follows `HomePage.md`. The brief's tagline survives in the site metadata and the Open Graph card.

## Global navigation

| Element | Home (`JourneyHeader`) | Reading pages (`ReadingHeader`) |
|---|---|---|
| Brand | "Z" monogram (interim, no logo yet) + "QITL" + tagline, links to `/` | "Z" monogram + "QITL", links to `/` |
| Primary links | The Journey (`#journey`), Explore (`#explore`), Methodology (`/methodology`); hidden under 860px | Section row (from 1024px): Prophets, Timeline, Atlas, Quran, Hadith, Stories, Genealogy, Last Hour, Community |
| Search | None in the header | `SearchField` (GET form to `/search`); collapses to a Search link under 640px |
| Language | `LangToggle` "EN · ع" | `LangToggle` |
| Theme | None (the page owns the journey theme) | `ThemeToggle` System / Light / Dark |
| Account | None | `AccountLink`: "Sign in" (→ `/sign-in?returnTo=<path>`), "My library" (→ `/account`), or disabled when Supabase is not configured |
| Call to action | "Begin exploring" → `/prophets` (hidden under 860px) | None |
| Small screens | `MobileMenu` (all sections) under 861px | `MobileMenu` under 1024px |
| Footer | Principles line + About, Methodology, Privacy, Accessibility | `SiteFooter`: principles, draft-Arabic notice in Arabic UI, About / Source methodology / Scholarly review board / Corrections, Terms / Privacy / Accessibility / Contact, "Corrections? Every page has a revision history." |

Breadcrumbs: every `ReadingPage` renders "Home › …" from its `crumbs` prop; the last crumb has `aria-current="page"`.

## Locale mechanism

| Step | Behaviour (`src/middleware.ts`) |
|---|---|
| `/ar` or `/ar/...` | Always Arabic; served as is from the `[locale]=ar` segment. |
| `/en` or `/en/...` | 308 redirect to the unprefixed path. |
| Any other page path | Rewritten internally to `/en/...` or `/ar/...` according to the `qitl-locale` cookie (`ar` → Arabic, anything else → English). The URL the reader sees does not change. |
| Excluded | `/api/*`, `/auth/*`, `/_next/*` and any path with a file extension. |
| Auth refresh | When Supabase is configured and an `sb-*` cookie exists, the middleware refreshes the session. |

- `LangToggle` writes `qitl-locale=<en|ar>; path=/; max-age=31536000; samesite=lax`, strips a leading `/ar` from the current path, navigates and refreshes.
- `src/app/[locale]/layout.tsx` sets `<html lang dir>` from the segment (`ar` → `rtl`). Both locales are statically generated (`generateStaticParams`).
- `stripLocale()` removes `/en` or `/ar` before a path is used as `returnTo`.
- Interface strings come from `src/lib/i18n/dict.ts` (`en` reviewed; `ar` a draft pending review, announced in the footer). Page copy, info pages and content remain English inside the Arabic shell; Arabic names and Quran text are Arabic in both.
- Content language is set per block with `lang` and `dir`, independent of the interface language.
- Metadata: `alternates.languages` maps `en` → `/` and `ar` → `/ar`; the sitemap lists both variants of every public path.

Known limitation: links inside the app are plain paths. A reader who opens an `/ar/...` URL directly without the cookie set is returned to English on the next internal link, because the middleware sets no cookie on `/ar` visits.

## Cross-navigation

| From | Link or control | To |
|---|---|---|
| Home journey card | Explore story | `/prophets/[id]` |
| Home journey card | View evidence | `EvidenceDrawer` (Quran, Hadith, Context tabs) |
| Home journey card, drawer | `Q s:a–b` chip | `/quran/[s]#ayah-[a]` |
| Home end of journey | Continue to the atlas / Explore Quran references / View all prophets | `/atlas`, `/quran`, `/prophets` |
| Home feature cards | Interactive atlas / Evidence first / Connected genealogy | `/atlas`, `/methodology`, `/genealogy` |
| Prophets index | Card | `/prophets/[id]` |
| Prophet page | Read Surah [name] or Read the ayat | `/quran/[n]` or `/quran/[s]#ayah-[a]` |
| Prophet page | Position bar Previous / Next | `/prophets/[prev]`, `/prophets/[next]` |
| Prophet page | Story step chip, "Read ayat →" | `/quran/[s]#ayah-[a]` |
| Prophet page | Family card | `/genealogy?focus=[id]` |
| Prophet page | See on the journey / On the timeline | `/#[id]`, `/timeline?selected=[id]` |
| Timeline item | Item link | `/timeline?selected=[id]` (no scroll) |
| Timeline selected card | Read the story / Show on the atlas / Next: … | `/prophets/[id]`, `/atlas?focus=[id]`, `/timeline?selected=[next]` |
| Timeline footer note | Last Hour explorer | `/last-hour` |
| Atlas place list | Stop name | `/prophets/[id]#places` |
| Quran surah page | On the journey: stop name, chip | `/prophets/[id]`, `#ayah-[n]` |
| Ayah row | Stop link, citation chip | `/prophets/[id]`, `#ayah-[n]` |
| Hadith collection | Go to a narration | `/hadith/[c]/[n]` |
| Genealogy edge | Node name (when the person is a journey stop) | `/genealogy?focus=[slug]` |
| Genealogy empty state | Prophet name | `/prophets/[focus]` |
| Last Hour | Q 7:187 chip; methodology link | `/quran/7#ayah-187`, `/methodology` |
| Search result | Title | the result's `url` (prophet, surah, story, event) |
| Any discussion preview | Thread title / Start discussion | `/community/[id]` |
| Thread | "About" chip | the content it is attached to |
| Any signed-out personal action | Bookmark / Sign in | `/sign-in?returnTo=<path>[&intent=bookmark:<type>:<id>]` |
| My library | Bookmark, note, progress rows | the target page |
| Admin overview tiles | Count tile | `/admin/review`, `/admin/moderation`, `/admin/corrections` |

## Content model

### Today: files in the repository

| Source | Loader | Feeds |
|---|---|---|
| `content/journey/journey.draft.json` (schema `ziq.journey.v1`, `status: "draft"`) | `src/content/journey.ts` (`getJourney`, `journeyStops`, `findStop`), validated by zod at build | Home, prophets, timeline, atlas list, stories outlines, search, Quran "cited surahs", sitemap, `/api/journey` |
| `content/quran/source.json` + text file + `surahs.json` (not present until imported) | `src/content/quran.ts` (`quranSource`, `ayahArabic`, `surahArabic`, `surahList`, `basmala`); checks the SHA-256 checksum | Quran pages, compare, verse cards, hero Basmala, `/api/quran/[s]/[a]` |
| `COLLECTIONS` in `src/lib/data/hadith.ts` | constant | Hadith index and collection pages |
| `INFO_PAGES` in `src/content/pages.tsx` | constant | Info pages and guidelines |
| `src/lib/i18n/dict.ts` | constant | Interface strings |

Journey item fields: `id`, `type` (`prophet` or `milestone`), `chapter` ("01"–"29"), `dated`, `name`, `arabicName`, `honorific`, `subtitle?`, `era {label, certainty}`, `ageMarker?`, `summary`, `milestones?[] {when, text, certainty}`, `surahs?[] {number, name, arabic, passages[], named?}` (required for prophets), `refs?[] {kind, ref, label}` (required for milestones), `place? {name, certainty}`, `evidence?[]`, `order? {label, disputed?}`, `note?`, `points?` (8, 10 or 12), `story?[] {title, summary?, summary_status?, ayat}`. The 29 stops sit in six eras.

### Later: Supabase entities (`supabase/migrations/*.sql`)

| Group | Tables, views and functions |
|---|---|
| Foundation | enums `evidence_kind`, `publication_status` (draft, in_review, approved, published, correction, rejected, archived), `date_precision`, `geometry_precision` (point, region, route, hypothesis, unknown), `rights_status`, `app_role`, `content_type`; `profiles`, `role_assignments`, `has_role()`, `is_staff()`, `audit_logs` |
| Sources and texts | `sources` (rights, licence, verification), `source_versions` (pinned version + checksum), `source_import_jobs`, `quran_surahs`, `quran_verses` (immutable), `quran_translations`, `tafsir_entries`, `hadith_collections/books/chapters/entries`, `hadith_number_variants`, `hadith_translations`, `hadith_gradings`, view `hadith_grade_summary`; `source_publishable()` gates licensed text |
| Knowledge | `evidence_claims`, `claim_references` (Quran ranges checked), `editorial_reviews`, `people`, `person_aliases`, `relationships` (with `competing_group`, `tradition`), `locations`, `place_geometries` (PostGIS, unknown = no geometry, minimum region area), `historical_events` (date rules in check constraints), `event_people/places/relationships/claims`, `topics`, `stories`, `chapters`, `chapter_claims`, `event_stories`, `taggings`, `glossary_terms`, `assets`, `asset_links`, `content_versions`, `revision_notes`, `correction_requests`; publish guards `guard_claim_status()` and `guard_entity_publish()` |
| Users and community | `bookmarks`, `reading_progress`, `private_notes`, `saved_collections`, `saved_collection_items`, `notification_prefs`, `notifications`, `discussions`, `comments`, `comment_revisions`, `reactions`, `discussion_follows`, `reports`, `moderation_actions`, `user_blocks`, `bans`, `appeals`, `rate_limit_events`, view `comments_public`, `moderate()`, `export_my_data()`, `unsubscribe()`, `feature_flags`, `site_settings`, `legal_documents`, `legal_acceptances`, `data_jobs` |
| Search | `search_index`, `normalize_arabic()`, `normalize_latin()`, `search()` |
| Storage | buckets `media` (public read) and `exports` (owner read) |
| RPC | `atlas_places(bbox, at_year)`, `person_graph(person_slug, depth)` |

Identifiers that link the two worlds: bookmark, note and discussion targets use `content_type` plus a text id. Journey stops use their journey `id` (`journey_stop:yusuf`); Quran verses use `surah:ayah`; hadith use `collection:number`; stories use the slug; chapters use the uuid. The genealogy explorer passes a journey stop id as the person slug, so `people.slug` is expected to match journey ids.

### API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/journey` | GET | Journey JSON (public, cached 1h) |
| `/api/search?q&facet&page` | GET | Journey + database search with facet counts |
| `/api/quran/[surah]/[ayah]` | GET | Arabic from the import + cleared translations; 503 `source_not_imported` |
| `/api/hadith/[collection]/[number]?numbering` | GET | One narration with every grading; flags `ambiguous` numbering |
| `/api/events?category&precision&from&to` | GET | Published events |
| `/api/last-hour` | GET | Signs, `date: null` always |
| `/api/atlas/places?bbox&year` | GET | GeoJSON features + `unknown[]` list |
| `/api/people/[id]/graph?depth` | GET | Genealogy graph |
| `/api/stories/[slug]` | GET | Published story with chapters and claims |
| `/api/discussions` | GET, POST | List threads (public) / start a thread |
| `/api/discussions/[id]/comments` | GET, POST | Thread (public) / post a comment |
| `/api/discussions/[id]/comments/[commentId]` | PATCH, DELETE | Edit within 30 minutes / delete own |
| `/api/follows` | POST | Follow or unfollow |
| `/api/reports` | POST | Report a comment or thread |
| `/api/me/bookmarks` | GET, POST, DELETE | Own bookmarks |
| `/api/me/notes`, `/api/me/notes/[id]` | GET, POST / PATCH, DELETE | Own private notes |
| `/api/me/progress` | GET, PATCH | Own reading progress |
| `/api/me/export` | POST | Download own data as JSON |
| `/api/me/delete` | POST | Delete account (confirmation phrase) |
| `/api/unsubscribe?token` | GET, POST | One-click digest unsubscribe |
| `/api/admin/events` | POST | Editor: create event, claim, references, place |
| `/api/admin/review` | POST | Reviewer: record a review decision |
| `/api/admin/status` | POST | Editor: move an entity through the workflow, optional revision note |
| `/api/admin/moderate` | GET, POST | Moderator: open reports / apply a decision |
| `/api/admin/corrections` | GET, POST, PATCH | Editor queue / any signed-in reader submits / editor resolves |
| `/auth/callback` | GET | Exchange the sign-in code, return to `returnTo` with `intent` |

Errors share one shape: `{ error, code, issues? }` with 401 `unauthorized`, 403 `forbidden` or `bad_origin`, 404 `not_found`, 422 validation, 503 `not_configured`.
