// @vitest-environment node
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";
import { PgStore } from "./draft-store";
import { importDraft, NullStore, type ImportReport } from "../../src/lib/stories/draft-import";
import { StoryDraftSchema, ayatOfRanges, type StoryDraft } from "../../src/lib/stories/draft";
import { loadDraftContext, loadDraftFiles } from "../../src/lib/stories/draft-load";
import { validateStoryDraft } from "../../src/lib/stories/draft";

/**
 * Importing the story drafts (src/lib/stories/draft-import.ts) into the real schema: everything lands as a draft, no
 * review is written, publishing stays refused, re-importing changes nothing, and rows that are no longer drafts are
 * left alone. The Quran rows are loaded from content/quran so the claim references satisfy their foreign key.
 */
const root = join(__dirname, "..", "..");
const ctx = loadDraftContext(root);

/** A small valid draft over Surah 12 (used when no content draft is present, and for the mutation tests). */
function sample(): StoryDraft {
  return StoryDraftSchema.parse({
    slug: "sample-yusuf",
    title_en: "Yusuf",
    title_ar: "يوسف",
    subject: { type: "prophet", event_slug: "yusuf" },
    status: "draft",
    notes: "test sample",
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
      {
        anchor: "the-brothers-plot",
        position: 2,
        title_en: "The brothers' plot",
        event_slug: null,
        verses: [{ surah: 12, from: 7, to: 7 }],
        claims: [{ id: "c1", statement_en: "The Quran says that in Yusuf and his brothers there are signs for those who ask.", verses: [{ surah: 12, from: 7, to: 7 }], evidence: "quran" }],
        summary_md: "There are signs in Yusuf and his brothers [c1].",
        body_md: "The Quran says that there are signs in Yusuf and his brothers for those who ask [c1].",
        deep_md: null,
        kids_md: null,
        lessons_md: null,
        unknowns_md: "- The Quran does not say more here.",
      },
    ],
    uncertainties_en: ["Hadith to add later: none yet."],
  });
}

let db: Db;
let store: PgStore;
let editor: string;
const count = async (sql: string, params: unknown[] = []) => Number((await db.admin<{ n: string }>(sql, params))[0]!.n);

/** Insert the Quran surahs and ayat that the drafts and the sample refer to, from the repository text. */
async function loadQuranRows(surahs: number[]) {
  const [{ id: sourceId }] = (await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status) values ('quran_text', 'Test source', 'cleared') returning id")) as [{ id: string }];
  const [{ id: versionId }] = (await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('a', 64), now(), 'https://example.test', true) returning id",
    [sourceId],
  )) as [{ id: string }];
  for (const s of surahs) {
    const n = ctx.ayahCounts[s]!;
    await db.admin("insert into public.quran_surahs (id, name_ar, name_transliterated, ayah_count, source_version_id) values ($1, $2, $3, $4, $5)", [s, `s${s}`, `Surah ${s}`, n, versionId]);
    const nums: number[] = [];
    const texts: string[] = [];
    for (let a = 1; a <= n; a++) {
      nums.push(a);
      texts.push(ctx.quran.get(`${s}:${a}`)!);
    }
    await db.admin("insert into public.quran_verses (surah_id, ayah_no, text_ar, source_version_id) select $1, unnest($2::int[]), unnest($3::text[]), $4", [s, nums, texts, versionId]);
  }
}

let loaded: StoryDraft[] = [];

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  store = new PgStore(db);
  editor = await db.createUser("drafts-editor@test.local", ["editor"]);
  const files = loadDraftFiles(root);
  loaded = files.filter((f) => !f.parseError && validateStoryDraft(f.raw, ctx, { fileSlug: f.slug }).every((i) => i.severity === "info")).map((f) => StoryDraftSchema.parse(f.raw));
  const surahs = new Set<number>([12]);
  for (const d of loaded) for (const c of d.chapters) for (const k of ayatOfRanges(c.verses)) surahs.add(Number(k.split(":")[0]));
  await loadQuranRows([...surahs].sort((a, b) => a - b));
}, 240_000);

const total = (r: ImportReport) => r.counts.created + r.counts.updated + r.counts.deleted;

describe("the dry run", () => {
  test("without a database it plans only creations and writes nothing", async () => {
    const r = await importDraft(new NullStore(), sample(), { apply: false, offline: true });
    expect(r.counts.created).toBeGreaterThan(5);
    expect(r.counts.updated + r.counts.deleted + r.counts.skipped + r.counts.warnings).toBe(0);
    expect(await count("select count(*) as n from public.stories where slug = 'sample-yusuf'")).toBe(0);
  });
  test("a dry run against the database plans the same but writes nothing", async () => {
    const r = await importDraft(store, sample(), { apply: false });
    expect(r.counts.created).toBeGreaterThan(5);
    expect(await count("select count(*) as n from public.stories where slug = 'sample-yusuf'")).toBe(0);
    expect(await count("select count(*) as n from public.evidence_claims")).toBe(0);
  });
});

describe("importing as drafts", () => {
  let first: ImportReport;
  test("creates the story, chapters, claims, references and links, all as drafts", async () => {
    first = await importDraft(store, sample(), { apply: true });
    expect(total(first)).toBeGreaterThan(0);
    expect(await count("select count(*) as n from public.stories where slug = 'sample-yusuf' and status = 'draft'")).toBe(1);
    expect(await count("select count(*) as n from public.chapters c join public.stories s on s.id = c.story_id where s.slug = 'sample-yusuf'")).toBe(2);
    expect(await count("select count(*) as n from public.chapters where status <> 'draft'")).toBe(0);
    expect(await count("select count(*) as n from public.evidence_claims")).toBe(4);
    expect(await count("select count(*) as n from public.evidence_claims where status <> 'draft'")).toBe(0);
    expect(await count("select count(*) as n from public.claim_references where kind = 'quran'")).toBe(4);
    expect(await count("select count(*) as n from public.chapter_claims")).toBe(4);
    expect(await count("select count(*) as n from public.chapter_claims where anchor ~ '^c[0-9]+$'")).toBe(4);
  });
  test("stores the depth modes in their own columns and strips the claim markers from the text", async () => {
    const [c] = await db.admin<{ body_md: string; summary_md: string; unknowns_md: string; deep_md: string | null; event_id: string | null; anchor: string }>(
      "select body_md, summary_md, unknowns_md, deep_md, event_id, anchor from public.chapters where anchor = 'the-dream'",
    );
    expect(c!.body_md).not.toMatch(/\[c\d/);
    expect(c!.body_md).toContain("Yusuf told his father of his dream.");
    expect(c!.summary_md).toBe("Yusuf told his father of a dream.");
    expect(c!.unknowns_md).toContain("does not give the meaning");
    expect(c!.deep_md).toBeNull();
    expect(c!.event_id).not.toBeNull();
    expect(await count("select count(*) as n from public.event_stories es join public.stories s on s.id = es.story_id where s.slug = 'sample-yusuf'")).toBe(1);
  });
  test("writes no review and no approval", async () => {
    expect(await count("select count(*) as n from public.editorial_reviews")).toBe(0);
    expect(await count("select count(*) as n from public.evidence_claims where approved_by is not null or approved_at is not null")).toBe(0);
    expect(await count("select count(*) as n from public.stories where published_at is not null")).toBe(0);
  });
  test("publishing is still refused: no review, no publish", async () => {
    const [ch] = await db.admin<{ id: string }>("select id from public.chapters where anchor = 'the-dream'");
    const [st] = await db.admin<{ id: string }>("select id from public.stories where slug = 'sample-yusuf'");
    await rejects(db.as(editor, "update public.chapters set status = 'published' where id = $1", [ch!.id]), /no (review|evidence), no publish|permission|row-level|violates/i);
    await rejects(db.as(editor, "update public.stories set status = 'published' where id = $1", [st!.id]), /no (review|evidence), no publish|permission|row-level|violates/i);
    // even the database owner cannot skip the guard
    await rejects(db.admin("update public.chapters set status = 'published' where id = $1", [ch!.id]), /no (review|evidence), no publish/);
    await rejects(db.admin("update public.stories set status = 'published' where id = $1", [st!.id]), /no (review|evidence), no publish/);
    expect(await count("select count(*) as n from public.chapters where status = 'published'")).toBe(0);
  });
  test("a claim cannot be approved without a review either", async () => {
    const [cl] = await db.admin<{ id: string }>("select id from public.evidence_claims limit 1");
    await rejects(db.admin("update public.evidence_claims set status = 'approved' where id = $1", [cl!.id]), /review|approv/i);
  });
});

describe("idempotence", () => {
  test("a second import changes nothing, not even the versions", async () => {
    const before = await db.admin<{ id: string; version: number; updated_at: string }>("select id, version, updated_at from public.chapters order by id");
    const counts = await Promise.all(["stories", "chapters", "evidence_claims", "claim_references", "chapter_claims", "event_stories"].map((t) => count(`select count(*) as n from public.${t}`)));
    const second = await importDraft(store, sample(), { apply: true });
    expect(total(second)).toBe(0);
    expect(second.counts.skipped).toBe(0);
    const after = await db.admin<{ id: string; version: number; updated_at: string }>("select id, version, updated_at from public.chapters order by id");
    expect(after).toEqual(before);
    const counts2 = await Promise.all(["stories", "chapters", "evidence_claims", "claim_references", "chapter_claims", "event_stories"].map((t) => count(`select count(*) as n from public.${t}`)));
    expect(counts2).toEqual(counts);
  });
  test("a changed draft updates only what changed", async () => {
    const d = sample();
    d.chapters[0]!.title_en = "The dream of the stars";
    d.chapters[0]!.claims[1]!.statement_en = "His father told him not to relate his dream to his brothers, or they would plot against him.";
    d.chapters[0]!.claims[2]!.verses = [{ surah: 12, from: 6, to: 6 }, { surah: 12, from: 5, to: 5 }];
    const r = await importDraft(store, d, { apply: true });
    expect(r.counts.updated).toBe(4); // the chapter, two claims, and the story summary (it lists the chapter titles)
    expect(r.counts.created + r.counts.deleted).toBe(0);
    expect(await count("select count(*) as n from public.chapters where title = 'The dream of the stars'")).toBe(1);
    expect(await count("select count(*) as n from public.claim_references where kind = 'quran'")).toBe(5);
    expect(total(await importDraft(store, d, { apply: true }))).toBe(0);
  });
  test("a claim removed from the draft is removed (while it is a draft)", async () => {
    const d = sample();
    d.chapters[0]!.claims = d.chapters[0]!.claims.slice(0, 2);
    d.chapters[0]!.body_md = "Yusuf told his father of his dream [c1]. His father told him to keep it from his brothers [c2].";
    const r = await importDraft(store, d, { apply: true });
    expect(r.counts.deleted).toBe(1);
    expect(await count("select count(*) as n from public.evidence_claims")).toBe(3);
  });
});

describe("rows that are no longer drafts are left alone", () => {
  test("a chapter in review is skipped and its text and claims stay as they are", async () => {
    await db.admin("update public.chapters set status = 'in_review' where anchor = 'the-brothers-plot'");
    const d = sample();
    d.chapters[1]!.title_en = "A changed title";
    d.chapters[1]!.claims[0]!.statement_en = "A different statement that must not overwrite the reviewed one.";
    const r = await importDraft(store, d, { apply: true });
    expect(r.counts.skipped).toBe(1);
    expect(await count("select count(*) as n from public.chapters where title = 'A changed title'")).toBe(0);
    expect(await count("select count(*) as n from public.evidence_claims where statement like 'A different statement%'")).toBe(0);
  });
  test("a story that is not a draft is skipped with all its chapters", async () => {
    await db.admin("update public.stories set status = 'in_review' where slug = 'sample-yusuf'");
    const d = sample();
    d.chapters[0]!.title_en = "Never written";
    const r = await importDraft(store, d, { apply: true });
    expect(r.actions.some((a) => a.level === "skip" && a.what.startsWith("story"))).toBe(true);
    expect(await count("select count(*) as n from public.chapters where title = 'Never written'")).toBe(0);
    await db.admin("update public.stories set status = 'draft' where slug = 'sample-yusuf'");
  });
});

describe("the drafts in content/stories", () => {
  test("every valid draft present imports as drafts with its chapters and claims, then re-imports unchanged", async () => {
    if (loaded.length === 0) return; // none written yet: nothing to prove
    for (const d of loaded.filter((x) => x.slug !== "yusuf")) {
      const r = await importDraft(store, d, { apply: true });
      expect(r.counts.created).toBeGreaterThan(0);
      expect(r.counts.warnings).toBe(0);
      const [story] = await db.admin<{ id: string; status: string }>("select id, status from public.stories where slug = $1", [d.slug]);
      expect(story!.status).toBe("draft");
      expect(await count("select count(*) as n from public.chapters where story_id = $1 and status = 'draft'", [story!.id])).toBe(d.chapters.length);
      const claims = d.chapters.reduce((n, c) => n + c.claims.length, 0);
      expect(await count("select count(*) as n from public.chapter_claims cc join public.chapters c on c.id = cc.chapter_id where c.story_id = $1", [story!.id])).toBe(claims);
      expect(await count("select count(*) as n from public.chapters c join public.stories s on s.id = c.story_id where s.id = $1 and c.event_id is not null", [story!.id])).toBe(d.chapters.filter((c) => c.event_slug !== null).length);
      expect(total(await importDraft(store, d, { apply: true }))).toBe(0);
    }
    expect(await count("select count(*) as n from public.editorial_reviews")).toBe(0);
    expect(await count("select count(*) as n from public.chapters c join public.stories s on s.id = c.story_id where s.slug <> 'sample-yusuf' and c.status <> 'draft'")).toBe(0);
  });
});
