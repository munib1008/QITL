import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { GuidanceNotice, LessonView, MuftiLink, RelatedLinks, SafetyNotice } from "@/components/guidance/Guidance";
import { citation, layersOf, linkTarget, needsSafetyNotice, PLANNED_TOPICS, plannedTopic, type ClaimRef, type GuidanceLesson, type GuidanceLinkRow } from "@/lib/guidance/topics";
import { parseRevelationIds, parseScholarLines } from "@/lib/guidance/editor";
import { guidanceStrings, guidanceT } from "@/lib/i18n/modules/guidance";
import { lessonDetail } from "@/components/admin/guidanceReview";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ref = (r: Partial<ClaimRef>): ClaimRef => ({
  kind: "quran",
  quran_surah: null,
  quran_ayah_from: null,
  quran_ayah_to: null,
  locator: null,
  hadith_entries: null,
  hadith_gradings: null,
  sources: null,
  ...r,
});

// Test fixtures, not lesson content: statements are placeholders.
const LESSON: GuidanceLesson = {
  id: "l1",
  position: 1,
  title_en: "Fixture lesson",
  title_ar: null,
  application_en: "[fixture] an educational suggestion",
  application_ar: null,
  version: 3,
  guidance_lesson_claims: [
    {
      id: "c2",
      layer: "scholarly_interpretation",
      scholar_name: "Fixture Scholar",
      work_title: "Fixture Work",
      locator: "vol. 1",
      position: 1,
      evidence_claims: { id: ID2, statement: "[fixture] scholarly statement", evidence: "scholar", claim_references: [ref({ kind: "tafsir", sources: { work: "Fixture Work" }, locator: "p. 4" })] },
    },
    {
      id: "c1",
      layer: "revelation",
      scholar_name: null,
      work_title: null,
      locator: null,
      position: 1,
      evidence_claims: {
        id: ID1,
        statement: "[fixture] revelation statement",
        evidence: "quran",
        claim_references: [
          ref({ quran_surah: 3, quran_ayah_from: 134 }),
          ref({ kind: "hadith", hadith_entries: { collection_id: "tirmidhi", canonical_number: "902" }, hadith_gradings: { grader: "Fixture grader", grade_label: "Sahih" } }),
        ],
      },
    },
    // A scholarly row without a named scholar is never shown.
    { id: "c3", layer: "scholarly_interpretation", scholar_name: null, work_title: null, locator: null, position: 2, evidence_claims: { id: "x", statement: "[fixture] unnamed", evidence: "scholar", claim_references: [] } },
  ],
};

describe("guidance helpers", () => {
  test("citations: Quran ranges and hadith link to their pages; other sources name the work", () => {
    expect(citation(ref({ quran_surah: 3, quran_ayah_from: 134 }))).toEqual({ kind: "Quran", label: "Q 3:134", href: "/quran/3#ayah-134" });
    expect(citation(ref({ quran_surah: 21, quran_ayah_from: 87, quran_ayah_to: 88 })).label).toBe("Q 21:87–88");
    expect(citation(ref({ kind: "hadith", hadith_entries: { collection_id: "muslim", canonical_number: "2588" } }))).toEqual({ kind: "Hadith", label: "muslim 2588", href: "/hadith/muslim/2588" });
    expect(citation(ref({ kind: "tafsir", sources: { work: "Tafsir X" }, locator: "vol. 2" }))).toEqual({ kind: "Tafsir", label: "Tafsir X, vol. 2" });
  });

  test("layers are split and ordered; unnamed scholarly rows are dropped", () => {
    const { revelation, scholarly } = layersOf(LESSON);
    expect(revelation.map((c) => c.id)).toEqual(["c1"]);
    expect(scholarly.map((c) => c.id)).toEqual(["c2"]);
  });

  test("related links: prophets link to their page, other people do not, hidden targets disappear", () => {
    const base = { id: "k", note_en: null, note_ar: null, position: 1, people: null, historical_events: null, stories: null, creation_profiles: null } as const;
    const prophet: GuidanceLinkRow = { ...base, target_kind: "person", people: { slug: "yunus", name_en: "Yunus", name_ar: "يونس", kind: "prophet" } };
    expect(linkTarget(prophet, "en")).toEqual({ label: "Yunus", href: "/prophets/yunus" });
    expect(linkTarget(prophet, "ar")?.label).toBe("يونس");
    expect(linkTarget({ ...prophet, people: { ...prophet.people!, kind: "historical" } }, "en")?.href).toBeUndefined();
    expect(linkTarget({ ...base, target_kind: "story", stories: { slug: "s", title: "S", title_ar: null } }, "ar")).toEqual({ label: "S", href: "/stories/s" });
    expect(linkTarget({ ...base, target_kind: "event" }, "en")).toBeNull();
  });

  test("distress topics always need the safety notice", () => {
    expect(needsSafetyNotice(plannedTopic("feeling-overwhelmed"))).toBe(true);
    expect(needsSafetyNotice(plannedTopic("anger-and-conflict"))).toBe(false);
    expect(needsSafetyNotice(undefined)).toBe(false);
  });

  test("the planned topic list mirrors the draft seed migration and carries no lesson text", () => {
    const sql = readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "20261031001960_life_guidance_topics.sql"), "utf8");
    const rows = [...sql.matchAll(/\('([a-z0-9-]+)', '([^']+)', '([^']+)', '([a-z]+)', (true|false), (\d+), 'draft'\)/g)].map((m) => ({
      slug: m[1],
      title_en: m[2],
      title_ar: m[3],
      icon_key: m[4],
      distress: m[5] === "true",
    }));
    expect(rows).toEqual(PLANNED_TOPICS);
    expect(sql).not.toMatch(/guidance_lessons|guidance_lesson_claims|evidence_claims/);
    for (const t of PLANNED_TOPICS) expect(Object.keys(t).sort()).toEqual(["distress", "icon_key", "slug", "title_ar", "title_en"]);
  });

  test("editor parsing: revelation ids and 'claim | scholar | work | locator' lines", () => {
    expect(parseRevelationIds(`${ID1}, ${ID2}`).rows.map((r) => r.claim_id)).toEqual([ID1, ID2]);
    expect(parseRevelationIds("nope").errors).toHaveLength(1);
    const ok = parseScholarLines(`${ID2} | Ibn Kathir | Tafsir al-Quran al-Azim | vol. 2`);
    expect(ok.rows[0]).toMatchObject({ layer: "scholarly_interpretation", scholar_name: "Ibn Kathir", work_title: "Tafsir al-Quran al-Azim", locator: "vol. 2" });
    expect(parseScholarLines(`${ID2} | | Work`).errors[0]).toMatch(/name the scholar/);
    expect(parseScholarLines("x | A | B").errors[0]).toMatch(/claim id/);
  });

  test("review detail tells the reviewer about pending claims and the application", () => {
    expect(
      lessonDetail({
        application_en: "",
        guidance_lesson_claims: [{ layer: "revelation", scholar_name: null, work_title: null, evidence_claims: { status: "draft" } }],
      }),
    ).toMatch(/Revelation claims: 1.*Scholarly explanations: 0.*1 claim\(s\) not yet approved.*No everyday application/);
  });

  test("Arabic and English module strings have the same keys and none is empty", () => {
    const flat = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [`${p}${k}`] : flat(v as object, `${p}${k}.`)));
    expect(flat(guidanceStrings.ar)).toEqual(flat(guidanceStrings.en));
    const values = (o: object): string[] => Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : values(v as object)));
    for (const v of [...values(guidanceStrings.en), ...values(guidanceStrings.ar)]) expect(v.trim()).not.toBe("");
    expect(guidanceT("ar").nav).toBe(guidanceStrings.ar.nav);
    expect(guidanceT("xx").nav).toBe("Life Guidance");
  });
});

describe("guidance components", () => {
  const s = guidanceT("en");

  test("a lesson shows three labelled layers, citations and the scholar with the work", () => {
    render(<LessonView lesson={LESSON} s={s} locale="en" index={1} />);
    const article = screen.getByTestId("guidance-lesson");
    const [rev, sch, app] = Array.from(article.querySelectorAll<HTMLElement>("[data-layer]"));
    expect([rev, sch, app].map((x) => x!.dataset.layer)).toEqual(["revelation", "scholarly", "application"]);
    expect(within(rev!).getByRole("heading", { name: "What revelation says" })).toBeInTheDocument();
    expect(within(rev!).getByRole("link", { name: /Q 3:134/ })).toHaveAttribute("href", "/quran/3#ayah-134");
    expect(within(rev!).getByRole("link", { name: /tirmidhi 902/ })).toHaveAttribute("href", "/hadith/tirmidhi/902");
    expect(within(rev!).getByText(/Sahih · Fixture grader/)).toBeInTheDocument();
    expect(within(sch!).getByText("Fixture Scholar")).toBeInTheDocument();
    expect(within(sch!).getByText("Fixture Work", { selector: "cite" })).toBeInTheDocument();
    expect(within(sch!).queryByText("[fixture] unnamed")).toBeNull();
    expect(within(app!).getByText("QITL's educational suggestion — not a ruling")).toBeInTheDocument();
    expect(article.querySelectorAll("[data-citation]").length).toBe(3);
  });

  test("the notice says it is not a ruling or therapy and that an unreviewed lesson is a labelled AI-assisted draft; the mufti link goes to the Q&A", () => {
    render(
      <>
        <GuidanceNotice s={s} />
        <MuftiLink s={s} />
      </>,
    );
    expect(screen.getByTestId("guidance-notice")).toHaveTextContent(/not a personal ruling or therapy/);
    expect(screen.getByTestId("guidance-notice")).toHaveTextContent(/labelled AI-assisted draft written from the Quran only; it is never presented as reviewed/);
    expect(screen.getByRole("link", { name: "Ask a Mufti for a personal ruling" })).toHaveAttribute("href", "/community/questions");
  });

  test("the safety notice recommends medical / mental-health help and local emergency services, in Arabic too", () => {
    const { rerender } = render(<SafetyNotice s={s} locale="en" notes={[{ id: "n", kind: "mental_health", body_en: "[fixture] reviewed note", body_ar: null, position: 1 }, { id: "r", kind: "ruling_referral", body_en: "[fixture] referral", body_ar: null, position: 2 }]} />);
    const n = screen.getByTestId("safety-notice");
    expect(n).toHaveAttribute("role", "note");
    expect(n).toHaveTextContent(/mental-health professional/);
    expect(n).toHaveTextContent(/local emergency services/);
    expect(n).toHaveTextContent("[fixture] reviewed note");
    expect(n).not.toHaveTextContent("[fixture] referral");
    rerender(<SafetyNotice s={guidanceT("ar")} locale="ar" />);
    expect(screen.getByTestId("safety-notice")).toHaveTextContent(/خدمات الطوارئ المحلية/);
  });

  test("related links render only visible targets", () => {
    const { container } = render(<RelatedLinks s={s} locale="en" links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
