import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Life Through the Ages with no published records (the e2e build has no database): every page shows its designed
 * empty state, the fixed cautions and labels, and passes axe at 360px and 1440px.
 */
const PAGES: Array<{ path: string; heading: RegExp; check: (page: import("@playwright/test").Page) => Promise<void> }> = [
  { path: "/life-through-ages", heading: /^Life Through the Ages$/, check: async (p) => void (await expect(p.getByRole("link", { name: /Nuh/ }).first()).toBeVisible()) },
  {
    path: "/life-through-ages/prophets/nuh",
    heading: /Nuh — Their Life & Times/,
    check: async (p) => {
      await expect(p.getByTestId("nuh-note")).toContainText("950 years");
      await expect(p.getByTestId("nuh-note")).toContainText("not established by the Quran or the selected authentic hadith");
      await expect(p.locator('[data-field][data-known="false"]')).toHaveCount(20);
      await expect(p.getByTestId("empty-state").first()).toBeVisible();
    },
  },
  {
    path: "/life-through-ages/food",
    heading: /Food explorer/,
    check: async (p) => {
      await expect(p.getByTestId("food-caution")).toContainText("not presented here as a treatment or a longevity aid");
      await expect(p.getByTestId("empty-state")).toBeVisible();
    },
  },
  {
    path: "/life-through-ages/day",
    heading: /A Day in This Era/,
    check: async (p) => {
      await expect(p.getByTestId("day-label")).toContainText("Illustrative reconstruction");
      await expect(p.getByTestId("day-label")).toContainText("no hourly schedule");
      await expect(p.getByTestId("empty-state")).toBeVisible();
    },
  },
  { path: "/life-through-ages/compare", heading: /Then and now/, check: async (p) => void (await expect(p.getByTestId("compare-table")).toBeVisible()) },
  {
    path: "/life-through-ages/longevity",
    heading: /Human Longevity Research Center/,
    check: async (p) => {
      await expect(p.getByTestId("lifespan-lanes")).toBeVisible();
      await expect(p.getByText("No published record in this lane.").first()).toBeVisible();
      await expect(p.getByTestId("reconstruction")).toContainText("speculative");
    },
  },
  {
    path: "/timeline?layer=food",
    heading: /^Timeline$/,
    check: async (p) => {
      await expect(p.getByTestId("layer-empty")).toContainText("No published records on this layer yet.");
      await expect(p.getByRole("navigation", { name: "Timeline layer" }).getByRole("link", { name: "Food & agriculture" })).toHaveAttribute("aria-current", "true");
    },
  },
];

for (const width of [360, 1440]) {
  test.describe(`life through the ages at ${width}px`, () => {
    test.skip(() => test.info().project.name !== "desktop", "one project drives both widths");
    test.use({ viewport: { width, height: width < 600 ? 780 : 900 } });
    for (const pg of PAGES) {
      test(`${pg.path}: designed empty state and no axe violations`, async ({ page }) => {
        const res = await page.goto(pg.path);
        expect(res?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1, name: pg.heading })).toBeVisible();
        await pg.check(page);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sideways).toBeLessThanOrEqual(1);
        const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      });
    }
  });
}

test("the prophet page links to Their Life & Times, and the timeline keeps the prophets layer by default", async ({ page }) => {
  await page.goto("/prophets/nuh");
  await page.getByTestId("life-times-tab").click();
  await expect(page).toHaveURL(/\/life-through-ages\/prophets\/nuh$/);
  await page.goto("/timeline");
  await expect(page.getByTestId("timeline-layers")).toHaveAttribute("data-layer", "prophets");
  await expect(page.getByRole("navigation", { name: "Timeline layer" }).getByRole("link", { name: "Prophets & events" })).toHaveAttribute("aria-current", "true");
});
