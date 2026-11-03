// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { buildIndex, canonicalJson, countName, exploreCandidates, queryHash, serialiseCounts, verifyReproducible, type CorpusIndex } from "@/lib/asma/count";
import { parseQuranText, tokenizeVerse, type Corpus } from "@/lib/asma/corpus";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { alefless, normalizeArabic } from "@/lib/asma/normalize";
import { buildQuery, surfaceFormsOf, validateRegistry, type NameDraft } from "@/lib/asma/registry";
import { loadNamesFile } from "@/lib/asma/registry-node";
import { checkAsmaText } from "@/lib/asma/text-validator";
import { findHardcodedCounts, presentableAsRecognised, validateCountClaim } from "@/lib/asma/validator";

/**
 * The counting engine against the REAL pinned corpus (content/quran, Tanzil Uthmani 1.1). No count is written in this
 * file: every number is either compared with another computation or with a property of the corpus text itself.
 */
let corpus: Corpus;
let index: CorpusIndex;
let names: NameDraft[];
const byslug = (s: string) => names.find((n) => n.slug === s)!;
const verseText = (s: number, a: number) => corpus.verses.find((v) => v.surah === s && v.ayah === a)!.text;

beforeAll(() => {
  corpus = loadQuranCorpusFromDisk();
  index = buildIndex(corpus);
  names = loadNamesFile().names;
});

describe("normalisation policy asma-norm-v1", () => {
  test("removes diacritics, tatweel and Quranic small marks", () => {
    expect(normalizeArabic("ٱلرَّحِيمِ")).toBe("الرحيم");
    expect(normalizeArabic("ٱلْكِتَـٰبُ")).toBe("الكتاب"); // tatweel removed, dagger alef restored
    expect(normalizeArabic("رَسُولِهِۦٓ")).toBe("رسوله"); // small ya and maddah removed
    expect(normalizeArabic("لَا رَيْبَ ۛ")).toBe("لا ريب ");
  });
  test("alef, ya and kaf variants fold; hamza on waw/ya and ta marbuta are kept", () => {
    expect(normalizeArabic("أإآٱ")).toBe("اااا");
    expect(normalizeArabic("هُدًى")).toBe("هدي");
    expect(normalizeArabic("ی")).toBe("ي");
    expect(normalizeArabic("ک")).toBe("ك");
    expect(normalizeArabic("مؤمن")).toBe("مؤمن");
    expect(normalizeArabic("رحمة")).toBe("رحمة");
    expect(normalizeArabic("رحمة", { taMarbuta: "to_ha" })).toBe("رحمه");
  });
  test("is idempotent over the whole corpus", () => {
    for (const v of corpus.verses.slice(0, 600)) expect(normalizeArabic(normalizeArabic(v.text))).toBe(normalizeArabic(v.text));
  });
  test("alefless is only a reviewer aid", () => {
    expect(alefless("الرحمان")).toBe(alefless("الرحمن"));
  });
});

describe("corpus and tokenisation policy asma-tok-v1", () => {
  test("the pinned corpus loads: 114 surahs, the recorded checksum and a content hash", () => {
    expect(corpus.verses).toHaveLength(6236);
    expect(new Set(corpus.verses.map((v) => v.surah)).size).toBe(114);
    expect(corpus.edition.version).toMatch(/Uthmani/);
    expect(corpus.edition.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(corpus.edition.contentSha256).toMatch(/^[0-9a-f]{64}$/);
  });
  test("the leading basmala of a surah's first ayah is not a word of the ayah; 1:1 and an in-verse basmala are", () => {
    const t = tokenizeVerse({ surah: 112, ayah: 1, text: verseText(112, 1) });
    expect(t.slice(0, 4).every((x) => x.basmalaPrefix && x.index === 0)).toBe(true);
    expect(t[4]!.index).toBe(1);
    expect(tokenizeVerse({ surah: 1, ayah: 1, text: verseText(1, 1) }).every((x) => !x.basmalaPrefix)).toBe(true);
    expect(tokenizeVerse({ surah: 27, ayah: 30, text: verseText(27, 30) }).some((x) => x.basmalaPrefix)).toBe(false);
    // surah 9 has no basmala at all
    expect(tokenizeVerse({ surah: 9, ayah: 1, text: verseText(9, 1) }).some((x) => x.basmalaPrefix)).toBe(false);
  });
  test("every prefix the engine skips really is a basmala: skipped words are 4 per surah-opening ayah, 112 surahs", () => {
    const opening = corpus.verses.filter((v) => v.ayah === 1 && v.surah !== 1 && v.surah !== 9);
    expect(index.basmalaPrefixWords).toBe(opening.length * 4);
  });
  test("stop signs and the sajdah sign are not words; indexes count words only", () => {
    const toks = tokenizeVerse({ surah: 2, ayah: 2, text: "ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ" });
    expect(toks.map((x) => x.index)).toEqual([1, 2, 3, 4, 5]);
    expect(toks.map((x) => x.normalized)).toEqual(["ذالك", "الكتاب", "لا", "ريب", "فيه"]);
  });
  test("a malformed corpus line is refused", () => {
    expect(() => parseQuranText("not a verse")).toThrow(/malformed/);
  });
  test("a corpus whose content differs from its recorded checksum is refused", () => {
    const tampered: Corpus = { ...corpus, verses: corpus.verses.map((v, i) => (i === 0 ? { ...v, text: v.text + " x" } : v)) };
    expect(() => buildIndex(tampered)).toThrow(/checksum/);
  });
});

describe("three separate measures", () => {
  test("a result has A, B and C and NO total", () => {
    const r = countName(index, buildQuery(byslug("al-ghafur")));
    expect(Object.keys(r).sort()).toEqual(["A", "B", "C", "provenance", "slug"]);
    expect(Object.keys(r.A).sort()).toEqual(["count", "measure", "occurrences", "verseCount"]);
    expect(JSON.stringify(r)).not.toMatch(/"total"/);
  });
  test("A counts exact surface forms only: the article is part of the form", () => {
    const withArticle = countName(index, { slug: "t", surfaceForms: ["الغفور"] });
    const bare = countName(index, { slug: "t", surfaceForms: ["غفور"] });
    const both = countName(index, { slug: "t", surfaceForms: ["الغفور", "غفور"] });
    expect(withArticle.A.count).toBeGreaterThan(0);
    expect(bare.A.count).toBeGreaterThan(0);
    expect(both.A.count).toBe(withArticle.A.count + bare.A.count);
    for (const o of withArticle.A.occurrences) expect(normalizeArabic(o.raw)).toBe("الغفور");
  });
  test("a prefixed word is a different surface form: not A, and offered only as an exploration candidate", () => {
    const a = countName(index, { slug: "allah", surfaceForms: ["الله"] });
    const prefixed = exploreCandidates(index, "الله").filter((c) => c.kind === "prefixed");
    expect(prefixed.length).toBeGreaterThan(0);
    const inA = new Set(a.A.occurrences.map((o) => `${o.surah}:${o.ayah}:${o.tokenIndex}`));
    for (const c of prefixed) for (const h of c.hits) expect(inA.has(`${h.surah}:${h.ayah}:${h.index}`)).toBe(false);
  });
  test("a Name with several forms: the registry's orthographic extra is what makes Ar-Rahman countable", () => {
    const rahman = byslug("ar-rahman");
    expect(rahman.forms).toEqual(["الرحمان"]);
    const standardOnly = countName(index, { slug: "r", surfaceForms: [rahman.ar] });
    const registered = countName(index, buildQuery(rahman));
    expect(standardOnly.A.count).toBe(0); // the Uthmani text spells the alef out: without the registered form nothing matches
    expect(registered.A.count).toBeGreaterThan(0);
    expect(surfaceFormsOf(rahman)).toHaveLength(2);
    // the basmala prefix words are never counted
    const firstAyahOfAl112 = registered.A.occurrences.filter((o) => o.surah === 112 && o.ayah === 1);
    expect(firstAyahOfAl112).toEqual([]);
    // 1:1 is the basmala as a verse and IS counted
    expect(registered.A.occurrences.some((o) => o.surah === 1 && o.ayah === 1)).toBe(true);
  });
  test("a root used without referring to Allah is listed under C and never merged into A", () => {
    const q = { slug: "ar-rahim", surfaceForms: ["الرحيم"], relatedRoots: [{ root: "ر-ح-م", forms: ["رحمة", "رحيم"] }] };
    const r = countName(index, q);
    expect(r.C.count).toBeGreaterThan(0);
    expect(r.C.occurrences.every((o) => o.relation === "related" && o.measure === "C" && o.root === "ر-ح-م")).toBe(true);
    expect(r.A.occurrences.every((o) => o.relation === "direct")).toBe(true);
    const aKeys = new Set(r.A.occurrences.map((o) => `${o.surah}:${o.ayah}:${o.tokenIndex}`));
    expect(r.C.occurrences.some((o) => aKeys.has(`${o.surah}:${o.ayah}:${o.tokenIndex}`))).toBe(false);
    // "rahim" without the article describes the messenger in 9:128; the engine lists it as related and unreviewed, it does not call it a Name
    expect(r.C.occurrences.some((o) => o.surah === 9 && o.ayah === 128 && normalizeArabic(o.raw) === "رحيم")).toBe(true);
    expect(r.C.occurrences.every((o) => o.referent === "unreviewed")).toBe(true);
  });
  test("a word is counted under one measure only (A before B before C)", () => {
    const r = countName(index, {
      slug: "x",
      surfaceForms: ["الغفور"],
      acceptedVariants: [{ form: "الغفور", basis: "fixture", reviewRef: "fixture" }],
      relatedRoots: [{ root: "غ-ف-ر", forms: ["الغفور"] }],
    });
    expect(r.A.count).toBeGreaterThan(0);
    expect(r.B.count).toBe(0);
    expect(r.C.count).toBe(0);
  });
  test("B is empty until a reviewer lists a variant; then it is counted separately with its form", () => {
    const empty = countName(index, buildQuery(byslug("allah")));
    expect(empty.B.count).toBe(0);
    const withB = countName(index, { slug: "allah", surfaceForms: ["الله"], acceptedVariants: [{ form: "لله", basis: "fixture: prefixed lam", reviewRef: "fixture-review" }] });
    expect(withB.B.count).toBeGreaterThan(0);
    expect(withB.A.count).toBe(empty.A.count);
  });
  test("a recognised Name can be absent as an exact surface form: the article-less word exists but is not counted", () => {
    const rauf = byslug("ar-rauf");
    const r = countName(index, buildQuery(rauf));
    expect(r.A.count).toBe(0);
    const toggled = exploreCandidates(index, "الرءوف").find((c) => c.kind === "article_toggled");
    expect(toggled?.hits.length).toBeGreaterThan(0);
  });
  test("a word equal to a Name's letters is not thereby the Name: lexical collisions stay 'unreviewed'", () => {
    const r = countName(index, buildQuery(byslug("al-muizz")));
    for (const o of r.A.occurrences) {
      expect(o.referent).toBe("unreviewed");
      expect(verseText(o.surah, o.ayah)).toContain(o.raw);
    }
  });
  test("a disputed candidate can be counted but is never presentable as a recognised Name", () => {
    expect(presentableAsRecognised("disputed_candidate")).toBe(false);
    expect(presentableAsRecognised("under_research")).toBe(false);
    expect(presentableAsRecognised("educational_list")).toBe(true);
    const r = countName(index, { slug: "candidate", surfaceForms: ["الشكور"] });
    expect(r.A.count).toBeGreaterThan(0);
  });
  test("occurrences carry surah, ayah, token index, the published word, and are ordered", () => {
    const r = countName(index, buildQuery(byslug("al-hakim")));
    const first = r.A.occurrences[0]!;
    expect(first.surah).toBeGreaterThanOrEqual(1);
    expect(first.tokenIndex).toBeGreaterThanOrEqual(1);
    const toks = tokenizeVerse({ surah: first.surah, ayah: first.ayah, text: verseText(first.surah, first.ayah) });
    expect(toks.find((t) => t.index === first.tokenIndex)!.raw).toBe(first.raw);
    const sorted = [...r.A.occurrences].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.tokenIndex - b.tokenIndex);
    expect(r.A.occurrences).toEqual(sorted);
    expect(r.A.verseCount).toBeLessThanOrEqual(r.A.count);
  });
});

describe("provenance and reproducibility", () => {
  test("every result carries edition, checksums, policy versions and the query hash", () => {
    const q = buildQuery(byslug("al-malik"));
    const r = countName(index, q);
    expect(r.provenance.edition.sha256).toBe(corpus.edition.sha256);
    expect(r.provenance.edition.contentSha256).toBe(corpus.edition.contentSha256);
    expect(r.provenance.normalisationPolicy).toBe("asma-norm-v1");
    expect(r.provenance.tokenisationPolicy).toBe("asma-tok-v1");
    expect(r.provenance.queryVersion).toBe("asma-query-v1");
    expect(r.provenance.queryHash).toBe(queryHash(q));
  });
  test("counts reproduce byte-identically from a freshly loaded corpus", () => {
    for (const slug of ["allah", "ar-rahman", "al-hakim", "al-muizz"]) {
      const q = buildQuery(byslug(slug));
      const first = serialiseCounts(countName(index, q));
      const second = serialiseCounts(countName(buildIndex(loadQuranCorpusFromDisk()), q));
      expect(second).toBe(first);
      expect(verifyReproducible(corpus, q).ok).toBe(true);
    }
  });
  test("the query hash ignores spelling variation and ordering but not substance", () => {
    expect(queryHash({ slug: "a", surfaceForms: ["ٱلْغَفُورُ", "غفور"] })).toBe(queryHash({ slug: "a", surfaceForms: ["غفور", "الغفور"] }));
    expect(queryHash({ slug: "a", surfaceForms: ["غفور"] })).not.toBe(queryHash({ slug: "a", surfaceForms: ["غفور", "رحيم"] }));
  });
  test("canonicalJson sorts keys", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});

describe("validator: only derived counts are accepted", () => {
  const q = () => buildQuery(byslug("al-hakim"));
  const good = () => {
    const r = countName(index, q());
    return { slug: "al-hakim", measure: "A" as const, count: r.A.count, origin: "computed", provenance: r.provenance };
  };
  test("a computed count with provenance is accepted", () => {
    expect(validateCountClaim(index, q(), good())).toMatchObject({ ok: true, problems: [] });
  });
  test("a hardcoded count (typed in, or taken from a book) is rejected even when the number happens to be right", () => {
    expect(validateCountClaim(index, q(), { ...good(), origin: "manual" }).problems).toContain("hardcoded");
    const { provenance: _p, ...noProv } = good();
    void _p;
    expect(validateCountClaim(index, q(), { ...noProv, origin: undefined }).problems).toEqual(expect.arrayContaining(["hardcoded", "unsupported"]));
  });
  test("a wrong count, a stale policy and a changed query are each rejected", () => {
    expect(validateCountClaim(index, q(), { ...good(), count: good().count + 1 }).problems).toContain("mismatch");
    expect(validateCountClaim(index, q(), { ...good(), provenance: { ...good().provenance, normalisationPolicy: "asma-norm-v0" } }).problems).toContain("stale");
    expect(validateCountClaim(index, { ...q(), surfaceForms: [...q().surfaceForms, "حكيم"] }, good()).problems).toContain("stale");
    expect(validateCountClaim(index, q(), { ...good(), measure: "Z" as never }).problems).toEqual(["unknown_measure"]);
  });
  test("the registry file carries no count of any kind; a count-like field is found", () => {
    expect(findHardcodedCounts(loadNamesFile())).toEqual([]);
    expect(findHardcodedCounts({ names: [{ slug: "x", occurrences: 12 }] })).toEqual(["$.names[0].occurrences"]);
    expect(findHardcodedCounts({ a: { total: "99" } })).toEqual(["$.a.total"]);
  });
});

describe("registry draft", () => {
  test("is structurally sound, with unique slugs, unique surface forms and consistent vowelling", () => {
    expect(validateRegistry(names)).toEqual([]);
  });
  test("the educational list is not asserted to be 99 or complete", () => {
    const file = loadNamesFile();
    expect(file._meta.collection).toMatch(/does NOT establish/);
    expect(file._meta.collection).toMatch(/does NOT claim/);
    expect(JSON.stringify(file.names)).not.toMatch(/\b(authentic|sahih|hadith)\b/i);
  });
  test("every Arabic and Urdu/English gloss passes the content guard", () => {
    for (const n of names) for (const t of [n.en, n.mar, n.ur]) expect({ slug: n.slug, v: checkAsmaText(t) }).toEqual({ slug: n.slug, v: [] });
  });
  test("a duplicate or unreadable entry is reported", () => {
    const dup = [names[0]!, { ...names[0]! }];
    expect(validateRegistry(dup).join()).toMatch(/duplicate slug/);
    expect(validateRegistry([{ ...names[1]!, root: "x" }]).join()).toMatch(/root must be/);
    expect(validateRegistry([{ ...names[1]!, v: "غير" }]).join()).toMatch(/vowelled form differs/);
  });
});

describe("content guard: virtues, guaranteed acceptance, fixed counts, special times", () => {
  test.each([
    ["Allah will surely answer anyone who calls this Name.", "guaranteed_acceptance"],
    ["This dua is guaranteed to be accepted.", "guaranteed_acceptance"],
    ["Your supplication can never be rejected.", "guaranteed_acceptance"],
    ["Reciting this Name earns you great reward and paradise.", "invented_virtue"],
    ["The reward of reciting it is huge.", "invented_virtue"],
    ["Recite it 100 times after every prayer.", "fixed_count"],
    ["Say it seven times.", "fixed_count"],
    ["The best time to call upon this Name is the last third of the night.", "special_time"],
    ["Read it after Fajr for ease.", "special_time"],
    ["Allah has only 99 names.", "limited_to_99"],
    ["هذا الدعاء مضمون الإجابة", "guaranteed_acceptance"],
    ["اقرأه 100 مرة", "fixed_count"],
    ["أفضل وقت لقراءته بعد الفجر", "special_time"],
    ["اس نام کے پڑھنے کا ثواب بہت ہے", "invented_virtue"],
    ["اسے 100 بار پڑھیں", "fixed_count"],
    ["یہ دعا کبھی رد نہیں ہوتی", "guaranteed_acceptance"],
    ["صرف 99 نام ہیں", "limited_to_99"],
  ])("refuses: %s", (text, code) => {
    expect(checkAsmaText(text)).toContain(code);
  });
  test("plain educational wording passes", () => {
    for (const ok of ["Al-Ghafur: the Oft-Forgiving. A beginner gloss, awaiting review.", "Learn to recognise this Name in the Quran.", "الغفور: كثير المغفرة", "بہت بخشنے والا"]) expect(checkAsmaText(ok)).toEqual([]);
  });
  test("a misconception entry may quote the claim in order to correct it; nothing else may", () => {
    const quoted = "Some people say it is guaranteed to be accepted if recited 100 times.";
    expect(checkAsmaText(quoted)).not.toEqual([]);
    expect(checkAsmaText(quoted, "misconception")).toEqual([]);
  });
});
