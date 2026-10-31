import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { clampView, zoomAt } from "@/components/ui/panzoom";
import { generations, layoutGraph } from "@/components/genealogy/layout";
import type { GenealogyGraph } from "@/components/genealogy/types";
import { GenealogyExplorer } from "@/components/genealogy/GenealogyExplorer";
import { AtlasSchematic, type AtlasStop } from "@/components/atlas/AtlasSchematic";
import { AdminNav } from "@/components/admin/AdminNav";
import { FullScreenEditor } from "@/components/admin/FullScreenEditor";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users" }));

const edge = (id: string, from: string, to: string, kind: string, confidence: "scholar" | "disputed" | "unknown") => ({
  id,
  from,
  to,
  kind,
  confidence,
  competingGroup: null,
  claim: { id, statement: "", evidence: confidence, references: [] },
});
const G: GenealogyGraph = {
  focus: "p",
  nodes: ["gp", "p", "s", "sib", "c1", "c2", "gc"].map((id) => ({ id, name: id.toUpperCase(), nameAr: id, kind: "person", distance: 1 })),
  edges: [
    edge("1", "gp", "p", "parent_of", "scholar"),
    edge("2", "p", "s", "spouse_of", "scholar"),
    edge("3", "p", "sib", "sibling_of", "unknown"),
    edge("4", "p", "c1", "parent_of", "scholar"),
    edge("5", "p", "c2", "parent_of", "disputed"),
    edge("6", "gc", "c1", "descendant_of", "scholar"),
  ],
};

describe("pan/zoom math", () => {
  test("zoom keeps the pinch point fixed and respects the limits", () => {
    const v = zoomAt({ s: 1, x: 0, y: 0 }, 2, 100, 50, 0.5, 3);
    expect(v.s).toBe(2);
    // The content point under (100, 50) before the zoom is still under it after.
    expect((100 - v.x) / v.s).toBeCloseTo(100);
    expect((50 - v.y) / v.s).toBeCloseTo(50);
    expect(zoomAt({ s: 2.8, x: 0, y: 0 }, 2, 0, 0, 0.5, 3).s).toBe(3);
  });
  test("panning cannot throw the drawing out of view", () => {
    const v = clampView({ s: 1, x: -5000, y: 9000 }, { w: 360, h: 400 }, { w: 2000, h: 380 }, 0.5, 3);
    expect(v.x).toBeGreaterThanOrEqual(360 - 2000 - 48);
    expect(v.y).toBeLessThanOrEqual(400);
  });
});

describe("genealogy layout", () => {
  test("parents above, children below, spouses and siblings on the same row", () => {
    const l = generations(G);
    expect(l.get("p")).toBe(0);
    expect(l.get("gp")).toBe(-1);
    expect(l.get("s")).toBe(0);
    expect(l.get("sib")).toBe(0);
    expect(l.get("c1")).toBe(1);
    expect(l.get("gc")).toBe(2);
  });
  test("collapsing a branch hides everyone below it, never the centre", () => {
    const l = layoutGraph(G, new Set(["p"]));
    expect([...l.hidden].sort()).toEqual(["c1", "c2", "gc"]);
    expect(l.hiddenBelow.get("p")).toBe(3);
    expect(l.nodes.has("p")).toBe(true);
    expect(layoutGraph(G, new Set(["gp"])).nodes.has("p")).toBe(true);
  });
  test("right-to-left mirrors the rows", () => {
    const a = layoutGraph(G, new Set()).nodes.get("p")!;
    const b = layoutGraph(G, new Set(), true).nodes.get("p")!;
    expect(a.x).not.toBe(b.x);
  });
});

describe("GenealogyExplorer", () => {
  test("focus mode, branch collapse and distinct line styles", () => {
    const { container } = render(<GenealogyExplorer graph={G} centerable={[]} />);
    expect(container.querySelectorAll('[data-edge="disputed"]').length).toBe(1);
    expect(container.querySelectorAll('[data-edge="unknown"]').length).toBe(1);
    expect(container.querySelectorAll('[data-edge="verified"]').length).toBe(4);
    fireEvent.click(container.querySelector('[data-person="c1"]')!);
    expect(screen.getByRole("heading", { name: "C1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Show only C1/ }));
    // c1's direct links: p (parent) and gc (descendant). Spouse, sibling and c2 are hidden.
    expect(container.querySelector('[data-person="s"]')).toBeNull();
    expect(container.querySelector('[data-person="gc"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show everyone" }));
    fireEvent.click(screen.getByRole("button", { name: /Collapse the branch below C1/ }));
    expect(container.querySelector('[data-person="gc"]')).toBeNull();
    expect(screen.getByRole("button", { name: /Expand the branch below C1/ }).getAttribute("aria-expanded")).toBe("false");
  });
});

describe("AtlasSchematic", () => {
  const stops: AtlasStop[] = [
    { id: "a", name: "A", era: "E1", place: "Unknown", certainty: "unknown" },
    { id: "b", name: "B", era: "E1", place: "Town", certainty: "point" },
    { id: "c", name: "C", era: "E2", place: "Town", certainty: "point" },
    { id: "d", name: "D", era: "E2", place: "Area", certainty: "region" },
  ];
  test("unknown places are listed, never drawn; zoom buttons change the scale", () => {
    const { container } = render(<AtlasSchematic stops={stops} />);
    expect(container.querySelector('[data-place="a"]')).toBeNull();
    expect(container.querySelector('[data-place="b"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "A" })).toBeTruthy();
    const vp = container.querySelector(".zx-viewport")!;
    const before = Number(vp.getAttribute("data-scale"));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(Number(vp.getAttribute("data-scale"))).toBeGreaterThan(before);
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(Number(vp.getAttribute("data-scale"))).toBe(before);
  });
});

describe("admin on phones", () => {
  test("the editorial menu is a disclosure naming the current page", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as typeof window.matchMedia;
    const { container } = render(<AdminNav roles={["admin"]} />);
    const d = container.querySelector("details")!;
    expect(d.open).toBe(false);
    expect(container.querySelector("summary")!.textContent).toContain("Users & roles");
    expect(screen.getByRole("link", { name: "Users & roles", hidden: true }).getAttribute("aria-current")).toBe("page");
  });
  test("full-screen editing wraps the same form and Esc leaves it", () => {
    render(
      <FullScreenEditor title="New event">
        <form aria-label="the form">
          <button type="submit">Save draft</button>
        </form>
      </FullScreenEditor>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Full-screen editing" }));
    expect(screen.getByRole("region", { name: /full-screen editing/ })).toBeTruthy();
    expect(screen.getByRole("form", { name: "the form" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /full-screen editing/ })).toBeNull();
    expect(document.activeElement?.textContent).toBe("Full-screen editing");
  });
});
