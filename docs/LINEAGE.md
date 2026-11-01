# QITL Lineage of Humanity and the ancient scriptures research layer

Branch `mod/lineage`. Migrations `20261031002640` (witness registry, scripture citations), `002641` (lineage), `002642`
(registry seed, ten DRAFT rows). Code: `src/lib/lineage`, `src/components/lineage`, `src/components/admin/LineageAdmin.tsx`,
`src/app/[locale]/{lineage,scriptures,admin/scriptures}`, `/genealogy?view=lineage`, `src/app/api/admin/lineage`,
strings in `src/lib/i18n/modules/lineage.ts`, styles in `src/styles/lineage.css`.

## What it is, and what it refuses to be

The most complete family tree that reliable evidence permits, "From Adam to Muhammad (peace be upon them)", which shows
exactly where generations, names, dates and relationships are unknown. It does not invent a generation, a name, an age or a
date; an unknown reads **Not established**; a chain is never assembled from incompatible traditions; no prophet or angel is
depicted; nothing unreviewed is published. **No genealogy fact and no published content is seeded.** The only seed is the
witness registry (reference data, status `draft`).

## The evidence model

The class of a link is **derived**, never chosen by an editor. The single source of truth is the SQL function
`public.lineage_evidence_class(confidence, claim_id)`; `src/lib/lineage/classes.ts` `deriveEvidenceClass` mirrors it and
`tests/db/lineage.test.ts` runs 18 combinations through both. The view `relationship_evidence` exposes it for every
relationship, and the RPC `lineage_graph()` returns it with each published item.

| Class | Colour (light) | Line | Derived when |
|---|---|---|---|
| Quran | `#17613F` | solid | claim evidence is Quran **and** it cites a verse |
| Authentic hadith | `#337B58` | long dashes | claim evidence is hadith **and** it cites a narration (a graded one, enforced by the existing hadith guard) |
| Classical Sunni scholarship | `#916F3F` (brief: `#947140`) | dashes | claim evidence is scholar with tafsir/scholar references |
| Ancient biblical manuscripts | `#3D729D` | dots | the references are earlier-scripture witnesses only (see below) |
| Historical / archaeological research | `#7463A5` | dashes and dots | history references only, or an estimate with history references |
| Unknown or disputed | `#666C75` | sparse dots | disputed or unknown on the link or on the claim (whatever else is cited), or a label that its references do not back |

Rules in full: disputed/unknown on the link or the claim is always grey. `quran`/`hadith` without a verse/narration is grey
(a label alone is not evidence). `scholar` with tafsir/scholar refs is amber; if it cites only scripture witnesses it is
blue; only history, purple. `estimate` prefers history, then scripture, then scholarship; none is grey.

**Colour is never the only signal.** Each class has its own line pattern (six patterns, three families solid/dashed/dotted)
and a text label in the legend, on every drawn link (tag with words), in the outline and in the assessment panel. Colour
shows the source of a link, never a person's worth. The tokens are CSS variables (`--ln-<class>`, `--ln-<class>-fg`) with a
dark theme and the system-dark fallback; `tests/unit/lineage.test.tsx` checks that the CSS equals `CLASS_TOKENS`, that every
text/background pair is >= 4.5:1 and every line >= 3:1 against both page surfaces, in both themes. **Contrast finding:** the
brief's amber `#947140` gives 4.47:1 with white text, below 4.5:1, so the light-theme amber is darkened to `#916F3F`
(4.62:1). The other five meet 4.5:1 as given. Dark theme uses lighter fills with near-black text (all >= 8:1).

## Data model

* `relationships` (existing): new column `uncertainty_note` ("what is uncertain"); a freeze trigger (a published row cannot
  change until it is moved to correction). `competing_group`, `tradition`, `claim_id` are reused as they were.
* `lineage_gaps` (new): "Undocumented intermediate generations" between an earlier and a later person: `claim_id` **not null**,
  `note` required (10 to 800 characters, e.g. "Traditional genealogies differ; exact chain not authenticated."), optional
  `tradition` and `competing_group` (disputed only). It holds **no count of generations and no names**.
* `lineage_node_claims` (new): a cited claim about one person (aspect: identity, name, lifespan, dates). Without one the page
  reads "Not established".
* `scripture_witnesses` (new), `scripture_historical_reviews` (new), `claim_references.scripture_witness_id` and reference
  kind `scripture` (new): see the next section.
* `lineage_stats` (new): counts only (published / under review) for links, gaps, person claims and witnesses; filled by
  triggers. This is what the empty state shows.
* Publish guards: a gap or a person claim needs an approved claim **with references**, published people, and a scholarly
  review (`lineage_gap`, `lineage_node_claim` review types); a link keeps the existing relationship guard. Published rows are
  frozen. All three new review types are in `review_entity_types`, `review_entity_authors` and carry the `stamp_author`
  trigger, so there is no self-review (the sweep in `tests/db/security.test.ts` enforces the registration). RLS is enabled and
  forced; public reads see published rows only; the stats table is in `PUBLIC_BY_DESIGN` (numbers only).

## The path (and when there is none)

`lineage_graph()` returns published people, links (`parent_of`/`descendant_of`, normalised to ancestor -> descendant), gaps and
person claims, each with class, claim and references. `src/lib/lineage/path.ts` finds the routes from `adam` to `muhammad`
(people slugs) in the browser/server from that document only:

* **connected**: one or more routes; competing accounts of a step are kept together and shown side by side; several routes are
  listed as competing accounts, never merged.
* **incompatible**: the published links connect the two only by mixing traditions (no single named tradition carries the whole
  chain). The chain is **not** presented as a lineage; the separate accounts are listed.
* **not_connected**: "Not established", with what is published downward from Adam and upward from Muhammad so far.
* **missing_endpoint**: one end is not published.
* **nothing published**: the designed empty state, with counts only and no titles.

## Scripture witness registry (comparative research, not authentication)

Ten seeded draft rows (Tawrah: Dead Sea Scrolls, Masoretic, Samaritan Pentateuch, Septuagint; Zabur: Psalms among the Dead
Sea Scrolls, Hebrew Psalter, Septuagint Psalms; Injil: early Greek Gospel papyri, Codex Vaticanus, Codex Sinaiticus).
Each row: layer, name, kind, language, `dating_note` (a broad scholarly range or **NULL = "Not established"**), `what_it_is`,
and a **mandatory `limitation`** (40 to 700 characters, DB check) that states, per layer, that no surviving witness can be
certified as Musa's original revelation; that the Book of Psalms is a collection that cannot simply be equated with the
Zabur given to Dawud; and that the four canonical Gospels are ancient accounts about Isa, not manuscripts demonstrably
identical to the Injil. Age alone is never used to call a text unaltered, and no row says a manuscript is the original.
Dated rows are only those with a standard broad range (Dead Sea Scrolls 3rd c. BCE to 1st c. CE; Masoretic codices about 10th to
11th c. CE; Septuagint Pentateuch begun 3rd c. BCE; earliest Gospel papyri 2nd to 3rd c. CE; Vaticanus and Sinaiticus 4th c.
CE). The Samaritan Pentateuch and the Septuagint Psalms are left **undated** on purpose.

* **No scripture text is stored.** There is no text-bearing column; descriptions are length-limited and a CHECK refuses
  Hebrew, Greek and Arabic script in them; a citation stores a witness and a locator only.
* **Citing a witness:** `claim_references` kind `scripture` needs the witness **and an exact locator that contains a number**
  (book, chapter, verse or folio). A claim that cites a witness cannot be approved while the witness is not published.
  Such a claim derives the blue class "Ancient biblical manuscripts", labelled everywhere as an **earlier-scripture textual
  witness, not independently authenticated Islamic revelation**.
* **Publishing a witness** needs a scholarly review (`scripture_witness`) **and** a historical/scientific review
  (`scripture_historical_reviews`, science reviewer, never the entry's author), then it is frozen.
* **The Quran as the criterion** (Q 5:48) is stated on `/scriptures` as the Sunni framework this site follows, not as a finding
  of the research. The verse reference was checked against `content/quran` (5:48 is the verse that speaks of the Book sent
  down confirming and guarding what was before it).
* `/scriptures` (EN/AR/UR) shows the three layers, published witnesses only with their limitations, how a claim can cite one,
  and, with nothing published, counts only.

## Interface

`/genealogy?view=lineage` (switch on `/genealogy`; the URL carries the choice) and `/lineage` (same view): legend; evidence
filter by class (also `?classes=quran,hadith`); route graph with pan and pinch-zoom (390 px first), tags with words, a dashed
gap box, competing lines side by side; keyboard (Tab into the chain, Arrow Up/Down, Home/End, Enter/Space); the **text outline**
of each route (the accessible alternative, one list item per person with each link's class and an "Assess" button); the
assessment panel (what we know / how we know / what is uncertain, class, claim, references, tradition, disagreement); targets
are 44 px; reduced motion removes transitions; RTL for Arabic and Urdu. Interface strings: `lineage.ts` (Arabic and Urdu are
**drafts for translators**). Names, claims, notes and witness descriptions are English content marked `lang="en"` in the
Arabic and Urdu interfaces, like the rest of the site. Admin: `/admin/relationships` shows each link's derived class and
adds gap and person-claim forms and workflow; `/admin/scriptures` manages witnesses, both reviews and the citation helper.

## Open and unresolved (for the owner and the reviewers)

* **Nothing is published.** To show a lineage: add people (Adam, Muhammad and each link's persons), write claims with
  references, review and publish them. The path appears only when published links connect the slugs `adam` and `muhammad`.
* Which traditions to name, and whether any stretch of the Adam-to-Muhammad chain can be given at all, is a scholarly decision;
  this build supplies the structure (gap nodes, competing accounts, incompatibility refusal) and no content.
* The witness registry descriptions, limitations and dating ranges are drafts until a scholarly reviewer and a
  historical reviewer sign each row (see the report of what was not fully certain: the Septuagint Pentateuch "begun in the
  3rd century BCE" and the Dead Sea Scrolls' range are the standard figures but still need the historical reviewer's check).
* Arabic and Urdu strings need translator review; the witness names have no Arabic or Urdu forms (empty by design).
* `descendant_of` edges mean "generations not established"; the lineage view treats them as an ancestor -> descendant link
  and draws any missing generations only if a gap is published.
* Unpublishing a witness that published claims cite is not blocked by the database (a witness is frozen, and moves to
  correction only with a public note); the claim guard checks witnesses only when a claim is approved.
* Not run against a live Supabase project (no migrations were applied).
