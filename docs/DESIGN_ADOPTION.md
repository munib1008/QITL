# Site design adoption (branch `feat/codex-foundation`)

Source: the attached static design (`qitl-design-site`: grey and white, one teal accent). The planned
`docs/UIUX_100X_PLAN.md` never reached the repository, so the decisions below are the record.

## What is ported

| Area | State |
|---|---|
| Tokens (`design/tokens/tokens.json`, generated `tokens.css`) | Paper, graphite and ink plus the single accent `#0b5560` (`#6fbac4` on dark). Real dark theme. Elevation `e0`–`e4`, radii, motion tokens. DM Sans and Manrope self-hosted. The glass "journey" theme is retired. |
| Guard tests | `tests/unit/tokens-palette.test.ts`: fails on any colour token outside paper, graphite, ink, accent, evidence and status; fails on a stray hue; WCAG contrast of the token pairs in light and dark. |
| Header | One HUD header on every route (`HudHeader`), EN, AR, UR. Command palette on Ctrl/Cmd+K and the mobile Search button, over `/api/search`. Theme toggle (cookie, read on the server). |
| Home | Design hero and symbolic journey map (`JourneyMap`). |
| Reading pages | Design page hero in `ReadingPage`. Journey list (`/prophets`), Quran index, hadith, atlas certainty board, 404 on the design layouts. Surah reader, prophet detail, search and info pages keep their features and take the design's styling. |
| Feedback | Press and hover on buttons, chips and linked cards, from motion tokens; reduced motion collapses them. |

## Decisions

- **The accent is reserved** for the primary action, the current item, progress fill and the focus ring. The Quran evidence chip is ink-filled, not accent-filled. Evidence and status colours are the only other hues.
- **Certainty is shape, not hue** (filled, hollow and dashed marks), so it never relies on colour alone.
- **Brand mark:** the header uses the design's rosette instead of the approved raster emblem.
- **No global smooth scrolling.** The design's `scroll-behavior: smooth` is not imported: it makes the Quran reader's deep links animate instead of land.
- **Inline links in running text are underlined** (colour alone cannot tell them from the text).

## Not ported (no app equivalent, or would be a mock)

Library, Paths and Saved from the design. Saved would imply working accounts and bookmarks while accounts are "coming soon".

## Known exceptions

- Lineage graph colours and the Creation Atlas scene palette keep several hues (categorical encoding and illustration).
- Legacy admin pages have not been swept for dark-theme contrast; every public route (about 100) has been, in light and dark, at 1440px and 390px.
- Two e2e tests fail identically on untouched `main` in this environment: the `/quran/12` mobile `target-size` finding on `#ayah-111`, and the Quran reader's long-surah test.
- `pnpm lint` exits non-zero because of 21 warnings that predate this work (admin components).

## Sweeping the admin screens (needs a configured environment)

The admin tools need Supabase and an editor account, so they cannot be swept without both. With them, once:

```bash
npx playwright codegen --save-storage=admin.json https://YOUR-SITE/sign-in   # sign in as an editor, then close the window
```

then, any time:

```bash
pnpm axe:sweep --base https://YOUR-SITE --routes tests/e2e/routes.ts --only /admin --storage-state admin.json --json admin-findings.json
```

It checks every `/admin` route in light and dark at 1440px and 390px (WCAG 2.2 AA), prints each finding and exits 1 if there are any. Without `--only` it sweeps all public routes too (`--skip /admin` for public only). Do not commit `admin.json`: it holds a session.
