import { expect, test } from "@playwright/test";

/**
 * Related knowledge on the Quran reader: an ayah links to the story drafts whose chapters cite it, and the link leads to the
 * labelled draft. (The e2e build has no database, so every draft in the generated index is offered.)
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every page");

test("an ayah of Surat Yusuf links to the Yusuf draft, labelled as a draft", async ({ page }) => {
  await page.goto("/quran/12");
  const link = page.locator('#ayah-4 a[href="/drafts/yusuf"]');
  await expect(link).toHaveCount(1);
  await expect(link).toContainText("Draft");
  await link.click();
  await expect(page).toHaveURL(/\/drafts\/yusuf$/);
  await expect(page.getByTestId("draft-banner")).toBeVisible();
});

test("no ayah lists more than three related drafts", async ({ page }) => {
  await page.goto("/quran/2");
  const counts = await page.locator("li.zq-ayah").evaluateAll((els) => els.map((e) => e.querySelectorAll('a[href^="/drafts/"]').length));
  expect(Math.max(...counts)).toBeLessThanOrEqual(3);
});
