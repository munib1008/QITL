> **Historical document.** Written for ZIQ, the project's earlier name; the product is now **QITL — Quran in Timeline**. It is kept unchanged as a record. Where it differs from the current implementation, the current documents win: `docs/IMPLEMENTATION_STATUS.md`, `docs/FEATURE_ACCEPTANCE_MATRIX.md`, `docs/LICENSING.md`. In particular, religious evidence now draws only on the Quran, Sahih al-Bukhari, Sahih Muslim, and narrations of Jami' at-Tirmidhi and Sunan Ibn Majah individually graded authentic (the public hadith catalogue lists these four collections).

# ZIQ — Islamic Knowledge Atlas
## Master Build Prompt / Product Requirements / Technical Architecture

**Repository:** https://github.com/zivarallc-code/ZIQ
**Product:** ZIQ — The Islamic Knowledge Atlas
**Audience:** Global public, beginning with English and Arabic
**Primary scholarly framing:** Authentic Sunni Islam, transparent about scholarly disagreements
**Status:** Greenfield specification — implement working code, not just screenshots

### Mission
Build a beautiful, fully accessible, mobile-first, free-to-read public knowledge atlas joining the Qur'an, authenticated Hadith, trustworthy Sunni tafsir, prophetic narratives, genealogical relationships, historical geography, and signs of the Last Hour. Let users explore chronologically, geographically, thematically, or by evidence. No account required for reading, searching, maps, timelines, or references. Account required only for personal bookmarks/progress, participation in comments, reporting, optional notifications.

**NON-NEGOTIABLE:** Never represent unverified chronology, geographical guesses, fabricated lineages, future dates, AI-written theology, or weak narrations as established religious truth. Cite every substantive claim. Never calculate when the Last Hour will happen; its knowledge belongs to Allah (Qur'an 7:187, 31:34). Respect Islamic prohibitions against depicting Allah or portraying prophets in imagery. Do not invent religious material to fill an empty UI.

## Canonical Sources and Rights
- Qur'an: faithful, immutable Arabic Uthmani text from a verified source such as Tanzil; verify checksum and license. Store verse IDs as `surah:ayah`, and track text version and checksum.
- Quran translations: target Sahih International, M.A.S. Abdel Haleem, Marmaduke Pickthall, Abdullah Yusuf Ali, The Clear Quran (Mustafa Khattab), with additional scholar-approved options. Verify EACH edition's license/API grant before reproducing full text; offer links with attribution instead when permission is unavailable. Translations explain meanings and must not be conflated with Arabic revelation.
- Seven Hadith collections: Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, Jami at-Tirmidhi, Sunan an-Nasa'i, Sunan Ibn Majah, and Muwatta Malik. Expand optionally to Musnad Ahmad, Sunan ad-Darimi and others later. Collection membership is NOT itself a grading. Store precise book/chapter/hadith numbering scheme, Arabic text, translation rights, chain details when licensed, grading, grading scholar, disagreements, historical edition, and canonical URL (e.g. Sunnah.com).
- Sunni tafsir options: Tafsir Ibn Kathir, al-Tabari, al-Qurtubi, al-Baghawi, al-Sa'di and other approved references, subject to translation/source rights; correctly distinguish tafsir, historical reports, Isra'iliyyat, and doctrinally contested interpretations.
- Sira/history: label biography and history sources independently; grade historical assertions by evidence rather than pretending they are hadith. Avoid conflating a familiar story with an authenticated narration.
- Source policy and published methodology pages are mandatory. Every imported text includes provenance, edition, license/attribution, last_verified_at, and review_status.

## Evidence and Confidence Framework
Every atomic statement carries `source_type` [quran, hadith, tafsir, sira, historical, archaeological, derived], `references[]`, `claim_status` [explicit-text, scholarly-consensus, majority-view, disputed, historically-estimated, unsupported, unknown], `hadith_grade` if applicable [sahih, hasan, daif, mawdu, disputed, ungraded] plus grading authority, `editorial_review`, and `last_reviewed_at`.
- UI badges: "Quran explicitly states", "Authenticated Hadith", "Scholarly interpretation", "Historical estimate", "Disputed", "Location unknown", "Future event — no date known". Never display a generic '100% accuracy' score.
- Multiple views may coexist on contested chronology/location and have discrete citations and reviewer explanations.
- Graph edges (father-of, descended-from, met, contemporaneous-with, journeyed-to, event-associated-with, cited-by) also have evidence records. No invented edges.
- Date model includes exact/estimated/bounded/relative/unknown, BCE/CE and AH; beginning and end date ranges, calendar conversion explanation, and source notes. Do not render 0 CE; handle BCE/CE arithmetic correctly. Use dashed approximate visuals, not made-up exact dates.
- Map model supports `Point`, `ApproximateRegion` (polygon/circle/range), `Route` (with source confidence), `Unknown`, and future regions explicitly described in scripture. Never use a precise pin when evidence only establishes a broad zone. Allow uncertainty overlays and time-sliced historical boundaries.
- For the period of Adam, mark era and location unknown unless primary evidence supports more. For descendants of Muhammad ﷺ, clarify the distinction between his direct children, descendant lines through Fatimah (رضي الله عنها), and genealogical assertions from later centuries; do not invent a single 'last descendant' (living lines persist).

## Information Architecture / Routes
- `/` Immersive accessible home with hero, central CTA "Explore the Story", overview of the chronological atlas, key source trust indicators, search, thematic journeys, featured evidence, optional discussion previews.
- `/timeline` Infinite-zoom, pan-and-scrub interactive timeline; eras: Creation and early humanity (undated), early prophets, named communities and scriptures, Ibrahim and descendants, Musa/Bani Israel, Isa, pre-Islamic Arabia, prophetic life (610–632 CE where independently evidenced), Rightly Guided Caliphs, later Islamic history (as a separate history layer), past/future signs of the Hour (not a dated forecast). Avoid unverified absolute chronology for ancient prophets. Date sliders must have an undated region.
- `/atlas` interactive map with basemap, layered historical regions, event points, uncertainty polygons, journeys, filter by era/prophet/event/source/reliability, and attribution.
- `/prophets`, `/prophets/[slug]` chronological/canonical index, biography, evidence, genealogy, places, related stories, and "what is unknown".
- `/stories`, `/stories/[slug]` curated editorial journeys with short narrative, chapter list, Quran verses, hadith cards, map/timeline embeds, crosslinks, "verified" vs "estimated" sections, and reviewer credits.
- `/genealogy` zoomable directed family graph, graph evidence per link, isolate uncertain links and different names/aliases, compare historical views, export shareable static diagram.
- `/quran`, `/quran/[surah]/[ayah]` Arabic, selectable licensed translations, side-by-side comparison, verse crosslinks to stories, tafsir and topic tags, search.
- `/hadith`, `/hadith/[collection]/[id]` source-specific Arabic, translation where rights permit, isnad and grading attribution, alternative grading information, related events, source links.
- `/last-hour` Quran and reliable Sunnah on major/minor signs, materialized in past/ongoing/future/uncertain groupings ONLY where scholarly evidence supports classification. NOT a countdown or sensationalized current-events predictor. Locations must be text-supported, with broad estimated zones where uncertain.
- `/topics/[slug]` searchable topic web, e.g. mercy, justice, prayer, prophets, migration, finality of prophethood, resurrection.
- `/compare` two to four translations or scholarly perspectives with side-by-side citations and clear distinctions.
- `/search` global multilingual full-text/semantic search with source filters, evidence type, confidence, era, place.
- `/discussions`, `/discussions/[id]` readable without login, participation with account; attach thread to specific claim/verse/hadith/story/map element; citations and scholarly response labeling.
- `/my-library` private user bookmarks, reading progress, followed stories, history, note-taking and privacy controls.
- `/auth` passwordless/email/OAuth sign-in for opt-in actions only. Guest browsing remains completely open.
- `/methodology`, `/sources`, `/corrections`, `/about`, `/privacy`, `/terms`, `/accessibility`.
- `/admin` role-protected CMS for content, claims, references, relationships, uncertainty polygons, licenses, source ingestion, peer review, corrections, discussions, abuse reports, asset management, localization and feature flags.

## Signature Interactive Modules
1. **Story Universe:** hero introduction, atlas entry, prebuilt paths ("From Adam to Muhammad ﷺ", "The life of Ibrahim", "Journey of Musa", "Sira", "Signs of the Last Hour") linking timeline, map and sources. Narrative text is editorial and source-backed, not fictional dialogue.
2. **Timeline Engine:** dual scale linear date for well-supported history and categorized relative order for undated sacred history; expandable cards; connectors grounded in explicit evidence; uncertainty bands, AH/CE toggle with methodology. Underlying estimates are not silently promoted into definite dates. For the future, use ordered/unknown segments, never exact future years.
3. **Historical Atlas:** MapLibre GL JS with licensed map tiles, historical overlays and approximate zones, filters, place search, geolocated connections to timeline; mobile bottom sheet; accessible textual list alternative.
4. **Genealogy Graph:** React Flow/ELK or Cytoscape with generational focus, evidence panel on nodes AND edges, ancestor/descendant navigation, uncertain branch styling. Distinguish Quran-established lineage from later historical genealogies.
5. **Evidence Drawer:** click any fact to see the original Arabic verse/hadith, optional authorized translations, citation IDs, grading authority, context, scholar note, licensing, and a corrections link. Evidence references link to stable source URLs.
6. **Narrative Story Pages:** short summary, chapters, branch choice, highlighted map, source footnotes, glossary and knowledge checkpoints; every chapter offers skip-to-source and accessible reading mode.
7. **End Times Explorer:** avoid illustrating actual knowledge of hidden matters; classify narrations by authenticity and scope, surface interpretive disputes, do not map a future event to a precise current location absent decisive evidence.
8. **Learning Space:** bookmarks, study progress, private annotations, glossary, shareable lesson collections, discussion with citation helper and quote limits.
9. **Content CMS:** reviewer workflow [draft -> evidence-complete -> scholarly review -> published -> revision], audit log, revisions, automated broken-link checking, conflict tracking, rollback, no unreviewed AI text published automatically.

## Design and UI System
Visual personality: contemplative, credible, beautiful, not gamified or sensationalistic. Modern editorial Islamic geometry with restrained motion, gold accents and accessible contrast. Do not depict prophets, Allah, unseen beings, or speculative heavenly/hell scenes as literal imagery.
Palette: dark evergreen #0C2927, deep ink #0B171B, warm ivory #F7F3EA, brass accent #B8944D, muted sage #A8BEB2, slate #5E716D; light/dark modes, contrast-tested. Use locally hosted fonts with Arabic expertise (e.g. Noto Naskh Arabic or Amiri) and modern Latin sans/serif; ensure Quran typography accurately displays diacritics, verse markers and right-to-left layout.
Desktop: 12-column grid, editorial layout, sticky global search/navigation, subtle gold linework, text-first evidence panels, map/timeline fullscreen modes. Mobile: compact navigation, gesture-friendly timeline, draggable information sheets, touch targets >=44px and source panel. Minimal tasteful translucent panes, not visually noisy glass.
Design tokens for spacing, radii, typography, colors, shadows, borders and animations. Build a component library: SourceChip, ConfidenceLabel, VerseCard, HadithCard, TimelineNode, EvidenceDrawer, UncertaintyMapLayer, StoryChapterCard, GenealogyPerson, GenealogyEdge, LocationConfidenceLegend, DiscussionThread, SourceComparePanel, EditorialReviewBadge, EmptyState, LoadingSkeleton. Each component has responsive, focus, hover, disabled, loading, empty, RTL, dark/light and error states.
Hero sample copy: "Explore the story. Follow the evidence." Subtitle: "An interactive atlas of the Quran, the Sunnah, prophetic history and the questions that connect them." CTAs "Begin with Adam" and "Open the Atlas".
All photographs/illustrations must be sourced, licensed and attributable; use abstract geometric visualizations instead of invented scenes purporting to document prophets.

## Technical Architecture
Preferred stack: Next.js App Router + TypeScript strict + Tailwind CSS + shadcn/ui primitives + PostgreSQL (Supabase acceptable) + Drizzle or Prisma + PostGIS + MapLibre GL JS + React Flow/Cytoscape + lightweight search initially PostgreSQL FTS, then Meilisearch/OpenSearch where needed. Use server components/SSR for public SEO routes, client islands for interactive maps and timeline. Auth via Supabase Auth or Auth.js with secure sessions and row-level permissions.
Core entities:
`sources` (name, collection, publisher, edition, rights, URL, checksum, version);
`quran_verses` (surah, ayah, verified_arabic_text, source_version);
`translations` (verse, edition, localized_text, license);
`hadith` (collection, numbering_scheme, book/chapter, canonical_ref, Arabic, edition);
`hadith_translations`; `hadith_gradings` (scholar, grade, rationale/ref);
`people`; `person_aliases`; `relationships` (source-backed evidence);
`events` (source-backed summary, temporal type and ranges, evidence class);
`stories`, `story_chapters`, `story_event_links`;
`places`, `place_aliases`, `geometry_versions` (PostGIS geometries, confidence, evidence, period);
`claims`, `claim_sources` (atomic claim linking), `claim_reviews`;
`topics`, `topic_links`, `glossary`;
`users`, `bookmarks`, `progress`, `private_notes`, `discussions`, `comments`, `reports`, `moderation_actions`, `correction_requests`, `audit_logs`, `content_versions`.
Use UUID PKs, provenance, created_at/updated_at, review status, publication status, soft deletion where appropriate. Geometries with `coordinate_precision` and `location_status`. Add necessary indexes and enforce foreign keys. Public users read published records only, never private notes/emails. Every user-facing fact should resolve to at least one evidence record (except clearly labeled product/instructional text).
Use safe database migrations, seed fixtures, unit-tested conversions and validation, content versioning, caching, API rate limits and security policies.

## Privacy, Authentication, Moderation
No login walls or subscription/payment barriers for religious knowledge. Optional email/social login for bookmarks, discussions, personal learning features. Default private notes and progress. Allow export/delete account/data. GDPR-style user rights as baseline, cookie minimization, privacy-first analytics, CSRF/XSS prevention, CSP, spam controls, report/block user, rate limits, bot protection on posting, privacy-respecting telemetry. Public discussion pages may be read anonymously; accounts required to post; no anonymous harassment or misinformation. Moderator powers separate from content editors. Explicit community rules: adab, respectful disagreement, no sectarian abuse, no fabricated attribution, no doxxing, no extremist recruitment; medical/legal/religious personalized fatwa questions redirected to qualified scholars. Scholar verification is documented and revocable; badges awarded only through administrator verification, not self-declared status. Report a source/error directly from each claim.

## Accessibility & Internationalization
WCAG 2.2 AA, semantic headings, no keyboard traps, full keyboard timeline/map alternatives, reduced motion, screen reader labels for graphics, alt text, minimum contrast, scalable text, visible focus. English/Arabic UI; fully native RTL, not mirrored Arabic Qur'an content in LTR. Structurally support Urdu and other languages later. Standardize transliterations and display Arabic names consistently. Hijri/Gregorian selection with documented date conversion uncertainty; locale-aware numerals.

## Search / AI
Search over only licensed and verified content. Optional AI-assisted explainer must be explicitly identified as a tool, cite retrieved evidence for every substantive point, abstain when not sourced, distinguish established/doubtful reports, not issue authoritative fatwas or claim certainty about the unseen. For initial release, make deterministic source browsing and human-reviewed stories work before adding AI. Do not train on user private notes without explicit consent.

## Content Seed Set (carefully researched, not fabricated)
First stories: Adam (known and unknown), Nuh, Ibrahim and his family, Yusuf, Musa, Dawud/Sulayman, Maryam and Isa, Muhammad ﷺ: lineage as established, revelation, Hijrah, major documented moments, Farewell Pilgrimage, passing; documented descendants of Fatimah through al-Hasan/al-Husayn with provenance; death/resurrection/Last Hour thematic explorer. These are starting editorial topics, not license to assign invented years and locations. Publish only after source review.
Provide initial demonstration dataset with authentic references that have been crosschecked (e.g. Quran 7:187 and 31:34 for knowledge of the Hour), and clearly mark all placeholder data as nonproduction. Do not place unverified text in production tables.

## Milestones
- Phase 0: inspect repo, configure Next.js tooling, lint/format/tests, CI, database migrations, design tokens, docs, source/licensing registry.
- Phase 1: polished landing page, public navigation and search, source libraries, story page, evidence drawer and CMS; seed a small verified story path and examples.
- Phase 2: interactive timeline, map with uncertainty polygons, linked events, genealogy graph, full responsiveness and accessibility.
- Phase 3: optional accounts, private bookmarks/progress, comment/discussion/community moderation.
- Phase 4: multilingual support, source comparison, editorial analytics, expanded content verified by reviewers, performance and security audit, public deploy.
Implement real persistence, forms, filters, CRUD with validation, error/loading/empty states, permissions, audit, sample data workflow and tests. Do not present mocked controls as completed features.

## Acceptance Tests
1. New visitor can browse a complete verified example story, read every citation and see a linked timeline/map without login.
2. The same event displayed across story, timeline, genealogy, map and evidence drawer uses the same IDs, dates, geography, and review status.
3. No unsupported exact ancient dates, speculative map pins or future Last Hour date appear in the public UI.
4. Weak/ungraded hadith cannot be rendered as 'sahih' and source editions/numbering are preserved.
5. A location lacking coordinates displays approximate zone OR "unknown" — not false GPS precision.
6. No prophet portrayal, fabricated Quran verse, misattributed hadith or unlicensed full translation.
7. Logged-out bookmarking prompts login while continuing guest reading; logged-in user can save/remove; RLS prevents accessing others' notes.
8. Discussions visible publicly, posting requires login; report/moderate/edit actions are audited.
9. Excellent usable UI from 320px phones to wide desktop; keyboard, screen reader and RTL tests pass.
10. Build, typecheck, lint, tests and CI pass; no hardcoded secrets; deploy instructions included.

## Delivery Expectations for Coding Agent
Audit existing repository first and retain working code. Produce complete source code and assets; do not stop at PRD/mockup. Maintain `README.md` for setup, environment variables, local development, migrations, security and editorial process, and `docs/` for diagrams, data provenance, licensing, review policies and detailed QA. When creating a working branch, open a PR for human review rather than silently merging; do not overwrite existing files. At the end report implemented features, placeholders, source/license blockers, test results and exact next actions.
