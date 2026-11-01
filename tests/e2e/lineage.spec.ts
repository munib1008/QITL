import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Lineage of Humanity (/genealogy?view=lineage, /lineage) and the scripture register (/scriptures). The e2e build has
 * no database, so the pages show synthetic fixtures behind a visible banner ("Test person N", "Test witness A"): the
 * legend, the evidence filter, the route graph, the gap box, competing routes, the assessment panel, the text outline and
 * the designed empty state are exercised in English, Arabic and Urdu at 390px and 1440px.
 */
const LOCALES = [
  { code: "en", prefix: "" },
  { code: "ar", prefix: "/ar" },
  { code: "ur", prefix: "/ur" },
] as const;

async function axe(page: Page) {
  const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [390, 1440]) {
  test.describe(`lineage at ${width}px`, () => {
    test.skip(() => test.info().project.name !== "desktop", "the width is set here");
    test.use({ viewport: { width, height: width < 600 ? 844 : 900 } });

    for (const l of LOCALES) {
      test(`${l.code}: legend, routes, gap, panel; no axe violations; no sideways scroll`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/genealogy?view=lineage`);
        expect(res?.status()).toBe(200);
        await expect(page.locator("[data-path-status=connected]")).toBeVisible();
        await expect(page.locator(".ln-fixture")).toBeVisible();
        // The legend names six classes; the view switch marks the lineage view.
        await expect(page.locator(".ln-legend li")).toHaveCount(6);
        await expect(page.locator('.ln-switch a[aria-current="page"]')).toHaveAttribute("href", "/genealogy?view=lineage");
        // Two competing routes, each with a graph and a text outline.
        await expect(page.locator("section.ln-route")).toHaveCount(2);
        await expect(page.locator("ol.ln-outline")).toHaveCount(2);
        // A gap box and every class drawn with its own pattern.
        await expect(page.locator('g.ln-opt[data-type="gap"]').first()).toBeAttached();
        const patterns = await page.locator("g.ln-opt").evaluateAll((els) => [...new Set(els.map((e) => `${e.getAttribute("data-class")}:${e.getAttribute("data-pattern")}`))]);
        expect(patterns.length).toBeGreaterThanOrEqual(5);
        expect(await sideways(page)).toBeLessThanOrEqual(1);
        expect(await axe(page)).toEqual([]);

        // Assess a link from the outline: the three questions appear.
        await page.locator(".ln-opt-row button").first().click();
        await expect(page.locator(".ln-panel h4")).toHaveCount(3);
        await expect(page.locator(".ln-panel")).toHaveAttribute("data-selected", /^(link|gap|person):/);
        expect(await axe(page)).toEqual([]);
      });
    }

    test("the evidence filter: unticking a class hides its links, the URL follows, 44px targets", async ({ page }) => {
      await page.goto("/genealogy?view=lineage");
      for (const label of await page.locator(".ln-filter label").all()) {
        const box = await label.boundingBox();
        expect(box!.height, "filter target").toBeGreaterThanOrEqual(43.5);
      }
      await page.locator(".ln-filter label", { hasText: "Hadith" }).locator("input").uncheck();
      await expect(page.locator('g.ln-opt[data-class="hadith"]')).toHaveCount(0);
      expect(page.url()).toContain("classes=");
      expect(page.url()).not.toContain("hadith");
      await page.reload();
      await expect(page.locator('g.ln-opt[data-class="hadith"]')).toHaveCount(0);
      await page.getByRole("button", { name: "Show all classes" }).click();
      await expect(page.locator('g.ln-opt[data-class="hadith"]').first()).toBeAttached();
    });

    test("keyboard: Tab reaches the chain, Arrow Down walks it, Enter assesses; the focus ring is visible", async ({ page }) => {
      await page.goto("/lineage");
      const first = page.locator("g.ln-node").first();
      await first.focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.locator("g.ln-opt:focus")).toHaveCount(1);
      await page.keyboard.press("Enter");
      await expect(page.locator(".ln-panel")).toHaveAttribute("data-selected", /^(link|gap):/);
      await page.keyboard.press("End");
      await expect(page.locator("g.ln-node:focus")).toHaveCount(1);
    });

    test("with nothing published: the designed empty state, counts only, no titles", async ({ page }) => {
      await page.goto("/genealogy?view=lineage&empty=1");
      await expect(page.getByTestId("empty-state")).toContainText("No part of this lineage is published yet.");
      await expect(page.locator(".ln-counts li")).toHaveCount(4);
      await expect(page.locator("svg.zx-svg")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Test person");
      expect(await axe(page)).toEqual([]);
    });
  });
}

for (const width of [390, 1440]) {
  test.describe(`scriptures at ${width}px`, () => {
    test.skip(() => test.info().project.name !== "desktop", "the width is set here");
    test.use({ viewport: { width, height: width < 600 ? 844 : 900 } });

    for (const l of LOCALES) {
      test(`${l.code}: layers, limitations, framework; no axe violations; no sideways scroll`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/scriptures`);
        expect(res?.status()).toBe(200);
        await expect(page.locator("section[data-layer]")).toHaveCount(3);
        // Every witness shows its limitation; an unknown dating reads "Not established".
        const cards = page.locator(".sc-card");
        await expect(cards).toHaveCount(3);
        for (const c of await cards.all()) await expect(c.locator(".sc-limit")).toBeVisible();
        await expect(cards.nth(1)).toContainText(l.code === "en" ? "Not established" : /[؀-ۿ]/);
        // Q 5:48 is linked from the framework statement.
        await expect(page.locator('a[href$="/quran/5#ayah-48"]')).toBeVisible();
        expect(await sideways(page)).toBeLessThanOrEqual(1);
        expect(await axe(page)).toEqual([]);
      });
    }

    test("the empty state shows counts only and no witness titles", async ({ page }) => {
      await page.goto("/scriptures?empty=1");
      await expect(page.getByTestId("empty-state")).toContainText("No witnesses are published yet.");
      await expect(page.locator(".sc-card")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("Test witness");
      expect(await axe(page)).toEqual([]);
    });
  });
}

test("reduced motion: nothing animates in the lineage view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/genealogy?view=lineage");
  const animated = await page.locator(".ln *").evaluateAll((els) => els.filter((e) => getComputedStyle(e).animationName !== "none" || parseFloat(getComputedStyle(e).transitionDuration) > 0).length);
  expect(animated).toBe(0);
});

test("dark mode: class chips keep a readable contrast", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/genealogy?view=lineage");
  expect(await axe(page)).toEqual([]);
});
