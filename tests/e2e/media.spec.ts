import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Media Library on a deployment without the database: /admin/media renders the designed not-configured state (never
 * the upload tools), at phone and desktop widths, with no horizontal overflow and no axe violations; the media API
 * refuses every write.
 */

async function axe(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

for (const width of [360, 1440]) {
  test(`/admin/media at ${width}px: designed not-configured state, axe`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/media");
    const state = page.getByTestId("empty-state");
    await expect(state).toBeVisible();
    await expect(state).toContainText("Not configured");
    await expect(state).toContainText("The editorial tools need the database.");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Media Library" })).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await axe(page);
  });
}

test("media API refuses writes without the database or a session", async ({ request, baseURL }) => {
  const headers = { origin: baseURL! };
  const upload = await request.post("/api/admin/media/upload", { headers, multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) } } });
  expect([401, 403, 503]).toContain(upload.status());
  for (const [url, data] of [
    ["/api/admin/media", { action: "publish", assetId: "00000000-0000-4000-8000-000000000001" }],
    ["/api/admin/media/cleanup", { execute: false }],
  ] as const) {
    const r = await request.post(url, { headers, data });
    expect([401, 403, 503], url).toContain(r.status());
  }
  // Cross-site writes are refused before anything else.
  const cross = await request.post("/api/admin/media", { headers: { origin: "https://evil.example" }, data: { action: "publish" } });
  expect([403, 503]).toContain(cross.status());
});
