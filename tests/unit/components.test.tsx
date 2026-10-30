import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CitationChip, DraftBadge, EditorialStatus, EvidenceLabel, HadithGrade } from "@/components/ui/evidence";
import { EvidenceDrawer } from "@/components/ui/EvidenceDrawer";
import { HadithCard, VerseCard } from "@/components/ui/cards";
import { Markdown } from "@/components/ui/Markdown";
import { Button } from "@/components/ui/Button";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { ProphetJourneyCard } from "@/components/journey/ProphetJourneyCard";
import { getJourney } from "@/content/journey";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

describe("EvidenceLabel", () => {
  test.each([
    ["quran", "Quran"],
    ["hadith", "Authentic Hadith"],
    ["scholar", "Scholarly interpretation"],
    ["estimate", "Historical estimate"],
    ["disputed", "Disputed"],
    ["unknown", "Unknown"],
  ] as const)("%s renders its word, its mark and its border class", (kind, word) => {
    const { container } = render(<EvidenceLabel kind={kind} />);
    const el = container.querySelector(".zq-ev")!;
    expect(el).toHaveClass(`zq-ev-${kind}`);
    expect(el).toHaveTextContent(word);
    expect(el.querySelector("svg")).not.toBeNull();
  });
  test("Arabic wording", () => {
    render(<EvidenceLabel kind="quran" lang="ar" />);
    expect(screen.getByText("القرآن")).toBeInTheDocument();
  });
});

describe("HadithGrade", () => {
  test("a grade is authentic only with a named grader", () => {
    const { container, rerender } = render(<HadithGrade grade="Sahih" authentic />);
    expect(container.querySelector(".zq-ev-hadith")).toBeNull();
    rerender(<HadithGrade grade="Sahih" grader="Scholar" authentic source="Work p.1" />);
    expect(container.querySelector(".zq-ev-hadith")).not.toBeNull();
  });
  test("no grade recorded is an honest unknown state", () => {
    render(<HadithGrade />);
    expect(screen.getByText("Grade not recorded")).toBeInTheDocument();
  });
  test("disagreement is stated", () => {
    render(<HadithGrade grade="Hasan" grader="A" authentic varies />);
    expect(screen.getByText(/Graded differently by other scholars/)).toBeInTheDocument();
  });
});

describe("cards", () => {
  test("VerseCard hides a translation whose licence is pending, and says so", () => {
    render(<VerseCard surahName="Fixture" reference="Q 1:1" arabic={null} translation="SHOULD NOT SHOW" licence="pending" actions={false} />);
    expect(screen.queryByText("SHOULD NOT SHOW")).toBeNull();
    expect(screen.getByText("Translation unavailable — licence pending")).toBeInTheDocument();
    expect(screen.getByTestId("arabic-pending")).toBeInTheDocument();
  });
  test("HadithCard with no gradings shows the unknown state", () => {
    render(<HadithCard collection="Fixture" number="No. —" demo actions={false} />);
    expect(screen.getByText("Grade not recorded")).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
  });
  test("citations are visible text, never hover-only", () => {
    render(<CitationChip>Q 12:4</CitationChip>);
    expect(screen.getByText("Q 12:4")).toBeVisible();
  });
  test("draft badge shows until published", () => {
    const { rerender } = render(<DraftBadge status="draft" />);
    expect(screen.getByTestId("draft-badge")).toBeInTheDocument();
    rerender(<DraftBadge status="published" />);
    expect(screen.queryByTestId("draft-badge")).toBeNull();
  });
  test("EditorialStatus always shows its word", () => {
    render(<EditorialStatus status="correction" />);
    expect(screen.getByText("Correction pending")).toBeInTheDocument();
  });
  test("Button loading keeps its label, sets aria-busy and is disabled", () => {
    render(<Button loading>Saving</Button>);
    const b = screen.getByRole("button", { name: "Saving" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });
});

describe("Markdown", () => {
  test("raw HTML is shown as text, never executed", () => {
    const { container } = render(<Markdown source={'Hello <img src=x onerror="alert(1)"> **bold** [x](javascript:alert(1))'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.textContent).toContain("<img");
  });
});

describe("EvidenceDrawer", () => {
  test("focus moves to Close, Esc closes, focus returns to the trigger", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>View evidence</button>
          {open ? <EvidenceDrawer claim="A claim" status="quran" tabs={[{ label: "Quran", count: 1, content: <p>ref</p> }, { label: "Hadith", count: 0, content: <p>No narration is attached</p> }]} onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "View evidence" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "Close evidence" })).toHaveFocus();
    // Empty tabs are still present and say so.
    await user.click(within(dialog).getByRole("tab", { name: "Hadith (0)" }));
    expect(within(dialog).getByText("No narration is attached")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(trigger).toHaveFocus();
  });
});

describe("Journey", () => {
  const j = getJourney();
  test("ProphetJourneyCard expanded shows evidence label, citation chip and both actions", () => {
    const yusuf = j.eras.flatMap((e) => e.items).find((s) => s.id === "yusuf")!;
    const { container } = render(<ProphetJourneyCard item={yusuf} expanded onEvidence={() => {}} />);
    expect(container.querySelector(".zq-ev")).not.toBeNull();
    expect(container.querySelector(".zq-chip")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Explore story" })).toHaveAttribute("href", "/prophets/yusuf");
    expect(screen.getByRole("button", { name: /View evidence/ })).toBeInTheDocument();
  });
  test("milestones show Sources instead of related surahs", () => {
    const hijrah = j.eras.flatMap((e) => e.items).find((s) => s.id === "hijrah")!;
    render(<ProphetJourneyCard item={hijrah} expanded />);
    expect(screen.getByText(/Milestone/)).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.queryByText("Related surahs")).toBeNull();
  });
  test("clicking a node expands that card and collapses the previous one; filters change the count", () => {
    const { container } = render(<JourneyTimeline eras={j.eras} initialActive="adam" />);
    expect(container.querySelector('#adam[data-expanded="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nuh — show details" }));
    expect(container.querySelector('#nuh[data-expanded="true"]')).not.toBeNull();
    expect(container.querySelector('#adam[data-expanded="false"]')).not.toBeNull();
    expect(screen.getByTestId("journey-progress")).toHaveTextContent("3 / 29");
    fireEvent.click(screen.getByRole("button", { name: "Key events" }));
    expect(container.querySelectorAll(".zq-jt-item")).toHaveLength(5);
    expect(screen.getByTestId("journey-progress")).toHaveTextContent("1 / 5");
    fireEvent.click(screen.getByRole("button", { name: "Prophets" }));
    expect(container.querySelectorAll(".zq-jt-item")).toHaveLength(24);
  });
});
