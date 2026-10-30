"use client";

import { useState } from "react";
import Link from "next/link";
import { EvidenceLabel } from "@/components/ui/evidence";
import { EmptyState } from "@/components/ui/misc";
import { CATEGORIES, type CategoryId, type Entry } from "@/lib/data/creation-types";
import { creationStrings } from "@/lib/i18n/modules/creation";
import { EntryBlock } from "./parts";

export interface MisconceptionItem {
  entry: Entry;
  categoryId: CategoryId;
  profileSlug: string;
  profileName: string;
}

/**
 * "What we know — and what we do not know": questions answered only from published, reviewed entries. The health
 * caution is always shown, with or without entries, and never hidden by a filter.
 */
export function MisconceptionExplorer({ items, locale }: { items: MisconceptionItem[]; locale: "en" | "ar" }) {
  // Strings are looked up here: they include functions, which cannot cross from a server component.
  const t = creationStrings(locale);
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const cats = CATEGORIES.filter((c) => items.some((i) => i.categoryId === c.id));
  const shown = cat === "all" ? items : items.filter((i) => i.categoryId === cat);
  return (
    <div className="cr-mis">
      <div className="cr-caution" role="note" aria-labelledby="cr-caution-h" data-testid="creation-caution">
        <b id="cr-caution-h">{t.misconceptions.cautionTitle}</b>
        <p>{t.misconceptions.caution}</p>
      </div>
      {items.length ? (
        <>
          {cats.length > 1 ? (
            <div className="cr-filter" role="group" aria-label={t.misconceptions.filter}>
              {[{ id: "all" as const, label: t.misconceptions.all }, ...cats.map((c) => ({ id: c.id, label: locale === "ar" ? c.nameAr : c.nameEn }))].map((c) => (
                <button key={c.id} type="button" className="zq-pill cr-pill" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="cr-mis-list" data-testid="creation-misconceptions">
            {shown.map((i) => (
              <li key={i.entry.id}>
                <details className="cr-mis-item">
                  <summary>{i.entry.question || i.entry.title}</summary>
                  <div className="cr-mis-body">
                    <EntryBlock entry={{ ...i.entry, title: i.entry.question ? i.entry.title : null }} t={t} />
                    <p className="zq-meta" style={{ margin: 0 }}>
                      <Link href={`/creation/${i.profileSlug}#f-misconceptions`}>{i.profileName}</Link>
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState label={<EvidenceLabel kind="unknown">{t.evidence.not_established}</EvidenceLabel>} title={t.misconceptions.empty} />
      )}
    </div>
  );
}
