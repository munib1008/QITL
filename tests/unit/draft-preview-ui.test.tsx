import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// The page shell reads the site config and the session; the preview pages are tested without it.
vi.mock("@/components/shell/ReadingPage", () => ({
  ReadingPage: ({ title, lead, children }: { title?: ReactNode; lead?: ReactNode; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      <p>{lead}</p>
      {children}
    </main>
  ),
}));
const route = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: route.locale }), usePathname: () => "/drafts", notFound: () => { throw new Error("NOT_FOUND"); } }));

import DraftsIndex, { generateMetadata as listMeta } from "@/app/[locale]/drafts/page";
import DraftPage, { generateMetadata as storyMeta } from "@/app/[locale]/drafts/[slug]/page";
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import { SUBJECT_TYPES } from "@/lib/stories/draft-preview";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";

const t = draftPreviewStrings("en");
const params = (slug: string, locale = "en") => Promise.resolve({ locale, slug });

beforeEach(() => {
  route.locale = "en";
  window.history.replaceState(null, "", "/drafts/yusuf");
});

async function story(slug: string, mode?: string, locale = "en") {
  route.locale = locale;
  return render(await DraftPage({ params: params(slug, locale), searchParams: Promise.resolve({ mode }) }));
}

describe("every draft page carries the banner and the pending status", () => {
  test("the list", async () => {
    render(await DraftsIndex({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) }));
    const b = screen.getByTestId("draft-banner");
    expect(b).toHaveTextContent(t.bannerLead);
    expect(b).toHaveTextContent(t.bannerBody);
    expect(within(b).getByTestId("review-pending")).toHaveTextContent("Review: pending");
    expect(within(b).queryByRole("button")).toBeNull(); // not dismissible
    // grouped by type with counts
    for (const ty of SUBJECT_TYPES) expect(screen.getByTestId("draft-filters").querySelector(`[data-type="${ty}"]`)).toBeTruthy();
    expect(screen.getAllByTestId("draft-card")).toHaveLength(DRAFT_INDEX.stories.length);
  });

  test("the list filters by ?type= and by ?q=", async () => {
    const prophet = DRAFT_INDEX.stories.filter((s) => s.type === "prophet").length;
    const { unmount } = render(await DraftsIndex({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ type: "prophet" }) }));
    expect(screen.getAllByTestId("draft-card")).toHaveLength(prophet);
    unmount();
    render(await DraftsIndex({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ type: "event" }) }));
    expect(screen.queryAllByTestId("draft-card")).toHaveLength(DRAFT_INDEX.stories.filter((s) => s.type === "event").length);
    expect(screen.getByTestId("draft-banner")).toBeInTheDocument();
  });

  test("a search with no match still shows the banner and says so", async () => {
    render(await DraftsIndex({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ q: "zzzzqq" }) }));
    expect(screen.getByTestId("draft-banner")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toHaveTextContent(t.none);
  });

  test.each(DRAFT_INDEX.stories.map((s) => [s.slug, s.type]))("%s (%s)", async (slug) => {
    await story(slug!);
    expect(screen.getAllByTestId("draft-banner")).toHaveLength(1);
    expect(screen.getByTestId("draft-banner")).toHaveTextContent(t.bannerBody);
    expect(screen.getByTestId("review-status")).toHaveTextContent("Pending");
    expect(screen.getByTestId("pre-review")).toHaveTextContent(t.preTitle);
    expect(screen.getByTestId("scholar-checklist").querySelectorAll("li")).toHaveLength(12);
    // nothing in the page says a person or a date approved it
    expect((document.body.textContent ?? "").replace(t.bannerBody, "")).not.toMatch(/approved by|reviewed by|signed off|reviewer:/i);
  });

  test("an unknown slug is a 404", async () => {
    await expect(DraftPage({ params: params("nobody"), searchParams: Promise.resolve({}) })).rejects.toThrow();
  });
});

describe("the story page", () => {
  test("chapters have anchors; each cites its ayat with links that light the verse, and the Arabic verbatim", async () => {
    const yusuf = DRAFT_INDEX.stories.find((s) => s.slug === "yusuf")!;
    await story("yusuf");
    const chapters = screen.getAllByTestId("draft-chapter");
    expect(chapters.map((c) => c.id)).toEqual(yusuf.chapters.map((c) => `chapter-${c.anchor}`));
    const first = chapters[0]!;
    const r = yusuf.chapters[0]!.verses[0]!;
    const hash = r.to > r.from ? `#ayah-${r.from}-${r.to}` : `#ayah-${r.from}`;
    const cited = within(first).getByTestId("cited-ayat");
    expect(cited.querySelector(`a[href="/quran/${r.surah}${hash}"]`)).toBeTruthy();
    const ar = cited.querySelectorAll("p.zq-ar-quran");
    expect(ar.length).toBeGreaterThan(0);
    expect(ar[0]!.textContent).toBe(DRAFT_INDEX.quran[`${r.surah}:${r.from}`]);
    expect(ar[0]).toHaveAttribute("lang", "ar");
    expect(ar[0]).toHaveAttribute("dir", "rtl");
    // the attribution appears once
    expect(document.querySelectorAll("[data-quran-attribution]")).toHaveLength(1);
  });

  test("claim markers are links to the claim, which sits in a collapsible 'Evidence for this chapter'", async () => {
    await story("yusuf");
    const first = screen.getAllByTestId("draft-chapter")[0]!;
    const text = first.querySelector(".dp-text")!;
    expect(text.textContent).not.toMatch(/\[c\d+\]/);
    const link = text.querySelector('a[href^="#claim-"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    const target = document.getElementById(link.getAttribute("href")!.slice(1))!;
    expect(target).toBeTruthy();
    expect(first.contains(target)).toBe(true);
    const panel = within(first).getByTestId("chapter-evidence") as HTMLDetailsElement;
    expect(panel.open).toBe(false);
    expect(panel.contains(target)).toBe(true);
    expect(panel.querySelector("summary")).toHaveTextContent(/Evidence for this chapter \(\d+\)/);
  });

  test("the mode switch changes the text, keeps ?mode=, and answers the arrow keys", async () => {
    await story("yusuf");
    const first = () => screen.getAllByTestId("draft-chapter")[0]!;
    const before = first().querySelector(".dp-text")!.textContent;
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios.find((r) => r.getAttribute("aria-checked") === "true")).toHaveAttribute("data-mode", "complete");
    fireEvent.click(screen.getByRole("radio", { name: "One-minute summary" }));
    expect(window.location.search).toContain("mode=summary");
    expect(first().querySelector(".dp-text")!.textContent).not.toBe(before);
    fireEvent.click(screen.getByRole("radio", { name: "Life lessons" }));
    expect(first().textContent).toContain(t.lessonsLabel);
    const checked = screen.getByRole("radio", { checked: true });
    fireEvent.keyDown(checked, { key: "Home" });
    expect(screen.getByRole("radio", { checked: true })).toHaveAttribute("data-mode", "summary");
  });

  test("the server's mode (?mode=kids) is honoured", async () => {
    await story("yusuf", "kids");
    expect(screen.getByRole("radio", { checked: true })).toHaveAttribute("data-mode", "kids");
  });

  test("story-level open points and what the sources do not establish are shown", async () => {
    await story("adam");
    expect(screen.getByTestId("open-points")).toHaveTextContent(t.uncertainties);
    expect(screen.getAllByText(t.unknowns).length).toBeGreaterThan(0);
  });

  test("Arabic and Urdu pages: localised chrome, English story text marked lang=en", async () => {
    for (const l of ["ar", "ur"]) {
      const { unmount } = await story("yusuf", undefined, l);
      const tl = draftPreviewStrings(l);
      expect(screen.getByTestId("draft-banner")).toHaveTextContent(tl.bannerBody);
      const first = screen.getAllByTestId("draft-chapter")[0]!;
      const textBox = first.querySelector(".dp-text")!;
      expect(textBox).toHaveAttribute("lang", "en");
      expect(textBox).toHaveAttribute("dir", "ltr");
      unmount();
    }
  });
});

describe("metadata", () => {
  test("list and every story: title says Draft, robots noindex,nofollow", async () => {
    const l = await listMeta({ params: Promise.resolve({ locale: "en" }) });
    expect(String(l.title)).toContain("Draft");
    expect(l.robots).toMatchObject({ index: false, follow: false });
    for (const s of DRAFT_INDEX.stories) {
      const m = await storyMeta({ params: params(s.slug) });
      expect(String(m.title)).toMatch(/Draft/);
      expect(m.description).toMatch(/Draft/);
      expect(m.robots).toMatchObject({ index: false, follow: false });
    }
    for (const loc of ["ar", "ur"]) {
      const m = await storyMeta({ params: params("yusuf", loc) });
      expect(m.robots).toMatchObject({ index: false, follow: false });
    }
  });
});
