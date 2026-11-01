import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Scholar application, notifications, /admin/site: signed out on a deployment without the database. Each page shows its
 * designed state (never a mock), the bell is absent for a signed-out visitor, the menus are the built-in ones when nothing
 * is configured, and everything passes axe. The signed-in behaviour is covered by tests/db and tests/unit/mufti-flags-ui.
 */
async function axe(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

test("/mufti/apply: designed not-configured state, no form, axe", async ({ page }) => {
  const res = await page.goto("/mufti/apply");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Apply to answer as a mufti" })).toBeVisible();
  await expect(page.getByText("Applications are not open yet.")).toBeVisible();
  await expect(page.locator("main textarea, main input")).toHaveCount(0);
  await axe(page);
});

test("/admin/site: needs the database, shows no editor, axe", async ({ page }) => {
  const res = await page.goto("/admin/site");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("admin-site")).toHaveCount(0);
  await expect(page.locator("main textarea")).toHaveCount(0);
  await axe(page);
});

test("signed out: no notification bell, and the menus are the built-in ones", async ({ page }) => {
  await page.goto("/prophets");
  await expect(page.getByTestId("notification-bell")).toHaveCount(0);
  // Nothing is configured: every Explore section is still reachable from the header menu (desktop) or the sheet (mobile).
  const hrefs = await page.locator("nav.zq-mmenu-list a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  for (const h of ["/stories", "/hadith", "/guidance", "/community/questions", "/dreams"]) expect(hrefs).toContain(h);
});

for (const locale of ["ar", "ur"] as const) {
  test(`/${locale}/mufti/apply is right-to-left with translated strings`, async ({ page }) => {
    await page.goto(`/${locale}/mufti/apply`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Apply to answer/);
    await axe(page);
  });
}
