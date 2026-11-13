import { vi, describe, expect, test } from "vitest";
vi.mock("server-only", () => ({}));
import { exploreLinks } from "@/lib/nav";
import { groupLinks, groupOf } from "@/lib/nav-groups";
import { NAV_GROUP_IDS, navGroupStrings } from "@/lib/i18n/modules/navGroups";

describe("navigation groups", () => {
  test("every Explore section is classified into one of the five categories (search is the only tool outside them)", () => {
    const ungrouped = exploreLinks("en").filter((l) => !groupOf(l.href)).map((l) => l.href);
    expect(ungrouped).toEqual(["/search"]);
  });
  test("grouping drops nothing, keeps the incoming order inside a group, and follows the category order", () => {
    const links = exploreLinks("en");
    const blocks = groupLinks(links, "en");
    expect(blocks.flatMap((b) => b.links).length).toBe(links.length);
    const ids = blocks.filter((b) => b.id).map((b) => b.id);
    expect(ids).toEqual(NAV_GROUP_IDS.filter((id) => ids.includes(id)));
    for (const b of blocks) {
      const order = b.links.map((l) => links.findIndex((x) => x.href === l.href));
      expect(order).toEqual([...order].sort((x, y) => x - y));
    }
  });
  test("every category has a label and a purpose in English, Arabic and Urdu", () => {
    for (const loc of ["en", "ar", "ur"]) {
      const g = navGroupStrings(loc).groups;
      for (const id of NAV_GROUP_IDS) {
        expect(g[id].label.length, `${loc}.${id}.label`).toBeGreaterThan(1);
        expect(g[id].note.length, `${loc}.${id}.note`).toBeGreaterThan(5);
      }
    }
    expect(navGroupStrings("ar").groups.quran.label).toMatch(/[؀-ۿ]/);
    expect(navGroupStrings("ur").groups.community.label).toMatch(/[؀-ۿ]/);
  });
  test("query strings and fragments do not change a section's category", () => {
    expect(groupOf("/timeline?view=complete")).toBe("stories");
    expect(groupOf("/quran#ayah-3")).toBe("quran");
    expect(groupOf("/nonexistent")).toBeNull();
  });
});
