import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Learning Partners on a deployment WITHOUT the database (the e2e build blanks the Supabase variables): every page shows
 * its designed "not connected" state, never a mock provider, and passes axe on the desktop and the mobile project.
 * The signed-in behaviour (RLS, roles, inquiries, approval) is covered by tests/db/partners.test.ts; no signed-in or
 * real-device check can be made here.
 */
async function axe(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

const PAYMENTS = "QITL helps learners discover educational providers. Course arrangements, fees and payments are handled directly with the provider. QITL does not process course payments.";

test("/partners: designed not-connected state, payments sentence, no providers, axe", async ({ page }) => {
  const res = await page.goto("/partners");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Learning Partners" })).toBeVisible();
  await expect(page.getByText("The Learning Partners directory is not connected yet.")).toBeVisible();
  await expect(page.getByTestId("payments-notice")).toContainText(PAYMENTS);
  await expect(page.getByTestId("instruction-notice")).toContainText("not the same as issuing a fatwa");
  await expect(page.getByTestId("directory-card")).toHaveCount(0);
  await expect(page.locator("main form, main input, main textarea")).toHaveCount(0);
  await axe(page);
});

test("/partners/some-provider: not-connected state, no mock provider, axe", async ({ page }) => {
  const res = await page.goto("/partners/fixture-provider");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("The Learning Partners directory is not connected yet.")).toBeVisible();
  await expect(page.locator("main textarea, main input")).toHaveCount(0);
  await axe(page);
});

test("/partners/register: not-connected state, no form, payments sentence, axe", async ({ page }) => {
  const res = await page.goto("/partners/register");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Register as a provider" })).toBeVisible();
  await expect(page.getByText("The Learning Partners directory is not connected yet.")).toBeVisible();
  await expect(page.getByTestId("payments-notice")).toContainText(PAYMENTS);
  await expect(page.locator("main textarea, main input")).toHaveCount(0);
  await axe(page);
});

for (const path of ["/partners/dashboard", "/partners/dashboard/inquiries", "/partners/inquiries"]) {
  test(`${path}: not-connected state, no private data, axe`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByText("The Learning Partners directory is not connected yet.")).toBeVisible();
    await expect(page.getByTestId("dashboard")).toHaveCount(0);
    await expect(page.getByTestId("my-inquiries")).toHaveCount(0);
    await axe(page);
  });
}

test("/admin/partners: needs the database, shows no console, axe", async ({ page }) => {
  const res = await page.goto("/admin/partners");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("admin-partners")).toHaveCount(0);
  await expect(page.getByTestId("review-queue")).toHaveCount(0);
  await axe(page);
});

for (const locale of ["ar", "ur"] as const) {
  test(`/${locale}/partners is right-to-left with translated strings, the payments sentence and no overflow`, async ({ page }) => {
    await page.goto(`/${locale}/partners`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Learning Partners");
    const payments = page.getByTestId("payments-notice");
    await expect(payments).toContainText("QITL");
    await expect(payments).toContainText(/[؀-ۿ]/);
    await expect(payments).not.toContainText("handled directly with the provider");
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(1);
    await axe(page);
  });
  test(`/${locale}/partners/register is right-to-left and translated`, async ({ page }) => {
    await page.goto(`/${locale}/partners/register`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Register as a provider");
    await axe(page);
  });
}

test("the public pages name no payment processor and carry no rating or review", async ({ page }) => {
  await page.goto("/partners");
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const word of ["stripe", "paypal", "checkout", "escrow", "commission", "invoice", "★", "stars", "reviews"]) expect(text, word).not.toContain(word);
});
