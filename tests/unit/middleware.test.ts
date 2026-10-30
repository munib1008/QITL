// @vitest-environment node
import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function req(path: string, cookie?: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers: cookie ? { cookie: `qitl-locale=${cookie}` } : {} });
}
function rewrite(r: Response): string | null {
  const u = r.headers.get("x-middleware-rewrite");
  return u ? new URL(u).pathname : null;
}

describe("middleware locale routing", () => {
  test("/ur paths are served in Urdu and remember the choice", async () => {
    const r = await middleware(req("/ur/quran/1"));
    expect(rewrite(r)).toBeNull();
    expect(r.headers.get("x-middleware-next")).toBe("1");
    expect(r.cookies.get("qitl-locale")?.value).toBe("ur");
  });
  test("/ur alone is the Urdu home; an existing ur cookie is left as it is", async () => {
    const r = await middleware(req("/ur", "ur"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
    expect(r.cookies.get("qitl-locale")).toBeUndefined();
  });
  test("/ur switches a reader who was on Arabic", async () => {
    expect((await middleware(req("/ur/timeline", "ar"))).cookies.get("qitl-locale")?.value).toBe("ur");
  });
  test("an unprefixed path follows the cookie: ur, ar, en", async () => {
    expect(rewrite(await middleware(req("/quran/2", "ur")))).toBe("/ur/quran/2");
    expect(rewrite(await middleware(req("/", "ur")))).toBe("/ur");
    expect(rewrite(await middleware(req("/quran/2", "ar")))).toBe("/ar/quran/2");
    expect(rewrite(await middleware(req("/quran/2", "en")))).toBe("/en/quran/2");
  });
  test("no cookie or an unknown cookie value falls back to English", async () => {
    expect(rewrite(await middleware(req("/timeline")))).toBe("/en/timeline");
    expect(rewrite(await middleware(req("/timeline", "fr")))).toBe("/en/timeline");
    expect(rewrite(await middleware(req("/timeline", "UR")))).toBe("/en/timeline");
  });
  test("the query string is kept", async () => {
    const r = await middleware(req("/search?q=Yusuf", "ur"));
    expect(new URL(r.headers.get("x-middleware-rewrite")!).search).toBe("?q=Yusuf");
  });
  test("/en chooses English: sets the cookie and redirects (temporarily) to the unprefixed URL", async () => {
    const r = await middleware(req("/en/quran/1", "ur"));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/quran/1");
    expect(r.cookies.get("qitl-locale")?.value).toBe("en");
    expect(new URL((await middleware(req("/en"))).headers.get("location")!).pathname).toBe("/");
  });
  test("paths that merely start with 'ur' are not Urdu", async () => {
    expect(rewrite(await middleware(req("/urdu-notes", "en")))).toBe("/en/urdu-notes");
  });
});
