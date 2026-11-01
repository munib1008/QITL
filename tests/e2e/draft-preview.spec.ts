import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const index = JSON.parse(readFileSync(join(process.cwd(), "src", "generated", "story-drafts.json"), "utf8")) as { stories: unknown };

/**
 * Draft preview (/drafts): unreviewed AI-written story drafts, shown only as a separate "Draft preview". Runs in both
 * projects (390 and 1440 px). Uses the drafts that exist in content/stories: the list is checked against the generated
 * index, one story per subject type that has a draft is opened.
 */
const stories = index.stories as Array<{ slug: string; type: string; chapters: Array<{ anchor: string; verses: Array<{ surah: number; from: number; to: number }> }> }>;
const BANNER = "NOT yet reviewed by a scholar";

async function axe(page: Page) {
  const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return a.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function recordFlashes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __flashes: string[] };
    w.__flashes = [];
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (r.attributeName === "class" && el.classList?.contains("qr-flash") && !(r.oldValue ?? "").includes("qr-flash")) w.__flashes.push(el.id);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
}

test("the list: banner, counts per type, grouped, filter by ?type=", async ({ page }) => {
  const res = await page.goto("/drafts");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("draft-banner")).toContainText(BANNER);
  await expect(page.getByTestId("draft-banner")).toContainText("Draft preview — review pending.");
  await expect(page.getByTestId("review-pending")).toHaveText("Review: pending");
  await expect(page.getByTestId("draft-banner").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("draft-card")).toHaveCount(stories.length);
  const types = [...new Set(stories.map((s) => s.type))];
  for (const ty of types) {
    const n = stories.filter((s) => s.type === ty).length;
    await expect(page.getByTestId(`group-${ty}`).getByTestId("draft-card")).toHaveCount(n);
    await expect(page.getByTestId("draft-filters").locator(`[data-type="${ty}"]`)).toContainText(`(${n})`);
  }
  await page.goto(`/drafts?type=${types[0]}`);
  await expect(page.getByTestId("draft-card")).toHaveCount(stories.filter((s) => s.type === types[0]).length);
  await expect(page.getByTestId("draft-banner")).toBeVisible();
  // search
  await page.goto("/drafts");
  await page.locator("form.dp-search").getByRole("searchbox").fill("yusuf");
  await page.locator("form.dp-search").getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=yusuf/);
  // Several drafts mention Yusuf (his story and the events of it): the search narrows the list, and his own story is among them.
  const found = await page.getByTestId("draft-card").count();
  expect(found).toBeGreaterThanOrEqual(1);
  expect(found).toBeLessThan(stories.length);
  await expect(page.locator('a[data-testid="draft-card"][href$="/drafts/yusuf"]')).toHaveCount(1);
  expect(await sideways(page)).toBeLessThanOrEqual(1);
});

test("one story of every type that exists opens with banner, chapters and a pending review", async ({ page }) => {
  const types = [...new Set(stories.map((s) => s.type))];
  expect(types.length).toBeGreaterThan(0);
  for (const ty of types) {
    const s = stories.find((x) => x.type === ty)!;
    const res = await page.goto(`/drafts/${s.slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("draft-banner")).toContainText(BANNER);
    await expect(page.getByTestId("draft-chapter")).toHaveCount(s.chapters.length);
    await expect(page.locator(`#chapter-${s.chapters[0]!.anchor}`)).toBeAttached();
    await expect(page.getByTestId("review-status")).toContainText("Pending");
    await expect(page.getByTestId("scholar-checklist").locator("li")).toHaveCount(12);
    await expect(page.locator("[data-quran-attribution]")).toHaveCount(1);
  }
  expect((await page.goto("/drafts/no-such-draft"))?.status()).toBe(404);
});

test("noindex: meta robots, X-Robots-Tag, a title that says Draft, and absent from the sitemap", async ({ page, request, context }) => {
  for (const url of ["/drafts", "/drafts/yusuf", "/ar/drafts/yusuf", "/ur/drafts"]) {
    const res = await page.goto(url);
    expect(res?.headers()["x-robots-tag"]).toMatch(/noindex/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /nofollow/);
  }
  await context.clearCookies(); // the visits above to /ar and /ur set the language cookie
  await page.goto("/drafts/yusuf");
  expect(await page.title()).toMatch(/Draft/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Draft/);
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).not.toContain("/drafts");
});

test("modes: the switch changes the text, keeps ?mode= and works from the keyboard", async ({ page }) => {
  await page.goto("/drafts/yusuf");
  const modes = page.getByTestId("reader-modes");
  await expect(modes.getByRole("radio")).toHaveCount(5);
  await expect(modes.locator("[data-mode='complete']")).toHaveAttribute("aria-checked", "true");
  const first = page.getByTestId("draft-chapter").first().locator(".dp-text");
  const complete = await first.innerText();
  await modes.getByRole("radio", { name: "One-minute summary" }).click();
  await expect(page).toHaveURL(/mode=summary/);
  await expect(first).not.toHaveText(complete);
  await modes.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(modes.locator("[data-mode='complete']")).toHaveAttribute("aria-checked", "true");
  await modes.getByRole("radio", { name: "Life lessons" }).click();
  await expect(page.getByTestId("draft-chapter").first()).toContainText("Educational interpretation (not scripture)");
  // a shared link keeps the mode
  await page.goto("/drafts/yusuf?mode=kids");
  await expect(page.getByTestId("reader-modes").locator("[data-mode='kids']")).toHaveAttribute("aria-checked", "true");
});

test("claim markers open the evidence panel at the claim", async ({ page }) => {
  await page.goto("/drafts/yusuf");
  const chapter = page.getByTestId("draft-chapter").first();
  const marker = chapter.locator('.dp-text a[href^="#claim-"]').first();
  const href = (await marker.getAttribute("href"))!;
  await expect(chapter.getByTestId("chapter-evidence")).not.toHaveAttribute("open", "");
  await marker.click();
  await expect(chapter.getByTestId("chapter-evidence")).toHaveAttribute("open", "");
  await expect(page.locator(href)).toBeInViewport();
});

test("a cited range is a link into the reader, the ayat glow there, and the Arabic is shown", async ({ page }) => {
  await recordFlashes(page);
  await page.goto("/drafts/yusuf");
  const chapter = page.getByTestId("draft-chapter").first();
  const r = stories.find((s) => s.slug === "yusuf")!.chapters[0]!.verses[0]!;
  await expect(chapter.getByTestId("cited-ayat").locator("p.zq-ar-quran").first()).toBeVisible();
  await expect(chapter.getByTestId("cited-ayat").locator("p.zq-ar-quran").first()).toHaveAttribute("lang", "ar");
  const hash = r.to > r.from ? `#ayah-${r.from}-${r.to}` : `#ayah-${r.from}`;
  const link = chapter.getByTestId("cited-ayat").locator(`a[href="/quran/${r.surah}${hash}"]`).first();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/quran/${r.surah}${hash}$`));
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __flashes: string[] }).__flashes)).includes(`ayah-${r.from}`)).toBe(true);
});

test("the draft pages are not in Explore, the home page or the About page's main links, but About carries one discreet link", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href="/drafts"]')).toHaveCount(0);
  await page.goto("/about");
  await expect(page.locator('main a[href="/drafts"]')).toHaveCount(1);
  await expect(page.locator('main a[href="/drafts"]')).toHaveText("Draft preview of stories under review");
});

for (const l of [
  { code: "en", prefix: "" },
  { code: "ar", prefix: "/ar" },
  { code: "ur", prefix: "/ur" },
]) {
  test.describe(`${l.code}`, () => {
    for (const path of ["/drafts", "/drafts?type=prophet", "/drafts/yusuf", "/drafts/yusuf?mode=deep"]) {
      test(`${path}: banner, direction, axe clean, no sideways scroll`, async ({ page, context, baseURL }) => {
        await context.addCookies([{ name: "qitl-locale", value: l.code, url: baseURL ?? "http://localhost:3100" }]);
        const res = await page.goto(`${l.prefix}${path}`);
        expect(res?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("dir", l.code === "en" ? "ltr" : "rtl");
        const banner = page.getByTestId("draft-banner");
        await expect(banner).toBeVisible();
        if (l.code === "en") await expect(banner).toContainText(BANNER);
        else await expect(banner).not.toContainText("Draft preview");
        if (path.startsWith("/drafts/yusuf")) {
          // English story text keeps its language and direction inside the Arabic and Urdu pages
          if (l.code !== "en") await expect(page.locator(".dp-text").first()).toHaveAttribute("lang", "en");
        }
        expect(await sideways(page)).toBeLessThanOrEqual(1);
        expect(await axe(page)).toEqual([]);
      });
    }
  });
}

test("controls are at least 44px: mode switch, filters, search", async ({ page }) => {
  await page.goto("/drafts");
  for (const el of await page.locator(".dp-filters a, .dp-search button, .dp-search input").all()) {
    const b = (await el.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(43.5);
  }
  await page.goto("/drafts/yusuf");
  for (const el of await page.getByTestId("reader-modes").getByRole("radio").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
});
