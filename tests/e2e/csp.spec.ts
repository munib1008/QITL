import { expect, test } from "@playwright/test";

/**
 * Content Security Policy in the browser (src/lib/security/csp.ts, src/middleware.ts): every page is served with a
 * per-request nonce, without 'unsafe-inline' for scripts; every executable script carries the nonce; the pre-paint
 * theme script still runs; the page hydrates; and the browser reports no violation. Works in both modes: run once with
 * CSP_MODE=report-only to trial a change, then enforced (the default).
 */
const PAGES = ["/", "/prophets/yusuf", "/quran/12", "/timeline", "/atlas", "/hadith", "/search?q=musa", "/ar", "/ur/prophets", "/community", "/dreams", "/guidance", "/creation", "/qiraat", "/life-through-ages", "/sign-in"];

function policyOf(headers: Record<string, string>): { policy: string; header: string } {
  const header = headers["content-security-policy"] ? "content-security-policy" : "content-security-policy-report-only";
  return { policy: headers[header] ?? "", header };
}

for (const path of PAGES) {
  test(`CSP: ${path} has a nonce policy, every script carries the nonce, no violations, hydrated`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    const res = await page.goto(path);
    expect(res, path).not.toBeNull();
    const { policy } = policyOf(res!.headers());
    const script = policy.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src "));
    expect(script, "script-src").toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
    expect(script).not.toContain("'unsafe-inline'");
    expect(policy).toContain("frame-ancestors 'none'");
    const nonce = script!.match(/'nonce-([^']+)'/)![1];

    // Every executable script in the server's HTML (not JSON data blocks) carries this response's nonce. Scripts the
    // framework adds later are allowed by 'strict-dynamic' because a nonced script inserted them.
    const html = await res!.text();
    const tags = html.match(/<script[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    const unstamped = tags.filter((t) => !/type="application\/(ld\+)?json"/.test(t)).filter((t) => !t.includes(`nonce="${nonce}"`));
    expect(unstamped).toEqual([]);
    await page.waitForLoadState("load");

    // Hydrated: React has attached to the page.
    await expect
      .poll(() => page.evaluate(() => Object.keys(document.body).some((k) => k.startsWith("__react")) || Array.from(document.querySelectorAll("body *")).slice(0, 200).some((el) => Object.keys(el).some((k) => k.startsWith("__react")))))
      .toBe(true);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });
}

test("CSP: the nonce changes on every request", async ({ request }) => {
  const a = policyOf((await request.get("/")).headers()).policy;
  const b = policyOf((await request.get("/")).headers()).policy;
  expect(a).toMatch(/'nonce-/);
  expect(a).not.toEqual(b);
});

test("CSP: the pre-paint theme script still runs under the policy", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("qitl-theme", "dark");
    } catch {
      // ignore
    }
  });
  await page.goto("/prophets");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
});

test("CSP: API responses carry the no-script policy and no page nonce", async ({ request }) => {
  const res = await request.get("/api/journey");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("nonce-");
  expect(res.headers()["ratelimit-limit"]).toBeDefined();
});

test("CSP: the violation report endpoint accepts a report and answers 204", async ({ request }) => {
  const res = await request.post("/api/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: JSON.stringify({ "csp-report": { "document-uri": "http://localhost/x?private=1", "effective-directive": "script-src-elem", "blocked-uri": "inline" } }),
  });
  expect(res.status()).toBe(204);
});
