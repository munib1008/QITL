import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The redesign views: the home journey dial, the era-scroll Complete Timeline (?draft=1 forces the labelled draft view),
 * the lineage line (?draft=1), the draft Last Hour and the Names dial. English, Arabic and Urdu; no axe violations; no
 * sideways scroll at 390px and 1440px; no dates in the future signs.
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
  test.describe(`redesign views at ${width}px`, () => {
    test.skip(() => test.info().project.name !== "desktop", "the width is set here");
    test.use({ viewport: { width, height: width < 600 ? 844 : 900 } });

    for (const l of LOCALES) {
      test(`${l.code}: home dial steps, searches and has no axe violations`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/`);
        expect(res?.status()).toBe(200);
        const dial = page.locator(".rd-dial").first();
        await expect(dial).toBeVisible();
        const core = dial.locator(".rd-dial-core");
        const first = await core.textContent();
        await page.locator(".rd-dial-wrap .rd-row .zq-btn").last().click();
        await expect.poll(async () => core.textContent()).not.toBe(first);
        await page.locator("#rd-dial-q").fill("Yusuf");
        await page.locator(".rd-search .rd-chip").first().click();
        await expect(core).toContainText("Yusuf");
        expect(await sideways(page)).toBeLessThanOrEqual(0);
        expect(await axe(page)).toEqual([]);
      });

      test(`${l.code}: the draft timeline filters by category, previews and pins, and shows future signs without a date`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/timeline?view=complete&draft=1`);
        expect(res?.status()).toBe(200);
        const root = page.getByTestId("era-scroll");
        await expect(root).toBeVisible();
        await expect(page.getByTestId("draft-banner")).toBeVisible();
        const before = Number(await root.getAttribute("data-shown"));
        expect(before).toBeGreaterThan(100);
        const cats = root.locator(".rd-cat");
        await expect(cats).toHaveCount(7);
        await cats.first().click(); // Prophets off
        await expect(cats.first()).toHaveAttribute("aria-pressed", "false");
        expect(Number(await root.getAttribute("data-shown"))).toBeLessThan(before);
        await cats.first().click();
        await expect(cats.first()).toHaveAttribute("aria-pressed", "true");
        // pin a tile: the focus card shows it
        const tile = root.locator(".rd-tile").nth(3);
        const title = (await tile.locator(".rd-tile-title").textContent()) ?? "";
        await tile.click();
        await expect(tile).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByTestId("focus-card")).toContainText(title.slice(0, 12));
        // the future era: major signs, no year
        const future = root.locator(".rd-tile[data-track='future']");
        await expect(future.first()).toBeAttached();
        const futureText = (await future.allTextContents()).join(" ");
        expect(futureText).not.toMatch(/\b(1[3-9]\d\d|2\d\d\d)\b/);
        // all categories off gives the plain message
        for (let i = 0; i < 7; i++) await cats.nth(i).click();
        await expect(page.getByTestId("none-shown")).toBeVisible();
        await root.locator(".rd-cats > .rd-chip").click();
        await expect(page.getByTestId("none-shown")).toHaveCount(0);
        expect(await sideways(page)).toBeLessThanOrEqual(0);
        expect(await axe(page)).toEqual([]);
      });

      test(`${l.code}: the lineage line starts at Adam, ends at Muhammad, shows gaps and has no axe violations`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/lineage?draft=1`);
        expect(res?.status()).toBe(200);
        const root = page.getByTestId("lineage-line");
        await expect(root).toBeVisible();
        await expect(page.getByTestId("draft-banner")).toBeVisible();
        const rows = root.locator(".rd-line-row");
        await expect(rows.first()).toHaveAttribute("data-node", "adam");
        await expect(rows.last()).toHaveAttribute("data-node", "muhammad");
        expect(await root.locator(".rd-line-row[data-link='unknown']").count()).toBeGreaterThanOrEqual(3);
        await root.locator(".rd-person").nth(1).click();
        await expect(page.getByTestId("focus-card")).toContainText(/19:58/);
        await root.locator(".rd-cats .rd-chip").nth(1).click(); // Prophets only
        await expect(root.locator(".rd-line-row[data-node='kinana']")).toHaveAttribute("data-dim", "true");
        expect(await sideways(page)).toBeLessThanOrEqual(0);
        expect(await axe(page)).toEqual([]);
      });

      test(`${l.code}: the Last Hour shows ten major signs, no date and no countdown`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/last-hour`);
        expect(res?.status()).toBe(200);
        const root = page.getByTestId("draft-last-hour");
        await expect(root).toBeVisible();
        await expect(root.locator(".rd-sign[data-major='true']")).toHaveCount(10);
        const text = (await page.locator("main").textContent()) ?? "";
        expect(text).not.toMatch(/\b(20[3-9]\d|2[1-9]\d\d)\b/);
        expect(text.toLowerCase()).not.toMatch(/years remaining|days left|\d+ (years|days) (until|before)/);
        expect(await sideways(page)).toBeLessThanOrEqual(0);
        expect(await axe(page)).toEqual([]);
      });

      test(`${l.code}: the Names dial shows an AI-draft Name, moves and links to the Name page`, async ({ page }) => {
        const res = await page.goto(`${l.prefix}/asma`);
        expect(res?.status()).toBe(200);
        const dial = page.getByTestId("names-dial");
        await expect(dial).toBeVisible();
        const ar = dial.getByTestId("dial-ar");
        await expect(ar).toHaveAttribute("lang", "ar");
        const first = await ar.textContent();
        await dial.locator(".rd-range").fill("5");
        await expect.poll(async () => ar.textContent()).not.toBe(first);
        await expect(dial.locator(".rd-cert")).toBeVisible();
        await expect(dial.getByRole("link").last()).toHaveAttribute("href", /\/asma\/[a-z-]+$/);
        expect(await sideways(page)).toBeLessThanOrEqual(0);
        expect(await axe(page)).toEqual([]);
      });
    }
  });
}
