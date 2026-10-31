import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AnswerCreate, AskInput, CitationInput, ReviewInput, VerifyInput, citationDisplay, citationRow } from "@/lib/mufti";
import {
  DREAM_NOTICE_VERSION,
  DreamAdminAction,
  DreamPatch,
  DreamPrefsInput,
  DreamResponsePatch,
  DreamSubmit,
  HADITH_DREAM_REFERENCES,
  QURAN_DREAM_REFERENCES,
  quranRefHref,
  quranRefLabel,
} from "@/lib/dreams";
import { muftiStrings } from "@/lib/i18n/modules/mufti";
import { dreamStrings } from "@/lib/i18n/modules/dreams";
import { DreamRequestForm } from "@/components/dreams/DreamRequestForm";
import { CitationList } from "@/components/mufti/ui";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

/** Same keys, same nesting, in both languages; every Arabic string is filled. */
function shape(v: unknown, path = ""): string[] {
  if (typeof v === "function") return [`${path}()`];
  if (Array.isArray(v)) return [`${path}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${path}[${i}]`))];
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  return [path];
}
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("module i18n", () => {
  test.each([
    ["mufti", muftiStrings],
    ["dreams", dreamStrings],
  ] as const)("%s: en and ar have the same keys and no empty Arabic string", (_, d) => {
    expect(shape(d.ar)).toEqual(shape(d.en));
    for (const s of strings(d.ar)) expect(s.trim().length).toBeGreaterThan(0);
  });

  test("the dream guide never claims to interpret and names medical help", () => {
    const en = dreamStrings.en;
    expect(en.guide.supportBody).toMatch(/doctor or a mental-health professional/);
    expect(en.fallibility).toMatch(/may be mistaken/);
    expect(en.outcomes).toHaveProperty("meaning_unknown");
    expect(en.outcomes).toHaveProperty("insufficient_basis");
  });
});

describe("Mufti Q&A schemas", () => {
  test("a question needs a real title and body, and accepts no unknown field", () => {
    expect(AskInput.safeParse({ title: "A fixture question title", body: "A fixture question body long enough.", visibility: "private" }).success).toBe(true);
    expect(AskInput.safeParse({ title: "short", body: "A fixture question body long enough.", visibility: "public" }).success).toBe(false);
    expect(AskInput.safeParse({ title: "A fixture question title", body: "A fixture question body long enough.", visibility: "public", status: "accepted" }).success).toBe(false);
    expect(AskInput.safeParse({ title: "A fixture question title", body: "A fixture question body long enough.", visibility: "public", topicRef: "Q 2:255" }).success).toBe(true);
  });

  test("citations: Quran ranges must be ordered; a hadith needs a record id; a scholarly work needs a title", () => {
    expect(CitationInput.safeParse({ kind: "quran", surah: 12, ayahFrom: 4, ayahTo: 6 }).success).toBe(true);
    expect(CitationInput.safeParse({ kind: "quran", surah: 12, ayahFrom: 6, ayahTo: 4 }).success).toBe(false);
    expect(CitationInput.safeParse({ kind: "quran", surah: 115, ayahFrom: 1 }).success).toBe(false);
    expect(CitationInput.safeParse({ kind: "hadith", hadithId: "not-a-uuid" }).success).toBe(false);
    expect(CitationInput.safeParse({ kind: "scholar", work: "" }).success).toBe(false);
    const c = CitationInput.parse({ kind: "scholar", work: "Fixture work, 2nd ed.", locator: "vol. 1, p. 2" });
    expect(citationRow(c)).toMatchObject({ kind: "scholar", work: "Fixture work, 2nd ed.", locator: "vol. 1, p. 2", quran_surah: null, hadith_id: null });
  });

  test("citation display links Quran references and never invents text", () => {
    const base = { hadith_id: null, work: null, locator: null, note: null };
    expect(citationDisplay({ kind: "quran", quran_surah: 12, quran_ayah_from: 4, quran_ayah_to: 6, ...base })).toEqual({ label: "Q 12:4–6", href: "/quran/12#ayah-4-6" });
    expect(citationDisplay({ kind: "scholar", quran_surah: null, quran_ayah_from: null, quran_ayah_to: null, ...base, work: "Fixture work", locator: "p. 3" }).label).toBe("Fixture work, p. 3");
  });

  test("requesting changes needs a note; answers have length limits", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(ReviewInput.safeParse({ answerId: id, version: 1, decision: "approved" }).success).toBe(true);
    expect(ReviewInput.safeParse({ answerId: id, version: 1, decision: "changes_requested" }).success).toBe(false);
    expect(AnswerCreate.safeParse({ questionId: id, body: "too short" }).success).toBe(false);
    expect(VerifyInput.safeParse({ userId: id, action: "make_admin" }).success).toBe(false);
  });

  test("citation cards keep the reference visible", () => {
    render(
      <CitationList
        cites={[{ kind: "quran", quran_surah: 37, quran_ayah_from: 102, quran_ayah_to: 107, hadith_id: null, work: null, locator: null, note: null }]}
        labels={muftiStrings.en.cite}
        empty="none"
      />,
    );
    const link = screen.getByRole("link", { name: /Q 37:102–107/ });
    expect(link).toHaveAttribute("href", "/quran/37#ayah-102-107");
  });
});

describe("Dream Centre schemas and references", () => {
  test("a submission carries only the dream, an optional question, the language and consent", () => {
    const ok = { dream: "A fixture dream description, long enough.", language: "en", consent: true };
    expect(DreamSubmit.safeParse(ok).success).toBe(true);
    expect(DreamSubmit.safeParse({ ...ok, consent: false }).success).toBe(false);
    for (const extra of ["age", "gender", "maritalStatus", "marital_status", "medical", "health"])
      expect(DreamSubmit.safeParse({ ...ok, [extra]: "x" }).success, extra).toBe(false);
    expect(Object.keys(DreamSubmit.shape).sort()).toEqual(["consent", "dream", "language", "question"]);
  });

  test("retention, patch and release rules", () => {
    expect(DreamPrefsInput.safeParse({ retentionDays: 90 }).success).toBe(true);
    expect(DreamPrefsInput.safeParse({ retentionDays: 1000 }).success).toBe(false);
    expect(DreamPatch.safeParse({}).success).toBe(false);
    expect(DreamPatch.safeParse({ status: "answered" }).success).toBe(false);
    expect(DreamResponsePatch.safeParse({ status: "released" }).success).toBe(false);
    expect(DreamResponsePatch.safeParse({ status: "released", acknowledged: true }).success).toBe(true);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(DreamAdminAction.safeParse({ action: "status", requestId: id, status: "declined", reason: "free text" }).success).toBe(false);
    expect(DreamAdminAction.safeParse({ action: "status", requestId: id, status: "declined", reason: "capacity" }).success).toBe(true);
    expect(DREAM_NOTICE_VERSION).toMatch(/^[a-z0-9.-]{1,20}$/);
  });

  test("the Quranic examples are exactly the reviewed references, linked to the reader", () => {
    expect(QURAN_DREAM_REFERENCES.map(quranRefLabel)).toEqual(["Q 12:4–6", "Q 12:36–42", "Q 12:43–49", "Q 12:100", "Q 37:102–107", "Q 48:27"]);
    expect(quranRefHref(QURAN_DREAM_REFERENCES[4])).toBe("/quran/37#ayah-102");
  });

  test("hadith references carry no text", () => {
    expect(HADITH_DREAM_REFERENCES.map((h) => `${h.collection}:${h.number ?? ""}`)).toEqual(["muslim:2263", "bukhari:"]);
    for (const h of HADITH_DREAM_REFERENCES) expect(Object.keys(h)).not.toContain("text");
  });
});

describe("dream request form", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("preferences") ? { retentionDays: 30 } : { id: "x" }), { status: 200, headers: { "content-type": "application/json" } })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  test("asks for no personal profile fields, and shows the retention period", async () => {
    const { container } = render(<DreamRequestForm locale="en" />);
    const names = Array.from(container.querySelectorAll<HTMLInputElement>("[name]")).map((e) => e.name);
    expect(names.sort()).toEqual(["consent", "dream", "language", "question"]);
    for (const n of names) expect(n).not.toMatch(/^(age|dob)$|gender|sex|marital|medical|health|birth/i);
    await waitFor(() => expect(screen.getByText(/after 30 days/)).toBeInTheDocument());
  });

  test("consent must be confirmed before sending", async () => {
    const { container } = render(<DreamRequestForm locale="en" />);
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(dreamStrings.en.form.needConsent);
  });
});

describe("no automated interpretation", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  test("dream code imports no AI or model SDK", () => {
    const root = join(__dirname, "..", "..", "src");
    const code = [...files(join(root, "components", "dreams")), ...files(join(root, "app", "api", "dreams")), ...files(join(root, "app", "[locale]", "dreams")), join(root, "lib", "dreams.ts")];
    for (const f of code) expect(readFileSync(f, "utf8"), f).not.toMatch(/from\s+["'](openai|@anthropic-ai\/[^"']+|ai|@ai-sdk\/[^"']+|@google\/generative-ai)["']/);
  });
});
