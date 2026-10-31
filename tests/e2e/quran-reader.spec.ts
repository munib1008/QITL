import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Quran reader: surah index search, jump to an ayah (form and keys), copy with attribution, reading progress and
 * resume, reading divisions, the 3-second highlight on the long surah, the honest audio slot, and axe at 360 / 1440 px
 * in English, Arabic and Urdu. One project drives every width.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width");

const quranTxt = readFileSync(join(process.cwd(), "content", "quran", "quran.txt"), "utf8");
const ayah = (s: number, a: number) => quranTxt.split("\n").find((l) => l.startsWith(`${s}|${a}|`))!.slice(`${s}|${a}|`.length).replace(/\r$/, "");

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

for (const prefix of ["", "/ar", "/ur"])
  for (const path of ["/quran", "/quran/1", "/quran/2"])
    test(`axe: ${prefix || "/en"}${path} at 360 and 1440`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${prefix}${path}`);
        await expect(page.locator("[data-quran-attribution]").first()).toBeVisible();
        expect(await axe(page), `${prefix}${path} @${width}`).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `horizontal overflow at ${width}`).toBeLessThanOrEqual(1);
      }
    });

test("the surah index filters as you type (transliteration, English, Arabic, number)", async ({ page }) => {
  await page.goto("/quran");
  const list = page.getByTestId("surah-list");
  await expect(list.getByRole("listitem")).toHaveCount(114);
  const box = page.getByRole("searchbox", { name: "Find a surah" });
  await box.fill("baqarah");
  await expect(list.getByRole("listitem").first()).toContainText("Al-Baqara");
  await box.fill("the cave");
  await expect(list.getByRole("listitem").first()).toContainText("Al-Kahf");
  await box.fill("يوسف");
  await expect(list.getByRole("listitem").first()).toContainText("Yusuf");
  await box.fill("36");
  await expect(list.getByRole("listitem").first()).toContainText("36");
  await box.fill("xqjv");
  await expect(page.getByTestId("surah-none")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "0 surahs" })).toBeAttached();
});

test("jump to an ayah from the index opens the surah with the highlight; bad input is explained", async ({ page }) => {
  await page.goto("/quran");
  const form = page.getByTestId("jump-to-ayah");
  await form.getByLabel("Surah").selectOption("2");
  await form.getByLabel("Ayah").fill("300");
  await form.getByLabel("Ayah").press("Enter");
  await expect(form.getByRole("alert")).toHaveText(/286 ayat/);
  await form.getByLabel("Ayah").fill("255");
  await form.getByRole("button", { name: "Go" }).click();
  await expect(page).toHaveURL(/\/quran\/2#ayah-255$/);
  await expect(page.locator("#ayah-255")).toHaveClass(/qr-flash/);
  await expect(page.locator("#ayah-255")).toBeInViewport();
});

test("keyboard: G focuses Go to, J / K move between ayat and light them", async ({ page }) => {
  await page.goto("/quran/2#ayah-10");
  await expect(page.locator("#ayah-10")).toHaveClass(/qr-flash/);
  await page.locator("body").press("j");
  await expect(page).toHaveURL(/#ayah-11$/);
  await expect(page.locator("#ayah-11")).toHaveClass(/qr-flash/);
  await expect(page.locator("#ayah-11")).toBeFocused();
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  await expect(page).toHaveURL(/#ayah-11$/);
  await page.keyboard.press("g");
  await expect(page.getByTestId("jump-to-ayah").getByLabel("Surah")).toBeFocused();
  // Same surah, by keyboard only.
  await page.keyboard.press("Tab");
  await page.keyboard.type("200");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#ayah-200$/);
  await expect(page.locator("#ayah-200")).toHaveClass(/qr-flash/);
  await expect(page.locator("#ayah-200")).toBeInViewport();
});

test("copy puts the verbatim Arabic, Q s:a, the Tanzil attribution and the link on the clipboard", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  // Record exactly what the page hands the clipboard (the OS clipboard may turn line ends into CRLF on Windows).
  await page.addInitScript(() => {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (t: string) => {
      (window as unknown as { __copied: string }).__copied = t;
      return write(t);
    };
  });
  await page.goto("/quran/2#ayah-255");
  const li = page.locator("#ayah-255");
  await li.getByRole("button", { name: "Copy ayah" }).click();
  await expect(li.getByRole("button", { name: "Copied with attribution" })).toBeVisible();
  const clip = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(clip);
  const lines = clip.split("\n");
  expect(lines[0]).toBe(ayah(2, 255));
  expect(lines[0]).toBe(await li.locator(".zq-ar-quran").textContent());
  expect(lines[1]).toBe("Q 2:255 (Al-Baqara)");
  expect(lines[2]).toBe("Arabic text: Tanzil Quran Text (Uthmani), version 1.1, Tanzil Project (https://tanzil.net), CC BY 3.0, reproduced verbatim.");
  expect(lines[3]).toBe(`${baseURL}/quran/2#ayah-255`);
});

test("reading progress: the place is kept, offered on the surah and resumed from /quran", async ({ page }) => {
  await page.goto("/quran/2");
  await page.locator("#ayah-100").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.mouse.wheel(0, 10);
  await expect
    .poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("qitl-quran-progress-v1") ?? "{}")?.surahs?.["2"]?.ayah ?? 0))
    .toBeGreaterThanOrEqual(99);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("qitl-quran-progress-v1")!).surahs["2"].ayah as number);
  expect(saved).toBeLessThanOrEqual(101);

  await page.goto("/quran");
  const cont = page.getByTestId("continue-reading");
  await expect(cont.getByRole("heading", { name: "Continue reading" })).toBeVisible();
  await cont.getByRole("link", { name: `Al-Baqara, Q 2:${saved}` }).click();
  await expect(page).toHaveURL(new RegExp(`/quran/2#ayah-${saved}$`));
  await expect(page.locator(`#ayah-${saved}`)).toHaveClass(/qr-flash/);
  await expect(page.locator(`#ayah-${saved}`)).toBeInViewport();

  await page.goto("/quran/2");
  await expect(page.getByTestId("resume-banner")).toContainText(`Q 2:${saved}`);
  await page.getByTestId("resume-banner").getByRole("link", { name: "Resume" }).click();
  await expect(page.locator(`#ayah-${saved}`)).toHaveClass(/qr-flash/);

  await page.goto("/account");
  await expect(page.getByTestId("continue-reading").getByRole("link", { name: `Al-Baqara, Q 2:${saved}` })).toBeVisible();
});

test("the long surah: every anchor exists, the highlight works deep in it and clears after 3 s", async ({ page }) => {
  // Record every ayah that lights up, so a slow load cannot let the 3-second glow pass before the first check.
  await page.addInitScript(() => {
    const w = window as unknown as { __lit: string[] };
    w.__lit = [];
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target as HTMLElement;
        if (el.classList?.contains("qr-flash") && !w.__lit.includes(el.id)) w.__lit.push(el.id);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.goto("/quran/2#ayah-250-252");
  await expect(page.locator("ol.qr-list > li.zq-ayah")).toHaveCount(286);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __lit: string[] }).__lit.sort())).toEqual(["ayah-250", "ayah-251", "ayah-252"]);
  await expect(page.locator("#ayah-250")).toBeInViewport();
  // The targeted ayah's controls are mounted; a far chunk keeps only its Arabic, anchor and citation.
  await expect(page.locator("#ayah-250").getByRole("button", { name: "Copy ayah" })).toBeVisible();
  await expect(page.locator("#ayah-120")).toHaveAttribute("data-light", "");
  await expect(page.locator("#ayah-120").getByRole("link", { name: "Q 2:120" })).toHaveAttribute("href", "#ayah-120");
  await expect(page.locator(".qr-flash")).toHaveCount(0, { timeout: 8000 });
  // Reading divisions from Tanzil's metadata.
  await expect(page.locator("#ayah-142 .qr-markers")).toContainText("Juz 2");
  await expect(page.locator("#ayah-253 .qr-markers")).toContainText("Juz 3");
});

test("the audio slot stays honest: no recording, the riwayah statement instead", async ({ page }) => {
  await page.goto("/quran/2");
  await expect(page.getByTestId("riwayah-audio-none")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("the Dream Understanding page links ranges with ayahHash", async ({ page }) => {
  await page.goto("/dreams");
  const refs = page.getByTestId("quran-dream-refs");
  await expect(refs.locator('a[href="/quran/12#ayah-4-6"]')).toHaveCount(1);
  await expect(refs.locator('a[href="/quran/48#ayah-27"]')).toHaveCount(1);
  await refs.locator('a[href="/quran/12#ayah-4-6"]').click();
  for (const a of [4, 5, 6]) await expect(page.locator(`#ayah-${a}`)).toHaveClass(/qr-flash/);
});
