import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { CREATION_FIELDS, GUIDANCE_FIELDS, validateCreationDraft, validateGuidanceDraft } from "@/lib/sourced/kinds";
import { INTERPRETATION_PREFIX } from "@/lib/sourced/draft";

const quran = new Set<string>();
for (const line of readFileSync(join(process.cwd(), "content", "quran", "quran.txt"), "utf8").split("\n")) {
  const [s, a] = line.split("|");
  if (s && a) quran.add(`${s}:${a}`);
}
const has = (s: number, a: number) => quran.has(`${s}:${a}`);
const ne = { status: "not_established", note_en: "The Quran does not state this." };
const stated = (text: string, extra: Record<string, unknown> = {}, refs = [{ surah: 2, from: 30, to: 30 }]) => ({ status: "stated", text_en: text, refs, ...extra });
const creation = (over: Record<string, unknown> = {}) => ({ schema: "qitl.creation.draft.v1", slug: "fixture", category: "angels", name_en: "Fixture", name_ar: "مثال", fields: { ...Object.fromEntries(CREATION_FIELDS.map((k) => [k, ne])), ...over } });
const guidance = (over: Record<string, unknown> = {}) => ({ schema: "qitl.guidance.draft.v1", slug: "fixture", fields: { ...Object.fromEntries(GUIDANCE_FIELDS.map((k) => [k, ne])), ...over } });

describe("sourced drafts", () => {
  test("all-'not established' drafts are valid; every field is required", () => {
    expect(validateCreationDraft(creation(), has).ok).toBe(true);
    expect(validateGuidanceDraft(guidance(), has).ok).toBe(true);
    const d = creation();
    delete (d.fields as Record<string, unknown>).origin;
    expect(validateCreationDraft(d, has).ok).toBe(false);
  });
  test("a stated field needs a verse that exists and cannot be hadith, tradition or an invented detail", () => {
    expect(validateCreationDraft(creation({ origin: stated("The angels are mentioned when God tells them He will place a successor on the earth.") }), has).ok).toBe(true);
    expect(validateCreationDraft(creation({ origin: stated("The angels are mentioned here.", {}, [{ surah: 2, from: 999, to: 999 }]) }), has).ok).toBe(false);
    for (const text of ["It is narrated in a hadith that the angels were made from light.", "The angels look like tall beings with a beautiful face.", "God guarantee the answer to every prayer without fail."])
      expect(validateCreationDraft(creation({ nature: stated(text) }), has).ok, text).toBe(false);
  });
  test("numbers must be declared; the interpretation label belongs to the interpretive fields only", () => {
    expect(validateCreationDraft(creation({ abilities: stated("Angels are described as having wings, two, three and four.") }), has).ok).toBe(true);
    expect(validateCreationDraft(creation({ abilities: stated("Angels are described with 4 wings.") }), has).ok).toBe(false);
    expect(validateCreationDraft(creation({ lessons: stated("Gratitude is linked to remembering what God gave.") }), has).ok).toBe(false);
    expect(validateCreationDraft(creation({ lessons: stated(`${INTERPRETATION_PREFIX} gratitude is linked to remembering what God gave.`) }), has).ok).toBe(true);
    expect(validateCreationDraft(creation({ origin: stated(`${INTERPRETATION_PREFIX} the angels were told of a successor on the earth.`) }), has).ok).toBe(false);
  });
  test("guidance: the situation, the application and the limits are labelled interpretation; the Quran field is not", () => {
    expect(validateGuidanceDraft(guidance({ quran_says: stated("The Quran says that with hardship there is ease, and repeats it.", {}, [{ surah: 94, from: 5, to: 6 }]) }), has).ok).toBe(true);
    expect(validateGuidanceDraft(guidance({ everyday_application: stated("Take one small step today and ask for help.", {}, [{ surah: 94, from: 5, to: 6 }]) }), has).ok).toBe(false);
    expect(validateGuidanceDraft(guidance({ everyday_application: stated(`${INTERPRETATION_PREFIX} take one small step today and ask for help.`, {}, [{ surah: 94, from: 5, to: 6 }]) }), has).ok).toBe(true);
  });
  test("every draft file present in content/creation and content/guidance is valid against the real Quran text", () => {
    for (const [dir, validate] of [["creation", validateCreationDraft], ["guidance", validateGuidanceDraft]] as const) {
      const p = join(process.cwd(), "content", dir);
      if (!existsSync(p)) continue;
      for (const f of readdirSync(p).filter((x) => x.endsWith(".draft.json"))) {
        const r = validate(JSON.parse(readFileSync(join(p, f), "utf8")), has);
        expect(r.ok ? [] : r.problems, `${dir}/${f}`).toEqual([]);
      }
    }
  });
});
