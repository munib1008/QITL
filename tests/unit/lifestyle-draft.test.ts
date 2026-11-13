import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FIELD_KEYS } from "@/lib/lifestyle/model";
import { INTERPRETATION_PREFIX, validateLifestyleDraft } from "@/lib/lifestyle/draft";

const quran = new Set<string>();
for (const line of readFileSync(join(process.cwd(), "content", "quran", "quran.txt"), "utf8").split("\n")) {
  const [s, a] = line.split("|");
  if (s && a) quran.add(`${s}:${a}`);
}
const has = (s: number, a: number) => quran.has(`${s}:${a}`);

const ne = { status: "not_established", note_en: "The Quran does not state this." } as const;
function draft(over: Record<string, unknown> = {}) {
  const fields: Record<string, unknown> = {};
  for (const k of FIELD_KEYS) fields[k] = ne;
  return { schema: "qitl.lifestyle.draft.v1", slug: "fixture", fields: { ...fields, ...over } };
}
const stated = (text: string, extra: Record<string, unknown> = {}) => ({ status: "stated", text_en: text, refs: [{ surah: 29, from: 14, to: 14 }], ...extra });

describe("lifestyle draft validator", () => {
  test("a draft of 20 'not established' fields is valid (nothing is padded)", () => {
    expect(validateLifestyleDraft(draft(), has).ok).toBe(true);
  });
  test("all 20 fields are required", () => {
    const d = draft();
    delete (d.fields as Record<string, unknown>).housing;
    expect(validateLifestyleDraft(d, has).ok).toBe(false);
  });
  test("a stated field needs a reference that exists in the Quran text", () => {
    const bad = draft({ occupation: { ...stated("He is described as a messenger calling his people to worship God."), refs: [{ surah: 2, from: 900, to: 900 }] } });
    const r = validateLifestyleDraft(bad, has);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r.problems)).toContain("not in the Quran text");
    expect(validateLifestyleDraft(draft({ occupation: { status: "stated", text_en: "He is described as a messenger calling his people to worship God." } }), has).ok).toBe(false);
  });
  test("numbers must be declared, dates and invented customs are rejected", () => {
    expect(validateLifestyleDraft(draft({ lifespan: stated("He stayed among his people for 950 years.") }), has).ok).toBe(false);
    expect(validateLifestyleDraft(draft({ lifespan: stated("He stayed among his people for 950 years.", { numbers: ["950"] }) }), has).ok).toBe(true);
    for (const text of ["He lived in a tent of goat hair near the river.", "He was born in the city of Ur, in year 2000 BC.", "He ate dates and wore a wool robe every day."])
      expect(validateLifestyleDraft(draft({ housing: stated(text) }), has).ok, text).toBe(false);
  });
  test("lessons and modern comparisons must be labelled as interpretation; other fields must not carry the label", () => {
    expect(validateLifestyleDraft(draft({ lessons: stated("Patience in calling people is presented as part of his mission.") }), has).ok).toBe(false);
    expect(validateLifestyleDraft(draft({ lessons: stated(`${INTERPRETATION_PREFIX} patience in calling people is presented as part of his mission.`) }), has).ok).toBe(true);
    expect(validateLifestyleDraft(draft({ occupation: stated(`${INTERPRETATION_PREFIX} he was a messenger calling his people.`) }), has).ok).toBe(false);
  });
  test("claims of proof or guarantee are rejected", () => {
    expect(validateLifestyleDraft(draft({ health_treatment: stated("This guarantee of healing was proved that it works for all.") }), has).ok).toBe(false);
  });
  test("every draft file present in content/lifestyle is valid against the real Quran text", () => {
    const dir = join(process.cwd(), "content", "lifestyle");
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".draft.json"))) {
      const r = validateLifestyleDraft(JSON.parse(readFileSync(join(dir, f), "utf8")), has);
      expect(r.ok ? [] : r.problems, f).toEqual([]);
    }
  });
});
