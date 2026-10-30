import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Brief 02 and the cross-navigation flow A (anonymous, no login). */

test("prophet page: Yusuf is chapter 11 of 29 between Yaqub and Ayyub, with 8 cited story steps", async ({ page }) => {
  await page.goto("/prophets/yusuf");
  await expect(page.getByTestId("chapter-position")).toHaveText("Chapter 11 of 29");
  const pos = page.getByRole("navigation", { name: "Journey position" });
  await expect(pos.getByRole("link", { name: /Previous.*Yaqub/ })).toBeVisible();
  await expect(pos.getByRole("link", { name: /Next.*Ayyub/ })).toBeVisible();
  const steps = page.getByTestId("story-steps").locator("li");
  await expect(steps).toHaveCount(8);
  for (const s of await steps.all()) {
    await expect(s.locator(".zq-ev-quran")).toHaveCount(1);
    await expect(s.locator("[data-citation]")).toHaveCount(1);
  }
  await expect(page.getByText("No narration is attached to this page yet.")).toBeVisible();
  await expect(page.getByTestId("draft-badge").first()).toBeVisible();
});

test("flow A: Adam → timeline → place → Quran → hadith section → next prophet, without signing in", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-node="adam"]').click();
  await page.locator("#adam").getByRole("link", { name: "Explore story" }).click();
  await expect(page).toHaveURL(/\/prophets\/adam$/);
  await page.getByRole("link", { name: "On the timeline" }).click();
  await expect(page).toHaveURL(/\/timeline\?selected=adam/);
  await expect(page.getByRole("heading", { name: /Adam/ })).toBeVisible();
  await page.getByRole("link", { name: "Show on the atlas" }).click();
  await expect(page).toHaveURL(/\/atlas\?focus=adam/);
  await expect(page.locator('[aria-current="true"]').getByText("Adam")).toBeVisible(); // listed under unknown, not placed
  await page.goto("/prophets/adam");
  await page.locator("#story-h").scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "Q 2:30–39" }).first().click();
  await expect(page).toHaveURL(/\/quran\/2#ayah-30$/);
  await page.goto("/prophets/adam#hadith");
  await expect(page.locator("#hadith")).toContainText("No narration is attached");
  await page.getByRole("navigation", { name: "Journey position" }).getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/prophets\/idris$/);
});

test("flow B (signed out, accounts not configured): bookmark is visibly unavailable, never mocked", async ({ page }) => {
  await page.goto("/prophets/yusuf");
  const bm = page.locator(".pp-acts").getByRole("button", { name: "Bookmark" });
  await expect(bm).toBeDisabled();
  await expect(page.locator(".pp-acts").getByText("Accounts coming soon")).toBeVisible();
});

test("search finds Joseph → Yusuf and Arabic without vowel marks", async ({ page }) => {
  await page.goto("/search?q=Joseph");
  await expect(page.getByRole("link", { name: /^Yusuf/ }).first()).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent("يوسف")}`);
  await expect(page.getByRole("link", { name: /^Yusuf/ }).first()).toBeVisible();
  await page.goto("/search?q=zzqqxx");
  await expect(page.getByText(/Nothing matched/)).toBeVisible();
});

test("Last Hour shows no date and no countdown", async ({ page }) => {
  await page.goto("/last-hour");
  const text = (await page.locator("main").textContent()) ?? "";
  expect(text).not.toMatch(/\b(20[3-9]\d|2[1-9]\d\d)\b/);
  expect(text.toLowerCase()).not.toMatch(/years remaining|days left|\d+ (years|days) (until|before)/);
});

test("Arabic interface is right-to-left", async ({ page }) => {
  await page.goto("/ar/prophets/yusuf");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("unknown routes render the designed 404", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page is not here." })).toBeVisible();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("API: personal routes refuse anonymous and cross-site requests; search works", async ({ request }) => {
  const r1 = await request.post("/api/me/bookmarks", { data: { type: "journey_stop", id: "adam" } });
  expect([403, 503]).toContain(r1.status());
  const r2 = await request.get("/api/search?q=Ibrahim");
  expect(r2.ok()).toBe(true);
  expect((await r2.json()).results[0].id).toBe("ibrahim");
  const r3 = await request.get("/api/search?q=");
  expect(r3.status()).toBe(422);
});

for (const path of ["/events", "/prophets", "/prophets/yusuf", "/timeline", "/atlas", "/quran", "/quran/12", "/hadith", "/genealogy", "/last-hour", "/search?q=nuh", "/methodology", "/sign-in", "/community"]) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const path of ["/prophets/yusuf", "/timeline", "/quran/12", "/search?q=musa"])
    test(`no horizontal scroll at 320px: ${path}`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
});

test("branding: the QITL logo with a text alternative, favicon, apple icon and social card", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /QITL — Quran in Timeline, home/ })).toBeVisible();
  await expect(page.locator('img[alt="QITL — Quran in Timeline"]').first()).toBeVisible();
  await expect(page).toHaveTitle(/QITL — Quran in Timeline/);
  for (const sel of ['link[rel="icon"]', 'link[rel="apple-touch-icon"]', 'meta[property="og:image"]']) expect(await page.locator(sel).count(), sel).toBeGreaterThan(0);
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect((await request.get(new URL(og!).pathname)).status()).toBe(200);
});

test("events encyclopedia and the prophet story section render their designed states", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Quranic events", level: 1 })).toBeVisible();
  await page.goto("/prophets/nuh");
  await expect(page.getByRole("heading", { name: "The full story" })).toBeVisible();
});
