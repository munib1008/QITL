import { expect, test } from "@playwright/test";

/** Opening a Quran reference marks the referenced ayat with a glowing border for three seconds. */
test("a range reference lights every ayah in it for 3 s, and only those", async ({ page }) => {
  await page.goto("/quran/12#ayah-4-6");
  for (const a of [4, 5, 6]) await expect(page.locator(`#ayah-${a}`)).toHaveClass(/qr-flash/);
  await expect(page.locator("#ayah-7")).not.toHaveClass(/qr-flash/);
  await expect(page.locator("#ayah-4")).toBeInViewport();
  await page.waitForTimeout(3300);
  await expect(page.locator(".qr-flash")).toHaveCount(0);
});

test("clicking a reference on another page opens the surah and lights the ayah", async ({ page }) => {
  await page.goto("/prophets/nuh");
  const chip = page.locator('a[href^="/quran/"][href*="#ayah-"]').first();
  const href = (await chip.getAttribute("href"))!;
  const [, surah, from] = /\/quran\/(\d+)#ayah-(\d+)/.exec(href)!;
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`/quran/${surah}#ayah-${from}`));
  await expect(page.locator(`#ayah-${from}`)).toHaveClass(/qr-flash/);
});

test("clicking the same reference again replays the glow", async ({ page }) => {
  await page.goto("/quran/12#ayah-4");
  await page.waitForTimeout(3300);
  await expect(page.locator("#ayah-4")).not.toHaveClass(/qr-flash/);
  await page.locator("#ayah-4").getByRole("link", { name: "Q 12:4" }).click();
  await expect(page.locator("#ayah-4")).toHaveClass(/qr-flash/);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the ayah is still marked, without animation", async ({ page }) => {
    await page.goto("/quran/12#ayah-4");
    const li = page.locator("#ayah-4");
    await expect(li).toHaveClass(/qr-flash/);
    expect(await li.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});
