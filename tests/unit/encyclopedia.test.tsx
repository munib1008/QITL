import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildRow, publishBlockers } from "@/lib/encyclopedia/editor";
import { familyEdges, relatedEvents, storyDetail, storyListItem, subjectItem, type StoryRow } from "@/lib/encyclopedia/mapping";
import {
  allVerses,
  filterOptions,
  filterStories,
  gradingMeetsRule,
  groupPeople,
  identificationStatus,
  licenceAllows,
  nameLines,
  parseFilters,
  personGroup,
  pick,
  relationKey,
  verseHref,
  type LicenceRow,
  type PersonListItem,
  type StoryListItem,
} from "@/lib/encyclopedia/model";
import { fixtureCommunities, fixturePeople, fixtureStories, fixtureStory } from "@/lib/encyclopedia/fixtures";
import { encyclopediaStrings } from "@/lib/i18n/modules/encyclopedia";
import { hadithStoryStrings } from "@/lib/i18n/modules/hadithStories";
import { IdentificationBlock, NarrationCard, NotEstablished, PersonCard, QuranSection, StoryCard } from "@/components/encyclopedia/Encyclopedia";
import { isKind, SEARCH_KINDS } from "@/lib/search";

vi.mock("server-only", () => ({}));
vi.mock("@/components/drafts/AiDraftStory", () => ({ AiDraftStory: () => null }));
vi.mock("@/components/drafts/AiDraftIndex", () => ({ AiDraftIndex: () => null }));
vi.mock("@/components/shell/ReadingPage", () => ({
  ReadingPage: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <main>{children}</main>
    </div>
  ),
}));
const storiesMock = vi.fn();
const storyMock = vi.fn();
const countsMock = vi.fn();
vi.mock("@/lib/data/hadithStories", () => ({
  publishedStories: (...a: unknown[]) => storiesMock(...a),
  storyBySlug: (...a: unknown[]) => storyMock(...a),
  storyCounts: (...a: unknown[]) => countsMock(...a),
}));
const peopleMock = vi.fn();
const personMock = vi.fn();
const communitiesMock = vi.fn();
const communityMock = vi.fn();
vi.mock("@/lib/data/encyclopedia", () => ({
  publishedPeople: (...a: unknown[]) => peopleMock(...a),
  personBySlug: (...a: unknown[]) => personMock(...a),
  publishedCommunities: (...a: unknown[]) => communitiesMock(...a),
  communityBySlug: (...a: unknown[]) => communityMock(...a),
  peopleCounts: (...a: unknown[]) => countsMock(...a),
  communityCounts: (...a: unknown[]) => countsMock(...a),
}));

afterEach(() => {
  cleanup();
  for (const m of [storiesMock, storyMock, countsMock, peopleMock, personMock, communitiesMock, communityMock]) m.mockReset();
});

const en = hadithStoryStrings("en");
const enc = encyclopediaStrings("en");
const ID = "11111111-1111-4111-8111-111111111111";

const baseRow = (over: Partial<StoryRow> = {}): StoryRow => ({
  slug: "fixture-s",
  title_en: "Fixture story",
  title_ar: null,
  title_ur: null,
  narrator_en: "Fixture narrator",
  narrator_ar: null,
  narrator_ur: null,
  kind: "independent_lesson",
  summary_en: "Fixture summary",
  summary_ar: null,
  summary_ur: null,
  context_en: null,
  context_ar: null,
  context_ur: null,
  version: 3,
  hadith_story_entries: [
    {
      id: "e1",
      is_primary: true,
      position: 1,
      selected: null,
      hadith_entries: { id: "h1", collection_id: "bukhari", canonical_number: "1", numbering_system: "fixture", arabic: "[fixture arabic]", source_versions: { source_id: "s1" }, hadith_gradings: [], hadith_translations: [{ translator: "Fixture", language: "en", text: "[fixture translation]", source_id: "s2" }] },
    },
    {
      id: "e2",
      is_primary: false,
      variant_note: "the longer wording",
      position: 2,
      selected: { grader: "Fixture grader", grade: "sahih", grade_label: "Sahih", citation: "fixture" },
      hadith_entries: { id: "h2", collection_id: "tirmidhi", canonical_number: "5", numbering_system: "fixture", arabic: "[fixture arabic 2]", source_versions: { source_id: "s1" }, hadith_gradings: [] },
    },
  ],
  hadith_story_links: [
    { target_kind: "person", people: { slug: "p1", name_en: "Person", name_ar: null } },
    { target_kind: "person", people: null },
    { target_kind: "theme", guidance_topics: { slug: "t1", title_en: "Theme", title_ar: null } },
    { target_kind: "event", historical_events: { slug: "ev1", title: "Event", title_ar: null } },
  ],
  hadith_story_claims: [
    { evidence_claims: { id: "c1", statement: "Fixture claim", claim_references: [{ kind: "quran", quran_surah: 12, quran_ayah_from: 4, quran_ayah_to: 5 }] } },
    { evidence_claims: { id: "c2", statement: "A claim without a verse", claim_references: [{ kind: "hadith", quran_surah: null, quran_ayah_from: null, quran_ayah_to: null }] } },
    { evidence_claims: null },
  ],
  hadith_story_lessons: [
    { kind: "modern_application", body_en: "Fixture application", body_ar: null, body_ur: null, position: 1 },
    { kind: "lesson", body_en: "Fixture lesson", body_ar: null, body_ur: null, position: 1 },
  ],
  ...over,
});

describe("pure model", () => {
  test("a page in Arabic or Urdu falls back to English and says so; nothing is machine-translated", () => {
    const l = { en: "English", ar: "عربي", ur: null };
    expect(pick(l, "ar")).toEqual({ text: "عربي", lang: "ar", fallback: false });
    expect(pick(l, "ur")).toEqual({ text: "English", lang: "en", fallback: true });
    expect(pick({ en: null, ar: null, ur: null }, "en").text).toBeNull();
    expect(nameLines("Test", "اختبار", "ar")).toMatchObject({ main: "اختبار", alt: "Test" });
    expect(nameLines("Test", null, "ar")).toMatchObject({ main: "Test", alt: null });
  });

  test("a person's group comes from the data: a prophet only by kind, nobody else is ever filed as one", () => {
    expect(personGroup({ kind: "prophet", encyclopedia_kind: null })).toBe("prophet");
    expect(personGroup({ kind: "prophet", encyclopedia_kind: "prophet" })).toBe("prophet");
    expect(personGroup({ kind: "companion", encyclopedia_kind: "prophet" })).toBe("individual");
    expect(personGroup({ kind: "companion", encyclopedia_kind: null })).toBe("individual");
    expect(personGroup({ kind: "other", encyclopedia_kind: "ruler" })).toBe("ruler");
    expect(personGroup({ kind: "other", encyclopedia_kind: "family_member" })).toBe("family_member");
    expect(personGroup({ kind: "other", encyclopedia_kind: "unnamed" })).toBe("unnamed");
    expect(personGroup({ kind: "scholar", encyclopedia_kind: "king" })).toBe("individual");
    const list: PersonListItem[] = fixturePeople();
    const groups = groupPeople(list);
    expect(groups.map((g) => g.group)).toEqual(["prophet", "individual", "ruler", "unnamed"]);
    expect(groups.find((g) => g.group === "prophet")!.items.every((p) => p.kind === "prophet")).toBe(true);
  });

  test("identification: named, later tradition, or not established; never guessed", () => {
    expect(identificationStatus(null)).toBe("unknown");
    expect(identificationStatus({ name_source: "quran" })).toBe("named");
    expect(identificationStatus({ name_source: "later_tradition" })).toBe("later");
    expect(subjectItem(null)).toBeNull();
    expect(subjectItem({ slug: "x", title: "x", track: "people", name_source: "quran", status: "draft" })).toBeNull();
    const s = subjectItem({ slug: "x", title: "x", track: "people", name_source: "later_tradition", status: "published", event_identifications: [{ kind: "name", subject: "s", view: "v", standing: "disputed", status: "draft" }, { kind: "name", subject: "s", view: "w", standing: "widely_held", status: "published" }], event_verse_refs: [{ surah: 12, ayah_from: 4, ayah_to: 5 }] });
    expect(s!.identifications).toEqual([{ kind: "name", subject: "s", view: "w", standing: "widely_held" }]);
    expect(s!.verses).toEqual([{ surah: 12, from: 4, to: 5 }]);
  });

  test("verses are deep links to the reader, each range once, in order", () => {
    expect(verseHref({ surah: 12, from: 4, to: 4 })).toBe("/quran/12#ayah-4");
    expect(verseHref({ surah: 12, from: 4, to: 5 })).toBe("/quran/12#ayah-4-5");
    const subject = { slug: "x", title: "x", track: "people", name_source: "quran" as const, identifications: [], verses: [{ surah: 12, from: 4, to: 5 }, { surah: 2, from: 30, to: 30 }] };
    const v = allVerses([{ claimId: "c", statement: null, evidence: null, verses: [{ surah: 12, from: 4, to: 5 }] }], subject);
    expect(v.map((x) => `${x.surah}:${x.from}-${x.to}`)).toEqual(["2:30-30", "12:4-5"]);
  });

  test("filters: theme, narrator, person, community and kind narrow the list; bad input is dropped", () => {
    const list = fixtureStories();
    expect(filterStories(list, { kind: "independent_lesson" }).map((s) => s.slug)).toEqual(["fixture-story-b"]);
    expect(filterStories(list, { person: "fixture-person-a" }).map((s) => s.slug)).toEqual(["fixture-story-a"]);
    expect(filterStories(list, { community: "fixture-community-a" })).toHaveLength(1);
    expect(filterStories(list, { theme: "fixture-theme" })).toHaveLength(2);
    expect(filterStories(list, { narrator: "another test narrator" }).map((s) => s.slug)).toEqual(["fixture-story-b"]);
    expect(filterStories(list, { theme: "fixture-theme", kind: "separate_episode" })).toEqual([]);
    expect(parseFilters({ theme: "Bad Slug!", kind: "nonsense", person: ["fixture-person-a", "x"], narrator: " X " })).toEqual({ theme: undefined, kind: undefined, person: "fixture-person-a", community: undefined, narrator: "X" });
    const o = filterOptions(list);
    expect(o.kinds).toEqual(["clarifies_quranic_story", "independent_lesson"]);
    expect(o.themes).toHaveLength(1);
    expect(o.narrators).toEqual(["Another test narrator", "Test narrator"]);
  });

  test("the licence gate mirrors content_permission_allowed", () => {
    const rows: LicenceRow[] = [
      { source_id: "a", asset_type: "text", scope: "all", status: "APPROVED", attribution_text: null },
      { source_id: "b", asset_type: "text", scope: "all", status: "CONDITIONAL", attribution_text: null },
      { source_id: "c", asset_type: "text", scope: "all", status: "CONDITIONAL", attribution_text: "Credit line" },
      { source_id: "d", asset_type: "text", scope: "all", status: "PERMISSION_REQUIRED", attribution_text: null },
      { source_id: "e", asset_type: "translation", scope: "all", status: "APPROVED", attribution_text: null },
    ];
    expect(licenceAllows(rows, "a", "text").allowed).toBe(true);
    expect(licenceAllows(rows, "b", "text").allowed).toBe(false);
    expect(licenceAllows(rows, "c", "text")).toEqual({ allowed: true, attribution: "Credit line" });
    expect(licenceAllows(rows, "d", "text").allowed).toBe(false);
    expect(licenceAllows(rows, "e", "text").allowed).toBe(false);
    expect(licenceAllows(rows, "e", "translation").allowed).toBe(true);
    expect(licenceAllows(rows, null, "text").allowed).toBe(false);
  });

  test("the grading rule: Bukhari and Muslim; Tirmidhi and Ibn Majah only with an individual sahih grading by a named grader", () => {
    expect(gradingMeetsRule("bukhari", null)).toBe(true);
    expect(gradingMeetsRule("muslim", null)).toBe(true);
    expect(gradingMeetsRule("tirmidhi", null)).toBe(false);
    expect(gradingMeetsRule("tirmidhi", { grade: "hasan", grader: "Fixture" })).toBe(false);
    expect(gradingMeetsRule("tirmidhi", { grade: "sahih", grader: "" })).toBe(false);
    expect(gradingMeetsRule("ibnmajah", { grade: "sahih li-ghayrihi", grader: "Fixture" })).toBe(true);
    expect(gradingMeetsRule("abudawud", { grade: "sahih", grader: "Fixture" })).toBe(false);
  });

  test("the search types are the seven the brief names", () => {
    expect([...SEARCH_KINDS]).toEqual(["prophet", "person", "community", "event", "parable", "hadith_story", "story"]);
    expect(isKind("hadith_story")).toBe(true);
    expect(isKind("nonsense")).toBe(false);
    expect(isKind(null)).toBe(false);
  });
});

describe("row mapping", () => {
  test("a list item drops unpublished people, keeps the primary reference built from ids, and refuses an unknown kind", () => {
    const s = storyListItem(baseRow())!;
    expect(s.people).toEqual([{ slug: "p1", name_en: "Person", name_ar: null }]);
    expect(s.themes).toHaveLength(1);
    expect(s.primary).toEqual({ collection: "Sahih al-Bukhari", number: "1" });
    expect(storyListItem(baseRow({ kind: "something_else" }))).toBeNull();
  });

  test("narration text is carried only where content_permissions allows it; the reference and gradings always are", () => {
    const none = storyDetail(baseRow(), [])!;
    expect(none.narrations.map((n) => n.arabic)).toEqual([null, null]);
    expect(none.narrations.every((n) => !n.textAllowed && n.translation === null)).toBe(true);
    const rows: LicenceRow[] = [
      { source_id: "s1", asset_type: "text", scope: "all", status: "CONDITIONAL", attribution_text: "Credit" },
      { source_id: "s2", asset_type: "translation", scope: "all", status: "APPROVED", attribution_text: null },
    ];
    const d = storyDetail(baseRow(), rows)!;
    expect(d.narrations[0]).toMatchObject({ arabic: "[fixture arabic]", textAllowed: true, attribution: "Credit", translation: { translator: "Fixture" } });
    expect(d.narrations[1]!.translation).toBeNull();
  });

  test("variants stay separate rows, the primary first, and a relied-on grading is kept only when the rule is met", () => {
    const d = storyDetail(baseRow(), [])!;
    expect(d.narrations.map((n) => [n.collection, n.number, n.primary])).toEqual([["bukhari", "1", true], ["tirmidhi", "5", false]]);
    expect(d.narrations[1]!.variantNote).toBe("the longer wording");
    expect(d.narrations[1]!.relied).toMatchObject({ grade: "sahih", grader: "Fixture grader" });
    const hasan = baseRow();
    hasan.hadith_story_entries![1]!.selected = { grader: "Fixture grader", grade: "hasan", grade_label: "Hasan", citation: null };
    expect(storyDetail(hasan, [])!.narrations[1]!.relied).toBeNull();
  });

  test("Quran connections come from claim references only; lessons and modern application are kept apart", () => {
    const d = storyDetail(baseRow(), [])!;
    expect(d.quran).toEqual([{ claimId: "c1", statement: "Fixture claim", refs: [{ surah: 12, from: 4, to: 5 }] }]);
    expect(d.lessons.map((l) => l.kind).sort()).toEqual(["lesson", "modern_application"]);
    expect(d.lessons.filter((l) => l.kind === "modern_application")).toHaveLength(1);
    expect(d.context).toEqual({ en: null, ar: null, ur: null });
    expect(d.version).toBe(3);
    expect(d.events).toEqual([{ slug: "ev1", title: "Event", title_ar: null }]);
  });

  test("family edges: shown from this person's side, an edge with an unpublished end is dropped, unknown kinds ignored", () => {
    const a = { slug: "a", name_en: "A", name_ar: null };
    const b = { slug: "b", name_en: "B", name_ar: null };
    const edges = familyEdges("a", [
      { kind: "parent_of", confidence: "scholar", competing_group: null, from: a, to: b, evidence_claims: { statement: "s" } },
      { kind: "parent_of", confidence: "disputed", competing_group: "g", from: b, to: a, evidence_claims: null },
      { kind: "spouse_of", confidence: "scholar", competing_group: null, from: a, to: null, evidence_claims: null },
      { kind: "friend_of", confidence: "scholar", competing_group: null, from: a, to: b, evidence_claims: null },
      { kind: "sibling_of", confidence: "scholar", competing_group: null, from: b, to: { slug: "c", name_en: "C", name_ar: null }, evidence_claims: null },
    ]);
    expect(edges.map((e) => [e.kind, e.direction, e.other.slug, e.competing])).toEqual([["parent_of", "out", "b", false], ["parent_of", "in", "b", true]]);
    expect(relationKey(edges[0]!)).toBe("parent_of");
    expect(relationKey(edges[1]!)).toBe("parent_of_in");
  });

  test("related events: only published, each once, the identity item left out", () => {
    const e = { slug: "e1", title: "E1", title_ar: null };
    const out = relatedEvents([{ historical_events: { ...e, status: "published" } }, { historical_events: { ...e, status: "published" } }, { historical_events: { slug: "e2", title: "E2", title_ar: null, status: "draft" } }, { historical_events: null }, { historical_events: { slug: "me", title: "Me", title_ar: null } }], "me");
    expect(out.map((x) => x.slug)).toEqual(["e1"]);
  });
});

describe("the editor", () => {
  test("a story is saved as a draft and has no field for narration text", () => {
    const r = buildRow("hadith_story", { slug: "fixture-story", kind: "separate_episode", title_en: "Fixture story", hadith_text: "must not be stored", summary_en: "  Fixture summary  " });
    expect(r.ok && r.row).toMatchObject({ status: "draft", summary_en: "Fixture summary", context_en: null, narrator_en: null });
    expect(r.ok && Object.keys(r.row)).not.toContain("hadith_text");
    expect(buildRow("hadith_story", { slug: "Bad Slug", kind: "separate_episode", title_en: "Fixture" })).toMatchObject({ ok: false });
    expect(buildRow("hadith_story", { slug: "fixture-story", kind: "made_up", title_en: "Fixture" })).toMatchObject({ ok: false });
  });
  test("a link is stored by id in exactly one column; a narration optionally names its grading", () => {
    const l = buildRow("hadith_story_link", { story_id: ID, target_kind: "theme", target_id: ID });
    expect(l.ok && l.row).toMatchObject({ guidance_topic_id: ID, person_id: null, community_id: null, event_id: null });
    expect(buildRow("hadith_story_link", { story_id: ID, target_kind: "verse", target_id: ID })).toMatchObject({ ok: false });
    const n = buildRow("hadith_story_entry", { story_id: ID, hadith_id: ID, grading_id: "", is_primary: true });
    expect(n.ok && n.row).toMatchObject({ grading_id: null, is_primary: true });
    expect(buildRow("hadith_story_entry", { story_id: ID, hadith_id: "not-an-id" })).toMatchObject({ ok: false });
    expect(buildRow("hadith_story_claim", { story_id: ID, claim_id: ID })).toMatchObject({ ok: true });
    expect(buildRow("hadith_story_lesson", { story_id: ID, kind: "modern_application", body_en: "too short" })).toMatchObject({ ok: false });
  });
  test("the queue says what a story still lacks, in the database's own terms", () => {
    expect(publishBlockers({ narrator: false, summary: false, kind: "clarifies_quranic_story", narrations: [], quranClaims: 0 })).toEqual([
      "name the narrator",
      "write the English summary",
      "add the narration the story points at",
      "add a Quran connection (an approved claim with Quran references)",
    ]);
    expect(publishBlockers({ narrator: true, summary: true, kind: "independent_lesson", narrations: [{ primary: true, collection: "tirmidhi", hasGrading: true, grade: "hasan" }], quranClaims: 0 })).toHaveLength(1);
    expect(publishBlockers({ narrator: true, summary: true, kind: "independent_lesson", narrations: [{ primary: true, collection: "bukhari", hasGrading: false, grade: null }, { primary: false, collection: "muslim", hasGrading: false, grade: null }], quranClaims: 0 })).toEqual([]);
    expect(publishBlockers({ narrator: true, summary: true, kind: "independent_lesson", narrations: [{ primary: false, collection: "bukhari", hasGrading: false, grade: null }], quranClaims: 0 })).toEqual(["mark exactly one narration as the primary one"]);
  });
});

describe("components", () => {
  test("a narration whose licence is pending shows the reference and says so, never the text", () => {
    const story = fixtureStory("fixture-story-a")!;
    render(<NarrationCard n={story.narrations[0]!} t={en} />);
    const card = screen.getByTestId("narration");
    expect(within(card).getByText(en.detail.referenceOnly)).toBeInTheDocument();
    expect(card.querySelector("[lang='ar']")).toBeNull();
    expect(within(card).getByRole("link", { name: en.detail.openNarration })).toHaveAttribute("href", "/hadith/bukhari/1");
  });

  test("the three identification states carry a glyph and words, and a later-tradition name is labelled as such", () => {
    const { rerender } = render(<IdentificationBlock subject={null} t={enc} locale="en" />);
    expect(screen.getByTestId("identification")).toHaveAttribute("data-status", "unknown");
    expect(screen.getByText(enc.identification.unknown)).toBeInTheDocument();
    const subject = { slug: "x", title: "x", track: "people", name_source: "later_tradition" as const, verses: [], identifications: [{ kind: "name", subject: "Test name", view: "A view", standing: "widely_held" }] };
    rerender(<IdentificationBlock subject={subject} t={enc} locale="en" />);
    expect(screen.getByTestId("identification")).toHaveAttribute("data-status", "later");
    expect(screen.getByText(enc.identification.later)).toBeInTheDocument();
    expect(screen.getByText("Widely held")).toBeInTheDocument();
    rerender(<IdentificationBlock subject={{ ...subject, name_source: "quran", identifications: [] }} t={enc} locale="en" />);
    expect(screen.getByText(enc.identification.named)).toBeInTheDocument();
  });

  test("Quran references are deep links with the ayah anchor; no reference says so", () => {
    const subject = { slug: "x", title: "x", track: "people", name_source: "quran" as const, verses: [{ surah: 12, from: 4, to: 5 }], identifications: [] };
    const { rerender } = render(<QuranSection evidence={[]} subject={subject} t={enc} lang="en" />);
    expect(within(screen.getByTestId("quran-refs")).getByRole("link", { name: /12:4–5/ })).toHaveAttribute("href", "/quran/12#ayah-4-5");
    rerender(<QuranSection evidence={[]} subject={null} t={enc} lang="en" />);
    expect(screen.getByText(enc.sections.noQuran)).toBeInTheDocument();
  });

  test("what is not established is said plainly, and an established value is shown instead", () => {
    render(<NotEstablished t={enc} items={[{ label: "Age", value: null }, { label: "Place", value: "A fixture place" }]} />);
    const rows = screen.getByTestId("not-established").querySelectorAll("dd");
    expect(rows[0]).toHaveAttribute("data-established", "no");
    expect(rows[0]).toHaveTextContent(enc.sections.notEstablished);
    expect(rows[1]).toHaveAttribute("data-established", "yes");
    expect(rows[1]).toHaveTextContent("A fixture place");
  });

  test("cards link to their pages", () => {
    const s: StoryListItem = fixtureStories()[0]!;
    render(
      <ul>
        <StoryCard s={s} locale="en" t={en} />
        <PersonCard p={fixturePeople()[0]!} locale="en" t={enc} />
      </ul>,
    );
    expect(screen.getAllByRole("link", { name: "Test story A" })[0]).toHaveAttribute("href", "/hadith-stories/fixture-story-a");
    expect(screen.getByTestId("story-card")).toHaveTextContent(en.kinds.clarifies_quranic_story);
  });
});

describe("pages", () => {
  test("hadith stories: a designed empty state with counts only, no titles", async () => {
    storiesMock.mockResolvedValue([]);
    countsMock.mockResolvedValue({ published: 0, under_review: 4 });
    const { default: Page } = await import("@/app/[locale]/hadith-stories/page");
    render(await Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("empty-state")).toHaveTextContent(en.empty.title);
    expect(screen.getByTestId("encyclopedia-counts")).toHaveTextContent("4 under review");
    expect(screen.queryByTestId("story-card")).toBeNull();
  });

  test("hadith stories: not connected is said, and a populated list filters by URL parameter", async () => {
    storiesMock.mockResolvedValue(null);
    countsMock.mockResolvedValue(null);
    const { default: Page } = await import("@/app/[locale]/hadith-stories/page");
    render(await Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("empty-state")).toHaveTextContent(en.empty.notConnected);
    cleanup();
    storiesMock.mockResolvedValue(fixtureStories());
    render(await Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ kind: "independent_lesson" }) }));
    expect(screen.getAllByTestId("story-card")).toHaveLength(1);
    expect(screen.getByTestId("story-filters")).toBeInTheDocument();
    cleanup();
    render(await Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ theme: "nothing-here" }) }));
    expect(screen.getByTestId("empty-state")).toHaveTextContent(en.empty.noMatch);
  });

  test("a story page: facts, variants apart, Quran connection, lessons, the modern application labelled, and Not established", async () => {
    storyMock.mockResolvedValue(fixtureStory("fixture-story-a"));
    const { default: Page } = await import("@/app/[locale]/hadith-stories/[slug]/page");
    render(await Page({ params: Promise.resolve({ locale: "en", slug: "fixture-story-a" }) }));
    expect(screen.getAllByTestId("narration")).toHaveLength(2);
    expect(within(screen.getByTestId("variants")).getAllByTestId("narration")).toHaveLength(1);
    expect(within(screen.getByTestId("story-quran")).getByRole("link", { name: /12:4–5/ })).toHaveAttribute("href", "/quran/12#ayah-4-5");
    expect(screen.getByTestId("story-context")).toHaveAttribute("data-established", "no");
    expect(screen.getByTestId("story-context")).toHaveTextContent(en.detail.notEstablished);
    const modern = screen.getByTestId("modern-application");
    expect(modern).toHaveTextContent(en.detail.modernLabel);
    expect(modern).toHaveTextContent(en.detail.modernNote);
    expect(within(screen.getByTestId("story-links")).getByRole("link", { name: /Test person A/ })).toHaveAttribute("href", "/people/fixture-person-a");
  });

  test("people: grouped by kind, with the empty state showing counts only", async () => {
    peopleMock.mockResolvedValue(fixturePeople());
    countsMock.mockResolvedValue({ published: 4, under_review: 1 });
    const { default: Page } = await import("@/app/[locale]/people/page");
    render(await Page({ params: Promise.resolve({ locale: "en" }) }));
    for (const g of ["prophet", "individual", "ruler", "unnamed"]) expect(screen.getByTestId(`people-group-${g}`)).toBeInTheDocument();
    expect(screen.queryByTestId("people-group-family_member")).toBeNull();
    expect(within(screen.getByTestId("people-group-prophet")).getAllByTestId("person-card")).toHaveLength(1);
    cleanup();
    peopleMock.mockResolvedValue([]);
    render(await Page({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("empty-state")).toHaveTextContent(enc.people.emptyTitle);
    expect(screen.getByTestId("encyclopedia-counts")).toHaveTextContent("1 under review");
  });

  test("a person page: identification, Quran references, aliases, family, events, hadith stories, and what is not established", async () => {
    personMock.mockResolvedValue((await import("@/lib/encyclopedia/fixtures")).fixturePerson("fixture-person-a"));
    const { default: Page } = await import("@/app/[locale]/people/[slug]/page");
    render(await Page({ params: Promise.resolve({ locale: "en", slug: "fixture-person-a" }) }));
    expect(screen.getByTestId("identification")).toHaveAttribute("data-status", "later");
    expect(screen.getByTestId("person-kind")).toHaveAttribute("data-group", "ruler");
    expect(within(screen.getByTestId("quran-refs")).getAllByRole("link").length).toBeGreaterThan(0);
    expect(screen.getByTestId("aliases")).toHaveTextContent("Test alias");
    expect(screen.getByTestId("family")).toHaveTextContent("Test person B");
    expect(screen.getByTestId("related-events")).toHaveTextContent("Test event A");
    expect(screen.getByTestId("linked-stories")).toHaveTextContent("Test story A");
    const ne = screen.getByTestId("not-established").querySelectorAll("dd[data-established='no']");
    expect(ne.length).toBe(4);
  });

  test("a missing or unpublished record is a 404, not a bare page", async () => {
    personMock.mockResolvedValue(undefined);
    communityMock.mockResolvedValue(undefined);
    storyMock.mockResolvedValue(undefined);
    const person = await import("@/app/[locale]/people/[slug]/page");
    const community = await import("@/app/[locale]/communities/[slug]/page");
    const story = await import("@/app/[locale]/hadith-stories/[slug]/page");
    await expect(person.default({ params: Promise.resolve({ locale: "en", slug: "nobody-here" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND/);
    await expect(community.default({ params: Promise.resolve({ locale: "en", slug: "nobody-here" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND/);
    await expect(story.default({ params: Promise.resolve({ locale: "en", slug: "nobody-here" }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND/);
  });

  test("communities: the list, and the empty state with counts only", async () => {
    communitiesMock.mockResolvedValue(fixtureCommunities());
    const { default: Page } = await import("@/app/[locale]/communities/page");
    render(await Page({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getAllByTestId("community-card")).toHaveLength(2);
    cleanup();
    communitiesMock.mockResolvedValue([]);
    countsMock.mockResolvedValue({ published: 0, under_review: 9 });
    render(await Page({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("empty-state")).toHaveTextContent(enc.communities.emptyTitle);
    expect(screen.getByTestId("encyclopedia-counts")).toHaveTextContent("9 under review");
  });
});
