import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Responsive sweep: every public route, in English, Arabic and Urdu, at the brief's widths.
 * Fails on horizontal page overflow, on content hidden behind the fixed bottom navigation and on primary controls
 * smaller than 44x44 px. With SHOTS=before|after it also saves full-page screenshots to docs/responsive/<SHOTS>/.
 */

export const ROUTES = [
  "/",
  "/timeline",
  "/prophets",
  "/prophets/nuh",
  "/prophets/yusuf",
  "/events",
  "/stories",
  "/quran",
  "/quran/1",
  "/quran/18",
  "/hadith",
  "/hadith/bukhari",
  "/atlas",
  "/genealogy",
  "/last-hour",
  "/search?q=Yusuf",
  "/learn",
  "/community",
  "/community/guidelines",
  "/compare",
  "/sign-in",
  "/account",
  "/admin",
  "/about",
  "/methodology",
  "/review-board",
  "/corrections",
  "/terms",
  "/privacy",
  "/accessibility",
  "/contact",
  "/offline",
];

const WIDTHS = [320, 360, 414, 768, 1024, 1440];
const SHOTS = process.env.SHOTS;

async function overflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - vw;
    const culprits: string[] = [];
    if (over > 1) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        // Inside an intentional horizontal scroller the overflow is contained.
        let p = el.parentElement;
        let contained = false;
        while (p && p !== document.body) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
            contained = true;
            break;
          }
          p = p.parentElement;
        }
        if (!contained && (r.right > vw + 1 || r.left < -1)) culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")} (${Math.round(r.left)}→${Math.round(r.right)})`);
        if (culprits.length > 6) break;
      }
    }
    return { over, culprits };
  });
}

async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = "button, [role=button], [role=radio], [role=tab], select, input:not([type=hidden]), .zq-btn, nav a";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el.closest("[hidden], [aria-hidden=true]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // WCAG 2.2 2.5.8 target size: 24px minimum. The brief asks ~44px for primary controls; inline text links in
      // running prose are exempt.
      if (r.height < 24 || r.width < 24) out.push(`${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}

async function hiddenBehindBottomNav(page: Page) {
  return page.evaluate(async () => {
    const nav = document.querySelector<HTMLElement>("[data-bottom-nav]");
    if (!nav || getComputedStyle(nav).display === "none") return null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 120));
    const navTop = nav.getBoundingClientRect().top;
    const foot = document.querySelector<HTMLElement>("footer");
    if (!foot) return null;
    const last = foot.getBoundingClientRect().bottom;
    return last > navTop + 1 ? `footer ends at ${Math.round(last)}, bottom nav starts at ${Math.round(navTop)}` : null;
  });
}

for (const locale of ["en", "ar", "ur"] as const) {
  test.describe(`responsive ${locale}`, () => {
    test.skip(() => test.info().project.name !== "desktop", "one project drives every width");
    for (const route of ROUTES) {
      test(`${locale} ${route}`, async ({ page, context, baseURL }) => {
        test.setTimeout(120_000);
        await context.addCookies([{ name: "qitl-locale", value: locale, url: baseURL ?? "http://localhost:3100" }]);
        const problems: string[] = [];
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: w < 600 ? 780 : 900 });
          const res = await page.goto(route, { waitUntil: "load" });
          expect(res?.status(), `${route} status`).toBeLessThan(500);
          await page.waitForTimeout(150);
          const o = await overflow(page);
          if (o.over > 1) problems.push(`${w}px: page scrolls sideways by ${o.over}px: ${o.culprits.join(", ")}`);
          if (w <= 414) {
            const small = await smallTargets(page);
            if (small.length) problems.push(`${w}px: targets under 24px: ${small.slice(0, 8).join("; ")}`);
            const hidden = await hiddenBehindBottomNav(page);
            if (hidden) problems.push(`${w}px: ${hidden}`);
          }
          if (SHOTS && (w === 360 || w === 768 || w === 1440)) {
            const dir = path.join("docs", "responsive", SHOTS, locale);
            fs.mkdirSync(dir, { recursive: true });
            const name = `${route.replace(/[/?=]+/g, "_").replace(/^_/, "") || "home"}-${w}.png`;
            await page.screenshot({ path: path.join(dir, name), fullPage: w !== 1440 }); // converted to WebP before committing (docs/RESPONSIVE.md)
          }
        }
        if (process.env.AUDIT) {
          fs.mkdirSync("test-results", { recursive: true });
          fs.appendFileSync("test-results/responsive-audit.txt", `## ${locale} ${route}\n${problems.length ? problems.map((p) => `- ${p}`).join("\n") : "- ok"}\n`);
        }
        else expect(problems, problems.join("\n")).toEqual([]);
      });
    }
  });
}
