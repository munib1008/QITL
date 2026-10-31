import { expect, test, type Page } from "@playwright/test";
import { ROUTES } from "./routes";

/**
 * Interface language guard (docs/I18N.md, docs/LOCALISATION_STATUS.md): in /ar and /ur no route may render common
 * English interface words outside content that is marked English (lang="en", e.g. database rows and editorial pages).
 * It is a heuristic: the word list is interface vocabulary that never appears in names or references.
 */
test.skip(() => test.info().project.name !== "desktop", "one project is enough for text checks");

/** English interface words and phrases (case-sensitive, whole words). */
const ENGLISH_UI = [
  "Skip to content",
  "Sign in",
  "Sign out",
  "Search",
  "Home",
  "Breadcrumb",
  "Coming soon",
  "Not yet written",
  "Not yet published",
  "Not yet attached",
  "None published yet",
  "Read the story",
  "Read more",
  "Bookmark",
  "Copy reference",
  "Loading",
  "Previous",
  "Next",
  "Discussion",
  "Sources",
  "Evidence",
  "Language",
  "Theme",
  "Retry",
  "Try again",
  "Cancel",
  "Share",
  "Close",
  "Show",
  "Legend",
  "Quick understanding",
  "Reading level",
  "On this page",
  "Related surahs",
  "Draft content",
  "pending scholarly review",
  "is not published",
  "are not open",
  "not connected",
  "Approximate region",
  "Location unknown",
  "Date unknown",
  "Relative order",
  "Translation unavailable",
  "licence pending",
  "Arabic text",
  "Text size",
  "Ask a question",
  "Private note",
  "Terms",
  "Privacy",
  "Accessibility",
  "Contact",
  "Methodology",
];
const RE = new RegExp(`(?<![A-Za-z])(${ENGLISH_UI.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z])`);

/** Visible interface text and accessible names outside English-marked content, each with where it was found. */
async function englishUi(page: Page): Promise<string[]> {
  return page.evaluate((source) => {
    const re = new RegExp(source);
    const out: string[] = [];
    // English-marked content inside the page; the <html lang> is the interface language itself.
    const markedEnglish = (el: Element | null) => {
      const c = el?.closest("[lang]");
      if (!c || c === document.documentElement) return false;
      const l = c.getAttribute("lang") ?? "";
      return l === "en" || l.startsWith("en-");
    };
    const visible = (el: Element) => {
      if (el.closest("script, style, noscript, template, [hidden], [aria-hidden=true]")) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent?.trim() ?? "";
      if (!el || !text || markedEnglish(el) || !visible(el)) continue;
      const m = re.exec(text);
      if (m) out.push(`text "${m[0]}" in <${el.tagName.toLowerCase()}>: ${text.slice(0, 80)}`);
    }
    for (const el of Array.from(document.body.querySelectorAll("[aria-label], [placeholder], [title]"))) {
      if (markedEnglish(el)) continue;
      for (const a of ["aria-label", "placeholder", "title"]) {
        const v = el.getAttribute(a);
        const m = v ? re.exec(v) : null;
        if (m) out.push(`${a} "${m[0]}" on <${el.tagName.toLowerCase()}>: ${v!.slice(0, 80)}`);
      }
    }
    return out;
  }, RE.source);
}

for (const locale of ["ar", "ur"] as const) {
  test.describe(`interface language ${locale}`, () => {
    for (const route of ROUTES) {
      test(`${locale} ${route} renders no English interface words`, async ({ page }) => {
        test.setTimeout(90_000);
        const url = route === "/" ? `/${locale}` : `/${locale}${route}`;
        const res = await page.goto(url, { waitUntil: "load" });
        expect(res?.status(), `${url} status`).toBeLessThan(500);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        // Client islands (session, discussions, bookmarks) render after hydration.
        await page.waitForTimeout(400);
        const found = await englishUi(page);
        expect(found, `${url}:\n${found.join("\n")}`).toEqual([]);
      });
    }
  });
}

test("switching the interface language keeps the page, the query and the #hash", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/prophets/yusuf#places");
  const sw = page.locator("header").getByRole("group", { name: "Language" });
  await sw.getByRole("link", { name: "اردو" }).click();
  await expect(page).toHaveURL(/\/ur\/prophets\/yusuf#places$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await page.evaluate(() => {
    window.location.hash = "discuss";
  });
  await page.locator("header").getByRole("group", { name: "زبان" }).getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/prophets\/yusuf#discuss$/);
  await page.locator("header").getByRole("group", { name: "اللغة" }).getByRole("link", { name: "English" }).click();
  // /en/... sets the cookie and redirects to the unprefixed URL; the browser keeps the fragment across the redirect.
  await expect(page).toHaveURL(/\/prophets\/yusuf#discuss$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/search?q=Yusuf");
  await page.locator("header").getByRole("group", { name: "Language" }).getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/search\?q=Yusuf$/);
});

test("English content inside Arabic and Urdu pages is marked lang=en dir=ltr", async ({ page }) => {
  await page.goto("/ur/about");
  const body = page.locator(".zq-prose").first();
  await expect(body).toHaveAttribute("lang", "en");
  await expect(body).toHaveAttribute("dir", "ltr");
  await page.goto("/ar/prophets/yusuf");
  await expect(page.locator("h1 [lang=en]").first()).toBeVisible();
});
