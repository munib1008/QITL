import "server-only";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import { scoreFields, type SearchHit } from "@/lib/search";

/**
 * Public AI-assisted story drafts as search results. Only drafts the database released (public_ai_draft + passed source
 * integrity) are searchable; with no database configured the file index is used, as on the draft pages. Every snippet says
 * the page is an AI draft that no scholar has reviewed, so a result is never mistaken for a reviewed record.
 */
const LABEL = "AI draft, not scholar-reviewed. Check it against the Quran and the hadith books.";

export async function searchAiDrafts(q: string): Promise<SearchHit[]> {
  const gate = await publicAiDraftGate();
  const hits: SearchHit[] = [];
  for (const s of DRAFT_INDEX.stories) {
    if (gate && !gate.has(s.slug)) continue;
    const score = scoreFields(q, [{ text: s.title_en, title: true }, { text: s.title_ar ?? "", title: true }, { text: s.slug.replace(/-/g, " ") }]);
    if (score <= 0) continue;
    hits.push({ type: "ai_draft", id: `draft:${s.slug}`, url: `/drafts/${s.slug}`, title: s.title_en, titleAr: s.title_ar || undefined, snippet: LABEL, facet: "stories", score: score * 0.7 });
  }
  return hits;
}
