import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { ComparisonTable, RelationshipGraph, SourcePanel, StoryLibrary } from "@/components/creation/atlas";
import { ProfileView } from "@/components/creation/ProfileView";
import { MisconceptionExplorer } from "@/components/creation/MisconceptionExplorer";
import { CreationVisual } from "@/components/creation/CreationVisual";
import { KidsMode } from "@/components/creation/KidsMode";
import { reviewEntityType } from "@/components/admin/creation-review";
import {
  atlasRefs,
  buildComparison,
  CATEGORIES,
  COMPARE_ROWS,
  graphLayout,
  PROFILE_FIELDS,
  VISUAL_KEYS,
  type Atlas,
  type Entry,
  type Profile,
  type Ref,
} from "@/lib/data/creation-types";
import { creation, creationStrings } from "@/lib/i18n/modules/creation";

/*
 * TEST FIXTURES ONLY. Every name, text and reference below is a placeholder invented for these tests ("Fixture …").
 * None of it is religious content and none of it is shown on the site: the pages read only published, reviewed rows.
 */
const t = creationStrings("en");
const NE = t.notEstablished;
const qRef: Ref = { kind: "quran", surah: 1, from: 1, to: null, hadith: null, locator: null, work: null };
const hRef: Ref = { kind: "hadith", surah: null, from: null, to: null, hadith: { collection: "bukhari", number: "1", grade: "Fixture grade", grader: "Fixture grader" }, locator: null, work: null };
const wRef: Ref = { kind: "tafsir", surah: null, from: null, to: null, hadith: null, locator: "vol. 1", work: "Fixture work" };

let n = 0;
const entry = (o: Partial<Entry> & Pick<Entry, "kind">): Entry => ({
  id: `fixture-entry-${++n}`,
  profileId: "p-jinn",
  fieldKey: null,
  position: 1,
  title: null,
  bodyMd: "Fixture body.",
  known: true,
  evidence: "revelation",
  refs: [qRef],
  question: null,
  everydayApplication: null,
  ...o,
});
const profile = (o: Partial<Profile> & Pick<Profile, "id" | "slug" | "categoryId">): Profile => ({
  nameEn: `Fixture ${o.slug}`,
  nameAr: "تجربة",
  classification: null,
  version: 3,
  updatedAt: "2026-10-01T00:00:00Z",
  entries: [],
  ...o,
});

const jinn = profile({
  id: "p-jinn",
  slug: "jinn",
  categoryId: "jinn",
  entries: [
    entry({ kind: "characteristic", fieldKey: "origin", bodyMd: "Fixture origin text." }),
    entry({ kind: "characteristic", fieldKey: "nature", known: false, evidence: "not_established", bodyMd: "", refs: [] }),
    entry({ kind: "ability", bodyMd: "Fixture ability one.", evidence: "authentic_hadith", refs: [hRef], position: 1 }),
    entry({ kind: "ability", bodyMd: "Fixture ability two.", evidence: "scholarly_interpretation", refs: [wRef], position: 2 }),
    entry({ kind: "misconception", question: "Fixture question?", bodyMd: "Fixture answer." }),
    entry({ kind: "lesson", bodyMd: "Fixture lesson.", everydayApplication: "Fixture everyday application." }),
  ],
});
// Same category, not the overview profile: the comparison must never borrow from it.
const other = profile({ id: "p-other", slug: "fixture-other", categoryId: "humans", entries: [entry({ kind: "characteristic", fieldKey: "origin", profileId: "p-other", bodyMd: "Must not appear." })] });

const atlas: Atlas = {
  profiles: [jinn, other],
  relationships: [
    { id: "r1", fromKind: "creation", fromRef: "jinn", relation: "fixture relation", toKind: "event", toRef: "fixture-event", evidence: "revelation", refs: [qRef] },
    { id: "r2", fromKind: "concept", fromRef: "fixture-concept", relation: "fixture link", toKind: "creation", toRef: "jinn", evidence: "authentic_hadith", refs: [hRef] },
  ],
  stories: [{ id: "s1", slug: "fixture-story", title: "Fixture story", titleAr: null, summary: "Fixture summary.", profileId: "p-jinn", position: 1, claimEvidence: "quran", refs: [qRef] }],
  visuals: [],
};
const empty: Atlas = { profiles: [], relationships: [], stories: [], visuals: [] };

describe("Creation Atlas data rules", () => {
  test("the six categories mirror the migration's seed", () => {
    const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261031001400_creation_atlas.sql"), "utf8");
    for (const c of CATEGORIES) expect(sql).toContain(`('${c.id}', '${c.nameEn}', '${c.nameAr}'`);
    expect(CATEGORIES).toHaveLength(6);
  });

  test("comparison reads only each category's overview profile and leaves gaps empty", () => {
    const { columns, rows } = buildComparison(atlas.profiles);
    expect(columns.map((c) => [c.category, c.profile?.slug ?? null])).toEqual([
      ["humans", null],
      ["jinn", "jinn"],
      ["angels", null],
    ]);
    const origin = rows.find((r) => r.row === "origin")!;
    expect(origin.cells[0]!.entry).toBeNull(); // the non-overview humans profile is not borrowed
    expect(origin.cells[1]!.entry?.bodyMd).toBe("Fixture origin text.");
    const abilities = rows.find((r) => r.row === "abilities")!;
    expect(abilities.cells[1]!.more).toBe(1);
  });

  test("source panel collects each reference once, Quran first", () => {
    expect(atlasRefs(atlas).map((r) => r.kind)).toEqual(["quran", "hadith", "tafsir"]);
  });

  test("graph layout is deterministic and names creation nodes by their profile", () => {
    const a = graphLayout(atlas.relationships, atlas.profiles);
    const b = graphLayout(atlas.relationships, atlas.profiles);
    expect(a).toEqual(b);
    expect(a.nodes).toHaveLength(3);
    expect(a.nodes.find((x) => x.ref === "jinn")).toMatchObject({ label: "Fixture jinn", href: "/creation/jinn" });
    expect(a.nodes.find((x) => x.ref === "fixture-event")?.href).toBeUndefined();
  });

  test("review queue records every creation row under the entity type 'creation'", () => {
    expect(reviewEntityType("creation_ability")).toBe("creation");
    expect(reviewEntityType("creation_profile")).toBe("creation");
    expect(reviewEntityType("story")).toBe("story");
  });

  test("module strings exist in English and Arabic with the same shape", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(creation.ar)).toEqual(keys(creation.en));
    expect(creation.en.notEstablished).toBe("Not established by the selected authentic sources.");
  });
});

describe("ComparisonTable", () => {
  test("each cell shows a published entry with evidence class and citation, otherwise the not-established sentence", () => {
    render(<ComparisonTable profiles={atlas.profiles} t={t} locale="en" />);
    const cell = (k: string) => document.querySelector(`[data-cell="${k}"]`)!;
    expect(cell("origin:jinn")).toHaveTextContent("Fixture origin text.");
    expect(cell("origin:jinn").querySelector('[data-evidence-class="revelation"]')).not.toBeNull();
    expect(within(cell("origin:jinn") as HTMLElement).getByRole("link", { name: "Q 1:1" })).toHaveAttribute("href", "/quran/1#ayah-1");
    expect(cell("abilities:jinn").querySelector('[data-evidence-class="authentic_hadith"]')).not.toBeNull();
    expect(cell("abilities:jinn")).toHaveTextContent("+1 more on the profile");
    // A published "not established" entry and a missing entry read the same fixed sentence.
    expect(cell("nature:jinn")).toHaveTextContent(NE);
    expect(cell("origin:humans")).toHaveTextContent(NE);
    expect(cell("origin:humans")).not.toHaveTextContent("Must not appear.");
    expect(cell("purpose:angels")).toHaveTextContent(NE);
  });

  test("with nothing published every one of the 18 cells is the designed empty state", () => {
    render(<ComparisonTable profiles={[]} t={t} locale="en" />);
    const cells = document.querySelectorAll("[data-cell]");
    expect(cells).toHaveLength(COMPARE_ROWS.length * 3);
    for (const c of cells) {
      expect(c).toHaveTextContent(NE);
      expect(c.querySelector('[data-evidence-class="not_established"]')).not.toBeNull();
      expect(c.querySelector("[data-citation]")).toBeNull();
    }
  });
});

describe("ProfileView", () => {
  test("renders the 17-field template; unknown fields print the not-established sentence", () => {
    render(<ProfileView atlas={{ ...atlas, profiles: [jinn] }} profile={jinn} t={t} locale="en" />);
    const fields = document.querySelectorAll("[data-field]");
    expect([...fields].map((f) => f.getAttribute("data-field"))).toEqual([...PROFILE_FIELDS]);
    const f = (k: string) => document.querySelector(`[data-field="${k}"]`)!;
    expect(f("name")).toHaveTextContent("Fixture jinn");
    expect(f("name").querySelector('[lang="ar"][dir="rtl"]')).toHaveTextContent("تجربة");
    for (const unknown of ["classification", "purpose", "limitations", "relationship_with_humans", "chronological_position", "location", "vocabulary", "nature"])
      expect(f(unknown), unknown).toHaveTextContent(NE);
    expect(f("origin")).toHaveTextContent("Fixture origin text.");
    expect(f("origin")).not.toHaveTextContent(NE);
    expect(f("abilities").querySelectorAll("[data-evidence-class]")).toHaveLength(2);
    expect(f("abilities").querySelector('[data-evidence-class="scholarly_interpretation"]')).not.toBeNull();
    expect(f("misconceptions")).toHaveTextContent("Fixture question?");
    expect(f("lessons")).toHaveTextContent("Fixture everyday application.");
    expect(within(f("related_hadith") as HTMLElement).getByRole("link", { name: /Bukhari 1/ })).toHaveAttribute("href", "/hadith/bukhari/1");
    expect(f("quranic_events")).toHaveTextContent("fixture relation");
    expect(f("sources").querySelectorAll("[data-citation]").length).toBeGreaterThanOrEqual(3);
    expect(f("review_status")).toHaveTextContent("version 3");
  });

  test("evidence badges: revelation, authentic hadith, scholarly interpretation and not established", () => {
    render(<ProfileView atlas={{ ...atlas, profiles: [jinn] }} profile={jinn} t={t} locale="en" />);
    for (const label of ["Revelation (Quran)", "Authentic hadith", "Scholarly interpretation", "Not established"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  test("a profile with no published entries prints the sentence in every content field", () => {
    const bare = profile({ id: "p-bare", slug: "fixture-bare", categoryId: "animals" });
    render(<ProfileView atlas={{ ...empty, profiles: [bare] }} profile={bare} t={t} locale="en" />);
    const unknownFields = PROFILE_FIELDS.filter((k) => k !== "name" && k !== "review_status");
    for (const k of unknownFields) expect(document.querySelector(`[data-field="${k}"]`), k).toHaveTextContent(NE);
  });

  test("Arabic strings render the Arabic sentence", () => {
    const bare = profile({ id: "p-bare", slug: "fixture-bare", categoryId: "animals" });
    render(<ProfileView atlas={{ ...empty, profiles: [bare] }} profile={bare} t={creationStrings("ar")} locale="ar" />);
    expect(document.querySelector('[data-field="origin"]')).toHaveTextContent(creation.ar.notEstablished);
  });
});

describe("home sections", () => {
  test("empty states: graph, stories and sources", () => {
    render(
      <>
        <RelationshipGraph relationships={[]} profiles={[]} t={t} locale="en" />
        <StoryLibrary stories={[]} profiles={[]} t={t} locale="en" />
        <SourcePanel refs={[]} t={t} />
      </>,
    );
    expect(screen.getByText(t.graph.empty)).toBeInTheDocument();
    expect(screen.getByText(t.stories.empty)).toBeInTheDocument();
    expect(screen.getByText(t.sources.empty)).toBeInTheDocument();
  });

  test("relationship graph has an accessible list with evidence and citations for every edge", () => {
    render(<RelationshipGraph relationships={atlas.relationships} profiles={atlas.profiles} t={t} locale="en" />);
    expect(screen.getByRole("img", { name: /Diagram of 2 relationships/ })).toBeInTheDocument();
    const items = within(screen.getByTestId("creation-relationships")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const li of items) {
      expect(li.querySelector("[data-evidence-class]")).not.toBeNull();
      expect(li.querySelector("[data-citation]")).not.toBeNull();
    }
  });

  test("misconceptions: the health caution is always shown, with or without entries", () => {
    const { unmount } = render(<MisconceptionExplorer items={[]} locale="en" />);
    expect(screen.getByTestId("creation-caution")).toHaveTextContent(/anxiety, nightmares/);
    expect(screen.getByText(t.misconceptions.empty)).toBeInTheDocument();
    unmount();
    const m = jinn.entries.find((e) => e.kind === "misconception")!;
    render(<MisconceptionExplorer items={[{ entry: m, categoryId: "jinn", profileSlug: "jinn", profileName: "Fixture jinn" }]} locale="en" />);
    expect(screen.getByTestId("creation-caution")).toBeInTheDocument();
    expect(screen.getByText("Fixture question?")).toBeInTheDocument();
  });

  test("kids mode toggles the presentation and remembers it", () => {
    render(
      <KidsMode label="Kids mode" onText="on">
        <p>child</p>
      </KidsMode>,
    );
    const btn = screen.getByRole("button", { name: "Kids mode" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".cr")).toHaveAttribute("data-kids", "true");
    expect(localStorage.getItem("qitl-creation-kids")).toBe("1");
  });
});

describe("CreationVisual", () => {
  test("every scene is labelled, has pause and replay, and respects reduced motion", () => {
    const mm = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", mm);
    for (const k of VISUAL_KEYS) {
      const { unmount } = render(<CreationVisual animation={k} alt={`Fixture alt ${k}`} strings={t.visual} />);
      expect(screen.getByRole("img", { name: `Fixture alt ${k}` })).toBeInTheDocument();
      const fig = document.querySelector(".cr-visual")!;
      expect(fig).toHaveAttribute("data-playing", "false"); // reduced motion: no autoplay
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      expect(fig).toHaveAttribute("data-playing", "true");
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      expect(fig).toHaveAttribute("data-playing", "false");
      fireEvent.click(screen.getByRole("button", { name: "Replay" }));
      expect(fig).toHaveAttribute("data-playing", "true");
      expect(fig.querySelector("text")).toBeNull(); // no words drawn into any scene
      unmount();
    }
    vi.unstubAllGlobals();
  });

  test("unknown animation keys render nothing", () => {
    const { container } = render(<CreationVisual animation="not-a-scene" alt="x" strings={t.visual} />);
    expect(container).toBeEmptyDOMElement();
  });
});
