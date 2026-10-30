import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Story Player on its gated test fixture (/player-fixture, placeholder text only; QITL_E2E_FIXTURES=1 is set for
 * the Playwright server) and its absence on real pages when no published script exists.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/** Count AudioContext constructions and media play() calls from page load on. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ctx: number; __plays: number; AudioContext: typeof AudioContext };
    w.__ctx = 0;
    w.__plays = 0;
    const Orig = w.AudioContext;
    w.AudioContext = class extends Orig {
      constructor(...a: ConstructorParameters<typeof AudioContext>) {
        super(...a);
        w.__ctx++;
      }
    } as typeof AudioContext;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__plays++;
      return play.call(this);
    };
  });
}
const counts = (page: Page) => page.evaluate(() => ({ ctx: (window as unknown as { __ctx: number }).__ctx, plays: (window as unknown as { __plays: number }).__plays }));

test("never autoplays; Play starts the audio graph only after the click", async ({ page }) => {
  await instrument(page);
  await page.goto("/player-fixture");
  const player = page.getByRole("region", { name: "Story player" });
  await expect(player).toBeVisible();
  await expect(page.getByText("DEMO").first()).toBeVisible();
  await page.waitForTimeout(500);
  expect(await counts(page)).toEqual({ ctx: 0, plays: 0 });
  await player.getByRole("button", { name: "Listen" }).click();
  await page.waitForTimeout(300);
  expect(await counts(page)).toEqual({ ctx: 0, plays: 0 });
  await player.getByRole("button", { name: "Play narration" }).click();
  await expect.poll(async () => (await counts(page)).ctx).toBe(1);
  expect((await counts(page)).plays).toBeGreaterThan(0);
});

test("read, listen and immersive modes; scene navigation; no axe violations", async ({ page }) => {
  await page.goto("/player-fixture");
  const player = page.getByRole("region", { name: "Story player" });
  await expect(player.getByRole("heading", { name: "Fixture scene 1" })).toBeVisible();
  await player.getByRole("button", { name: "Next scene" }).click();
  await expect(player.getByRole("heading", { name: "Fixture scene 2" })).toBeVisible();
  let r = await new AxeBuilder({ page }).withTags(TAGS).include(".qp").analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await player.getByRole("button", { name: "Listen" }).click();
  await expect(player.getByRole("slider", { name: "Ambience volume" })).toHaveAttribute("max", "0.4");
  await expect(player.getByRole("combobox", { name: "Language" }).locator("option")).toHaveCount(1);
  r = await new AxeBuilder({ page }).withTags(TAGS).include(".qp").analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await player.getByRole("button", { name: "Immersive" }).click();
  await expect(player.getByRole("button", { name: "Immersive" })).toHaveAttribute("aria-pressed", "true");
});

test("without approved audio, Listen says so plainly", async ({ page }) => {
  await page.goto("/player-fixture?audio=0");
  const player = page.getByRole("region", { name: "Story player" });
  await player.getByRole("button", { name: "Listen" }).click();
  await expect(player.getByText("No approved narration exists for this story yet.")).toBeVisible();
  await expect(player.getByRole("button", { name: "Play narration" })).toHaveCount(0);
});

test("preferences survive a reload for a signed-out reader", async ({ page }) => {
  await page.goto("/player-fixture");
  const player = page.getByRole("region", { name: "Story player" });
  await player.getByRole("button", { name: "Listen" }).click();
  await player.getByRole("combobox", { name: "Playback speed" }).selectOption("1.25");
  await page.reload();
  await expect(player.getByRole("button", { name: "Listen" })).toHaveAttribute("aria-pressed", "true");
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toHaveValue("1.25");
});

test.describe("phones", () => {
  test.use({ viewport: { width: 320, height: 700 } });
  test("usable at 320px: one column, evidence in a bottom sheet, no sideways scroll", async ({ page }) => {
    await page.goto("/player-fixture");
    const player = page.getByRole("region", { name: "Story player" });
    await player.getByRole("button", { name: "Listen" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(player.getByRole("complementary")).toBeHidden();
    const open = player.getByRole("button", { name: "Evidence and lessons" });
    await open.click();
    const sheet = page.getByRole("dialog", { name: "Evidence and lessons" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "References" })).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(TAGS).include(".qp-sheet").analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(open).toBeFocused();
    for (const b of await player.locator(".qp-transport button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});

test("desktop shows the side panel with scenes, position and references", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/player-fixture");
  const side = page.getByRole("region", { name: "Story player" }).getByRole("complementary", { name: "Evidence and lessons" });
  await expect(side).toBeVisible();
  await expect(side.getByText("Scene 1 of 8")).toBeVisible();
  await side.getByRole("button", { name: /Fixture scene 4/ }).click();
  await expect(page.getByRole("heading", { name: "Fixture scene 4" })).toBeVisible();
});

test("Arabic interface is right-to-left", async ({ page }) => {
  await page.goto("/ar/player-fixture");
  const player = page.getByRole("region", { name: "مشغّل القصة" });
  await expect(player.locator(".qp")).toHaveAttribute("dir", "rtl");
  await expect(player.getByRole("button", { name: "قراءة" })).toHaveAttribute("aria-pressed", "true");
});

test("real pages show no player when no script is published", async ({ page }) => {
  await page.goto("/prophets/yusuf");
  await expect(page.getByRole("region", { name: "Story player" })).toHaveCount(0);
});

test("the studio explains when the database is not configured", async ({ page }) => {
  await page.goto("/admin/studio");
  await expect(page.getByText("The editorial tools need the database.")).toBeVisible();
});
