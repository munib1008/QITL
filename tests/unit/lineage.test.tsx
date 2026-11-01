import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CLASS_PATTERN, CLASS_TOKENS, contrast, deriveEvidenceClass, LINE_PATTERNS, LINEAGE_CLASSES, lineStyleFor, referenceClasses, type LineageClass } from "@/lib/lineage/classes";
import { findLineagePath } from "@/lib/lineage/path";
import { layoutRoute, splitLabel } from "@/lib/lineage/layout";
import { EMPTY_COUNTS, EMPTY_DOC, type LineageDoc, type LineageLink } from "@/lib/lineage/types";
import { FIXTURE_COUNTS, FIXTURE_EMPTY_COUNTS, FIXTURE_END, FIXTURE_START, fixtureLineage } from "@/lib/lineage/fixtures";
import { lineageStrings, scriptureStrings } from "@/lib/i18n/modules/lineage";
import { LineageView } from "@/components/lineage/LineageView";
import { EvidenceLegend } from "@/components/lineage/EvidenceChip";

let locale = "en";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/genealogy",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale }),
}));

const css = readFileSync(join(__dirname, "..", "..", "src", "styles", "lineage.css"), "utf8");

describe("evidence classes: derivation", () => {
  test("six classes; the class comes from the claim and its references, never from a label alone", () => {
    expect(LINEAGE_CLASSES).toEqual(["quran", "hadith", "scholar", "scripture", "history", "unknown"]);
    const d = deriveEvidenceClass;
    expect(d({ confidence: "quran", claimEvidence: "quran", referenceKinds: ["quran"] })).toBe("quran");
    // A "Quran" label with no verse cited is not green.
    expect(d({ confidence: "quran", claimEvidence: "quran", referenceKinds: ["tafsir"] })).toBe("unknown");
    expect(d({ confidence: "hadith", claimEvidence: "hadith", referenceKinds: ["hadith"] })).toBe("hadith");
    expect(d({ confidence: "hadith", claimEvidence: "hadith", referenceKinds: [] })).toBe("unknown");
    expect(d({ confidence: "scholar", claimEvidence: "scholar", referenceKinds: ["tafsir"] })).toBe("scholar");
    expect(d({ confidence: "scholar", claimEvidence: "scholar", referenceKinds: ["scholar", "scripture"] })).toBe("scholar");
    expect(d({ confidence: "scholar", claimEvidence: "scholar", referenceKinds: ["scripture"] })).toBe("scripture");
    expect(d({ confidence: "scholar", claimEvidence: "scholar", referenceKinds: ["history"] })).toBe("history");
    expect(d({ confidence: "estimate", claimEvidence: "estimate", referenceKinds: ["history", "scripture"] })).toBe("history");
    expect(d({ confidence: "estimate", claimEvidence: "estimate", referenceKinds: ["scripture"] })).toBe("scripture");
    expect(d({ confidence: "estimate", claimEvidence: "estimate", referenceKinds: [] })).toBe("unknown");
  });

  test("disputed or unknown, on the link or on the claim, is always grey whatever else is cited", () => {
    for (const refs of [["quran"], ["hadith"], ["tafsir"], ["scripture"], ["history"]]) {
      expect(deriveEvidenceClass({ confidence: "disputed", claimEvidence: "quran", referenceKinds: refs })).toBe("unknown");
      expect(deriveEvidenceClass({ confidence: "quran", claimEvidence: "disputed", referenceKinds: refs })).toBe("unknown");
      expect(deriveEvidenceClass({ confidence: "unknown", claimEvidence: "scholar", referenceKinds: refs })).toBe("unknown");
    }
    expect(deriveEvidenceClass({ confidence: "quran", claimEvidence: null, referenceKinds: ["quran"] })).toBe("unknown");
  });

  test("reference kinds map to classes (tafsir counts as scholarship)", () => {
    expect(referenceClasses(["tafsir", "scholar", "quran", "other"])).toEqual(["quran", "scholar"]);
    expect(referenceClasses([])).toEqual([]);
  });
});

describe("line styles", () => {
  test("every class has its own pattern, so colour is never the only signal; all three families appear", () => {
    const patterns = LINEAGE_CLASSES.map((c) => CLASS_PATTERN[c]);
    expect(new Set(patterns).size).toBe(6);
    expect(new Set(LINEAGE_CLASSES.map((c) => lineStyleFor(c).family))).toEqual(new Set(["solid", "dashed", "dotted"]));
    expect(lineStyleFor("quran")).toMatchObject({ family: "solid", dasharray: "none" });
    expect(lineStyleFor("unknown").family).toBe("dotted");
    expect(new Set(Object.values(LINE_PATTERNS).map((p) => p.dasharray)).size).toBe(6);
  });
});

describe("colour tokens and contrast", () => {
  const surfaces = { light: ["#f7f3ea", "#fffdf8"], dark: ["#0b171b", "#122326"] } as const;
  test.each(LINEAGE_CLASSES.map((c) => [c] as const))("%s: text on its fill is >= 4.5:1 and its line is >= 3:1 on the page, in both themes", (c) => {
    for (const mode of ["light", "dark"] as const) {
      const { bg, fg } = CLASS_TOKENS[c][mode];
      expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5);
      for (const surface of surfaces[mode]) expect(contrast(bg, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  test("the CSS variables are the tokens (light, dark and the system dark preference) and use no other class colour", () => {
    const grab = (block: string, name: string, c: LineageClass) => new RegExp(`${name}-${c}: (#[0-9A-Fa-f]{6})`).exec(block)?.[1]?.toUpperCase();
    const light = css.slice(css.indexOf(":root, [data-theme=\"light\"]"), css.indexOf("[data-theme=\"dark\"]"));
    const dark = css.slice(css.indexOf("[data-theme=\"dark\"]"), css.indexOf("@media (prefers-color-scheme: dark)"));
    const system = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf(".ln {"));
    for (const c of LINEAGE_CLASSES) {
      expect(grab(light, "--ln", c)).toBe(CLASS_TOKENS[c].light.bg.toUpperCase());
      expect(grab(light, "--ln", c)).toBeTruthy();
      expect(new RegExp(`--ln-${c}-fg: (#[0-9A-Fa-f]{6})`).exec(light)?.[1]?.toUpperCase()).toBe(CLASS_TOKENS[c].light.fg.toUpperCase());
      expect(new RegExp(`--ln-${c}: (#[0-9A-Fa-f]{6})`).exec(dark)?.[1]?.toUpperCase()).toBe(CLASS_TOKENS[c].dark.bg.toUpperCase());
      expect(new RegExp(`--ln-${c}: (#[0-9A-Fa-f]{6})`).exec(system)?.[1]?.toUpperCase()).toBe(CLASS_TOKENS[c].dark.bg.toUpperCase());
    }
    // The brief's amber #947140 gives 4.47:1 with white text, so it is darkened (documented in docs/LINEAGE.md).
    expect(contrast("#947140", "#FFFFFF")).toBeLessThan(4.5);
    expect(contrast(CLASS_TOKENS.scholar.light.bg, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});

const person = (id: string) => ({ id, name: `Person ${id}`, nameAr: null, kind: "other" });
const mkLink = (id: string, a: string, d: string, o: Partial<LineageLink> = {}): LineageLink => ({
  id,
  kind: "parent_of",
  ancestor: a,
  descendant: d,
  confidence: "scholar",
  evidenceClass: "scholar",
  referenceClasses: ["scholar"],
  competingGroup: null,
  tradition: null,
  uncertainty: null,
  claim: { id: `c-${id}`, statement: "Synthetic claim.", evidence: "scholar", references: [] },
  ...o,
});
const doc = (ids: string[], links: LineageLink[], gaps: LineageDoc["gaps"] = []): LineageDoc => ({ people: ids.map(person), links, gaps, nodeClaims: [] });

describe("the path from the first person to the last", () => {
  test("nothing published: no path and nothing invented", () => {
    expect(findLineagePath(EMPTY_DOC, "adam", "muhammad")).toMatchObject({ status: "missing_endpoint", routes: [], fromStart: [], toEnd: [] });
  });

  test("published links that do not reach the end: 'not connected', with what IS established from each end", () => {
    const p = findLineagePath(doc(["adam", "a", "b", "z", "muhammad"], [mkLink("1", "adam", "a"), mkLink("2", "a", "b"), mkLink("3", "z", "muhammad")]), "adam", "muhammad");
    expect(p.status).toBe("not_connected");
    expect(p.routes).toEqual([]);
    expect(p.fromStart).toEqual(["a", "b"]);
    expect(p.toEnd).toEqual(["z"]);
  });

  test("a connected route lists every step in order; a descendant_of edge is already normalised to ancestor -> descendant", () => {
    const p = findLineagePath(doc(["adam", "a", "muhammad"], [mkLink("1", "adam", "a"), mkLink("2", "a", "muhammad")]), "adam", "muhammad");
    expect(p.status).toBe("connected");
    expect(p.routes).toHaveLength(1);
    expect(p.routes[0]!.steps.map((s) => [s.ancestor, s.descendant])).toEqual([["adam", "a"], ["a", "muhammad"]]);
  });

  test("a gap bridges two people as a step of its own type, and competing accounts of one step stay together", () => {
    const g = { id: "g", ancestor: "a", descendant: "muhammad", note: "Traditional genealogies differ; exact chain not authenticated.", confidence: "disputed" as const, evidenceClass: "unknown" as const, referenceClasses: [], competingGroup: null, tradition: null, claim: { id: "cg", statement: "x", evidence: "disputed" as const, references: [] } };
    const p = findLineagePath(doc(["adam", "a", "muhammad"], [mkLink("1", "adam", "a"), mkLink("2", "adam", "a", { evidenceClass: "hadith", competingGroup: "x" })], [g]), "adam", "muhammad");
    expect(p.status).toBe("connected");
    const [s1, s2] = p.routes[0]!.steps;
    expect(s1!.options.map((o) => o.id)).toEqual(["1", "2"]);
    expect(s2!.options).toEqual([{ type: "gap", id: "g", evidenceClass: "unknown", tradition: null, competingGroup: null }]);
  });

  test("two routes through different intermediates are both returned, shortest first", () => {
    const p = findLineagePath(doc(["adam", "a", "b", "c", "muhammad"], [mkLink("1", "adam", "a"), mkLink("2", "a", "muhammad"), mkLink("3", "adam", "b"), mkLink("4", "b", "c"), mkLink("5", "c", "muhammad")]), "adam", "muhammad");
    expect(p.routes.map((r) => r.steps.length)).toEqual([2, 3]);
  });

  test("a chain assembled from incompatible traditions is never presented as one lineage", () => {
    const p = findLineagePath(doc(["adam", "a", "muhammad"], [mkLink("1", "adam", "a", { tradition: "Tradition X" }), mkLink("2", "a", "muhammad", { tradition: "Tradition Y" })]), "adam", "muhammad");
    expect(p.status).toBe("incompatible");
    expect(p.routes).toEqual([]);
    expect(p.incompatible[0]!.traditions).toEqual(["Tradition X", "Tradition Y"]);
  });

  test("one tradition (or none named) can carry a route; a competing option of another tradition does not break it", () => {
    const ok = findLineagePath(doc(["adam", "a", "muhammad"], [mkLink("1", "adam", "a", { tradition: "Tradition X" }), mkLink("2", "a", "muhammad"), mkLink("3", "a", "muhammad", { tradition: "Tradition Y" })]), "adam", "muhammad");
    expect(ok.status).toBe("connected");
    expect(ok.routes[0]!.traditions).toEqual(["Tradition X"]);
  });

  test("a cycle in the data cannot hang the search", () => {
    const p = findLineagePath(doc(["adam", "a", "b", "muhammad"], [mkLink("1", "adam", "a"), mkLink("2", "a", "b"), mkLink("3", "b", "a"), mkLink("4", "b", "muhammad")]), "adam", "muhammad");
    expect(p.status).toBe("connected");
    expect(p.routes).toHaveLength(1);
  });
});

describe("layout", () => {
  test("a route of n steps has n+1 people; competing options are spread side by side; hidden ones are flagged", () => {
    const p = findLineagePath(fixtureLineage(), FIXTURE_START, FIXTURE_END);
    expect(p.status).toBe("connected");
    const lay = layoutRoute(p.routes[0]!, (o) => o.evidenceClass !== "hadith");
    expect(lay.persons).toHaveLength(p.routes[0]!.steps.length + 1);
    const twoWay = lay.steps.find((s) => s.options.length === 2)!;
    expect(new Set(twoWay.options.map((o) => o.x)).size).toBe(2);
    expect(twoWay.hidden).toBe(1);
    expect(lay.height).toBeGreaterThan(lay.persons.at(-1)!.y);
  });
  test("labels split near the middle and never run past the limit", () => {
    expect(splitLabel("short", 24)).toEqual(["short"]);
    const [a, b] = splitLabel("Undocumented intermediate generations", 24);
    expect(a!.length).toBeLessThanOrEqual(24);
    expect(b!.length).toBeLessThanOrEqual(24);
  });
});

describe("the lineage view", () => {
  test("the legend names all six classes in words and their line patterns", () => {
    render(<EvidenceLegend />);
    const t = lineageStrings("en");
    for (const c of LINEAGE_CLASSES) expect(screen.getByText(t.classes[c].name)).toBeInTheDocument();
    expect(screen.getByText(/Earlier-scripture textual witness, not independently authenticated Islamic revelation/)).toBeInTheDocument();
    expect(screen.getByText(/never a person's worth/)).toBeInTheDocument();
  });

  test("with nothing published: the designed empty state with counts only, no titles, no graph", () => {
    const { container } = render(<LineageView doc={EMPTY_DOC} counts={FIXTURE_EMPTY_COUNTS} start="adam" end="muhammad" />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No part of this lineage is published yet.");
    expect(screen.getByText("0 published, 4 under review")).toBeInTheDocument();
    expect(container.querySelector("svg.zx-svg")).toBeNull();
    expect(container.textContent).not.toMatch(/Adam|Muhammad|Test person/);
    render(<LineageView doc={EMPTY_DOC} counts={EMPTY_COUNTS} start="adam" end="muhammad" />);
  });

  test("a connected fixture route: graph, text outline with each link's class, competing accounts, a gap box", () => {
    const { container } = render(<LineageView doc={fixtureLineage()} counts={FIXTURE_COUNTS} start={FIXTURE_START} end={FIXTURE_END} />);
    expect(container.querySelector("[data-path-status=connected]")).not.toBeNull();
    expect(screen.getAllByRole("heading", { name: /Route \d of \d/ })).toHaveLength(2);
    const outline = screen.getAllByRole("list", { name: "Text outline of the route" })[0]!;
    expect(within(outline).getAllByText("Undocumented intermediate generations").length).toBe(1);
    expect(within(outline).getByText("Competing accounts of this step (all shown)")).toBeInTheDocument();
    // Every line in the graph carries its class twice: a pattern and a tag with words.
    const lines = container.querySelectorAll("svg.zx-svg path.ln-line[data-class]");
    expect(lines.length).toBeGreaterThan(4);
    for (const l of Array.from(lines)) expect(l.getAttribute("stroke-dasharray") !== null || l.getAttribute("data-class") === "quran").toBe(true);
  });

  test("assessing a link shows what we know, how we know and what is uncertain; a scripture class adds the caution", () => {
    render(<LineageView doc={fixtureLineage()} counts={FIXTURE_COUNTS} start={FIXTURE_START} end={FIXTURE_END} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Assess this link/ })[0]!);
    const panel = document.querySelector(".ln-panel")!;
    for (const h of ["What we know", "How we know", "What is uncertain"]) expect(within(panel as HTMLElement).getByRole("heading", { name: h })).toBeInTheDocument();
    expect(panel.textContent).toMatch(/Evidence class/);
    // Select the scripture link (f3) through the graph.
    const opt = document.querySelector('g.ln-opt[data-class="scripture"]')!;
    fireEvent.click(opt);
    expect(document.querySelector(".ln-panel")!.textContent).toMatch(/not independently authenticated Islamic revelation/);
    expect(document.querySelector('.ln-panel a[href="/scriptures"]')).not.toBeNull();
  });

  test("a person with no published claim reads 'Not established' for lifespan and dates", () => {
    render(<LineageView doc={fixtureLineage()} counts={FIXTURE_COUNTS} start={FIXTURE_START} end={FIXTURE_END} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^About this person/ })[0]!);
    const panel = document.querySelector(".ln-panel")!;
    expect(panel.textContent).toMatch(/Lifespan/);
    expect(panel.textContent).toMatch(/Not established/);
  });

  test("the evidence filter hides the links of an unticked class and says how many are hidden; nothing is deleted", () => {
    render(<LineageView doc={fixtureLineage()} counts={FIXTURE_COUNTS} start={FIXTURE_START} end={FIXTURE_END} />);
    const box = screen.getByRole("checkbox", { name: /Hadith/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
    expect(document.querySelectorAll('g.ln-opt[data-class="hadith"]')).toHaveLength(0);
    expect(screen.getAllByText("1 hidden by the filter").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Show all classes" }));
    expect(document.querySelectorAll('g.ln-opt[data-class="hadith"]').length).toBeGreaterThan(0);
  });

  test("keyboard: Arrow Down moves along the route and Enter assesses the focused item", () => {
    render(<LineageView doc={fixtureLineage()} counts={FIXTURE_COUNTS} start={FIXTURE_START} end={FIXTURE_END} />);
    const first = document.querySelector("g.ln-node")! as SVGGElement;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement?.classList.contains("ln-opt")).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(document.querySelector(".ln-panel")!.getAttribute("data-selected")).toMatch(/^(link|gap):/);
  });

  test("the published links stop short: 'Not established' and what is published so far, no invented chain", () => {
    const d = doc(["adam", "a", "z", "muhammad"], [mkLink("1", "adam", "a"), mkLink("2", "z", "muhammad")]);
    const { container } = render(<LineageView doc={d} counts={FIXTURE_COUNTS} start="adam" end="muhammad" />);
    expect(container.querySelector("[data-path-status=not_connected]")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "The published links do not yet connect the two ends." })).toBeInTheDocument();
    expect(container.querySelector("svg.zx-svg")).toBeNull();
  });
});

describe("Arabic and Urdu", () => {
  test("the strings exist in both languages and the Arabic page uses Arabic words for the classes", () => {
    for (const l of ["ar", "ur"]) {
      const t = lineageStrings(l);
      expect(t.title).not.toBe(lineageStrings("en").title);
      for (const c of LINEAGE_CLASSES) expect(t.classes[c].name).toMatch(/[؀-ۿ]/);
      expect(scriptureStrings(l).framework).toMatch(/[؀-ۿ]/);
    }
  });
  test("the Arabic legend renders Arabic labels", () => {
    locale = "ar";
    render(<EvidenceLegend />);
    expect(screen.getByText("القرآن")).toBeInTheDocument();
    locale = "en";
  });
});
