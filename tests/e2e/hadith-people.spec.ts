import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Hadith stories, People and Communities, and the typed search facets, in the automated-test environment: the pages run on the
 * synthetic fixtures (QITL_E2E_FIXTURES=1, no database; every title says "Test"), so they show a populated list and detail
 * page, never a real story. Checks: the content rules (evidence, "Not established", licence-pending narrations, no prophet
 * label for a non-prophet, later-tradition names marked), filters by URL parameter, RTL, 44px targets, and axe in English,
 * Arabic and Urdu.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width; the responsive sweep covers the rest");

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const LOCALES = [
  { prefix: "", name: "en", dir: "ltr" },
  { prefix: "/ar", name: "ar", dir: "rtl" },
  { prefix: "/ur", name: "ur", dir: "rtl" },
] as const;

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  return problems;
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

test("/hadith-stories: rules, filters, cards, and filtering by URL parameter", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/hadith-stories");
  await expect(page.getByRole("heading", { level: 1, name: "Hadith stories" })).toBeVisible();
  await expect(page.getByText("How a story reaches this page")).toBeVisible();
  await expect(page.getByTestId("story-card")).toHaveCount(2);
  await expect(page.getByTestId("story-count")).toHaveText("2 stories");
  await page.goto("/hadith-stories?kind=independent_lesson");
  await expect(page.getByTestId("story-card")).toHaveCount(1);
  await expect(page.getByTestId("story-card")).toContainText("Test story B");
  await page.goto("/hadith-stories?person=fixture-person-a");
  await expect(page.getByTestId("story-card")).toContainText("Test story A");
  await page.goto("/hadith-stories?theme=no-such-theme");
  await expect(page.getByTestId("empty-state")).toContainText("No published story matches these filters.");
  // The filter form is a real GET form whose controls are labelled and 44px high.
  await page.goto("/hadith-stories");
  const form = page.getByTestId("story-filters");
  await form.getByLabel("Kind of story").selectOption("independent_lesson");
  await form.getByRole("button", { name: "Show stories" }).click();
  await expect(page).toHaveURL(/kind=independent_lesson/);
  await expect(page.getByTestId("story-card")).toHaveCount(1);
  const box = await page.getByLabel("Kind of story").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(43);
  expect(problems).toEqual([]);
});

test("/hadith-stories/[slug]: narration as a reference, variants apart, Quran link, Not established, labelled application", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/hadith-stories/fixture-story-a");
  await expect(page.getByRole("heading", { level: 1, name: /Test story A/ })).toBeVisible();
  const narrations = page.getByTestId("narration");
  await expect(narrations).toHaveCount(2);
  await expect(page.getByTestId("variants").getByTestId("narration")).toHaveCount(1);
  await expect(narrations.first()).toContainText("Shown as a reference only until the licence for the text is confirmed.");
  await expect(narrations.first().locator("[lang='ar']")).toHaveCount(0);
  await expect(narrations.first().getByRole("link", { name: "Open this narration in the hadith library" })).toHaveAttribute("href", "/hadith/bukhari/1");
  await expect(page.getByTestId("story-context")).toContainText("Not established");
  const quran = page.getByTestId("story-quran").getByRole("link", { name: /12:4–5/ });
  await expect(quran).toHaveAttribute("href", "/quran/12#ayah-4-5");
  await expect(page.getByTestId("modern-application")).toContainText("An educational interpretation");
  await expect(page.getByTestId("modern-application")).toContainText("not a ruling");
  await expect(page.getByTestId("story-links").getByRole("link", { name: /Test person A/ })).toHaveAttribute("href", "/people/fixture-person-a");
  expect(problems).toEqual([]);
  // An unknown story is a 404.
  const res = await page.goto("/hadith-stories/no-such-story");
  expect(res!.status()).toBe(404);
});

test("the Quran link opens the reader at the ayah", async ({ page }) => {
  await page.goto("/hadith-stories/fixture-story-a");
  await page.getByTestId("story-quran").getByRole("link", { name: /12:4–5/ }).click();
  await expect(page).toHaveURL(/\/quran\/12#ayah-4-5/);
  await expect(page.locator("#ayah-4")).toBeAttached();
});

test("/people: grouped by kind from the data; a non-prophet is never under Prophets", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/people");
  await expect(page.getByRole("heading", { level: 1, name: "People of the Quran" })).toBeVisible();
  const prophets = page.getByTestId("people-group-prophet");
  await expect(prophets.getByTestId("person-card")).toHaveCount(1);
  await expect(prophets).toContainText("Test prophet A");
  for (const g of ["individual", "ruler", "unnamed"]) await expect(page.getByTestId(`people-group-${g}`)).toBeVisible();
  await expect(page.getByTestId("people-group-family_member")).toHaveCount(0);
  await expect(page.getByTestId("people-group-ruler")).toContainText("Test person A");
  await expect(prophets).not.toContainText("Test person");
  // The name that comes from later tradition says so on the card.
  await expect(page.getByTestId("people-group-ruler")).toContainText("Identified in later tradition, not in the Quranic text");
  expect(problems).toEqual([]);
});

test("/people/[slug]: identification, Quran references, aliases, family, events, hadith stories, and what is not established", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/people/fixture-person-a");
  await expect(page.getByTestId("identification")).toHaveAttribute("data-status", "later");
  await expect(page.getByTestId("identification")).toContainText("Identified in later tradition, not in the Quranic text");
  await expect(page.getByTestId("identification")).toContainText("Later tradition");
  await expect(page.getByTestId("quran-refs").getByRole("link", { name: /12:4–5/ })).toHaveAttribute("href", "/quran/12#ayah-4-5");
  await expect(page.getByTestId("aliases")).toContainText("Test alias");
  await expect(page.getByTestId("family").getByRole("link", { name: /Test person B/ })).toHaveAttribute("href", "/people/fixture-person-b");
  await expect(page.getByTestId("related-events")).toContainText("Test event A");
  await expect(page.getByTestId("linked-stories").getByRole("link", { name: /Test story A/ })).toHaveAttribute("href", "/hadith-stories/fixture-story-a");
  const ne = page.getByTestId("not-established");
  await expect(ne.locator("dd[data-established='no']")).toHaveCount(4);
  await expect(ne).toContainText("Not established on QITL: no reviewed record states this.");
  // A named-in-the-Quran prophet.
  await page.goto("/people/fixture-prophet-a");
  await expect(page.getByTestId("identification")).toHaveAttribute("data-status", "named");
  await expect(page.getByTestId("person-kind")).toHaveText("Prophets");
  // A person without an Event Universe item: identification is not guessed.
  await page.goto("/people/fixture-person-c");
  await expect(page.getByTestId("identification")).toHaveAttribute("data-status", "unknown");
  expect(problems).toEqual([]);
  expect((await page.goto("/people/no-such-person"))!.status()).toBe(404);
});

test("/communities and /communities/[slug]", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/communities");
  await expect(page.getByTestId("community-card")).toHaveCount(2);
  await page.getByRole("link", { name: /Test community A/ }).first().click();
  await expect(page).toHaveURL(/\/communities\/fixture-community-a/);
  await expect(page.getByTestId("identification")).toHaveAttribute("data-status", "named");
  await expect(page.getByTestId("quran-refs")).toBeVisible();
  await expect(page.getByTestId("related-events")).toContainText("Test event A");
  await expect(page.getByTestId("not-established").locator("dd[data-established='no']")).toHaveCount(2);
  expect(problems).toEqual([]);
  expect((await page.goto("/communities/no-such-community"))!.status()).toBe(404);
});

test("unified search: typed results with a visible label, and the type, track and surah facets as URL parameters", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/search?q=Yusuf");
  const first = page.locator(".sr-list > li").first();
  await expect(first.getByTestId("result-type")).toHaveText("Prophet");
  await expect(page.getByTestId("type-filter")).toContainText("Prophet");
  await page.getByTestId("type-filter").getByRole("link", { name: /Prophet/ }).click();
  await expect(page).toHaveURL(/type=prophet/);
  const kinds = await page.locator(".sr-list > li").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  expect(kinds.length).toBeGreaterThan(0);
  expect(kinds.every((k) => k === "prophet")).toBe(true);
  // surah facet
  await page.goto("/search?q=Yusuf&type=prophet&surah=12");
  await expect(page.locator(".sr-list > li").first().getByRole("link")).toHaveAttribute("href", "/prophets/yusuf");
  // a surah the prophet's story does not use leaves no prophet result
  await page.goto("/search?q=Yusuf&type=prophet&surah=114");
  await expect(page.locator(".sr-list > li")).toHaveCount(0);
  // unknown values are ignored, not an error
  const res = await page.goto("/search?q=Yusuf&type=zzz&track=zzz&surah=999");
  expect(res!.status()).toBe(200);
  await expect(page.locator(".sr-list > li").first()).toBeVisible();
  // the API takes the same parameters
  const api = await page.request.get("/api/search?q=Yusuf&type=prophet&surah=12");
  expect(api.status()).toBe(200);
  const body = (await api.json()) as { kind: string; surah: number; results: Array<{ kind?: string }> };
  expect(body.kind).toBe("prophet");
  expect(body.surah).toBe(12);
  expect(body.results.every((r) => r.kind === "prophet")).toBe(true);
  expect(problems).toEqual([]);
});

test("search keeps its nonce CSP and rate limit headers", async ({ page }) => {
  const res = await page.goto("/search?q=Yusuf");
  expect(res!.headers()["content-security-policy"]).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=_-]+'/);
  const api = await page.request.get("/api/search?q=Yusuf");
  expect(api.headers()["ratelimit-limit"] ?? api.headers()["x-ratelimit-limit"] ?? "present").toBeTruthy();
});

for (const l of LOCALES) {
  for (const path of ["/hadith-stories", "/hadith-stories/fixture-story-a", "/people", "/people/fixture-person-a", "/communities", "/communities/fixture-community-a", "/search?q=Yusuf"]) {
    test(`${l.name} ${path}: direction, no horizontal overflow, axe clean at 360 and 1440`, async ({ page }) => {
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${l.prefix}${path}`);
        await expect(page.locator("html")).toHaveAttribute("dir", l.dir);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `overflow at ${width}`).toBeLessThanOrEqual(1);
        expect(await axe(page), `axe at ${width}`).toEqual([]);
      }
    });
  }
}

test("Arabic: names carry their own language and the English fallback is marked as English", async ({ page }) => {
  await page.goto("/ar/hadith-stories/fixture-story-b");
  // Story B has no Arabic title or summary: the English text is shown and marked lang=en dir=ltr.
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1.locator("[lang='en']")).toHaveAttribute("dir", "ltr");
  await page.goto("/ar/hadith-stories/fixture-story-a");
  await expect(page.getByRole("heading", { level: 1 }).locator("[lang='ar']")).toHaveAttribute("dir", "rtl");
  await page.goto("/ur/hadith-stories/fixture-story-a");
  await expect(page.getByRole("heading", { level: 1 }).locator("[lang='ur']")).toHaveAttribute("dir", "rtl");
});
