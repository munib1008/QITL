/**
 * Builds the draft-preview index (src/generated/story-drafts.json) from content/stories/*.draft.json (Node only).
 * Pure with respect to the repository: same files in, same index out, which is what lets a unit test fail when the
 * committed index is stale. Only drafts without validator errors are included. Nothing here writes to the database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StoryDraftSchema, validateStoryDraft, type Issue, type StoryDraft } from "./draft";
import { loadDraftContext, loadDraftFiles } from "./draft-load";
import { SUBJECT_TYPES, verseKey, type DraftIndex, type PreReview, type PreviewStory } from "./draft-preview";

export const INDEX_PATH = ["src", "generated", "story-drafts.json"] as const;

/** Every rule code the validator can raise, read from its source so the list can never drift from the validator. */
export function validatorRuleCodes(root = process.cwd()): string[] {
  const src = readFileSync(join(root, "src", "lib", "stories", "draft.ts"), "utf8");
  const codes = new Set<string>(["schema"]);
  for (const m of src.matchAll(/\b(?:err|warn|info)\(\s*"([a-z][a-z-]*)"/g)) codes.add(m[1]!);
  return [...codes].sort();
}

/** The numbered checklist of "Review checklist for scholars" in docs/STORY_DRAFTS.md, one string per point. */
export function readChecklist(root = process.cwd()): string[] {
  const md = readFileSync(join(root, "docs", "STORY_DRAFTS.md"), "utf8").replace(/\r\n/g, "\n");
  const start = md.indexOf("## Review checklist for scholars");
  if (start < 0) throw new Error("docs/STORY_DRAFTS.md has no 'Review checklist for scholars' section");
  const rest = md.slice(start).split("\n").slice(1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  const items: string[] = [];
  for (const line of end < 0 ? rest : rest.slice(0, end)) {
    if (/^\d+\.\s/.test(line)) items.push(line.replace(/^\d+\.\s+/, ""));
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map((s) => s.replace(/`/g, "").replace(/\s+/g, " ").trim());
}

function preReview(d: StoryDraft, issues: Issue[], allCodes: string[]): PreReview {
  const withFindings = [...new Set(issues.map((i) => i.code))].sort();
  const ayat = new Set<string>();
  let ranges = 0;
  for (const c of d.chapters) {
    ranges += c.verses.length;
    for (const r of c.verses) for (let a = r.from; a <= r.to; a++) ayat.add(verseKey(r.surah, a));
  }
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
    rulesChecked: allCodes,
    rulesWithFindings: withFindings,
    rulesPassed: allCodes.filter((c) => !withFindings.includes(c)),
    claims: d.chapters.reduce((n, c) => n + c.claims.length, 0),
    verseRanges: ranges,
    ayat: ayat.size,
  };
}

export interface BuiltIndex {
  index: DraftIndex;
  /** Draft files left out because they have validator errors (the page never shows a draft that fails the gate). */
  excluded: Array<{ file: string; reason: string }>;
}

export function buildDraftIndex(root = process.cwd()): BuiltIndex {
  const ctx = loadDraftContext(root);
  const allCodes = validatorRuleCodes(root);
  const source = JSON.parse(readFileSync(join(root, "content", "quran", "source.json"), "utf8")) as { source: string; version: string };
  const order = new Map(ctx.inventory.map((it, i) => [it.slug, i]));
  const excluded: BuiltIndex["excluded"] = [];
  const stories: Array<{ story: PreviewStory; rank: number }> = [];
  const quran: Record<string, string> = {};

  for (const f of loadDraftFiles(root)) {
    if (f.parseError) {
      excluded.push({ file: f.file, reason: `invalid JSON: ${f.parseError}` });
      continue;
    }
    const issues = validateStoryDraft(f.raw, ctx, { fileSlug: f.slug });
    const errors = issues.filter((i) => i.severity === "error");
    const parsed = StoryDraftSchema.safeParse(f.raw);
    if (errors.length || !parsed.success) {
      excluded.push({ file: f.file, reason: errors[0] ? `${errors.length} error(s), first: ${errors[0].code} ${errors[0].where}` : "schema" });
      continue;
    }
    const d = parsed.data;
    for (const c of d.chapters)
      for (const r of c.verses)
        for (let a = r.from; a <= r.to; a++) {
          const k = verseKey(r.surah, a);
          const t = ctx.quran.get(k);
          if (t === undefined) throw new Error(`${f.file}: ${k} is not in content/quran`);
          quran[k] = t;
        }
    stories.push({
      rank: order.get(d.subject.event_slug) ?? Number.MAX_SAFE_INTEGER,
      story: {
        slug: d.slug,
        title_en: d.title_en,
        title_ar: d.title_ar,
        type: d.subject.type,
        chapters: d.chapters.map((c) => ({
          anchor: c.anchor,
          position: c.position,
          title_en: c.title_en,
          verses: c.verses,
          claims: c.claims.map((cl) => ({ id: cl.id, statement_en: cl.statement_en, verses: cl.verses })),
          summary_md: c.summary_md,
          body_md: c.body_md,
          deep_md: c.deep_md,
          kids_md: c.kids_md,
          lessons_md: c.lessons_md,
          unknowns_md: c.unknowns_md,
        })),
        uncertainties_en: d.uncertainties_en,
        preReview: preReview(d, issues, allCodes),
      },
    });
  }

  stories.sort((a, b) => SUBJECT_TYPES.indexOf(a.story.type) - SUBJECT_TYPES.indexOf(b.story.type) || a.rank - b.rank || a.story.slug.localeCompare(b.story.slug));
  const sortedQuran = Object.fromEntries(
    Object.entries(quran).sort(([a], [b]) => {
      const [sa, aa] = a.split(":").map(Number) as [number, number];
      const [sb, ab] = b.split(":").map(Number) as [number, number];
      return sa - sb || aa - ab;
    }),
  );
  return {
    index: { version: 1, quranSource: { source: source.source, version: source.version }, checklist: readChecklist(root), quran: sortedQuran, stories: stories.map((s) => s.story) },
    excluded,
  };
}

export const serializeIndex = (i: DraftIndex): string => `${JSON.stringify(i, null, 2)}\n`;
