"use client";

import { useRouter } from "next/navigation";
import "@/styles/asma.css";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminAsmaStrings } from "@/lib/i18n/modules/adminAsma";
import { AdminFeedback as Feedback, errMsg, type AdminMsg } from "./feedback";

export interface AsmaAdminRow {
  id: string;
  slug: string;
  ar: string;
  transliteration: string;
  status: string;
  visibility: string;
  integrity_status: string;
  scholarly_status: string;
  version: number;
  classification_version: number;
  needs_rereview: boolean;
  rereview_reason: string | null;
}
export interface AsmaVerification {
  id: string;
  slug: string;
  measure: "A" | "B" | "C";
  stored: number | null;
  recomputed: number;
  hashStored: string | null;
  hashNow: string;
  result: "match" | "mismatch" | "hash" | "none";
}
export interface AsmaMethodology {
  version: string;
  edition_source: string;
  edition_version: string;
  edition_sha256: string;
  normalisation_policy: string;
  tokenisation_policy: string;
  query_version: string;
}

type Tab = "registry" | "counts" | "reviews" | "versions";

async function call(body: unknown) {
  const r = await fetch("/api/admin/asma", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

/**
 * The Asma' al-Husna research console: registry, verification of counts, review and versioning. It only offers what the
 * role may try; the API routes and the database check every action again (RLS, the publish guard, the reviewer rules).
 */
export function AsmaAdmin({ rows, verification, methodology, inclusions, canEdit, canReview, isAdmin }: {
  rows: AsmaAdminRow[];
  verification: AsmaVerification[] | null;
  methodology: AsmaMethodology | null;
  inclusions: Array<{ slug: string; measure: string; form: string; root: string | null }>;
  canEdit: boolean;
  canReview: boolean;
  isAdmin: boolean;
}) {
  const locale = useLocale();
  const t = adminAsmaStrings(locale);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("registry");
  const [msg, setMsg] = useState<AdminMsg>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await call(body);
      setMsg({ tone: "ok", text: t.ok });
      router.refresh();
    } catch (e) {
      setMsg(errMsg(locale, t.failedPrefix, e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  const tabs: Tab[] = ["registry", "counts", "reviews", "versions"];
  const bad = verification?.filter((v) => v.result === "mismatch" || v.result === "hash") ?? [];
  const flagged = rows.filter((r) => r.needs_rereview);
  const waiting = rows.filter((r) => r.scholarly_status !== "approved");
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button key={key} type="button" className="zq-btn zq-btn-secondary" disabled={busy} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div className="as-sections" data-testid="asma-admin">
      <div role="tablist" aria-label={t.tabs.registry} className="as-tabs">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-controls={`aa-${k}`} id={`aa-tab-${k}`} className="as-tab" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <Feedback msg={msg} />

      {tab === "registry" ? (
        <section id="aa-registry" role="tabpanel" aria-labelledby="aa-tab-registry">
          <h2 className="zq-eyebrow">{t.registry.heading}</h2>
          {rows.length === 0 ? (
            <p>{t.registry.empty}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="zq-table" data-testid="registry-table">
                <thead>
                  <tr>
                    {(["name", "status", "visibility", "integrity", "scholarly", "version", "flags", "actions"] as const).map((c) => (
                      <th key={c} scope="col">
                        {t.registry.columns[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <span lang="ar" dir="rtl">
                          {r.ar}
                        </span>{" "}
                        <span dir="ltr">{r.transliteration}</span>
                      </th>
                      <td>{t.registry.statuses[r.status as keyof typeof t.registry.statuses] ?? r.status}</td>
                      <td>{t.registry.visibilities[r.visibility as keyof typeof t.registry.visibilities] ?? r.visibility}</td>
                      <td>{t.registry.integrities[r.integrity_status as keyof typeof t.registry.integrities] ?? r.integrity_status}</td>
                      <td>{r.scholarly_status}</td>
                      <td dir="ltr">
                        v{r.version} · c{r.classification_version}
                      </td>
                      <td>{r.needs_rereview ? t.registry.rereview : ""}</td>
                      <td>
                        {canEdit ? (
                          <div className="as-actions">
                            {btn(t.registry.runCheck, () => act({ action: "integrity", type: "divine_name", id: r.id }))}
                            {r.visibility === "public_ai_draft"
                              ? btn(t.registry.withdraw, () => act({ action: "withdraw_ai", type: "divine_name", id: r.id }))
                              : r.integrity_status === "passed" && r.status !== "published"
                                ? btn(t.registry.makePublic, () => act({ action: "publish_ai", type: "divine_name", id: r.id }))
                                : null}
                            {r.status !== "published" ? btn(t.registry.publish, () => act({ action: "status", type: "divine_name", id: r.id, status: "published" })) : btn(t.registry.correction, () => act({ action: "status", type: "divine_name", id: r.id, status: "correction" }))}
                            {r.needs_rereview ? btn(t.registry.clearFlag, () => act({ action: "clear_flag", type: "divine_name", id: r.id })) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "counts" ? (
        <section id="aa-counts" role="tabpanel" aria-labelledby="aa-tab-counts">
          <h2 className="zq-eyebrow">{t.counts.heading}</h2>
          <p>{t.counts.lead}</p>
          {verification === null ? (
            <p role="alert">{t.counts.corpusUnavailable}</p>
          ) : verification.length === 0 ? (
            <p>{t.counts.none}</p>
          ) : (
            <>
              <p role="status" data-testid="verify-summary">
                {bad.length === 0 ? t.counts.summaryOk : t.counts.summaryBad}
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="zq-table" data-testid="verify-table">
                  <thead>
                    <tr>
                      {(["name", "measure", "stored", "recomputed", "result"] as const).map((c) => (
                        <th key={c} scope="col">
                          {t.counts.columns[c]}
                        </th>
                      ))}
                      <th scope="col">{t.registry.columns.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verification.map((v) => (
                      <tr key={`${v.id}-${v.measure}`}>
                        <th scope="row" dir="ltr">
                          {v.slug}
                        </th>
                        <td dir="ltr">{v.measure}</td>
                        <td dir="ltr">{v.stored ?? "—"}</td>
                        <td dir="ltr">{v.recomputed}</td>
                        <td>{v.result === "match" ? t.counts.match : v.result === "mismatch" ? t.counts.mismatch : v.result === "hash" ? t.counts.hashDiffers : t.counts.notComputed}</td>
                        <td>{isAdmin && v.measure === "A" && v.result !== "match" ? btn(t.counts.recount, () => act({ action: "recount", id: v.id })) : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === "reviews" ? (
        <section id="aa-reviews" role="tabpanel" aria-labelledby="aa-tab-reviews">
          <h2 className="zq-eyebrow">{t.reviews.heading}</h2>
          <p>{t.reviews.lead}</p>
          {!canReview ? <p>{t.reviews.onlyReviewer}</p> : null}
          {waiting.length === 0 ? (
            <p>{t.reviews.none}</p>
          ) : (
            <>
              {canReview ? (
                <div className="as-field">
                  <label htmlFor="aa-comment">{t.reviews.comment}</label>
                  <input id="aa-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
                </div>
              ) : null}
              <ul className="as-list" data-testid="review-queue">
                {waiting.map((r) => (
                  <li key={r.id}>
                    <span>
                      <span lang="ar" dir="rtl">
                        {r.ar}
                      </span>{" "}
                      <span dir="ltr">{r.transliteration}</span> · <span dir="ltr">v{r.version}</span> · {r.scholarly_status}
                    </span>
                    {canReview ? (
                      <div className="as-actions">
                        {btn(t.reviews.approve, () => act({ action: "review", type: "divine_name", id: r.id, decision: "approved", comment: comment || undefined }), "a")}
                        {btn(t.reviews.changes, () => act({ action: "review", type: "divine_name", id: r.id, decision: "changes_requested", comment: comment || undefined }), "c")}
                        {btn(t.reviews.reject, () => act({ action: "review", type: "divine_name", id: r.id, decision: "rejected", comment: comment || undefined }), "r")}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {tab === "versions" ? (
        <section id="aa-versions" role="tabpanel" aria-labelledby="aa-tab-versions">
          <h2 className="zq-eyebrow">{t.versions.heading}</h2>
          <p>{t.versions.note}</p>
          {methodology ? (
            <dl className="as-prov" data-testid="methodology">
              <dt>{t.versions.methodology}</dt>
              <dd dir="ltr">{methodology.version}</dd>
              <dt>{t.versions.edition}</dt>
              <dd dir="ltr">{`${methodology.edition_source} ${methodology.edition_version}`}</dd>
              <dt>{t.versions.checksum}</dt>
              <dd dir="ltr">
                <code>{methodology.edition_sha256}</code>
              </dd>
              <dt>{t.versions.policies}</dt>
              <dd dir="ltr">{`${methodology.normalisation_policy} · ${methodology.tokenisation_policy} · ${methodology.query_version}`}</dd>
            </dl>
          ) : (
            <p>{t.versions.none}</p>
          )}
          <h3>{t.versions.flagged}</h3>
          {flagged.length === 0 ? (
            <p>{t.versions.noneFlagged}</p>
          ) : (
            <ul className="as-list">
              {flagged.map((r) => (
                <li key={r.id}>
                  <span dir="ltr">{r.slug}</span>
                  <span className="zq-meta" lang="en" dir="ltr">
                    {r.rereview_reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3>{t.versions.inclusions}</h3>
          {inclusions.length === 0 ? (
            <p>{t.versions.noInclusions}</p>
          ) : (
            <ul className="as-list">
              {inclusions.map((i, k) => (
                <li key={k}>
                  <span dir="ltr">{`${i.slug} · ${i.measure} · ${i.form}${i.root ? ` · ${i.root}` : ""}`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
