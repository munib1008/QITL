import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { JourneyDial, type DialStop } from "@/components/journey/JourneyDial";
import { NamesDial } from "@/components/asma/NamesDial";
import { redesignStrings } from "@/lib/i18n/modules/redesign";
import { draftDialNames } from "@/content/asmaDial";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
afterEach(cleanup);
const stops: DialStop[] = [
  { id: "adam", name: "Adam", arabic: "آدم", eraLabel: "Early humanity", dateLabel: "Early humanity", certainty: "relative", certaintyLabel: "Chronological position" },
  { id: "yusuf", name: "Yusuf", arabic: "يوسف", eraLabel: "Era", dateLabel: "Era", certainty: "relative", certaintyLabel: "Chronological position" },
  { id: "hijrah", name: "The Hijrah", arabic: "الهجرة", eraLabel: "Final", dateLabel: "622 CE · 1 AH", certainty: "exact", certaintyLabel: "Established date" },
];

describe("JourneyDial", () => {
  const s = redesignStrings("en").dial;
  test("Next moves the centre to the next stop, and search jumps to a stop", async () => {
    const u = userEvent.setup();
    render(<JourneyDial stops={stops} s={s} href="/timeline?view=complete" />);
    const core = () => document.querySelector(".rd-dial-core")!.textContent;
    expect(core()).toContain("Adam");
    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(core()).toContain("Yusuf");
    await u.type(screen.getByLabelText(s.searchLabel), "hij");
    await u.click(within(screen.getByRole("group", { name: s.results })).getByRole("button", { name: "The Hijrah" }));
    expect(core()).toContain("622 CE");
    expect(screen.getByRole("link", { name: s.open })).toHaveAttribute("href", "/timeline?view=complete");
  });
  test("a search with no match says so; the dial has labelled keyboard controls", async () => {
    const u = userEvent.setup();
    render(<JourneyDial stops={stops} s={s} href="/x" />);
    await u.type(screen.getByLabelText(s.searchLabel), "zzz");
    expect(screen.getByRole("status")).toHaveTextContent(s.none);
    for (const b of [s.prev, s.next]) expect(screen.getByRole("button", { name: b })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: s.position })).toHaveAttribute("max", String(stops.length - 1));
    expect(document.querySelectorAll(".rd-tick")).toHaveLength(stops.length); // decorative ticks, not extra tab stops
  });
});

describe("NamesDial", () => {
  const names = draftDialNames("en").slice(0, 5);
  const s = redesignStrings("en").namesDial;
  test("shows the Name in Arabic, marks it an AI draft, links to its page, and never states a fixed total", async () => {
    const u = userEvent.setup();
    render(<NamesDial names={names} s={s} locale="en" />);
    expect(screen.getByTestId("dial-ar")).toHaveAttribute("lang", "ar");
    expect(screen.getByText(s.draft)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: s.open })).toHaveAttribute("href", `/asma/${names[0]!.slug}`);
    await u.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("link", { name: s.open })).toHaveAttribute("href", `/asma/${names[1]!.slug}`);
    expect(screen.getByTestId("names-dial").textContent).toMatch(/2\s+of\s+5/);
    expect(screen.getByTestId("names-dial").textContent).not.toMatch(/\b99\b/);
  });
  test("keyboard: a labelled range moves through the Names; the ticks are decorative", async () => {
    render(<NamesDial names={names} s={s} locale="en" />);
    const range = screen.getByRole("slider", { name: s.position });
    expect(range).toHaveAttribute("max", String(names.length - 1));
    expect(document.querySelectorAll(".rd-dial button")).toHaveLength(0); // the ticks are decorative, not tab stops
  });
});
