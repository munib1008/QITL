# ProphetPage

The prophet story page at `/prophets/[id]`. "Explore story" on every journey card opens it. It is a reading page, so it uses solid `light`/`dark` surfaces, not glass. Yusuf (عليه السلام) is the worked example.

- **Head:** a rosette motif; "Chapter n of 29"; the era tag with its certainty; the draft badge while content is unreviewed; the name in `display-lg` with the honorific; the Arabic name in `naskh-text`; a one-line subtitle in `reading` serif; evidence labels and citation chips; actions: Read the surah (primary), Bookmark, Cite this page, Share.
- **Position bar:** previous and next stops in journey order, plus the era and its position ("03 / Ibrahim and his family · 6 of 6"). It must agree with the JourneyTimeline order.
- **Main column** (`minmax(0,1fr)`, so a scrolling chip row can never widen the page). The sections are:
  1. **Story:** numbered movements. Each is a heading, a 1–2 sentence summary, a Quran evidence label, the ayah range as a citation chip, and "Read ayat →". Summaries paraphrase; they never quote a translation that isn't licensed.
  2. **From the Quran:** VerseCard(s) with Arabic from the verified source and the licence state shown.
  3. **From the Sunnah:** HadithCard(s), or the designed empty state ("No narration is attached to this page yet…"). Never pad this with unverified narrations.
  4. **Places:** an atlas preview with the MapLegend. Regions are hatched; unknown places get a "?" ring off-map.
  5. **Discussion:** open to read; posting requires sign-in.
- **Side column** (sticky from 1024px; below the main content on mobile): Related surahs (named surah flagged), Family (GenealogyLink stacked vertically, each edge with its evidence), and On the journey (era, certainty note, "See on the journey").
- **Mobile:** the header search collapses to a Search button; "On this page" chips scroll sideways; no horizontal page scroll at 320px.
- **Data:** everything comes from the same journey record plus a `story[]` outline (`{title, summary, ayat}`) that goes through scholarly review like every other claim.
