import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Urdu interface: routing, the three-way language switch, Nastaliq typography (no clipped descenders), the three
 * independent language preferences, and axe at 360px and 1440px. One project drives every width.
 */
test.skip(() => test.info().project.name !== "desktop", "one project drives every width");

const KEY_PAGES = ["/ur", "/ur/prophets", "/ur/prophets/yusuf", "/ur/timeline", "/ur/quran", "/ur/quran/1", "/ur/hadith", "/ur/search?q=Yusuf", "/ur/account"];

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

test("/ur is Urdu: lang, dir, Urdu bottom navigation, draft notice", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/ur/timeline");
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "ٹائم لائن" })).toBeVisible();
  await expect(page.locator("footer")).toContainText("اردو انٹرفیس کا مسودہ");
});

test("the cookie keeps Urdu on unprefixed links", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "qitl-locale", value: "ur", url: baseURL! }]);
  await page.goto("/prophets");
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
});

test("three-way switch in the header: Urdu -> English -> Arabic -> Urdu, 44px targets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ur/quran/1");
  const sw = page.locator("header").getByRole("group", { name: "زبان" });
  await expect(sw.getByRole("link")).toHaveCount(3);
  await expect(sw.getByRole("link", { name: "اردو" })).toHaveAttribute("aria-current", "true");
  for (const l of await sw.getByRole("link").all()) {
    const b = (await l.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await sw.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/quran\/1$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("header").getByRole("group", { name: "Language" }).getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/quran\/1$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.locator("header").getByRole("group", { name: "اللغة" }).getByRole("link", { name: "اردو" }).click();
  await expect(page).toHaveURL(/\/ur\/quran\/1$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  // English sticks for unprefixed links after choosing it.
  await page.locator("header").getByRole("group", { name: "زبان" }).getByRole("link", { name: "English" }).click();
  await page.goto("/prophets");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("three-way switch in the Explore sheet at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/ur/prophets");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "دریافت" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const sw = sheet.getByRole("group", { name: "زبان" });
  await expect(sw.getByRole("link")).toHaveCount(3);
  for (const l of await sw.getByRole("link").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await axe(page)).toEqual([]);
  await sw.getByRole("link", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/prophets$/);
});

test("Nastaliq for Urdu interface text, the Quran font for Quranic Arabic", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ur/quran/1");
  const fam = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(await fam(".pp-sections a")).toMatch(/Nastaliq/i);
  // Arabic blocks inside the Urdu interface keep Naskh (the prophet's Arabic name).
  await page.goto("/ur/prophets/yusuf");
  expect(await fam(".pp-ar[lang=ar]")).not.toMatch(/Nastaliq/i);
  // Quranic Arabic keeps the Quran font inside the Urdu interface. No Quran text is imported in test builds, so the
  // reader's own block class is placed on the page to check the cascade.
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.className = "zq-ar-quran";
    p.lang = "ar";
    p.dir = "rtl";
    p.textContent = "ا";
    document.querySelector("main")!.append(p);
  });
  expect(await fam(".zq-ar-quran")).toMatch(/Amiri Quran/i);
  expect(await fam(".zq-ar-quran")).not.toMatch(/Nastaliq/i);
  const ls = await page.locator(".pp-sections a").first().evaluate((el) => getComputedStyle(el).letterSpacing);
  expect(["normal", "0px"]).toContain(ls);
});

test("no clipped Nastaliq in buttons, pills and navigation at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const route of ["/ur/prophets", "/ur/quran/1", "/ur/account", "/ur/timeline"]) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      const sel = ".zq-btn, .zq-pill, .zq-chip, .zq-lang-opt, .qb-item span, .pp-sections a, .zq-iconbtn, summary, label, select";
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        const text = el.textContent ?? "";
        if (!/[؀-ۿ]/.test(text) || el.closest("[lang=ar]")) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || el.getBoundingClientRect().height === 0) continue;
        const fs = parseFloat(cs.fontSize);
        // Chromium ignores line-height on <select>: there the box height is what must leave room for Nastaliq.
        const lh = el.tagName === "SELECT" ? el.clientHeight : cs.lineHeight === "normal" ? fs * 1.2 : parseFloat(cs.lineHeight);
        const clips = (cs.overflow !== "visible" || cs.overflowY !== "visible") && el.scrollHeight > el.clientHeight + 1;
        if (lh < fs * 1.8 || clips) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${text.trim().slice(0, 20)}" lh=${lh} fs=${fs}${clips ? " clipped" : ""}`);
      }
      return out;
    });
    expect(bad, `${route}\n${bad.join("\n")}`).toEqual([]);
  }
});

test("three independent preferences, kept on the device when signed out", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ur/account");
  const panel = page.locator("[data-lang-prefs]");
  await expect(panel.getByLabel("انٹرفیس کی زبان")).toHaveValue("ur");
  await expect(panel.getByLabel("ترجمۂ قرآن کی زبان")).toHaveValue("ur");
  await expect(panel.getByLabel("صوتی بیان کی زبان")).toHaveValue("ur");
  await panel.getByLabel("ترجمۂ قرآن کی زبان").selectOption("en");
  await panel.getByLabel("صوتی بیان کی زبان").selectOption("ar");
  await expect(panel.getByRole("status")).toHaveText("اس ڈیوائس پر محفوظ ہو گیا");
  await page.reload();
  await expect(panel.getByLabel("ترجمۂ قرآن کی زبان")).toHaveValue("en");
  await expect(panel.getByLabel("صوتی بیان کی زبان")).toHaveValue("ar");
  await expect(panel.getByLabel("انٹرفیس کی زبان")).toHaveValue("ur");
  // The Quran reader reads the translation preference (no edition is cleared yet, so it says so).
  await page.goto("/ur/quran/1");
  await expect(page.locator("[data-language-note=quran]")).toHaveAttribute("data-language-want", "en");
  // Changing the interface language leaves the other two alone.
  await page.goto("/ur/account");
  await panel.getByLabel("انٹرفیس کی زبان").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("[data-lang-prefs]").getByLabel("Quran translation language")).toHaveValue("en");
  await expect(page.locator("[data-lang-prefs]").getByLabel("Narration language")).toHaveValue("ar");
});

test("the compact panel opens in place in the Quran reader", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/ur/quran/1");
  await page.getByText("زبان کی ترجیحات بدلیں").click();
  const panel = page.locator("[data-language-note=quran] [data-lang-prefs]");
  await expect(panel.getByLabel("ترجمۂ قرآن کی زبان")).toBeVisible();
  await expect(panel.getByLabel("انٹرفیس کی زبان")).toHaveCount(0);
  await panel.getByLabel("ترجمۂ قرآن کی زبان").selectOption("none");
  await expect(page.locator("[data-language-note=quran]")).toHaveAttribute("data-language-want", "none");
});

for (const width of [360, 1440]) {
  test(`key Urdu pages have no axe violations at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width < 600 ? 780 : 900 });
    const problems: string[] = [];
    for (const route of KEY_PAGES) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", "ur");
      const v = await axe(page);
      if (v.length) problems.push(`${route}: ${v.join("; ")}`);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) problems.push(`${route}: scrolls sideways by ${over}px`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
