import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Interpretation Explorer: the per-ayah Study panel on /quran/1 and /quran/12, as a bottom sheet at 360px and a docked
 * side panel at 1440px. Runs with or without the imported Arabic and without the database (every tab then shows its
 * designed "not imported / not connected" state).
 */

async function openStudy(page: Page, surah: number) {
  await page.goto(`/quran/${surah}`);
  const perAyah = page.locator(".qs-study-btn").first();
  await expect(perAyah).toBeVisible();
  await perAyah.click();
  return perAyah;
}

async function axe(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

for (const surah of [1, 12]) {
  test.describe(`Study sheet on /quran/${surah} at 360px`, () => {
    test.use({ viewport: { width: 360, height: 780 } });

    test("opens as a modal bottom sheet: Arabic on top, tabs, actions; Esc closes and focus returns", async ({ page }) => {
      const opener = await openStudy(page, surah);
      const sheet = page.getByRole("dialog", { name: new RegExp(`Study Q ${surah}:1`) });
      await expect(sheet).toBeVisible();
      const box = (await sheet.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
      // The Arabic block comes before (above) the tabs and nothing is laid over it.
      const arabic = (await sheet.locator("[data-study-arabic]").boundingBox())!;
      const tabs = (await sheet.getByRole("tablist").boundingBox())!;
      expect(arabic.y + arabic.height).toBeLessThanOrEqual(tabs.y + 1);
      await expect(sheet.getByRole("tab")).toHaveCount(7);
      await expect(sheet.getByRole("tab", { name: "Translations" })).toHaveAttribute("aria-selected", "true");
      await expect(sheet.locator('[data-slot="early-tafsir"]')).toContainText("Commentary, not a translation");
      await expect(sheet.locator('[data-slot="early-tafsir"]')).toContainText(/Not imported|Licence pending|Edition not verified|Licensed/);
      // No page-level horizontal scroll at 320–360px.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      await axe(page);

      await sheet.getByRole("tab", { name: "Differences explained" }).click();
      await expect(sheet.getByRole("tabpanel")).toHaveAttribute("data-tab", "differences");
      await sheet.getByRole("tab", { name: "Differences explained" }).press("ArrowRight");
      await expect(sheet.getByRole("tab", { name: "Tafsir comparison" })).toBeFocused();
      await expect(sheet.getByRole("group", { name: "Study actions" })).toContainText("Ask a Mufti");

      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(opener).toBeFocused();
    });
  });

  test.describe(`Study panel on /quran/${surah} at 1440px`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("docks beside the reader without covering it, and passes axe", async ({ page }) => {
      await openStudy(page, surah);
      const panel = page.locator('[data-study-panel="side"]');
      await expect(panel).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(panel.getByRole("heading", { name: new RegExp(`Study Q ${surah}:1`) })).toBeFocused();
      const side = (await panel.boundingBox())!;
      const main = (await page.locator(".qs-main").boundingBox())!;
      expect(main.x + main.width).toBeLessThanOrEqual(side.x + 1);
      const arabic = (await panel.locator("[data-study-arabic]").boundingBox())!;
      const tabs = (await panel.getByRole("tablist").boundingBox())!;
      expect(arabic.y + arabic.height).toBeLessThanOrEqual(tabs.y + 1);
      await axe(page);

      await panel.getByRole("tab", { name: "QITL summary" }).click();
      await expect(panel.getByRole("tabpanel")).toContainText(/QITL summary|not connected|No QITL summary/);
      await panel.getByRole("button", { name: "Report an error" }).click();
      await expect(panel.getByLabel("What is wrong?")).toBeVisible();
      await axe(page);
      await panel.getByRole("button", { name: "Close" }).click();
      await expect(panel).toBeHidden();
    });
  });
}

test("the study data endpoint answers without the database and never invents text", async ({ request }) => {
  const r = await request.get("/api/quran/12/1/study");
  expect(r.ok()).toBe(true);
  const d = (await r.json()) as { ref: { surah: number; ayah: number }; translations: Array<{ state: string; text: string | null }> };
  expect(d.ref).toEqual({ surah: 12, ayah: 1 });
  for (const t of d.translations) if (t.state !== "shown") expect(t.text).toBeNull();
  expect((await request.get("/api/quran/115/1/study")).status()).toBe(404);
});

test("the public hadith catalogue lists exactly four collections", async ({ page }) => {
  await page.goto("/hadith");
  for (const name of ["Sahih al-Bukhari", "Sahih Muslim", "Jami' at-Tirmidhi", "Sunan Ibn Majah"]) await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sunan Abi Dawud" })).toHaveCount(0);
  expect((await page.goto("/hadith/abudawud"))!.status()).toBe(404);
});
