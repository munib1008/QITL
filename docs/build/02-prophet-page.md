# Build brief 02 — Prophet story page `/prophets/[id]`

**Before you start:** brief 01 must be merged. Spec: `design/components/ProphetPage.md`. Visual reference: `design/prototype/prophet.html`.

1. **Data:** extend the `ziq.journey.v1` Zod schema with an optional `story[]` (`{title, summary, ayat}`). The page reads the journey record by `id`. Prev/next come from the flattened journey order.
2. **Route:** use `generateStaticParams` for all 29 stops. Milestone stops use the same template, with "Sources" in place of "Related surahs" and no family card. A missing `story` renders the designed empty state, never generated text.
3. **Components:**
   - New: PageHeader, JourneyPositionBar, StoryOutline, SectionToc, RelatedSurahsCard, FamilyCard (GenealogyLink, stacked vertically) and AtlasPreview (static image or MapLibre lazy-loaded below the fold).
   - Reused: VerseCard, HadithCard, EvidenceLabel, CitationChip, MapLegend and Comment (read-only until auth exists).
4. **Licensing:** VerseCard shows Arabic only from the verified Quran source. Translation text stays hidden until rights are cleared.

## Acceptance tests

- `/prophets/yusuf` shows "Chapter 11 of 29", previous Yaqub, next Ayyub, and 8 story steps, each with a Quran label and an ayah chip.
- The hadith section shows the empty state when no reviewed narration is attached.
- There is no horizontal scroll at 320px and 390px; the header search collapses to a button below 640px.
- The side column is sticky at 1024px and wider, and sits below the main column on mobile.
- The draft badge is visible while `status = draft`.
- axe reports zero violations, and every section is reachable from the TOC chips by keyboard.
