import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Life Guidance without a database (local dev): designed empty states, the notices and the safety guidance. */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test("/guidance: notice, empty state, planned topics and the mufti link", async ({ page }) => {
  await page.goto("/guidance");
  await expect(page.getByRole("heading", { level: 1, name: "What are you facing today?" })).toBeVisible();
  await expect(page.getByTestId("guidance-notice")).toContainText("not a personal ruling or therapy");
  await expect(page.getByTestId("empty-state")).toContainText("Life Guidance is not connected yet.");
  const planned = page.getByTestId("planned-topics");
  await expect(planned.getByRole("link")).toHaveCount(10);
  await expect(planned.getByRole("link", { name: /Feeling overwhelmed/ })).toContainText("In preparation");
  await expect(page.getByTestId("ask-mufti")).toHaveAttribute("href", "/community/questions");
  // No lesson text, verses or advice before anything is published.
  await expect(page.locator("[data-layer]")).toHaveCount(0);
});

test("distress topic page shows the medical / mental-health recommendation and crisis line", async ({ page }) => {
  await page.goto("/guidance");
  await page.getByTestId("planned-topics").getByRole("link", { name: /Feeling overwhelmed/ }).click();
  await expect(page).toHaveURL(/\/guidance\/feeling-overwhelmed$/);
  const safety = page.getByTestId("safety-notice");
  await expect(safety).toBeVisible();
  await expect(safety).toContainText("mental-health professional");
  await expect(safety).toContainText("local emergency services");
  // The Quran-only AI draft (content/guidance/feeling-overwhelmed.draft.json) stands in for the lesson until one is reviewed.
  const draft = page.getByTestId("guidance-draft");
  await expect(draft).toBeVisible();
  await expect(draft.getByTestId("verification-badge")).toContainText("AI-Assisted Draft");
  expect(await draft.locator("[data-field]").count()).toBe(5);
  await expect(draft.getByText("not counselling or medical care").first()).toBeVisible();
  await expect(page.getByTestId("ask-mufti")).toBeVisible();
});

test("non-distress topic page has no safety block; unknown topics are 404", async ({ page }) => {
  await page.goto("/guidance/anger-and-conflict");
  await expect(page.getByRole("heading", { level: 1, name: "Anger and conflict" })).toBeVisible();
  await expect(page.getByTestId("safety-notice")).toHaveCount(0);
  await expect(page.getByTestId("guidance-notice")).toBeVisible();
  const res = await page.goto("/guidance/not-a-topic");
  expect(res?.status()).toBe(404);
});

test("Arabic: right to left, Arabic titles and safety text", async ({ page }) => {
  await page.goto("/ar/guidance/grief-and-loss");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "الحزن والفقد" })).toBeVisible();
  await expect(page.getByTestId("safety-notice")).toContainText("خدمات الطوارئ المحلية");
});

test("Life Guidance is listed in the Explore sheet", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "the Explore sheet is the phone navigation");
  await page.goto("/guidance");
  await page.locator("[data-bottom-nav]").getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: /Life Guidance/ })).toBeVisible();
});

for (const path of ["/guidance", "/guidance/feeling-overwhelmed", "/ar/guidance", "/ar/guidance/illness-and-hardship"]) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

test("no horizontal scroll at 320px on a topic page", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/guidance", "/guidance/financial-difficulty", "/ar/guidance/feeling-guilty"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
