import { describe, expect, test } from "vitest";
import { assertTopic, checkScienceText, topicCompleteness, validateInterpretation, validateMilestone, validatePublication, validateReviews, validateTopic } from "@/lib/science/validator";
import { displayYear, filterTopics, firstVerifiedMilestone, refLabel, scienceVerification } from "@/lib/science/status";
import { loadSeed, draftToDoc, docToListItem, GENERAL_DNE, type RawSeed } from "@/lib/science/seed";
import { loadSeedFromDisk } from "@/lib/science/seed-node";
import { AUDIENCES, JOURNEYS } from "@/lib/science/journeys";
import { CONNECTION_STRENGTHS, EVIDENCE_STATES, INTERPRETATION_STRENGTHS, RELATIONSHIPS } from "@/lib/science/model";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OK_DNE = { en: "This does not establish more than the stated finding.", ar: "نص", ur: "متن" };

describe("the three assessments are separate vocabularies", () => {
  test("no shared value, no score field", () => {
    const all = [...EVIDENCE_STATES, ...INTERPRETATION_STRENGTHS, ...CONNECTION_STRENGTHS, ...RELATIONSHIPS] as string[];
    expect(new Set(all).size).toBe(all.length);
    expect(EVIDENCE_STATES).toHaveLength(7);
    expect(INTERPRETATION_STRENGTHS).toHaveLength(6);
    expect(RELATIONSHIPS).toHaveLength(6);
    expect(EVIDENCE_STATES).toContain("outside_empirical_science");
  });
});

describe("validator: free text (regression for each rule)", () => {
  const bad: Array<[string, string]> = [
    ["proof_language", "The proof score of this passage is high."],
    ["proof_language", "This is a scientific miracle proven by embryology."],
    ["proof_language", "هذه معجزة علمية مثبتة"],
    ["proof_language", "یہ سائنسی معجزہ ثابت ہے"],
    ["unseen_proved", "Science has proved the existence of the angels."],
    ["unseen_proved", "Modern research has confirmed that jinn exist."],
    ["unseen_proved", "Physics proves that the resurrection will happen."],
    ["future_confirmation", "Future research will confirm this verse."],
    ["future_confirmation", "Later discoveries will prove the Quran right."],
    ["future_confirmation", "Science will one day confirm the verse."],
    ["awaiting_lab_proof", "The unseen is awaiting laboratory proof."],
    ["awaiting_lab_proof", "Still pending scientific confirmation."],
    ["medical_cure", "Honey cures every disease."],
    ["medical_cure", "This gives guaranteed healing."],
    ["percent_confidence", "We are 95% confident that the reading is right."],
    ["percent_confidence", "Confidence score: 80"],
  ];
  for (const [code, text] of bad)
    test(`${code}: ${text}`, () => expect(checkScienceText(text)).toContain(code));

  test("careful, true wording passes", () => {
    for (const ok of [
      "Observation supports cosmic expansion; how the verse is read is debated.",
      "Fresh water and sea water meet in estuaries.",
      "The nature of the soul is not a subject of empirical science.",
      "Matters of the unseen are outside empirical science and are not scientifically testable.",
      "This page makes no medical claim and gives no dose.",
    ])
      expect(checkScienceText(ok)).toEqual([]);
    // the shared sentences written for every topic pass their own validator
    for (const l of ["en", "ar", "ur"] as const) expect(checkScienceText(GENERAL_DNE[l])).toEqual([]);
  });

  test("a metaphysical topic is never described as awaiting a laboratory", () => {
    const f = validateTopic({ kind: "unseen", texts: { body: "Laboratory proof of the jinn is expected one day." } });
    expect(f.map((x) => x.code)).toContain("awaiting_lab_proof");
    expect(validateTopic({ kind: "natural", texts: { body: "Laboratory proof is routine for this topic." } })).toEqual([]);
  });
});

describe("validator: structured records", () => {
  test("a discovery date with no verified source is rejected", () => {
    expect(validateMilestone({ label: "x", year: 1929 })).toEqual(["discovery_date_no_source"]);
    expect(validateMilestone({ label: "x", year: 1929, verifiedSource: "not a url" })).toEqual(["discovery_date_no_source"]);
    expect(validateMilestone({ label: "x", year: 1929, verifiedSource: "https://example.test/a" })).toEqual([]);
    expect(validateMilestone({ label: "placeholder", year: null })).toEqual([]);
  });
  test("a citation needs a DOI or a URL, a valid DOI, and a verified source for a year or DOI", () => {
    expect(validatePublication({ title: "t" })).toEqual(["citation_no_locator"]);
    expect(validatePublication({ title: "t", doi: "not-a-doi", verifiedSource: "https://example.test/a" })).toEqual(["invalid_doi"]);
    expect(validatePublication({ title: "t", doi: "10.1234/abc" })).toEqual(["discovery_date_no_source"]);
    expect(validatePublication({ title: "t", url: "https://example.test/p", year: 2001 })).toEqual(["discovery_date_no_source"]);
    expect(validatePublication({ title: "t", url: "https://example.test/p" })).toEqual([]);
    expect(validatePublication({ title: "t", doi: "10.1234/abc", year: 2001, verifiedSource: "https://example.test/a" })).toEqual([]);
  });
  test("a modern interpretation is not attributed to a classical scholar without a source", () => {
    expect(validateInterpretation({ era: "classical", scholar: "X", summary: "A modern reading" })).toEqual(["classical_modern_attribution"]);
    expect(validateInterpretation({ era: "classical", scholar: "X", sourceRecorded: true, proposedAfterDiscovery: true })).toEqual(["classical_modern_attribution"]);
    expect(validateInterpretation({ era: "classical", scholar: "X", sourceRecorded: true, summary: "A sourced reading", proposedAfterDiscovery: false })).toEqual([]);
    expect(validateInterpretation({ era: "classical" })).toEqual([]);
    expect(validateInterpretation({ era: "contemporary", scholar: "Y", summary: "A reading" })).toEqual([]);
  });
  test("'verified' needs both reviews, on the current version, by two different people", () => {
    const both = { scientificApproved: true, scholarlyApproved: true, scientificReviewer: "a", scholarlyReviewer: "b", currentVersion: true };
    expect(validateReviews("verified", undefined)).toEqual(["verified_without_reviews"]);
    expect(validateReviews("verified", { ...both, scholarlyApproved: false })).toEqual(["verified_without_reviews"]);
    expect(validateReviews("verified", { ...both, scientificApproved: false })).toEqual(["verified_without_reviews"]);
    expect(validateReviews("verified", { ...both, currentVersion: false })).toEqual(["verified_without_reviews"]);
    expect(validateReviews("verified", { ...both, scholarlyReviewer: "a" })).toEqual(["verified_without_reviews"]);
    expect(validateReviews("verified", { ...both, scientificReviewer: null })).toEqual(["verified_without_reviews"]);
    expect(validateReviews("verified", both)).toEqual([]);
    expect(validateReviews("draft", undefined)).toEqual([]);
  });
  test("the 'does not establish' section is required in all three languages", () => {
    expect(validateTopic({ doesNotEstablish: { en: "short", ar: "x", ur: "y" } }).map((f) => f.code)).toEqual(["missing_does_not_establish"]);
    expect(validateTopic({ doesNotEstablish: { en: "This does not establish more than the stated finding.", ar: "", ur: "y" } }).map((f) => f.code)).toEqual(["missing_does_not_establish"]);
    expect(validateTopic({ doesNotEstablish: OK_DNE })).toEqual([]);
    expect(() => assertTopic({ doesNotEstablish: { en: "", ar: "", ur: "" } })).toThrow(/missing_does_not_establish/);
  });
  test("topic completeness reports placeholders and the mandatory section", () => {
    expect(topicCompleteness({ doesNotEstablish: OK_DNE, links: [{}] })).toEqual({ complete: false, missing: ["phenomenon", "limitations", "alternatives", "conclusion"] });
    expect(topicCompleteness({}).missing).toContain("does_not_establish");
    expect(topicCompleteness({ doesNotEstablish: OK_DNE, links: [{}], phenomenon: "a", limitations: "b", alternatives: "c", conclusion: "d" }).complete).toBe(true);
  });
});

describe("verification label", () => {
  const base = { published: false, scholarly_status: "not_reviewed", scientific_review: "not_reviewed", ai_generated: true, needs_rereview: false } as const;
  test("a draft is never verified, whatever else is true", () => {
    expect(scienceVerification(base)).toBe("ai_assisted_draft");
    expect(scienceVerification({ ...base, ai_generated: false })).toBe("pending_verification");
    expect(scienceVerification({ ...base, scientific_review: "approved" })).toBe("ai_assisted_draft");
    expect(scienceVerification({ ...base, scholarly_status: "approved" })).toBe("ai_assisted_draft");
    expect(scienceVerification({ ...base, scholarly_status: "approved", scientific_review: "approved" })).toBe("ai_assisted_draft"); // not published
  });
  test("verified only when published with both approvals and no re-review flag", () => {
    const v = { ...base, published: true, scholarly_status: "approved", scientific_review: "approved" } as const;
    expect(scienceVerification(v)).toBe("verified");
    expect(scienceVerification({ ...v, needs_rereview: true })).toBe("ai_assisted_draft");
    expect(scienceVerification({ ...v, scientific_review: "invalidated" })).toBe("ai_assisted_draft");
    expect(scienceVerification({ ...v, scholarly_status: "rejected" })).toBe("rejected");
  });
});

describe("years and filters", () => {
  test("a year without a verified source is not displayed", () => {
    expect(displayYear({ year: 1929, verified_source: null })).toEqual({ year: null, sourceUrl: null });
    expect(displayYear({ year: null, verified_source: "https://example.test/a" })).toEqual({ year: null, sourceUrl: null });
    expect(displayYear({ year: 1929, verified_source: "https://example.test/a" })).toEqual({ year: 1929, sourceUrl: "https://example.test/a" });
  });
  test("refLabel", () => {
    expect(refLabel([{ surah: 55, ayah: 19 }, { surah: 55, ayah: 20 }, { surah: 25, ayah: 53 }])).toBe("55:19-20; 25:53");
    expect(refLabel([{ surah: 51, ayah: 47 }])).toBe("51:47");
  });
  test("filters and search work on the list and an unrated filter selects unrated topics", () => {
    const topics = loadSeedFromDisk().map((t) => docToListItem(draftToDoc(t)));
    expect(topics).toHaveLength(13);
    expect(filterTopics(topics, { discipline: "cosmology" }, "en").map((t) => t.slug)).toEqual(["sky-built-and-widened-51-47", "heavens-and-earth-joined-21-30"]);
    expect(filterTopics(topics, { relationship: "not_scientifically_testable" }, "en").map((t) => t.slug)).toEqual(["unseen-matters-2-3"]);
    expect(filterTopics(topics, { evidence: "outside_empirical_science" }, "en").map((t) => t.slug).sort()).toEqual(["sleep-and-death-39-42", "unseen-matters-2-3"]);
    expect(filterTopics(topics, { evidence: "established" }, "en")).toHaveLength(0);
    expect(filterTopics(topics, { interpretation: "unassessed" }, "en")).toHaveLength(13);
    expect(filterTopics(topics, { q: "51:47" }, "en")).toHaveLength(1);
    expect(filterTopics(topics, { q: "النحل" }, "ar").map((t) => t.slug)).toEqual(["the-bee-16-68-69"]);
    expect(firstVerifiedMilestone(topics[0]!.milestones)?.year).toBe(1922);
  });
});

describe("the draft inventory", () => {
  const topics = loadSeedFromDisk();
  const corpus = loadQuranCorpusFromDisk();
  const verses = new Map(corpus.verses.map((v) => [`${v.surah}:${v.ayah}`, v.text]));

  test("holds the requested candidates, each with an existing Quran reference", () => {
    expect(topics.map((t) => t.slug)).toEqual([
      "sky-built-and-widened-51-47", "heavens-and-earth-joined-21-30", "life-from-water-21-30", "night-day-sun-moon-orbits-21-33", "clouds-rain-and-hail-24-43",
      "two-seas-and-a-barrier-55-19-25-53", "earth-and-mountains-78-6-7", "stages-of-human-development-23-12-14", "the-bee-16-68-69", "sleep-and-death-39-42",
      "duration-of-nuh-mission-29-14", "iron-sent-down-57-25", "unseen-matters-2-3",
    ]);
    const refs = topics.flatMap((t) => t.links.map((l) => `${l.surah}:${l.ayah}`));
    for (const r of ["51:47", "21:30", "21:33", "24:43", "55:19", "55:20", "25:53", "78:6", "78:7", "23:12", "23:13", "23:14", "16:68", "16:69", "39:42", "29:14", "57:25"]) expect(refs).toContain(r);
    for (const r of refs) expect(verses.has(r)).toBe(true);
  });
  test("every Arabic term is a substring of the corpus text of its verse", () => {
    for (const t of topics) for (const l of t.links) for (const term of l.terms) expect(verses.get(`${l.surah}:${l.ayah}`)).toContain(term);
  });
  test("the two parts of 21:30 are separate topics", () => {
    expect(topics.filter((t) => t.links.some((l) => l.surah === 21 && l.ayah === 30))).toHaveLength(2);
  });
  test("nothing is rated: no evidence state except Outside Empirical Science, no relationship except not-testable, unseen matters outside", () => {
    for (const t of topics) {
      for (const c of t.claims) expect([undefined, "outside_empirical_science"]).toContain(c.evidence_state);
      for (const l of t.links) expect([undefined, "not_scientifically_testable"]).toContain(l.relationship);
      expect(t.does_not_establish.en.length).toBeGreaterThan(80);
      expect(t.does_not_establish.ar).toBeTruthy();
      expect(t.does_not_establish.ur).toBeTruthy();
    }
    const unseen = topics.find((t) => t.kind === "unseen")!;
    expect(unseen.claims.every((c) => c.evidence_state === "outside_empirical_science")).toBe(true);
    expect(unseen.links.every((l) => l.relationship === "not_scientifically_testable")).toBe(true);
  });
  test("a year appears only with a source URL and a note; dated entries are exactly the three checked records", () => {
    const dated = topics.flatMap((t) => t.discoveries.flatMap((g) => g.milestones)).filter((m) => m.year != null);
    expect(dated.map((m) => m.year)).toEqual([1922, 1929, 1931]);
    for (const m of dated) {
      expect(m.verified_source).toMatch(/^https:\/\/api\.crossref\.org\/works\/10\./);
      expect(m.verified_note).toMatch(/Checked 2026-11-04/);
    }
    const undated = topics.flatMap((t) => t.discoveries.flatMap((g) => g.milestones)).filter((m) => m.year == null);
    expect(undated.length).toBeGreaterThan(0);
    // no publication is marked verified in the file: only a science reviewer can do that in the database
    expect(readFileSync(join(process.cwd(), "content", "science", "topics.draft.json"), "utf8")).not.toMatch(/"verified"\s*:\s*true/);
  });
  test("the draft file shows no publication (unverified citations are not listed) and no interpretation wording", () => {
    for (const t of topics) {
      const d = draftToDoc(t);
      expect(d.publications).toEqual([]);
      expect(d.scholarly_status).toBe("not_reviewed");
      expect(d.scientific_review).toBe("not_reviewed");
      for (const l of d.links) for (const i of l.interpretations ?? []) expect({ s: i.summary, w: i.scholar, st: i.evidence_status }).toEqual({ s: null, w: null, st: "needs_source" });
    }
  });
  test("the loader refuses a bad term, a missing verse and a seeded rating", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "content", "science", "topics.draft.json"), "utf8")) as RawSeed;
    const look = (s: number, a: number) => verses.get(`${s}:${a}`) ?? null;
    const clone = () => structuredClone(raw);
    const a = clone(); a.topics[0]!.links[0]!.terms = ["مخترع"];
    expect(() => loadSeed(a, look)).toThrow(/does not appear in the corpus/);
    const b = clone(); b.topics[0]!.links[0]!.ayah = 999;
    expect(() => loadSeed(b, look)).toThrow(/not in the loaded Quran corpus/);
    const c = clone(); c.topics[0]!.claims[0]!.evidence_state = "established";
    expect(() => loadSeed(c, look)).toThrow(/may not assign the evidence state/);
    const d = clone(); d.topics[0]!.discoveries[0]!.milestones[0]!.verified_source = undefined;
    expect(() => loadSeed(d, look)).toThrow(/discovery_date_no_source/);
    const e = clone(); e.topics[0]!.does_not_establish_en = "Future research will confirm this verse, so all is proven here.";
    expect(() => loadSeed(e, look)).toThrow(/future_confirmation/);
  });
});

describe("learning journeys", () => {
  test("five audiences, all content pending, only existing pages linked", () => {
    expect([...AUDIENCES]).toEqual(["children", "teens", "general", "university", "advanced"]);
    for (const a of AUDIENCES) {
      expect(JOURNEYS[a].length).toBeGreaterThan(0);
      for (const s of JOURNEYS[a]) {
        expect(s.written).toBe(false);
        if (s.href) expect(["/science", "/science/timeline", "/science/questions", "/methodology"]).toContain(s.href);
      }
    }
  });
});
