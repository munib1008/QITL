"use client";

import { useRouter } from "next/navigation";
import "@/styles/science.css";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminScienceStrings } from "@/lib/i18n/modules/adminScience";
import { EVIDENCE_STATES } from "@/lib/science/model";
import { AdminFeedback as Feedback, errMsg, type AdminMsg } from "./feedback";

export interface ScienceAdminRow {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  status: string;
  visibility: string;
  integrity_status: string;
  scholarly_status: string;
  scientific_review: string;
  version: number;
  classification_version: number;
  needs_rereview: boolean;
  rereview_reason: string | null;
}
export interface SciencePublicationRow {
  id: string;
  topic: string;
  title: string;
  doi: string | null;
  year: number | null;
  verified: boolean;
  verified_source: string | null;
}
export interface ScienceMilestoneRow {
  id: string;
  topic: string;
  discovery: string;
  label: string;
  year: number | null;
  verified_source: string | null;
}
export interface ScienceClaimRow {
  id: string;
  topic: string;
  claim: string;
  evidence_state: string;
}
export interface ScienceHistoryRow {
  id: string;
  topic: string;
  topic_version: number;
  action: string;
  created_at: string;
}

type Tab = "registry" | "evidence" | "scientific" | "scholarly" | "versions";

async function call(body: unknown) {
  const r = await fetch("/api/admin/science", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

/**
 * The Quran & Science console: registry, citation and date verification, the two separate reviews, and the revision history. Each
 * tab offers only what the viewer's role may try; the API routes and the database check every action again (RLS, the guards, the
 * appointed-role rule, no self-review, two different approvers).
 */
export function ScienceAdmin({ rows, publications, milestones, claims, history, canEdit, canScience, canScholarly }: {
  rows: ScienceAdminRow[];
  publications: SciencePublicationRow[];
  milestones: ScienceMilestoneRow[];
  claims: ScienceClaimRow[];
  history: ScienceHistoryRow[];
  canEdit: boolean;
  canScience: boolean;
  canScholarly: boolean;
}) {
  const locale = useLocale();
  const t = adminScienceStrings(locale);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("registry");
  const [msg, setMsg] = useState<AdminMsg>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [src, setSrc] = useState("");
  const [note, setNote] = useState("");
  const [claimId, setClaimId] = useState("");
  const [state, setState] = useState<string>(EVIDENCE_STATES[0]);
  const [rationale, setRationale] = useState("");

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
  const tabs: Tab[] = ["registry", "evidence", "scientific", "scholarly", "versions"];
  const btn = (label: string, onClick: () => void, key?: string) => (
    <button key={key} type="button" className="sc-btn" disabled={busy} onClick={onClick}>
      {label}
    </button>
  );
  const name = (r: { title_en: string; title_ar: string }) => (locale === "ar" ? r.title_ar : r.title_en);
  const flagged = rows.filter((r) => r.needs_rereview);
  const waitingSci = rows.filter((r) => r.scientific_review !== "approved");
  const waitingSch = rows.filter((r) => r.scholarly_status !== "approved");
  const reviewButtons = (kind: "scientific" | "scholarly", id: string) =>
    (["approved", "changes_requested", "rejected"] as const).map((d) =>
      btn(d === "approved" ? t.review.approve : d === "changes_requested" ? t.review.changes : t.review.reject, () => act({ action: kind === "scientific" ? "review_scientific" : "review_scholarly", id, decision: d, comment: comment || undefined }), `${id}-${d}`),
    );

  return (
    <div className="sc-sections" data-testid="science-admin">
      <section aria-labelledby="sa-roles-h">
        <h2 id="sa-roles-h" className="zq-eyebrow">
          {t.roles.heading}
        </h2>
        <ul>
          {canEdit ? <li>{t.roles.editor}</li> : null}
          {canScience ? <li>{t.roles.science}</li> : null}
          {canScholarly ? <li>{t.roles.scholarly}</li> : null}
          {!canEdit && !canScience && !canScholarly ? <li>{t.roles.none}</li> : null}
        </ul>
      </section>
      <div role="tablist" aria-label={t.tabs.registry} className="sc-tabs">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-controls={`sa-${k}`} id={`sa-tab-${k}`} className="sc-tab" onClick={() => setTab(k)}>
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <Feedback msg={msg} />

      {tab === "registry" ? (
        <section id="sa-registry" role="tabpanel" aria-labelledby="sa-tab-registry">
          <h2 className="zq-eyebrow">{t.registry.heading}</h2>
          {rows.length === 0 ? (
            <p>{t.registry.empty}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="zq-table" data-testid="registry-table">
                <thead>
                  <tr>
                    {(["topic", "status", "visibility", "integrity", "scientific", "scholarly", "version", "flags", "actions"] as const).map((c) => (
                      <th key={c} scope="col">
                        {t.registry.columns[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{name(r)}</th>
                      <td>{t.registry.statuses[r.status as keyof typeof t.registry.statuses] ?? r.status}</td>
                      <td>{t.registry.visibilities[r.visibility as keyof typeof t.registry.visibilities] ?? r.visibility}</td>
                      <td>{t.registry.integrities[r.integrity_status as keyof typeof t.registry.integrities] ?? r.integrity_status}</td>
                      <td>{t.registry.reviewStatuses[r.scientific_review as keyof typeof t.registry.reviewStatuses] ?? r.scientific_review}</td>
                      <td>{t.registry.reviewStatuses[r.scholarly_status as keyof typeof t.registry.reviewStatuses] ?? r.scholarly_status}</td>
                      <td dir="ltr">
                        v{r.version} · c{r.classification_version}
                      </td>
                      <td>{r.needs_rereview ? t.registry.rereview : ""}</td>
                      <td>
                        {canEdit ? (
                          <div className="sc-actions">
                            {btn(t.registry.runCheck, () => act({ action: "integrity", id: r.id }), `${r.id}-i`)}
                            {r.integrity_status === "passed" && r.visibility === "private_draft" ? btn(t.registry.makePublic, () => act({ action: "publish_ai", id: r.id }), `${r.id}-p`) : null}
                            {r.visibility === "public_ai_draft" || r.status === "published" ? btn(t.registry.withdraw, () => act({ action: "withdraw", id: r.id, reason: reason || undefined }), `${r.id}-w`) : null}
                            {r.status === "draft" ? btn(t.registry.toReview, () => act({ action: "status", id: r.id, status: "in_review" }), `${r.id}-s`) : null}
                            {r.status === "in_review" ? btn(t.registry.publish, () => act({ action: "status", id: r.id, status: "published" }), `${r.id}-pub`) : null}
                            {r.status === "published" ? btn(t.registry.correction, () => act({ action: "status", id: r.id, status: "correction" }), `${r.id}-c`) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canEdit ? (
            <div className="sc-field">
              <label htmlFor="sa-reason">{t.registry.withdrawReason}</label>
              <input id="sa-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "evidence" ? (
        <section id="sa-evidence" role="tabpanel" aria-labelledby="sa-tab-evidence">
          <h2 className="zq-eyebrow">{t.evidence.heading}</h2>
          <p>{t.evidence.intro}</p>
          <h3>{t.evidence.publications}</h3>
          {publications.length === 0 ? (
            <p>{t.evidence.noPublications}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="zq-table" data-testid="publications-table">
                <thead>
                  <tr>
                    {(["title", "doi", "year", "source", "state", "action"] as const).map((c) => (
                      <th key={c} scope="col">
                        {t.evidence.columns[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {publications.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">
                        <span lang="en" dir="ltr">
                          {p.title}
                        </span>
                      </th>
                      <td dir="ltr">{p.doi ?? "—"}</td>
                      <td dir="ltr">{p.year ?? t.evidence.noYear}</td>
                      <td dir="ltr">{p.verified_source ?? "—"}</td>
                      <td>{p.verified ? t.evidence.verified : t.evidence.notVerified}</td>
                      <td>{canScience && !p.verified ? btn(t.evidence.verify, () => act({ action: "verify_publication", id: p.id, source: src, note }), p.id) : canScience ? null : t.evidence.needsRole}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canScience ? (
            <div className="sc-filters">
              <div className="sc-field">
                <label htmlFor="sa-src">{t.evidence.sourceUrl}</label>
                <input id="sa-src" type="url" dir="ltr" value={src} onChange={(e) => setSrc(e.target.value)} />
              </div>
              <div className="sc-field">
                <label htmlFor="sa-note">{t.evidence.sourceNote}</label>
                <input id="sa-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />
              </div>
            </div>
          ) : null}
          <h3>{t.evidence.milestones}</h3>
          {milestones.length === 0 ? (
            <p>{t.evidence.noMilestones}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="zq-table" data-testid="milestones-table">
                <thead>
                  <tr>
                    {(["discovery", "milestone", "year", "source"] as const).map((c) => (
                      <th key={c} scope="col">
                        {t.evidence.columns[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">
                        <span lang="en" dir="ltr">
                          {m.discovery}
                        </span>
                      </th>
                      <td>
                        <span lang="en" dir="ltr">
                          {m.label}
                        </span>
                      </td>
                      <td dir="ltr">{m.year ?? t.evidence.noYear}</td>
                      <td dir="ltr">{m.verified_source ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "scientific" || tab === "scholarly" ? (
        <section id={`sa-${tab}`} role="tabpanel" aria-labelledby={`sa-tab-${tab}`}>
          <h2 className="zq-eyebrow">{t.review[tab].heading}</h2>
          <p>{t.review[tab].intro}</p>
          <p className="sc-note">{t.review.separate}</p>
          {(tab === "scientific" ? canScience : canScholarly) ? (
            <div className="sc-field">
              <label htmlFor="sa-comment">{t.review.comment}</label>
              <input id="sa-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
            </div>
          ) : (
            <p role="note">{t.review[tab].needsRole}</p>
          )}
          {flagged.length ? (
            <>
              <h3>{t.review.flagged}</h3>
              <ul>
                {flagged.map((r) => (
                  <li key={r.id}>
                    {name(r)}
                    {r.rereview_reason ? <> · <span lang="en" dir="ltr">{r.rereview_reason}</span></> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3>{t.review.waiting}</h3>
          {(tab === "scientific" ? waitingSci : waitingSch).length === 0 ? (
            <p>{t.review.none}</p>
          ) : (
            <ul className="sc-list">
              {(tab === "scientific" ? waitingSci : waitingSch).map((r) => (
                <li key={r.id}>
                  <b>{name(r)}</b>
                  <span className="sc-note">
                    v{r.version} · {t.registry.reviewStatuses[(tab === "scientific" ? r.scientific_review : r.scholarly_status) as keyof typeof t.registry.reviewStatuses]}
                  </span>
                  {(tab === "scientific" ? canScience : canScholarly) ? <div className="sc-actions">{reviewButtons(tab, r.id)}</div> : null}
                </li>
              ))}
            </ul>
          )}
          {tab === "scientific" && canScience ? (
            <div className="sc-filters">
              <h3 className="sc-wide">{t.review.scientific.assessHeading}</h3>
              <div className="sc-field">
                <label htmlFor="sa-claim">{t.review.scientific.claim}</label>
                <select id="sa-claim" value={claimId} onChange={(e) => setClaimId(e.target.value)}>
                  <option value="">—</option>
                  {claims.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.topic}: {c.claim.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sc-field">
                <label htmlFor="sa-state">{t.review.scientific.state}</label>
                <select id="sa-state" value={state} onChange={(e) => setState(e.target.value)}>
                  {EVIDENCE_STATES.map((s) => (
                    <option key={s} value={s}>
                      {t.review.evidenceStates[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sc-field">
                <label htmlFor="sa-rationale">{t.review.scientific.rationale}</label>
                <input id="sa-rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} maxLength={2000} />
              </div>
              {btn(t.review.scientific.assess, () => act({ action: "assess", claim_id: claimId, state, rationale }))}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "versions" ? (
        <section id="sa-versions" role="tabpanel" aria-labelledby="sa-tab-versions">
          <h2 className="zq-eyebrow">{t.versions.heading}</h2>
          <p className="sc-note">{t.versions.note}</p>
          {history.length === 0 ? (
            <p>{t.versions.empty}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="zq-table" data-testid="history-table">
                <thead>
                  <tr>
                    {(["topic", "version", "action", "when"] as const).map((c) => (
                      <th key={c} scope="col">
                        {t.versions.columns[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <th scope="row">{h.topic}</th>
                      <td dir="ltr">v{h.topic_version}</td>
                      <td dir="ltr">{h.action}</td>
                      <td dir="ltr">{h.created_at.slice(0, 16).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
