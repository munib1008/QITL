import { describe, expect, test } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { LifespanLanes } from "@/components/lifestyle/LifespanLanes";
import { RecordCard, ReconstructionContainer } from "@/components/lifestyle/Evidence";
import { Scene, SCENE_KEYS } from "@/components/lifestyle/Scene";
import { lifestyle } from "@/lib/i18n/modules/lifestyle";
import { buildLanes, FIELD_KEYS, publishProblems, requiredPathways, segmentOk, splitLessons, type LifespanRecord } from "@/lib/lifestyle/model";
import { buildRow } from "@/lib/lifestyle/editor";

/** Placeholder records only: the numbers below are arbitrary test values, not research. */
const t = lifestyle.en;
const rec = (id: string, kind: LifespanRecord["kind"], measure: LifespanRecord["measure"], v: Partial<LifespanRecord> = {}): LifespanRecord => ({
  id,
  kind,
  measure,
  statement: `Fixture ${id}`,
  value_years: null,
  value_low: null,
  value_high: null,
  evidence_category: kind === "quran_statement" ? "A" : kind === "hadith_statement" ? "B" : kind === "speculative_theory" ? "D" : "C",
  ...v,
});

describe("lifespan lanes", () => {
  const records = [
    rec("a", "quran_statement", "years_among_people", { value_years: 11 }),
    rec("b", "archaeological_estimate", "life_expectancy_at_birth", { value_low: 2, value_high: 4 }),
    rec("c", "archaeological_estimate", "after_childhood", { value_years: 7 }),
    rec("d", "modern_verified_max", "maximum", { value_years: 13 }),
    rec("e", "archaeological_estimate", "life_expectancy_at_birth", { value_years: 3 }),
  ];

  test("one lane per evidence kind and measure; a record is only ever in its own lane; each lane has its own scale", () => {
    const lanes = buildLanes(records);
    expect(lanes.map((l) => l.key)).toEqual(["quran_statement:years_among_people", "archaeological_estimate:life_expectancy_at_birth", "archaeological_estimate:after_childhood", "modern_verified_max:maximum"]);
    for (const l of lanes) for (const r of l.records) expect(`${r.kind}:${r.measure}`).toBe(l.key);
    expect(lanes.flatMap((l) => l.records)).toHaveLength(records.length);
    expect(lanes.map((l) => l.max)).toEqual([11, 4, 7, 13]);
  });

  test("the chart draws separate marks and never a line joining records", () => {
    const { container } = render(<LifespanLanes records={records} t={t} />);
    // (Evidence badges carry their own icon paths; the chart drawings carry none.)
    expect(container.querySelectorAll(".lta-lane-svg polyline, .lta-lane-svg path")).toHaveLength(0);
    expect(container.querySelectorAll(".lta-lane-svg").length).toBe(records.length);
    const lanes = screen.getAllByTestId("lane");
    const filled = lanes.filter((l) => !l.dataset.lane!.endsWith(":empty"));
    expect(filled).toHaveLength(4);
    for (const lane of filled) {
      const svgs = lane.querySelectorAll(".lta-lane-svg");
      // One small chart per record: records in a lane do not share a drawing either.
      expect(svgs.length).toBe(lane.querySelectorAll("[data-record]").length);
      svgs.forEach((s) => expect(s.querySelectorAll("[data-mark]")).toHaveLength(1));
    }
    const range = container.querySelector('[data-record="b"] [data-mark]');
    expect(range?.getAttribute("data-mark")).toBe("range");
  });

  test("kinds with no published record show an empty lane, and speculative theories never enter the chart", () => {
    render(<LifespanLanes records={[rec("s", "speculative_theory", null)]} t={t} />);
    const lanes = screen.getAllByTestId("lane");
    expect(lanes.every((l) => l.dataset.lane!.endsWith(":empty"))).toBe(true);
    expect(screen.getAllByText(t.longevity.laneEmpty).length).toBe(6);
    expect(screen.queryByText("Fixture s")).toBeNull();
  });

  test("no number appears unless a record carries it", () => {
    const { container } = render(<LifespanLanes records={[]} t={t} />);
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe("the reconstruction container", () => {
  test("a class D record always renders inside the separate 'Reconstruction — not established' container", () => {
    render(<RecordCard r={{ evidence_category: "D", is_reconstruction: true, confidence: "speculative" }} t={t} title="Fixture D" body="Fixture body" />);
    const box = screen.getByTestId("reconstruction");
    expect(within(box).getByText("Fixture D")).toBeInTheDocument();
    expect(within(box).getAllByText(t.reconstruction).length).toBeGreaterThan(0);
    expect(box).toHaveAttribute("data-category", "D");
  });
  test("class A–C records never render inside it, and their evidence is visible (not hover-only)", () => {
    render(<RecordCard r={{ evidence_category: "C", publication: "Fixture publication", primary_citation: "Fixture citation" }} t={t} title="Fixture C" />);
    expect(screen.queryByTestId("reconstruction")).toBeNull();
    expect(screen.getByText("Fixture citation")).toBeVisible();
    expect(screen.getByText(t.categories.C)).toBeInTheDocument();
  });
  test("the container labels itself even with no title", () => {
    render(
      <ReconstructionContainer t={t}>
        <p>x</p>
      </ReconstructionContainer>,
    );
    expect(screen.getByRole("complementary", { name: t.reconstruction })).toBeInTheDocument();
  });
});

describe("evidence model", () => {
  test("pathways: A/B religious, C/D scientific, mixed both, not established religious", () => {
    expect(requiredPathways(["A"])).toEqual(["religious"]);
    expect(requiredPathways(["B", "A"])).toEqual(["religious"]);
    expect(requiredPathways(["C"])).toEqual(["scientific"]);
    expect(requiredPathways(["D"])).toEqual(["scientific"]);
    expect(requiredPathways(["A", "C"])).toEqual(["religious", "scientific"]);
    expect(requiredPathways([null])).toEqual(["religious"]);
  });
  test("publish problems mirror the database rules", () => {
    expect(publishProblems({ evidence_category: "A", confidence: "high" })).toHaveLength(1);
    expect(publishProblems({ evidence_category: "A", confidence: "high", claim_id: "x", claimApproved: true })).toEqual([]);
    expect(publishProblems({ evidence_category: "C", confidence: "low", publication: "p" })).toHaveLength(1);
    expect(publishProblems({ evidence_category: "D", confidence: "low" })).toEqual(["Class D is published only with the reconstruction flag."]);
    expect(publishProblems({ evidence_category: "B", confidence: "low", is_reconstruction: true, claim_id: "x", claimApproved: true })).toEqual(["Only class D carries the reconstruction flag."]);
  });
  test("lessons split religious teaching from modern research", () => {
    const s = splitLessons([{ evidence_category: "A" }, { evidence_category: "C" }, { evidence_category: "B" }, { evidence_category: "D" }]);
    expect(s.religious).toHaveLength(2);
    expect(s.modern).toHaveLength(1);
    expect(s.reconstructions).toHaveLength(1);
  });
  test("a day is told in parts, never in hours", () => {
    expect(segmentOk({ part: "dawn", text: "Fixture" })).toBe(true);
    expect(segmentOk({ part: "dawn", text: "Fixture at 5:30" })).toBe(false);
    expect(segmentOk({ part: "dawn", text: "Fixture at 6 am" })).toBe(false);
    expect(segmentOk({ part: "dawn", text: "two hours later" })).toBe(false);
    expect(segmentOk({ part: "0600", text: "Fixture" })).toBe(false);
  });
  test("the template has exactly 20 fields, each with an English and Arabic label", () => {
    expect(FIELD_KEYS).toHaveLength(20);
    for (const k of FIELD_KEYS) {
      expect(lifestyle.en.fields[k]).toBeTruthy();
      expect(lifestyle.ar.fields[k]).toBeTruthy();
    }
  });
});

describe("editor rows", () => {
  test("a not-established field carries no evidence and no text", () => {
    const r = buildRow("lifestyle_field", { profile_id: "6f1b6a8e-6a3e-4d3a-9d1b-1a2b3c4d5e6f", field_key: "lifespan", known: false, body_md: "x", evidence_category: "C", publication: "p" });
    expect(r.ok && r.row).toMatchObject({ evidence_category: null, body_md: "", status: "draft" });
    expect(r.ok && "publication" in r.row).toBe(false);
  });
  test("class D always sets the reconstruction flag; drafts only", () => {
    const r = buildRow("lifestyle_housing", { slug: "fixture", title_en: "Fixture", evidence_category: "D" });
    expect(r.ok && r.row).toMatchObject({ is_reconstruction: true, status: "draft" });
  });
  test("invalid input is refused with reasons", () => {
    const r = buildRow("lifestyle_reconstruction", { slug: "Bad Slug", kind: "day_in_era", title_en: "x", evidence_category: "D" });
    expect(r.ok).toBe(false);
  });
});

describe("illustrations", () => {
  test("non-figurative scenes only, each with pause and replay and the non-figurative note", () => {
    expect(SCENE_KEYS.sort()).toEqual(["empty-market", "fields", "harvest", "mud-brick", "palms", "pastoral", "ship", "tools", "trade-route", "well"]);
    render(<Scene scene="well" labels={t.illustration} />);
    const fig = screen.getByRole("figure");
    expect(screen.getByText(t.illustration.note)).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Pause|Play/ });
    const before = fig.getAttribute("data-playing");
    fireEvent.click(toggle);
    expect(fig.getAttribute("data-playing")).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: t.illustration.replay }));
    expect(fig.getAttribute("data-playing")).toBe("true");
  });
});
