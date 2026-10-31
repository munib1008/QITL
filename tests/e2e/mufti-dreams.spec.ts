import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Mufti Q&A and the Dream Understanding Centre, signed out on a deployment without the database: every page renders
 * its designed state (never a mock), the dream guide shows references only, and everything passes axe.
 */

async function axe(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
}

test("questions list: designed not-configured state and an ask link", async ({ page }) => {
  await page.goto("/community/questions");
  await expect(page.getByRole("heading", { level: 1, name: "Questions to muftis" })).toBeVisible();
  await expect(page.getByText("Questions to muftis are not open yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask a question" })).toHaveAttribute("href", "/community/questions/ask");
  await axe(page);
});

for (const [path, heading, state] of [
  ["/community/questions/ask", "Ask a question", "Questions to muftis are not open yet."],
  ["/community/questions/00000000-0000-4000-8000-000000000001", "Questions to muftis", "Questions to muftis are not open yet."],
  ["/mufti", "Mufti workspace", "The workspace needs the database, which is not connected on this site yet."],
  ["/dreams/request", "Make a private request", "Dream requests are not open on this site yet."],
  ["/dreams/my", "My dream requests", "Dream requests are not open on this site yet."],
  ["/dreams/my/00000000-0000-4000-8000-000000000001", "Your request", "Dream requests are not open on this site yet."],
] as const) {
  test(`${path}: designed state, no form, axe`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(state)).toBeVisible();
    await expect(page.locator("main textarea")).toHaveCount(0);
    await axe(page);
  });
}

test("dream guide: Quran examples as citation links, hadith as licence-pending references, wellbeing, no imagery", async ({ page }) => {
  await page.goto("/dreams");
  await expect(page.getByRole("heading", { level: 1, name: "Understand Dreams in Islam" })).toBeVisible();
  const refs = page.getByTestId("quran-dream-refs").getByRole("link");
  await expect(refs).toHaveCount(6);
  const hrefs = await refs.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  // Ranges light every ayah in them (ayahHash), like every other Quran link on the site.
  expect(hrefs).toEqual(["/quran/12#ayah-4-6", "/quran/12#ayah-36-42", "/quran/12#ayah-43-49", "/quran/12#ayah-100", "/quran/37#ayah-102-107", "/quran/48#ayah-27"]);
  const hadith = page.getByTestId("hadith-dream-refs");
  await expect(hadith.getByRole("link", { name: "Sahih Muslim 2263" })).toHaveAttribute("href", "/hadith/muslim/2263");
  await expect(hadith.getByText("Text unavailable — licence pending")).toHaveCount(2);
  await expect(page.getByTestId("wellbeing")).toContainText("doctor or a mental-health professional");
  await expect(page.getByText("No dream-symbol dictionary.")).toBeVisible();
  await expect(page.locator("main img, main video, main canvas")).toHaveCount(0);
  await expect(page.locator("main input, main textarea, main select")).toHaveCount(0);
  await page.getByText("Who can read my dream?").click();
  await expect(page.getByText(/Administrators assign scholars without seeing the text/)).toBeVisible();
  await axe(page);
});

test("dream guide in Arabic is right-to-left", async ({ page }) => {
  await page.goto("/ar/dreams");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "فهم الرؤى في الإسلام" })).toBeVisible();
  await expect(page.getByTestId("quran-dream-refs").getByRole("link")).toHaveCount(6);
  await axe(page);
});

test("API: dream and question routes refuse anonymous and cross-site requests", async ({ request }) => {
  for (const [method, url] of [
    ["post", "/api/dreams"],
    ["get", "/api/dreams"],
    ["post", "/api/dreams/export"],
    ["post", "/api/mufti/questions"],
    ["get", "/api/admin/dreams"],
  ] as const) {
    const r = await request[method](url, method === "post" ? { data: {} } : undefined);
    expect([401, 403, 503], `${method} ${url}`).toContain(r.status());
  }
});

test("Explore sheet lists Ask a Mufti and Understand Dreams", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "the Explore sheet is the phone navigation");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Explore" }).click();
  const dlg = page.getByRole("dialog", { name: "Explore QITL" });
  await expect(dlg.getByRole("link", { name: /Ask a Mufti/ })).toHaveAttribute("href", "/community/questions");
  await expect(dlg.getByRole("link", { name: /Understand Dreams/ })).toHaveAttribute("href", "/dreams");
});
