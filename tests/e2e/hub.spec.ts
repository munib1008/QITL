import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The five category hub pages: each lists exactly the sections the home index lists under that category (one table), links to
 * the other four, 404s for an unknown category, and works in English, Arabic and Urdu without overflow or axe violations.
 */
const GROUPS = ["quran", "stories", "learn", "knowledge", "community"] as const;
const LABEL: Record<(typeof GROUPS)[number], string> = { quran: "Quran", stories: "Stories & History", learn: "Learn & Reflect", knowledge: "Explore Knowledge", community: "Community" };

for (const g of GROUPS)
  test(`/hub/${g} lists the same sections as the home index heading "${LABEL[g]}"`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "one project drives every width");
    await page.goto("/");
    const fromHome = await page
      .getByTestId("explore-index")
      .locator("section", { has: page.locator(`h3 a[href="/hub/${g}"]`) })
      .locator("a.zq-index-link")
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(fromHome.length).toBeGreaterThan(1);
    await page.goto(`/hub/${g}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(LABEL[g]);
    const onHub = await page.getByTestId("hub-sections").locator("a.zq-index-link").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(onHub).toEqual(fromHome);
    expect(await page.getByTestId("hub-others").locator("a").count()).toBe(4);
  });

test("an unknown category is a 404", async ({ page }) => {
  const res = await page.goto("/hub/not-a-category");
  expect(res?.status()).toBe(404);
});

for (const prefix of ["", "/ar", "/ur"])
  test(`hub pages at 360 and 1440 on ${prefix || "/en"}: no overflow, no axe violations, right-to-left in Arabic and Urdu`, async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "one project drives every width");
    test.setTimeout(120_000);
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${prefix}/hub/learn`);
      await expect(page.getByTestId("hub-page")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), `${prefix}/hub/learn @${width}`).toEqual([]);
    }
    if (prefix) await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
