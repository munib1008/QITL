// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, type Db } from "./harness";
import { normalizeArabic } from "@/lib/search";

/**
 * Unified search privacy (migration 20261031002200): only published, public rows are ever indexed or returned;
 * drafts, private Mufti questions and dream requests never are, not even to the person who wrote them.
 * Every text below is a labelled test placeholder, never religious content.
 */
const FX = "Fixture";

let db: Db;
let asker: string, admin: string;
let versionId: string;
const ids: Record<string, string> = {};

type Row = { url: string; entity_type: string; entity_id: string; title: string };
const search = (user: string | null, q: string, alts: string[] | null = null) =>
  db.as<Row>(user, "select * from public.search($1, null, 200, 0, $2)", [q, alts]);

/** Insert or update rows bypassing the editorial publish guards (setup only), then rebuild the index. */
async function raw(sql: string, params: unknown[] = []) {
  await db.pg.exec("reset role; set session_replication_role = replica;");
  try {
    return (await db.pg.query<{ id: string }>(sql, params)).rows;
  } finally {
    await db.pg.exec("set session_replication_role = origin;");
  }
}

beforeAll(async () => {
  db = await createDb();
  asker = await db.createUser("asker@test.local");
  admin = await db.createUser("admin@test.local", ["admin"]);
  const [src] = await db.admin<{ id: string }>("insert into public.sources (type, work, rights_status, source_url) values ('hadith_collection', 'Fixture source', 'cleared', 'https://example.test') returning id");
  const [ver] = await db.admin<{ id: string }>(
    "insert into public.source_versions (source_id, version, checksum_sha256, retrieved_at, retrieved_from, is_current) values ($1, 'test', repeat('b', 64), now(), 'https://example.test', true) returning id",
    [src!.id],
  );
  versionId = ver!.id;

  const one = async (key: string, sql: string, params: unknown[] = []) => {
    const [r] = await raw(sql, params);
    ids[key] = r!.id;
  };
  await one("creationPub", "insert into public.creation_profiles (category_id, slug, name_en, name_ar, status) values ('angels', 'fx-pub', $1, 'ملائكة', 'published') returning id", [`${FX} Malak profile`]);
  await one("creationDraft", "insert into public.creation_profiles (category_id, slug, name_en, name_ar, status) values ('angels', 'fx-draft', $1, 'مسودة', 'draft') returning id", [`${FX} draftsecret profile`]);
  await one("guidancePub", "insert into public.guidance_topics (slug, title_en, title_ar, summary_en, status) values ('fx-sabr', $1, 'صبر', 'Placeholder summary', 'published') returning id", [`${FX} Sabr topic`]);
  await one("guidanceDraft", "insert into public.guidance_topics (slug, title_en, title_ar, status) values ('fx-g-draft', $1, 'مسودة', 'draft') returning id", [`${FX} draftsecret topic`]);
  await one("foodPub", "insert into public.historical_foods (slug, name_en, name_ar, summary, status, evidence_category, confidence, publication, primary_citation) values ('fx-dates', $1, 'تمر', 'Placeholder', 'published', 'C', 'moderate', 'Fixture publication', 'Fixture citation') returning id", [`${FX} Dates food`]);
  await one("foodDraft", "insert into public.historical_foods (slug, name_en, summary, status, evidence_category) values ('fx-food-draft', $1, 'Placeholder', 'draft', 'C') returning id", [`${FX} draftsecret food`]);
  await one("storyPub", "insert into public.stories (slug, title, title_ar, summary, status) values ('fx-yusuf', $1, 'يوسف', 'Placeholder story', 'published') returning id", [`${FX} Yusuf story`]);
  await one("storyDraft", "insert into public.stories (slug, title, summary, status) values ('fx-story-draft', $1, 'Placeholder', 'draft') returning id", [`${FX} draftsecret story`]);
  await one("qPublic", "insert into public.mufti_questions (asker_id, title, body, visibility, status) values ($1, $2, 'A placeholder question body for tests.', 'public', 'accepted') returning id", [asker, `${FX} public question about fasting`]);
  await one("qPrivate", "insert into public.mufti_questions (asker_id, title, body, visibility, status) values ($1, $2, 'A placeholder private body for tests.', 'private', 'accepted') returning id", [asker, `${FX} privatesecret question`]);
  await one("qPending", "insert into public.mufti_questions (asker_id, title, body, visibility, status) values ($1, $2, 'A placeholder unmoderated body here.', 'public', 'submitted') returning id", [asker, `${FX} unmoderated question`]);
  await one("dream", "insert into public.dream_requests (user_id, dream_text) values ($1, $2) returning id", [asker, `${FX} dreamsecret placeholder text for a test`]);
  await one("hadithPub", "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('bukhari', 'fixture', '9001', $1, $2, 'published') returning id", [versionId, `${FX} hadithtextsecret`]);
  await one("hadithDraft", "insert into public.hadith_entries (collection_id, numbering_system, canonical_number, source_version_id, arabic, status) values ('bukhari', 'fixture', '9002', $1, 'placeholder', 'draft') returning id", [versionId]);
  await raw("update public.riwayat set status = 'published' where id = 'warsh'");
  await db.admin("select public.search_reindex()");
}, 180_000);

describe("unified search: only public content", () => {
  test("published rows of every module are found, with their public URLs", async () => {
    const urls = (await search(null, FX)).map((r) => r.url);
    expect(urls).toEqual(expect.arrayContaining(["/creation/fx-pub", "/guidance/fx-sabr", "/life-through-ages/food", "/stories/fx-yusuf", `/community/questions/${ids.qPublic}`]));
    expect((await search(null, "Sahih al-Bukhari 9001")).map((r) => r.url)).toContain("/hadith/bukhari/9001");
    expect((await search(null, "Warsh")).map((r) => r.entity_id)).toContain("warsh");
  });
  test("drafts, private and unmoderated questions and dream requests never appear, for anyone", async () => {
    for (const user of [null, asker, admin]) {
      const rows = await search(user, FX);
      const text = JSON.stringify(rows);
      expect(text).not.toMatch(/draftsecret|privatesecret|unmoderated|dreamsecret|hadithtextsecret/);
      expect(rows.map((r) => r.entity_id)).not.toEqual(expect.arrayContaining([ids.creationDraft]));
      for (const k of ["creationDraft", "guidanceDraft", "foodDraft", "storyDraft", "qPrivate", "qPending", "dream", "hadithDraft"])
        expect(rows.some((r) => r.entity_id === ids[k]), k).toBe(false);
    }
    expect(await search(asker, "privatesecret")).toEqual([]);
    expect(await search(asker, "dreamsecret")).toEqual([]);
    const indexed = await db.admin<{ n: number }>("select count(*)::int n from public.search_index where entity_id = any ($1)", [[ids.qPrivate, ids.qPending, ids.dream, ids.creationDraft, ids.hadithDraft]]);
    expect(indexed[0]!.n).toBe(0);
  });
  test("a hadith is indexed as a reference only, never with its text", async () => {
    const [row] = await db.admin<{ title: string; body: string }>("select title, body from public.search_index where entity_id = $1", [ids.hadithPub]);
    expect(row!.title).toMatch(/9001/);
    expect(`${row!.title} ${row!.body}`).not.toMatch(/hadithtextsecret/);
  });
  test("unpublishing or making a question private removes it at once (triggers)", async () => {
    await db.admin("update public.creation_profiles set status = 'draft' where id = $1", [ids.creationPub]);
    await db.admin("update public.mufti_questions set visibility = 'private' where id = $1", [ids.qPublic]);
    const ids2 = (await search(null, FX)).map((r) => r.entity_id);
    expect(ids2).not.toContain(ids.creationPub);
    expect(ids2).not.toContain(ids.qPublic);
    await db.admin("update public.mufti_questions set visibility = 'public' where id = $1", [ids.qPublic]);
    expect((await search(null, FX)).map((r) => r.entity_id)).toContain(ids.qPublic);
  });
  test("a stale or foreign index row stays invisible (RLS and the explicit live filter)", async () => {
    await db.admin(
      "insert into public.search_index (entity_type, entity_id, url, title, body, facet) values ('creation', $1, '/creation/fx-draft', 'Fixture stale draftsecret', '', 'creation'), ('dream_request', $2, '/dreams/x', 'Fixture stale dreamsecret', '', 'pages')",
      [ids.creationDraft, ids.dream],
    );
    expect(await db.as(null, "select * from public.search_index where title like 'Fixture stale%'")).toEqual([]);
    expect(await db.as(asker, "select * from public.search_index where title like 'Fixture stale%'")).toEqual([]);
    expect(JSON.stringify(await search(null, "stale"))).not.toMatch(/draftsecret|dreamsecret/);
  });
  test("visitors cannot write the index or read its configuration", async () => {
    await expect(db.as(null, "insert into public.search_index (entity_type, entity_id, url, title, facet) values ('story', 'x', '/x', 'x', 'stories')")).rejects.toThrow(/permission denied/);
    await expect(db.as(asker, "delete from public.search_index")).rejects.toThrow(/permission denied/);
    await expect(db.as(null, "select * from public.search_sources")).rejects.toThrow(/permission denied/);
    await expect(db.as(asker, "select public.search_reindex()")).rejects.toThrow(/permission denied/);
  });
});

describe("unified search: matching in the database", () => {
  test("aliases are searched as alternative spellings (Joseph → Yusuf)", async () => {
    expect((await search(null, "Joseph")).map((r) => r.url)).not.toContain("/stories/fx-yusuf");
    expect((await search(null, "Joseph", ["yusuf"])).map((r) => r.url)).toContain("/stories/fx-yusuf");
  });
  test("Arabic and Urdu spellings without vowel marks match", async () => {
    expect((await search(null, "يُوسُف")).map((r) => r.url)).toContain("/stories/fx-yusuf");
    expect((await search(null, "یوسف")).map((r) => r.url)).toContain("/stories/fx-yusuf");
  });
  test("a typo in a title still matches (trigram)", async () => {
    expect((await search(null, "Fixtur Sabr topik")).map((r) => r.url)).toContain("/guidance/fx-sabr");
  });
  test("facet filter and paging", async () => {
    const rows = await db.as<Row & { facet: string; total: number }>(null, "select * from public.search($1, array['guidance'], 20, 0)", [FX]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.facet === "guidance")).toBe(true);
    const all = await db.as<{ total: number }>(null, "select * from public.search($1, null, 1, 0)", [FX]);
    expect(all).toHaveLength(1);
    expect(Number(all[0]!.total)).toBeGreaterThan(3);
  });
  test("public.normalize_arabic mirrors normalizeArabic in the app", async () => {
    for (const s of ["إِبْرَاهِيمُ", "ٱلرَّحْمَٰنِ", "مَدْرَسَةٌ", "مُوسَىٰ", "یوسف", "موسیٰ", "مکہ", "کتاب", "١٢:٤", "۲:۲۵۵", "سُـــورة"]) {
      const [r] = await db.admin<{ n: string }>("select public.normalize_arabic($1) n", [s]);
      expect(r!.n, s).toBe(normalizeArabic(s));
    }
  });
});
