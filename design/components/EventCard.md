# EventCard

A timeline/atlas event: title, summary, **date precision** and a mini track, location, evidence kind, references.

- Provide `title`, `precision` (`exact | range | estimated | relative | unknown`), optional `dateLabel`, `start`/`end` (0–100 along the visible track), `place`, `evidence`, `references`.
- Sacred history before recorded chronology uses `relative` (diamond on the relative-order track) or `unknown` (dotted band) — never a BCE year.
- `place` missing → "Unknown location"; the map must show the unknown zone, not a pin.
