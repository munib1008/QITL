import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * /verification: what each label means, with the eight badges rendered by the shared component, honest offline counts,
 * a draft page that links here, and axe at 360 and 1440 px in English, Arabic and Urdu.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width");

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

test("shows the eight states as text badges and says Verified needs a real reviewer", async ({ page }) => {
  await page.goto("/verification");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("How QITL labels its content");
  await expect(page.getByTestId("verification-badge")).toHaveCount(8);
  for (const label of ["Verified", "Pending Verification", "AI-Assisted Draft", "Historical Estimate", "Scholarly Disagreement", "Source Unavailable", "Rejected", "Withdrawn"])
    await expect(page.locator(".vf-badge", { hasText: label }).first()).toBeVisible();
  await expect(page.getByText("appointed and qualified reviewer").first()).toBeVisible();
  // no database in the e2e build: the counts are not invented
  await expect(page.getByTestId("verification-offline")).toBeVisible();
  await expect(page.getByTestId("verification-counts")).toHaveCount(0);
});

test("a draft page links to the explanation", async ({ page }) => {
  await page.goto("/drafts/adam");
  await expect(page.getByTestId("draft-banner").getByRole("link", { name: "What does this mean?" })).toHaveAttribute("href", /\/verification$/);
});

for (const prefix of ["", "/ar", "/ur"])
  test(`axe and no overflow: ${prefix || "/en"}/verification at 360 and 1440`, async ({ page }) => {
    test.setTimeout(120_000);
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${prefix}/verification`);
      await expect(page.getByTestId("verification-badge").first()).toBeVisible();
      expect(await axe(page), `${prefix}/verification @${width}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    if (prefix) await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
