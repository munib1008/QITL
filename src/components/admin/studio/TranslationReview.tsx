"use client";

import { LoadErrorText } from "../feedback";
import { useState } from "react";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { Skeleton } from "@/components/ui/misc";
import { getPlayerStrings } from "@/lib/i18n/modules/player";
import { StudioPreview } from "./Studio";
import { Feedback, Field, call, sb, useAction, useRows } from "./shared";

interface Row {
  id: string;
  title: string;
  language: string;
  version: number;
  status: EditorialState;
  translated_from: string;
  translated_from_version: number;
  model: string | null;
  translation_reviews: Array<{ aspect: string; decision: string; script_version: number }>;
}

/**
 * Translated scripts awaiting review. The linguistic review is signed by a translation reviewer, the religious review
 * by a scholarly reviewer; both must approve the translation's current version before it can publish.
 */
export function TranslationReviewDesk({ locale, canLinguistic, canReligious }: { locale: string; canLinguistic: boolean; canReligious: boolean }) {
  const { studio: s, player: t } = getPlayerStrings(locale);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useRows<Row>(
    () =>
      sb()
        ?.from("story_scripts")
        .select("id, title, language, version, status, translated_from, translated_from_version, model, translation_reviews(aspect, decision, script_version)")
        .not("translated_from", "is", null)
        .neq("status", "published")
        .order("created_at", { ascending: false })
        .limit(100) ?? null,
  );
  if (rows.error) return <p className="zq-error"><LoadErrorText error={rows.error} /></p>;
  if (!rows.rows) return <Skeleton height={20} />;
  if (!rows.rows.length) return <p className="zq-meta">{s.noTranslations}</p>;
  return (
    <ul className="st-list">
      {rows.rows.map((r) => (
        <TranslationItem
          key={r.id}
          r={r}
          s={s}
          lang={t.languages[r.language as keyof typeof t.languages] ?? r.language}
          canLinguistic={canLinguistic}
          canReligious={canReligious}
          open={open === r.id}
          onOpen={() => setOpen(open === r.id ? null : r.id)}
          onChange={() => void rows.reload()}
          locale={locale}
        />
      ))}
    </ul>
  );
}

function TranslationItem({
  r,
  s,
  lang,
  canLinguistic,
  canReligious,
  open,
  onOpen,
  onChange,
  locale,
}: {
  r: Row;
  s: ReturnType<typeof getPlayerStrings>["studio"];
  lang: string;
  canLinguistic: boolean;
  canReligious: boolean;
  open: boolean;
  onOpen: () => void;
  onChange: () => void;
  locale: string;
}) {
  const act = useAction();
  const [comment, setComment] = useState("");
  const current = r.translation_reviews.filter((v) => v.script_version === r.version);
  const state = (aspect: string) => current.filter((v) => v.aspect === aspect).at(-1)?.decision ?? "—";
  const decide = (aspect: "linguistic" | "religious", decision: string) =>
    act.run(() => call("/api/admin/studio/translation-review", "POST", { scriptId: r.id, aspect, decision, comment: comment || undefined }), `${aspect}: ${decision}`, onChange);
  return (
    <li className="pp-card st-script">
      <div className="st-row st-between">
        <h3 className="st-h3" dir="auto">
          {r.title}
        </h3>
        <EditorialStatus status={r.status} />
      </div>
      <p className="zq-meta">{`${lang} · ${s.version} ${r.version} · ${s.sourceVersion}${r.translated_from_version}${r.model ? ` · ${r.model}` : ""}`}</p>
      <p className="zq-meta">{`${s.linguistic}: ${state("linguistic")} · ${s.religious}: ${state("religious")}`}</p>
      <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" aria-expanded={open} onClick={onOpen}>
        {s.preview}
      </button>
      {open ? <StudioPreview scriptId={r.id} locale={locale} /> : null}
      {canLinguistic || canReligious ? (
        <>
          <Field label={s.comment}>
            <textarea className="zq-textarea" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
          </Field>
          {canLinguistic ? (
            <div className="st-row" role="group" aria-label={s.linguistic}>
              <span className="zq-meta">{s.linguistic}</span>
              <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" disabled={act.busy} onClick={() => void decide("linguistic", "approved")}>
                {s.approve}
              </button>
              <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy} onClick={() => void decide("linguistic", "changes_requested")}>
                {s.changes}
              </button>
            </div>
          ) : null}
          {canReligious ? (
            <div className="st-row" role="group" aria-label={s.religious}>
              <span className="zq-meta">{s.religious}</span>
              <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" disabled={act.busy} onClick={() => void decide("religious", "approved")}>
                {s.approve}
              </button>
              <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={act.busy} onClick={() => void decide("religious", "changes_requested")}>
                {s.changes}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      <Feedback msg={act.msg} />
    </li>
  );
}
