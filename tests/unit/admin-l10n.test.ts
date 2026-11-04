import { describe, expect, test } from "vitest";
import { errMsg, okMsg } from "@/components/admin/feedback";
import { adminChapterRaw, adminChapterStrings } from "@/lib/i18n/modules/adminChapter";
import { adminCoverageRaw, adminCoverageStrings } from "@/lib/i18n/modules/adminCoverage";
import { adminCreationRaw, adminCreationStrings } from "@/lib/i18n/modules/adminCreation";
import { adminGuidanceRaw, adminGuidanceStrings } from "@/lib/i18n/modules/adminGuidance";
import { adminHadithStoriesRaw, adminHadithStoriesStrings } from "@/lib/i18n/modules/adminHadithStories";
import { adminInterpretationRaw, adminInterpretationStrings } from "@/lib/i18n/modules/adminInterpretation";
import { adminLicencesRaw, adminLicencesStrings } from "@/lib/i18n/modules/adminLicences";
import { adminLifestyleRaw, adminLifestyleStrings } from "@/lib/i18n/modules/adminLifestyle";
import { adminLineageRaw, adminLineageStrings } from "@/lib/i18n/modules/adminLineage";
import { adminMediaRaw, adminMediaStrings } from "@/lib/i18n/modules/adminMedia";
import { partnersRaw, partnersT } from "@/lib/i18n/modules/partners";
import { adminQiraatRaw, adminQiraatStrings } from "@/lib/i18n/modules/adminQiraat";
import { adminSharedRaw, adminSharedStrings } from "@/lib/i18n/modules/adminShared";
import { adminAsmaRaw, adminAsmaStrings } from "@/lib/i18n/modules/adminAsma";
import { adminScienceRaw, adminScienceStrings } from "@/lib/i18n/modules/adminScience";
import { adminShifaRaw, adminShifaStrings } from "@/lib/i18n/modules/adminShifa";
import { adminStoryRaw, adminStoryStrings } from "@/lib/i18n/modules/adminStory";
import { adminToolsRaw, adminToolsStrings } from "@/lib/i18n/modules/adminTools";
import { adminUniverseRaw, adminUniverseStrings } from "@/lib/i18n/modules/adminUniverse";

/**
 * The admin editors' strings (docs/I18N.md, docs/LOCALISATION_STATUS.md). Each strings file keeps its English, Arabic and
 * Urdu side by side in `...Raw`. These tests prove that the three languages have exactly the same keys at every depth,
 * that nothing is empty, that no Arabic or Urdu leaf silently falls back to English, and that a server message is
 * never translated (it is shown verbatim, after a localised prefix).
 */
const FILES: Array<[string, { en: object; ar: object; ur: object }, (locale: string) => object]> = [
  ["adminChapter", adminChapterRaw, adminChapterStrings],
  ["adminCoverage", adminCoverageRaw, adminCoverageStrings],
  ["adminCreation", adminCreationRaw, adminCreationStrings],
  ["adminGuidance", adminGuidanceRaw, adminGuidanceStrings],
  ["adminHadithStories", adminHadithStoriesRaw, adminHadithStoriesStrings],
  ["adminInterpretation", adminInterpretationRaw, adminInterpretationStrings],
  ["adminLicences", adminLicencesRaw, adminLicencesStrings],
  ["adminLifestyle", adminLifestyleRaw, adminLifestyleStrings],
  ["adminLineage", adminLineageRaw, adminLineageStrings],
  ["adminMedia", adminMediaRaw, adminMediaStrings],
  ["adminQiraat", adminQiraatRaw, adminQiraatStrings],
  ["partners", partnersRaw, partnersT],
  ["adminShared", adminSharedRaw, adminSharedStrings],
  ["adminShifa", adminShifaRaw, adminShifaStrings],
  ["adminAsma", adminAsmaRaw, adminAsmaStrings],
  ["adminScience", adminScienceRaw, adminScienceStrings],
  ["adminStory", adminStoryRaw, adminStoryStrings],
  ["adminTools", adminToolsRaw, adminToolsStrings],
  ["adminUniverse", adminUniverseRaw, adminUniverseStrings],
];

/** Every leaf as [dotted key, text]; a function leaf is called with sample arguments so its wording is compared too. */
function leaves(o: unknown, prefix = ""): Array<[string, string]> {
  if (typeof o === "string") return [[prefix, o]];
  if (typeof o === "function") return [[`${prefix}()`, String((o as (...a: unknown[]) => unknown)(3, 7, 9, "x"))]];
  if (typeof o !== "object" || o === null) return [];
  return Object.entries(o).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

describe("admin editor strings: en, ar and ur have the same keys", () => {
  for (const [name, raw] of FILES) {
    test(`${name}: identical key sets, nothing empty`, () => {
      const en = leaves(raw.en);
      expect(en.length).toBeGreaterThan(0);
      const keys = (o: object) => leaves(o).map(([k]) => k).sort();
      expect(keys(raw.ar)).toEqual(keys(raw.en));
      expect(keys(raw.ur)).toEqual(keys(raw.en));
      for (const lang of ["en", "ar", "ur"] as const)
        for (const [k, v] of leaves(raw[lang])) expect(v.trim(), `${name} ${lang} ${k} is empty`).not.toBe("");
    });

    test(`${name}: no Arabic or Urdu key falls back silently to English`, () => {
      for (const locale of ["ar", "ur"] as const) {
        const merged = new Map(leaves(get(name, locale)));
        for (const [k, v] of leaves(raw[locale])) expect(merged.get(k), `${name} ${locale} ${k}`).toBe(v);
      }
    });

    test(`${name}: the Arabic and Urdu wording is not the English wording`, () => {
      // Leaves equal to English are allowed only for names, codes and technical tokens (no three lowercase Latin letters
      // once product and format names are removed): everything else must be translated.
      const strip = (s: string) => s.replace(/QITL|Supabase|JSON|README|Markdown|Google|Claude|WebP|WebM|MP4|SVG|PNG|JPEG|GIF|URL|https?|ISO|API|MALWARE_SCAN_URL|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|docs\/[\w.]+|pnpm [\w:]+|EN|AR|UR|CE|BCE/g, "");
      for (const locale of ["ar", "ur"] as const) {
        const other = new Map(leaves(raw[locale]));
        const same = leaves(raw.en).filter(([k, v]) => other.get(k) === v && /[a-z]{3}/.test(strip(v)));
        expect(same.map(([k]) => `${locale} ${k}`)).toEqual([]);
      }
    });
  }
});

function get(name: string, locale: string): object {
  return FILES.find((f) => f[0] === name)![2](locale);
}

describe("server messages stay verbatim", () => {
  const msg = "new row violates row-level security policy for table \"stories\"";
  test("English shows the message alone, exactly as before", () => {
    expect(errMsg("en", "The action failed:", msg)).toEqual({ tone: "err", text: msg });
  });
  test("Arabic and Urdu show a localised prefix and keep the message untouched for a lang=en span", () => {
    expect(errMsg("ar", adminToolsStrings("ar").failedPrefix, msg)).toEqual({ tone: "err", text: "تعذّرت العملية:", server: msg });
    expect(errMsg("ur", adminToolsStrings("ur").failedPrefix, msg)).toEqual({ tone: "err", text: "کارروائی ناکام رہی:", server: msg });
  });
  test("the screen's own 'Not configured' is localised, not passed through as a server message", () => {
    expect(errMsg("ar", "x", "Not configured", adminToolsStrings("ar").notConfigured)).toEqual({ tone: "err", text: "غير مهيّأ" });
    expect(errMsg("en", "x", "Not configured", adminToolsStrings("en").notConfigured)).toEqual({ tone: "err", text: "Not configured" });
  });
  test("a success line may end with a server note", () => {
    expect(okMsg("Saved as a draft.", "Send it for review.")).toEqual({ tone: "ok", text: "Saved as a draft.", server: "Send it for review." });
    expect(okMsg("Saved as a draft.")).toEqual({ tone: "ok", text: "Saved as a draft." });
  });
});

describe("terms of art and identifiers are not translated away", () => {
  test("honorific, Quran and hadith reference syntax stay as typed", () => {
    expect(adminToolsStrings("ar").catProphetic).toContain("ﷺ");
    expect(adminToolsStrings("ur").catProphetic).toContain("ﷺ");
    expect(adminToolsStrings("ar").refsHelp).toContain("Q");
    expect(adminToolsStrings("ur").chapterText).toContain("Markdown");
  });
  test("role labels are displayed in the language, but the lookup keys are the stable role identifiers", () => {
    const r = adminToolsStrings("ar").roles;
    expect(Object.keys(r).sort()).toEqual(["admin", "audio_producer", "editor", "moderator", "scholarly_reviewer", "science_reviewer", "translation_reviewer"]);
  });
});
