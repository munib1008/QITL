import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

/**
 * 360px interactions for the views finished in the mobile leftovers pass: the atlas schematic (zoom buttons, touch
 * pan and pinch, the place sheet), the genealogy explorer (focus mode, branches) and the admin layout on phones.
 * The genealogy test uses the synthetic e2e fixture graph (QITL_E2E_FIXTURES=1 in playwright.config.ts, only
 * without a database).
 */
test.use({ viewport: { width: 360, height: 780 } });
test.skip(() => test.info().project.name !== "desktop", "the viewport is set here; one project is enough");

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
const num = async (page: Page, sel: string, attr: string) => Number(await page.locator(sel).getAttribute(attr));

/** Dispatch a touch pointer sequence on the element (Playwright's touchscreen only taps). */
async function touch(page: Page, sel: string, steps: Array<Array<{ id: number; x: number; y: number; type: "pointerdown" | "pointermove" | "pointerup" }>>) {
  await page.locator(sel).evaluate((el, steps) => {
    const r = el.getBoundingClientRect();
    for (const step of steps)
      for (const p of step)
        el.dispatchEvent(new PointerEvent(p.type, { pointerId: p.id, pointerType: "touch", isPrimary: p.id === 1, clientX: r.left + p.x, clientY: r.top + p.y, bubbles: true, cancelable: true, button: 0, buttons: p.type === "pointerup" ? 0 : 1 }));
  }, steps);
}

test("atlas: zoom buttons, touch pan and pinch, controls clear of each other and of the bottom bar", async ({ page }) => {
  await page.goto("/atlas");
  const vp = ".zx-viewport";
  await expect(page.locator(vp)).toBeVisible();
  const zoom = page.getByRole("group", { name: "Atlas zoom" });
  const btns = { in: zoom.getByRole("button", { name: "Zoom in" }), out: zoom.getByRole("button", { name: "Zoom out" }), reset: zoom.getByRole("button", { name: "Reset view" }) };
  for (const b of Object.values(btns)) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // The buttons do not overlap each other, and the map stage ends above the bottom navigation when scrolled to it.
  const [a, b, c] = await Promise.all([btns.in.boundingBox(), btns.out.boundingBox(), btns.reset.boundingBox()]);
  expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y + 0.5);
  expect(b!.y + b!.height).toBeLessThanOrEqual(c!.y + 0.5);
  // Scrolled into the middle of the screen, the whole drawing fits between the sticky header and the bottom bar.
  await page.locator(".zx-stage").evaluate((el) => el.scrollIntoView({ block: "center" }));
  const navTop = (await page.locator("[data-bottom-nav]").boundingBox())!.y;
  const stage = (await page.locator(".zx-stage").boundingBox())!;
  expect(stage.y + stage.height).toBeLessThanOrEqual(navTop);

  const s0 = await num(page, vp, "data-scale");
  await btns.in.click();
  await expect.poll(() => num(page, vp, "data-scale")).toBeGreaterThan(s0);
  await btns.out.click();
  await btns.out.click();
  await expect.poll(() => num(page, vp, "data-scale")).toBeLessThan(s0);
  await btns.reset.click();
  await expect.poll(() => num(page, vp, "data-scale")).toBe(s0);
  await expect(page.locator(".zx-zoom [aria-live]")).toHaveText("Zoom 100%");

  // One finger pans.
  const x0 = await num(page, vp, "data-x");
  await touch(page, vp, [[{ id: 1, x: 300, y: 200, type: "pointerdown" }], [{ id: 1, x: 250, y: 200, type: "pointermove" }], [{ id: 1, x: 150, y: 205, type: "pointermove" }], [{ id: 1, x: 150, y: 205, type: "pointerup" }]]);
  await expect.poll(() => num(page, vp, "data-x")).toBeLessThan(x0 - 100);
  // Two fingers moving apart zoom in.
  await touch(page, vp, [
    [{ id: 1, x: 150, y: 200, type: "pointerdown" }, { id: 2, x: 210, y: 200, type: "pointerdown" }],
    [{ id: 2, x: 260, y: 200, type: "pointermove" }],
    [{ id: 1, x: 100, y: 200, type: "pointermove" }],
    [{ id: 1, x: 100, y: 200, type: "pointerup" }, { id: 2, x: 260, y: 200, type: "pointerup" }],
  ]);
  await expect.poll(() => num(page, vp, "data-scale")).toBeGreaterThan(1.5);

  // The legend is collapsed on phones and opens on demand; unknown places are listed, not drawn.
  const legend = page.locator(".zx-legend");
  await expect(legend).not.toHaveAttribute("open", "");
  await legend.locator("summary").click();
  await expect(legend.getByRole("region", { name: "Map legend" })).toBeVisible();
  await expect(page.locator('[data-place="adam"]')).toHaveCount(0);
  await expect(page.locator(".zx-unplaced").getByRole("link", { name: "Adam" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("atlas: a place opens an accessible bottom sheet that expands, closes on Esc and returns focus", async ({ page }) => {
  await page.goto("/atlas?focus=yusuf");
  // Opened from a prophet page: a way back to the story.
  await expect(page.getByRole("link", { name: /Return to the story of Yusuf/ })).toHaveAttribute("href", /\/prophets\/yusuf#places/);
  const node = page.locator('[data-place="yusuf"]');
  await expect(node).toHaveAttribute("data-focus", "true");
  await node.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Egypt" });
  await expect(sheet).toBeVisible();
  const settle = () => sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => true));
  await settle();
  // Uncertainty is kept in words.
  await expect(sheet.getByText("Approximate region")).toBeVisible();
  await expect(sheet.getByText(/does not give a geographic coordinate/)).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Read the story of Yusuf" })).toBeVisible();
  // It sits above the bottom navigation, inside the screen.
  const box = (await sheet.boundingBox())!;
  const navTop = (await page.locator("[data-bottom-nav]").boundingBox())!.y;
  expect(box.y + box.height).toBeLessThanOrEqual(navTop + 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(await axe(page)).toEqual([]);

  // Expand: by the grip button, then by dragging it down to shrink again.
  const grip = sheet.getByRole("button", { name: "Expand panel" });
  await grip.click();
  await expect(sheet).toHaveAttribute("data-size", "full");
  await settle();
  expect((await sheet.boundingBox())!.height).toBeGreaterThan(box.height + 100);
  const g = (await sheet.getByRole("button", { name: "Shrink panel" }).boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + 80, { steps: 5 });
  await page.mouse.move(g.x + g.width / 2, g.y + 160, { steps: 5 });
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-size", "half");

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(node).toBeFocused();

  // Tap (click) opens it too; the Close button closes it.
  await node.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});

test("atlas in Arabic keeps the schematic right to left and passes axe", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "qitl-locale", value: "ar", url: baseURL! }]);
  await page.goto("/atlas");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const first = (await page.locator('[data-place="nuh"]').boundingBox())!;
  const last = (await page.locator('[data-place="ibrahim"]').boundingBox())!;
  expect(first.x).toBeGreaterThan(last.x);
  expect(await axe(page)).toEqual([]);
});

test("genealogy: focus mode, branch collapse, distinct lines and the relationship list at 360px", async ({ page }) => {
  await page.goto("/genealogy");
  await expect(page.getByText(/Test fixture: synthetic people/)).toBeVisible();
  const vp = page.locator(".zx-viewport");
  await expect(vp).toBeVisible();
  // Readable at 360px: scale 1, so names keep their size; the graph is wider than the screen and pans.
  expect(Number(await vp.getAttribute("data-scale"))).toBe(1);
  await vp.scrollIntoViewIfNeeded();
  const vb = (await vp.boundingBox())!;
  const pb = (await page.locator('[data-person="fixture-parent"]').boundingBox())!;
  expect(pb.x).toBeGreaterThanOrEqual(vb.x);
  expect(pb.x + pb.width).toBeLessThanOrEqual(vb.x + vb.width);
  expect(pb.y + pb.height).toBeLessThanOrEqual(vb.y + vb.height);
  // Names keep a readable size: a person box is at least 44px tall on screen.
  expect(pb.height).toBeGreaterThanOrEqual(44);
  // Established, disputed and unknown lines stay distinct.
  for (const st of ["verified", "disputed", "unknown"]) expect(await page.locator(`[data-edge="${st}"]`).count()).toBeGreaterThan(0);

  const childA = page.locator('[data-person="fixture-child-a"]');
  await childA.click();
  await expect(childA).toHaveAttribute("aria-pressed", "true");
  const panel = page.locator(".zg-panel");
  await expect(panel.getByRole("heading", { name: "Test child A" })).toBeVisible();
  await expect(panel.getByText("Disputed line")).toBeVisible();
  await panel.getByRole("button", { name: /Show only Test child A/ }).click();
  await expect(page.locator('[data-person="fixture-spouse"]')).toHaveCount(0);
  await expect(page.locator('[data-person="fixture-grandchild"]')).toHaveCount(1);
  await expect(page.locator('[data-person="fixture-parent"]')).toHaveCount(1);
  await panel.getByRole("button", { name: "Show everyone" }).click();
  await expect(page.locator('[data-person="fixture-spouse"]')).toHaveCount(1);

  // Collapse and expand the branch below the centre person.
  await page.locator('[data-person="fixture-parent"]').click();
  const collapse = panel.getByRole("button", { name: /Collapse the branch below Test parent/ });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await collapse.click();
  await expect(page.locator('[data-person="fixture-child-a"]')).toHaveCount(0);
  await expect(page.locator('[data-person="fixture-parent"]')).toContainText("+3 hidden below");
  await panel.getByRole("button", { name: /Expand the branch below Test parent/ }).click();
  await expect(page.locator('[data-person="fixture-child-a"]')).toHaveCount(1);

  // Keyboard: the graph pans with the arrow keys; people are reachable and selectable with Enter.
  await vp.focus();
  const x0 = Number(await vp.getAttribute("data-x"));
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => Number(await vp.getAttribute("data-x"))).toBeGreaterThan(x0);
  await page.locator('[data-person="fixture-sibling"]').focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("heading", { name: "Test sibling" })).toBeVisible();

  // The text alternative is still there.
  await expect(page.getByRole("heading", { name: "Relationship list" })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

/**
 * The admin tools need a signed-in editor and the database, which the e2e server does not have. This test renders the
 * admin markup (the same class names and structure the components emit) with the site's real stylesheets at 360px.
 */
test("admin at 360px: collapsible editorial menu, tables as cards, 44px controls, full-screen editor", async ({ page }) => {
  await page.goto("/admin");
  // The real /admin page at 360px (not configured here) passes axe and does not scroll sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await axe(page)).toEqual([]);
  const css = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((l) => l.href));
  expect(css.length).toBeGreaterThan(0);
  const body = fs.readFileSync("tests/e2e/fixtures/admin-360.html", "utf8");
  await page.setContent(`<!doctype html><html lang="en" dir="ltr"><head><title>Admin layout at 360px</title><meta name="viewport" content="width=device-width, initial-scale=1">${css.map((h) => `<link rel="stylesheet" href="${h}">`).join("")}</head><body>${body}</body></html>`, { waitUntil: "load" });

  // Editorial menu: a closed disclosure naming the current page; opening it shows 44px links.
  const menu = page.locator(".zq-admin-nav details");
  await expect(menu).not.toHaveAttribute("open", "");
  const summary = menu.locator("summary");
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(summary).toContainText("Users & roles");
  await summary.click();
  await expect(menu.getByRole("link", { name: "Audit trail" })).toBeVisible();
  for (const l of await menu.getByRole("link").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Tables become cards: each cell shows its column name and the page does not scroll sideways.
  const row = page.locator(".zq-table-cards tbody tr").first();
  const rb = (await row.boundingBox())!;
  expect(rb.x + rb.width).toBeLessThanOrEqual(360);
  expect(await row.locator("td").first().evaluate((td) => getComputedStyle(td, "::before").content)).toBe('"User id"');
  await expect(page.locator(".zq-table-cards thead")).toHaveCSS("position", "absolute");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  for (const b of await page.locator(".zq-admin .zq-btn, .zq-admin .zq-input").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // A wide table that stays a table scrolls inside its own region.
  const scroller = page.locator(".zq-table-scroll:not(:has(.zq-table-cards))");
  expect(await scroller.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");

  // Full-screen editing view covers the screen (classes as FullScreenEditor sets them).
  await page.locator(".zq-fs").evaluate((el) => {
    el.classList.add("zq-fs-on");
    document.documentElement.classList.add("zq-noscroll");
  });
  const fs1 = (await page.locator(".zq-fs").boundingBox())!;
  expect(fs1.width).toBeGreaterThanOrEqual(360 - 16); // full width; desktop Chromium keeps a 15px scrollbar gutter (globals.css scrollbar-gutter: stable), phones have overlay scrollbars
  expect(fs1.height).toBe(780);
  expect(await axe(page)).toEqual([]);
});
