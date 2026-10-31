> **Historical document.** Written for ZIQ, the project's earlier name; the product is now **QITL — Quran in Timeline**. It is kept unchanged as a record. Where it differs from the current implementation, the current documents win: `docs/IMPLEMENTATION_STATUS.md`, `docs/FEATURE_ACCEPTANCE_MATRIX.md`, `docs/LICENSING.md`. In particular, religious evidence now draws only on the Quran, Sahih al-Bukhari, Sahih Muslim, and narrations of Jami' at-Tirmidhi and Sunan Ibn Majah individually graded authentic (the public hadith catalogue lists these four collections).

# PROMPT 1 — ZIQ COMPLETE PRODUCT DESIGN & UX (DESIGN-ONLY)
Target repository: https://github.com/zivarallc-code/ZIQ
Role: Act as a senior product designer, Islamic educational-experience designer, information architect, accessibility specialist and design-systems engineer.

OBJECTIVE
Design every screen, flow, interaction, state and responsive layout for ZIQ — The Islamic Knowledge Atlas, a free public platform explaining Islam through the Quran, carefully authenticated Sunni Hadith, connected prophet narratives, genealogy, chronological history, an interactive geospatial atlas and a cautiously presented account of the signs of the Last Hour. Reading requires NO login. Account is optional for bookmarks, notes, personal progress and discussions. Work from MASTER_BUILD_PROMPT.md for religious integrity; this is a pure DESIGN brief. Do not claim the backend is wired or features functional when only prototyped.

VISUAL DIRECTION
Create an unmistakably premium, calm, scholarly editorial style: modern information atlas with subtle Islamic geometric motifs, high-density visualizations that remain legible, thoughtfully drawn lines and restrained gold accents. NOT a generic SaaS dashboard, cartoon app, gamified spirituality, fake ancient photography, or lurid end-times website. Default palette evergreen #0C2927, ink #0B171B, ivory #F7F3EA, brass #B8944D, sage #A8BEB2, slate #5E716D. Build genuine light and dark themes. Arabic script must be elegant and correctly shaped; Quran text receives dedicated high-readability typography such as Amiri or Noto Naskh Arabic with licensed font files (never check in unauthorized fonts). Modern Latin companion. RTL is first-class; English and Arabic toggles; design extensible to Urdu. Fine-grain responsive from 320 px to ultra-wide screens. Respect reduced motion and WCAG 2.2 AA. Focus visibility, keyboard accessibility and textual alternatives for every graphic.

COMPLETE SITE MAP AND VISUAL DESIGN (desktop/tablet/mobile):
1. Global shell: brand symbol, nav, global search, language/theme toggles, optional login/profile, breadcrumb, citations affordance, footer, responsive menu, privacy notices and empty/loading/error states.
2. Home: hero "Explore the story. Follow the evidence.", two obvious journeys "Begin with Adam" and "Open the Atlas"; timeline preview, animated but nonessential geographic visualization, Quran/Hadith evidence cards, featured stories, source reliability explainer, browse by prophet/topic/era, community preview without requiring login.
3. Interactive timeline: show undated sacred history on a relative-order track distinct from absolute historical BCE/CE/AH eras. Zoom, filter, compare, source/category layers, uncertainty intervals, chronological narrative and timeline-to-map sync. Past, present and events of the Last Hour are never presented as known future dates. Event card shows name, summary, date confidence, reference, linked location and relationships. Design mobile bottom sheets and keyboard list view.
4. Atlas/map: MapLibre-ready full-map scene; overlays for known pins, approximate shaded regions, routes with uncertainty, multiple sourced alternate locations, disputed labels, geographic epoch slider where appropriate, event previews and dynamic source drawer. Add permanent legend "Verified point / Approximate region / Unknown location / Historical hypothesis". Never assign exact GPS to ambiguous scripture.
5. Prophets index and profile: discovery, relations, story arc, verses, authenticated narrations, approximate historical context if supportable, known/unknown distinctions, linked journeys.
6. Relationship/genealogy explorer: graph nodes and edges, generation lanes, prophet-specific focus, ancestors, descendants, evidence on every edge, competing genealogical interpretations, "unknown link" styling. Do NOT pretend an identifiable "last descendant of Muhammad" exists; represent established lines through Fatimah with sourced later historical branches where verification exists.
7. Stories library and detail: cover art based on calligraphy/geometric abstraction, chapters, readable long-form narratives, timelines/maps, verse/hadith reference chips, verified vs inferred explanations, parallel related stories, glossary, progress meter for signed-in people, share/copy reference.
8. Quran explorer: 114 surah list, ayah reader, Arabic original and translation comparison (license-aware), verse-level topics, tafsir, related events, audio only if legally licensed, font size controls, bookmarks and export citation.
9. Hadith explorer: seven Sunni collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Muwatta Malik), reference-specific pages, original vs translation, authentic grading, source scholar, disagreement panel, related stories. Collection is not sufficient grading except contextual treatment of Bukhari/Muslim; do not blanket-mark all others sahih.
10. Last Hour explorer: minor/major signs, Quran/hadith citations, classifications where warranted, interpretation disagreements, reported geography as broad polygons only when supported, no countdown, no year forecast, no sensational imagery or contemporary geopolitical guessing.
11. Compare sources page and faceted global search/results: Arabic and English, transliterations, filtering, no-result guidance.
12. Community: discussions landing, thread, contextual comments attached to sources or story segments, cite-a-verse UI, follow/report/moderation status, no posting without account but reading public, clear respectful-discussion guidelines.
13. Auth and account: passwordless/email and optionally OAuth, privacy controls, saved verses/stories/places, reading progress, notes private by default, followed threads, notifications settings, delete/export account. No login required to see content.
14. Editorial/admin: separate robust editor shell with story composer, references selector, hadith grading metadata, timeline editor, map polygon editor, graph relationship editor, source license registry, review and scholarly approval workflow, reported comments queue, content revision diff, correction queue, audit trail and users/roles.
15. About, source methodology, scholarly review board (only verified credentials), editorial corrections, terms/privacy/accessibility, contact, 404/500/offline.

DESIGN SYSTEM
Create full token inventory for typography, spacing, surfaces, grid, color, border, interaction, breakpoints, animation, light/dark, RTL. Provide reusable components (verse card, hadith card, evidence drawer, authenticity label, event/prophet card, location uncertainty legend, map popup, genealogy node/edge, discussion unit, attribution panel, compare panel, editorial status, forms, confirmations, skeletons, toasts). All components have hover/focus/pressed/disabled/empty/loading/error states. Plain citations must be visible, not only on hover. Show visually distinct **scripture/authentic Hadith**, **scholar interpretation**, **historic estimate**, **disputed**, **unknown** without red-green color dependency. Map source attribution must remain visible.

MANDATORY UX FLOWS / PROTOTYPES
A. Anonymous visitor -> Adam story -> timeline event -> mapped location (or unknown zone) -> Quran verse -> matching Hadith -> next related prophet, without login.
B. Anonymous visitor -> tap Bookmark -> optional sign-in -> return to same content and bookmark it.
C. Authenticated visitor -> resume story -> note privately -> join moderated public discussion on an evidence card -> report a misleading comment.
D. Scholar/editor -> create event with unknown date -> attach citations -> assign approximate polygon -> obtain review -> publish -> display consistent data on map/timeline/story/graph.
E. Admin -> review source correction -> update claim -> visible revision note; moderate reported content.
F. Compare translations or alternative scholarly readings with licensing and source dates shown.

IMPLEMENTABLE INTERACTION SPEC
For EACH page provide: wireframe, final visual composition, responsive variants, typography, controls and hover/click behavior, expected data inputs, navigation targets, modal/drawer and keyboard behavior, loading/empty/error/unauthorized states, analytics events (privacy-safe), and acceptance checkpoints. Define reusable property/interface contracts for dev handoff. Include a working FRONTEND prototype in code when coding tools are available, using local fixtures clearly labeled DEMO. Avoid fake source citations and invented religious facts even in demos; use source-neutral placeholders unless reviewed.

DESIGN DELIVERABLES IN REPOSITORY
/docs/design/brand-and-tokens.md
/docs/design/information-architecture.md
/docs/design/screen-specifications.md
/docs/design/interaction-flows.md
/docs/design/component-library.md
/docs/design/responsive-rtl-accessibility.md
/docs/design/asset-and-image-guidelines.md
Optionally implement accessible frontend showcase using Next.js components and sample verified facts. No mock-feature should appear functional until actually wired. Add screenshots or visual QA artifacts if tooling permits.

ACCEPTANCE: polished distinct design for ALL routes, complete desktop and mobile, live-state specifications, English and Arabic RTL, intelligible timeline uncertainty, source-first reading, direct cross-navigation, no prophet depictions, clear implementation handoff. Do not stop after designing the landing page.
