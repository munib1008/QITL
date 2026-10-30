/**
 * Interpretation Explorer: panel states, licence gating, the separate early-tafsir slot, differences kept apart,
 * the eight checks, the AI-draft guard and the four-collection hadith catalogue. All data here is FIXTURE data
 * (placeholders such as "FIXTURE-EN-1"), never real Quran, translation, tafsir or hadith text.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { StudyView, type StudyTarget } from "@/components/quran/StudyPanel";
import { COLLECTIONS, COLLECTION_IDS, presentedAsSahih } from "@/lib/data/hadith";
import { allChecksPassed, canSign, CHECKS, checkStatus, type ReviewRecord } from "@/lib/interpretation/checks";
import { buildDraftPrompt, checkDraft, inputsRecord, SYSTEM_PROMPT, type DraftInputs } from "@/lib/interpretation/draft";
import { attributionParts, earlyTafsirSlot, groupDifferences, slotState, tafsirSlots, translationSlots } from "@/lib/interpretation/state";
import { MAX_TRANSLATIONS, type EditionInfo, type StudyData } from "@/lib/interpretation/types";
import { interpretationStrings } from "@/lib/i18n/modules/interpretation";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/quran/1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/account/BookmarkButton", () => ({ BookmarkButton: () => <button type="button">Save</button> }));

const ed = (over: Partial<EditionInfo> = {}): EditionInfo => ({
  id: "e1",
  kind: "quran_translation",
  language: "en",
  title: "FIXTURE Edition 1",
  titleAr: null,
  translator: { name: "Fixture Translator", nameAr: null, died: null },
  year: 1999,
  edition: "2nd",
  origin: "publisher",
  registryStatus: "verified",
  reliabilityNote: null,
  historicalPeriod: null,
  position: 1,
  licence: { work: "FIXTURE work", rightsStatus: "cleared", text: "FIXTURE licence", url: "https://example.org/licence", attribution: "FIXTURE" },
  ...over,
});

describe("licence and registry gating", () => {
  test("slot state: unverified → licence pending → not imported → shown", () => {
    expect(slotState(ed({ registryStatus: "candidate" }), true)).toBe("unverified");
    expect(slotState(ed({ licence: { ...ed().licence!, rightsStatus: "requested" } }), true)).toBe("licence_pending");
    expect(slotState(ed({ licence: null }), true)).toBe("licence_pending");
    expect(slotState(ed(), false)).toBe("not_imported");
    expect(slotState(ed(), true)).toBe("shown");
    expect(slotState(ed({ licence: { ...ed().licence!, rightsStatus: "public_domain" } }), true)).toBe("shown");
  });

  test("at most ten translations, rejected and early tafsir excluded, text dropped unless shown", () => {
    const eds = Array.from({ length: 12 }, (_, i) => ed({ id: `e${i}`, title: `FIXTURE ${i}`, position: i }));
    eds.push(ed({ id: "rej", registryStatus: "rejected", position: 0 }), ed({ id: "early", kind: "early_tafsir", position: 0 }));
    eds[1] = ed({ id: "e1", title: "FIXTURE pending", position: 1, licence: { ...ed().licence!, rightsStatus: "unknown" } });
    const texts = new Map(eds.map((e) => [e.id, `FIXTURE-EN-${e.id}`]));
    const slots = translationSlots(eds, texts);
    expect(slots).toHaveLength(MAX_TRANSLATIONS);
    expect(slots.map((s) => s.edition.id)).not.toContain("rej");
    expect(slots.map((s) => s.edition.id)).not.toContain("early");
    const pending = slots.find((s) => s.edition.id === "e1")!;
    expect(pending).toMatchObject({ state: "licence_pending", text: null });
    expect(slots[0]).toMatchObject({ state: "shown", text: "FIXTURE-EN-e0" });
  });

  test("early tafsir has its own slot with flags; tafsir slots carry flags and ranges", () => {
    const early = ed({ id: "m", kind: "early_tafsir", title: "FIXTURE early tafsir", reliabilityNote: "FIXTURE reliability note" });
    const rows = [{ editionId: "m", text: "FIXTURE-TAFSIR", flags: ["israiliyyat" as const, "weak_narration" as const], reviewNote: null, from: 1, to: 2 }];
    expect(earlyTafsirSlot([early], rows)).toMatchObject({ state: "shown", text: "FIXTURE-TAFSIR", flags: ["israiliyyat", "weak_narration"] });
    expect(earlyTafsirSlot([], rows)).toMatchObject({ edition: null, state: "not_imported", text: null });
    expect(tafsirSlots([ed({ id: "t", kind: "tafsir" })], [{ ...rows[0]!, editionId: "t" }])[0]).toMatchObject({ range: { from: 1, to: 2 }, flags: ["israiliyyat", "weak_narration"] });
  });

  test("attribution always names person, edition, year and licence, with an explicit 'not recorded'", () => {
    expect(attributionParts(ed(), "Not recorded")).toEqual({ person: "Fixture Translator", edition: "FIXTURE Edition 1, 2nd", year: "1999", licence: "FIXTURE licence" });
    expect(attributionParts(ed({ translator: null, year: null, licence: null }), "Not recorded")).toMatchObject({ person: "Not recorded", year: "Not recorded", licence: "Not recorded" });
    expect(attributionParts(ed({ licence: { ...ed().licence!, rightsStatus: "requested" } }), "?").licence).toBe("requested");
  });

  test("differences are grouped by kind in a fixed order and never merged", () => {
    const d = (id: string, kind: "translation_choice" | "linguistic" | "grammatical" | "exegetical") => ({ id, kind, termAr: null, wordNo: null, summary: `FIXTURE ${id}`, recognised: kind === "exegetical", editions: [] });
    const g = groupDifferences([d("a", "exegetical"), d("b", "translation_choice"), d("c", "exegetical"), d("e", "grammatical")]);
    expect(g.map((x) => x.kind)).toEqual(["translation_choice", "grammatical", "exegetical"]);
    expect(g[2]!.items.map((x) => x.id)).toEqual(["a", "c"]);
  });
});

const target: StudyTarget = { surah: 1, ayah: 1, arabic: null, related: [{ id: "yusuf", name: "Yusuf (FIXTURE)" }] };
const data = (over: Partial<StudyData> = {}): StudyData => ({
  ref: { surah: 1, ayah: 1 },
  configured: true,
  translations: [
    { edition: ed(), state: "shown", text: "FIXTURE-EN-1" },
    { edition: ed({ id: "e2", title: "FIXTURE Edition 2", licence: { ...ed().licence!, rightsStatus: "requested" } }), state: "licence_pending", text: null },
  ],
  earlyTafsir: { edition: ed({ id: "m", kind: "early_tafsir", title: "FIXTURE Muqatil edition", reliabilityNote: "FIXTURE reliability note", licence: { ...ed().licence!, rightsStatus: "unknown" } }), state: "licence_pending", text: null, flags: ["israiliyyat", "disputed"], reviewNote: null },
  words: [],
  wordsSource: null,
  differences: [
    { id: "d1", kind: "translation_choice", termAr: null, wordNo: 2, summary: "FIXTURE choice", recognised: false, editions: ["FIXTURE Edition 1"] },
    { id: "d2", kind: "exegetical", termAr: null, wordNo: null, summary: "FIXTURE disagreement", recognised: true, editions: [] },
  ],
  tafsir: [],
  hadith: [],
  explanations: [{ id: "x", title: "FIXTURE summary", bodyMd: "FIXTURE body", origin: "ai_assisted", model: "claude-opus-5-5", promptVersion: "interp-draft-v1", version: 3, language: "en" }],
  ...over,
});
const view = (d: StudyData | null, opts: Partial<{ status: "loading" | "ready" | "error"; locale: string; t: StudyTarget }> = {}) =>
  render(<StudyView target={opts.t ?? target} data={d} status={opts.status ?? "ready"} locale={opts.locale ?? "en"} headingId="h" onClose={() => {}} />);

describe("Study panel", () => {
  test("Arabic sits first, before the tabs; the designed 'not loaded' state when it is not imported", () => {
    const { container } = view(data());
    const arabic = container.querySelector("[data-study-arabic]")!;
    const tabs = screen.getByRole("tablist");
    expect(arabic.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(arabic).toHaveTextContent("not loaded yet");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Translations", "Word by word", "Differences explained", "Tafsir comparison", "Hadith", "Stories & timeline", "QITL summary"]);
  });

  test("with verified Arabic it renders that text with lang and dir", () => {
    const { container } = view(data(), { t: { ...target, arabic: "FIXTURE-AR-1-1" } });
    const p = container.querySelector("[data-study-arabic] p")!;
    expect(p).toHaveTextContent("FIXTURE-AR-1-1");
    expect(p).toHaveAttribute("lang", "ar");
    expect(p).toHaveAttribute("dir", "rtl");
  });

  test("translations: licensed text with full attribution; licence-pending slot shows no text", () => {
    const { container } = view(data());
    const cards = container.querySelectorAll("[data-slot-state]");
    const shown = container.querySelector('li[data-slot-state="shown"]')!;
    expect(shown).toHaveTextContent("FIXTURE-EN-1");
    for (const word of ["Fixture Translator", "FIXTURE Edition 1, 2nd", "1999", "FIXTURE licence"]) expect(shown).toHaveTextContent(word);
    const pending = container.querySelector('li[data-slot-state="licence_pending"]')!;
    expect(pending).toHaveTextContent("Licence pending");
    expect(pending).toHaveTextContent("No text is shown until it is");
    expect(cards.length).toBe(3); // two translations + the early tafsir slot
  });

  test("the 11th slot is labelled commentary, not translation, with reliability note and flags", () => {
    const { container } = view(data());
    const early = container.querySelector('[data-slot="early-tafsir"]')!;
    expect(early).toHaveTextContent("Early historical tafsir");
    expect(early).toHaveTextContent("Commentary, not a translation");
    expect(early).toHaveTextContent("FIXTURE reliability note");
    expect(within(early as HTMLElement).getByText("Isra'iliyyat")).toBeInTheDocument();
    expect(within(early as HTMLElement).getByText("Disputed")).toBeInTheDocument();
    // It is not inside the translations list.
    expect(early.closest("ol")).toBeNull();
  });

  test("before an edition is registered the slot still names the work and says it is not imported", () => {
    const { container } = view(data({ earlyTafsir: { edition: null, state: "not_imported", text: null, flags: [], reviewNote: null } }));
    const early = container.querySelector('[data-slot="early-tafsir"]')!;
    expect(early).toHaveTextContent("Tafsir Muqatil ibn Sulayman");
    expect(early).toHaveTextContent("Not imported");
  });

  test("tabs switch by click and by arrow keys; differences keep their kinds; summary labels AI assistance and model", () => {
    view(data());
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[2]!);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("data-tab", "differences");
    expect(within(panel).getByRole("heading", { name: "Translation choice" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Exegetical disagreement" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Recognised scholarly disagreement");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(screen.getByRole("tabpanel")).toHaveAttribute("data-tab", "summary");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("AI-assisted draft (claude-opus-5-5)");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Version 3");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("tabpanel")).toHaveAttribute("data-tab", "translations");
  });

  test("without the database every data tab shows the 'not connected' state; related stories still work", () => {
    view({ ...data(), configured: false, translations: [], differences: [], explanations: [] });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("not connected");
    fireEvent.click(screen.getByRole("tab", { name: "Stories & timeline" }));
    expect(screen.getByRole("link", { name: /Read the story/ })).toHaveAttribute("href", "/prophets/yusuf");
    expect(screen.getByRole("link", { name: /On the timeline/ })).toHaveAttribute("href", "/timeline?selected=yusuf");
  });

  test("loading and error states", () => {
    view(null, { status: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  test("actions: Ask a Mufti is visibly not yet available, Save and Report are present; the report form opens", () => {
    view(data());
    const group = screen.getByRole("group", { name: "Study actions" });
    expect(within(group).getByText(/Ask a Mufti/)).toHaveAttribute("aria-disabled", "true");
    expect(within(group).getByRole("button", { name: "Save" })).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: "Report an error" }));
    expect(screen.getByLabelText("What is wrong?")).toBeInTheDocument();
  });

  test("Arabic interface strings exist for every key", () => {
    view(data(), { locale: "ar" });
    expect(screen.getAllByRole("tab")[0]).toHaveTextContent("الترجمات");
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v).map((x) => `${k}.${x}`) : [k]));
    expect(keys(interpretationStrings.ar).sort()).toEqual(keys(interpretationStrings.en).sort());
  });
});

describe("hadith catalogue: four collections, sahih only by grading", () => {
  test("the public catalogue is Bukhari, Muslim, Tirmidhi and Ibn Majah", () => {
    expect(COLLECTION_IDS).toEqual(["bukhari", "muslim", "tirmidhi", "ibnmajah"]);
    expect(COLLECTIONS.map((c) => c.name)).toEqual(["Sahih al-Bukhari", "Sahih Muslim", "Jami' at-Tirmidhi", "Sunan Ibn Majah"]);
    expect(COLLECTIONS.filter((c) => c.sahihCollection).map((c) => c.id)).toEqual(["bukhari", "muslim"]);
  });
  test("a Tirmidhi or Ibn Majah narration is presented as sahih only when a named grading says sahih", () => {
    expect(presentedAsSahih("tirmidhi", [])).toBe(false);
    expect(presentedAsSahih("tirmidhi", [{ grader: "Fixture Grader", grade: "hasan" }])).toBe(false);
    expect(presentedAsSahih("ibnmajah", [{ grader: "Fixture Grader", grade: "daif" }, { grader: "Other Grader", grade: "sahih" }])).toBe(true);
    expect(presentedAsSahih("ibnmajah", [{ grader: "", grade: "sahih" }])).toBe(false);
    expect(presentedAsSahih("tirmidhi", [{ grader: "Fixture Grader", grade: "hasan sahih" }])).toBe(true);
  });
});

describe("the eight checks", () => {
  test("each check is signable only by its role (admin holds all)", () => {
    expect(CHECKS).toHaveLength(8);
    expect(canSign("grammar", ["editor"])).toBe(true);
    expect(canSign("hadith_grading", ["editor"])).toBe(false);
    expect(canSign("sunni_scholarly", ["scholarly_reviewer"])).toBe(true);
    expect(canSign("language_quality", ["translation_reviewer"])).toBe(true);
    expect(canSign("licensing", ["translation_reviewer"])).toBe(false);
    expect(canSign("sunni_scholarly", ["admin"])).toBe(true);
  });
  test("latest record per check decides; a pass on an older version is stale", () => {
    const rec = (k: ReviewRecord["check_key"], passed: boolean, v: number, at: string): ReviewRecord => ({ check_key: k, passed, explanation_version: v, reviewer_id: "u", note: null, created_at: at });
    const all = CHECKS.map((c) => rec(c.key, true, 2, "2026-10-31T10:00:00Z"));
    expect(allChecksPassed(all, 2)).toBe(true);
    expect(allChecksPassed(all, 3)).toBe(false);
    const withFail = [...all, rec("grammar", false, 2, "2026-10-31T11:00:00Z")];
    expect(checkStatus(withFail, 2).find((c) => c.key === "grammar")!.state).toBe("failed");
    expect(checkStatus([], 1).every((c) => c.state === "unsigned")).toBe(true);
  });
});

describe("AI-assisted drafts", () => {
  const inp: DraftInputs = {
    ref: { surah: 1, ayahFrom: 1, ayahTo: 1 },
    language: "en",
    arabic: [{ ayah: 1, text: "FIXTURE-AR-1-1" }],
    arabicSource: { name: "FIXTURE source", version: "0", sha256: "0".repeat(64) },
    translations: [{ editionId: "e1", title: "FIXTURE Edition 1", translator: "Fixture Translator", year: 1999, licence: "FIXTURE", ayah: 1, text: "FIXTURE-EN-1" }],
    tafsir: [{ editionId: "t1", tafsirId: "tf1", title: "FIXTURE tafsir", scholar: "Fixture Scholar", flags: ["israiliyyat"], ayahFrom: 1, ayahTo: 1, text: "FIXTURE-TAFSIR" }],
    words: [],
  };
  test("the prompt carries only the given sources and forbids translating or averaging", () => {
    const p = buildDraftPrompt(inp);
    expect(p).toContain('edition="FIXTURE Edition 1" translator="Fixture Translator" year="1999"');
    expect(p).toContain('flags="israiliyyat"');
    expect(p).toContain("FIXTURE-AR-1-1");
    expect(SYSTEM_PROMPT).toMatch(/never a translation/);
    expect(SYSTEM_PROMPT).toMatch(/averaged/);
    expect(inputsRecord(inp)).toMatchObject({ edition_ids: ["e1"], tafsir_edition_ids: ["t1"], tafsir_ids: ["tf1"] });
  });
  test("output presenting an averaged or 'most accurate' translation is refused", () => {
    expect(checkDraft("# Title\n\nHere is the most accurate translation of the verse, merged from all sources.")).toMatchObject({ ok: false });
    expect(checkDraft("# Title\n\nAn averaged English translation follows.")).toMatchObject({ ok: false });
    expect(checkDraft("short")).toMatchObject({ ok: false });
    expect(checkDraft("# FIXTURE title\n\nThe two editions render the word differently: one by its root sense, one by context.")).toMatchObject({ ok: true, title: "FIXTURE title" });
  });
});
