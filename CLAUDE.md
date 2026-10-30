# CLAUDE.md — ZIQ, the Islamic Knowledge Atlas

Read this before making any change. These rules hold for every task in this repository.

## What ZIQ is

ZIQ is a free, public Islamic knowledge platform covering the Quran, authenticated Sunni Hadith, the prophets, genealogy, chronology, an atlas and the signs of the Last Hour. Reading never requires an account; accounts exist only for bookmarks, notes, progress and discussion.

- Product requirements: `MASTER_BUILD_PROMPT.md`, `PROMPT_1_DESIGN_UX.md`, `PROMPT_2_FULL_PLATFORM_BUILD.md`
- **Finalised design (the source of truth for UI):** `design/`. Start with `design/README.md`.
- **The current task:** `docs/build/01-home-journey.md`

## Non-negotiable content rules

1. **Never fabricate religious content.** That covers Quran text, translations, hadith text, hadith numbers or gradings, dates, ages, coordinates and lineage. If data is missing, render the designed "unknown" or "pending" state.
2. **Quran Arabic comes only from a verified canonical source** (for example, Tanzil), pinned by version and checksum. Never retype it, transliterate it into the Arabic field, or "fix" it.
3. **Translations are licensed per edition.** No translation text ships until `rights_status = cleared`. Until then, show "Translation unavailable — licence pending".
4. **Hadith are graded per narration, with a named grader.** A collection name is never a grade. Show every recorded grading, disagreements included.
5. **Dates:** no years before the Prophetic era unless a historian's estimate is sourced and labelled as one. Sacred history uses relative order. No countdown or year is ever given for the Last Hour.
6. **Places:** ambiguous locations are regions or "unknown". Never invent a pin.
7. **No figurative depiction** of any prophet, Companion or member of the Ahl al-Bayt. Use geometric motifs only (`Rosette`, `Star`).
8. **Honorifics:** ﷺ (U+FDFA) for the Prophet Muhammad; (عليه السلام) for other prophets; (رضي الله عنه/عنها) for Companions.
9. **Every visible claim carries an evidence label and a visible citation.** Never put a citation behind hover only.
10. **Placeholder and demo data** must be tagged DEMO or "Draft — pending scholarly review" in the UI, and must never be presented as reviewed.

## Design rules

- Tokens live in `design/tokens/tokens.json`, with a generated CSS version at `design/tokens/tokens.css`. There are three themes: `light`, `dark`, and `journey` (glass, for the home journey only). Map tokens into Tailwind (`theme.extend`) through CSS variables. Do not hard-code hex values in components.
- Component behaviour is specified in `design/components/*.md`. The working reference implementation is `design/reference/bundle.js` and `bundle.css`, with prop types in `index.d.ts`. **Port these into typed React/Next.js components; do not import the bundle at runtime.**
- Match the visual reference `design/prototype/home.html` (open it in a browser) to within about 4px of spacing and exact token colours. Where it disagrees with the specs, the spec in `design/components/*.md` and `design/brand-book.md` wins.
- Fonts (all SIL OFL): Source Serif 4, IBM Plex Sans, IBM Plex Sans Arabic, Amiri Quran, Amiri, Noto Naskh Arabic and IBM Plex Mono. Self-host them with `next/font/local` or `next/font/google`, and never ship unlicensed fonts.
- RTL is first-class: use logical CSS properties only, and put `dir="rtl" lang="ar"` on every Arabic block.
- Accessibility target is WCAG 2.2 AA: visible 2px focus ring (`--focus`), keyboard paths for everything, and full support for `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Unbuilt features render as disabled or "Coming soon". Never mock them as working.

## Engineering conventions

- Stack: Next.js (App Router), TypeScript strict, Tailwind, Supabase (Postgres + PostGIS, Auth, Storage, RLS). Supabase is not needed for the home-journey slice; that slice reads `content/journey/journey.draft.json` behind a typed loader so it can later switch to the database.
- Make small, testable commits on a feature branch, and never rewrite or delete the existing prompts or design files.
- Before every commit, run `pnpm lint && pnpm typecheck && pnpm test`. Before a PR, also run `pnpm build` and `pnpm test:e2e`.
- Never commit secrets. `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are server-only.
- When blocked by licensing or credentials, document the blocker in the PR and leave the feature visibly unavailable.
