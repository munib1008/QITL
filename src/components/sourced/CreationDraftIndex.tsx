import "@/styles/sourced.css";
import Link from "next/link";
import { VerificationBadge } from "@/components/verification/VerificationBadge";
import { CATEGORIES } from "@/lib/data/creation-types";
import { creationDrafts } from "@/lib/sourced/data";

/**
 * The Creation Atlas profile drafts, by category, beside any reviewed profiles. Each links to the draft profile, which shows
 * every field as a Quran-cited statement or "not established" under the AI-Assisted Draft badge.
 */
export function CreationDraftIndex({ locale, heading }: { locale: "ar" | "en"; heading: string }) {
  const all = [...creationDrafts().values()];
  if (!all.length) return null;
  return (
    <section className="cr-sec" aria-labelledby="cr-drafts-h" data-testid="creation-draft-index">
      <h2 id="cr-drafts-h">{heading}</h2>
      <VerificationBadge state="ai_assisted_draft" locale={locale} />
      {CATEGORIES.map((c) => {
        const items = all.filter((d) => d.category === c.id).sort((a, b) => a.name_en.localeCompare(b.name_en));
        if (!items.length) return null;
        return (
          <div key={c.id}>
            <h3>{locale === "ar" ? c.nameAr : c.nameEn}</h3>
            <ul className="sd-index">
              {items.map((d) => (
                <li key={d.slug}>
                  <Link href={`/creation/${d.slug}`}>{locale === "ar" ? d.name_ar : d.name_en}</Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
