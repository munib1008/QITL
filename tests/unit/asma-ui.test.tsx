import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Gallery } from "@/components/asma/Gallery";
import { Learn, type StudyName } from "@/components/asma/Learn";
import { AiDraftBanner, MeasureCards, Unavailable } from "@/components/asma/Parts";
import { DuaComposer } from "@/components/asma/DuaComposer";
import { emptyState, INTERVAL_DAYS, isDue, makeQuiz, newCard, parseState, queue, review, STUDY_KEY } from "@/lib/asma/learn";
import { highlightWord, matchesName, parseVerseQuery, sortAndFilter, type CountSummary, type NameListItem } from "@/lib/asma/model";
import { asmaRaw, asmaStrings } from "@/lib/i18n/modules/asma";
import { checkAsmaText } from "@/lib/asma/text-validator";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const summary = (a: number): CountSummary => ({
  methodology: "fx",
  normalisation: "asma-norm-v1",
  tokenisation: "asma-tok-v1",
  queryVersion: "asma-query-v1",
  edition: { source: "Fixture", version: "1", sha256: "a".repeat(64), contentSha256: "b".repeat(64) },
  measures: { A: { count: a, verses: a, queryHash: "c".repeat(64), stale: false }, B: { count: 0, verses: 0, queryHash: "d".repeat(64), stale: false }, C: { count: 2, verses: 2, queryHash: "e".repeat(64), stale: false } },
});
const name = (slug: string, ar: string, tr: string, en: string, a: number): NameListItem => ({
  slug, ar, vowelled: ar, transliteration: tr, rendering: { en, ar: "معنى", ur: "مفہوم" }, root: "غ-ف-ر", recognition_status: "educational_list",
  recognition_basis: "Educational list - enumeration not established by this platform", scholarly_status: "not_reviewed", ai_generated: true, published: false,
  needs_rereview: false, updated_at: "2026-01-01", summary: summary(a),
});
const NAMES = [name("al-ghafur", "الغفور", "Al-Ghafur", "The Oft-Forgiving", 11), name("ar-rahim", "الرحيم", "Ar-Rahim", "The Especially Merciful", 34), name("al-mudhill", "المذل", "Al-Mudhill", "The Humbler", 0)];

describe("search and ordering (pure)", () => {
  test("Arabic matches with or without marks and the article; Latin ignores hyphens and apostrophes; meanings and roots match", () => {
    const n = NAMES[0]!;
    expect(matchesName(n, "غفور")).toBe(true);
    expect(matchesName(n, "ٱلْغَفُورُ")).toBe(true);
    expect(matchesName(n, "al ghafur")).toBe(true);
    expect(matchesName(n, "GHAFUR")).toBe(true);
    expect(matchesName(n, "forgiving")).toBe(true);
    expect(matchesName(n, "غ-ف-ر")).toBe(true);
    expect(matchesName(n, "rahim")).toBe(false);
    expect(matchesName(n, "")).toBe(true);
  });
  test("verse queries parse in Latin, Arabic-Indic and Persian digits and reject nonsense", () => {
    expect(parseVerseQuery("2:255")).toEqual({ surah: 2, ayah: 255 });
    expect(parseVerseQuery("Q 112.1")).toEqual({ surah: 112, ayah: 1 });
    expect(parseVerseQuery("٢:٢٥٥")).toEqual({ surah: 2, ayah: 255 });
    expect(parseVerseQuery("۲:۲۵۵")).toEqual({ surah: 2, ayah: 255 });
    expect(parseVerseQuery("115:1")).toBeNull();
    expect(parseVerseQuery("rahim")).toBeNull();
  });
  test("filters and sorts by the exact-form count without ever summing measures", () => {
    const base = { query: "", sort: "order" as const, filter: "all" as const };
    expect(sortAndFilter(NAMES, { ...base, filter: "noExact" }).map((n) => n.slug)).toEqual(["al-mudhill"]);
    expect(sortAndFilter(NAMES, { ...base, filter: "withExact" }).map((n) => n.slug)).toEqual(["al-ghafur", "ar-rahim"]);
    expect(sortAndFilter(NAMES, { ...base, sort: "exact" }).map((n) => n.slug)).toEqual(["ar-rahim", "al-ghafur", "al-mudhill"]);
    expect(sortAndFilter(NAMES, { ...base, verseSlugs: new Set(["ar-rahim"]) }).map((n) => n.slug)).toEqual(["ar-rahim"]);
  });
  test("the highlighted word is the engine's token: words only, the basmala prefix skipped", () => {
    const verse = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ قُلْ هُوَ ٱللَّهُ أَحَدٌ";
    const parts = highlightWord(112, 1, verse, 1);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["قُلْ"]);
    expect(highlightWord(112, 1, verse, 4).filter((p) => p.hit).map((p) => p.text)).toEqual(["أَحَدٌ"]);
    expect(highlightWord(1, 1, "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", 2).filter((p) => p.hit).map((p) => p.text)).toEqual(["ٱللَّهِ"]);
  });
});

describe("spaced repetition and quiz (pure)", () => {
  test("a correct answer moves the card up a box and schedules it; a miss returns it to box 0 within minutes", () => {
    const t0 = 1_000_000_000_000;
    let c = newCard("al-ghafur");
    expect(isDue(c, t0)).toBe(false);
    c = review(c, true, t0);
    expect(c).toMatchObject({ box: 1, seen: 1, recalled: 1, due: t0 + INTERVAL_DAYS[1] * 86_400_000 });
    c = review(c, true, t0);
    expect(c.box).toBe(2);
    c = review(c, false, t0);
    expect(c).toMatchObject({ box: 0, seen: 3, recalled: 2 });
    expect(c.due! - t0).toBeLessThan(3_600_000);
    for (let i = 0; i < 9; i++) c = review(c, true, t0);
    expect(c.box).toBe(INTERVAL_DAYS.length - 1);
  });
  test("the queue lists what is due, oldest first, and what is new", () => {
    const t0 = 1_000_000_000_000;
    const cards = { a: { ...newCard("a"), due: t0 - 2000 }, b: { ...newCard("b"), due: t0 - 5000 }, c: { ...newCard("c"), due: t0 + 9999 } };
    expect(queue(cards, ["a", "b", "c", "d"], t0)).toEqual({ due: ["b", "a"], fresh: ["d"] });
  });
  test("a quiz is reproducible from its seed, has one right answer among distinct options, and skips Names without a meaning", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ slug: `n-${i}`, meaning: `meaning ${i}` })).concat([{ slug: "blank", meaning: "  " }]);
    const a = makeQuiz(items, 42, 8);
    expect(makeQuiz(items, 42, 8)).toEqual(a);
    expect(makeQuiz(items, 43, 8)).not.toEqual(a);
    expect(a).toHaveLength(8);
    for (const q of a) {
      expect(q.options).toContain(q.slug);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).not.toContain("blank");
    }
    expect(makeQuiz([], 1, 5)).toEqual([]);
  });
  test("stored study data is read defensively and holds no reward fields", () => {
    expect(parseState("not json")).toEqual(emptyState());
    const s = parseState(JSON.stringify({ v: 1, cards: { "al-ghafur": { box: 3, due: 5, seen: 4, recalled: 9 }, bad: { box: 99 }, "Bad Slug": { box: 1 } }, saved: ["al-ghafur", 7, "X y"], notes: { "al-ghafur": "n".repeat(5000), "x y": "no" } }));
    expect(Object.keys(s.cards)).toEqual(["al-ghafur"]);
    expect(s.cards["al-ghafur"]!.recalled).toBe(4);
    expect(s.saved).toEqual(["al-ghafur"]);
    expect(s.notes["al-ghafur"]).toHaveLength(2000);
    expect(JSON.stringify(emptyState())).not.toMatch(/point|score|reward|hasanat|streak/i);
  });
});

describe("strings: Arabic and Urdu have exactly the English keys, and the English passes the content guard", () => {
  const leaves = (o: unknown, p = ""): Array<[string, string]> =>
    typeof o === "string" ? [[p, o]] : typeof o === "function" ? [[`${p}()`, String((o as (...a: number[]) => unknown)(3, 7))]] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k)) : [];
  test.each(["ar", "ur"] as const)("%s covers every English key and differs from English", (l) => {
    const en = new Map(leaves(asmaRaw.en));
    const other = new Map(leaves(asmaRaw[l]));
    expect([...en.keys()].filter((k) => !other.has(k))).toEqual([]);
    expect([...other.keys()].filter((k) => !en.has(k))).toEqual([]);
    const same = [...en].filter(([k, v]) => other.get(k) === v && /[a-z]{4}/.test(v)).map(([k]) => k);
    expect(same).toEqual([]);
  });
  test("no interface string promises acceptance, fixes a count, names a special time or limits the Names to a number", () => {
    for (const l of ["en", "ar", "ur"] as const) for (const [k, v] of leaves(asmaRaw[l])) expect({ l, k, v: checkAsmaText(v) }).toEqual({ l, k, v: [] });
  });
  test("the AI-draft label is the required wording in all three languages", () => {
    expect(asmaStrings("en").aiDraft.badge).toBe("AI Draft — Under Review");
    expect(asmaStrings("ar").aiDraft.badge).toMatch(/قيد المراجعة/);
    expect(asmaStrings("ur").aiDraft.badge).toMatch(/زیرِ جائزہ/);
  });
});

describe("components", () => {
  test("MeasureCards shows A, B and C separately, no total, and says so when nothing is computed", () => {
    const { rerender } = render(<MeasureCards locale="en" summary={summary(11)} />);
    expect(screen.getByTestId("measure-A").textContent).toContain("11");
    expect(screen.getByTestId("measure-B").textContent).toMatch(/None found/);
    expect(screen.getByTestId("measure-C").textContent).toContain("2");
    expect(screen.getByTestId("measures").textContent).not.toMatch(/13|total/i);
    rerender(<MeasureCards locale="en" summary={null} />);
    expect(screen.getByTestId("measure-A").textContent).toContain("Not computed yet");
  });
  test("the AI-draft banner and an unavailable block render in Arabic and Urdu", () => {
    const { unmount } = render(<AiDraftBanner locale="ar" />);
    expect(screen.getByTestId("ai-draft-banner").textContent).toContain("قيد المراجعة");
    unmount();
    render(<Unavailable locale="ur" />);
    expect(screen.getByTestId("unavailable").textContent).toContain("دستیاب نہیں");
  });
  test("the gallery filters as you type and offers a way back from an empty result", () => {
    render(<Gallery names={NAMES} locale="en" />);
    expect(screen.getByTestId("names-grid").querySelectorAll("li")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Search the Names"), { target: { value: "rahim" } });
    expect(screen.getByTestId("names-grid").querySelectorAll("li")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Search the Names"), { target: { value: "zzzz" } });
    expect(screen.queryByTestId("names-grid")).toBeNull();
    fireEvent.click(screen.getByText("Clear search"));
    expect(screen.getByTestId("names-grid").querySelectorAll("li")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "noExact" } });
    expect(screen.getByTestId("names-grid").querySelectorAll("li")).toHaveLength(1);
  });
  const STUDY: StudyName[] = NAMES.map((n) => ({ slug: n.slug, ar: n.vowelled, transliteration: n.transliteration, meaning: n.rendering.en! }));
  test("the studio schedules a card, stores progress on the device only and can erase it", async () => {
    render(<Learn names={STUDY} locale="en" />);
    expect(await screen.findByTestId("flashcard")).toBeTruthy();
    fireEvent.click(screen.getByText("Show the answer"));
    fireEvent.click(screen.getByText("I remembered"));
    const stored = JSON.parse(localStorage.getItem(STUDY_KEY)!);
    expect(Object.values(stored.cards)).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toMatch(/point|score|reward/i);
    fireEvent.click(screen.getByText("Erase my study data on this device"));
    expect(JSON.parse(localStorage.getItem(STUDY_KEY)!).cards).toEqual({});
  });
  test("the quiz asks eight questions at most, marks the answer and reports a count of correct answers", async () => {
    render(<Learn names={STUDY} locale="en" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Quiz" }));
    fireEvent.click(screen.getByText("Start a quiz"));
    for (let i = 0; i < 3; i++) {
      const q = screen.getByTestId("quiz");
      fireEvent.click(q.querySelectorAll("button.as-option")[0]!);
      fireEvent.click(screen.getByText(i === 2 ? "Next question" : "Next question"));
    }
    expect(screen.getByTestId("quiz-result").textContent).toMatch(/of 3 correct/);
  });
  test("the dua composer keeps the words on the device and always carries the personal-wording label", () => {
    render(<DuaComposer locale="en" />);
    expect(screen.getByTestId("composer-stamp").textContent).toBe("Your own words — not a quoted Quranic verse or Prophetic dua");
    fireEvent.change(screen.getByLabelText("Your words"), { target: { value: "my own words" } });
    fireEvent.click(screen.getByText("Save on this device"));
    expect(localStorage.getItem("qitl.asma.dua.v1")).toBe("my own words");
    fireEvent.click(screen.getByText("Clear"));
    expect(localStorage.getItem("qitl.asma.dua.v1")).toBeNull();
  });
  test("in Arabic and Urdu the gallery and composer are fully localised and keep the Arabic name right-to-left", () => {
    const { unmount } = render(<Gallery names={NAMES} locale="ar" />);
    expect(screen.getByLabelText("ابحث في الأسماء")).toBeTruthy();
    expect(document.querySelector('.as-ar[dir="rtl"][lang="ar"]')).toBeTruthy();
    unmount();
    render(<DuaComposer locale="ur" />);
    expect(screen.getByTestId("composer-stamp").textContent).toContain("آپ کے اپنے الفاظ");
  });
});
