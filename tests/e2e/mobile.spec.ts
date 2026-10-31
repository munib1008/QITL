import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Mobile interactions at 360px: bottom navigation, Explore sheet, timeline stops, chapter progress, Arabic layout. */
test.use({ viewport: { width: 360, height: 780 } });

test("bottom navigation: five labelled destinations, current page marked, hidden on desktop widths", async ({ page }) => {
  await page.goto("/timeline");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  for (const name of ["Home", "Timeline", "Quran", "Explore", "Profile"]) await expect(nav.getByRole(name === "Explore" ? "button" : "link", { name })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
  for (const el of await nav.locator(".qb-item").all()) {
    const b = (await el.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("link", { name: "Quran" }).click();
  await expect(page).toHaveURL(/\/quran$/);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(nav).toBeHidden();
});

test("Explore sheet is a modal dialog: focus moves in, Esc closes and focus returns, links navigate", async ({ page }) => {
  await page.goto("/");
  const btn = page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Explore" });
  await btn.click();
  const dlg = page.getByRole("dialog", { name: "Explore QITL" });
  await expect(dlg).toBeVisible();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await expect(dlg.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expect(btn).toBeFocused();
  await btn.click();
  await dlg.getByRole("link", { name: /Events/ }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(dlg).toBeHidden();
});

test("the last footer link is never hidden behind the bottom bar", async ({ page }) => {
  await page.goto("/methodology");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const link = page.locator("footer").getByRole("link", { name: "Contact" });
  const navTop = (await page.locator("[data-bottom-nav]").boundingBox())!.y;
  const b = (await link.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(navTop);
});

test("timeline: tapping a stop opens its card in place with sources and the story link; progress bar tracks the era", async ({ page }) => {
  await page.goto("/timeline");
  const stop = page.locator("#stop-yusuf");
  await stop.locator("summary").click();
  const panel = stop.locator(".zq-vt-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: /Yusuf/ })).toBeVisible();
  await expect(panel.locator("[data-citation]").first()).toBeVisible();
  // The card opens beside the spine, inside the viewport width.
  const b = (await panel.boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(360);
  await panel.getByRole("link", { name: "Read the story" }).click();
  await expect(page).toHaveURL(/\/prophets\/yusuf$/);
});

test("timeline: jump-to-era moves to the chosen chapter and the progress bar reports a value", async ({ page }) => {
  await page.goto("/timeline");
  const select = page.getByLabel("Jump to era");
  const options = await select.locator("option").allTextContents();
  expect(options.length).toBeGreaterThan(3);
  await select.selectOption({ label: options[options.length - 1]! });
  await expect.poll(async () => Number(await page.getByRole("progressbar", { name: "Timeline progress" }).getAttribute("aria-valuenow"))).toBeGreaterThan(30);
});

test("prophet page: chapter progress with next / previous, and resume reading after a reload", async ({ page }) => {
  await page.goto("/prophets/nuh");
  const nav = page.getByRole("navigation", { name: "Chapter progress" });
  await expect(nav).toContainText("Chapter 1 of");
  await nav.getByRole("button", { name: "Next chapter" }).click();
  await expect(nav).toContainText("Chapter 2 of", { timeout: 5000 });
  await nav.getByRole("button", { name: "Next chapter" }).click();
  await expect(nav).toContainText("Chapter 3 of", { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.goto("/prophets/nuh");
  await expect(nav.getByRole("button", { name: /Resume: From the Quran/ })).toBeVisible();
  await nav.getByRole("button", { name: /Resume/ }).click();
  await expect(nav).toContainText("Chapter 3 of", { timeout: 5000 });
  await nav.getByRole("button", { name: "Previous chapter" }).click();
  await expect(nav).toContainText("Chapter 2 of", { timeout: 5000 });
});

test("Arabic at 360px: right-to-left, bottom navigation in Arabic, no sideways scroll, no axe violations", async ({ page }) => {
  await page.goto("/ar/timeline");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("navigation", { name: "التنقل الأساسي" }).getByRole("link", { name: "الخط الزمني" })).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("mobile pages have no axe violations with the bottom sheet open", async ({ page }) => {
  await page.goto("/prophets");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
