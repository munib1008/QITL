import { describe, expect, test } from "vitest";
import journey from "../../content/journey/journey.draft.json";
import { eraText } from "@/lib/i18n/modules/eras";

describe("era titles and notes in Arabic and Urdu", () => {
  const texts = [...new Set(journey.eras.flatMap((e: { title: string; note?: string }) => [e.title, e.note].filter((x): x is string => !!x)))];
  test("every era title and note in the journey has an Arabic and an Urdu draft", () => {
    for (const t of texts) {
      for (const loc of ["ar", "ur"]) {
        const r = eraText(loc, t);
        expect({ t, loc, english: r.english }).toEqual({ t, loc, english: false });
        expect(r.text).toMatch(/[؀-ۿ]/);
      }
    }
  });
  test("English and unknown text stay as they are and are marked English", () => {
    expect(eraText("en", texts[0]!)).toEqual({ text: texts[0], english: true });
    expect(eraText("ar", "A title nobody translated")).toEqual({ text: "A title nobody translated", english: true });
  });
});
