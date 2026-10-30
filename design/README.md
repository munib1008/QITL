# ZIQ design — finalised handoff

This folder is the source of truth for ZIQ's UI. It was exported from the ZIQ design system artifact; edit the design system first, then re-export here.

## Where to start

1. `prototype/home.html` and `prototype/prophet.html`: open them in a browser. Both are self-contained and work offline (fonts fall back without a network).
   - `home.html` is the finalised home page: hero, the glass Journey from Adam to the passing of the Prophet ﷺ, feature cards and footer.
   - `prophet.html` is the prophet story page, with Yusuf as the worked example.
2. `brand-book.md`: principles, content rules, colour, type, spacing, the Journey (glass) rules, RTL, imagery, iconography and accessibility.
3. `evidence-model.md`: the six evidence kinds, and how dates, places, genealogy and hadith gradings are shown.
4. `components/*.md`: one spec per component: what it shows, which props it takes, and its states and behaviour.
5. `tokens/tokens.json`: every token in three themes (`light`, `dark`, `journey`). `tokens/tokens.css` is generated from it.
6. `reference/bundle.js`, `bundle.css` and `index.d.ts`: the working reference implementation (React 18, classic script) and its prop types. Port it; do not ship it.
7. `prophet-journey.md` and `../content/journey/journey.draft.json`: the Journey content, 29 stops. **DRAFT**, pending scholarly review.

## Component inventory

| Group | Components |
|---|---|
| Pages | HomePage, ProphetPage |
| Journey | JourneyTimeline, ProphetJourneyCard |
| Timeline | VerticalTimeline (master timeline, Adam to today) |
| Evidence | EvidenceLabel, CitationChip, HadithGrade, EvidenceDrawer |
| Content | VerseCard, HadithCard, EventCard, ProphetCard |
| Atlas | MapLegend |
| Genealogy | GenealogyLink |
| Editorial | EditorialStatus |
| Community | Comment |
| Forms | Button, TextField, SearchField |
| Feedback | Skeleton, Toast |

## Open design items (not blockers for the home slice)

- **No logo yet.** The "Z" monogram in an emerald outlined square is interim.
- The prophet story page is designed (ProphetPage). Still to design: Quran reader, Hadith explorer, atlas, genealogy explorer, Last Hour explorer, account and admin. They will be added here before those phases are built.
- Arabic interface copy needs translation and review. Today only Arabic names and Quran text are Arabic.
