import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Complete Timeline (research atlas). The e2e build has no database, so the page shows the synthetic fixtures
 * (src/lib/events/fixtures.ts, clearly labelled): the lanes, the track filters, the "Order not established" lane,
 * the later-tradition label and the event page are exercised in English, Arabic and Urdu at 360px and 1440px.
 */
const LOCALES = [
  { code: "en", prefix: "", cookie: "en" },
  { code: "ar", prefix: "/ar", cookie: "ar" },
  { code: "ur", prefix: "/ur", cookie: "ur" },
] as const;

async function axe(page: Page) {
  const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [360, 1440]) {
  test.describe(`complete timeline at ${width}px`, () => {
    test.skip(() => test.info().project.name !== "desktop", "the width is set here");
    test.use({ viewport: { width, height: width < 600 ? 780 : 900 } });

    for (const l of LOCALES) {
      test(`${l.code}: both views, lanes, filters; no axe violations; no sideways scroll`, async ({ page }) => {
        // The guided Journey is still the default.
        const journey = await page.goto(`${l.prefix}/timeline`);
        expect(journey?.status()).toBe(200);
        await expect(page.getByTestId("view-switch").locator('[data-view="journey"]')).toHaveAttribute("aria-current", "page");
        await expect(page.locator("[data-stop]").first()).toBeVisible();
        expect(await axe(page)).toEqual([]);

        const res = await page.goto(`${l.prefix}/timeline?view=complete`);
        expect(res?.status()).toBe(200);
        await expect(page.getByTestId("complete-timeline")).toBeVisible();
        await expect(page.getByTestId("view-switch").locator('[data-view="complete"]')).toHaveAttribute("aria-current", "page");
        // Lanes, including the first-class "Order not established" lane and the undated parables.
        for (const lane of ["relative", "dated", "disputed", "not_established", "parable"]) await expect(page.locator(`section[data-lane="${lane}"]`)).toHaveCount(1);
        await expect(page.getByTestId("synthetic-banner")).toBeVisible();
        // A name from later tradition is labelled.
        await expect(page.getByTestId("later-tradition").first()).toBeVisible();
        // Only the dated estimate shows a year.
        const years = await page.locator('[data-testid="tl-card"]:not([data-ordering-kind="dated_estimate"])').evaluateAll((els) => els.filter((e) => /\b(570|571)\b|\bCE\b/.test(e.textContent ?? "")).length);
        expect(years).toBe(0);
        await expect(page.locator('[data-testid="tl-card"][data-ordering-kind="dated_estimate"]')).toContainText("570");
        expect(await sideways(page)).toBeLessThanOrEqual(1);
        expect(await axe(page)).toEqual([]);

        // Filters: URL-persisted, all on by default.
        const filters = page.getByTestId("track-filters");
        await expect(filters.getByRole("checkbox")).toHaveCount(6);
        for (const box of await filters.getByRole("checkbox").all()) await expect(box).toBeChecked();
        await page.goto(`${l.prefix}/timeline?view=complete&tracks=parables,seerah`);
        const tracks = await page.locator('[data-testid="tl-card"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-track")))].sort());
        expect(tracks).toEqual(["parables", "seerah"]);
        await expect(page.locator('section[data-lane="parable"]')).toHaveCount(1);
        expect(await axe(page)).toEqual([]);
        expect(await sideways(page)).toBeLessThanOrEqual(1);
      });
    }

    test("filter chips: 44px targets, keyboard toggling, the URL follows, the shown count follows", async ({ page }) => {
      await page.goto("/timeline?view=complete");
      const chips = page.locator(".tl-chip");
      for (const chip of await chips.all()) {
        const box = await chip.boundingBox();
        expect(box!.height, "chip height").toBeGreaterThanOrEqual(43.5);
        expect(box!.width, "chip width").toBeGreaterThanOrEqual(43.5);
      }
      const total = await page.locator('[data-testid="tl-card"]').count();
      // Keyboard: focus the Parables checkbox and press Space.
      const parables = page.getByRole("checkbox", { name: /Parables/ });
      await parables.focus();
      await page.keyboard.press("Space");
      await expect(page).toHaveURL(/tracks=prophets,people,communities,events,seerah/);
      await expect(page.getByTestId("track-status")).toContainText("Showing 5 of 6 tracks.");
      await expect(page.locator('section[data-lane="parable"]')).toHaveCount(0);
      expect(await page.locator('[data-testid="tl-card"]').count()).toBeLessThan(total);
      // Clear: none selected, an explicit message and "-" in the URL; All tracks returns to the default URL.
      await page.getByRole("link", { name: "Clear" }).click();
      await expect(page).toHaveURL(/tracks=-/);
      await expect(page.getByTestId("none-shown")).toBeVisible();
      await page.getByRole("link", { name: "All tracks" }).click();
      await expect(page).toHaveURL(/timeline\?view=complete$/);
      await expect(page.locator('[data-testid="tl-card"]')).toHaveCount(total);
    });

    test("a long lane is chunked into 'Show more' and every item stays reachable", async ({ page }) => {
      await page.goto("/timeline?view=complete&tracks=people,events");
      const more = page.locator("details.tl-more").first();
      await expect(more).toBeVisible();
      const before = await page.locator('[data-testid="tl-card"]:visible').count();
      await more.locator("summary").click();
      expect(await page.locator('[data-testid="tl-card"]:visible').count()).toBeGreaterThan(before);
    });

    test("verse chips link to the ayah range in the reader; the event page shows verses, order and the later-tradition note", async ({ page }) => {
      await page.goto("/timeline?view=complete&tracks=prophets");
      const chip = page.locator("#ev-fixture-prophet-b a[data-citation]").first();
      await expect(chip).toHaveAttribute("href", "/quran/12#ayah-4-5");
      await page.goto("/events/fixture-person-a");
      await expect(page.getByTestId("universe-sections")).toBeVisible();
      await expect(page.getByTestId("later-tradition")).toContainText("Named in later tradition, not in the Quranic text");
      await expect(page.getByTestId("identifications")).toContainText("not statements of the Quran");
      expect(await axe(page)).toEqual([]);
    });
  });
}

test.describe("reduced motion and RTL", () => {
  test.skip(() => test.info().project.name !== "desktop", "one project");
  test("Arabic is right-to-left and honours reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/ar/timeline?view=complete");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const t = await page.locator(".tl-chip").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(t)).toBeLessThanOrEqual(0.001);
    expect(await sideways(page)).toBeLessThanOrEqual(1);
  });
});

test("an unknown event address shows no item and never an error page (a merged-away address redirects once the database has the redirect: db tests)", async ({ page }) => {
  const res = await page.goto("/events/not-a-real-event-slug");
  expect(res?.status()).toBeLessThan(500);
  await expect(page.getByTestId("universe-sections")).toHaveCount(0);
});
