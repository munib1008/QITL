/**
 * Source adapters, tested against FIXTURES only (tests/fixtures/interpretation: synthetic placeholders in each
 * provider's shape, never real Quran, translation or hadith text). No network, no database: an in-memory sink.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { ImportRefused, parseSurahList, sha256, type SourceRecord, type SourceVersionRecord } from "@/lib/importers/common";
import { assertEditionImportable, type EditionGateRow } from "@/lib/importers/editions";
import { importHadith, mapGrade, parseSunnahPage, sunnahClient, type HadithSink } from "@/lib/importers/hadith";
import { importQuran, parseKfgqpcHafs, parseTanzil, type QuranSink, type SurahMeta } from "@/lib/importers/quran";
import { importTranslation, parseQuranEncSura, parseQuranFoundationChapter, quranEncClient, quranFoundationClient, type FetchLike, type TranslationSink } from "@/lib/importers/translations";

const fx = (f: string) => readFileSync(join(__dirname, "..", "fixtures", "interpretation", f));
const FIXTURE_META: SurahMeta[] = [
  { number: 1, nameAr: "FIXTURE-NAME-1", nameTransliterated: "Fixture-One", nameEn: null, ayahCount: 2 },
  { number: 2, nameAr: "FIXTURE-NAME-2", nameTransliterated: "Fixture-Two", nameEn: null, ayahCount: 2 },
];
const NOW = new Date("2026-10-31T12:00:00Z");

/** In-memory stand-in for the Supabase sink: records every write so tests can assert nothing was written. */
class MemorySink implements QuranSink, TranslationSink, HadithSink {
  sources: Array<SourceRecord & { id: string; rights_status: "unknown" | "cleared" }> = [];
  versions: Array<SourceVersionRecord & { id: string }> = [];
  verses = new Map<string, string>();
  surahs = new Set<number>();
  translations: Array<Record<string, unknown>> = [];
  editions: EditionGateRow[] = [];
  hadith: Array<{ id: string; collection_id: string; numbering_system: string; canonical_number: string; arabic: string; status: string; source_url: string }> = [];
  hadithTranslations: Array<Record<string, unknown>> = [];
  gradings: Array<{ hadith_id: string; grader: string; grade: string; grade_label: string }> = [];
  writes = 0;
  private n = 0;
  private id = () => `id-${++this.n}`;

  async findSource(type: string, work: string, edition: string | null) {
    return this.sources.find((s) => s.type === type && s.work === work && s.edition === edition) ?? null;
  }
  async createSource(rec: SourceRecord) {
    this.writes++;
    const row = { ...rec, id: this.id(), rights_status: "unknown" as const };
    this.sources.push(row);
    return { id: row.id };
  }
  async findVersion(sourceId: string, version: string) {
    return this.versions.find((v) => v.source_id === sourceId && v.version === version) ?? null;
  }
  async hasCurrentVersion(sourceId: string) {
    return this.versions.some((v) => v.source_id === sourceId && v.is_current);
  }
  async createVersion(rec: SourceVersionRecord) {
    this.writes++;
    const row = { ...rec, id: this.id() };
    this.versions.push(row);
    return { id: row.id };
  }
  async existingVerses() {
    return new Map(this.verses);
  }
  async existingVerseKeys() {
    return new Set(this.verses.keys());
  }
  async existingSurahs() {
    return new Set(this.surahs);
  }
  async insertSurahs(rows: Array<{ id: number }>) {
    this.writes++;
    rows.forEach((r) => this.surahs.add(r.id));
  }
  async insertVerses(rows: Array<{ surah_id: number; ayah_no: number; text_ar: string }>) {
    this.writes++;
    rows.forEach((r) => this.verses.set(`${r.surah_id}:${r.ayah_no}`, r.text_ar));
  }
  async findEdition(origin: string, originRef: string) {
    return this.editions.find((e) => e.origin === origin && e.origin_ref === originRef) ?? null;
  }
  async existingTranslations(sourceId: string) {
    return new Map(this.translations.filter((t) => t.source_id === sourceId).map((t) => [`${t.surah_id}:${t.ayah_no}`, String(t.text)]));
  }
  async insertTranslations(rows: Array<Record<string, unknown>>) {
    this.writes++;
    this.translations.push(...rows);
  }
  async existingHadith(collection: string, numbering: string) {
    return new Map(this.hadith.filter((h) => h.collection_id === collection && h.numbering_system === numbering).map((h) => [h.canonical_number, { id: h.id, arabic: h.arabic }]));
  }
  async insertHadith(row: { collection_id: string; numbering_system: string; canonical_number: string; arabic: string; status: string; source_url: string }) {
    this.writes++;
    const r = { ...row, id: this.id() };
    this.hadith.push(r);
    return { id: r.id };
  }
  async insertTranslation(row: Record<string, unknown>) {
    this.writes++;
    this.hadithTranslations.push(row);
  }
  async insertGrading(row: { hadith_id: string; grader: string; grade: string; grade_label: string }) {
    this.writes++;
    this.gradings.push(row);
  }
}

const quranInput = (over: Partial<Parameters<typeof importQuran>[1]> = {}): Parameters<typeof importQuran>[1] => ({
  format: "tanzil-uthmani",
  raw: fx("tanzil-fixture.txt"),
  metadata: FIXTURE_META,
  retrievedFrom: "https://tanzil.net/fixture",
  retrievedAt: NOW,
  acceptTerms: true,
  expectedTotal: 4,
  ...over,
});

describe("Quran text adapter (fixtures)", () => {
  test("Tanzil text and XML formats parse to the same verses, verbatim (pipes and entities kept)", () => {
    const txt = parseTanzil(fx("tanzil-fixture.txt").toString("utf8"));
    expect(txt.version).toBe("0.0-fixture");
    expect(txt.verses).toHaveLength(4);
    expect(txt.verses[3]).toEqual({ surah: 2, ayah: 2, text: "FIXTURE-AR-2-2 | with a pipe" });
    const xml = parseTanzil(fx("tanzil-fixture.xml").toString("utf8"));
    expect(xml.version).toBe("0.0-fixture");
    expect(xml.verses.map((v) => `${v.surah}:${v.ayah}`)).toEqual(["1:1", "1:2", "2:1", "2:2"]);
    expect(xml.verses[1]!.text).toBe('FIXTURE-AR-1-2 & "quoted"');
  });

  test("King Fahd Complex Hafs JSON keeps aya_text exactly, end-of-ayah marker included, and derives surah metadata", () => {
    const k = parseKfgqpcHafs(fx("kfgqpc-fixture.json").toString("utf8"));
    expect(k.verses[0]).toEqual({ surah: 1, ayah: 1, text: "FIXTURE-AR-1-1 [1]" });
    expect(k.surahs).toEqual([
      { number: 1, nameAr: "FIXTURE-NAME-1", nameTransliterated: "Fixture-One", nameEn: null, ayahCount: 2 },
      { number: 2, nameAr: "FIXTURE-NAME-2", nameTransliterated: "Fixture-Two", nameEn: null, ayahCount: 2 },
    ]);
  });

  test("refuses without --accept-terms, before anything is written", async () => {
    const sink = new MemorySink();
    await expect(importQuran(sink, quranInput({ acceptTerms: false }))).rejects.toMatchObject({ code: "terms_not_accepted" });
    expect(sink.writes).toBe(0);
  });

  test("records source, version, checksum, retrieved date and URL, licence; inserts verses", async () => {
    const sink = new MemorySink();
    const r = await importQuran(sink, quranInput());
    expect(r.inserted).toBe(4);
    expect(sink.sources[0]).toMatchObject({ type: "quran_text", work: "Tanzil Quran Text (Uthmani)", edition: "Uthmani", license_text: expect.stringMatching(/verbatim/i), rights_status: "unknown" });
    expect(sink.versions[0]).toMatchObject({ version: "0.0-fixture", checksum_sha256: sha256(fx("tanzil-fixture.txt")), retrieved_at: NOW.toISOString(), retrieved_from: "https://tanzil.net/fixture", is_current: true });
    expect(sink.verses.get("2:2")).toBe("FIXTURE-AR-2-2 | with a pipe");
  });

  test("King Fahd Complex format needs an explicit version and is recorded as its own source", async () => {
    const sink = new MemorySink();
    await expect(importQuran(sink, quranInput({ format: "kfgqpc-hafs", raw: fx("kfgqpc-fixture.json"), metadata: undefined }))).rejects.toMatchObject({ code: "no_version" });
    const r = await importQuran(sink, quranInput({ format: "kfgqpc-hafs", raw: fx("kfgqpc-fixture.json"), metadata: undefined, version: "fixture-v1", retrievedFrom: "https://qurancomplex.gov.sa/fixture" }));
    expect(r.inserted).toBe(4);
    expect(sink.sources[0]).toMatchObject({ work: "Madinah Mushaf (Hafs 'an 'Asim)", publisher: "King Fahd Glorious Qur'an Printing Complex", edition: "Hafs 'an 'Asim" });
    expect(sink.surahs).toEqual(new Set([1, 2]));
  });

  test("re-running the same file is a no-op; a changed verse is refused whole and nothing is written", async () => {
    const sink = new MemorySink();
    await importQuran(sink, quranInput());
    const again = await importQuran(sink, quranInput());
    expect(again).toMatchObject({ inserted: 0, unchanged: 4 });
    expect(sink.versions).toHaveLength(1);
    const writes = sink.writes;
    const changed = Buffer.from(fx("tanzil-fixture.txt").toString("utf8").replace("FIXTURE-AR-1-2", "FIXTURE-AR-1-2-EDITED").replace("0.0-fixture", "0.1-fixture"));
    await expect(importQuran(sink, quranInput({ raw: changed }))).rejects.toMatchObject({ code: "immutable" });
    expect(sink.writes).toBe(writes);
    expect(sink.verses.get("1:2")).toBe("FIXTURE-AR-1-2");
  });

  test("the same version label with different bytes is refused", async () => {
    const sink = new MemorySink();
    await importQuran(sink, quranInput());
    const extra = Buffer.from(fx("tanzil-fixture.txt").toString("utf8") + "# trailing comment\n");
    await expect(importQuran(sink, quranInput({ raw: extra }))).rejects.toMatchObject({ code: "version_checksum_mismatch" });
  });

  test("structural checks: wrong count, duplicates and non-https origins are refused", async () => {
    await expect(importQuran(new MemorySink(), quranInput({ expectedTotal: 6236 }))).rejects.toMatchObject({ code: "bad_count" });
    const dup = Buffer.from("# Version: x\n1|1|A\n1|1|B\n2|1|C\n2|2|D\n");
    await expect(importQuran(new MemorySink(), quranInput({ raw: dup }))).rejects.toMatchObject({ code: "duplicate" });
    await expect(importQuran(new MemorySink(), quranInput({ retrievedFrom: "http://insecure.example/x" }))).rejects.toMatchObject({ code: "bad_url" });
  });

  test("surah list parser", () => {
    expect(parseSurahList("1,12,18-20")).toEqual([1, 12, 18, 19, 20]);
    expect(() => parseSurahList("0-3")).toThrow(ImportRefused);
    expect(() => parseSurahList("x")).toThrow(ImportRefused);
  });
});

const cleared = { id: "src-1", type: "quran_translation", rights_status: "cleared" as const, work: "FIXTURE translation work" };
const edition = (over: Partial<EditionGateRow> = {}): EditionGateRow => ({
  id: "ed-1",
  kind: "quran_translation",
  language: "en",
  title: "FIXTURE Edition",
  edition: "1st",
  origin: "quranenc",
  origin_ref: "fixture_key",
  registry_status: "verified",
  translator: "Fixture Translator",
  source: cleared,
  ...over,
});
const fetchFrom = (bodies: Record<string, string>) =>
  vi.fn<FetchLike>(async (url) => {
    const key = Object.keys(bodies).find((k) => url.includes(k));
    return { ok: Boolean(key), status: key ? 200 : 404, text: async () => (key ? bodies[key]! : "") };
  });

describe("translation edition gate", () => {
  test.each([
    [null, "edition_not_registered"],
    [edition({ registry_status: "candidate" }), "edition_not_verified"],
    [edition({ source: { ...cleared, rights_status: "requested" } }), "licence_not_cleared"],
    [edition({ source: null }), "no_source"],
    [edition({ translator: null }), "no_translator"],
    [edition({ origin: "quran_foundation" }), "wrong_origin"],
    [edition({ kind: "tafsir" }), "wrong_kind"],
  ])("refuses %#", (e, code) => {
    expect(() => assertEditionImportable(e, { origin: "quranenc", kind: "quran_translation" })).toThrow(expect.objectContaining({ code }));
  });
  test("a verified edition with a cleared (or public-domain) source passes", () => {
    expect(assertEditionImportable(edition(), { origin: "quranenc", kind: "quran_translation", originRef: "fixture_key" }).translator).toBe("Fixture Translator");
    expect(() => assertEditionImportable(edition({ source: { ...cleared, rights_status: "public_domain" } }), { origin: "quranenc", kind: "quran_translation" })).not.toThrow();
  });
});

describe("QuranEnc and Quran Foundation adapters (fixtures)", () => {
  const seeded = () => {
    const s = new MemorySink();
    s.verses.set("1:1", "FIXTURE-AR-1-1");
    s.verses.set("1:2", "FIXTURE-AR-1-2");
    s.sources.push({ ...cleared, type: "quran_translation", edition: null, author: null, publisher: null, source_url: "https://quranenc.com/", language: "en", license_text: "FIXTURE", license_url: null, attribution: "FIXTURE", rights_status: "cleared" });
    return s;
  };
  const input = { provider: "quranenc" as const, ref: "fixture_key", version: "fixture-1", surahs: [1], acceptTerms: true, retrievedAt: NOW };

  test("parsers read the provider shapes and never take Arabic from a translation API", () => {
    expect(parseQuranEncSura(fx("quranenc-fixture-sura1.json").toString("utf8"), 1)).toEqual([
      { surah: 1, ayah: 1, text: "FIXTURE-EN-1-1" },
      { surah: 1, ayah: 2, text: "FIXTURE-EN-1-2" },
    ]);
    expect(parseQuranFoundationChapter(fx("qf-fixture-chapter1.json").toString("utf8"), 1)[1]).toEqual({ surah: 1, ayah: 2, text: "FIXTURE-QF-1-2<sup foot_note=1>1</sup>" });
    expect(() => parseQuranEncSura(fx("quranenc-fixture-sura1.json").toString("utf8"), 2)).toThrow(ImportRefused);
  });

  test("API keys come from the environment; missing keys refuse before any request", () => {
    const f = fetchFrom({});
    expect(() => quranEncClient("fixture_key", f, {})).toThrow(expect.objectContaining({ code: "missing_env" }));
    expect(() => quranFoundationClient("131", f, { QF_CLIENT_ID: "x" })).toThrow(expect.objectContaining({ code: "missing_env" }));
    expect(f).not.toHaveBeenCalled();
  });

  test("an unverified or uncleared edition is refused before anything is fetched", async () => {
    for (const e of [edition({ registry_status: "candidate" }), edition({ source: { ...cleared, rights_status: "unknown" } })]) {
      const sink = seeded();
      sink.editions.push(e);
      const f = fetchFrom({ "/sura/fixture_key/1": fx("quranenc-fixture-sura1.json").toString("utf8") });
      await expect(importTranslation(sink, quranEncClient("fixture_key", f, { QURANENC_API_KEY: "k" }), input)).rejects.toBeInstanceOf(ImportRefused);
      expect(f).not.toHaveBeenCalled();
      expect(sink.writes).toBe(0);
    }
  });

  test("imports a verified, cleared QuranEnc edition with attribution, edition id and a pinned version", async () => {
    const sink = seeded();
    sink.editions.push(edition());
    const body = fx("quranenc-fixture-sura1.json").toString("utf8");
    const f = fetchFrom({ "/sura/fixture_key/1": body });
    const r = await importTranslation(sink, quranEncClient("fixture_key", f, { QURANENC_API_KEY: "k" }), input);
    expect(r).toMatchObject({ inserted: 2, checksum: sha256(body) });
    expect(f.mock.calls[0]![1]!.headers!.Authorization).toBe("Bearer k");
    expect(sink.translations[0]).toMatchObject({ surah_id: 1, ayah_no: 1, text: "FIXTURE-EN-1-1", translator: "Fixture Translator", edition: "FIXTURE Edition", edition_id: "ed-1", source_id: "src-1" });
    expect(sink.versions[0]).toMatchObject({ source_id: "src-1", version: "fixture-1", retrieved_from: "https://quranenc.com/api/v1/translation/sura/fixture_key/1" });
    // A second, changed payload never overwrites stored text.
    const changed = body.replace("FIXTURE-EN-1-1", "FIXTURE-EN-1-1-CHANGED");
    await expect(importTranslation(sink, quranEncClient("fixture_key", fetchFrom({ "/sura/fixture_key/1": changed }), { QURANENC_API_KEY: "k" }), { ...input, version: "fixture-2" })).rejects.toMatchObject({ code: "immutable" });
  });

  test("refuses when the Quran text is not imported yet", async () => {
    const sink = new MemorySink();
    sink.editions.push(edition());
    const f = fetchFrom({ "/sura/fixture_key/1": fx("quranenc-fixture-sura1.json").toString("utf8") });
    await expect(importTranslation(sink, quranEncClient("fixture_key", f, { QURANENC_API_KEY: "k" }), input)).rejects.toMatchObject({ code: "verses_missing" });
    expect(sink.writes).toBe(0);
  });

  test("Quran Foundation: client-credentials token first, then the content API with its headers", async () => {
    const sink = seeded();
    sink.editions.push(edition({ origin: "quran_foundation", origin_ref: "131" }));
    const f = fetchFrom({ "oauth2/token": JSON.stringify({ access_token: "tok" }), "translations/131?chapter_number=1": fx("qf-fixture-chapter1.json").toString("utf8") });
    const r = await importTranslation(sink, quranFoundationClient("131", f, { QF_CLIENT_ID: "cid", QF_CLIENT_SECRET: "sec" }), { ...input, provider: "quran_foundation", ref: "131" });
    expect(r.inserted).toBe(2);
    expect(f.mock.calls[0]![1]!.method).toBe("POST");
    expect(f.mock.calls[1]![1]!.headers).toMatchObject({ "x-auth-token": "tok", "x-client-id": "cid" });
  });
});

describe("sunnah.com hadith adapter (fixtures)", () => {
  const seeded = () => {
    const s = new MemorySink();
    s.editions.push(edition({ kind: "hadith_translation", origin: "sunnah_com", origin_ref: "tirmidhi", source: { id: "src-h", type: "hadith_translation", rights_status: "cleared", work: "FIXTURE hadith edition" } }));
    return s;
  };
  const input = { collection: "tirmidhi", version: "fixture-1", maxPages: 3, acceptTerms: true, retrievedAt: NOW };

  test.each([
    ["Sahih", "sahih"],
    ["Sahih (Al-Albani)", "sahih"],
    ["Hasan Sahih", "hasan sahih"],
    ["Hasan", "hasan"],
    ["Da'if", "daif"],
    ["Da`if Jiddan", "daif jiddan"],
    ["Maudu'", "mawdu"],
    ["Munkar", "munkar"],
    ["Sahih li ghairihi", "sahih li-ghayrihi"],
    ["Isnaad unclear", "other"],
  ])("grade %s → %s", (label, grade) => expect(mapGrade(label)).toBe(grade));

  test("page parser keeps only gradings with a named grader, one per grader", () => {
    const p = parseSunnahPage(fx("sunnah-fixture-page1.json").toString("utf8"));
    expect(p.next).toBeNull();
    expect(p.items[1]!.grades).toEqual([
      { grader: "Fixture Grader A", label: "Da'if" },
      { grader: "Fixture Grader B", label: "Hasan" },
    ]);
  });

  test("only the four catalogued collections; the key comes from SUNNAH_API_KEY", async () => {
    expect(() => sunnahClient(fetchFrom({}), {})).toThrow(expect.objectContaining({ code: "missing_env" }));
    const f = fetchFrom({});
    await expect(importHadith(seeded(), sunnahClient(f, { SUNNAH_API_KEY: "k" }), { ...input, collection: "abudawud" })).rejects.toMatchObject({ code: "collection_not_catalogued" });
    expect(f).not.toHaveBeenCalled();
  });

  test("an uncleared sunnah.com edition is refused before fetching", async () => {
    const sink = seeded();
    sink.editions[0] = { ...sink.editions[0]!, source: { ...sink.editions[0]!.source!, rights_status: "requested" } };
    const f = fetchFrom({});
    await expect(importHadith(sink, sunnahClient(f, { SUNNAH_API_KEY: "k" }), input)).rejects.toMatchObject({ code: "licence_not_cleared" });
    expect(f).not.toHaveBeenCalled();
  });

  test("imports drafts with every named grading as given; skips malformed numbers; never overwrites", async () => {
    const sink = seeded();
    const body = fx("sunnah-fixture-page1.json").toString("utf8");
    const f = fetchFrom({ "/collections/tirmidhi/hadiths": body });
    const r = await importHadith(sink, sunnahClient(f, { SUNNAH_API_KEY: "k" }), input);
    expect(f.mock.calls[0]![1]!.headers!["X-API-Key"]).toBe("k");
    expect(r).toMatchObject({ inserted: 2, skipped: ["103 bad"], gradings: 3 });
    expect(sink.hadith.every((h) => h.status === "draft" && h.numbering_system === "sunnah.com")).toBe(true);
    expect(sink.hadith[0]).toMatchObject({ canonical_number: "101", arabic: "FIXTURE-AR-101", source_url: "https://sunnah.com/tirmidhi:101" });
    expect(sink.hadithTranslations[0]).toMatchObject({ translator: "Fixture Translator", text: "FIXTURE-EN-101" });
    expect(sink.gradings.map((g) => [g.grader, g.grade, g.grade_label])).toEqual([
      ["Fixture Grader A", "sahih", "Sahih (Fixture Grader A)"],
      ["Fixture Grader A", "daif", "Da'if"],
      ["Fixture Grader B", "hasan", "Hasan"],
    ]);
    const again = await importHadith(sink, sunnahClient(f, { SUNNAH_API_KEY: "k" }), input);
    expect(again.inserted).toBe(0);
    const changed = body.replace("FIXTURE-AR-101", "FIXTURE-AR-101-CHANGED");
    await expect(importHadith(sink, sunnahClient(fetchFrom({ "/collections/tirmidhi/hadiths": changed }), { SUNNAH_API_KEY: "k" }), { ...input, version: "fixture-2" })).rejects.toMatchObject({ code: "immutable" });
  });
});
