# ZIQ — The Islamic Knowledge Atlas

**Explore the story. Follow the evidence.**

ZIQ is a proposed free-to-read, interactive Islamic knowledge platform connecting the Qur'an, authenticated Hadith, prophetic history, family relationships, historical maps, and the authentic teachings on the Last Hour.

## Begin development
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
Specification and finalised home design are in place. No application code yet. Next: Claude Code executes `docs/build/01-home-journey.md`.
