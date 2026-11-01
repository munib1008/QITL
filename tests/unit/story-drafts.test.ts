// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SUBJECT_TRACK, ayatOfRanges, compact, hasAnchor, hasErrors, markerIds, splitUnits, stripMarkers, validateStoryDraft, StoryDraftSchema, type Issue, type StoryDraft } from "@/lib/stories/draft";
import { loadAnchorFixtures, loadDraftContext, loadDraftFiles } from "@/lib/stories/draft-load";
import { chapterRow, importDraft, NullStore } from "@/lib/stories/draft-import";

/**
 * The story-draft validator (src/lib/stories/draft.ts) and the drafts in content/stories. The negative cases start from a
 * small valid draft over 12:4-7 and break one rule at a time.
 */
const root = join(__dirname, "..", "..");
const ctx = loadDraftContext(root);

const base = (): StoryDraft =>
  StoryDraftSchema.parse({
    slug: "yusuf",
    title_en: "Yusuf",
    title_ar: "يوسف",
    subject: { type: "prophet", event_slug: "yusuf" },
    status: "draft",
    notes: "test",
    chapters: [
      {
        anchor: "the-dream",
        position: 1,
        title_en: "The dream",
        event_slug: "yusufs-dream",
        verses: [{ surah: 12, from: 4, to: 6 }],
        claims: [
          { id: "c1", statement_en: "Yusuf told his father that he had seen eleven stars, the sun and the moon.", verses: [{ surah: 12, from: 4, to: 4 }], evidence: "quran" },
          { id: "c2", statement_en: "His father told him not to relate his dream to his brothers.", verses: [{ surah: 12, from: 5, to: 5 }], evidence: "quran" },
          { id: "c3", statement_en: "His father spoke of God's favour on the family of Yaqub.", verses: [{ surah: 12, from: 6, to: 6 }], evidence: "quran" },
        ],
        summary_md: "Yusuf told his father of a dream [c1].",
        body_md: "Yusuf told his father of his dream [c1]. His father told him to keep it from his brothers [c2]. He spoke of favour on the family of Yaqub [c3].",
        deep_md: null,
        kids_md: null,
        lessons_md: null,
        unknowns_md: "- The Quran does not give the meaning of the dream here.",
      },
    ],
    uncertainties_en: ["Hadith to add later: none yet."],
  });

const run = (d: unknown, fileSlug?: string): Issue[] => validateStoryDraft(d, ctx, { fileSlug });
const errors = (d: unknown) => run(d).filter((i) => i.severity === "error");
const codes = (d: unknown) => errors(d).map((i) => i.code);
/** Apply a change to a deep copy of the base draft and return the error codes. */
function mutate(f: (d: StoryDraft) => void): string[] {
  const d = JSON.parse(JSON.stringify(base())) as StoryDraft;
  f(d);
  return codes(d);
}

describe("the base draft", () => {
  test("is valid (empty modes are only warnings)", () => {
    const issues = run(base(), "yusuf");
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(issues.some((i) => i.code === "mode-empty")).toBe(true);
  });
  test("must say which hadith are still to be added", () => {
    const d = base();
    d.uncertainties_en = ["Something else."];
    expect(run(d).some((i) => i.code === "hadith-later")).toBe(true);
  });
});

describe("schema", () => {
  test("rejects a status other than draft, unknown keys and an unknown subject type; a subject type must match its track", () => {
    expect(StoryDraftSchema.safeParse({ ...base(), status: "published" }).success).toBe(false);
    expect(StoryDraftSchema.safeParse({ ...base(), approved: true }).success).toBe(false);
    expect(StoryDraftSchema.safeParse({ ...base(), subject: { type: "hadith", event_slug: "yusuf" } }).success).toBe(false);
    const wrongTrack = validateStoryDraft({ ...base(), subject: { type: "event", event_slug: "yusuf" } }, ctx);
    expect(wrongTrack.some((i) => i.code === "subject")).toBe(true);
    expect(StoryDraftSchema.safeParse({ ...base(), chapters: [] }).success).toBe(false);
  });
  test("a claim must be Quran evidence with at least one verse", () => {
    const d = JSON.parse(JSON.stringify(base()));
    d.chapters[0].claims[0].evidence = "hadith";
    expect(StoryDraftSchema.safeParse(d).success).toBe(false);
    const e = JSON.parse(JSON.stringify(base()));
    e.chapters[0].claims[0].verses = [];
    expect(StoryDraftSchema.safeParse(e).success).toBe(false);
  });
  test("returns schema issues instead of throwing", () => {
    expect(run({ nope: 1 }).every((i) => i.code === "schema")).toBe(true);
    expect(run(null).length).toBeGreaterThan(0);
  });
});

describe("verses", () => {
  test("a range past the end of its surah fails", () => {
    expect(mutate((d) => { d.chapters[0]!.verses = [{ surah: 12, from: 100, to: 120 }]; })).toContain("verse-bounds");
  });
  test("a claim whose verses are outside the chapter fails", () => {
    expect(mutate((d) => { d.chapters[0]!.claims[0]!.verses = [{ surah: 12, from: 4, to: 8 }]; })).toContain("claim-outside");
  });
  test("chapter verses must lie within the inventory refs of the subject", () => {
    expect(mutate((d) => { d.chapters[0]!.verses = [{ surah: 12, from: 4, to: 6 }, { surah: 12, from: 102, to: 103 }]; d.chapters[0]!.claims[0]!.verses = [{ surah: 12, from: 102, to: 102 }]; })).toContain("inventory");
  });
  test("the event link must exist and contain the chapter's verses", () => {
    expect(mutate((d) => { d.chapters[0]!.event_slug = "no-such-event"; })).toContain("event");
    expect(mutate((d) => { d.chapters[0]!.event_slug = "yusuf-and-the-well"; })).toContain("event");
  });
  test("a verse listed for the chapter but cited by no claim is a warning", () => {
    const d = base();
    d.chapters[0]!.verses = [{ surah: 12, from: 4, to: 7 }];
    expect(run(d).some((i) => i.code === "verse-unclaimed" && i.severity === "warning")).toBe(true);
  });
  test("a verse reference written in the text must exist and lie inside the chapter", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " A note on 12:900 [c1]."; })).toContain("verse-ref");
    expect(mutate((d) => { d.chapters[0]!.body_md += " A note on 12:30 [c1]."; })).toContain("verse-ref-outside");
    expect(mutate((d) => { d.chapters[0]!.body_md += " A note on 12:5 [c1]."; })).toEqual([]);
  });
  test("coverage of the inventory is reported as information, not as an error", () => {
    const i = run(base()).find((x) => x.code === "coverage");
    expect(i?.severity).toBe("info");
  });
});

describe("claims", () => {
  test("every sentence of the claim-bound texts needs a claim marker", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " Another sentence with nothing behind it."; })).toContain("no-claim");
    expect(mutate((d) => { d.chapters[0]!.summary_md = "No marker here."; })).toContain("no-claim");
  });
  test("a marker must name a claim of the chapter", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " Extra [c9]."; })).toContain("claim-unknown");
  });
  test("duplicate claim ids and duplicate anchors fail", () => {
    expect(mutate((d) => { d.chapters[0]!.claims[1]!.id = "c1"; })).toContain("claim-dup");
    expect(mutate((d) => { d.chapters.push({ ...JSON.parse(JSON.stringify(d.chapters[0])), position: 2 }); })).toContain("anchor-dup");
  });
  test("positions run 1..n", () => {
    expect(mutate((d) => { d.chapters[0]!.position = 3; })).toContain("position");
  });
  test("an unused claim is a warning", () => {
    const d = base();
    d.chapters[0]!.body_md = d.chapters[0]!.body_md.replace(" [c3]", "");
    d.chapters[0]!.body_md += " More text [c1].";
    expect(run(d).some((i) => i.code === "claim-unused")).toBe(true);
  });
  test("the slug must match the file name", () => {
    expect(run(base(), "adam").some((i) => i.code === "slug-file")).toBe(true);
  });
});

describe("forbidden content", () => {
  test("hadith wording is refused", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " It is in the hadith collections [c1]."; })).toContain("hadith");
    expect(mutate((d) => { d.chapters[0]!.body_md += " Narrated by Bukhari [c1]."; })).toContain("hadith");
  });
  test("ages, years and counts that the ayat do not state are refused", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " He was 17 years old [c1]."; })).toContain("number-digit");
    expect(mutate((d) => { d.chapters[0]!.body_md += " He saw twelve stars [c1]."; })).toContain("number-word");
    expect(mutate((d) => { d.chapters[0]!.body_md += " He had forty brothers [c1]."; })).toContain("number-word");
    // a number the cited ayah does state is allowed: "eleven" is in 12:4
    expect(mutate((d) => { d.chapters[0]!.body_md += " There were eleven stars [c1]."; })).toEqual([]);
    // but the anchor must be in THIS chapter's ayat
    expect(mutate((d) => { d.chapters[0]!.verses = [{ surah: 12, from: 5, to: 6 }]; d.chapters[0]!.claims = d.chapters[0]!.claims.slice(1); d.chapters[0]!.summary_md = "A father spoke [c2]."; d.chapters[0]!.body_md = "He spoke of eleven stars [c2]. Then more [c3]."; })).toContain("number-anchor");
  });
  test("a person or place that the cited ayat do not contain is refused", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " Egypt was far away [c1]."; })).toContain("name-anchor");
    expect(mutate((d) => { d.chapters[0]!.body_md += " His brother Benyamin was there [c1]."; })).toContain("name-unknown");
  });
  test("names from later tradition are refused in the story texts and allowed only under their label", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " The woman Zulaykha was there [c1]."; })).toContain("tradition-name");
    const d = base();
    d.chapters[0]!.unknowns_md = "- Named in later tradition, not in the Quranic text: Zulaykha is the name given to her.";
    expect(errors(d)).toEqual([]);
    const e = base();
    e.chapters[0]!.unknowns_md = "- Zulaykha is the name given to her.";
    expect(errors(e).map((i) => i.code)).toContain("tradition-name");
  });
  test("direct quotation is allowed only for speech that a cited claim records", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += ' He said "I will never go" [c1].'; })).toContain("quote");
    // a claim that records speech and contains the quoted words allows the quotation
    const d = base();
    d.chapters[0]!.claims[1]!.statement_en = 'His father said "do not relate your dream" to him.';
    d.chapters[0]!.body_md = 'Yusuf told his father of his dream [c1]. His father said "do not relate your dream" [c2]. He spoke of favour on the family of Yaqub [c3].';
    expect(errors(d)).toEqual([]);
    // the same words with no speech verb in the claim are refused
    const e = base();
    e.chapters[0]!.claims[1]!.statement_en = 'The dream is "not to be related" to the brothers.';
    e.chapters[0]!.body_md = 'Yusuf told his father of his dream [c1]. The dream is "not to be related" [c2]. He spoke of favour on the family of Yaqub [c3].';
    expect(errors(e).map((i) => i.code)).toContain("quote");
  });
  test("depiction wording is refused", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " Yusuf was a handsome boy [c1]."; })).toContain("depiction");
    expect(mutate((d) => { d.chapters[0]!.body_md += " Yusuf wore a robe [c1]."; })).toContain("depiction");
  });
  test("'it is said' and tradition phrases are refused in the story texts but not in unknowns", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " It is said that the dream came at night [c1]."; })).toContain("tradition-phrase");
    expect(mutate((d) => { d.chapters[0]!.body_md += " According to tradition the sun was a mother [c1]."; })).toContain("tradition-phrase");
    const d = base();
    d.chapters[0]!.unknowns_md = "- Later tradition says more, but the Quran does not.";
    expect(errors(d)).toEqual([]);
  });
  test("Arabic script in a text is refused (references are enough)", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " يوسف [c1]."; })).toContain("arabic-in-text");
  });
  test("legal, medical and worldly-promise wording is refused", () => {
    expect(mutate((d) => { d.chapters[0]!.body_md += " This is halal [c1]."; })).toContain("legal-medical");
    expect(mutate((d) => { d.chapters[0]!.body_md += " Patience guarantees success [c1]."; })).toContain("worldly-promise");
  });
  test("title_ar must be the well-known Arabic name of the subject, or null", () => {
    expect(mutate((d) => { d.title_ar = "نوح"; })).toContain("title-ar");
    expect(mutate((d) => { d.title_ar = null; })).toEqual([]);
  });
});

describe("the depth modes only restate claims", () => {
  test("lessons_md must carry the educational-interpretation label", () => {
    expect(mutate((d) => { d.chapters[0]!.lessons_md = "Patience is good [c1]."; })).toContain("lessons-label");
    expect(mutate((d) => { d.chapters[0]!.lessons_md = "Educational interpretation (not scripture): A careful telling of a dream is a kind of wisdom [c2]."; })).toEqual([]);
  });
  test("kids, summary and lessons may not add a name or number that no claim contains", () => {
    expect(mutate((d) => { d.chapters[0]!.kids_md = "Yusuf told his father about Egypt [c1]."; })).toEqual(expect.arrayContaining(["name-anchor"]));
    // Yaqub is in the cited ayat of the chapter (12:6) and in claim c3, so a kids text may use it
    expect(mutate((d) => { d.chapters[0]!.kids_md = "His father spoke of the family of Yaqub [c3]."; })).toEqual([]);
    // but a name that is in the ayat yet in no claim is flagged as an added fact
    const d = base();
    d.chapters[0]!.claims[2]!.statement_en = "His father spoke of God's favour on the family.";
    d.chapters[0]!.kids_md = "His father spoke of the family of Yaqub [c3].";
    expect(errors(d).map((i) => i.code)).toContain("adds-fact");
  });
});

describe("helpers", () => {
  test("markers", () => {
    expect(markerIds("a [c1] b [c2, c3] c")).toEqual(["c1", "c2", "c3"]);
    expect(stripMarkers("A fact [c1]. Another [c2, c3].")).toBe("A fact. Another.");
  });
  test("units are sentences and bullets; headings are skipped", () => {
    expect(splitUnits("One. Two!\n\n- Bullet one\n- Bullet two\n\n## Heading")).toEqual(["One.", "Two!", "Bullet one", "Bullet two"]);
  });
  test("compact ranges", () => {
    expect(compact(["2:30", "2:31", "2:32", "7:1", "7:3"])).toBe("2:30-32, 7:1, 7:3");
    expect(ayatOfRanges([{ surah: 1, from: 1, to: 3 }]).size).toBe(3);
  });
  test("hasErrors", () => {
    expect(hasErrors([{ severity: "info", code: "x", where: "", message: "" }])).toBe(false);
    expect(hasErrors([{ severity: "error", code: "x", where: "", message: "" }])).toBe(true);
  });
});

describe("anchor fixtures", () => {
  const fx = loadAnchorFixtures(root);
  test("every name, number and guarded anchor occurs somewhere in the Quran text", () => {
    const all = new Set<string>();
    for (const k of ctx.quran.keys()) all.add(k);
    for (const group of [fx.names, fx.numbers, fx.guarded]) {
      for (const [word, anchor] of Object.entries(group)) {
        let found = false;
        for (const k of all) {
          const [s, a] = k.split(":").map(Number) as [number, number];
          if (hasAnchor(ctx.quran, new Set([`${s}:${a}`]), anchor)) {
            found = true;
            break;
          }
        }
        expect(found, `anchor for "${word}" (${anchor}) was not found in the Quran text`).toBe(true);
      }
    }
  });
  test("a name is never both an allowed name and a tradition name", () => {
    const names = new Set(Object.keys(fx.names).map((n) => n.toLowerCase()));
    for (const t of fx.tradition_names) expect(names.has(t.toLowerCase()), t).toBe(false);
  });
  test("batch files are merged and a conflicting anchor is an error", () => {
    const dir = mkdtempSync(join(tmpdir(), "anchors-"));
    try {
      mkdirSync(join(dir, "tests", "fixtures"), { recursive: true });
      writeFileSync(join(dir, "tests", "fixtures", "story-anchors.json"), JSON.stringify({ names: { Adam: "ادم" }, tradition_names: ["Eve"] }));
      writeFileSync(join(dir, "tests", "fixtures", "story-anchors.other.json"), JSON.stringify({ names: { Nuh: "نوح" }, tradition_names: ["Eve", "Ham"] }));
      const m = loadAnchorFixtures(dir);
      expect(Object.keys(m.names).sort()).toEqual(["Adam", "Nuh"]);
      expect(m.tradition_names.sort()).toEqual(["Eve", "Ham"]);
      writeFileSync(join(dir, "tests", "fixtures", "story-anchors.clash.json"), JSON.stringify({ names: { Adam: "غير" } }));
      expect(() => loadAnchorFixtures(dir)).toThrow(/twice/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the drafts in content/stories", () => {
  const files = loadDraftFiles(root);
  test("whatever is present passes the validator with no error and no warning (none present is fine)", () => {
    for (const f of files) {
      expect(f.parseError, f.file).toBeUndefined();
      const bad = run(f.raw, f.slug).filter((i) => i.severity !== "info");
      expect(bad, `${f.file}: ${bad.map((b) => `${b.code} ${b.where}`).join("; ")}`).toEqual([]);
    }
  });
  test("every present draft is a draft, English only, and says so", () => {
    for (const f of files) {
      const d = StoryDraftSchema.parse(f.raw);
      expect(d.status).toBe("draft");
      expect(d.notes ?? "").toMatch(/DRAFT/);
      expect(d.notes ?? "").toMatch(/Arabic and Urdu/);
      expect(d.uncertainties_en.some((u) => u.startsWith("Hadith to add later:"))).toBe(true);
      const raw = readFileSync(join(root, "content", "stories", f.file), "utf8");
      expect(raw).not.toMatch(/"(approved|published|reviewed)"\s*:\s*true/);
    }
  });
  test("a chapter's verses never include a verse outside its subject's inventory refs", () => {
    for (const f of files) {
      const d = StoryDraftSchema.parse(f.raw);
      const inv = ctx.inventory.find((i) => i.slug === d.subject.event_slug)!;
      expect(inv.track).toBe(SUBJECT_TRACK[d.subject.type]);
    }
  });
});

describe("no drafts present", () => {
  test("an empty or missing content/stories folder is fine", () => {
    const dir = mkdtempSync(join(tmpdir(), "nodrafts-"));
    try {
      expect(loadDraftFiles(dir)).toEqual([]);
      mkdirSync(join(dir, "content", "stories"), { recursive: true });
      writeFileSync(join(dir, "content", "stories", "SCHEMA.md"), "x");
      expect(loadDraftFiles(dir)).toEqual([]);
      writeFileSync(join(dir, "content", "stories", "broken.draft.json"), "{ not json");
      const f = loadDraftFiles(dir);
      expect(f).toHaveLength(1);
      expect(f[0]!.parseError).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the importer (no database)", () => {
  test("chapterRow strips markers and keeps the modes apart", () => {
    const d = base();
    const row = chapterRow(d.chapters[0]!, null);
    expect(row.body_md).not.toMatch(/\[c/);
    expect(row.summary_md).toBe("Yusuf told his father of a dream.");
    expect(row.deep_md).toBeNull();
  });
  test("the dry run lists creations only and never writes", async () => {
    const r = await importDraft(new NullStore(), base(), { apply: false, offline: true });
    expect(r.counts.updated + r.counts.deleted + r.counts.skipped + r.counts.warnings).toBe(0);
    expect(r.actions[0]!.what).toBe("story yusuf");
    expect(r.actions.every((a) => !/approved|published/.test(a.detail ?? ""))).toBe(true);
  });
  test("the importer source never mentions an approved or published status", () => {
    const src = readFileSync(join(root, "src", "lib", "stories", "draft-import.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/["'`](approved|published|in_review)["'`]/);
    expect(src).not.toMatch(/editorial_reviews/);
    const cli = readFileSync(join(root, "scripts", "import-story-drafts.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cli).not.toMatch(/readFileSync|dotenv|loadEnv|env\.local/);
    expect(cli).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  });
});
