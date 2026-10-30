import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Brief 01 acceptance tests: the home journey. */

test.describe("home journey", () => {
  test("renders 29 stops in order, with the draft badge", async ({ page }) => {
    await page.goto("/");
    const ids = await page.locator("[data-stop]").evaluateAll((els) => els.map((e) => e.getAttribute("data-stop")));
    expect(ids).toHaveLength(29);
    expect(ids[0]).toBe("adam");
    expect(ids.slice(-7)).toEqual(["isa", "muhammad", "birth", "revelation", "hijrah", "farewell", "passing"]);
    await expect(page.getByTestId("draft-badge").first()).toBeVisible();
  });

  test("filters: Key events shows 5, Prophets shows 24", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Key events" }).click();
    await expect(page.locator("[data-stop]")).toHaveCount(5);
    await page.getByRole("button", { name: "Prophets", exact: true }).click();
    await expect(page.locator("[data-stop]")).toHaveCount(24);
  });

  test("clicking a node expands it, collapses the previous one, and holds through 1.2s of scroll", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-node="ibrahim"]').click();
    await expect(page.locator('#ibrahim[data-expanded="true"]')).toBeVisible();
    await expect(page.locator('#adam[data-expanded="false"]')).toHaveCount(1);
    // Click and scroll inside the page so the timing is the reader's, not the test runner's.
    const samples = await page.evaluate(async () => {
      const t0 = performance.now();
      document.querySelector<HTMLElement>('[data-node="nuh"]')!.click();
      const out: Array<{ t: number; expanded: boolean }> = [];
      for (let i = 0; i < 6; i++) {
        window.scrollBy(0, 160);
        await new Promise((r) => setTimeout(r, 150));
        out.push({ t: performance.now() - t0, expanded: Boolean(document.querySelector('#nuh[data-expanded="true"]')) });
      }
      return out;
    });
    // Every sample taken inside the 1.2s hold must still show the clicked card expanded.
    const inHold = samples.filter((x) => x.t < 1150);
    expect(inHold.length).toBeGreaterThan(0);
    expect(inHold.every((x) => x.expanded)).toBe(true);
  });

  test("every expanded card shows an evidence label and a citation chip", async ({ page }) => {
    await page.goto("/");
    for (const id of ["adam", "yusuf", "hijrah"]) {
      await page.locator(`[data-node="${id}"]`).click();
      const card = page.locator(`#${id}[data-expanded="true"]`);
      await expect(card.locator(".zq-ev").first()).toBeVisible();
      await expect(card.locator("[data-citation]").first()).toBeVisible();
    }
  });

  test("View evidence: focus moves to Close, Esc closes, focus returns", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-node="adam"]').click();
    const btn = page.locator("#adam").getByRole("button", { name: "View evidence" });
    await btn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close evidence" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(btn).toBeFocused();
  });

  test("no stop before Muhammad shows a year unless labelled a historians' estimate", async ({ page }) => {
    await page.goto("/");
    const rows = await page.locator("[data-stop]").evaluateAll((els) =>
      els.map((e) => ({ id: e.getAttribute("data-stop"), when: e.querySelector(".zq-jt-when")?.textContent ?? "" })),
    );
    const before = rows.slice(0, rows.findIndex((r) => r.id === "muhammad"));
    for (const r of before) if (/\b(BCE|CE)\b/.test(r.when)) expect(r.when, r.id!).toContain("Historians' estimate");
  });

  test("has no axe violations", async ({ page }) => {
    await page.goto("/");
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("single column, progress pill visible, no horizontal scroll, evidence is a bottom sheet", async ({ page }) => {
    await page.goto("/");
    await page.locator("#journey").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 1200);
    await expect(page.getByTestId("journey-progress")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('[data-node="adam"]').click();
    await page.locator("#adam").getByRole("button", { name: "View evidence" }).click();
    const box = await page.locator(".zq-drawer").boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan(844 - 2); // anchored to the bottom
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no running animations and every stop is visible without scrolling into view", async ({ page }) => {
    await page.goto("/");
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
    expect(running).toBe(0);
    const hidden = await page.locator(".zq-rv:not(.zq-in)").count();
    expect(hidden).toBe(0);
  });
});
