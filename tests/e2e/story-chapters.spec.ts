import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Story chapters and depth modes, on the synthetic fixture story (src/lib/stories/fixture.ts; the e2e build has no
 * database). Chapter 1 has every mode, chapter 2 only the complete text and chapter 3 no text at all.
 */
const URL = "/stories/fixture-story";

async function axe(page: Page) {
  const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const inView = (page: Page, id: string) =>
  page.evaluate((i) => {
    const r = document.getElementById(i)!.getBoundingClientRect();
    return r.top < window.innerHeight * 0.6 && r.bottom > 0;
  }, id);

test.describe("desktop reader", () => {
  test.skip(() => test.info().project.name !== "desktop", "the width is set per project");

  test("chapters, anchors, verse links and the mode switch by keyboard", async ({ page }) => {
    const res = await page.goto(URL);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("chapter-reader")).toBeVisible();
    await expect(page.getByTestId("story-chapter")).toHaveCount(3);
    await expect(page.locator("#chapter-part-1")).toBeVisible();
    // The side column is the chapter list on a wide screen; the bottom button is hidden.
    await expect(page.locator(".sc-side")).toBeVisible();
    await expect(page.locator(".sc-bottom")).toBeHidden();
    // Verse deep links keep the ayah anchor.
    await expect(page.locator("#chapter-part-1 .sc-verses a").first()).toHaveAttribute("href", /\/quran\/1#ayah-1-2$/);

    // Default: complete story; the chapter without text is plainly "not established".
    await expect(page.getByRole("radio", { name: "Complete story" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#chapter-part-3 [data-state='missing']")).toContainText("Not established yet");

    // Keyboard: arrow keys change the mode and the URL.
    await page.getByRole("radio", { name: "Complete story" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Deep study" })).toBeFocused();
    await expect(page.getByRole("radio", { name: "Deep study" })).toHaveAttribute("aria-checked", "true");
    expect(page.url()).toContain("mode=deep");
    await expect(page.locator("#chapter-part-1 details.sc-sources")).toHaveAttribute("open", "");
    await expect(page.locator("#chapter-part-1")).toContainText("Deep-study notes");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Kids mode" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#chapter-part-1")).toContainText("Kids version of chapter one");
    await expect(page.locator("#chapter-part-2 [data-state='missing']")).toContainText("no reviewed kids version");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#chapter-part-1")).toContainText("Educational interpretation");
    await page.keyboard.press("Home");
    await expect(page.getByRole("radio", { name: "One-minute summary" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#chapter-part-1")).toContainText("One-minute summary of chapter one");
    expect(await axe(page)).toEqual([]);
  });

  test("the chosen mode is remembered and ?mode= wins", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("radio", { name: "Kids mode" }).click();
    await page.goto(URL);
    await expect(page.getByRole("radio", { name: "Kids mode" })).toHaveAttribute("aria-checked", "true");
    await page.goto(`${URL}?mode=summary`);
    await expect(page.getByRole("radio", { name: "One-minute summary" })).toHaveAttribute("aria-checked", "true");
    await page.goto(`${URL}?mode=nonsense`);
    await expect(page.getByRole("radio", { name: "Kids mode" })).toHaveAttribute("aria-checked", "true");
  });

  test("a chapter is linkable by its anchor, and the chapter list moves focus to the heading", async ({ page }) => {
    await page.goto(`${URL}#chapter-part-2`);
    await expect.poll(() => inView(page, "chapter-part-2")).toBe(true);
    await page.locator(".sc-side").getByRole("link", { name: /Chapter 3/ }).click();
    await expect.poll(() => inView(page, "chapter-part-3")).toBe(true);
    await expect(page.locator("#chapter-part-3-h")).toBeFocused();
    expect(page.url()).toContain("#chapter-part-3");
    await expect(page.locator(".sc-side").getByRole("link", { name: /Chapter 3/ })).toHaveAttribute("aria-current", "location");
  });

  test("reading progress is counted per story in this browser", async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByTestId("chapter-progress")).toContainText("of 3 chapters read");
    await page.locator("#sources-and-uncertainties").scrollIntoViewIfNeeded();
    await expect.poll(async () => (await page.getByTestId("chapter-progress").textContent()) ?? "").toMatch(/^[123] of 3 chapters read/);
  });

  test("sources and uncertainties lists what is not established and all sources", async ({ page }) => {
    await page.goto(URL);
    const s = page.getByTestId("sources-and-uncertainties");
    await expect(s).toContainText("A point the sources do not establish");
    await expect(s.getByRole("link", { name: /Q 1:/ }).first()).toBeVisible();
  });

  test("reduced motion: no animated progress bar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL);
    const d = await page.locator(".sc-bar > span").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    // The site-wide reduced-motion rule shortens transitions to a hair (1e-05s), which is no visible motion.
    expect(parseFloat(d)).toBeLessThan(0.001);
  });

  for (const l of [
    { code: "ar", prefix: "/ar", dir: "rtl" },
    { code: "ur", prefix: "/ur", dir: "rtl" },
  ]) {
    test(`${l.code}: right to left, interface in the language, story text marked as English`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "qitl-locale", value: l.code, url: baseURL ?? "http://localhost:3100" }]);
      await page.goto(`${l.prefix}${URL}`);
      await expect(page.locator("html")).toHaveAttribute("dir", l.dir);
      await expect(page.getByTestId("reader-modes")).toBeVisible();
      await expect(page.getByTestId("reader-modes").getByRole("radio")).toHaveCount(5);
      await expect(page.locator("#chapter-part-1 .sc-text").first()).toHaveAttribute("lang", "en");
      // Arrow keys follow the reading direction: Left moves forward in RTL.
      await page.getByTestId("reader-modes").getByRole("radio", { checked: true }).focus();
      await page.keyboard.press("ArrowLeft");
      await expect(page.getByTestId("reader-modes").locator("[data-mode='deep']")).toHaveAttribute("aria-checked", "true");
      expect(await sideways(page)).toBeLessThanOrEqual(1);
      expect(await axe(page)).toEqual([]);
    });
  }
});

test.describe("mobile reader (390px)", () => {
  test.skip(() => test.info().project.name !== "mobile", "mobile project only");

  test("the chapter list is a bottom sheet; no sideways scroll; axe clean open and closed", async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator(".sc-side")).toBeHidden();
    expect(await sideways(page)).toBeLessThanOrEqual(1);
    expect(await axe(page)).toEqual([]);
    const open = page.getByRole("button", { name: /Chapters: Chapter 1 of 3/ });
    await open.scrollIntoViewIfNeeded();
    await expect(open).toBeVisible();
    // Not hidden behind the fixed bottom navigation.
    const box = (await open.boundingBox())!;
    const nav = await page.locator("[data-bottom-nav]").boundingBox();
    if (nav) expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Chapters" });
    await expect(dialog).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("link", { name: /Chapter 3/ }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => inView(page, "chapter-part-3")).toBe(true);
  });

  test("the mode switch wraps and every mode is a 44px target", async ({ page }) => {
    await page.goto(URL);
    for (const r of await page.getByTestId("reader-modes").getByRole("radio").all()) {
      const b = (await r.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(43);
      expect(b.x + b.width).toBeLessThanOrEqual(391);
    }
  });
});

test("an unknown story is a 404", async ({ page }) => {
  const res = await page.goto("/stories/no-such-story");
  expect(res?.status()).toBe(404);
});
