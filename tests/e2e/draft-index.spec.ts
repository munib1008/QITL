import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The people, communities and events index pages list the public AI-assisted story drafts of their type (the e2e build has
 * no database, so every draft in the generated index is listed), each linking to the labelled draft. The counts come from
 * src/generated/story-drafts.json, not from this file.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every page");

const idx = JSON.parse(readFileSync(join(process.cwd(), "src", "generated", "story-drafts.json"), "utf8")) as { stories: Array<{ type: string }> };
const draftCount = async (type: string) => idx.stories.filter((s) => s.type === type).length;

test("/people lists every person draft under the AI-Assisted Draft badge", async ({ page }) => {
  await page.goto("/people");
  const sec = page.getByTestId("ai-draft-index");
  await expect(sec).toBeVisible();
  await expect(sec.getByTestId("verification-badge")).toContainText("AI-Assisted Draft");
  expect(await sec.getByTestId("ai-draft-index-list").locator("li").count()).toBe(await draftCount("person"));
  await expect(sec.locator('a[href$="/drafts/maryam"]')).toBeVisible();
});

test("/communities lists every community draft", async ({ page }) => {
  await page.goto("/communities");
  expect(await page.getByTestId("ai-draft-index-list").locator("li").count()).toBe(await draftCount("community"));
});

test("/events lists event, parable and Seerah drafts in separate groups", async ({ page }) => {
  await page.goto("/events");
  const total = (await draftCount("event")) + (await draftCount("parable")) + (await draftCount("seerah"));
  const lists = page.getByTestId("ai-draft-index-list");
  expect(await lists.count()).toBe(3);
  let n = 0;
  for (let i = 0; i < 3; i++) n += await lists.nth(i).locator("li").count();
  expect(n).toBe(total);
  await page.locator('a[href$="/drafts/the-flood"]').first().click();
  await expect(page).toHaveURL(/\/drafts\/the-flood$/);
  await expect(page.getByTestId("draft-banner")).toBeVisible();
});
