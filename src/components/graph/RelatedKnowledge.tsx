import "@/styles/sourced.css";
import Link from "next/link";
import { englishContent } from "@/lib/i18n/locales";
import { graphStrings } from "@/lib/i18n/modules/graph";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { relatedNodes, type NodeKind } from "@/lib/graph/verse-graph";

/**
 * "Pages that cite the same verses": the shared evidence graph (src/lib/graph/verse-graph.ts) as one panel for any page whose
 * content cites Quran ayat. Story drafts appear only when the database released them publicly. Renders nothing when nothing
 * else cites the same ayat.
 */
export async function RelatedKnowledge({ kind, slug, locale }: { kind: NodeKind; slug: string; locale: string }) {
  const gate = await publicAiDraftGate();
  const list = relatedNodes(kind, slug, { allowStories: gate ? new Set(gate.keys()) : null, limit: 6 });
  if (!list.length) return null;
  const t = graphStrings(locale);
  const en = englishContent(locale);
  return (
    <section className="pp-sec" aria-labelledby={`rk-${kind}-${slug}`} data-testid="related-knowledge">
      <h2 id={`rk-${kind}-${slug}`}>{t.title}</h2>
      <p className="zq-meta">{t.note}</p>
      <ul className="sd-index" data-testid="related-knowledge-list">
        {list.map((r) => (
          <li key={`${r.node.kind}:${r.node.slug}`}>
            <Link href={r.node.href} style={{ display: "inline-block", minHeight: 28, padding: "3px 2px" }} {...en}>
              {r.node.title}
            </Link>{" "}
            <span className="zq-meta">
              {t.kinds[r.node.kind]} · {t.shares(r.shared)}
              {" ("}
              <span dir="ltr">{r.sample.map((a) => `Q ${a}`).join(", ")}</span>
              {r.shared > r.sample.length ? "…" : ""}
              {")"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
