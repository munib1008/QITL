import { expect, test, type Page } from "@playwright/test";

/**
 * Visual regression baselines (docs/RESPONSIVE.md, "Visual regression"). A small set of stable, content-independent views
 * at the two project sizes (desktop 1440x900, mobile 390x844), compared with toHaveScreenshot.
 *
 * Skipped unless QITL_VISUAL=1, so the normal e2e run is unaffected. Run it with `pnpm test:visual`; regenerate the images
 * with `pnpm test:visual --update-snapshots` (the same as `QITL_VISUAL=1 pnpm exec playwright test visual --update-snapshots`).
 * Baselines are per project AND per operating system (Playwright appends both: home-desktop-win32.png): only the platform the
 * baselines were made on has images. Font rasterisation differs between Windows, macOS and Linux, so images from one OS are not
 * compared on another; generate the set on each platform that runs this (for CI: on the CI image, once).
 *
 * What makes them stable: animations disabled and reduced motion on (the journey's pulse, the reveal and the parallax are off),
 * the caret hidden, the web fonts awaited (document.fonts), regions that change by design masked, and views taken from the
 * fixtures the e2e server already runs with (QITL_E2E_FIXTURES=1, no Supabase: placeholder data only, no reading content).
 */
test.skip(!process.env.QITL_VISUAL, "visual regression runs only with QITL_VISUAL=1 (pnpm test:visual)");

interface View {
  name: string;
  path: string;
  /** Whole page instead of the first screen. Only for pages whose length does not depend on content that scrolls in. */
  full?: boolean;
  /** Scroll this selector to the top of the screen before the shot (instant, so nothing is mid-animation). */
  scrollTo?: string;
  /** Click this selector after the first scroll (opens that journey stop; the open stop does not depend on scroll history). */
  click?: string;
}

const VIEWS: View[] = [
  { name: "home", path: "/" },
  // The journey's stops (below the first screen): the first stop (open), and a stop in the middle of the list opened by a click.
  { name: "home-journey", path: "/", scrollTo: ".zq-jt-filters" },
  { name: "home-journey-mid", path: "/", scrollTo: '[data-stop="yusuf"]', click: '[data-node="yusuf"]' },
  { name: "quran-1", path: "/quran/1" },
  { name: "timeline", path: "/timeline" },
  { name: "people-empty", path: "/people" },
  { name: "shifa", path: "/shifa" },
  { name: "home-ur", path: "/ur" },
  { name: "home-ar", path: "/ar" },
];

/**
 * Regions that change by design: the journey's live progress read-out and anything marked data-visual-mask. (The parallax
 * backdrop .zq-jt-bg is not masked: it is a 120%-tall absolute layer, so a mask would cover the page; with reduced motion
 * on it does not move.)
 */
function masks(page: Page) {
  return [page.locator('[data-testid="journey-progress"]'), page.locator("[data-visual-mask]")];
}

async function settle(page: Page) {
  // Every font the page uses is requested on first layout; wait until none is loading, then until the fonts report ready.
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    const pending = () => Array.from(document.fonts).filter((f) => f.status === "loading").length;
    for (let i = 0; i < 50 && pending() > 0; i++) await new Promise((r) => setTimeout(r, 100));
    await document.fonts.ready;
  });
  // Two frames so the font swap has been laid out and painted.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

test.describe("visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  });

  for (const v of VIEWS) {
    test(v.name, async ({ page }) => {
      await page.goto(v.path);
      await settle(page);
      if (v.scrollTo) {
        const target = v.scrollTo;
        const scroll = () => page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start", behavior: "instant" }), target);
        await scroll();
        if (v.click) {
          await page.locator(v.click).click();
          await page.waitForTimeout(2000); // past the scroll-sync hold after a click
        }
        // Let the scroll-sync, the reveal and any deferred hydration settle (the nearest stop becomes the open one) ...
        await page.waitForTimeout(1500);
        await settle(page);
        // ... then scroll again: those may move the page by a few pixels (stops that were not yet drawn take their real height).
        await scroll();
        await page.waitForTimeout(500);
      }
      await expect(page).toHaveScreenshot(`${v.name}.png`, {
        animations: "disabled",
        caret: "hide",
        scale: "css",
        fullPage: v.full ?? false,
        mask: masks(page),
        // Anti-aliasing differs by a few pixels between runs of the same build; a real layout change moves far more.
        maxDiffPixelRatio: 0.005,
        threshold: 0.2,
      });
    });
  }
});
