# Quran & Science Discovery Center ("Signs in Creation")

Branch `mod/quran-science` (from `feat/platform-foundation` 7ea14aa). Not merged, migration not applied to production, seed not loaded.
Everything written by this module is an **AI-assisted draft**: `scholarly_status = not_reviewed` and `scientific_review = not_reviewed`, shown with the
shared `VerificationBadge` (AI-Assisted Draft) and a visible disclosure in EN/AR/UR on every page.

## What this is, and is not

A research platform on how Quranic passages about the natural world relate to authentic hadith, the history of scientific discovery, established
science and open scientific questions. It is **not** a collection of "scientific miracle" claims. Science can establish that a phenomenon exists;
that does not establish that a verse predicted it. Three assessments are therefore kept apart and never combined into a score, a total or a
percentage (a test asserts that no score appears):

| Assessment | Values | Lives in | Set by |
|---|---|---|---|
| 1. Scientific evidence state | Established, Well Supported, Emerging Evidence, Hypothesis, Speculative, Unsupported or Contradicted, Outside Empirical Science (plus "not yet assessed") | `science_claims.evidence_state`, recorded by `science_claim_assessments` | science reviewer |
| 2. Textual interpretation strength | Explicit textual description, Strongly supported linguistic reading, Plausible interpretive connection, Disputed interpretation, Weak or strained, Unsupported | `quran_science_links.interpretation_strength` | editor draft; reviewers confirm |
| 3. Strength of the proposed connection | Strong, Moderate, Limited, Tentative, No connection claimed | `quran_science_links.connection_strength` | a reviewer-set category, never computed |
| Relationship classification | Scientifically Established, Consistent Interpretation, Interpretation Debated, Active Research, Not Scientifically Testable, Unsupported Claim | `quran_science_links.relationship` | editor draft; reviewers confirm |

Metaphysical matters (angels, jinn, the unseen, the resurrection, the nature of the soul) are `topic_kind = 'unseen'`: their claims can only be
`outside_empirical_science` and their links only `not_scientifically_testable` (database guard, integrity check, seed loader and validator all enforce it).
No page describes them as awaiting laboratory proof.

## Hard rules kept

- Quran text only from the loaded corpus (`content/quran`, Tanzil Uthmani 1.1). Quran references are checked against `quran_verses` (foreign key) and
  against the corpus file (loader). **Arabic terms** must be substrings of the verse's corpus text (database guard on `quran_science_links` and the loader).
- Translations: none is loaded; the page says "unavailable" (no licensed edition mechanism returns text to this module).
- No tafsir wording from memory: `quran_science_interpretations` rows are `needs_source` placeholders holding no summary, no scholar and no
  `proposed_after_discovery` until a source is recorded (check constraints). A modern reading is never attributed to a classical scholar (constraint
  rejects `classical` + `proposed_after_discovery = true`; the integrity check and the TypeScript validator repeat it).
- No hadith is stored by this module.
- A **year, DOI or publication** needs a `verified_source` URL (check constraints on milestones and publications; the integrity check repeats them and
  fails otherwise). A publication appears on a public page only when a science reviewer set `verified` (guard: only the `science_reviewer` role, or an
  administrator, may set it; editing a verified citation un-verifies it). The page shows "Not yet verified" for any year without a source.
- No medical claims or dosages (honey topic says so; text guard refuses "cures all", "guaranteed healing"). No depiction of prophets, angels or jinn
  (`depicts_sacred_figure` is pinned false on visual assets). Every page has a visible "What This Evidence Does Not Establish" section (column is
  NOT NULL in all three languages; the integrity check and `topicCompleteness` test it). No "proof score".
- Public reading only through security-definer functions (`public_science_topics`, `public_science_topic`, `public_science_questions`,
  `public_science_timeline`), allow-listed in `tests/db/security.test.ts`. The tables are closed to anon and readable only by staff.

## Verification: two separate reviews

`Verified` is reachable only through **two separate, version-bound human reviews by two different appointed people**:

- `science_expert_reviews`: only the exact role `science_reviewer` (an administrator is not enough, an appointed reviewer is required).
- `science_scholarly_reviews`: only the exact role `scholarly_reviewer`, for the Quran-and-science relationship.
- A review is recorded in the signed-in reviewer's own name (`reviewer_id = auth.uid()`), so no AI, job or service key can create one; no self-review
  (a reviewer cannot review a topic they authored); the topic version is captured by the database; any edit withdraws both approvals.
- Publishing (`status = published`, the only way to visibility `public_approved`) needs: both approvals of the current version, from two different people
  (`science_approvers_distinct`), a passed integrity check, and no re-review flag.
- **Re-review**: changing any evidence state, relationship, interpretation strength, connection strength or verse of a link bumps `classification_version`,
  sets `needs_rereview`, withdraws approvals, takes a public draft off the pages and sends a published topic to `correction`. The flag clears only when both
  reviews approve the new version.
- Every content change, status change and review writes an append-only `science_revision_history` snapshot.

The AI-draft pathway mirrors `public_ai_drafts`: an editor runs `run_science_integrity`; a draft that passes is shown by `publish_science_ai_draft` with its
labels; withdrawal (`withdraw_science_topic`) records a reason.

## Pages

`/[locale]/science` hub (cards with the three assessments side by side, earliest verified milestone, two review lines, filters by discipline /
relationship / evidence state / interpretation strength, search); `/science/[slug]` (17 sections: summary, passage, translation, Arabic terms, tafsir
references, phenomenon, claims and evidence state, two-layer timeline, evidence, interpretation and relationship, limitations, alternatives, what the evidence
does not establish, research questions, conclusion, references, review status); `/science/questions`; `/science/timeline` (Layer A Quran text and
interpretation history, Layer B scientific development, switches `?layer=a|b`, the interpretive link labelled); `/science/journeys` (children, teens,
general, university, advanced: structure only); `/admin/science` (registry, citation and date verification, scientific review, scholarly review, versions,
withdrawal; each tab offers only what the viewer's role may do, and the API and database check again). Navigation: "Quran & Science" in the Explore list
(`src/lib/nav.ts`) and the sitemap. With no database, pages show the designed not-connected state **and** the draft inventory from the repository, labelled
"Draft inventory" and unrated (`origin: draft_file`); a connected database is never supplemented from the file.

## Discovery dates verified online (2026-11-04, via the Crossref API; no publication marked verified)

| Year | Record | Source checked |
|---|---|---|
| 1922 | A. Friedman, "Über die Krümmung des Raumes", Zeitschrift für Physik 10(1), 377-386, DOI 10.1007/BF01332580, issued 1922-12 | https://api.crossref.org/works/10.1007/BF01332580 |
| 1929 | Edwin Hubble, "A relation between distance and radial velocity among extra-galactic nebulae", PNAS 15(3), 168-173, DOI 10.1073/pnas.15.3.168, issued 1929-03-15 | https://api.crossref.org/works/10.1073/pnas.15.3.168 |
| 1931 | A. G. Lemaître, "A Homogeneous Universe of Constant Mass and Increasing Radius accounting for the Radial Velocity of Extra-galactic Nebulae", MNRAS 91(5), 483-490, DOI 10.1093/mnras/91.5.483, issued 1931-03-13 | https://api.crossref.org/works/10.1093/mnras/91.5.483 |

These are publication records only: the content of the papers was not read. The Lemaitre entry is the 1931 MNRAS publication; the earlier 1927 original and
V. M. Slipher's radial-velocity measurements were **not** verified and remain an undated placeholder. Direct fetches of the PNAS and Springer pages were
refused (403 / login redirect); the NASA ADS record returned an error; so the Crossref DOI registry was the authoritative source used. The three
publication rows are stored with `verified = false`: a science reviewer must verify them (and the Friedman title, which Crossref returned with a character
encoding glitch) before they are listed as citations.

## Honest status

| Area | Status |
|---|---|
| Schema, guards, RLS, public read functions | Built; PGlite tests (`tests/db/science.test.ts`, 29) and the security sweep pass. **Not applied to Supabase.** |
| Pure library and validator | Built; regression test per rejected family (`tests/unit/science.test.ts`); SQL and TS guards compared on shared samples |
| Draft inventory (13 candidate topics) | Written as DRAFT; loads into the test database and passes the integrity check; **not loaded into any live database** (needs the service role) |
| Pages and admin console | Built; verified in the browser only in their not-connected state and on a test-only fixture page (`/science-fixture`); **never viewed with real data from a live Supabase**; admin console never exercised with a real signed-in role |
| Ratings | **None assigned.** Every evidence state, interpretation strength and connection strength is "not yet assessed" except the categorical Outside Empirical Science for the unseen topic and the soul claim in 39:42 |
| Arabic and Urdu | Draft interface strings, titles and the general "does not establish" paragraph; topic-specific "does not establish" sentences exist only in English (honey and unseen topics have an Arabic and Urdu specific sentence) |
| Intermittent test note | In 3 of about 28 early cold-start Playwright runs of `/science/<slug>` a React hydration warning (#418) appeared; it did not reproduce in more than 150 later runs or in `next dev`. A comparison pointed at the shared header's session state (`AccountLink`), not this module, but the cause was not proven |

## Awaiting a reviewer (every placeholder)

Scientific reviewer (`science_reviewer`):
- every evidence state (`unassessed` on all 13 topics' claims except the two categorical Outside rows) and each claim's wording;
- the `phenomenon` description, `limitations`, `alternatives` and `conclusion` text of all 13 topics (null placeholders);
- verification of the three Crossref-checked publications (title/author/DOI) and of the dates 1922, 1929, 1931; the Slipher and 1927 Lemaître placeholders;
- the two open questions (51:47 expansion rate; 21:30 early universe) and the empty `competing explanations` fields;
- `science_evidence` rows (none stored) and `science_visual_assets` (none stored; any asset needs a licence and alt text);
- the scientific review itself for every topic.

Scholarly reviewer (`scholarly_reviewer`):
- every interpretation strength, connection strength and relationship (all `unassessed`, except the unseen topic's not-testable relationship);
- the 26 tafsir placeholders (`needs_source`, classical and contemporary, first verse of each topic) and any `proposed_after_discovery` attribution;
- the choice of Arabic terms and the statement of what each wording refers to; the unseen topic's choice of 2:3;
- the hadith evidence (none stored; only Bukhari, Muslim or individually graded sahih Tirmidhi/Ibn Majah would be accepted);
- the scholarly review itself for every topic.

Translators: all Arabic and Urdu strings (`science.ts`, `adminScience.ts`, titles and the general "does not establish" paragraph in `content/science/topics.draft.json` and `src/lib/science/seed.ts`).

Owner: apply migration `20261031003000`, run `pnpm science:seed -- --db` with the service role, appoint reviewers, decide on a licensed translation, publish nothing before reviews.

Learning journeys: all 5 audiences are structural placeholders (`src/lib/science/journeys.ts`).

## Commands

```
pnpm tsx scripts/load-science-seed.ts            # dry run: validates the inventory against the pinned Quran corpus, writes nothing
pnpm tsx scripts/load-science-seed.ts --db       # needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (owner action)
npx vitest run tests/db/science.test.ts tests/db/science-seed.test.ts tests/unit/science.test.ts --no-file-parallelism
```
