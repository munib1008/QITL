// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import sitemap from "@/app/sitemap";
import { exploreLinks } from "@/lib/nav";
import { loadQuran } from "@/lib/events/verify";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { ChapterSchema, ClaimSchema, VerseRangeSchema } from "@/lib/stories/draft";
import { buildDraftIndex, readChecklist, validatorRuleCodes } from "@/lib/stories/draft-index";
import { DRAFT_INDEX, NOINDEX, findDraft, quranOf } from "@/lib/stories/draft-data";
import { SUBJECT_TYPES, claimDomId, groupByType, linkClaimMarkers, parseSubjectType, rangeAyat } from "@/lib/stories/draft-preview";

/**
 * The draft preview (/drafts): the generated index must match content/stories, validate against the draft schema, carry
 * the Quran text verbatim and only the ayat the drafts cite; the pages stay out of the sitemap, Explore and search; the
 * chrome strings never claim review. DB-free. If "fresh" fails: run `pnpm drafts:index` and commit the result.
 */
const root = join(__dirname, "..", "..");

describe("the generated index", () => {
  test("is fresh: it equals what content/stories and docs/STORY_DRAFTS.md produce now (run `pnpm drafts:index`)", () => {
    const { index, excluded } = buildDraftIndex(root);
    expect(excluded).toEqual([]);
    expect(JSON.parse(JSON.stringify(DRAFT_INDEX))).toEqual(JSON.parse(JSON.stringify(index)));
  });

  test("has one story per draft file, none twice", () => {
    const files = readdirSync(join(root, "content", "stories")).filter((f) => f.endsWith(".draft.json"));
    expect(DRAFT_INDEX.stories.map((s) => s.slug).sort()).toEqual(files.map((f) => f.replace(".draft.json", "")).sort());
  });

  test("validates against the draft schema (chapters, claims and verse ranges)", () => {
    const ChapterOut = ChapterSchema.omit({ event_slug: true, claims: true }).extend({ claims: z.array(ClaimSchema.omit({ evidence: true })).min(1) }).strict();
    const Story = z
      .object({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        title_en: z.string().min(1),
        title_ar: z.string().nullable(),
        type: z.enum(SUBJECT_TYPES),
        chapters: z.array(ChapterOut).min(1),
        uncertainties_en: z.array(z.string()),
        preReview: z.object({ errors: z.number(), warnings: z.number(), info: z.number(), rulesChecked: z.array(z.string()), rulesWithFindings: z.array(z.string()), rulesPassed: z.array(z.string()), claims: z.number(), verseRanges: z.number(), ayat: z.number() }).strict(),
      })
      .strict();
    const Index = z.object({ version: z.literal(1), quranSource: z.object({ source: z.string(), version: z.string() }).strict(), checklist: z.array(z.string()).length(12), quran: z.record(z.string(), z.string()), stories: z.array(Story) }).strict();
    expect(Index.safeParse(DRAFT_INDEX).error?.issues ?? []).toEqual([]);
    for (const s of DRAFT_INDEX.stories) {
      expect(s.chapters.map((c) => c.position)).toEqual(s.chapters.map((_, i) => i + 1));
      for (const c of s.chapters) for (const r of c.verses) expect(VerseRangeSchema.safeParse(r).success).toBe(true);
      expect(s.preReview.errors).toBe(0);
    }
  });

  test("the pre-review numbers are the drafts' own, not invented", () => {
    for (const s of DRAFT_INDEX.stories) {
      expect(s.preReview.claims).toBe(s.chapters.reduce((n, c) => n + c.claims.length, 0));
      expect(s.preReview.verseRanges).toBe(s.chapters.reduce((n, c) => n + c.verses.length, 0));
      expect(s.preReview.rulesPassed.length + s.preReview.rulesWithFindings.length).toBe(s.preReview.rulesChecked.length);
      expect(s.preReview.rulesChecked).toEqual(validatorRuleCodes(root));
    }
  });

  test("the Arabic is the imported Tanzil text, verbatim, for exactly the cited ayat", () => {
    const quran = loadQuran(root);
    const cited = new Set<string>();
    for (const s of DRAFT_INDEX.stories) for (const c of s.chapters) for (const r of c.verses) for (const a of rangeAyat({ quran: DRAFT_INDEX.quran }, r)) cited.add(`${r.surah}:${a.ayah}`);
    expect(Object.keys(DRAFT_INDEX.quran).sort()).toEqual([...cited].sort());
    for (const [k, v] of Object.entries(DRAFT_INDEX.quran)) expect(v).toBe(quran.get(k));
    // every range is fully present
    for (const s of DRAFT_INDEX.stories) for (const c of s.chapters) for (const r of c.verses) expect(rangeAyat({ quran: DRAFT_INDEX.quran }, r)).toHaveLength(r.to - r.from + 1);
    expect(DRAFT_INDEX.quranSource.source).toMatch(/Tanzil/);
  });

  test("the scholars' checklist is the twelve points of docs/STORY_DRAFTS.md", () => {
    expect(DRAFT_INDEX.checklist).toHaveLength(12);
    expect(readChecklist(root)).toEqual(DRAFT_INDEX.checklist);
    expect(DRAFT_INDEX.checklist[0]).toMatch(/^\*\*Verses\.\*\*/);
  });

  test("holds no field the pages do not show (no notes, status, event slugs or evidence kinds)", () => {
    const keys = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (k.includes(":") || keys.add(k), walk(x));
    };
    walk(JSON.parse(readFileSync(join(root, "src", "generated", "story-drafts.json"), "utf8")));
    for (const k of ["notes", "status", "event_slug", "evidence", "subject"]) expect(keys.has(k)).toBe(false);
  });
});

describe("helpers", () => {
  test("claim markers become links to the claim of the same chapter", () => {
    expect(linkClaimMarkers("He went [c2].", "the-dream")).toBe("He went [c2](#claim-the-dream-c2).");
    expect(linkClaimMarkers("Two [c1][c3]. Three [c1, c2].", "x")).toBe("Two [c1](#claim-x-c1) [c3](#claim-x-c3). Three [c1](#claim-x-c1) [c2](#claim-x-c2).");
    expect(claimDomId("a-b", "c4")).toBe("claim-a-b-c4");
    // every marker in every draft text points at a claim that exists in that chapter
    for (const s of DRAFT_INDEX.stories)
      for (const c of s.chapters) {
        const ids = new Set(c.claims.map((x) => x.id));
        for (const f of [c.summary_md, c.body_md, c.deep_md, c.kids_md, c.lessons_md]) {
          if (!f) continue;
          for (const m of linkClaimMarkers(f, c.anchor).matchAll(/\]\(#claim-[a-z0-9-]+-(c\d+)\)/g)) expect(ids.has(m[1]!)).toBe(true);
          expect(linkClaimMarkers(f, c.anchor)).not.toMatch(/\[c\d+(\s*,\s*c\d+)*\](?!\()/);
        }
      }
  });

  test("grouping, type parsing and per-story Arabic", () => {
    expect(parseSubjectType("prophet")).toBe("prophet");
    expect(parseSubjectType("nope")).toBeNull();
    const g = groupByType(DRAFT_INDEX.stories);
    expect(g.map((x) => x.type)).toEqual([...SUBJECT_TYPES]);
    expect(g.reduce((n, x) => n + x.stories.length, 0)).toBe(DRAFT_INDEX.stories.length);
    const yusuf = findDraft("yusuf")!;
    expect(Object.keys(quranOf(yusuf)).every((k) => k.startsWith("12:") || /^\d+:\d+$/.test(k))).toBe(true);
    expect(findDraft("not-a-draft")).toBeUndefined();
  });

  test("robots rule says noindex and nofollow", () => {
    expect(NOINDEX.index).toBe(false);
    expect(NOINDEX.follow).toBe(false);
  });
});

describe("kept apart from reviewed knowledge", () => {
  test("not in the sitemap", () => {
    for (const e of sitemap()) expect(e.url).not.toMatch(/\/drafts/);
  });
  test("Explore lists the drafts only as the one labelled draft section (the 2026-11 policy: publish drafts openly, labelled)", () => {
    for (const l of ["en", "ar", "ur"]) {
      const hits = exploreLinks(l).filter((x) => x.href.startsWith("/drafts"));
      expect(hits.map((x) => x.href)).toEqual(["/drafts"]);
      expect(hits[0]!.label.length).toBeGreaterThan(3);
    }
  });
  test("not read by the unified search, the sitemap code or the home page's data", () => {
    for (const f of ["src/lib/search-sources.ts", "src/app/sitemap.ts"]) expect(readFileSync(join(root, f), "utf8")).not.toMatch(/story-drafts|draft-data|\/drafts/);
    // the navigation registry may name the /drafts section, but never reads the draft data itself
    expect(readFileSync(join(root, "src/lib/nav.ts"), "utf8")).not.toMatch(/story-drafts|draft-data/);
    expect(readFileSync(join(root, "src", "app", "[locale]", "page.tsx"), "utf8")).not.toMatch(/story-drafts|draft-data|\/drafts/);
  });
  test("the preview reads files only: it imports no database client", () => {
    for (const f of ["src/lib/stories/draft-data.ts", "src/app/[locale]/drafts/page.tsx", "src/app/[locale]/drafts/[slug]/page.tsx", "src/components/drafts/DraftReader.tsx", "src/components/drafts/PreReviewPanel.tsx", "src/components/drafts/DraftBanner.tsx"])
      expect(readFileSync(join(root, f), "utf8")).not.toMatch(/supabase|editorial_reviews|\.insert\(|\.update\(|\.rpc\(/);
  });
});

describe("chrome strings", () => {
  const collect = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "function") out.push(String((v as (...a: unknown[]) => unknown)(3, 5)), String((v as (...a: unknown[]) => unknown)("c1")));
    else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
    return out;
  };

  test("Arabic and Urdu cover every English key (no silent fallback)", () => {
    const shape = (v: unknown): unknown => (typeof v === "function" ? "fn" : Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : "s");
    const en = shape(draftPreviewStrings("en"));
    expect(shape(draftPreviewStrings("ar"))).toEqual(en);
    const enAll = collect(draftPreviewStrings("en"));
    for (const l of ["ar", "ur"]) {
      const all = collect(draftPreviewStrings(l));
      expect(all).toHaveLength(enAll.length);
      // translated: not the English text
      expect(all.filter((s, i) => s === enAll[i] && /[A-Za-z]{4,}/.test(s))).toEqual([]);
    }
  });

  test("never say reviewed, verified or authentic about the content (English, Arabic, Urdu)", () => {
    const en = collect(draftPreviewStrings("en"));
    for (const s of en) {
      const rest = s.replace(/\bNOT yet reviewed\b/g, "").replace(/\bnot yet reviewed\b/g, "");
      expect(rest, s).not.toMatch(/\b(reviewed|verified|authentic\w*|approved|confirmed)\b/i);
    }
    for (const s of collect(draftPreviewStrings("ar"))) expect(s, s).not.toMatch(/موثّ?ق|مُحقَّق|محقق|معتمد|أصيل|صحيح|مدقَّق|مُراجَع|مؤكَّد/);
    for (const s of collect(draftPreviewStrings("ur"))) expect(s, s).not.toMatch(/مستند|مصدقہ|تصدیق شدہ|معتبر|صحیح|مصدّق|منظور شدہ|تصدیق شدہ/);
  });

  test("the banner says draft, review pending, AI-written and not reviewed by a scholar, in all three languages", () => {
    const en = draftPreviewStrings("en");
    expect(en.bannerLead).toBe("Draft preview — review pending.");
    expect(en.bannerBody).toBe("Written by an AI assistant from the Quran text and checked only by automated rules; NOT yet reviewed by a scholar.");
    expect(draftPreviewStrings("ar").bannerBody).toMatch(/ذكاء اصطناعي/);
    expect(draftPreviewStrings("ur").bannerBody).toMatch(/اے آئی/);
    for (const l of ["en", "ar", "ur"]) expect(draftPreviewStrings(l).preStatusValue.length).toBeGreaterThan(2);
  });
});
