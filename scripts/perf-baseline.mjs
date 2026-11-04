/**
 * Performance baseline: loads key pages in headless Chromium (no throttling, cold cache each time) and records navigation timing,
 * First Contentful Paint, Largest Contentful Paint, layout shift, transfer size and request count, at a desktop and a phone
 * viewport. The numbers are written to docs/PERFORMANCE_BASELINE.md. They describe THIS machine and network on THIS date and are
 * for comparing before and after a change on the same setup, not absolute scores.
 *
 *   node scripts/perf-baseline.mjs https://qitl.vercel.app
 */
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://qitl.vercel.app";
const PAGES = ["/", "/hub/learn", "/quran/1", "/quran/12", "/prophets/yusuf", "/drafts/yusuf", "/timeline", "/creation", "/guidance/grief-and-loss", "/verification", "/ar", "/ur"];
const VIEWPORTS = [
  { name: "desktop 1440", width: 1440, height: 900, mobile: false },
  { name: "phone 390", width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch();
const rows = [];
for (const vp of VIEWPORTS) {
  for (const path of PAGES) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
      const page = await ctx.newPage();
      let bytes = 0;
      let reqs = 0;
      page.on("response", async (r) => {
        reqs++;
        const len = Number(r.headers()["content-length"] ?? 0);
        bytes += len;
      });
      await page.addInitScript(() => {
        window.__m = { lcp: 0, cls: 0 };
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(base + path, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        return { ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, fcp: fcp ? fcp.startTime : 0, lcp: window.__m.lcp, cls: window.__m.cls, js: performance.getEntriesByType("resource").filter((e) => e.initiatorType === "script").reduce((s, e) => s + (e.encodedBodySize || 0), 0) };
      });
      runs.push({ ...m, bytes, reqs });
      await ctx.close();
    }
    const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[1];
    rows.push({ vp: vp.name, path, ttfb: med("ttfb"), fcp: med("fcp"), lcp: med("lcp"), load: med("load"), cls: med("cls"), jsKB: med("js") / 1024, reqs: med("reqs") });
    console.log(vp.name, path, Math.round(med("fcp")), Math.round(med("lcp")));
  }
}
await browser.close();
const f = (n) => Math.round(n);
const md = ["# Performance baseline", "", `Measured ${new Date().toISOString().slice(0, 10)} against ${base} with headless Chromium, no throttling, cold cache, median of 3 runs per page. These numbers describe this machine and network on this date; use them to compare before and after a change on the same setup, not as absolute scores.`, "", "| Viewport | Page | TTFB ms | FCP ms | LCP ms | Load ms | CLS | Script KB (encoded) | Requests |", "|---|---|---|---|---|---|---|---|---|"];
for (const r of rows) md.push(`| ${r.vp} | \`${r.path}\` | ${f(r.ttfb)} | ${f(r.fcp)} | ${f(r.lcp)} | ${f(r.load)} | ${r.cls.toFixed(3)} | ${f(r.jsKB)} | ${r.reqs} |`);
md.push("", "Reading it: LCP under about 2500 ms and CLS under 0.1 are the usual \"good\" thresholds; anything above them is a candidate to investigate, not proof of a problem on a visitor's device.", "");
writeFileSync("docs/PERFORMANCE_BASELINE.md", md.join("\n"));
console.log("wrote docs/PERFORMANCE_BASELINE.md");
