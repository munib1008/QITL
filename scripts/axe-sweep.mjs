#!/usr/bin/env node
/**
 * Axe sweep: every route in light and dark at desktop and phone width (WCAG 2.2 AA).
 *
 *   pnpm axe:sweep --base http://localhost:3100 --routes tests/e2e/routes.ts
 *   pnpm axe:sweep --base https://staging.example.com --routes tests/e2e/routes.ts --only /admin --storage-state admin.json
 *
 * Options
 *   --base URL             Site to test (default http://localhost:3100).
 *   --routes FILE          A .ts file (quoted "/path" entries, as tests/e2e/routes.ts) or a text file with one route per line.
 *   --only PREFIX          Keep routes starting with PREFIX (repeatable), e.g. /admin.
 *   --skip PREFIX          Drop routes starting with PREFIX (repeatable).
 *   --themes light,dark    Default both. The theme is the qitl-theme cookie the server reads.
 *   --widths 1440,390      Default both.
 *   --storage-state FILE   A Playwright storage state for a signed-in editor. Create one once with:
 *                            npx playwright codegen --save-storage=admin.json <base>/sign-in
 *   --json FILE            Also write every finding to FILE.
 * Exit code is 1 when any violation is found, so it can gate CI.
 * Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a specific Chromium binary.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));

const base = opt("base", "http://localhost:3100").replace(/\/$/, "");
const routesFile = opt("routes", "tests/e2e/routes.ts");
const themes = opt("themes", "light,dark").split(",");
const widths = opt("widths", "1440,390").split(",").map(Number);
const storageState = opt("storage-state");
const only = all("only");
const skip = all("skip");

const text = readFileSync(routesFile, "utf8");
let routes = routesFile.endsWith(".ts") ? [...text.matchAll(/^\s+"(\/[^"]*)",?\s*$/gm)].map((m) => m[1]) : text.split("\n").map((l) => l.trim()).filter(Boolean);
if (only.length) routes = routes.filter((r) => only.some((p) => r.startsWith(p)));
if (skip.length) routes = routes.filter((r) => !skip.some((p) => r.startsWith(p)));
if (!routes.length) {
  console.error("No routes to test.");
  process.exit(2);
}

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] } : {}) });
const findings = [];
let pages = 0;
for (const theme of themes) {
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, reducedMotion: "reduce", ...(storageState ? { storageState } : {}) });
    await ctx.addCookies([{ name: "qitl-theme", value: theme, url: base }]);
    const page = await ctx.newPage();
    for (const route of routes) {
      const res = await page.goto(base + route, { waitUntil: "networkidle" }).catch((e) => ({ status: () => `ERR ${e.message}` }));
      const status = res.status();
      pages++;
      if (typeof status !== "number" || status >= 400) {
        findings.push({ theme, width, route, rule: "http", detail: String(status) });
        continue;
      }
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of r.violations) findings.push({ theme, width, route, rule: v.id, count: v.nodes.length, target: v.nodes[0].target.join(" ").slice(0, 100), detail: (v.nodes[0].any[0]?.message ?? v.help).slice(0, 140) });
    }
    await ctx.close();
  }
}
await browser.close();

for (const f of findings) console.log(`${f.theme} ${f.width} ${f.route} :: ${f.rule}${f.count ? ` x${f.count}` : ""} :: ${f.target ?? ""} :: ${f.detail}`);
console.log(`\n${pages} page checks (${routes.length} routes x ${themes.length} themes x ${widths.length} widths), ${findings.length} finding(s).`);
if (opt("json")) writeFileSync(opt("json"), JSON.stringify(findings, null, 2));
process.exit(findings.length ? 1 : 0);
