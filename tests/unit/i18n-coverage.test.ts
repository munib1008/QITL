import { describe, expect, test } from "vitest";
import { STRING_FILES } from "@/lib/i18n/registry";
import { englishContent } from "@/lib/i18n/locales";
import { apiErrorText } from "@/lib/i18n/modules/api";
import { langHref } from "@/components/shell/toggles";
import fs from "node:fs";
import path from "node:path";
import { ROUTES } from "../e2e/routes";

/** Every string leaf of a strings object as [dotted key, value]; functions are called with sample arguments. */
function leaves(o: unknown, prefix = ""): Array<[string, string]> {
  if (typeof o === "string") return [[prefix, o]];
  if (typeof o === "function") return [[`${prefix}()`, String((o as (...a: unknown[]) => unknown)(3, 7, 9))]];
  if (typeof o !== "object" || o === null) return [];
  return Object.entries(o).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

/**
 * Leaves that stay English on purpose: brand and language names, codes and file names, and the few interface
 * sentences that state a religious fact, which a qualified translator and the scholarly reviewers must supply.
 */
const ENGLISH_ON_PURPOSE = [
  /^(lang\.en|.*languages\.en|brandTagline)$/,
  /(^|\.)longevity\.nuh$/, // lifestyle: statement about Q 29:14
  /(^|\.)distinction\.points\.\d+$/, // qiraat: scholarly statements
  /^(faith|knowledge)$/, // last hour: statements tied to Q 7:187
];
const NEUTRAL = /^[\s\d%·—–:,.()/{}$#+\-←→‹›?!A-Z]*$|^(QITL|English|DEMO|Supabase|JSON|AI|DELETE)$/;

describe("every interface strings file has Arabic and Urdu for every English string", () => {
  for (const f of STRING_FILES) {
    test(`${f.module}: ${f.file}`, () => {
      const en = leaves(f.get("en"));
      expect(en.length).toBeGreaterThan(0);
      for (const locale of ["ar", "ur"]) {
        const other = new Map(leaves(f.get(locale)));
        const untranslated = en
          .filter(([k, v]) => other.get(k) === v && !NEUTRAL.test(v) && !ENGLISH_ON_PURPOSE.some((r) => r.test(k)))
          .filter(([, v]) => /[a-z]{3}/.test(v.replace(/QITL|Supabase|JSON|README|Markdown|Google|Claude|LARA_\w+|ANTHROPIC_\w+|scripts\/[\w.-]+|docs\/[\w.]+|WCAG|DNA|Tanzil|Bukhari|Yusuf|Yousuf|Joseph|DELETE MY ACCOUNT|narration bucket|Q \d+:\d+/g, "")));
        expect(untranslated.map(([k]) => `${locale} ${k}`)).toEqual([]);
      }
    });
  }
});

describe("English content marking and API errors", () => {
  test("englishContent marks English only inside Arabic and Urdu", () => {
    expect(englishContent("en")).toEqual({});
    expect(englishContent("ar")).toEqual({ lang: "en", dir: "ltr" });
    expect(englishContent("ur")).toEqual({ lang: "en", dir: "ltr" });
  });
  test("API errors are shown by code in the interface language, never as English in Arabic or Urdu", () => {
    const body = { error: "Not found.", code: "not_found" };
    expect(apiErrorText("en", body)).toBe("Not found.");
    expect(apiErrorText("ur", body)).toBe("نہیں ملا۔");
    expect(apiErrorText("ar", { error: "Some new English message", code: "unknown_code" })).not.toMatch(/[A-Za-z]/);
    expect(apiErrorText("ar", { error: "x", code: "unknown_code" }, "بديل")).toBe("بديل");
  });
});

describe("language switch links", () => {
  test("keep the page, the query and the hash", () => {
    expect(langHref("ur", "/prophets/yusuf", "", "#places")).toBe("/ur/prophets/yusuf#places");
    expect(langHref("ar", "/ur/search", "?q=Yusuf", "")).toBe("/ar/search?q=Yusuf");
    expect(langHref("en", "/ar/quran/1", "", "#ayah-5")).toBe("/en/quran/1#ayah-5");
    expect(langHref("en", "/", "", "")).toBe("/en");
    expect(langHref("ur", "/", "?x=1", "#top")).toBe("/ur?x=1#top");
  });
});

describe("admin routes are in the language sweeps", () => {
  /** Every /admin page of the app, from the file tree. */
  function adminPages(dir: string, base = "/admin"): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...adminPages(path.join(dir, e.name), `${base}/${e.name}`));
      else if (e.name === "page.tsx") out.push(base);
    }
    return out;
  }
  test("every admin page is a route in tests/e2e/routes.ts, so i18n.spec.ts and responsive.spec.ts sweep it in en, ar and ur", () => {
    const pages = adminPages(path.join(process.cwd(), "src", "app", "[locale]", "admin"));
    expect(pages.length).toBeGreaterThan(25);
    const swept = new Set(ROUTES.filter((r) => r.startsWith("/admin")));
    expect(pages.filter((p) => !swept.has(p)).sort()).toEqual([]);
  });
});
