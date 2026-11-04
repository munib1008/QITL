import Link from "next/link";
import { VerificationBadge } from "@/components/verification/VerificationBadge";
import { englishContent } from "@/lib/i18n/locales";
import { draftPreviewStrings } from "@/lib/i18n/modules/draftPreview";
import { publicAiDraftGate } from "@/lib/stories/ai-draft-gate";
import { DRAFT_INDEX } from "@/lib/stories/draft-data";
import type { SubjectType } from "@/lib/stories/draft-preview";

/**
 * The public AI-assisted story drafts of one or more subject types, listed on the matching index page (people, communities,
 * events) beside whatever reviewed records exist. Only drafts the database released are shown; each links to the draft, which
 * carries the full draft banner. Never presented as reviewed: the badge says AI-Assisted Draft.
 */
export async function AiDraftIndex({ types, locale }: { types: SubjectType[]; locale: string }) {
  const gate = await publicAiDraftGate();
  const stories = DRAFT_INDEX.stories.filter((s) => types.includes(s.type as SubjectType) && (!gate || gate.has(s.slug)));
  if (!stories.length) return null;
  const t = draftPreviewStrings(locale);
  const en = englishContent(locale);
  const groups = types.map((ty) => ({ ty, items: stories.filter((s) => s.type === ty) })).filter((g) => g.items.length);
  return (
    <section className="pp-sec" aria-labelledby="aidi-h" data-testid="ai-draft-index">
      <h2 id="aidi-h">{t.listTitle}</h2>
      <VerificationBadge state="ai_assisted_draft" locale={locale} />
      <p className="zq-meta">{t.listMeta}</p>
      {groups.map((g) => (
        <div key={g.ty}>
          {groups.length > 1 ? <h3>{t.types[g.ty]![0]}</h3> : null}
          <ul className="zq-jc-refs" data-testid="ai-draft-index-list">
            {g.items.map((s) => (
              <li key={s.slug}>
                <Link href={`/drafts/${s.slug}`} {...en}>
                  {s.title_en}
                </Link>
                {s.title_ar ? (
                  <>
                    {" "}
                    <span lang="ar" dir="rtl" className="zq-meta">
                      {s.title_ar}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="zq-meta">
        <Link href="/drafts">{t.listTitle}</Link>
      </p>
    </section>
  );
}
