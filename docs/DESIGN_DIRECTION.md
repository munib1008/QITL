# QITL design direction (Phase 1–2 of the redesign brief)

Status: direction and audit plan only. NO redesign has been implemented yet. The brief named a `frontend-skill` in
`openai/skills`; that skill does not exist in the repository (its tree lists 46 skills, none of them frontend-skill),
so nothing here claims to follow it. This document is my own direction, written after looking at the live homepage.

## Visual thesis

A quiet museum atlas lit from within: midnight-ink ground, warm ivory reading surfaces, emerald for structure and
trust, antique gold reserved for the one thing that matters on a screen (the primary action, a source-confidence mark,
the current point on the timeline). Material is paper, vellum and engraved line, not glass.

## Content hierarchy (home, in reading order)

1. Invitation: one sentence, one primary action ("Begin the Journey"), one secondary ("Explore the Quran").
2. Timeline: Adam to Muhammad ﷺ as a single drawn line; the dominant visual of the page.
3. Stories: prophets, people, events as an editorial index, not an equal card grid.
4. Evidence: one worked example (a claim with its verse, a graded hadith, a tafsir attribution).
5. Reading: translation comparison. 6. Life Guidance. 7. Continue learning and partners. 8. Final invitation.
Each scene has one dominant idea. Sections that cannot name their one purpose are cut.

## Interaction thesis

- Discovery: the timeline line draws as you scroll; an era reveals its context only when reached.
- Continuity: a verse, event, story and person share one visual anchor so moving between them keeps your place.
- Reading: evidence panels, footnotes and the language selector open without moving the reading position.
Every motion has a reduced-motion alternative and never hides evidence. Unknown chronology is drawn as a range or
"not established", never as a precise date.

## Typography rules

Separate scales per script (English editorial serif + UI sans; Arabic with Quranic diacritics; Urdu Nastaliq for
reading, a denser alternative for interface). Do not share size, line height or tracking across scripts.

## Observed on the live homepage (the only screen inspected visually so far)

Strengths: a strong serif headline, a restrained gold accent, one clear primary action.
Issues to fix: the hero copy is generic ("From the beginning. To the final Messenger."), no timeline visual above the
fold, body text is small and low contrast on the midnight ground, the nav is dense for 3 languages.

## Screen register (to be completed by rendering each route; none verified yet)

Proposed classes, to confirm in the browser: full redesign: home, timeline, story reader/player; refinement: Quran
reader, hadith, genealogy, atlas, dashboards; admin: keep dense and operational, restyle tokens only.

## Plan

Tokens first (colour roles, type scale per script, motion tokens), then home and timeline, then the learning
modules, then dashboards and admin; visual QA on desktop 1440 and mobile 390 in EN/AR/UR after each phase.
