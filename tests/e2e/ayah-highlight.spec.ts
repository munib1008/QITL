import { expect, test, type Page } from "@playwright/test";

/**
 * Opening a Quran reference marks the referenced ayat with a glowing border for three seconds. The glow is recorded the
 * moment it is applied (a MutationObserver installed before the page loads), so a slow page load cannot hide it from
 * the test.
 */
async function recordFlashes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __flashes: Array<{ id: string; animation: string }> };
    w.__flashes = [];
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (r.attributeName === "class" && el.classList?.contains("qr-flash") && !(r.oldValue ?? "").includes("qr-flash"))
          w.__flashes.push({ id: el.id, animation: getComputedStyle(el).animationName });
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
}
const flashes = (page: Page) => page.evaluate(() => (window as unknown as { __flashes: Array<{ id: string; animation: string }> }).__flashes);

test("a range reference lights every ayah in it for 3 s, and only those", async ({ page }) => {
  await recordFlashes(page);
  await page.goto("/quran/12#ayah-4-6");
  await expect.poll(async () => (await flashes(page)).map((f) => f.id).sort()).toEqual(["ayah-4", "ayah-5", "ayah-6"]);
  await expect(page.locator("#ayah-4")).toBeInViewport();
  await expect(page.locator(".qr-flash")).toHaveCount(0, { timeout: 6000 });
});

test("clicking a reference on another page opens the surah and lights the ayah", async ({ page }) => {
  await recordFlashes(page);
  await page.goto("/prophets/nuh");
  const chip = page.locator('a[href^="/quran/"][href*="#ayah-"]').first();
  const href = (await chip.getAttribute("href"))!;
  const [, surah, from] = /\/quran\/(\d+)#ayah-(\d+)/.exec(href)!;
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`/quran/${surah}#ayah-${from}`));
  await expect.poll(async () => (await flashes(page)).map((f) => f.id)).toContain(`ayah-${from}`);
});

test("clicking the same reference again replays the glow", async ({ page }) => {
  await recordFlashes(page);
  await page.goto("/quran/12#ayah-4");
  await expect.poll(async () => (await flashes(page)).length).toBe(1);
  await expect(page.locator(".qr-flash")).toHaveCount(0, { timeout: 6000 });
  await page.locator("#ayah-4").getByRole("link", { name: "Q 12:4" }).click();
  await expect.poll(async () => (await flashes(page)).length).toBe(2);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the ayah is still marked, without animation", async ({ page }) => {
    await recordFlashes(page);
    await page.goto("/quran/12#ayah-4");
    await expect.poll(async () => (await flashes(page)).map((f) => f.id)).toEqual(["ayah-4"]);
    expect((await flashes(page))[0]!.animation).toBe("none");
  });
});
