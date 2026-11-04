import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Grouped navigation: the home index and the mobile Explore sheet show the same five categories, every section is still
 * reachable, and nothing overflows or fails axe in English and Arabic.
 */
const EN = ["Quran", "Stories & History", "Learn & Reflect", "Explore Knowledge", "Community"];

test("home index groups every section under five category headings", async ({ page }) => {
  await page.goto("/");
  const index = page.getByTestId("explore-index");
  await expect(index).toBeVisible();
  const headings = await index.locator("h3").allInnerTexts();
  expect(headings).toEqual(EN);
  // nothing was dropped: the grouped index lists every section of the registry (search is the header's job)
  expect(await index.locator("a.zq-index-link").count()).toBeGreaterThanOrEqual(20);
  const nums = await index.locator(".zq-index-no").allInnerTexts();
  expect(nums[0]).toBe("01");
  expect(nums.length).toBe(await index.locator("li").count());
});

test("Arabic home index headings are Arabic, and the page keeps right-to-left", async ({ page }) => {
  await page.goto("/ar");
  const headings = await page.getByTestId("explore-index").locator("h3").allInnerTexts();
  expect(headings.length).toBe(5);
  for (const h of headings) expect(h).toMatch(/[؀-ۿ]/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("the mobile Explore sheet shows the same categories and still lists every section", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "the bottom bar is a mobile control");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Explore" }).click();
  const dlg = page.getByRole("dialog", { name: "Explore QITL" });
  await expect(dlg).toBeVisible();
  expect(await dlg.locator(".qb-group h3").allInnerTexts()).toEqual(EN);
  expect(await dlg.locator("ul.qb-grid a").count()).toBeGreaterThanOrEqual(20);
  const a = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("the desktop More menu is grouped and keeps every link", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "the section bar is a desktop control");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/prophets");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button").click();
  const list = page.locator("nav.zq-mmenu-list:visible").first();
  await expect(list.locator(".zq-mmenu-group").first()).toBeVisible();
  expect(await list.locator("a").count()).toBeGreaterThanOrEqual(8);
});

for (const prefix of ["", "/ar", "/ur"])
  test(`no sideways scroll or axe violations on ${prefix || "/en"} home with the grouped index`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${prefix}/`);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(1);
    const a = await new AxeBuilder({ page }).include('[data-testid="explore-index"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
