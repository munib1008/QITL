import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Mushaf page and juz views: the verbatim Tanzil Arabic of every ayah of a division, grouped by surah, boundaries from
 * the imported reading divisions, previous / next navigation, an unknown number is a 404, links from the reader's
 * markers, and axe at 360 and 1440 px in English, Arabic and Urdu. One project drives every width.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width");

const quranTxt = readFileSync(join(process.cwd(), "content", "quran", "quran.txt"), "utf8");
const ayah = (s: number, a: number) => quranTxt.split("\n").find((l) => l.startsWith(`${s}|${a}|`))!.slice(`${s}|${a}|`.length).replace(/\r$/, "");

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

test("page 1 is Al-Fatihah verbatim, with next but no previous", async ({ page }) => {
  await page.goto("/quran/page/1");
  const first = page.getByTestId("division-surah").first();
  await expect(first).toBeVisible();
  const text = (await first.getByTestId("division-text").innerText()).replace(/\s+/g, " ");
  expect(text).toContain(ayah(1, 1).replace(/\s+/g, " ").slice(0, 20));
  expect(text).toContain(ayah(1, 7).replace(/\s+/g, " ").slice(-10));
  const nav = page.getByTestId("division-nav");
  await expect(nav.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/quran/page/2");
  await expect(nav.getByRole("link", { name: "Previous" })).toHaveCount(0);
});

test("juz 30 ends with Al-Nas and has no next", async ({ page }) => {
  await page.goto("/quran/juz/30");
  await expect(page.getByTestId("division-surah").last().getByRole("link").first()).toHaveAttribute("href", /\/quran\/114$/);
  const nav = page.getByTestId("division-nav");
  await expect(nav.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/quran/juz/29");
  await expect(nav.getByRole("link", { name: "Next" })).toHaveCount(0);
});

test("an unknown page or juz is a 404", async ({ page }) => {
  for (const path of ["/quran/page/0", "/quran/page/605", "/quran/page/abc", "/quran/juz/31", "/quran/juz/1.5"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});

test("the reader's page and juz markers open the division views", async ({ page }) => {
  await page.goto("/quran/2");
  await expect(page.locator('.qr-marker[data-kind="juz"] a').first()).toHaveAttribute("href", /\/quran\/juz\/\d+$/);
  await expect(page.locator('.qr-marker[data-kind="page"] a').first()).toHaveAttribute("href", /\/quran\/page\/\d+$/);
});

for (const prefix of ["", "/ar", "/ur"])
  for (const path of ["/quran/page/2", "/quran/juz/1"])
    test(`axe and no overflow: ${prefix || "/en"}${path} at 360 and 1440`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${prefix}${path}`);
        await expect(page.getByTestId("division-surah").first()).toBeVisible();
        expect(await axe(page), `${prefix}${path} @${width}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      if (prefix) await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    });
