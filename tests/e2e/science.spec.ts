import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Quran & Science without a database (the build for these specs has the Supabase variables blanked): every page shows its designed
 * "not connected" state with the DRAFT inventory read from the repository, labelled as such; never a rating, never a verified badge.
 * The data-bearing components are exercised on the test-only /science-fixture page. Runs in English, Arabic (RTL) and Urdu (RTL),
 * on desktop and mobile, without horizontal overflow, console errors or axe violations.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const LOCALES = [
  { prefix: "", name: "en", dir: "ltr" },
  { prefix: "/ar", name: "ar", dir: "rtl" },
  { prefix: "/ur", name: "ur", dir: "rtl" },
] as const;
const PAGES = [
  "/science",
  "/science/sky-built-and-widened-51-47",
  "/science/unseen-matters-2-3",
  "/science/questions",
  "/science/timeline",
  "/science/journeys",
  "/science-fixture",
  "/admin/science",
];

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  return problems;
}

test("/science: disclosure, the three assessments, the not-connected state and 13 unrated draft cards", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/science");
  await expect(page.getByRole("heading", { level: 1, name: "Quran & Science Discovery Center" })).toBeVisible();
  await expect(page.getByTestId("science-disclosure")).toContainText("scientific and scholarly review pending");
  await expect(page.getByTestId("science-principles").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId("unseen-note")).toContainText("not described as awaiting laboratory proof");
  await expect(page.getByTestId("empty-state")).toContainText("not connected");
  await expect(page.getByTestId("topic-card")).toHaveCount(13);
  await expect(page.getByTestId("science-count")).toHaveText("13 topics");
  // nothing is rated and nothing is verified
  await expect(page.locator('[data-testid="assess-evidence"] li[data-value="established"]')).toHaveCount(0);
  await expect(page.locator(".vf-badge", { hasText: /^\s*Verified\s*$/ })).toHaveCount(0);
  await expect(page.locator('[data-testid="topic-card"][data-origin="draft_file"]')).toHaveCount(13);
  // three dated milestones exist only on the first topic; the other cards say none is verified
  await expect(page.getByTestId("card-milestone").filter({ hasText: "1922" })).toHaveCount(1);
  await expect(page.getByTestId("card-milestone").filter({ hasText: "No discovery date verified yet" })).toHaveCount(12);
  expect(problems).toEqual([]);
});

test("/science filters: by discipline, evidence state, relationship, and search", async ({ page }) => {
  await page.goto("/science?discipline=cosmology");
  await expect(page.getByTestId("topic-card")).toHaveCount(2);
  await page.goto("/science?evidence=outside_empirical_science");
  await expect(page.getByTestId("topic-card")).toHaveCount(2);
  await page.goto("/science?evidence=established");
  await expect(page.getByTestId("topic-card")).toHaveCount(0);
  await expect(page.getByTestId("science-none")).toBeVisible();
  await page.goto("/science?relationship=not_scientifically_testable");
  await expect(page.getByTestId("topic-card")).toHaveCount(1);
  await page.goto("/science?q=51%3A47");
  await expect(page.getByTestId("topic-card")).toHaveCount(1);
  // the form works without a script
  await page.goto("/science");
  await page.getByLabel("Discipline").selectOption("biology");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/discipline=biology/);
  await expect(page.getByTestId("topic-card")).toHaveCount(3);
  // a hostile filter value is ignored, not reflected
  await page.goto("/science?discipline=%3Cscript%3E&evidence=bogus");
  await expect(page.getByTestId("topic-card")).toHaveCount(13);
});

test("a topic page: 17 sections, the corpus text, a dated milestone with its source, the interpretive-link label and the 'does not establish' section", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/science/sky-built-and-widened-51-47");
  await expect(page.locator("main section.sc-section")).toHaveCount(17);
  await expect(page.getByTestId("does-not-establish")).toContainText("does not claim that the verse predicted the expansion");
  await expect(page.getByTestId("does-not-establish")).toContainText("Nothing here is a scientific proof of the Quran");
  await expect(page.getByTestId("passage").first().locator(".sc-ayah")).toContainText("لَمُوسِعُونَ");
  await expect(page.getByTestId("terms")).toContainText("لَمُوسِعُونَ");
  await expect(page.getByTestId("interpretive-link")).toContainText("proposal");
  const dated = page.getByTestId("milestones").locator('li[data-dated="true"]');
  await expect(dated).toHaveCount(3);
  await expect(dated.first()).toContainText("1922");
  await expect(dated.first().getByRole("link", { name: "Source checked" })).toHaveAttribute("href", /api\.crossref\.org\/works\/10\.1007/);
  await expect(page.getByTestId("milestones").locator('li[data-dated="false"]')).toContainText("Not yet verified");
  // translation is unavailable, tafsir is a placeholder, no publication is verified, and no rating is shown
  await expect(page.locator("#translation")).toContainText("No licensed translation");
  await expect(page.getByTestId("interpretation").first()).toHaveAttribute("data-status", "needs_source");
  await expect(page.getByTestId("no-publications")).toBeVisible();
  await expect(page.getByTestId("review-scientific")).toContainText("Not reviewed");
  await expect(page.getByTestId("review-scholarly")).toContainText("Not reviewed");
  await expect(page.locator(".vf-badge", { hasText: "AI-Assisted Draft" }).first()).toBeVisible();
  await expect(page.getByTestId("draft-file-note")).toBeVisible();
  expect(problems).toEqual([]);
});

test("the unseen topic is outside empirical science and never awaiting proof", async ({ page }) => {
  await page.goto("/science/unseen-matters-2-3");
  await expect(page.getByTestId("assess-evidence").first()).toContainText("Outside empirical science");
  await expect(page.getByTestId("assess-relationship").first()).toContainText("Not scientifically testable");
  await expect(page.getByTestId("does-not-establish")).toContainText("does not treat them as open to laboratory testing");
  await expect(page.locator("main")).not.toContainText(/awaiting (laboratory|scientific|empirical) (proof|confirmation)/i);
});

test("unknown and malformed topics are 404", async ({ page }) => {
  expect((await page.goto("/science/no-such-topic"))!.status()).toBe(404);
  expect((await page.goto("/science/Bad%20Slug"))!.status()).toBe(404);
});

test("questions: an open question with what is known and uncertain, never framed as awaiting proof", async ({ page }) => {
  await page.goto("/science/questions");
  await expect(page.getByTestId("open-question").first()).toContainText("What is known");
  await expect(page.getByTestId("open-question").first()).toContainText("What is uncertain");
  await expect(page.getByTestId("open-question").first()).toContainText("Why a Quranic connection is proposed");
  await expect(page.getByTestId("unavailable").first()).toContainText("Awaiting a scientific reviewer");
  await expect(page.locator("main")).not.toContainText(/awaiting (laboratory|scientific|empirical) proof/i);
});

test("timeline: two layers with switches; a year only with its source", async ({ page }) => {
  await page.goto("/science/timeline");
  await expect(page.getByTestId("layer-a").first()).toBeVisible();
  await expect(page.getByTestId("layer-b").first()).toBeVisible();
  await expect(page.getByTestId("layer-b").first()).toContainText("1929");
  await page.goto("/science/timeline?layer=a");
  await expect(page.getByTestId("layer-b")).toHaveCount(0);
  await expect(page.getByTestId("layer-a").first()).toBeVisible();
  await page.goto("/science/timeline?layer=b");
  await expect(page.getByTestId("layer-a")).toHaveCount(0);
  await expect(page.getByTestId("layer-switch").locator('a[aria-current="page"]')).toHaveText("Layer B only");
});

test("journeys: five audiences, every one a placeholder", async ({ page }) => {
  await page.goto("/science/journeys");
  await expect(page.getByTestId("journey")).toHaveCount(5);
  await expect(page.getByTestId("journey").first().getByTestId("unavailable")).toBeVisible();
});

test("fixture: ratings are separate, Verified appears only with both reviews, and a one-review topic is not Verified", async ({ page }) => {
  await page.goto("/science-fixture");
  const card = (slug: string) => page.locator(`[data-testid="topic-card"][data-slug="${slug}"]`);
  await expect(card("fixture-verified").locator(".vf-badge")).toHaveText(/Verified/);
  await expect(card("fixture-verified").getByTestId("card-milestone")).toContainText("1900");
  await expect(card("fixture-verified").getByTestId("assess-evidence")).toContainText("Well supported");
  await expect(card("fixture-verified").getByTestId("assess-interpretation")).toContainText("Plausible interpretive connection");
  await expect(card("fixture-verified").getByTestId("assess-connection")).toContainText("Limited");
  await expect(card("fixture-verified").getByTestId("assess-relationship")).toContainText("Consistent interpretation");
  await expect(card("fixture-draft").locator(".vf-badge")).toHaveText(/AI-Assisted Draft/);
  await expect(card("fixture-draft").getByTestId("assess-evidence")).toContainText("Not yet assessed");
  await expect(card("fixture-mixed").locator(".vf-badge")).not.toHaveText(/^\s*Verified/);
  await expect(card("fixture-rejected").locator(".vf-badge")).toHaveText(/Rejected/);
  // no combined score anywhere
  await expect(page.locator("main")).not.toContainText(/score|%|\/10/i);
});

test("/admin/science: staff-only; shows the not-connected state", async ({ page }) => {
  await page.goto("/admin/science");
  await expect(page.getByTestId("empty-state").first()).toBeVisible();
  await expect(page.getByTestId("science-admin")).toHaveCount(0);
});

test("the Explore navigation and the sitemap list Quran & Science", async ({ page, request }) => {
  await page.goto("/science");
  await expect(page.locator('a[href="/science"]').first()).toBeAttached();
  const res = await request.get("/sitemap.xml");
  expect(await res.text()).toContain("/science");
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

test("Arabic and Urdu show their own words and the disclosure and 'does not establish' text in their language", async ({ page }) => {
  await page.goto("/ar/science");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مركز القرآن والعلم للاستكشاف");
  await expect(page.getByTestId("science-disclosure")).toContainText("المراجعة العلمية والشرعية معلّقة");
  await page.goto("/ur/science/sky-built-and-widened-51-47");
  await expect(page.getByTestId("does-not-establish")).toContainText("بذاتِ خود");
  await expect(page.getByTestId("science-disclosure")).toContainText("سائنسی اور علمی جائزہ باقی");
  await page.goto("/ar/science/the-bee-16-68-69");
  await expect(page.getByTestId("does-not-establish")).toContainText("لا تقدّم هذه الصفحة أي ادعاء طبي");
});
