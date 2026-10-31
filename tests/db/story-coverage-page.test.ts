// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { createDb, type Db } from "./harness";

/**
 * The coverage page, rendered by React against a real (PGlite) database through the same RPCs the page calls in
 * production. Everything else is mocked away: the session (a signed-in editor) and the role lookup.
 */
let db: Db;
let editor: string;
let plain: string;
let who: string | null = null;

vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => {
    const rpc = async (fn: string) => {
      try {
        const rows = await db.as(who, `select * from public.${fn}()`);
        const single = fn === "story_check_inputs" || fn === "story_coverage_counts";
        return { data: single ? Object.values(rows[0] ?? {})[0] ?? null : rows, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    };
    const empty = { select: () => ({ eq: () => ({ in: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) };
    return { sb: { rpc, from: () => empty }, user: who ? { id: who } : null };
  },
}));
vi.mock("@/lib/admin", () => ({ rolesOf: async () => (who === editor ? ["editor"] : []) }));

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  plain = await db.createUser("plain@test.local");
}, 240_000);

async function render(user: string | null) {
  who = user;
  const { default: Page } = await import("@/app/[locale]/admin/stories/coverage/page");
  return renderToStaticMarkup(await Page());
}

describe("/admin/stories/coverage", () => {
  test("staff see the four separate counts, the Quran passages, the prophets and the checks, all from the records", async () => {
    const html = await render(editor);
    expect(html).toContain('data-testid="story-coverage"');
    expect(html).toMatch(/data-testid="cov-discovered">159</);
    expect(html).toMatch(/data-testid="cov-researched">0</);
    expect(html).toMatch(/data-testid="cov-reviewed">0</);
    expect(html).toMatch(/data-testid="cov-published">0</);
    expect(html).toContain("The 25 prophets");
    expect((html.match(/data-testid="coverage-row"/g) ?? []).length).toBe(25 + 134);
    // Indexed from the seeded verse references, none of them verified yet.
    expect(html).toMatch(/data-testid="cov-indexed">\d{4}</);
    expect(html).toMatch(/data-testid="cov-verified-ayat">0</);
    expect(html).toContain('data-testid="story-checks"');
    expect(html).toMatch(/data-testid="check-errors">0</);
    // No checkbox anywhere: the figures are not manual.
    expect(html).not.toContain('type="checkbox"');
  });

  test("a signed-in user without an editorial role sees no figure and no title", async () => {
    const html = await render(plain);
    expect(html).toContain("Story coverage is for editorial staff");
    expect(html).not.toContain("coverage-row");
  });

  test("a signed-out visitor gets the same refusal", async () => {
    const html = await render(null);
    expect(html).toContain("Story coverage is for editorial staff");
  });
});
