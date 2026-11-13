import { expect, test } from "@playwright/test";

/** The Arabic name sits on the same start edge as the English title: left in EN, right in AR and UR. */
for (const [path, edge] of [["/prophets/yusuf", "left"], ["/ar/prophets/yusuf", "right"], ["/ur/prophets/yusuf", "right"]] as const) {
  test(`${path}: Arabic name aligns with the title on the ${edge} edge`, async ({ page }) => {
    await page.goto(path);
    const h1 = (await page.locator("h1.pp-h1").boundingBox())!;
    const name = (await page.locator(".pp-ar bdi").boundingBox())!;
    const [a, b] = edge === "left" ? [h1.x, name.x] : [h1.x + h1.width, name.x + name.width];
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
  });
}
