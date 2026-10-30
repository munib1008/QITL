# ProphetJourneyCard

A glass card for one stop on the Journey: the prophet's name in English and Arabic, an era tag showing how certain it is, an age marker where the Quran or an authentic hadith gives one, a summary, the related surahs with their passages, the place and its certainty, evidence labels, and two calls to action.

- Provide `name`, `arabicName`, `honorific` (`(عليه السلام)`, or `ﷺ` for the Prophet Muhammad), `subtitle`, `era` (`label` plus `certainty`: relative, estimate, traditional, exact, unknown or disputed), `summary` and `surahs`.
- `surahs[]` takes `number`, `name`, `arabic`, `passages` (ayah ranges) and `named` (true when the surah carries his name). Put the most complete telling first.
- Optional: `ageMarker`, `milestones` (dated steps, used for the Prophet ﷺ), `place`, `evidence`, `order` (marks a disputed position) and `note` (scholarly caveat).
- Collapsed (`expanded={false}` with `onToggle`) shows only the head row. The JourneyTimeline expands one card at a time.
- The motif is a geometric rosette (8, 10 or 12 points). Never use a figure, face, silhouette or animal.
- The surah list always sits on `glass-fill-strong`. Thin glass is only for the head and summary.

- `chapter` shows as "Chapter 07", or "Milestone 27" when `type="milestone"`; milestones use the emerald motif.
- Milestones take `refs[]` (`{kind: "quran" | "hadith" | "scholar", ref, label}`) instead of `surahs`. They render as a "Sources" list.
