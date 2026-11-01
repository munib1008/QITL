import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { exploreLinks } from "@/lib/nav";
import {
  applyNav,
  cleanText,
  cleanTextValue,
  EMPTY_CONFIG,
  isLocked,
  MODULE_FLAG_RE,
  moduleFlagKey,
  ORDER_KEY,
  parseSiteConfig,
  siteText,
  TEXT_KEYS,
  type TextKey,
} from "@/lib/site-config/config";
import { SiteEditInput } from "@/lib/site-config/input";
import { ApplyInput, DecideApplicationInput, MarkReadInput } from "@/lib/mufti-apply";

vi.mock("server-only", () => ({}));

const line = { max: 20, multiline: false };
const para = { max: 200, multiline: true };

describe("cleanText: plain text and the small Markdown subset only", () => {
  test("trims, normalises and accepts ordinary text in every script", () => {
    expect(cleanText("  Hello   world  ", line)).toEqual({ ok: true, value: "Hello world" });
    expect(cleanText("مرحبا بالعالم", line)).toEqual({ ok: true, value: "مرحبا بالعالم" });
    expect(cleanText("ہیلو دنیا", line)).toEqual({ ok: true, value: "ہیلو دنیا" });
    expect(cleanText("3 < 5 and 7 > 2", line).ok).toBe(true); // a comparison is not markup
  });
  test("refuses HTML, script, control characters, empty and too long, instead of stripping them", () => {
    for (const bad of ["<b>x</b>", "<script>alert(1)</script>", "a <img src=x onerror=1>", "<!-- c -->", "</p>"]) expect(cleanText(bad, para)).toEqual({ ok: false, problem: "html" });
    expect(cleanText("bell\u0007", line)).toEqual({ ok: false, problem: "control" });
    expect(cleanText("   ", line)).toEqual({ ok: false, problem: "empty" });
    expect(cleanText("x".repeat(21), line)).toEqual({ ok: false, problem: "too_long" });
    expect(cleanText("two\nlines", line)).toEqual({ ok: false, problem: "newline" });
    expect(cleanText("one\n\n\n\ntwo", para)).toEqual({ ok: true, value: "one\n\ntwo" });
  });
  test("Markdown links go through the existing safeHref: same-site paths and https only", () => {
    expect(cleanText("[ok](/methodology) and [ext](https://example.org/x)", para).ok).toBe(true);
    for (const bad of ["[x](javascript:alert(1))", "[x](data:text/html,1)", "[x](//evil.test)", "[x](/\\evil.test)", "[x](http://plain.test)", "[x](vbscript:1)"])
      expect(cleanText(bad, para)).toEqual({ ok: false, problem: "link" });
  });
  test("cleanTextValue drops empty languages and reports the first problem with its language", () => {
    expect(cleanTextValue("home.hero.title", { en: "A title", ar: "  ", ur: "" })).toEqual({ ok: true, value: { en: "A title" } });
    expect(cleanTextValue("home.hero.title", { en: "A title", ar: "<b>x</b>" })).toEqual({ ok: false, lang: "ar", problem: "html" });
    expect(cleanTextValue("home.hero.title", { en: "x".repeat(121) })).toEqual({ ok: false, lang: "en", problem: "too_long" });
    expect(cleanTextValue("home.hero.title", {})).toEqual({ ok: true, value: {} });
  });
});

describe("the configuration a page reads", () => {
  test("without edits nothing changes: the built-in text and the full menu", () => {
    expect(siteText(EMPTY_CONFIG, "home.hero.title", "en", "Built in")).toBe("Built in");
    const links = exploreLinks("en");
    expect(applyNav(links, EMPTY_CONFIG)).toEqual(links);
  });
  test("a language the administrator did not write falls back to the built-in text of that language, not to English", () => {
    const cfg = parseSiteConfig([{ key: "home.hero.title", value: { en: "Edited" } }], []);
    expect(siteText(cfg, "home.hero.title", "en", "Built in")).toBe("Edited");
    expect(siteText(cfg, "home.hero.title", "ar", "مدمج")).toBe("مدمج");
    expect(siteText(cfg, "home.hero.title", "ur", "بنا بنایا")).toBe("بنا بنایا");
  });
  test("malformed or unsafe rows are ignored, never rendered", () => {
    const cfg = parseSiteConfig(
      [
        { key: "home.hero.title", value: { en: "<script>x</script>", ar: 5, ur: "ٹھیک" } },
        { key: "home.hero.lead", value: "not an object" },
        { key: "unknown.key", value: { en: "x" } },
        { key: ORDER_KEY, value: { hrefs: ["/stories", 4, "https://evil.test", "//x", "/prophets"] } },
      ],
      [
        { key: "module.stories", enabled: false },
        { key: "module.Bad", enabled: false },
        { key: "accounts", enabled: false },
        { key: "module.events", enabled: true },
      ],
    );
    expect(cfg.text["home.hero.title"]).toEqual({ ur: "ٹھیک" });
    expect(cfg.text["home.hero.lead"]).toBeUndefined();
    expect(cfg.order).toEqual(["/stories", "/prophets"]);
    expect(cfg.hidden).toEqual(["module.stories"]);
  });
  test("hiding removes a section from the menu; reordering puts listed sections first; unlisted keep their order", () => {
    const links = exploreLinks("en");
    const hiddenHref = "/stories";
    const cfg = parseSiteConfig([{ key: ORDER_KEY, value: { hrefs: ["/hadith", "/prophets"] } }], [{ key: moduleFlagKey(hiddenHref), enabled: false }]);
    const out = applyNav(links, cfg).map((l) => l.href);
    expect(out).not.toContain(hiddenHref);
    expect(out.slice(0, 2)).toEqual(["/hadith", "/prophets"]);
    const rest = out.slice(2);
    expect(rest).toEqual(links.map((l) => l.href).filter((h) => h !== hiddenHref && h !== "/hadith" && h !== "/prophets"));
  });
  test("the Quran, search and the timeline can never be hidden, whatever a flag says", () => {
    const links = exploreLinks("en");
    const flags = ["/quran", "/search", "/timeline"].map((h) => ({ key: moduleFlagKey(h), enabled: false }));
    const out = applyNav(links, parseSiteConfig([], flags)).map((l) => l.href);
    expect(out).toContain("/quran");
    expect(out).toContain("/search");
    expect(isLocked("/timeline")).toBe(true);
  });
  test("every Explore section has a valid, unique flag key", () => {
    const keys = exploreLinks("en").map((l) => moduleFlagKey(l.href));
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(MODULE_FLAG_RE);
    expect(moduleFlagKey("/community/questions")).toBe("module.community_questions");
    expect(moduleFlagKey("/life-through-ages")).toBe("module.life_through_ages");
  });
});

describe("the TypeScript limits match the migration", () => {
  const sql = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "20261031002620_site_config.sql"), "utf8");
  test("same keys and same maximum lengths as validate_site_setting", () => {
    const fromSql = new Map<string, number>();
    for (const m of sql.matchAll(/when '(home\.[a-z.]+)' then (\d+)/g)) fromSql.set(m[1]!, Number(m[2]));
    const fromTs = new Map(Object.entries(TEXT_KEYS).map(([k, v]) => [k, v.max]));
    expect(fromSql).toEqual(fromTs);
    expect(sql).toContain("when 'home.intro.body'".replace("when ", "k <> ")); // only the intro body may span lines
    for (const [k, v] of Object.entries(TEXT_KEYS)) expect(v.multiline).toBe(k === "home.intro.body");
    expect(sql).toContain(`'${ORDER_KEY}'`);
  });
});

describe("request schemas", () => {
  const note = "Fixture revision note";
  test("site edits: a note is required and sizes are bounded", () => {
    expect(SiteEditInput.safeParse({ action: "text", key: "home.hero.title", value: { en: "x" }, note }).success).toBe(true);
    expect(SiteEditInput.safeParse({ action: "text", key: "home.hero.title", value: { en: "x" }, note: "no" }).success).toBe(false);
    expect(SiteEditInput.safeParse({ action: "text", key: "home.secret", value: {}, note }).success).toBe(false);
    expect(SiteEditInput.safeParse({ action: "nav", hrefs: ["/stories"], hidden: [], note }).success).toBe(true);
    expect(SiteEditInput.safeParse({ action: "nav", hrefs: ["https://evil.test"], hidden: [], note }).success).toBe(false);
    expect(SiteEditInput.safeParse({ action: "revert", kind: "flag", key: "module.stories", version: 1, note }).success).toBe(true);
    expect(SiteEditInput.safeParse({ action: "revert", kind: "flag", key: "module.stories", version: 0, note }).success).toBe(false);
    expect(SiteEditInput.safeParse({ action: "delete", key: "x" }).success).toBe(false);
  });
  test("scholar application: consent is required, links are https and at most five, no extra fields", () => {
    const ok = { name: "Fixture Name", credentials: "Fixture credentials, long enough here.", consent: true as const };
    expect(ApplyInput.safeParse(ok).success).toBe(true);
    expect(ApplyInput.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(ApplyInput.safeParse({ name: ok.name, credentials: ok.credentials }).success).toBe(false);
    expect(ApplyInput.safeParse({ ...ok, links: ["http://plain.test/x"] }).success).toBe(false);
    expect(ApplyInput.safeParse({ ...ok, links: ["javascript:alert(1)"] }).success).toBe(false);
    expect(ApplyInput.safeParse({ ...ok, links: Array.from({ length: 6 }, (_, i) => `https://example.test/${i}`) }).success).toBe(false);
    expect(ApplyInput.safeParse({ ...ok, links: ["https://example.test/a"], madhhab: "hanafi", field: "Fixture field" }).success).toBe(true);
    expect(ApplyInput.safeParse({ ...ok, status: "verified" }).success).toBe(false); // an applicant cannot send a status
    expect(ApplyInput.safeParse({ ...ok, role: "mufti" }).success).toBe(false);
  });
  test("deciding: only the three forward statuses, a note for a decision; marking read: ids xor all", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(DecideApplicationInput.safeParse({ id, status: "under_review" }).success).toBe(true);
    expect(DecideApplicationInput.safeParse({ id, status: "verified" }).success).toBe(false);
    expect(DecideApplicationInput.safeParse({ id, status: "verified", note: "Credentials checked" }).success).toBe(true);
    expect(DecideApplicationInput.safeParse({ id, status: "submitted" }).success).toBe(false);
    expect(MarkReadInput.safeParse({ all: true }).success).toBe(true);
    expect(MarkReadInput.safeParse({ ids: [id] }).success).toBe(true);
    expect(MarkReadInput.safeParse({ ids: [id], all: true }).success).toBe(false);
    expect(MarkReadInput.safeParse({}).success).toBe(false);
  });
});

test("TextKey list is the same set the editor shows", () => {
  const keys: TextKey[] = Object.keys(TEXT_KEYS) as TextKey[];
  expect(keys.length).toBe(6);
});
