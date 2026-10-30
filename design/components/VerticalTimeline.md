# VerticalTimeline

The ZIQ master timeline, read top to bottom: Adam at the top, today at the bottom. It is an ordered list, not a scaled axis, and says so on screen ("not to scale").

- Provide `eras` in order. Each era has a `title`, a `kind` and `items`; optional `note` and `breakAfter`. `today` is the closing label, e.g. "2026 CE · 1448 AH"; pass `false` to hide it.
- `kind: "relative"` is sacred history before recorded chronology: a dotted spine, diamond marks, "Relative order" labels and no years. Adam always opens this era. Never give it a BCE year or a span in years.
- Use `breakAfter` on the last relative era to draw the brass double-rule break where recorded chronology begins. Do not attach a year to the break unless it is sourced.
- `kind: "dated"` has a solid evergreen spine. Item marks follow precision: dot = exact, solid bar = range, hatched dashed bar = estimated, dotted ring = unknown. Show CE and AH together.
- `kind: "undated-future"` is only for a Last Hour link placed after Today. It has a dashed spine, no dates and no countdown. The Last Hour explorer owns that content.
- Every item is a button that selects the event, syncs the atlas camera and opens its card. Selected uses `aria-current` with a brass outline.
- Layout: a single column at every width, from 320px up. On desktop the timeline sits in the inline-start column with the map beside it. The spine sits on the inline-start side, so it moves to the right in Arabic.
- Long ranges: virtualise items and keep era headings sticky while scrolling. The list itself is the keyboard and screen-reader view, so no separate list view is needed.
