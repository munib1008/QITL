import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Asma' al-Husna without a database (the build for these specs has the Supabase variables blanked): every page shows its
 * designed "not connected" or unpopulated state, never invented content, in English, Arabic (RTL) and Urdu (RTL), without
 * horizontal overflow, console errors or axe violations. Content that needs a database (names, counts, the explorer's rows,
 * the AI-draft banner on a real Name) is covered by tests/db/asma.test.ts and tests/unit/asma-ui.test.tsx.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const LOCALES = [
  { prefix: "", name: "en", dir: "ltr" },
  { prefix: "/ar", name: "ar", dir: "rtl" },
  { prefix: "/ur", name: "ur", dir: "rtl" },
] as const;
const PAGES = ["/asma", "/asma/al-ghafur", "/asma/al-ghafur/occurrences", "/asma/dua", "/asma/pathways", "/asma/ism-al-azam", "/asma/learn", "/asma/response", "/admin/asma"];

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  return problems;
}

test("/asma: dashboard cards, the recognition note and the not-connected state", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/asma");
  await expect(page.getByRole("heading", { level: 1, name: "The Names of Allah" })).toBeVisible();
  await expect(page.getByTestId("recognition-note")).toContainText("does not say which transmitted enumeration is authentic");
  await expect(page.getByTestId("recognition-note")).toContainText("does not say the Names are limited to any number");
  await expect(page.getByTestId("asma-cards").getByRole("link")).toHaveCount(5);
  await expect(page.getByTestId("empty-state")).toContainText("not connected");
  await expect(page.getByTestId("names-grid")).toHaveCount(0);
  await expect(page.getByTestId("ai-draft-banner")).toHaveCount(0); // nothing AI-written is shown, so nothing is labelled
  expect(problems).toEqual([]);
});

test("/asma/<name> and its explorer: not connected, no 404 and no invented figures", async ({ page }) => {
  await page.goto("/asma/al-ghafur");
  await expect(page.getByTestId("empty-state")).toContainText("not connected");
  await expect(page.locator("body")).not.toContainText(/\b\d{2,} occurrences\b/);
  await page.goto("/asma/al-ghafur/occurrences?measure=C");
  await expect(page.getByTestId("empty-state")).toContainText("not connected");
  expect((await page.goto("/asma/Bad%20Slug"))!.status()).toBe(404);
});

test("/asma/dua: guidance without promises, an unavailable etiquette section, and a composer that keeps words on the device", async ({ page }) => {
  await page.goto("/asma/dua");
  const g = page.getByTestId("dua-guidance");
  await expect(g.getByRole("listitem")).toHaveCount(3);
  await expect(g).toContainText("holds only a reference");
  await expect(g).toContainText("makes no promise about the outcome");
  await expect(page.getByTestId("unavailable").first()).toBeVisible();
  const box = page.getByLabel("Your words");
  await box.fill("O Allah, make my work easy for me.");
  await expect(page.getByTestId("composer-stamp")).toHaveText("Your own words — not a quoted Quranic verse or Prophetic dua");
  await page.getByRole("button", { name: "Save on this device" }).click();
  await expect(page.getByText("Saved on this device only.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your words")).toHaveValue("O Allah, make my work easy for me.");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByLabel("Your words")).toHaveValue("");
});

test("Al-Ism al-A'zam and the response centre are placeholders only", async ({ page }) => {
  await page.goto("/asma/ism-al-azam");
  await expect(page.getByRole("heading", { level: 1, name: "Al-Ism al-A'zam" })).toBeVisible();
  await expect(page.locator("main")).toContainText("does not identify any Name as the Greatest Name");
  await expect(page.getByTestId("unavailable")).toHaveCount(3);
  await page.goto("/asma/response");
  const pts = page.getByTestId("response-points");
  await expect(pts.locator("section")).toHaveCount(5);
  await expect(pts.getByTestId("unavailable")).toHaveCount(5);
  await expect(pts).toContainText("Awaiting a source and a scholarly reviewer. No text is shown.");
});

test("/admin/asma: the console is staff-only and shows the not-connected state", async ({ page }) => {
  await page.goto("/admin/asma");
  await expect(page.getByTestId("empty-state").first()).toBeVisible();
  await expect(page.getByTestId("asma-admin")).toHaveCount(0);
});

test("API: the verse lookup validates its input and says when the database is missing", async ({ request }) => {
  expect((await request.get("/api/asma/verse?surah=0&ayah=1")).status()).toBe(400);
  expect((await request.get("/api/asma/verse?surah=2&ayah=x")).status()).toBe(400);
  expect((await request.get("/api/asma/verse?surah=2&ayah=255")).status()).toBe(503);
});

test("the Quran reader shows no 'Explore this Name' link when no occurrence is reviewer-confirmed", async ({ page }) => {
  await page.goto("/quran/59");
  await expect(page.getByRole("link", { name: /Explore this Name/ })).toHaveCount(0);
  await expect(page.locator('a[href^="/asma/"]')).toHaveCount(0);
});

for (const l of LOCALES) {
  test.describe(`${l.name}`, () => {
    for (const route of PAGES) {
      test(`${l.prefix}${route}: ${l.dir}, no overflow, no console errors, axe clean`, async ({ page }) => {
        const problems = watchConsole(page);
        const res = await page.goto(`${l.prefix}${route}`);
        expect(res!.status()).toBeLessThan(400);
        await expect(page.locator("html")).toHaveAttribute("lang", l.name);
        await expect(page.locator("html")).toHaveAttribute("dir", l.dir);
        // The admin shell shows only its own "not connected" notice (no page heading) when there is no database.
        await expect((route.startsWith("/admin") ? page.getByTestId("empty-state") : page.locator("h1")).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
        expect(problems).toEqual([]);
      });
    }
  });
}

test("Arabic and Urdu show their own words, not English", async ({ page }) => {
  await page.goto("/ar/asma");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("أسماء الله");
  await expect(page.getByTestId("recognition-note")).toContainText("لا تحدد هذه المنصة");
  await page.goto("/ur/asma/dua");
  await expect(page.getByTestId("dua-guidance")).toContainText("حوالہ");
  await expect(page.getByTestId("composer-stamp")).toContainText("آپ کے اپنے الفاظ");
  await page.goto("/ar/asma/ism-al-azam");
  await expect(page.locator("main")).toContainText("لا تحدد هذه المنصة اسماً بأنه الاسم الأعظم");
});

/**
 * The same components with data in them, on the test-only fixture page (404 outside QITL_E2E_FIXTURES=1): the AI-draft banner,
 * three separate measures, the gallery, a highlighted occurrence and the learning studio, in each language.
 */
for (const l of LOCALES) {
  test(`${l.prefix}/asma-fixture: data-bearing components, ${l.dir}, axe clean, the matched word is highlighted`, async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(`${l.prefix}/asma-fixture`);
    await expect(page.locator("html")).toHaveAttribute("dir", l.dir);
    await expect(page.getByTestId("ai-draft-banner")).toBeVisible();
    await expect(page.getByTestId("measures").getByTestId("measure-A")).toContainText("3");
    await expect(page.getByTestId("measures")).not.toContainText("4"); // 3 + 0 + 1 is never shown
    await expect(page.getByTestId("fx-occurrences").locator("mark")).toHaveCount(1);
    await expect(page.getByTestId("fx-occurrences").locator("mark")).toHaveText("قل");
    await expect(page.getByTestId("names-grid").getByRole("listitem")).toHaveCount(3);
    await expect(page.getByTestId("flashcard")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test("the gallery on the fixture page searches, sorts and filters in the browser", async ({ page }) => {
  await page.goto("/asma-fixture");
  await page.getByLabel("Search the Names").fill("two");
  await expect(page.getByTestId("names-grid").getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Search the Names").fill("");
  await page.getByLabel("Sort").selectOption("exact");
  await expect(page.getByTestId("names-grid").getByRole("listitem").first()).toContainText("Fixture Three");
  await page.getByLabel("Show").selectOption("noExact");
  await expect(page.getByTestId("names-grid").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByTestId("gallery-count")).toContainText("1 shown");
});

test("the learning studio on the fixture page: a card, the answer, a rating, and a quiz", async ({ page }) => {
  await page.goto("/asma-fixture");
  await page.getByRole("button", { name: "Show the answer" }).click();
  await page.getByRole("button", { name: "I remembered" }).click();
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Start a quiz" }).click();
  await page.getByTestId("quiz").locator("button.as-option").first().click();
  await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
});
