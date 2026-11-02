"use client";

import { useCallback, useEffect, useState } from "react";
import { partnersT } from "@/lib/i18n/modules/partners";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Skeleton } from "@/components/ui/misc";
import { apiCall, Feedback, type Msg } from "@/components/mufti/api";
import { AreaField, SelectField, TextField } from "./fields";
import { Pill, regionName } from "./shared";
import { TRACKS, VERIFICATION_KINDS } from "@/lib/partners/constants";
import { CategoryInput } from "@/lib/partners/validation";
import type { CategoryRow, QualificationRow, VerificationRow } from "@/lib/partners/types";

type T = ReturnType<typeof partnersT>;
interface Listing {
  id: string;
  slug: string;
  display_name: string;
  provider_type: string;
  country: string;
  city: string | null;
  listing_status: string;
  submitted_at: string | null;
}
interface Report {
  id: string;
  partner_id: string;
  reason: string;
  details: string | null;
  status: string;
  decision_note: string | null;
  created_at: string;
  learning_partners: { display_name: string; slug: string } | Array<{ display_name: string; slug: string }> | null;
}
interface Audit {
  id: number;
  actor: string | null;
  partner_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  at: string;
}

const TABS = ["queue", "taxonomy", "reports", "audit"] as const;
const OPEN_STATES = ["submitted", "under_verification", "information_requested", "changes_requested"];
const STAFF_MOVES: Record<string, string[]> = {
  submitted: ["under_verification", "information_requested", "changes_requested", "suspended"],
  under_verification: ["information_requested", "changes_requested", "suspended"],
  approved: ["suspended"],
};
const ADMIN_MOVES: Record<string, string[]> = {
  submitted: ["approved", "rejected"],
  under_verification: ["approved", "rejected"],
  suspended: ["approved", "under_verification"],
  rejected: ["under_verification"],
};

/** Review console for Learning Partners. Moderators and administrators read (RLS); the database function decides who may move what. */
export function AdminPartners({ locale }: { locale: string }) {
  const t = partnersT(locale);
  const [tab, setTab] = useState<(typeof TABS)[number]>("queue");
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (sb) void sb.rpc("has_role", { r: "admin" }).then((r) => setIsAdmin(r.data === true));
  }, []);
  return (
    <section className="pt" data-testid="admin-partners">
      <h2>{t.admin.title}</h2>
      <p className="zq-meta">{t.admin.lead}</p>
      <div className="pt-tabs" role="tablist" aria-label={t.admin.title}>
        {TABS.filter((k) => k !== "audit" || isAdmin).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} id={`ap-tab-${k}`} aria-controls="ap-panel" className="zq-btn" onClick={() => setTab(k)} style={tab === k ? { borderColor: "var(--brand)" } : undefined}>
            {t.admin.tabs[k]}
          </button>
        ))}
      </div>
      <div id="ap-panel" role="tabpanel" aria-labelledby={`ap-tab-${tab}`}>
        {tab === "queue" ? <Queue t={t} locale={locale} isAdmin={isAdmin} /> : null}
        {tab === "taxonomy" ? <Taxonomy t={t} isAdmin={isAdmin} /> : null}
        {tab === "reports" ? <Reports t={t} locale={locale} /> : null}
        {tab === "audit" && isAdmin ? <AuditLog t={t} locale={locale} /> : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ Queue
function Queue({ t, locale, isAdmin }: { t: T; locale: string; isAdmin: boolean }) {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("open");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return setError(true);
    const { data, error: e } = await sb.from("learning_partners").select("id, slug, display_name, provider_type, country, city, listing_status, submitted_at").order("submitted_at", { ascending: true, nullsFirst: false }).limit(200);
    if (e) setError(true);
    else setRows((data ?? []) as Listing[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <p className="zq-error" role="alert">
        {t.loadError}
      </p>
    );
  if (!rows) return <Skeleton height={120} />;
  const shown = rows.filter((r) => (filter === "all" ? true : filter === "open" ? OPEN_STATES.includes(r.listing_status) : r.listing_status === filter));
  return (
    <div className="pt-sec">
      <SelectField
        id="aq-filter"
        label={t.admin.filter}
        value={filter}
        onChange={setFilter}
        options={[["open", t.admin.open], ...Object.entries(t.listingStatus), ["all", t.admin.all]] as Array<[string, string]>}
      />
      {!shown.length ? (
        <p className="zq-meta">{t.admin.empty}</p>
      ) : (
        <ul className="pt-list" data-testid="review-queue">
          {shown.map((r) => (
            <li key={r.id} className="pt-card">
              <div className="pt-pills">
                <Pill tone={r.listing_status === "approved" ? "ok" : "warn"}>{t.listingStatus[r.listing_status]}</Pill>
                <Pill>{t.providerTypes[r.provider_type]}</Pill>
              </div>
              <h3 dir="auto">{r.display_name}</h3>
              <p className="pt-meta">
                {[r.city, regionName(r.country, locale)].filter(Boolean).join(", ")}
                {r.submitted_at ? ` · ${t.admin.submitted} ${new Date(r.submitted_at).toLocaleDateString(locale)}` : ""}
              </p>
              <div className="pt-actions">
                <button type="button" className="zq-btn" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  {open === r.id ? t.admin.close : t.admin.view}
                </button>
              </div>
              {open === r.id ? <Detail t={t} listing={r} isAdmin={isAdmin} reload={load} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Detail({ t, listing, isAdmin, reload }: { t: T; listing: Listing; isAdmin: boolean; reload: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [scope, setScope] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [vers, setVers] = useState<VerificationRow[]>([]);
  const [quals, setQuals] = useState<QualificationRow[]>([]);
  const [priv, setPriv] = useState<null | { contacts: Array<{ id: string; kind: string; value: string; is_public: boolean }>; docs: Array<{ qualification_id: string; storage_path: string }>; inquiries: number }>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const loadParts = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const [v, q] = await Promise.all([
      sb.from("partner_verifications").select("id, partner_id, kind, status, scope_statement, requested_at, decided_at").eq("partner_id", listing.id),
      sb.from("partner_qualifications").select("id, partner_id, kind, title, issuer, year, claim, status, show_publicly").eq("partner_id", listing.id),
    ]);
    setVers((v.data ?? []) as VerificationRow[]);
    setQuals((q.data ?? []) as QualificationRow[]);
  }, [listing.id]);
  useEffect(() => {
    void loadParts();
  }, [loadParts]);

  const act = async (fn: () => Promise<unknown>, after?: () => Promise<void>) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: t.admin.done });
      await loadParts();
      if (after) await after();
    } catch (e) {
      setMsg({ tone: "err", text: `${t.failedPrefix} ${(e as Error).message}` });
    }
  };
  const moves = [...(STAFF_MOVES[listing.listing_status] ?? []), ...(isAdmin ? (ADMIN_MOVES[listing.listing_status] ?? []) : [])];
  const showPrivate = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    await act(async () => {
      for (const what of ["contacts", "documents", "inquiries"]) await apiCall(`/api/admin/partners/${listing.id}/access`, "POST", { what });
      const [c, f, i] = await Promise.all([
        sb.from("partner_contact_methods").select("id, kind, value, is_public").eq("partner_id", listing.id),
        sb.from("partner_qualification_files").select("qualification_id, storage_path").eq("partner_id", listing.id),
        sb.from("partner_inquiries").select("id", { count: "exact", head: true }).eq("partner_id", listing.id),
      ]);
      setPriv({ contacts: (c.data ?? []) as never, docs: (f.data ?? []) as never, inquiries: i.count ?? 0 });
    });
  };
  const openDoc = async (path: string) => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data, error } = await sb.storage.from("partner-docs").createSignedUrl(path, 60);
    if (error || !data) return setMsg({ tone: "err", text: `${t.failedPrefix} ${error?.message ?? ""}` });
    setDocUrl(data.signedUrl);
  };

  return (
    <div className="pt-sec" data-testid="review-detail">
      <AreaField id={`an-${listing.id}`} label={t.admin.note} value={note} onChange={setNote} rows={3} maxLength={1000} />
      <div className="pt-actions">
        {moves.map((to) => (
          <button key={to} type="button" className="zq-btn" onClick={() => void act(() => apiCall(`/api/partners/${listing.id}/transition`, "POST", { to, ...(note.trim() ? { note: note.trim() } : {}) }), async () => { setNote(""); await reload(); })}>
            {t.admin.actions[to]}
          </button>
        ))}
        {!isAdmin && (listing.listing_status === "submitted" || listing.listing_status === "under_verification") ? <span className="zq-meta">{t.admin.adminOnly}</span> : null}
      </div>
      <Feedback msg={msg} />

      <h3>{t.admin.verifyTitle}</h3>
      <ul className="pt-list">
        {VERIFICATION_KINDS.map((k) => {
          const v = vers.find((x) => x.kind === k);
          if (!v) return (
            <li key={k} className="zq-meta">
              {t.provider.verificationKinds[k]}: {t.none}
            </li>
          );
          const locked = k === "religious_scholarly" && !isAdmin;
          const next = v.status === "requested" ? ["in_review", "verified", "rejected"] : v.status === "in_review" ? ["verified", "rejected"] : v.status === "verified" ? ["revoked"] : [];
          return (
            <li key={k} className="pt-card">
              <b>{t.provider.verificationKinds[k]}</b> <Pill tone={v.status === "verified" ? "ok" : undefined}>{t.dashboard.verStatus[v.status]}</Pill>
              {locked ? <p className="zq-meta">{t.admin.adminOnlyKind}</p> : null}
              {!locked && next.length ? (
                <>
                  <TextField id={`sc-${v.id}`} label={t.admin.scope} value={scope} onChange={setScope} maxLength={400} />
                  <div className="pt-actions">
                    {next.map((to) => (
                      <button key={to} type="button" className="zq-btn" onClick={() => void act(() => apiCall(`/api/admin/partners/${listing.id}/verification`, "POST", { kind: k, status: to, ...(note.trim() ? { note: note.trim() } : {}), ...(scope.trim() ? { scope: scope.trim() } : {}) }))}>
                        {t.admin.verifyActions[to]}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>

      <h3>{t.admin.qualReview}</h3>
      {!quals.length ? <p className="zq-meta">{t.admin.empty}</p> : null}
      <ul className="pt-list">
        {quals.map((q) => (
          <li key={q.id} className="pt-card">
            <b dir="auto">{q.title}</b> <Pill tone={q.status === "verified" ? "ok" : undefined}>{t.dashboard.qualStatus[q.status]}</Pill>
            <p className="pt-meta">{[q.issuer, q.year].filter(Boolean).join(" · ")}</p>
            {q.claim ? <p dir="auto">{q.claim}</p> : null}
            <div className="pt-actions">
              {(["verified", "rejected", "unverified"] as const).filter((s) => s !== q.status).map((s) => (
                <button key={s} type="button" className="zq-btn" onClick={() => void act(() => apiCall(`/api/admin/partners/qualifications/${q.id}`, "POST", { status: s, ...(note.trim() ? { note: note.trim() } : {}) }))}>
                  {t.admin.qualActions[s]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <h3>{t.admin.private}</h3>
      {!priv ? (
        <div className="pt-actions">
          <button type="button" className="zq-btn" onClick={() => void showPrivate()}>
            {t.admin.showPrivate}
          </button>
        </div>
      ) : (
        <div className="pt-sec">
          <p className="zq-meta">{t.admin.privateLogged}</p>
          <ul className="pt-list">
            {priv.contacts.map((c) => (
              <li key={c.id} dir="auto">
                <b>{t.contactKinds[c.kind]}:</b> {c.value} <Pill>{c.is_public ? t.dashboard.contactPublic : t.dashboard.contactPrivate}</Pill>
              </li>
            ))}
          </ul>
          {!priv.docs.length ? <p className="zq-meta">{t.admin.noDocument}</p> : null}
          <ul className="pt-list">
            {priv.docs.map((d) => (
              <li key={d.qualification_id}>
                <button type="button" className="zq-btn" onClick={() => void openDoc(d.storage_path)}>
                  {t.admin.documentOpen}
                </button>
              </li>
            ))}
          </ul>
          {docUrl ? (
            <a href={docUrl} target="_blank" rel="noopener noreferrer" className="zq-btn">
              {t.admin.documentOpen}
            </a>
          ) : null}
          <p className="pt-meta">
            {t.dashboard.tabs.inquiries}: {priv.inquiries}
          </p>
        </div>
      )}
      <p className="pt-meta" dir="ltr">
        /partners/{listing.slug}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Taxonomy
function Taxonomy({ t, isAdmin }: { t: T; isAdmin: boolean }) {
  const [rows, setRows] = useState<CategoryRow[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [n, setN] = useState({ slug: "", track: "quran", name_en: "", name_ar: "", name_ur: "", sort_order: "100" });
  const [mergeInto, setMergeInto] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.from("partner_service_categories").select("id, slug, track, name_en, name_ar, name_ur, active, sort_order, merged_into").order("track").order("sort_order");
    setRows((data ?? []) as CategoryRow[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: t.admin.done });
      await load();
      return true;
    } catch (e) {
      setMsg({ tone: "err", text: `${t.failedPrefix} ${(e as Error).message}` });
      return false;
    }
  };
  if (!rows) return <Skeleton height={120} />;
  const live = rows.filter((r) => r.active && !r.merged_into);
  return (
    <div className="pt-sec">
      <p className="zq-meta">{t.admin.taxonomyLead}</p>
      {!isAdmin ? <p className="qa-notice">{t.admin.adminOnly}</p> : null}
      <Feedback msg={msg} />
      <div className="pt-scroll">
        <table className="pt-table">
          <caption className="zq-meta">{t.admin.tabs.taxonomy}</caption>
          <thead>
            <tr>
              <th scope="col">{t.admin.slug}</th>
              <th scope="col">{t.admin.track}</th>
              <th scope="col">{t.admin.nameEn}</th>
              <th scope="col">{t.admin.nameAr}</th>
              <th scope="col">{t.admin.nameUr}</th>
              <th scope="col">{t.admin.active}</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td dir="ltr">{r.slug}</td>
                <td>{t.tracks[r.track]}</td>
                <td dir="ltr">{r.name_en}</td>
                <td dir="rtl">{r.name_ar}</td>
                <td dir="rtl">{r.name_ur}</td>
                <td>{r.merged_into ? t.admin.merged : r.active ? t.yes : t.admin.hidden}</td>
                <td>
                  {isAdmin && !r.merged_into ? (
                    <div className="pt-actions">
                      <button type="button" className="zq-btn" onClick={() => void act(() => apiCall(`/api/admin/partners/categories?id=${r.id}`, "PATCH", { active: !r.active }))}>
                        {r.active ? t.admin.hidden : t.admin.active}
                      </button>
                      {r.active ? (
                        <>
                          <select aria-label={`${t.admin.merge}: ${r.name_en}`} className="zq-input" value={mergeInto[r.id] ?? ""} onChange={(e) => setMergeInto({ ...mergeInto, [r.id]: e.target.value })}>
                            <option value="">{t.admin.merge}…</option>
                            {live.filter((x) => x.id !== r.id).map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name_en}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="zq-btn" disabled={!mergeInto[r.id]} onClick={() => void act(() => apiCall("/api/admin/partners/categories", "PUT", { from: r.id, into: mergeInto[r.id] }))}>
                            {t.admin.mergeAction}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin ? (
        <form
          className="pt-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = CategoryInput.safeParse({ ...n, sort_order: Number(n.sort_order) });
            if (!body.success) return setMsg({ tone: "err", text: body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
            if (await act(() => apiCall("/api/admin/partners/categories", "POST", body.data))) setN({ slug: "", track: "quran", name_en: "", name_ar: "", name_ur: "", sort_order: "100" });
          }}
        >
          <div className="pt-row">
            <TextField id="tx-slug" label={t.admin.slug} value={n.slug} onChange={(v) => setN({ ...n, slug: v })} dir="ltr" required maxLength={60} />
            <SelectField id="tx-track" label={t.admin.track} value={n.track} onChange={(v) => setN({ ...n, track: v })} options={TRACKS.map((k) => [k, t.tracks[k]!] as [string, string])} />
            <TextField id="tx-sort" label={t.admin.sort} type="number" value={n.sort_order} onChange={(v) => setN({ ...n, sort_order: v })} />
          </div>
          <div className="pt-row">
            <TextField id="tx-en" label={t.admin.nameEn} value={n.name_en} onChange={(v) => setN({ ...n, name_en: v })} dir="ltr" required maxLength={120} />
            <TextField id="tx-ar" label={t.admin.nameAr} value={n.name_ar} onChange={(v) => setN({ ...n, name_ar: v })} dir="rtl" required maxLength={120} />
            <TextField id="tx-ur" label={t.admin.nameUr} value={n.name_ur} onChange={(v) => setN({ ...n, name_ur: v })} dir="rtl" required maxLength={120} />
          </div>
          <div className="pt-actions">
            <button type="submit" className="zq-btn zq-btn-primary">
              {t.add}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ Reports
function Reports({ t, locale }: { t: T; locale: string }) {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const { data } = await sb.from("partner_reports").select("id, partner_id, reason, details, status, decision_note, created_at, learning_partners(display_name, slug)").order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as unknown as Report[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!rows) return <Skeleton height={120} />;
  return (
    <div className="pt-sec">
      <p className="zq-meta">{t.admin.reportsLead}</p>
      <Feedback msg={msg} />
      {!rows.length ? <p className="zq-meta">{t.admin.empty}</p> : null}
      <ul className="pt-list">
        {rows.map((r) => {
          const p = Array.isArray(r.learning_partners) ? r.learning_partners[0] : r.learning_partners;
          const next = r.status === "open" ? ["reviewing", "actioned", "dismissed"] : r.status === "reviewing" ? ["actioned", "dismissed"] : [];
          return (
            <li key={r.id} className="pt-card">
              <div className="pt-pills">
                <Pill tone={r.status === "open" ? "warn" : undefined}>{t.admin.reportStatus[r.status]}</Pill>
                <Pill>{t.report.reasons[r.reason]}</Pill>
              </div>
              <h3 dir="auto">{p?.display_name}</h3>
              <p className="pt-meta">{new Date(r.created_at).toLocaleDateString(locale)}</p>
              {r.details ? <p dir="auto">{r.details}</p> : null}
              {r.decision_note ? <p dir="auto"><b>{t.admin.decisionNote}: </b>{r.decision_note}</p> : null}
              {next.length ? (
                <>
                  <AreaField id={`rn-${r.id}`} label={t.admin.decisionNote} value={note[r.id] ?? ""} onChange={(v) => setNote({ ...note, [r.id]: v })} rows={2} maxLength={1000} />
                  <div className="pt-actions">
                    {next.map((to) => (
                      <button
                        key={to}
                        type="button"
                        className="zq-btn"
                        onClick={async () => {
                          setMsg(null);
                          try {
                            await apiCall(`/api/admin/partners/reports/${r.id}`, "PATCH", { status: to, ...(note[r.id]?.trim() ? { note: note[r.id]!.trim() } : {}) });
                            setMsg({ tone: "ok", text: t.admin.done });
                            await load();
                          } catch (e) {
                            setMsg({ tone: "err", text: `${t.failedPrefix} ${(e as Error).message}` });
                          }
                        }}
                      >
                        {t.admin.reportActions[to]}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Audit log
function AuditLog({ t, locale }: { t: T; locale: string }) {
  const [rows, setRows] = useState<Audit[] | null>(null);
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    void sb.from("partner_audit_logs").select("id, actor, partner_id, action, entity_type, entity_id, at").order("at", { ascending: false }).limit(200).then((r) => setRows((r.data ?? []) as Audit[]));
  }, []);
  if (!rows) return <Skeleton height={120} />;
  return (
    <div className="pt-sec">
      <p className="zq-meta">{t.admin.auditLead}</p>
      {!rows.length ? <p className="zq-meta">{t.admin.empty}</p> : null}
      <div className="pt-scroll">
        <table className="pt-table" data-testid="audit-table">
          <caption className="zq-meta">{t.admin.tabs.audit}</caption>
          <thead>
            <tr>
              <th scope="col">{t.admin.auditCols.when}</th>
              <th scope="col">{t.admin.auditCols.action}</th>
              <th scope="col">{t.admin.auditCols.what}</th>
              <th scope="col">{t.admin.auditCols.who}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.at).toLocaleString(locale)}</td>
                <td dir="ltr">{r.action}</td>
                <td dir="ltr">{r.entity_type}</td>
                <td dir="ltr">{r.actor ? r.actor.slice(0, 8) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
