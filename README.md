# ZIQ — The Islamic Knowledge Atlas

**Explore the story. Follow the evidence.**

ZIQ is a proposed free-to-read, interactive Islamic knowledge platform connecting the Qur'an, authenticated Hadith, prophetic history, family relationships, historical maps, and the authentic teachings on the Last Hour.

## Run it

Requirements: Node 20.11+ and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # optional: leave Supabase empty to run without accounts
pnpm dev                     # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` and `pnpm start` | Production build (regenerates tokens first) and server |
| `pnpm tokens` | Regenerate `src/styles/tokens.css` from `design/tokens/tokens.json` |
| `pnpm lint`, `pnpm typecheck` | ESLint, TypeScript strict |
| `pnpm test` | Unit, component and database tests; the database tests run the real migrations and RLS on PGlite with PostGIS, so no Docker is needed |
| `pnpm test:e2e` | Playwright end-to-end and axe accessibility tests (desktop 1440px and mobile 390px) against a production build |
| `pnpm tsx scripts/import-quran.ts --pin` | Import the verified Quran text from Tanzil, pinned by checksum (read the Tanzil terms first) |

Without Supabase the site runs read-only on the journey content, and every database feature shows a visible "not configured" state. To connect accounts, discussion and the editorial tools, follow **[docs/engineering/supabase-setup.md](./docs/engineering/supabase-setup.md)**.

## Where things are

| Path | Contents |
|---|---|
| `src/app/[locale]/` | Pages (English at `/`, Arabic at `/ar/`, chosen by `src/middleware.ts`) |
| `src/app/api/` | API routes ([reference](./docs/engineering/api.md)) |
| `src/components/` | UI primitives ported from `design/reference`, journey, account, community, atlas, Quran, admin |
| `src/content/` | Typed content loaders (journey JSON, verified Quran import, editorial pages) |
| `supabase/migrations/` | Schema, RLS, publish guards, search, storage ([data model and ER diagram](./docs/engineering/data-model.md)) |
| `tests/` | `unit/`, `db/` (PGlite + PostGIS), `e2e/` (Playwright + axe) |
| `docs/design/` | Design deliverables: tokens, information architecture, screen specs, flows, components, responsive/RTL/accessibility, assets |
| `docs/engineering/` | API, data model, threat model, Supabase setup and deployment |
| `docs/editorial/` | Editorial policy and licence register |
| **[docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md)** | What works, what is blocked by source rights or credentials, and what is upcoming |

## Product requirements
Read **[MASTER_BUILD_PROMPT.md](./MASTER_BUILD_PROMPT.md)** for the complete product requirements, visual language, features, routes, schema, source policy, accessibility, moderation, implementation phases and acceptance criteria.

## Design (finalised for the home slice)
- **[CLAUDE.md](./CLAUDE.md)**: rules for Claude Code (content integrity, design, engineering).
- **[design/](./design/README.md)**: tokens (light, dark, journey), brand book, evidence model, component specs, reference implementation, and the home prototype (`design/prototype/home.html`).
- **[docs/build/01-home-journey.md](./docs/build/01-home-journey.md)**: the first build brief, covering the scaffold and the Home Journey from Adam to the passing of the Prophet ﷺ.
- **[content/journey/journey.draft.json](./content/journey/journey.draft.json)**: the Journey content (29 stops). Draft, pending scholarly review.

## Core principles
- Guest access to stories, search, timeline, atlas, Qur'an and Hadith.
- Optional login for bookmarks, notes, progress and discussions.
- Every factual religious assertion traceable to primary evidence.
- Clearly differentiate Qur'an, authenticated Hadith, scholarly explanation, historical approximation, disagreement and the unknown.
- Seven Sunni Hadith collections as initial catalog: Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah and Muwatta Malik. Grade hadith individually.
- Location uncertainty represented as a zone or explicitly unknown, never a fabricated coordinate.
- No imagined dates for unknown eras or the Last Hour; no figurative depictions of prophets.
- Translation and dataset rights must be verified prior to republication.

## Current status
The application is built on `feat/platform-foundation`: the home journey and prophet pages from the finalised design, every route in the site map, the Supabase schema with RLS and publish guards, accounts, discussion, moderation and the editorial tools. Religious text that needs a licence or the verified import is deliberately not shown yet. See **[docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md)**.
