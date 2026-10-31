/**
 * Measures the Quran reader on a running production server (next start), for before/after comparisons:
 *
 *   node scripts/measure-reader.mjs [baseURL=http://localhost:3212] [runs=5]
 *
 * For each page and viewport it loads the page cold (new context, no cache) RUNS times and prints medians of: HTML
 * bytes, DOM elements, FCP, LCP, DOMContentLoaded, load, Total Blocking Time (long tasks over 50 ms until load + 2 s),
 * time until the reader is interactive (the A+ text-size button responds), and, for a deep link, the time until the
 * target ayah is lit. The 360px runs use 4x CPU throttling (a mid-range phone). Reads only; changes nothing.
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3212";
const RUNS = Number(process.argv[3] ?? 5);
const PAGES = ["/quran/2", "/quran/2#ayah-250", "/quran/1"];
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, cpu: 1 },
  { name: "360 (4x CPU)", width: 360, height: 780, cpu: 4 },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

async function once(browser, path, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: vp.cpu });
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, tbt: 0, fcp: 0, lit: NaN };
    new MutationObserver((ms) => {
      if (Number.isNaN(window.__perf.lit) && ms.some((m) => m.target.classList?.contains("qr-flash"))) window.__perf.lit = performance.now();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__perf.fcp = e.startTime;
    }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.tbt += Math.max(0, e.duration - 50);
    }).observe({ type: "longtask", buffered: true });
  });
  let htmlBytes = 0;
  page.on("response", async (r) => {
    if (r.request().resourceType() === "document") htmlBytes = (await r.body().catch(() => Buffer.alloc(0))).length;
  });
  await page.goto(base + path, { waitUntil: "commit" });
  // Interactive: the A+ button changes the size output (only once React has hydrated). Polled inside the page.
  const interactive = await page
    .waitForFunction(
      () => {
        const b = document.querySelector('button[aria-label="Larger Arabic text"]');
        const out = document.querySelector("output");
        if (!b || !out) return false;
        if (out.textContent.trim() !== "32px") return performance.now();
        b.click();
        return false;
      },
      null,
      { polling: 20, timeout: 60_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => NaN);
  await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    return { ...window.__perf, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, dom: document.getElementsByTagName("*").length };
  });
  await ctx.close();
  return { ...r, interactive, htmlKB: htmlBytes / 1024 };
}

const browser = await chromium.launch();
const rows = [];
for (const vp of VIEWPORTS)
  for (const path of PAGES) {
    const xs = [];
    for (let i = 0; i < RUNS; i++) xs.push(await once(browser, path, vp));
    const k = (f) => Math.round(median(xs.map(f)));
    rows.push({ viewport: vp.name, page: path, htmlKB: k((x) => x.htmlKB), dom: k((x) => x.dom), fcp: k((x) => x.fcp), lcp: k((x) => x.lcp), dcl: k((x) => x.dcl), load: k((x) => x.load), tbt: k((x) => x.tbt), interactive: k((x) => x.interactive), lit: path.includes("#") ? k((x) => x.lit) : "-" });
  }
await browser.close();
console.log(`median of ${RUNS} cold loads, ms unless noted, ${base}`);
console.table(rows);
