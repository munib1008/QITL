import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

const loc = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/verification" }));
vi.mock("@/lib/i18n/useLocale", () => ({ useLocale: () => loc.locale }));

import { AdminNav } from "@/components/admin/AdminNav";
import { ADMIN_GROUP_IDS, adminGroupOf, groupAdminLinks } from "@/lib/admin-groups";
import { adminGroupRaw } from "@/lib/i18n/modules/adminGroups";

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
});

describe("admin navigation by task", () => {
  test("every admin page in the navigation belongs to exactly one group", () => {
    const src = readFileSync(join(process.cwd(), "src/components/admin/AdminNav.tsx"), "utf8");
    const hrefs = [...src.matchAll(/\{ href: "(\/admin[^"]*)", roles/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(30);
    expect(hrefs.filter((h) => !adminGroupOf(h))).toEqual([]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
  test("grouping keeps every link, follows the group order and keeps the incoming order inside a group", () => {
    const links = ["/admin/users", "/admin/stories", "/admin/media", "/admin", "/admin/review", "/admin/unknown"].map((href) => ({ href }));
    const blocks = groupAdminLinks(links);
    expect(blocks.flatMap((b) => b.links).length).toBe(links.length);
    expect(blocks.map((b) => b.id)).toEqual(["overview", "content", "media", "reviews", "platform", null]);
  });
  test("every group has a label in English, Arabic and Urdu", () => {
    for (const lang of ["en", "ar", "ur"] as const) for (const id of ADMIN_GROUP_IDS) expect(adminGroupRaw[lang].groups[id].length, `${lang}.${id}`).toBeGreaterThan(1);
  });
  test("an administrator sees every group heading in order; an editor sees only the pages an editor may use", () => {
    const { container, unmount } = render(<AdminNav roles={["admin"]} />);
    const headings = [...container.querySelectorAll(".zq-admin-nav-group")].map((e) => e.textContent);
    expect(headings).toEqual(["Content", "Religious sources", "Learning content", "Media", "Reviews", "Community", "Platform"]);
    expect(screen.getByRole("link", { name: "Verification" })).toHaveAttribute("aria-current", "page");
    unmount();
    const editor = render(<AdminNav roles={["editor"]} />);
    const hrefs = [...editor.container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/admin/stories");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/site");
    const eh = [...editor.container.querySelectorAll(".zq-admin-nav-group")].map((e) => e.textContent);
    expect(eh).not.toContain("Platform");
  });
  test("Arabic headings are Arabic", () => {
    loc.locale = "ar";
    const { container } = render(<AdminNav roles={["admin"]} />);
    for (const h of [...container.querySelectorAll(".zq-admin-nav-group")]) expect(h.textContent).toMatch(/[؀-ۿ]/);
    loc.locale = "en";
  });
});
