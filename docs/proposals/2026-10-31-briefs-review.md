# Review of three new briefs (2026-10-31)

Comments on the briefs for a trilingual design system, Life Guidance and a Dream Understanding centre, before anything is
built. Each section says what fits the existing platform, what to change, and what it would need.

## 1. One design system in English, Arabic and Urdu

**Agree, with one structural change: three separate language preferences.** Interface language, Quran translation language
and narration language should be independent settings (the brief's own closing recommendation). The schema already has the
pieces: `story_playback_preferences.language` for narration; translation editions carry their own `language`. Interface
language is the `qitl-locale` cookie today and would move to the profile when signed in.

What Urdu needs, beyond adding `ur` to `src/lib/i18n`:
- **Nastaliq type** (e.g. Noto Nastaliq Urdu via `next/font`) with taller line height than Naskh Arabic; Nastaliq needs about
  1.9–2.2 line height and does not tolerate letter spacing. Quranic Arabic stays in the Quran font even inside the Urdu UI.
- **RTL is already handled** by logical CSS properties (the mobile pass used them throughout); Urdu reuses that.
- **Reviewed strings.** The Arabic UI strings are still marked as a draft needing a qualified translator; Urdu needs the same.
  Lara can draft them, a human reviews them, and religious terms come from `translation_glossary`.
- **Urdu translations of the Quran and hadith** are licensed texts like any other (e.g. specific published translations);
  they appear only when their edition is verified and cleared.

The current site already uses one token set and one component library across pages; the main gap is the admin pages, which
are functional but not yet styled to the same level on phones (see `docs/RESPONSIVE.md`).

## 2. Life Guidance

**A good companion to the timeline, if it keeps three layers visibly apart:** what the verse says (revelation), what
recognised scholars explain (interpretation), and the everyday application (QITL's educational suggestion, clearly labelled
as such). That is the same split the story takeaways already use ("educational application").

The references in the brief check out as the passages it describes: 2:37 (Adam's repentance), 71:5–9 (Nuh's long call),
21:51–70 (Ibrahim and the idols), Surah Yusuf, 21:83–84 (Ayyub), 20:25–36 (Musa's supplication), 21:87–88 (Yunus), 11:84–85
(Shu'ayb and fair measure), 27:19 (Sulayman's gratitude), 3:159 (gentleness and consultation), 3:134 (restraining anger). The
point that the prophets named in the Quran are not all the prophets (4:164; 40:78) is right and worth stating.

Cautions:
- **It must not become fatwa or therapy.** Topics such as illness, guilt, anger or money can touch on personal rulings and on
  mental-health crises. Each topic page needs a route to a qualified scholar (Mufti Q&A) for rulings, and pages on distress need
  a visible, non-religious recommendation to seek medical or mental-health help, with crisis resources.
- **No personalised answers by AI.** Claude may help editors draft a lesson from approved sources; readers get reviewed pages,
  not generated advice.
- **Schema:** this fits as a new content type over existing claims (topic → linked verses, stories, takeaways), reusing
  `evidence_claims`, review and publish guards. No new evidence rules are needed.

## 3. Dream Understanding & Interpretation Centre

**The brief draws the right line:** teach what the Quran and authentic Sunnah establish about dreams, and never claim to know
what an individual dream means. Naming it "Dream Understanding", with "Request interpretation" as the separate private service,
is right.

Sources: the three kinds of dream are in Sahih Muslim 2263; guidance on pleasant and unpleasant dreams (praise Allah for a good
one, seek refuge and not relate a bad one) is in Sahih al-Bukhari's Book of Dream Interpretation. Each citation must be checked
against the licensed edition's numbering before it is shown; numbering differs between editions (`hadith_number_variants`).
The Quranic examples listed (12:4–6, 12:36–42, 12:43–49, 12:100, 37:102–107, 48:27) are correct references.

How it would fit what exists:
- **Reuse the Mufti Q&A model** (verified scholars, assignment, independent review, private visibility) with a separate
  qualification flag for dream interpretation, as the brief asks. The brief's tables (`dream_requests`, consents, assignments,
  responses, second opinions, status history, privacy preferences) map onto it closely.
- **Privacy is stricter than Q&A:** dream text is personal data. Store it encrypted at rest (pgsodium or application-level),
  keep audit logs free of the text, give users deletion and export, set a retention limit, never use it for training, never
  index it in search. Scholars see only requests assigned to them.
- **AI limits**, as in the brief: retrieve and explain teachings, summarise or translate a question only with consent; never
  interpret, predict, diagnose or classify a dream.
- **Wellbeing:** recurring nightmares or distress get a recommendation to seek medical or mental-health support alongside the
  Sunnah guidance; no frightening imagery anywhere in the module.
- **Symbol library:** limited to dreams interpreted within revelation (mainly Surah Yusuf), each with why its meaning cannot be
  transferred to someone else's dream, as the brief says. Books attributed to Ibn Sirin are not treated as authenticated.

## Suggested order

1. Quran text import (waiting on the owner's choice of source and acceptance of its terms); everything verse-based depends on it.
2. Mufti Q&A pages (schema done), then the Dream Centre on the same model.
3. Urdu interface and the three language preferences.
4. Life Guidance pages, once reviewed lessons exist.
