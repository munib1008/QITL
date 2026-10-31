import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Unified search (/search): sources, Arabic and Urdu input, facets, pagination, the verbatim Quran with its
 * attribution, 44px targets, RTL, and axe in English, Arabic and Urdu at 360px and 1440px.
 * One project drives every width.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width");

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

const results = (page: Page) => page.locator(".sr-list > li");

test("English names, aliases and typos find the prophet first", async ({ page }) => {
  for (const q of ["Joseph", "Yousef", "Moses", "Ibraheem"]) {
    await page.goto(`/search?q=${encodeURIComponent(q)}`);
    await expect(results(page).first().locator(".sr-link")).toHaveAttribute("href", /\/prophets\/(yusuf|musa|ibrahim)$/);
  }
});

test("plain Arabic finds ayat in the verbatim Uthmani text, linked to the ayah, with the Tanzil attribution", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("الرحمن الرحيم")}&facet=ayahs`);
  const first = results(page).first();
  await expect(first.locator(".sr-link")).toHaveAttribute("href", /^\/quran\/\d+#ayah-\d+$/);
  const ayah = first.locator("[data-verbatim-quran]");
  await expect(ayah).toHaveAttribute("lang", "ar");
  await expect(ayah).toHaveAttribute("dir", "rtl");
  // Verbatim: the Uthmani text keeps its vowel marks (the query had none).
  expect(await ayah.textContent()).toMatch(/[ً-ْ]/);
  await expect(page.locator("[data-quran-attribution]")).toContainText("Tanzil");
});

test("a reference opens straight to the ayah", async ({ page }) => {
  await page.goto("/search?q=12:4");
  await expect(results(page).first().locator(".sr-link")).toHaveAttribute("href", "/quran/12#ayah-4");
});

test("facets filter and pagination pages through results with 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/search?q=${encodeURIComponent("الله")}`);
  const facets = page.getByRole("navigation", { name: "Filter results" });
  await facets.getByRole("link", { name: /Ayat/ }).click();
  await expect(page).toHaveURL(/facet=ayahs/);
  await expect(results(page)).toHaveCount(20);
  for (const li of await results(page).all()) await expect(li).toHaveAttribute("data-facet", "ayahs");
  const pager = page.getByRole("navigation", { name: "Result pages" });
  await pager.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pager.locator("[aria-current=page]")).toHaveText("2");
  for (const el of [...(await pager.getByRole("link").all()), ...(await facets.getByRole("link").all()), results(page).first().locator(".sr-link")]) {
    const b = (await el.boundingBox())!;
    expect(b.height, (await el.textContent()) ?? "").toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the header field searches the whole site", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/prophets");
  const field = page.locator("header").getByRole("searchbox", { name: "Search QITL" });
  await field.fill("Musa");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Musa/);
  await expect(results(page).first().locator(".sr-link")).toHaveAttribute("href", "/prophets/musa");
});

test("Arabic and Urdu interfaces: RTL, localised labels, Urdu-script input", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/ar/search?q=${encodeURIComponent("يوسف")}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("navigation", { name: "تصفية النتائج" })).toBeVisible();
  await expect(results(page).first().locator(".sr-link")).toHaveAttribute("href", "/prophets/yusuf");
  await page.goto(`/ur/search?q=${encodeURIComponent("یوسف")}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.getByRole("navigation", { name: "نتائج چھانٹیں" })).toBeVisible();
  await expect(results(page).first().locator(".sr-link")).toHaveAttribute("href", "/prophets/yusuf");
});

test("the API pages and filters, and refuses empty queries", async ({ request }) => {
  const r = await request.get(`/api/search?q=${encodeURIComponent("الله")}&facet=ayahs&page=2`);
  expect(r.ok()).toBe(true);
  const j = await r.json();
  expect(j.page).toBe(2);
  expect(j.results).toHaveLength(20);
  expect(j.results.every((h: { facet: string; arabic?: string }) => h.facet === "ayahs" && h.arabic)).toBe(true);
  expect((await request.get("/api/search?q=")).status()).toBe(422);
});

for (const locale of ["", "/ar", "/ur"])
  for (const width of [360, 1440])
    test(`axe: ${locale || "/en"}/search at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${locale}/search?q=${encodeURIComponent(locale ? "موسى" : "Yusuf")}`);
      await expect(results(page).first()).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto(`${locale}/search?q=zzqqxx`);
      expect(await axe(page)).toEqual([]);
    });
