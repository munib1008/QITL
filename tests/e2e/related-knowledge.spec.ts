import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Related Knowledge: pages whose content cites Quran ayat list the other pages that cite the same ayat (one shared evidence
 * graph). Each entry names its kind and how many ayat it shares, links to a real page, and the panel is accessible.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every page");

const PAGES = ["/drafts/yusuf", "/creation/human-beings", "/guidance/grief-and-loss", "/life-through-ages/prophets/yusuf"];

for (const path of PAGES)
  test(`${path} lists pages that cite the same verses, each with a kind and a shared-ayat count`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    const panel = page.getByTestId("related-knowledge");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Linked only because both cite the same ayat");
    const items = panel.getByTestId("related-knowledge-list").locator("li");
    expect(await items.count()).toBeGreaterThan(0);
    expect(await items.count()).toBeLessThanOrEqual(6);
    for (const li of await items.all()) await expect(li).toContainText(/shares \d+ ayah?t?s?|shares 1 ayah/);
    const href = await items.first().locator("a").getAttribute("href");
    const target = await page.request.get(href!);
    expect(target.status(), href!).toBe(200);
    const a = await new AxeBuilder({ page }).include('[data-testid="related-knowledge"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(a.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

test("the panel is translated in Arabic and Urdu and keeps right-to-left", async ({ page }) => {
  for (const [prefix, word] of [["/ar", "تستشهد"], ["/ur", "آیات"]] as const) {
    await page.goto(`${prefix}/drafts/yusuf`);
    await expect(page.getByTestId("related-knowledge").locator("h2")).toContainText(word);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  }
});
