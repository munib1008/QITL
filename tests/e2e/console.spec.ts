import { expect, test } from "@playwright/test";

/** Pages load without console errors (hydration mismatches, failed requests other than expected 503s). */
for (const path of ["/", "/prophets/yusuf", "/prophets/hijrah", "/timeline?selected=nuh", "/atlas", "/quran/12", "/hadith/bukhari", "/search?q=musa", "/ar", "/community", "/account", "/admin"]) {
  test(`no console errors: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
}
