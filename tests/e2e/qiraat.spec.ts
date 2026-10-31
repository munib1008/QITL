import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Qira'at & Ahruf Learning Centre with no database (the e2e build has none): the hub shows the referenced narrations
 * in the licence-pending style, the draft distinction panel and the designed empty states; the comparison view
 * explains why nothing is shown; the Quran reader always shows its riwayah. Axe at 360px and 1440px.
 */
const axe = async (page: Page) => {
  const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
};
const noSideways = async (page: Page) => {
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways).toBeLessThanOrEqual(1);
};

for (const width of [360, 1440]) {
  test.describe(`qira'at at ${width}px`, () => {
    test.skip(() => test.info().project.name !== "desktop", "one project drives both widths");
    test.use({ viewport: { width, height: width < 600 ? 780 : 900 } });

    test("/qiraat: narrations as references, draft distinction, designed empty states", async ({ page }) => {
      const res = await page.goto("/qiraat");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Seven Ahruf and the ten Qira'at" })).toBeVisible();
      const refs = page.getByTestId("ahruf-refs");
      await expect(refs.getByRole("link", { name: "Sahih al-Bukhari 4991" })).toHaveAttribute("href", /\/hadith\/bukhari\/4991$/);
      await expect(refs.getByRole("link", { name: "Sahih al-Bukhari 4992" })).toBeVisible();
      await expect(refs.getByRole("link", { name: "Sahih Muslim 818" })).toBeVisible();
      await expect(refs.getByText("Text unavailable — licence pending")).toHaveCount(3);
      const panel = page.getByTestId("distinction-panel");
      await expect(panel).toContainText("Draft — pending scholarly review");
      await expect(panel).toContainText("not simply seven tribal dialects");
      await expect(page.getByTestId("readers-empty")).toContainText("not published yet");
      await expect(page.getByTestId("available-now")).toContainText("Tanzil");
      await expect(page.getByTestId("not-licensed")).toContainText("No other riwayah");
      await expect(page.getByTestId("misconceptions-empty")).toBeVisible();
      await noSideways(page);
      await axe(page);
    });

    test("/qiraat/compare: designed empty state explaining why nothing is shown", async ({ page }) => {
      const res = await page.goto("/qiraat/compare");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Compare readings" })).toBeVisible();
      const empty = page.getByTestId("compare-empty");
      await expect(empty).toContainText("No comparison can be shown yet.");
      await expect(empty).toContainText("licences allow display");
      await expect(page.getByTestId("variants")).toHaveCount(0);
      await noSideways(page);
      await axe(page);
    });

    test("the Quran reader shows its riwayah, the unavailable riwayat and no audio controls", async ({ page }) => {
      const res = await page.goto("/quran/1");
      expect(res?.status()).toBe(200);
      const ind = page.getByTestId("riwayah-indicator");
      await expect(ind).toBeVisible();
      await expect(page.getByTestId("riwayah-current")).toHaveText("Hafs 'an 'Asim — Tanzil Uthmani v1.1");
      await page.getByTestId("riwayah-selector").locator("summary").click();
      const others = page.getByTestId("riwayah-selector").locator('li[data-available="false"]');
      await expect(others).toHaveCount(19);
      await expect(others.filter({ hasText: "Warsh 'an Nafi'" })).toContainText("not available: edition and licence not secured");
      await expect(page.getByTestId("riwayah-audio-none")).toHaveText("No approved recitation for this riwayah yet.");
      await expect(ind.locator("audio")).toHaveCount(0);
      await noSideways(page);
      await axe(page);
    });
  });
}

test("the Arabic reader and hub carry the module", async ({ page }) => {
  await page.goto("/ar/quran/2");
  await expect(page.getByTestId("riwayah-current")).toContainText("حفص");
  await page.goto("/ar/qiraat");
  await expect(page.getByRole("heading", { level: 1, name: "الأحرف السبعة والقراءات العشر" })).toBeVisible();
});
