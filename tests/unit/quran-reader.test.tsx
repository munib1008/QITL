/**
 * Quran reader: jump parsing, surah search, reading divisions, copy/share text, local progress, the long-surah chunking
 * and the Dream page's range links. Component tests use FIXTURE strings, never Quran text; the one check against the
 * imported text only compares the served string with itself (verbatim pass-through).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  PROGRESS_KEY,
  arabicKey,
  attributionLine,
  ayahAtLine,
  ayahShareText,
  divisionOf,
  latinKey,
  markersForSurah,
  parseJump,
  parseProgress,
  readLocalProgress,
  recordProgress,
  saveLocalProgress,
  searchSurahs,
  type QuranDivisions,
  type SurahIndexEntry,
} from "@/lib/quran-reader";
import { parseTanzilStructure, tanzilMetadataLicense, STRUCTURE_COUNTS } from "@/lib/importers/quran";
import { ImportRefused } from "@/lib/importers/common";
import { QURAN_DREAM_REFERENCES, quranRefHref } from "@/lib/dreams";
import { quranReaderStrings } from "@/lib/i18n/modules/quranReader";

vi.mock("server-only", () => ({}));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/quran/2",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/account/BookmarkButton", () => ({ BookmarkButton: () => <button type="button">Bookmark live</button> }));

const root = join(__dirname, "..", "..");
const surahs: SurahIndexEntry[] = JSON.parse(readFileSync(join(root, "content/quran/surahs.json"), "utf8"));
const structure: QuranDivisions & { license: string } = JSON.parse(readFileSync(join(root, "content/quran/structure.json"), "utf8"));
const counts = surahs.map((s) => s.ayahs);

describe("jump to an ayah", () => {
  test("accepts the usual forms, Arabic-Indic digits included", () => {
    expect(parseJump("2:255", counts)).toEqual({ surah: 2, ayah: 255 });
    expect(parseJump("Q 2:255", counts)).toEqual({ surah: 2, ayah: 255 });
    expect(parseJump(" 2 255 ", counts)).toEqual({ surah: 2, ayah: 255 });
    expect(parseJump("36", counts)).toEqual({ surah: 36, ayah: 1 });
    expect(parseJump("٢:٢٥٥", counts)).toEqual({ surah: 2, ayah: 255 });
    expect(parseJump("۱۲:۴", counts)).toEqual({ surah: 12, ayah: 4 });
  });
  test("refuses what does not exist", () => {
    expect(parseJump("", counts)).toEqual({ error: "empty" });
    expect(parseJump("baqara", counts)).toEqual({ error: "format" });
    expect(parseJump("115:1", counts)).toEqual({ error: "surah" });
    expect(parseJump("1:8", counts)).toEqual({ error: "ayah" });
    expect(parseJump("2:0", counts)).toEqual({ error: "ayah" });
  });
});

describe("surah search", () => {
  const first = (q: string) => searchSurahs(surahs, q)[0]?.number;
  test("transliteration, forgiving of spelling", () => {
    expect(first("baqara")).toBe(2);
    expect(first("Al-Baqarah")).toBe(2);
    expect(first("fatiha")).toBe(1);
    expect(first("yusuf")).toBe(12);
    expect(first("imran")).toBe(3);
    expect(first("kahf")).toBe(18);
  });
  test("English and Arabic names, with or without the article or diacritics", () => {
    expect(first("The Cow")).toBe(2);
    expect(first("cave")).toBe(18);
    expect(first("البقرة")).toBe(2);
    expect(first("بقرة")).toBe(2);
    expect(first("يوسف")).toBe(12);
    expect(arabicKey("إِبْرَاهِيمَ")).toBe(arabicKey("ابراهيم"));
  });
  test("numbers: the exact surah first, then prefixes", () => {
    expect(searchSurahs(surahs, "11").map((s) => s.number).slice(0, 3)).toEqual([11, 110, 111]);
    expect(searchSurahs(surahs, "114").map((s) => s.number)).toEqual([114]);
  });
  test("an empty query lists all 114; nonsense lists none", () => {
    expect(searchSurahs(surahs, "  ")).toHaveLength(114);
    expect(searchSurahs(surahs, "zzzzqqq")).toHaveLength(0);
    expect(latinKey("Yaseen")).toBe(latinKey("yasin"));
  });
});

describe("reading divisions (Tanzil quran-data.js)", () => {
  test("the imported file names its CC BY 3.0 licence and has 30 juz, 240 quarters, 604 pages", () => {
    expect(structure.license).toBe("Creative Commons Attribution 3.0");
    expect(structure.juz).toHaveLength(STRUCTURE_COUNTS.juz);
    expect(structure.hizbQuarters).toHaveLength(STRUCTURE_COUNTS.hizbQuarters);
    expect(structure.pages).toHaveLength(STRUCTURE_COUNTS.pages);
    for (const list of [structure.juz, structure.hizbQuarters, structure.pages])
      for (const [s, a] of list) expect(a).toBeLessThanOrEqual(counts[s - 1]!);
  });
  test("markers inside Al-Baqara", () => {
    const m = markersForSurah(structure, 2);
    expect(m[1]).toEqual({ page: 2 });
    expect(m[142]?.juz).toBe(2);
    expect(m[253]?.juz).toBe(3);
    expect(m[26]?.hizb).toEqual({ hizb: 1, quarter: 2 });
    expect(divisionOf(structure.juz, 2, 141)).toBe(1);
    expect(divisionOf(structure.juz, 2, 142)).toBe(2);
    expect(divisionOf(structure.juz, 114, 6)).toBe(30);
    expect(divisionOf(structure.pages, 114, 1)).toBe(604);
  });
  const js = (license: string, juz = "[1, 1]") => `// Quran Metadata (ver 1.0)
// Copyright (C) 2008-2009 Tanzil.info
// License: ${license}
QuranData.Juz = [ [], ${juz}, ${Array.from({ length: 29 }, (_, i) => `[${i + 2}, 1]`).join(", ")}, [115, 1] ];
QuranData.HizbQaurter = [ [], [1, 1], ${Array.from({ length: 239 }, (_, i) => `[${Math.floor(i / 3) + 2}, ${(i % 3) + 1}]`).join(", ")}, [115, 1] ];
QuranData.Page = [ [], [1, 1], ${Array.from({ length: 603 }, (_, i) => `[${Math.floor(i / 6) + 2}, ${(i % 6) + 1}]`).join(", ")}, [115, 1] ];`;
  test("the parser refuses a file without the same licence, and out-of-order data", () => {
    expect(tanzilMetadataLicense(js("Creative Commons Attribution 3.0"))).toBe("Creative Commons Attribution 3.0");
    expect(parseTanzilStructure(js("Creative Commons Attribution 3.0")).juz).toHaveLength(30);
    expect(() => parseTanzilStructure(js("All rights reserved"))).toThrow(ImportRefused);
    expect(() => parseTanzilStructure(js("Creative Commons Attribution 3.0", "[3, 1]"))).toThrow(/reading order|1:1/);
  });
});

describe("copy and share text", () => {
  const src = { source: "Tanzil Quran Text (Uthmani)", version: "Uthmani 1.1", url: "https://tanzil.net/" };
  test("the Arabic is passed through exactly, then the reference, attribution and link", () => {
    const arabic = "FIXTURE-AR َٰ text  with  spacing ";
    const out = ayahShareText({ arabic, surah: 2, ayah: 255, surahName: "Al-Baqara", attribution: attributionLine(src), url: "https://qitl.example/quran/2#ayah-255" });
    const lines = out.split("\n");
    expect(lines[0]).toBe(arabic);
    expect(lines[1]).toBe("Q 2:255 (Al-Baqara)");
    expect(lines[2]).toBe("Arabic text: Tanzil Quran Text (Uthmani), version 1.1, Tanzil Project (https://tanzil.net), CC BY 3.0, reproduced verbatim.");
    expect(lines[3]).toBe("https://qitl.example/quran/2#ayah-255");
    expect(ayahShareText({ arabic, surah: 2, ayah: 255, attribution: "A" }).split("\n")).toEqual([arabic, "Q 2:255", "A"]);
  });
  test("the imported ayah string survives the round trip byte for byte", () => {
    const line = readFileSync(join(root, "content/quran/quran.txt"), "utf8").split("\n").find((l) => l.startsWith("2|255|"))!;
    const text = line.slice("2|255|".length).replace(/\r$/, "");
    expect(ayahShareText({ arabic: text, surah: 2, ayah: 255, attribution: "A" }).startsWith(`${text}\nQ 2:255`)).toBe(true);
  });
});

describe("reading progress on this device", () => {
  beforeEach(() => localStorage.clear());
  test("records the last place overall and per surah", () => {
    saveLocalProgress(2, 100);
    saveLocalProgress(18, 10);
    const p = readLocalProgress();
    expect(p.last).toMatchObject({ surah: 18, ayah: 10 });
    expect(p.surahs["2"]).toMatchObject({ surah: 2, ayah: 100 });
    expect(recordProgress(p, 2, 120).surahs["2"]!.ayah).toBe(120);
  });
  test("malformed or tampered storage is dropped, not trusted", () => {
    expect(parseProgress("{nope")).toEqual({ last: null, surahs: {} });
    expect(parseProgress(JSON.stringify({ last: { surah: 999, ayah: 1, at: "x" }, surahs: { "2": { surah: 3, ayah: 1, at: "x" }, "4": { surah: 4, ayah: 5, at: "t" } } }))).toEqual({
      last: null,
      surahs: { "4": { surah: 4, ayah: 5, at: "t" } },
    });
    localStorage.setItem(PROGRESS_KEY, "[]");
    expect(readLocalProgress().last).toBeNull();
  });
  test("the reading line picks the first ayah still below it", () => {
    const rects = [1, 2, 3, 4].map((a) => ({ ayah: a, top: (a - 1) * 200 - 300, bottom: a * 200 - 300 }));
    expect(ayahAtLine(rects, 120)).toBe(3);
    expect(ayahAtLine(rects, -1000)).toBe(1);
    expect(ayahAtLine(rects, 10_000)).toBeNull();
  });
});

describe("Dream Understanding links use ayahHash like the rest of the site", () => {
  test("ranges light every ayah", () => {
    expect(quranRefHref({ surah: 12, from: 4, to: 6 })).toBe("/quran/12#ayah-4-6");
    expect(quranRefHref({ surah: 48, from: 27, to: 27 })).toBe("/quran/48#ayah-27");
    expect(QURAN_DREAM_REFERENCES.every((r) => quranRefHref(r).endsWith(r.from === r.to ? `#ayah-${r.from}` : `#ayah-${r.from}-${r.to}`))).toBe(true);
  });
});

describe("reader strings", () => {
  test("Arabic and Urdu drafts fall back to English for anything missing", () => {
    for (const l of ["en", "ar", "ur"]) {
      const t = quranReaderStrings(l);
      expect(t.jump.errAyah(7)).toMatch(/7/);
      expect(t.markers.hizb(3, 2)).toBe("¼ Hizb 3");
    }
    expect(quranReaderStrings("ar").progress.continue).toBe("تابع القراءة");
  });
});

/* ------------------------------------------------------------------ components (FIXTURE text only) */

class IO {
  static instances: IO[] = [];
  observed: Element[] = [];
  constructor(private cb: IntersectionObserverCallback) {
    IO.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {}
  unobserve() {}
  fire(el: Element) {
    this.cb([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

describe("components", () => {
  beforeEach(() => {
    IO.instances = [];
    vi.stubGlobal("IntersectionObserver", IO);
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView ??= function () {};
    localStorage.clear();
    window.history.replaceState(null, "", "/quran/2");
  });
  afterEach(() => vi.unstubAllGlobals());

  const verses = Array.from({ length: 45 }, (_, i) => ({ ayah: i + 1, text: `FIXTURE-AR-${i + 1}` }));
  const reader = async () => {
    const { AyahReader } = await import("@/components/quran/AyahReader");
    return render(<AyahReader surah={2} surahName="Al-Baqara" verses={verses} links={{ 3: [{ id: "adam", name: "Adam" }] }} markers={{ 1: { page: 2 }, 26: { hizb: { hizb: 1, quarter: 2 } } }} attribution="ATTRIBUTION-LINE" />);
  };

  test("every ayah has its anchor; only the first chunk mounts bookmarks until the others come near", async () => {
    await reader();
    for (const a of [1, 20, 21, 45]) expect(document.getElementById(`ayah-${a}`)).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Bookmark live" })).toHaveLength(20);
    // A far ayah keeps its Arabic, anchor and citation, without the controls until its chunk comes near.
    const far = document.getElementById("ayah-30")!;
    expect(far).toHaveAttribute("data-light");
    expect(within(far).getByText("FIXTURE-AR-30")).toBeInTheDocument();
    expect(within(far).getByRole("link", { name: "Q 2:30" })).toHaveAttribute("href", "#ayah-30");
    expect(within(far).queryByRole("button")).toBeNull();
    const el21 = document.getElementById("ayah-21")!;
    const io = IO.instances.find((x) => x.observed.includes(el21))!;
    act(() => io.fire(el21));
    expect(screen.getAllByRole("button", { name: "Bookmark live" })).toHaveLength(40);
    expect(far).not.toHaveAttribute("data-light");
    expect(within(far).getByRole("button", { name: /Copy ayah/ })).toBeInTheDocument();
    // Focus inside a far chunk mounts it too (keyboard path).
    act(() => {
      screen.getByRole("link", { name: "Q 2:45" }).focus();
    });
    expect(screen.getAllByRole("button", { name: "Bookmark live" })).toHaveLength(45);
  });

  test("reading divisions show as labelled markers", async () => {
    await reader();
    const ul = within(document.getElementById("ayah-26")!).getByRole("list", { name: "Reading divisions" });
    expect(ul).toHaveTextContent("¼ Hizb 1");
    expect(within(document.getElementById("ayah-1")!).getByText("Page 2")).toBeInTheDocument();
  });

  test("copy puts the verbatim text, the reference, the attribution and the link on the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await reader();
    await act(async () => {
      fireEvent.click(within(document.getElementById("ayah-7")!).getByRole("button", { name: /Copy ayah/ }));
    });
    expect(writeText).toHaveBeenCalledWith(`FIXTURE-AR-7\nQ 2:7 (Al-Baqara)\nATTRIBUTION-LINE\n${window.location.origin}/quran/2#ayah-7`);
    expect(within(document.getElementById("ayah-7")!).getAllByText("Copied with attribution").length).toBeGreaterThan(0);
  });

  test("a failed copy says so", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    await reader();
    await act(async () => {
      fireEvent.click(within(document.getElementById("ayah-2")!).getByRole("button", { name: /Copy ayah/ }));
    });
    expect(within(document.getElementById("ayah-2")!).getByRole("alert")).toHaveTextContent(/Copy did not work/);
  });

  test("share appears only where the Web Share API exists and shares the same text", async () => {
    const r1 = await reader();
    expect(screen.queryAllByRole("button", { name: "Share" })).toHaveLength(0);
    r1.unmount();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    await reader();
    await act(async () => {
      fireEvent.click(within(document.getElementById("ayah-3")!).getByRole("button", { name: "Share" }));
    });
    expect(share).toHaveBeenCalledWith({ title: "Q 2:3, from QITL", text: "FIXTURE-AR-3\nQ 2:3 (Al-Baqara)\nATTRIBUTION-LINE", url: `${window.location.origin}/quran/2#ayah-3` });
    delete (navigator as { share?: unknown }).share;
  });

  test("J and K move between ayat through the hash", async () => {
    await reader();
    act(() => {
      document.getElementById("ayah-5")!.focus();
    });
    fireEvent.keyDown(document.getElementById("ayah-5")!, { key: "j" });
    expect(window.location.hash).toBe("#ayah-6");
    expect(document.activeElement).toBe(document.getElementById("ayah-6"));
    fireEvent.keyDown(document.activeElement!, { key: "k" });
    expect(window.location.hash).toBe("#ayah-5");
    // Typing in a field never moves.
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "j" });
    expect(window.location.hash).toBe("#ayah-5");
    input.remove();
  });

  test("offers to resume a saved place when the link names no ayah", async () => {
    saveLocalProgress(2, 30);
    await reader();
    expect(screen.getByTestId("resume-banner")).toHaveTextContent("You were reading Q 2:30.");
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute("href", "#ayah-30");
  });

  test("surah index filters as you type and announces the count", async () => {
    const { SurahIndex } = await import("@/components/quran/SurahIndex");
    render(<SurahIndex surahs={surahs} juz={structure.juz} locale="en" />);
    expect(within(screen.getByTestId("surah-list")).getAllByRole("listitem")).toHaveLength(114);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a surah" }), { target: { value: "yusuf" } });
    const items = within(await screen.findByTestId("surah-list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Yusuf");
    expect(screen.getByRole("status")).toHaveTextContent(/surah/);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a surah" }), { target: { value: "zzzzqq" } });
    expect(await screen.findByTestId("surah-none")).toBeInTheDocument();
  });

  test("Go to an ayah validates against the surah's length and navigates", async () => {
    const { JumpToAyah } = await import("@/components/quran/JumpToAyah");
    push.mockClear();
    render(<JumpToAyah surahs={surahs.map((s) => ({ number: s.number, name: s.name, ayahs: s.ayahs }))} current={1} />);
    fireEvent.change(screen.getByLabelText("Surah"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Ayah"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This surah has 286 ayat");
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Ayah"), { target: { value: "255" } });
    fireEvent.submit(screen.getByTestId("jump-to-ayah"));
    expect(push).toHaveBeenCalledWith("/quran/2#ayah-255");
  });
});
