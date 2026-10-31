import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CHECK_IDS, canonicalSlug, linkProblem, parseRange, rangeProblem, runChecks, summarise, type CheckInput, type ContentInputs, type DbInputs, type DbRef } from "@/lib/stories/checks";
import { KNOWN_TOP_LEVEL_ROUTES, loadContentInputs } from "@/lib/stories/static-inputs";
import { fourCounts, quranCoverage, type SubjectRow } from "@/lib/stories/coverage";
import { modeContent, modesWithText, parseMode, READER_MODES } from "@/lib/stories/modes";

/** Fixture text is labelled placeholder text, never Quran or hadith text. */
const T = "[TEST FIXTURE]";
const counts = [0, 7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111];
const content = (o: Partial<ContentInputs> = {}): ContentInputs => ({
  ayahCounts: counts,
  inventory: [],
  journey: [],
  routes: { topLevel: ["quran", "prophets", "events", "stories", "hadith"], prophetIds: ["nuh"], eventSlugs: ["flood"], storySlugs: ["fx"] },
  ...o,
});
const emptyDb = (o: Partial<DbInputs> = {}): DbInputs => ({ stories: [], chapters: [], sections: [], refs: [], unitsWithoutClaims: [], people: [], events: [], eventRefs: [], relationships: [], translations: [], ...o });
const chapter = (o: Partial<DbInputs["chapters"][number]> = {}): DbInputs["chapters"][number] => ({
  id: "c1",
  storySlug: "fx",
  position: 1,
  anchor: "1",
  title: T,
  status: "draft",
  eventSlug: null,
  bodyMd: "",
  summaryMd: null,
  deepMd: null,
  kidsMd: null,
  lessonsMd: null,
  unknownsMd: null,
  ...o,
});
const ref = (o: Partial<DbRef> = {}): DbRef => ({
  unitKind: "chapter",
  unitId: "c1",
  claimId: "k1",
  claimStatus: "approved",
  kind: "quran",
  surah: 1,
  ayahFrom: 1,
  ayahTo: 2,
  hadithId: null,
  collection: null,
  grade: null,
  authentic: false,
  rightsStatus: null,
  ...o,
});
const run = (c: ContentInputs, db?: DbInputs | null) => runChecks({ content: c, db } as CheckInput);
const of = (fs: ReturnType<typeof run>, id: (typeof CHECK_IDS)[number]) => fs.filter((f) => f.check === id);

describe("the real content passes the checks", () => {
  test("the event inventory, journey and Quran text have no error and no warning", () => {
    const f = run(loadContentInputs(process.cwd()));
    expect(f.filter((x) => x.severity !== "info")).toEqual([]);
  });
  test("every known top-level route is a page of the app", () => {
    const dirs = new Set(
      readdirSync(join(process.cwd(), "src", "app", "[locale]"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
    );
    expect(KNOWN_TOP_LEVEL_ROUTES.filter((r) => !dirs.has(r))).toEqual([]);
  });
});

describe("verse ranges", () => {
  test("parse and test a range against the surah", () => {
    expect(parseRange("Q 12:4")).toEqual({ surah: 12, from: 4, to: 4 });
    expect(parseRange("2:30–39")).toEqual({ surah: 2, from: 30, to: 39 });
    expect(parseRange("nonsense")).toBeNull();
    expect(rangeProblem({ surah: 1, from: 1, to: 7 }, counts)).toBeNull();
    expect(rangeProblem({ surah: 1, from: 1, to: 8 }, counts)).toMatch(/past the end/);
    expect(rangeProblem({ surah: 115, from: 1, to: 1 }, counts)).toMatch(/does not exist/);
    expect(rangeProblem({ surah: 2, from: 5, to: 3 }, counts)).toMatch(/before it starts/);
  });
  test("a verse outside its surah is an error wherever it comes from", () => {
    const f = run(
      content({ inventory: [{ slug: "x", title: T, track: "events", refs: ["1:1-9"] }], journey: [{ id: "j", type: "prophet", refs: ["300:1"] }] }),
      emptyDb({ refs: [ref({ surah: 1, ayahFrom: 5, ayahTo: 99 })], eventRefs: [{ eventSlug: "flood", surah: 1, ayahFrom: 1, ayahTo: 8 }] }),
    );
    expect(of(f, "verse_outside_surah").map((x) => x.subject)).toEqual(expect.arrayContaining(["inventory item x", "journey stop j", "event flood"]));
    expect(of(f, "verse_outside_surah")).toHaveLength(4);
  });
});

describe("missing references", () => {
  test("a published chapter without a Quran or hadith reference is an error; a draft only a warning", () => {
    const db = emptyDb({
      chapters: [chapter({ id: "a", status: "published", anchor: "a" }), chapter({ id: "b", status: "draft", anchor: "b" }), chapter({ id: "c", status: "published", anchor: "c" })],
      refs: [ref({ unitId: "a", kind: "scholar" }), ref({ unitId: "b", kind: "scholar" })],
      unitsWithoutClaims: [{ unitKind: "chapter", unitId: "c" }],
    });
    const f = of(run(content(), db), "missing_quran_reference");
    expect(f.find((x) => x.subject.endsWith("#a"))?.severity).toBe("error");
    expect(f.find((x) => x.subject.endsWith("#b"))?.severity).toBe("warning");
    expect(f.find((x) => x.subject.endsWith("#c"))?.message).toMatch(/no claims at all/);
  });
  test("a published event without a verse reference, and an inventory item without one", () => {
    const f = of(
      run(
        content({ inventory: [{ slug: "x", title: T, track: "events", refs: [] }] }),
        emptyDb({ events: [{ slug: "e", track: "events", status: "published", orderingKind: "unassigned", datePrecision: "unknown", startYear: null, endYear: null, startAh: null, claimId: null }] }),
      ),
      "missing_quran_reference",
    );
    expect(f.map((x) => x.subject)).toEqual(expect.arrayContaining(["inventory item x", "event e"]));
  });
});

describe("duplicates", () => {
  test("identical verse sets are flagged for dedupe; a prophet and one episode of his story are not", () => {
    const f = of(
      run(
        content({
          inventory: [
            { slug: "a", title: T, track: "events", refs: ["2:10-30"] },
            { slug: "b", title: T, track: "events", refs: ["2:10-20", "2:21-30"] },
            { slug: "prophet", title: T, track: "prophets", refs: ["3:1-100"] },
            { slug: "episode", title: T, track: "events", refs: ["3:10-40"] },
          ],
        }),
      ),
      "duplicate_story",
    );
    expect(f).toHaveLength(1);
    expect(f[0]!.subject).toMatch(/a and b/);
  });
  test("two database stories on the same verses", () => {
    const db = emptyDb({
      chapters: [chapter({ id: "x", storySlug: "s1" }), chapter({ id: "y", storySlug: "s2" })],
      refs: [ref({ unitId: "x", surah: 12, ayahFrom: 1, ayahTo: 5 }), ref({ unitId: "y", surah: 12, ayahFrom: 1, ayahTo: 5 })],
    });
    expect(of(run(content(), db), "duplicate_story").map((x) => x.subject)).toEqual(["stories s1 and s2"]);
  });
});

describe("prophet labels", () => {
  const inv = [
    { slug: "nuh", title: T, track: "prophets", refs: ["11:25-49"] },
    { slug: "luqman", title: T, track: "people", refs: ["31:12-19"] },
  ];
  test("a person recorded as a prophet who is not among the prophets", () => {
    const f = of(
      run(content({ inventory: inv }), emptyDb({ people: [{ slug: "nuh", kind: "prophet", status: "draft" }, { slug: "luqman", kind: "prophet", status: "draft" }] })),
      "non_prophet_labelled_prophet",
    );
    expect(f.map((x) => x.subject)).toEqual(["person luqman"]);
  });
  test("a journey stop labelled prophet that the inventory does not list, with the journey's spelling of two slugs", () => {
    expect(canonicalSlug("zakariya")).toBe("zakariyya");
    const f = of(
      run(content({ inventory: [...inv, { slug: "zakariyya", title: T, track: "prophets", refs: ["19:2-11"] }], journey: [{ id: "zakariya", type: "prophet", refs: [] }, { id: "luqman", type: "prophet", refs: [] }] })),
      "non_prophet_labelled_prophet",
    );
    expect(f.map((x) => x.subject)).toEqual(["journey stop luqman"]);
  });
  test("text that calls a known non-prophet a prophet is a warning to look at", () => {
    const f = of(run(content({ inventory: inv }), emptyDb({ chapters: [chapter({ bodyMd: `${T} The prophet Luqman said.` })] })), "non_prophet_labelled_prophet");
    expect(f.some((x) => x.severity === "warning" && /luqman/i.test(x.message))).toBe(true);
  });
});

describe("chronology", () => {
  test("a year in the text, and a date without a source", () => {
    const f = of(
      run(
        content(),
        emptyDb({
          chapters: [chapter({ bodyMd: `${T} It happened around 1200 BCE.` }), chapter({ id: "d", anchor: "d", bodyMd: `${T} No date here.` })],
          events: [{ slug: "e", track: "events", status: "published", orderingKind: null, datePrecision: "exact", startYear: 570, endYear: null, startAh: null, claimId: null }],
        }),
      ),
      "unsupported_chronology",
    );
    expect(f.map((x) => x.message).join("|")).toMatch(/states a date/);
    expect(f.map((x) => x.message).join("|")).toMatch(/no claim that cites/);
    expect(f.filter((x) => /fx#d/.test(x.subject))).toHaveLength(0);
  });
  test("a year on an item that is only ordered", () => {
    const f = of(
      run(content(), emptyDb({ events: [{ slug: "e", track: "prophets", status: "draft", orderingKind: "relative", datePrecision: "relative", startYear: -3000, endYear: null, startAh: null, claimId: null }] })),
      "unsupported_chronology",
    );
    expect(f[0]!.severity).toBe("error");
  });
});

describe("hadith, licences, claims", () => {
  test("a hadith outside the four collections, without a grading, or graded weak", () => {
    const f = of(
      run(
        content(),
        emptyDb({
          refs: [
            ref({ kind: "hadith", collection: "nasai", grade: "sahih", authentic: true }),
            ref({ kind: "hadith", collection: "tirmidhi", grade: null }),
            ref({ kind: "hadith", collection: "ibnmajah", grade: "daif", authentic: false }),
            ref({ kind: "hadith", collection: "bukhari", grade: "sahih", authentic: true }),
          ],
        }),
      ),
      "hadith_grading_gap",
    );
    expect(f).toHaveLength(3);
  });
  test("a source whose rights are not cleared is an error under a published chapter", () => {
    const db = emptyDb({ chapters: [chapter({ status: "published" })], refs: [ref({ kind: "scholar", rightsStatus: "unknown" }), ref({ kind: "scholar", rightsStatus: "cleared" })] });
    const f = of(run(content(), db), "unlicensed_source");
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe("error");
  });
  test("a reviewed or published unit resting on an unapproved claim", () => {
    const db = emptyDb({ chapters: [chapter({ status: "published" })], refs: [ref({ claimStatus: "correction" })] });
    expect(of(run(content(), db), "unapproved_claim")[0]!.severity).toBe("error");
  });
});

describe("genealogy and translations", () => {
  const edge = (from: string, to: string, kind: string, competingGroup: string | null = null) => ({ id: `${from}${to}${kind}`, from, to, kind, status: "published", confidence: "scholar", competingGroup });
  test("a person who is their own ancestor, and parent and sibling at once", () => {
    const f = of(
      run(content(), emptyDb({ relationships: [edge("a", "b", "parent_of"), edge("b", "c", "parent_of"), edge("c", "a", "parent_of"), edge("x", "y", "parent_of"), edge("x", "y", "sibling_of")] })),
      "contradictory_genealogy",
    );
    expect(f.map((x) => x.message)).toEqual(expect.arrayContaining(["a person is their own ancestor", expect.stringMatching(/parent and child and also as siblings/)]));
    expect(f).toHaveLength(2);
  });
  test("competing alternatives are meant to disagree and are not contradictions; descendant_of counts as an ancestor edge", () => {
    expect(of(run(content(), emptyDb({ relationships: [edge("a", "b", "parent_of", "g1"), edge("b", "a", "parent_of", "g1")] })), "contradictory_genealogy")).toHaveLength(0);
    expect(of(run(content(), emptyDb({ relationships: [edge("a", "b", "parent_of"), edge("b", "a", "descendant_of")] })), "contradictory_genealogy")).toHaveLength(0);
    expect(of(run(content(), emptyDb({ relationships: [edge("a", "b", "parent_of"), edge("a", "b", "descendant_of")] })), "contradictory_genealogy").length).toBeGreaterThan(0);
  });
  test("translations without both reviews: an error once published, a note while pending", () => {
    const f = of(
      run(
        content(),
        emptyDb({
          translations: [
            { scriptId: "1", language: "ar", status: "published", title: T, linguisticOk: true, religiousOk: false },
            { scriptId: "2", language: "ur", status: "draft", title: T, linguisticOk: false, religiousOk: false },
            { scriptId: "3", language: "ur", status: "published", title: T, linguisticOk: true, religiousOk: true },
          ],
        }),
      ),
      "unreviewed_translation",
    );
    expect(f.map((x) => x.severity)).toEqual(["error", "info"]);
  });
});

describe("internal links", () => {
  const routes = content().routes;
  test("each kind of link", () => {
    const p = (h: string) => linkProblem(h, routes, counts);
    expect(p("/quran/1#ayah-1-7")).toBeNull();
    expect(p("/ar/quran/1#ayah-2")).toBeNull();
    expect(p("/quran/1#ayah-9")).toMatch(/past the end/);
    expect(p("/quran/200")).toMatch(/does not exist/);
    expect(p("/prophets/nuh")).toBeNull();
    expect(p("/prophets/nobody")).toMatch(/no page/);
    expect(p("/events/flood")).toBeNull();
    expect(p("/events/nope")).toMatch(/does not exist/);
    expect(p("/stories/fx#chapter-1")).toBeNull();
    expect(p("/nowhere")).toMatch(/not a page/);
    expect(p("javascript:alert(1)")).toMatch(/not a same-site/);
    expect(p("//evil.test")).toMatch(/not a same-site/);
    expect(p("relative/path")).toMatch(/relative link/);
    expect(p("https://example.test")).toBeNull();
    expect(p("#top")).toBeNull();
  });
  test("links are found in every mode text", () => {
    const f = of(run(content(), emptyDb({ chapters: [chapter({ kidsMd: `${T} [x](/prophets/nobody)`, deepMd: `${T} [y](/quran/300)` })] })), "broken_internal_link");
    expect(f).toHaveLength(2);
  });
  test("a summary counts findings per check", () => {
    const s = summarise(run(content({ inventory: [{ slug: "x", title: T, track: "events", refs: [] }] })));
    expect(s.errors).toBe(1);
    expect(s.by.missing_quran_reference.error).toBe(1);
  });
});

describe("reader modes", () => {
  test("a mode without reviewed text says so; nothing is derived from another mode", () => {
    const only = { summaryMd: null, bodyMd: `${T} body`, deepMd: null, kidsMd: null, lessonsMd: null };
    expect(modeContent(only, "complete")).toEqual({ state: "text", parts: [`${T} body`] });
    expect(modeContent(only, "summary")).toEqual({ state: "missing" });
    expect(modeContent(only, "kids")).toEqual({ state: "missing" });
    expect(modeContent(only, "lessons")).toEqual({ state: "missing" });
    expect(modeContent(only, "deep")).toEqual({ state: "text", parts: [`${T} body`], noExtra: true });
    expect(modeContent({ ...only, bodyMd: "   " }, "complete")).toEqual({ state: "missing" });
    expect(modeContent({ ...only, bodyMd: "", deepMd: null }, "deep")).toEqual({ state: "missing" });
    expect(modeContent({ ...only, deepMd: `${T} more` }, "deep")).toEqual({ state: "text", parts: [`${T} body`, `${T} more`], noExtra: false });
  });
  test("the mode parameter is whitelisted", () => {
    expect(READER_MODES).toEqual(["summary", "complete", "deep", "kids", "lessons"]);
    expect(parseMode("kids")).toBe("kids");
    expect(parseMode("<script>")).toBeNull();
    expect(parseMode(null)).toBeNull();
  });
  test("which modes have text anywhere", () => {
    const h = modesWithText([
      { summaryMd: null, bodyMd: "x", deepMd: null, kidsMd: null, lessonsMd: null },
      { summaryMd: "s", bodyMd: "", deepMd: null, kidsMd: null, lessonsMd: null },
    ]);
    expect(h).toEqual({ summary: true, complete: true, deep: true, kids: false, lessons: false });
  });
});

describe("coverage figures", () => {
  const row = (o: Partial<SubjectRow>): SubjectRow => ({
    track: "prophets",
    event_id: "1",
    slug: "nuh",
    title: T,
    status: "draft",
    verse_refs: 0,
    verse_refs_verified: 0,
    claims: 0,
    claims_approved: 0,
    hadith_links: 0,
    hadith_verified: 0,
    chapters: 0,
    chapters_drafted: 0,
    chapters_reviewed: 0,
    chapters_published: 0,
    sections: 0,
    sections_drafted: 0,
    sections_reviewed: 0,
    sections_published: 0,
    scripts_en: 0,
    scripts_ar: 0,
    scripts_ur: 0,
    translations_pending: 0,
    media_approved: 0,
    needs_review: 0,
    researched: false,
    reviewed: false,
    published: false,
    ...o,
  });
  test("discovered, researched, reviewed and published are separate counts", () => {
    expect(fourCounts([row({}), row({ researched: true }), row({ researched: true, reviewed: true }), row({ researched: true, reviewed: true, published: true })])).toEqual({
      total: 4,
      discovered: 4,
      researched: 3,
      reviewed: 2,
      published: 1,
    });
  });
  test("indexed passages are not verified passages", () => {
    const q = quranCoverage(
      [
        { source: "event", surah: 2, ayah_from: 1, ayah_to: 10, verified: true },
        { source: "event", surah: 2, ayah_from: 11, ayah_to: 20, verified: false },
      ],
      [{ surah: 2, from: 1, to: 30 }],
      [{ surah: 2, from: 31, to: 40 }],
    );
    expect([q.register.narrative, q.indexed.covered, q.verified.covered, q.inventory.covered]).toEqual([40, 20, 10, 30]);
  });
});

describe("the migration files", () => {
  test("the chapter migrations stay within their reserved numbers and drop nothing", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const mine = readdirSync(dir).filter((f) => /^202610310025[5-7]\d_/.test(f));
    expect(mine.length).toBeGreaterThanOrEqual(3);
    for (const f of mine) expect(readFileSync(join(dir, f), "utf8")).not.toMatch(/\bdrop table\b/i);
  });
});
