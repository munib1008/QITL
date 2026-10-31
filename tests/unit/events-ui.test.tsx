import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CompleteTimeline, ViewSwitch } from "@/components/timeline/CompleteTimeline";
import { UniverseCard } from "@/components/timeline/UniverseCard";
import { fixtureCounts, fixtureEvents } from "@/lib/events/fixtures";
import type { UniverseEvent } from "@/lib/events/model";
import { TRACK_IDS } from "@/lib/events/tracks";
import { timeline, timelineStrings } from "@/lib/i18n/modules/timeline";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/timeline",
  useSearchParams: () => new URLSearchParams(),
}));

const s = timelineStrings("en");
const base: UniverseEvent = {
  id: "x",
  slug: "fixture-x",
  title: "Test item: x",
  title_ar: null,
  track: "people",
  category: "sacred_history",
  ordering_kind: "unassigned",
  relative_position: null,
  name_source: "quran",
  start_year: null,
  end_year: null,
  start_ah: null,
  end_ah: null,
  dating_method: null,
  evidence: "scholar",
  verses: [{ surah: 5, ayah_from: 27, ayah_to: 31 }],
  connections: [],
  orderViews: [],
};

describe("a card of the Complete Timeline", () => {
  test("a name from later tradition says so; a name in the Quran does not", () => {
    const { rerender } = render(<ul><UniverseCard e={{ ...base, name_source: "later_tradition" }} s={s} /></ul>);
    expect(screen.getByTestId("later-tradition")).toHaveTextContent("Named in later tradition, not in the Quranic text");
    rerender(<ul><UniverseCard e={base} s={s} /></ul>);
    expect(screen.queryByTestId("later-tradition")).toBeNull();
  });

  test("verses are citation chips that link to the ayah or the range in the reader (the glow target)", () => {
    render(<ul><UniverseCard e={{ ...base, verses: [{ surah: 5, ayah_from: 27, ayah_to: 31 }, { surah: 12, ayah_from: 4, ayah_to: 4 }] }} s={s} /></ul>);
    const chips = screen.getAllByText(/^Q \d/).map((c) => c.closest("a")!);
    expect(chips.map((a) => a.getAttribute("href"))).toEqual(["/quran/5#ayah-27-31", "/quran/12#ayah-4"]);
  });

  test("no date is shown unless the item is a historians' dated estimate, even if years are stored", () => {
    const withYears = { start_year: 570, end_year: 571, start_ah: 53, end_ah: 53 };
    for (const [kind, text] of [["unassigned", "Order not established"], ["relative", "Relative order only"], ["disputed", "Order disputed"]] as const) {
      const { container, unmount } = render(<ul><UniverseCard e={{ ...base, ...withYears, ordering_kind: kind, relative_position: kind === "relative" ? 3 : null }} s={s} /></ul>);
      expect(container.textContent).toContain(text);
      expect(container.textContent).not.toMatch(/570|571| CE|AH/);
      unmount();
    }
    const { container } = render(<ul><UniverseCard e={{ ...base, track: "events", ordering_kind: "dated_estimate", start_year: 570, end_year: 571, dating_method: "Test method" }} s={s} /></ul>);
    expect(container.textContent).toContain("570");
    expect(container.textContent).toContain("Historians' estimate");
    expect(container.textContent).toContain("Test method");
  });

  test("a parable says no historical date is assigned, whatever else is stored", () => {
    const { container } = render(<ul><UniverseCard e={{ ...base, track: "parables", ordering_kind: "dated_estimate", start_year: 570, end_year: 571 }} s={s} /></ul>);
    expect(container.textContent).toContain("No historical date assigned");
    expect(container.textContent).not.toMatch(/570|CE/);
  });

  test("a disputed order lists each view", () => {
    render(<ul><UniverseCard e={{ ...base, ordering_kind: "disputed", orderViews: [{ view: "View one", standing: "disputed" }, { view: "View two", standing: "disputed" }] }} s={s} /></ul>);
    expect(screen.getByText("Order disputed: 2 views")).toBeInTheDocument();
    expect(screen.getByText("View one")).toBeInTheDocument();
    expect(screen.getByText("View two")).toBeInTheDocument();
  });

  test("the atlas and genealogy links appear only when connections exist", () => {
    const { rerender } = render(<ul><UniverseCard e={base} s={s} /></ul>);
    expect(screen.queryByText("Show on the atlas")).toBeNull();
    expect(screen.queryByText("See in the genealogy")).toBeNull();
    rerender(
      <ul>
        <UniverseCard
          e={{ ...base, connections: [{ kind: "takes_place_at", target_kind: "place", label: "Test place", slug: "fixture-place" }, { kind: "lineage", target_kind: "person", label: "P", slug: "fixture-parent" }] }}
          s={s}
        />
      </ul>,
    );
    expect(screen.getByText("Show on the atlas").closest("a")).toHaveAttribute("href", "/atlas?focus=fixture-place");
    expect(screen.getByText("See in the genealogy").closest("a")).toHaveAttribute("href", "/genealogy?focus=fixture-parent");
  });

  test("each track has its own icon shape as well as a colour hook", () => {
    const shapes = new Set<string>();
    for (const track of TRACK_IDS) {
      const { container, unmount } = render(<ul><UniverseCard e={{ ...base, track }} s={s} /></ul>);
      expect(container.querySelector("[data-track]")).toHaveAttribute("data-track", track);
      shapes.add(container.querySelector("svg.tl-icon")!.innerHTML);
      unmount();
    }
    expect(shapes.size).toBe(TRACK_IDS.length);
  });
});

describe("the Complete Timeline view", () => {
  test("with nothing published it shows the designed empty state and the under-review counts, never a title", () => {
    render(<CompleteTimeline locale="en" items={[]} counts={{ published: 0, under_review: 159, byTrack: TRACK_IDS.map((track, i) => ({ track, published: 0, under_review: i + 1 })) }} selected={[...TRACK_IDS]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("under-review-count")).toHaveTextContent("159 inventory items are under review.");
    expect(screen.queryAllByTestId("tl-card")).toHaveLength(0);
  });

  test("not connected: says so and shows no counts", () => {
    render(<CompleteTimeline locale="en" items={null} counts={null} selected={[...TRACK_IDS]} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("not connected");
    expect(screen.queryByTestId("under-review-count")).toBeNull();
  });

  test("lanes: relative order, disputed, order not established and parables, with the Order not established lane first-class", () => {
    const { container } = render(<CompleteTimeline locale="en" items={fixtureEvents()} counts={fixtureCounts()} selected={[...TRACK_IDS]} synthetic />);
    const lanes = [...container.querySelectorAll("section.tl-lane")].map((l) => l.getAttribute("data-lane"));
    expect(lanes).toEqual(["relative", "dated", "disputed", "not_established", "parable"]);
    expect(screen.getByRole("heading", { name: /Order not established/ })).toBeInTheDocument();
    expect(screen.getByTestId("synthetic-banner")).toBeInTheDocument();
  });

  test("a long lane is cut into a first screen and 'Show more' disclosures", () => {
    const { container } = render(<CompleteTimeline locale="en" items={fixtureEvents()} counts={fixtureCounts()} selected={[...TRACK_IDS]} />);
    const more = container.querySelectorAll("details.tl-more");
    expect(more.length).toBeGreaterThan(0);
    // Everything is still in the document (no JavaScript is needed to reach it).
    expect(container.querySelectorAll('[data-testid="tl-card"]').length).toBe(fixtureEvents().length);
  });

  test("the filter shows only the selected tracks and reports it", () => {
    const { container } = render(<CompleteTimeline locale="en" items={fixtureEvents()} counts={fixtureCounts()} selected={["parables"]} />);
    const tracks = new Set([...container.querySelectorAll('[data-testid="tl-card"]')].map((c) => c.getAttribute("data-track")));
    expect([...tracks]).toEqual(["parables"]);
    expect(screen.getByTestId("track-status")).toHaveTextContent("Showing 1 of 6 tracks.");
  });

  test("no track selected: a clear message, not an empty page", () => {
    render(<CompleteTimeline locale="en" items={fixtureEvents()} counts={fixtureCounts()} selected={[]} />);
    expect(screen.getByTestId("none-shown")).toBeInTheDocument();
  });

  test("the chips are a labelled group of checkboxes: toggling one writes the selection to the URL", () => {
    replace.mockClear();
    render(<CompleteTimeline locale="en" items={fixtureEvents()} counts={fixtureCounts()} selected={[...TRACK_IDS]} />);
    const group = screen.getByRole("group", { name: "Tracks" });
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes).toHaveLength(6);
    expect(boxes.every((b) => (b as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(within(group).getByRole("checkbox", { name: /Parables/ }));
    expect(replace).toHaveBeenLastCalledWith("/timeline?view=complete&tracks=prophets,people,communities,events,seerah", { scroll: false });
    fireEvent.click(screen.getByRole("link", { name: "Clear" }));
    expect(replace).toHaveBeenLastCalledWith("/timeline?view=complete&tracks=-", { scroll: false });
    fireEvent.click(screen.getByRole("link", { name: "All tracks" }));
    expect(replace).toHaveBeenLastCalledWith("/timeline?view=complete", { scroll: false });
  });

  test("the view switch marks the current view", () => {
    const { rerender } = render(<ViewSwitch locale="en" view="journey" />);
    expect(screen.getByRole("link", { name: "The Journey (guided)" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "The Complete Timeline" })).not.toHaveAttribute("aria-current");
    rerender(<ViewSwitch locale="en" view="complete" />);
    expect(screen.getByRole("link", { name: "The Complete Timeline" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "The Complete Timeline" })).toHaveAttribute("href", "/timeline?view=complete");
  });

  test("Arabic and Urdu render, flagged as draft translations, with the English text for anything not yet translated", () => {
    expect(timelineStrings("ar").view.complete).toBe("الخط الزمني الكامل");
    expect(timelineStrings("ur").tracks.parables.name).toBe("امثال");
    expect(timelineStrings("ar").lanes.not_established.note).toBe(timeline.en.lanes.not_established.note);
    render(<CompleteTimeline locale="ar" items={[]} counts={null} selected={[...TRACK_IDS]} />);
    expect(screen.getByText(timeline.ar.draft!)).toBeInTheDocument();
  });
});
