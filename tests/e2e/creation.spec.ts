import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Creation Atlas (عالم الخلق). The test build has no database, so every view must show its designed empty state:
 * no placeholder facts, the not-established sentence in every comparison cell, and the health caution.
 */

const NE = "Not established by the selected authentic sources.";
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

// Axe runs and reloads are slow when the whole suite shares one production server.
test.describe.configure({ timeout: 120_000 });

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("home: introduction, six categories, comparison empty states, caution and sources", async ({ page }) => {
  const res = await page.goto("/creation");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /Creation Atlas/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About this atlas" })).toBeVisible();
  await expect(page.getByTestId("creation-categories").locator("[data-category]")).toHaveCount(6);
  const cells = page.getByTestId("creation-compare").locator("[data-cell]");
  await expect(cells).toHaveCount(18);
  for (const c of await cells.all()) await expect(c).toContainText(NE);
  await expect(page.getByTestId("creation-caution")).toContainText("anxiety, nightmares");
  await expect(page.getByText("No relationships are published yet.")).toBeVisible();
  await expect(page.getByText("No stories are published yet.")).toBeVisible();
  await expect(page.getByText("No questions are published yet.")).toBeVisible();
  await expect(page.getByTestId("creation-sources")).toContainText("No sources yet");
  await expect(page.getByText("The Creation Atlas is not connected yet.")).toBeVisible();
  await axe(page);
});

test("home: kids mode changes the wording, keeps the evidence, and is remembered", async ({ page }) => {
  await page.goto("/creation");
  const btn = page.getByRole("button", { name: "Kids mode" });
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-row="origin"] th')).toHaveText("Origin", { useInnerText: true });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-row="origin"] th')).toHaveText("Where they came from", { useInnerText: true });
  await expect(page.getByTestId("creation-compare").locator("[data-cell]").first()).toContainText(NE);
  await axe(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Kids mode" })).toHaveAttribute("aria-pressed", "true");
});

test("home: the abstract visual can be paused and replayed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/creation");
  const fig = page.locator(".cr-visual").first();
  await expect(fig).toHaveAttribute("data-playing", "false");
  await fig.getByRole("button", { name: "Play", exact: true }).click();
  await expect(fig).toHaveAttribute("data-playing", "true");
  await fig.getByRole("button", { name: "Pause" }).click();
  await expect(fig).toHaveAttribute("data-playing", "false");
  await fig.getByRole("button", { name: "Replay" }).click();
  await expect(fig).toHaveAttribute("data-playing", "true");
});

test("Arabic home is right-to-left with the Arabic sentence and no axe violations", async ({ page }) => {
  await page.goto("/ar/creation");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: /عالم الخلق/ })).toBeVisible();
  await expect(page.getByTestId("creation-compare").locator("[data-cell]").first()).toContainText("لم يثبت في المصادر الصحيحة المختارة.");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await axe(page);
});

test("profile page without a database shows the designed unavailable state", async ({ page }) => {
  const res = await page.goto("/creation/jinn");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("The Creation Atlas is not connected yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Creation Atlas" }).first()).toBeVisible();
  await axe(page);
});

test("profile addresses outside the slug rule are not found", async ({ page }) => {
  const res = await page.goto("/creation/Not_A_Slug");
  expect(res?.status()).toBe(404);
});

test("the Explore sheet lists the Creation Atlas", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/creation");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Explore" }).click();
  const dlg = page.getByRole("dialog", { name: "Explore QITL" });
  await expect(dlg.getByRole("link", { name: /Creation Atlas/ })).toBeVisible();
});

test("at 320px nothing scrolls sideways and the comparison stacks", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/creation");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(".cr-cell-label").first()).toBeVisible();
  const btn = await page.getByRole("button", { name: "Kids mode" }).boundingBox();
  expect(btn!.height).toBeGreaterThanOrEqual(44);
});
