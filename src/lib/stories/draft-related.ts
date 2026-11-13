import { DRAFT_INDEX } from "@/lib/stories/draft-data";

export interface DraftCiting {
  slug: string;
  title: string;
}

let bySurah: Map<number, Map<number, DraftCiting[]>> | undefined;

/**
 * Which story drafts cite which ayah, from the verse ranges of their chapters (the draft index, never inferred). Built once.
 * A story is listed once per ayah however many of its chapters cite it. This is evidence-backed linking only: a draft appears
 * on an ayah because one of its chapters cites that ayah.
 */
function build() {
  const m = new Map<number, Map<number, DraftCiting[]>>();
  for (const s of DRAFT_INDEX.stories) {
    const seen = new Set<string>();
    for (const c of s.chapters) {
      for (const v of c.verses ?? []) {
        const to = v.to ?? v.from;
        for (let a = v.from; a <= to; a++) {
          const k = `${v.surah}:${a}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const surah = m.get(v.surah) ?? new Map<number, DraftCiting[]>();
          const list = surah.get(a) ?? [];
          list.push({ slug: s.slug, title: s.title_en });
          surah.set(a, list);
          m.set(v.surah, surah);
        }
      }
    }
  }
  return m;
}

/** Draft stories that cite each ayah of one surah (ayah number to stories). Empty when nothing cites the surah. */
export function draftsCitingSurah(surah: number, allow?: ReadonlySet<string> | null): Map<number, DraftCiting[]> {
  bySurah ??= build();
  const src = bySurah.get(surah);
  if (!src) return new Map();
  if (!allow) return src;
  const out = new Map<number, DraftCiting[]>();
  for (const [a, list] of src) {
    const f = list.filter((d) => allow.has(d.slug));
    if (f.length) out.set(a, f);
  }
  return out;
}
