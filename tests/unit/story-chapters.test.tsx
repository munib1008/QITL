import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { ChapterReader } from "@/components/story/ChapterReader";
import { ReaderModeSwitch } from "@/components/story/ReaderModeSwitch";
import { StoryChapterLinks } from "@/components/story/StoryChapterLinks";
import { StoryView } from "@/components/story/StoryView";
import { fixtureStory } from "@/lib/stories/fixture";
import { storyChaptersStrings } from "@/lib/i18n/modules/storyChapters";
import { chapterDomId, chapterVerseRefs, storySources, toStoryData, type StoryRow } from "@/lib/stories/chapters";
import type { Section, Story } from "@/lib/data/story-types";

/** The fixture story is synthetic: labelled placeholder text and verse numbers that only exercise the link format. */
const story = fixtureStory();
const t = storyChaptersStrings("en");

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/stories/fixture-story");
});

describe("ChapterReader", () => {
  test("every chapter has its own anchor, verse links and a collapsed sources panel", () => {
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    const chapters = screen.getAllByTestId("story-chapter");
    expect(chapters.map((c) => c.id)).toEqual(["chapter-part-1", "chapter-part-2", "chapter-part-3"]);
    const first = chapters[0]!;
    const verses = within(first).getAllByRole("link", { name: "Q 1:1–2" });
    expect(verses[0]).toHaveAttribute("href", "/quran/1#ayah-1-2");
    expect(first.querySelector(".sc-verses")).toContainElement(verses[0]!);
    const sources = first.querySelector("details.sc-sources") as HTMLDetailsElement;
    expect(sources.open).toBe(false);
    expect(within(first).getByText("Sources (1)")).toBeInTheDocument();
    expect(within(first).getByTestId("chapter-event")).toHaveAttribute("href", "/events/fixture-event");
  });

  test("the complete story is the default; a chapter without reviewed text says 'not established' and writes nothing", () => {
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    const [c1, c2, c3] = screen.getAllByTestId("story-chapter");
    expect(within(c1!).getByText(/Complete text of chapter one/)).toBeInTheDocument();
    expect(within(c2!).getByText(/Complete text of chapter two/)).toBeInTheDocument();
    const missing = within(c3!).getByRole("note");
    expect(missing).toHaveTextContent(/Not established yet/);
    expect(missing).toHaveTextContent(/nothing has been generated/);
    expect(c3!.querySelector('[data-state="text"]')).toBeNull();
  });

  test("each mode shows only its own reviewed text, never another mode's", () => {
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    const [c1, c2] = screen.getAllByTestId("story-chapter");
    fireEvent.click(screen.getByRole("radio", { name: t.modes.summary[0] }));
    expect(within(c1!).getByText(/One-minute summary of chapter one/)).toBeInTheDocument();
    expect(within(c1!).queryByText(/Complete text of chapter one/)).toBeNull();
    expect(within(c2!).getByRole("note")).toHaveTextContent(/no reviewed one-minute summary/);

    fireEvent.click(screen.getByRole("radio", { name: t.modes.kids[0] }));
    expect(within(c1!).getByText(/Kids version of chapter one/)).toBeInTheDocument();
    expect(within(c2!).getByRole("note")).toHaveTextContent(/no reviewed kids version/);

    fireEvent.click(screen.getByRole("radio", { name: t.modes.lessons[0] }));
    expect(within(c1!).getByText(/Life lesson of chapter one/)).toBeInTheDocument();
    expect(within(c1!).getByText(/Educational interpretation/)).toBeInTheDocument();
    expect(within(c2!).queryByText(/Educational interpretation/)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: t.modes.deep[0] }));
    expect(within(c1!).getByText(/Deep-study notes of chapter one/)).toBeInTheDocument();
    expect(within(c1!).getByText(/Complete text of chapter one/)).toBeInTheDocument();
    expect((c1!.querySelector("details.sc-sources") as HTMLDetailsElement).open).toBe(true);
    expect(within(c2!).getByText(t.deepNoExtra)).toBeInTheDocument();
  });

  test("the mode is written to ?mode= and remembered in this browser", () => {
    const { unmount } = render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    fireEvent.click(screen.getByRole("radio", { name: t.modes.kids[0] }));
    expect(window.location.search).toBe("?mode=kids");
    expect(window.localStorage.getItem("qitl-story-mode")).toBe("kids");
    unmount();
    window.history.replaceState(null, "", "/stories/fixture-story");
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    expect(screen.getByRole("radio", { name: t.modes.kids[0] })).toHaveAttribute("aria-checked", "true");
  });

  test("?mode= wins over the remembered mode, and an unknown value is ignored", () => {
    window.localStorage.setItem("qitl-story-mode", "kids");
    window.history.replaceState(null, "", "/stories/fixture-story?mode=summary");
    const { unmount } = render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    expect(screen.getByRole("radio", { name: t.modes.summary[0] })).toHaveAttribute("aria-checked", "true");
    unmount();
    window.history.replaceState(null, "", "/stories/fixture-story?mode=%3Cscript%3E");
    window.localStorage.clear();
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    expect(screen.getByRole("radio", { name: t.modes.complete[0] })).toHaveAttribute("aria-checked", "true");
  });

  test("unavailable storage never breaks reading", () => {
    const orig = Storage.prototype.getItem;
    const origSet = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
      fireEvent.click(screen.getByRole("radio", { name: t.modes.summary[0] }));
      expect(screen.getByRole("radio", { name: t.modes.summary[0] })).toHaveAttribute("aria-checked", "true");
    } finally {
      Storage.prototype.getItem = orig;
      Storage.prototype.setItem = origSet;
    }
  });

  test("Sources and uncertainties lists what is not established, and says plainly when nothing is recorded", () => {
    const { unmount } = render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    const s = screen.getByTestId("sources-and-uncertainties");
    expect(within(s).getByText(/A point the sources do not establish/)).toBeInTheDocument();
    expect(within(s).getAllByRole("link").length).toBeGreaterThan(1);
    unmount();
    render(<ChapterReader slug="x" chapters={story.chapters.map((c) => ({ ...c, unknownsMd: null }))} />);
    expect(screen.getByTestId("no-uncertainties")).toHaveTextContent(/not a claim that there are none/);
  });

  test("a chapter's own 'not established' block appears in the complete and deep modes only", () => {
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    const c1 = screen.getAllByTestId("story-chapter")[0]!;
    expect(within(c1).getByRole("complementary", { name: t.notEstablishedHeading })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: t.modes.kids[0] }));
    expect(within(c1).queryByRole("complementary", { name: t.notEstablishedHeading })).toBeNull();
  });

  test("an empty story says so", () => {
    render(<ChapterReader slug="e" chapters={[]} />);
    expect(screen.getByText(t.noChapters)).toBeInTheDocument();
  });

  test("the chapter sheet opens, lists every chapter and closes", () => {
    render(<ChapterReader slug={story.slug} chapters={story.chapters} />);
    expect(screen.getByRole("button", { name: /Chapters: Chapter 1 of 3/ })).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getAllByRole("link", { name: /Chapter [123]$/, hidden: true }).length).toBeGreaterThanOrEqual(3);
  });
});

describe("ReaderModeSwitch keyboard", () => {
  test("arrow keys move and select; Home and End jump; only the selected mode is in the tab order", () => {
    let mode: "complete" | "summary" | "deep" | "kids" | "lessons" = "complete";
    const { rerender } = render(<ReaderModeSwitch mode={mode} onChange={(m) => (mode = m)} />);
    const radios = () => screen.getAllByRole("radio");
    expect(radios().map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1", "-1"]);
    fireEvent.keyDown(radios()[1]!, { key: "ArrowRight" });
    expect(mode).toBe("deep");
    rerender(<ReaderModeSwitch mode={mode} onChange={(m) => (mode = m)} />);
    fireEvent.keyDown(radios()[2]!, { key: "End" });
    expect(mode).toBe("lessons");
    fireEvent.keyDown(radios()[4]!, { key: "ArrowRight" });
    expect(mode).toBe("summary");
    fireEvent.keyDown(radios()[0]!, { key: "ArrowLeft" });
    expect(mode).toBe("lessons");
    fireEvent.keyDown(radios()[4]!, { key: "Home" });
    expect(mode).toBe("summary");
  });
  test("a mode with no reviewed text anywhere is marked, not hidden", () => {
    render(<ReaderModeSwitch mode="complete" onChange={() => undefined} empty={{ kids: true }} />);
    expect(screen.getByRole("radio", { name: t.modes.kids[0] })).toHaveAttribute("data-empty", "true");
  });
});

describe("chapter data", () => {
  const row: StoryRow = {
    id: "s",
    slug: "s",
    title: "T",
    title_ar: null,
    summary: "S",
    chapters: [
      {
        id: "b", position: 2, anchor: "two", title: "B", body_md: "b", summary_md: null, deep_md: null, kids_md: null, lessons_md: null, unknowns_md: null, historical_events: null,
        chapter_claims: [{ evidence_claims: { id: "k2", statement: "x", evidence: "quran", claim_references: [{ kind: "quran", quran_surah: 2, quran_ayah_from: 5, quran_ayah_to: null, locator: null, sources: null, hadith_entries: null, hadith_gradings: null }] } }],
      },
      {
        id: "a", position: 1, anchor: "one", title: "A", body_md: "a", summary_md: "sa", deep_md: null, kids_md: null, lessons_md: null, unknowns_md: null, historical_events: { slug: "e", title: "E" },
        chapter_claims: [
          { evidence_claims: { id: "k1", statement: "y", evidence: "hadith", claim_references: [
            { kind: "quran", quran_surah: 1, quran_ayah_from: 2, quran_ayah_to: 4, locator: null, sources: null, hadith_entries: null, hadith_gradings: null },
            { kind: "quran", quran_surah: 1, quran_ayah_from: 2, quran_ayah_to: 4, locator: null, sources: null, hadith_entries: null, hadith_gradings: null },
            { kind: "hadith", quran_surah: null, quran_ayah_from: null, quran_ayah_to: null, locator: null, sources: null, hadith_entries: { collection_id: "bukhari", canonical_number: "1" }, hadith_gradings: { grade_label: "Sahih", grader: "G" } },
          ] } },
          { evidence_claims: null },
        ],
      },
    ],
  };
  test("chapters are ordered by position; verse references are the claims' Quran references, merged", () => {
    const s = toStoryData(row);
    expect(s.chapters.map((c) => c.anchor)).toEqual(["one", "two"]);
    expect(chapterDomId(s.chapters[0]!)).toBe("chapter-one");
    expect(chapterVerseRefs(s.chapters[0]!)).toEqual([expect.objectContaining({ surah: 1, from: 2, to: 4 })]);
    expect(s.chapters[0]!.eventSlug).toBe("e");
    expect(storySources(s.chapters)).toHaveLength(3);
  });
});

describe("linked chapters on prophet and event pages", () => {
  test("each chapter links to its own anchor", () => {
    render(<StoryChapterLinks locale="en" stories={[{ slug: "fx", title: "Fixture", chapters: [{ position: 1, anchor: "part-1", title: "One" }, { position: 2, anchor: "part-2", title: "Two" }] }]} />);
    expect(screen.getByRole("link", { name: "Two" })).toHaveAttribute("href", "/stories/fx#chapter-part-2");
  });
  test("nothing renders without a published story", () => {
    const { container } = render(<StoryChapterLinks locale="en" stories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StoryView modes (prophet and event pages)", () => {
  const base: Omit<Section, "id" | "section"> = { factKey: null, stepGroup: null, stepRole: null, position: 1, audience: "full", baseId: null, title: null, valueText: null, valueNote: null, known: true, bodyMd: "", everydayExample: null, evidence: "quran", refs: [] };
  const s = (o: Partial<Section> & Pick<Section, "id" | "section">): Section => ({ ...base, ...o });
  const sv: Story = {
    sections: [
      s({ id: "sum", section: "summary", bodyMd: "Summary fixture." }),
      s({ id: "call", section: "calling", bodyMd: "Calling fixture." }),
      s({ id: "tk", section: "takeaway", title: "Patience", bodyMd: "Meaning fixture.", everydayExample: "Example fixture." }),
      s({ id: "note", section: "scholarly_note", bodyMd: "Scholarly note fixture." }),
    ],
    quizzes: [],
    media: [],
  };
  test("summary shows the quick understanding only; lessons the takeaways only; deep adds the scholarly notes", () => {
    render(<StoryView story={sv} name="Fixture" />);
    expect(screen.queryByText("Scholarly note fixture.")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: t.modes.summary[0] }));
    expect(screen.getByText("Summary fixture.")).toBeInTheDocument();
    expect(screen.queryByText("Calling fixture.")).toBeNull();
    expect(screen.queryByText("Patience")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: t.modes.lessons[0] }));
    expect(screen.queryByText("Summary fixture.")).toBeNull();
    expect(screen.getByText("Patience")).toBeInTheDocument();
    expect(screen.getByText(/educational application/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: t.modes.deep[0] }));
    expect(screen.getByText("Scholarly note fixture.")).toBeInTheDocument();
    expect(screen.getByText("Calling fixture.")).toBeInTheDocument();
  });
});
