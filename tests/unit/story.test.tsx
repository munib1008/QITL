import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StoryView } from "@/components/story/StoryView";
import { QuizBlock } from "@/components/story/QuizBlock";
import { AnimationPlayer, ANIMATION_KEYS } from "@/components/story/AnimationPlayer";
import { NOT_ESTABLISHED, type Section, type Story } from "@/lib/data/story-types";

const ref = { kind: "quran", surah: 12, from: 3, to: null, hadith: null, locator: null, work: null };
const base: Omit<Section, "id" | "section"> = {
  factKey: null,
  stepGroup: null,
  stepRole: null,
  position: 1,
  audience: "full",
  baseId: null,
  title: null,
  valueText: null,
  valueNote: null,
  known: true,
  bodyMd: "",
  everydayExample: null,
  evidence: "quran",
  refs: [ref],
};
const s = (o: Partial<Section> & Pick<Section, "id" | "section">): Section => ({ ...base, ...o });

const story: Story = {
  sections: [
    s({ id: "sum", section: "summary", bodyMd: "Full summary text." }),
    s({ id: "sum-k", section: "summary", audience: "kids", baseId: "sum", bodyMd: "Kids summary text." }),
    s({ id: "life", section: "fact", factKey: "lifespan", known: false }),
    s({ id: "call", section: "calling", bodyMd: "Full calling text." }),
    s({ id: "st1", section: "step", stepGroup: 1, stepRole: "situation", bodyMd: "Step situation." }),
    s({ id: "st2", section: "step", stepGroup: 1, stepRole: "challenge", bodyMd: "Step challenge." }),
    s({ id: "tk", section: "takeaway", title: "Patience", bodyMd: "Meaning text.", everydayExample: "An everyday example." }),
  ],
  quizzes: [],
  media: [],
};

describe("StoryView", () => {
  test("renders sections A–G with unknown facts stated plainly and missing facts marked not yet written", () => {
    render(<StoryView story={story} name="Fixture" />);
    for (const h of ["Introduction", "Before the mission: what was happening?", "The calling and the message", "Challenges and important decisions", "Outcome of the mission", "Takeaways for everyday life", "Sources"])
      expect(screen.getByRole("heading", { name: new RegExp(h.replace(/[?]/g, "\\?")) })).toBeInTheDocument();
    const lifespan = document.querySelector('[data-fact="lifespan"]')!;
    expect(lifespan).toHaveTextContent("Not established");
    expect(lifespan).toHaveTextContent(NOT_ESTABLISHED);
    expect(document.querySelector('[data-fact="era"]')).toHaveTextContent("Not yet written");
  });
  test("reading levels: kids shows the adaptation where one exists and says so where it falls back", () => {
    render(<StoryView story={story} name="Fixture" />);
    expect(screen.getByText("Full summary text.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Kids" }));
    expect(screen.getByText("Kids summary text.")).toBeInTheDocument();
    expect(screen.queryByText("Full summary text.")).toBeNull();
    const calling = screen.getByRole("heading", { name: /The calling/ }).closest("section")!;
    expect(within(calling).getByText(/Not yet written for this reading level/)).toBeInTheDocument();
    expect(within(calling).getByText("Full calling text.")).toBeInTheDocument();
  });
  test("challenges follow the chain and takeaways label the everyday example as an application", () => {
    render(<StoryView story={story} name="Fixture" />);
    const chain = screen.getByRole("list", { name: "Challenge 1" });
    expect(within(chain).getAllByRole("listitem").map((li) => li.getAttribute("data-role"))).toEqual(["situation", "challenge"]);
    expect(screen.getByText(/educational application/)).toBeInTheDocument();
    expect(screen.getAllByText("Q 12:3").length).toBeGreaterThan(0);
  });
});

describe("QuizBlock", () => {
  test("shows right or wrong with the source, and no score", () => {
    render(
      <QuizBlock
        quiz={{ id: "q", title: "Fixture quiz", audience: "kids", questions: [{ id: "1", prompt: "Which option?", options: ["First", "Second"], correct: 1, explanation: "Because.", refs: [ref] }] }}
      />,
    );
    fireEvent.click(screen.getByLabelText("First"));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByText(/the answer is “Second”/)).toBeInTheDocument();
    expect(screen.getByText("Q 12:3")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/score|points|streak/i);
  });
});

describe("AnimationPlayer", () => {
  test("every animation is described, captioned and controllable", () => {
    for (const key of ANIMATION_KEYS) {
      const { unmount } = render(<AnimationPlayer animation={key} caption="Caption" alt={`Alt for ${key}`} />);
      expect(screen.getByRole("img", { name: `Alt for ${key}` })).toBeInTheDocument();
      expect(screen.getByText(/does not depict people/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Replay" })).toBeInTheDocument();
      unmount();
    }
  });
});
