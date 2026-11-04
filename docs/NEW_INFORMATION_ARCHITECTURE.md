# Information architecture (as implemented)

The navigation is one table, not three lists. `src/lib/nav-groups.ts` assigns every section to one of five learning
categories; the desktop More menu, the mobile Explore sheet and the home index all read it, so a section is classified once.
Labels and one-line purposes are in `src/lib/i18n/modules/navGroups.ts` (English; Arabic and Urdu are translator drafts).
The list of sections itself is `exploreLinks()` in `src/lib/nav.ts`; administrator ordering and hiding (`applyNav`) is
applied before grouping and keeps the order inside each group.

| Category | Purpose | Sections |
|---|---|---|
| Quran | Read, understand, compare and learn | Quran reader (with page and juz views), Qira'at, translation comparison, Hadith library, Learn Quranic Arabic |
| Stories & History | Explore the complete Quranic journey | Timeline, Prophets, Stories, Hadith stories, Draft stories, Events, People, Communities, Atlas, Genealogy, Lineage, Life Through the Ages |
| Learn & Reflect | Put authentic teachings into practice | Life Guidance, Asma' al-Husna, Shifa, Dreams |
| Explore Knowledge | Creation, science and deeper subjects | Creation Atlas, Quran & Science, Signs of the Last Hour, Ancient scriptures |
| Community | Find guidance and learn with others | Community, Ask a Mufti, Learning Partners |

"My QITL" is the Profile tab and the account area, not an Explore category. Search is the header's job and is outside the
categories. Administrative tools stay in the separate `/admin` workspace.

## What is deliberately not changed

Every existing URL is unchanged: nothing was renamed, so no redirects were needed. The category headings are presentation
over the same routes.

## Reachability

`docs/ROUTE_AND_NAVIGATION_MAP.md` is generated from the code (`npx tsx scripts/route-map.ts`) and lists every page route, its
category and how it is reached; it also lists routes no navigation entry reaches. At the time of writing the only such
routes are the role-gated mufti workspace pages.

## Not done yet

The homepage is still the existing journey-and-dial page with the grouped index below it. The contextual "Related knowledge"
component, one canonical content graph shared by every module, the Learn & Reflect and Community landing pages, and the
admin console reorganised by task are not built.
