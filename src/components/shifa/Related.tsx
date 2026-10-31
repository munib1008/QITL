import Link from "next/link";
import "@/styles/shifa.css";
import { relatedShifa } from "@/lib/data/shifa";
import { relatedHref } from "@/lib/shifa/model";
import { shifaStrings } from "@/lib/i18n/modules/shifa";

/**
 * "Related reading in Shifa" for a Life Guidance topic or a prophet's page. It renders only when a Shifa topic is linked
 * AND published (row-level security hides everything else), so it never links to an empty or draft page. It adds no
 * narrative content: the prophet's story stays in the stories module.
 */
export async function ShifaRelated({ locale, guidanceTopicId, personSlug }: { locale: string; guidanceTopicId?: string; personSlug?: string }) {
  const target = guidanceTopicId ? { guidanceTopicId } : personSlug ? { personSlug } : null;
  if (!target) return null;
  const rows = await relatedShifa(target);
  const items = rows.map((r) => ({ r, href: relatedHref(r) })).filter((x) => x.href && x.r.shifa_topics);
  if (!items.length) return null;
  const s = shifaStrings(locale);
  return (
    <section className="sh-related" aria-labelledby="sh-related-h" data-testid="shifa-related">
      <h2 id="sh-related-h">{s.related.heading}</h2>
      <p className="zq-meta">{s.related.note}</p>
      <ul>
        {items.map(({ r, href }) => (
          <li key={r.id}>
            <Link href={href!}>{(locale === "ar" && r.shifa_topics!.title_ar) || r.shifa_topics!.title_en}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
