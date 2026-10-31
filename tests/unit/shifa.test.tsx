import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReviewedNotes, EntryView, LayerLegend, RecitationState, ReferencePoints, SafetyFraming } from "@/components/shifa/Shifa";
import { buildRow, requiredPathways, textProblems } from "@/lib/shifa/editor";
import {
  needsMentalHealthNotice,
  PLANNED_TOPICS,
  plannedIn,
  plannedTopic,
  REFERENCE_POINTS,
  SECTIONS,
  sectionFromSlug,
  sectionSlug,
  splitLayers,
  visibleLayers,
  type ShifaEntry,
  type ShifaSafetyNote,
  type ShifaSection,
  type TopicPage,
} from "@/lib/shifa/model";
import { shifaStrings } from "@/lib/i18n/modules/shifa";

vi.mock("server-only", () => ({}));
vi.mock("@/components/shell/ReadingPage", () => ({
  ReadingPage: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <main>{children}</main>
    </div>
  ),
}));
const topicPageMock = vi.fn();
const topicsMock = vi.fn();
vi.mock("@/lib/data/shifa", () => ({
  topicPage: (slug: string) => topicPageMock(slug),
  publishedTopics: (...a: unknown[]) => topicsMock(...a),
  relatedShifa: async () => [],
}));

afterEach(() => {
  cleanup();
  topicPageMock.mockReset();
  topicsMock.mockReset();
});

const ID = "11111111-1111-4111-8111-111111111111";
const claimBlock = (statement: string, evidence: "quran" | "hadith" | "scholar") => ({
  id: ID,
  statement,
  evidence,
  claim_references: [{ kind: evidence === "quran" ? ("quran" as const) : evidence === "hadith" ? ("hadith" as const) : ("tafsir" as const), quran_surah: evidence === "quran" ? 3 : null, quran_ayah_from: evidence === "quran" ? 134 : null, quran_ayah_to: null, locator: null, hadith_entries: evidence === "hadith" ? { collection_id: "bukhari", canonical_number: "1" } : null, hadith_gradings: evidence === "hadith" ? { grader: "Fixture grader", grade_label: "Sahih" } : null, sources: null }],
});

// Test fixtures, not content: every statement is a labelled placeholder.
const ENTRY: ShifaEntry = {
  id: "e1",
  slug: "fixture-entry",
  kind: "remedy",
  title_en: "Fixture entry",
  title_ar: null,
  position: 1,
  version: 4,
  last_reviewed_at: "2026-10-31",
  shifa_layers: [
    { id: "l-d", evidence_category: "D", position: 1, finding: "[fixture] D statement", publication: null, citation: null, study_type: null, population: null, limitations: null, url: null, states_health_effect: false, is_traditional: true, is_hypothesis: false, language: "en", evidence_claims: null },
    { id: "l-c", evidence_category: "C", position: 1, finding: "[fixture] C finding", publication: "Fixture Journal", citation: "Fixture et al., 2020", study_type: "randomised_trial", population: "[fixture] adults", limitations: "[fixture] small, one species", url: null, states_health_effect: true, is_traditional: false, is_hypothesis: false, language: "en", evidence_claims: null },
    { id: "l-b", evidence_category: "B", position: 1, finding: null, publication: null, citation: null, study_type: null, population: null, limitations: null, url: null, states_health_effect: false, is_traditional: false, is_hypothesis: false, language: "en", evidence_claims: claimBlock("[fixture] B claim", "hadith") },
    { id: "l-a", evidence_category: "A", position: 1, finding: null, publication: null, citation: null, study_type: null, population: null, limitations: null, url: null, states_health_effect: false, is_traditional: false, is_hypothesis: false, language: "en", evidence_claims: claimBlock("[fixture] A claim", "quran") },
  ],
  shifa_scholarly_notes: [{ id: "n1", scholar_name: "Fixture Scholar", work_title: "Fixture Work", locator: "vol. 2", position: 1, evidence_claims: claimBlock("[fixture] scholarly claim", "scholar") }],
};
const EMPTY_ENTRY: ShifaEntry = { ...ENTRY, id: "e2", shifa_layers: [], shifa_scholarly_notes: [] };
const NOTE = (kind: ShifaSafetyNote["kind"], entry_id: string | null = null): ShifaSafetyNote => ({ id: `n-${kind}-${entry_id}`, entry_id, kind, body_en: `[fixture] ${kind} note`, body_ar: null, position: 1 });

const en = shifaStrings("en");

describe("sections, topics and references", () => {
  test("four sections with stable slugs", () => {
    expect(SECTIONS.map((s) => s.slug)).toEqual(["quranic-healing", "ruqyah", "prophetic-remedies", "wellbeing"]);
    for (const s of SECTIONS) expect(sectionFromSlug(s.slug)).toBe(s.key);
    expect(sectionFromSlug("nope")).toBeUndefined();
    expect(sectionSlug("prophetic_remedies")).toBe("prophetic-remedies");
  });
  test("the planned topics are the 14 starting titles, each in a section, and carry no text beyond a title", () => {
    expect(PLANNED_TOPICS).toHaveLength(14);
    expect(PLANNED_TOPICS.map((t) => t.title_en)).toEqual(expect.arrayContaining(["Honey", "Black seed (Nigella sativa)", "Dates", "Olive oil", "Water and zamzam", "Cupping (hijama)", "Sleep and rest", "Moderation in eating", "Cleanliness and hygiene", "Grief and distress", "Anxiety and worry", "Patience in illness"]));
    for (const t of PLANNED_TOPICS) {
      expect(Object.keys(t).sort()).toEqual(["icon_key", "section", "slug", "title_ar", "title_en"]);
      expect(textProblems(t.title_en)).toEqual([]);
    }
    expect(plannedTopic("honey")?.section).toBe("prophetic_remedies");
    expect(plannedIn("wellbeing").map((t) => t.slug)).toEqual(["grief-and-distress", "anxiety-and-worry", "patience-in-illness"]);
  });
  test("the starting references are exactly the four given, shown as references and never quoted", () => {
    expect(REFERENCE_POINTS.map((r) => r.label)).toEqual(["Quran 17:82", "Quran 16:69", "Sahih al-Bukhari 5736", "Sahih al-Bukhari 5688"]);
    render(<ReferencePoints s={en} titles={{ "authentic-ruqyah": "Authentic ruqyah", "black-seed": "Black seed (Nigella sativa)" }} />);
    const box = screen.getByTestId("reference-points");
    expect(within(box).getAllByText(en.references.licencePending)).toHaveLength(4);
    expect(within(box).getAllByText(en.references.numbering)).toHaveLength(4);
    expect(box.textContent).toContain("Planned for: Authentic ruqyah");
  });
});

describe("fixed safety framing", () => {
  test.each(SECTIONS.map((s) => [s.key]))("every section renders the educational / not medical advice framing: %s", (section) => {
    render(<SafetyFraming s={en} section={section as ShifaSection} locale="en" />);
    const box = screen.getByTestId("safety-framing");
    expect(box).toHaveTextContent("Educational, not medical advice");
    expect(box).toHaveTextContent(/do not delay or replace professional care/i);
    expect(box).toHaveTextContent(/clinician or pharmacist/i);
    expect(box).toHaveTextContent(/pregnancy.*childhood.*chronic illness.*medicines/i);
    expect(box).toHaveTextContent(/emergency/i);
    expect(box).toHaveTextContent(/complementary to professional care, never as a replacement/i);
    expect(box).toHaveTextContent(/nothing here is generated by AI/i);
  });
  test("the hub (no section) carries it too", () => {
    render(<SafetyFraming s={en} locale="en" />);
    expect(screen.getByTestId("safety-framing")).toBeInTheDocument();
    expect(screen.queryByTestId("wellbeing-notice")).toBeNull();
  });
  test("the wellbeing section adds the professional mental-health recommendation and a crisis note; others do not", () => {
    expect(needsMentalHealthNotice("wellbeing")).toBe(true);
    for (const s of ["quranic_healing", "ruqyah", "prophetic_remedies"] as const) expect(needsMentalHealthNotice(s)).toBe(false);
    render(<SafetyFraming s={en} section="wellbeing" locale="en" />);
    expect(screen.getByTestId("wellbeing-notice")).toHaveTextContent(/mental-health professional/i);
    expect(screen.getByTestId("wellbeing-notice")).toHaveTextContent(/alongside that care.*do not replace it/i);
    expect(screen.getByTestId("crisis-note")).toHaveTextContent(/harming yourself/i);
    cleanup();
    render(<SafetyFraming s={en} section="prophetic_remedies" locale="en" />);
    expect(screen.queryByTestId("wellbeing-notice")).toBeNull();
  });
  test("ruqyah says what the section is and is not: no checker, no attribution to jinn, evil eye or magic", () => {
    render(<SafetyFraming s={en} section="ruqyah" locale="en" />);
    expect(screen.getByTestId("ruqyah-notice")).toHaveTextContent(/no checker, quiz or tool/i);
    expect(screen.getByTestId("ruqyah-notice")).toHaveTextContent(/jinn, the evil eye or magic/i);
  });
  test("reviewed safety notes of the topic are listed under their kind; an entry's own notes stay with the entry", () => {
    render(<SafetyFraming s={en} section="prophetic_remedies" notes={[NOTE("general"), NOTE("interactions"), NOTE("pregnancy_children", "e1")]} locale="en" />);
    const notes = screen.getByTestId("reviewed-notes");
    expect(notes).toHaveTextContent("[fixture] general note");
    expect(notes).toHaveTextContent("[fixture] interactions note");
    expect(notes).not.toHaveTextContent("pregnancy_children note");
    cleanup();
    render(<ReviewedNotes s={en} notes={[]} locale="en" />);
    expect(screen.queryByTestId("reviewed-notes")).toBeNull();
  });
  test("Arabic and Urdu framing render their own text and keep every framing element", () => {
    for (const locale of ["ar", "ur"] as const) {
      const s = shifaStrings(locale);
      expect(s.safety.title).not.toBe(en.safety.title);
      expect(s.safety.body).not.toBe(en.safety.body);
      expect(s.wellbeing.title).not.toBe(en.wellbeing.title);
      render(<SafetyFraming s={s} section="wellbeing" locale={locale} />);
      expect(screen.getByTestId("safety-framing")).toHaveTextContent(s.safety.title);
      expect(screen.getByTestId("crisis-note")).toHaveTextContent(s.wellbeing.crisis);
      cleanup();
    }
  });
});

describe("evidence layers are kept apart", () => {
  test("A, B, scholarly, C and D each render in their own labelled container, in that order, and never merge", () => {
    render(<EntryView entry={ENTRY} section="prophetic_remedies" s={en} locale="en" index={1} />);
    const entry = screen.getByTestId("shifa-entry");
    const layers = Array.from(entry.querySelectorAll<HTMLElement>("[data-layer]"));
    expect(layers.map((l) => l.dataset.layer)).toEqual(["A", "B", "S", "C", "D"]);
    const by = (k: string) => layers.find((l) => l.dataset.layer === k)!;
    expect(within(by("A")).getByText("[fixture] A claim")).toBeInTheDocument();
    expect(within(by("B")).getByText("[fixture] B claim")).toBeInTheDocument();
    expect(within(by("S")).getByText("[fixture] scholarly claim")).toBeInTheDocument();
    expect(within(by("S")).getByText("Fixture Scholar")).toBeInTheDocument();
    expect(within(by("C")).getByText("[fixture] C finding")).toBeInTheDocument();
    expect(within(by("D")).getByText("[fixture] D statement")).toBeInTheDocument();
    // Nothing leaks across: a layer's text appears in its own container only.
    for (const [k, text] of [["A", "[fixture] A claim"], ["B", "[fixture] B claim"], ["C", "[fixture] C finding"], ["D", "[fixture] D statement"]] as const)
      for (const other of layers) if (other.dataset.layer !== k) expect(other).not.toHaveTextContent(text);
    // Every layer names itself in a heading.
    expect(within(by("A")).getByRole("heading", { level: 4 })).toHaveTextContent("What the Quran says");
    expect(within(by("B")).getByRole("heading", { level: 4 })).toHaveTextContent("What authentic hadith record");
    expect(within(by("C")).getByRole("heading", { level: 4 })).toHaveTextContent("What modern research reports");
  });
  test("A and B are shown as records, never as treatment, cure or guaranteed benefit, and carry no research fields", () => {
    render(<EntryView entry={ENTRY} section="prophetic_remedies" s={en} locale="en" index={1} />);
    const a = screen.getByTestId("shifa-entry").querySelector<HTMLElement>('[data-layer="A"]')!;
    expect(a).toHaveTextContent(/not presented as a treatment, cure or guaranteed benefit/i);
    expect(within(a).queryByText(en.research.limitations)).toBeNull();
    expect(within(a).queryByText(en.research.publication)).toBeNull();
    expect(a).toHaveTextContent("Q 3:134");
  });
  test("C names its publication, study type and population, states its limits, and is not a recommendation", () => {
    render(<EntryView entry={ENTRY} section="prophetic_remedies" s={en} locale="en" index={1} />);
    const c = screen.getByTestId("research-item");
    expect(c).toHaveTextContent("Fixture Journal");
    expect(c).toHaveTextContent("Randomised trial");
    expect(c).toHaveTextContent("[fixture] adults");
    expect(c).toHaveTextContent(en.research.limitations);
    expect(c).toHaveTextContent("[fixture] small, one species");
    expect(c).toHaveTextContent("Fixture et al., 2020");
    expect(c).toHaveTextContent(en.research.notRecommendation);
    expect(c).toHaveTextContent(en.flags.healthEffect);
  });
  test("D is always in a separate container, flagged not established, with its traditional / hypothesis flag", () => {
    render(<EntryView entry={ENTRY} section="prophetic_remedies" s={en} locale="en" index={1} />);
    const d = screen.getByTestId("shifa-entry").querySelector<HTMLElement>('[data-layer="D"]')!;
    expect(d.dataset.established).toBe("false");
    expect(d.className).toContain("sh-apart");
    expect(within(d).getByRole("heading", { level: 4 })).toHaveTextContent(/Traditional use or hypothesis — not established/);
    expect(within(d).getByText(en.flags.traditional)).toBeInTheDocument();
    expect(within(d).queryByText(en.flags.hypothesis)).toBeNull();
  });
  test("a remedy with no published layers still renders all five containers, each empty (never a bare remedy)", () => {
    render(<EntryView entry={EMPTY_ENTRY} section="prophetic_remedies" s={en} locale="en" index={1} />);
    const entry = screen.getByTestId("shifa-entry");
    expect(Array.from(entry.querySelectorAll<HTMLElement>("[data-layer]")).map((l) => l.dataset.layer)).toEqual(["A", "B", "S", "C", "D"]);
    for (const k of ["A", "B", "C", "D"]) expect(screen.getByTestId(`layer-${k}-empty`)).toHaveTextContent(en.layerEmpty);
  });
  test("a layer row without its approved claim is not shown", () => {
    const parts = splitLayers({ shifa_layers: [{ ...ENTRY.shifa_layers[3]!, evidence_claims: null }], shifa_scholarly_notes: [] });
    expect(parts.A).toHaveLength(0);
  });
  test("ruqyah shows only the Quran, authentic hadith and named scholars: no research or hypothesis container", () => {
    expect(visibleLayers("ruqyah")).toEqual(["A", "B", "S"]);
    render(<EntryView entry={ENTRY} section="ruqyah" s={en} locale="en" index={1} />);
    const entry = screen.getByTestId("shifa-entry");
    expect(Array.from(entry.querySelectorAll<HTMLElement>("[data-layer]")).map((l) => l.dataset.layer)).toEqual(["A", "B", "S"]);
    expect(entry).not.toHaveTextContent("[fixture] C finding");
  });
  test("the legend lists the same five containers", () => {
    render(<LayerLegend s={en} />);
    expect(within(screen.getByTestId("layer-legend")).getAllByRole("listitem")).toHaveLength(5);
  });
  test("an entry's own safety notes appear with it", () => {
    render(<EntryView entry={ENTRY} section="prophetic_remedies" s={en} locale="en" index={1} notes={[NOTE("pregnancy_children", "e1"), NOTE("general")]} />);
    const notes = screen.getByTestId("shifa-entry").querySelector("[data-testid='reviewed-notes']")!;
    expect(notes).toHaveTextContent("[fixture] pregnancy_children note");
    expect(notes).not.toHaveTextContent("[fixture] general note");
  });
});

describe("recitation", () => {
  test("only the not-yet-available state exists: no audio element, no text-to-speech, no AI recitation", () => {
    const { container } = render(<RecitationState s={en} />);
    expect(container.querySelector("audio")).toBeNull();
    expect(screen.getByTestId("recitation-unavailable")).toHaveTextContent("Recitation audio is not available yet");
    expect(screen.getByTestId("recitation-unavailable")).toHaveTextContent(/approved, licensed recording matched to its riwayah/);
    expect(screen.getByTestId("recitation-unavailable")).toHaveTextContent(/does not use text-to-speech or AI-generated recitation/);
  });
  test("it sits with supplications and the Quran-based sections, not with remedies", () => {
    render(<EntryView entry={{ ...ENTRY, kind: "supplication" }} section="quranic_healing" s={en} locale="en" index={1} />);
    expect(screen.getByTestId("recitation-unavailable")).toBeInTheDocument();
    cleanup();
    render(<EntryView entry={{ ...ENTRY, kind: "remedy" }} section="prophetic_remedies" s={en} locale="en" index={1} />);
    expect(screen.queryByTestId("recitation-unavailable")).toBeNull();
  });
});

describe("the topic page", () => {
  async function renderTopic(section: string, slug: string, page: TopicPage | null | undefined) {
    topicPageMock.mockResolvedValue(page);
    const { default: Page } = await import("@/app/[locale]/shifa/[section]/[slug]/page");
    render(await Page({ params: Promise.resolve({ locale: "en", section, slug }) }));
  }
  const TOPIC = (section: ShifaSection, slug: string) => ({ id: "t1", slug, section, title_en: "Fixture topic", title_ar: null, icon_key: "leaf" as const, position: 1, version: 1 });

  test("every topic page renders the safety framing: published with entries, published and empty, planned, and not connected", async () => {
    await renderTopic("prophetic-remedies", "fx", { topic: TOPIC("prophetic_remedies", "fx"), entries: [ENTRY], safety: [NOTE("general"), NOTE("interactions")] });
    expect(screen.getByTestId("safety-framing")).toBeInTheDocument();
    expect(screen.getAllByTestId("shifa-entry")).toHaveLength(1);
    cleanup();
    await renderTopic("prophetic-remedies", "fx", { topic: TOPIC("prophetic_remedies", "fx"), entries: [], safety: [] });
    expect(screen.getByTestId("safety-framing")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toHaveTextContent(en.topicEmptyTitle);
    cleanup();
    await renderTopic("prophetic-remedies", "honey", undefined);
    expect(screen.getByTestId("safety-framing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Honey");
    expect(screen.queryByTestId("shifa-entry")).toBeNull();
    cleanup();
    await renderTopic("prophetic-remedies", "honey", null);
    expect(screen.getByTestId("safety-framing")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toHaveTextContent(en.emptyNotConnected);
  });
  test("a wellbeing topic carries the mental-health recommendation and the crisis note, even before anything is published", async () => {
    await renderTopic("wellbeing", "grief-and-distress", undefined);
    expect(screen.getByTestId("wellbeing-notice")).toBeInTheDocument();
    expect(screen.getByTestId("crisis-note")).toBeInTheDocument();
  });
  test("no remedy page renders without its layers separated", async () => {
    await renderTopic("prophetic-remedies", "fx", { topic: TOPIC("prophetic_remedies", "fx"), entries: [ENTRY, EMPTY_ENTRY], safety: [] });
    for (const entry of screen.getAllByTestId("shifa-entry"))
      expect(Array.from(entry.querySelectorAll<HTMLElement>("[data-layer]")).map((l) => l.dataset.layer)).toEqual(["A", "B", "S", "C", "D"]);
  });
  test("the section in the URL must match the topic's section", async () => {
    topicPageMock.mockResolvedValue(undefined);
    const { default: Page } = await import("@/app/[locale]/shifa/[section]/[slug]/page");
    await expect(Page({ params: Promise.resolve({ locale: "en", section: "wellbeing", slug: "honey" }) })).rejects.toThrow();
    await expect(Page({ params: Promise.resolve({ locale: "en", section: "no-such-section", slug: "honey" }) })).rejects.toThrow();
    await expect(Page({ params: Promise.resolve({ locale: "en", section: "wellbeing", slug: "no-such-topic" }) })).rejects.toThrow();
  });
  test("the hub and a section list render the framing and the designed empty state without a database", async () => {
    topicsMock.mockResolvedValue(null);
    const { default: Hub } = await import("@/app/[locale]/shifa/page");
    render(await Hub({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("safety-framing")).toBeInTheDocument();
    expect(within(screen.getByTestId("shifa-sections")).getAllByRole("link")).toHaveLength(4);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(en.emptyNotConnected);
    expect(screen.getByTestId("reference-points")).toBeInTheDocument();
    cleanup();
    const { default: Section } = await import("@/app/[locale]/shifa/[section]/page");
    render(await Section({ params: Promise.resolve({ locale: "en", section: "wellbeing" }) }));
    expect(screen.getByTestId("wellbeing-notice")).toBeInTheDocument();
    expect(within(screen.getByTestId("planned-topics")).getAllByRole("link")).toHaveLength(3);
  });
});

describe("interface strings", () => {
  test("Arabic and Urdu mirror the English shape for what they translate, and nothing in the module states a dosage", () => {
    const walk = (o: unknown, path = ""): string[] => (typeof o === "string" ? [path] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => walk(v, `${path}.${k}`)) : []);
    const keys = walk(en);
    for (const locale of ["ar", "ur"] as const) expect(walk(shifaStrings(locale)).sort()).toEqual(keys.sort());
    for (const locale of ["en", "ar", "ur"] as const) {
      const s = JSON.stringify(shifaStrings(locale));
      expect(textProblems(s, { dosageOnly: true })).toEqual([]);
    }
    // Draft translations differ from English where they exist.
    expect(shifaStrings("ar").sections.wellbeing.title).toBe("العافية الروحية");
    expect(shifaStrings("ur").sections.wellbeing.title).toBe("روحانی عافیت");
  });
});

describe("the editor", () => {
  test("text lint refuses dosages, frequencies, instructions and promised cures, and accepts plain reporting", () => {
    expect(textProblems("a trial used 5 g of a preparation")).toContain("dosage");
    expect(textProblems("2 tablespoons were given")).toContain("dosage");
    expect(textProblems("taken twice a day")).toContain("dosage");
    expect(textProblems("Drink it first thing")).toContain("instruction");
    expect(textProblems("a guaranteed cure")).toContain("instruction");
    expect(textProblems("40 participants completed the study; the effect was small")).toEqual([]);
    // Safety notes may speak in the imperative, but still give no amount.
    expect(textProblems("Ask your pharmacist before use.", { dosageOnly: true })).toEqual([]);
    expect(textProblems("Take advice from a clinician.", { dosageOnly: true })).toEqual([]);
    expect(textProblems("Use 3 teaspoons daily", { dosageOnly: true })).toContain("dosage");
  });
  const ENTRY_ID = ID;
  test("A and B layers keep only their claim; flags and text are stripped", () => {
    const r = buildRow("shifa_layer", { entry_id: ENTRY_ID, evidence_category: "A", claim_id: ID, finding: "free text", states_health_effect: true, is_hypothesis: true });
    expect(r.ok && r.row).toMatchObject({ claim_id: ID, finding: null, states_health_effect: false, is_hypothesis: false, is_traditional: false });
    expect(buildRow("shifa_layer", { entry_id: ENTRY_ID, evidence_category: "B" })).toMatchObject({ ok: false });
  });
  const C = { entry_id: ENTRY_ID, evidence_category: "C", finding: "[fixture] result", publication: "Fixture Journal", citation: "Fixture 2020", study_type: "cohort", population: "[fixture] adults", limitations: "[fixture] small study, conflicts declared" };
  test("C needs the finding, publication, citation, study type, population and limits; it cannot carry a claim or D flags", () => {
    expect(buildRow("shifa_layer", C)).toMatchObject({ ok: true });
    for (const k of ["finding", "publication", "citation", "study_type", "population"]) expect(buildRow("shifa_layer", { ...C, [k]: "" })).toMatchObject({ ok: false });
    expect(buildRow("shifa_layer", { ...C, limitations: "short" })).toMatchObject({ ok: false });
    const r = buildRow("shifa_layer", { ...C, claim_id: ID, is_hypothesis: true });
    expect(r.ok && r.row).toMatchObject({ claim_id: null, is_hypothesis: false });
    expect(buildRow("shifa_layer", { ...C, limitations: "[fixture] a 5 g dose was studied" })).toMatchObject({ ok: false });
  });
  test("D needs a traditional-use or hypothesis flag and drops research fields", () => {
    const D = { entry_id: ENTRY_ID, evidence_category: "D", finding: "[fixture] statement" };
    expect(buildRow("shifa_layer", D)).toMatchObject({ ok: false });
    const r = buildRow("shifa_layer", { ...D, is_hypothesis: true, states_health_effect: true, publication: "x" });
    expect(r.ok && r.row).toMatchObject({ is_hypothesis: true, states_health_effect: false, publication: null });
  });
  test("topics, entries, notes and links start as drafts; a title with an instruction is refused", () => {
    expect(buildRow("shifa_topic", { slug: "fixture", section: "wellbeing", title_en: "Fixture topic" })).toMatchObject({ ok: true, table: "shifa_topics", row: { status: "draft" } });
    expect(buildRow("shifa_entry", { topic_id: ID, slug: "fixture", kind: "remedy", title_en: "Take it every morning" })).toMatchObject({ ok: false });
    expect(buildRow("shifa_safety_note", { topic_id: ID, kind: "general", body_en: "Ask a clinician or pharmacist first." })).toMatchObject({ ok: true, row: { status: "draft" } });
    expect(buildRow("shifa_safety_note", { topic_id: ID, kind: "general", body_en: "Use 250 mg a day." })).toMatchObject({ ok: false });
    const link = buildRow("shifa_link", { topic_id: ID, target_kind: "person", target_id: ID });
    expect(link.ok && link.row).toMatchObject({ person_id: ID, guidance_topic_id: null, event_id: null, story_id: null, food_id: null });
    expect(buildRow("shifa_scholarly_note", { entry_id: ID, claim_id: ID, scholar_name: "Fixture Scholar", work_title: "Fixture Work" })).toMatchObject({ ok: true, table: "shifa_scholarly_notes" });
    expect(buildRow("shifa_scholarly_note", { entry_id: ID, claim_id: ID, scholar_name: "", work_title: "" })).toMatchObject({ ok: false });
  });
  test("required review pathways mirror the database", () => {
    expect(requiredPathways({ type: "shifa_topic", section: "ruqyah" })).toEqual(["religious"]);
    expect(requiredPathways({ type: "shifa_topic", section: "wellbeing" })).toEqual(["religious", "clinical"]);
    expect(requiredPathways({ type: "shifa_safety_note", kind: "crisis" })).toEqual(["clinical"]);
    expect(requiredPathways({ type: "shifa_safety_note", kind: "ruling_referral" })).toEqual(["religious"]);
    expect(requiredPathways({ type: "shifa_link" })).toEqual(["religious"]);
    expect(requiredPathways({ type: "shifa_entry", section: "ruqyah", kind: "supplication", categories: ["B"], scholarlyNotes: 0 })).toEqual(["religious"]);
    expect(requiredPathways({ type: "shifa_entry", section: "quranic_healing", kind: "practice", categories: ["A", "C"], scholarlyNotes: 0 })).toEqual(["religious", "clinical"]);
    expect(requiredPathways({ type: "shifa_entry", section: "prophetic_remedies", kind: "remedy", categories: ["D"], scholarlyNotes: 0 })).toEqual(["clinical"]);
    expect(requiredPathways({ type: "shifa_entry", section: "prophetic_remedies", kind: "lifestyle", categories: ["B"], scholarlyNotes: 0 })).toEqual(["religious", "clinical"]);
    expect(requiredPathways({ type: "shifa_entry", section: "quranic_healing", kind: "lesson", categories: [], scholarlyNotes: 0 })).toEqual(["religious"]);
  });
});
