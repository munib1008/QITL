import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * /admin/people and /admin/communities with no database (the e2e environment has none): staff pages show why they cannot open,
 * never the tools; the API refuses with the right status; the pages are accessible in English, Arabic and Urdu. The editor
 * itself (lists, forms, refusals) needs a signed-in staff session and a database, so it is covered by the unit tests of the
 * form logic and the routes and by the PGlite database tests (tests/db/people-admin.test.ts).
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width; the responsive sweep covers the rest");

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const LOCALES = [
  { prefix: "", dir: "ltr", notConfigured: "Not configured" },
  { prefix: "/ar", dir: "rtl", notConfigured: "غير مهيّأ" },
  { prefix: "/ur", dir: "rtl", notConfigured: "ترتیب نہیں دیا گیا" },
] as const;

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  return problems;
}

for (const path of ["/admin/people", "/admin/communities"]) {
  for (const l of LOCALES) {
    test(`${l.prefix}${path}: not-configured state, no tools, accessible, ${l.dir}`, async ({ page }) => {
      const problems = watchConsole(page);
      const res = await page.goto(`${l.prefix}${path}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("dir", l.dir);
      await expect(page.getByTestId("people-admin-msg")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: /People|Communities|الأشخاص|الجماعات|شخصیات|اقوام/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Publish|Save/ })).toHaveCount(0);
      await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
      if (l.notConfigured) await expect(page.getByText(l.notConfigured, { exact: true }).first()).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
}

test("the people API refuses without a database or a same-site request, and validates its input", async ({ page, baseURL }) => {
  const get = await page.request.get("/api/admin/people?view=list&scope=person");
  expect(get.status()).toBe(503);
  expect((await get.json()).code).toBe("not_configured");
  expect((await page.request.get("/api/admin/people?view=nonsense")).status()).toBe(422);
  for (const path of ["/api/admin/people", "/api/admin/people/aliases", "/api/admin/people/claims", "/api/admin/people/status"]) {
    const cross = await page.request.post(path, { headers: { origin: "https://evil.example", "content-type": "application/json" }, data: {} });
    expect(cross.status(), path).toBe(403);
    expect((await cross.json()).code).toBe("bad_origin");
    const same = await page.request.post(path, { headers: { origin: baseURL ?? "", "content-type": "application/json" }, data: { x: 1 } });
    expect([422, 503], path).toContain(same.status());
  }
});
