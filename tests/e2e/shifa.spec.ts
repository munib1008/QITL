import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Shifa without a database (local dev): the hub, the four sections and the topic pages show their designed empty states,
 * the fixed safety framing on every page, the abstract hero with pause / replay, and the starting references in the
 * "licence pending" style. No remedy, claim, dosage, verse or hadith text exists to show here.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const LOCALES = [
  { prefix: "", name: "en" },
  { prefix: "/ar", name: "ar" },
  { prefix: "/ur", name: "ur" },
] as const;

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  return problems;
}

test("/shifa: title, safety framing, four sections, empty state, legend and references", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto("/shifa");
  await expect(page.getByRole("heading", { level: 1, name: /Shifa: Healing Through the Quran, Sunnah & Nature/ })).toBeVisible();
  await expect(page.getByTestId("safety-framing")).toContainText("Educational, not medical advice");
  await expect(page.getByTestId("safety-framing")).toContainText("Do not delay or replace professional care");
  await expect(page.getByTestId("safety-framing")).toContainText("clinician or pharmacist");
  const sections = page.getByTestId("shifa-sections").getByRole("link");
  await expect(sections).toHaveCount(4);
  await expect(sections.nth(0)).toContainText("Quranic Healing");
  await expect(sections.nth(1)).toContainText("Authentic Ruqyah");
  await expect(sections.nth(2)).toContainText("Prophetic Remedies");
  await expect(sections.nth(3)).toContainText("Spiritual Wellbeing");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("layer-legend").getByRole("listitem")).toHaveCount(5);
  const refs = page.getByTestId("reference-points");
  for (const r of ["Quran 17:82", "Quran 16:69", "Sahih al-Bukhari 5736", "Sahih al-Bukhari 5688"]) await expect(refs).toContainText(r);
  await expect(refs.getByText("Text unavailable — licence pending")).toHaveCount(4);
  expect(problems).toEqual([]);
});

test("the abstract hero pauses and replays", async ({ page }) => {
  await page.goto("/shifa");
  const hero = page.getByTestId("shifa-hero");
  await expect(hero).toBeVisible();
  const toggle = hero.getByRole("button", { name: /Pause animation|Play animation/ });
  const before = await toggle.getAttribute("aria-pressed");
  await toggle.click();
  await expect(toggle).not.toHaveAttribute("aria-pressed", before!);
  await hero.getByRole("button", { name: "Replay" }).click();
  await expect(hero).toHaveAttribute("data-playing", "true");
  await expect(hero.locator("svg")).toHaveAttribute("role", "img");
});

test("the hero does not autoplay under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shifa");
  await expect(page.getByTestId("shifa-hero")).toHaveAttribute("data-playing", "false");
});

test("a section lists its planned topics as in preparation; only titles, no text", async ({ page }) => {
  await page.goto("/shifa/prophetic-remedies");
  await expect(page.getByRole("heading", { level: 1, name: "Prophetic Remedies" })).toBeVisible();
  await expect(page.getByTestId("safety-framing")).toBeVisible();
  const planned = page.getByTestId("planned-topics");
  await expect(planned.getByRole("link")).toHaveCount(9);
  for (const t of ["Honey", "Black seed (Nigella sativa)", "Dates", "Olive oil", "Water and zamzam", "Cupping (hijama)", "Sleep and rest", "Moderation in eating", "Cleanliness and hygiene"])
    await expect(planned).toContainText(t);
  await expect(page.getByTestId("wellbeing-notice")).toHaveCount(0);
});

test("a topic page shows the safety framing, the designed empty state and the legend of layers", async ({ page }) => {
  await page.goto("/shifa/prophetic-remedies/honey");
  await expect(page.getByRole("heading", { level: 1, name: "Honey" })).toBeVisible();
  await expect(page.getByTestId("safety-framing")).toContainText("Educational, not medical advice");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await expect(page.getByTestId("shifa-entry")).toHaveCount(0);
  await expect(page.getByTestId("layer-legend")).toBeVisible();
});

test("the wellbeing section recommends professional mental-health support alongside faith and shows a crisis note", async ({ page }) => {
  for (const path of ["/shifa/wellbeing", "/shifa/wellbeing/grief-and-distress", "/shifa/wellbeing/anxiety-and-worry"]) {
    await page.goto(path);
    await expect(page.getByTestId("wellbeing-notice")).toContainText("mental-health professional");
    await expect(page.getByTestId("crisis-note")).toContainText("emergency services or a crisis line");
  }
});

test("the ruqyah section states what it is and is not, and offers no checker", async ({ page }) => {
  await page.goto("/shifa/ruqyah/authentic-ruqyah");
  await expect(page.getByTestId("ruqyah-notice")).toContainText("no checker, quiz or tool");
  await expect(page.locator("main").locator("form, audio, input, textarea, select")).toHaveCount(0);
});

test("unknown sections and a topic under the wrong section are 404", async ({ page }) => {
  expect((await page.goto("/shifa/no-such-section"))?.status()).toBe(404);
  expect((await page.goto("/shifa/wellbeing/honey"))?.status()).toBe(404);
});

test("Arabic and Urdu render their own framing and keep the layout direction", async ({ page }) => {
  await page.goto("/ar/shifa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("safety-framing")).toContainText("محتوى تعليمي وليس نصيحة طبية");
  await page.goto("/ar/shifa/wellbeing/grief-and-distress");
  await expect(page.getByRole("heading", { level: 1, name: "الحزن والكرب" })).toBeVisible();
  await expect(page.getByTestId("crisis-note")).toContainText("خدمات الطوارئ المحلية");
  await page.goto("/ur/shifa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("safety-framing")).toContainText("تعلیمی مواد، طبی مشورہ نہیں");
});

test("Shifa is listed in the Explore sheet", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "the Explore sheet is the phone navigation");
  await page.goto("/shifa");
  await page.locator("[data-bottom-nav]").getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: /Shifa/ })).toBeVisible();
});

test("the sitemap lists the hub and the four sections", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const p of ["/shifa<", "/shifa/quranic-healing<", "/shifa/ruqyah<", "/shifa/prophetic-remedies<", "/shifa/wellbeing<"]) expect(xml).toContain(p);
});

for (const width of [360, 1440]) {
  for (const l of LOCALES) {
    for (const path of ["/shifa", "/shifa/prophetic-remedies", "/shifa/wellbeing/grief-and-distress"]) {
      test(`axe, no overflow and 44px targets: ${l.name} ${path} at ${width}px`, async ({ page }) => {
        test.skip(test.info().project.name !== "desktop", "viewports are set explicitly");
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${l.prefix}${path}`);
        await expect(page.getByTestId("safety-framing")).toBeVisible();
        const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        if (path === "/shifa") {
          for (const el of await page.getByTestId("shifa-sections").getByRole("link").all()) {
            const box = (await el.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
          for (const el of await page.getByTestId("shifa-hero").getByRole("button").all()) {
            const box = (await el.boundingBox())!;
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
          }
        }
      });
    }
  }
}

test("no horizontal scroll at 320px on any Shifa page", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/shifa", "/shifa/quranic-healing", "/shifa/ruqyah/authentic-ruqyah", "/ur/shifa/prophetic-remedies/black-seed", "/ar/shifa/wellbeing"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
