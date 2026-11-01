"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminLicencesStrings } from "@/lib/i18n/modules/adminLicences";
import { AdminFeedback as Feedback, ServerText, errMsg, type AdminMsg } from "./feedback";
import { ASSET_TYPES, PERMISSION_STATUSES, RIWAYAH_IDS, TRISTATE, permissionAllowed, riwayahLabel, type PermissionStatus } from "@/lib/qiraat/model";

interface Row {
  permission_id: string;
  source_id: string;
  work: string;
  publisher: string | null;
  asset_type: string;
  scope: string;
  status: PermissionStatus;
  rights_holder: string | null;
  official_url: string | null;
  edition_version: string | null;
  riwayah_id: string | null;
  qiraah_riwayah_note: string | null;
  licence_ref: string | null;
  commercial_use: string;
  local_hosting: string;
  modification: string;
  offline_distribution: string;
  derivative_sync: string;
  attribution_required: boolean | null;
  attribution_text: string | null;
  api_cache_limits: string | null;
  obligations: string | null;
  conditions: string | null;
  evidence_url: string | null;
  evidence_summary: string | null;
  evidence_checked_on: string | null;
  notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

type Form = Record<string, string | boolean | null>;

const TEXT_FIELDS: Array<[string, string, "input" | "area"]> = [
  ["rights_holder", "Rights holder", "input"],
  ["official_url", "Official URL (https)", "input"],
  ["edition_version", "Edition / version", "input"],
  ["qiraah_riwayah_note", "Qira'ah / riwayah as the provider names it", "input"],
  ["licence_ref", "Licence or written-permission reference", "input"],
  ["attribution_text", "Attribution text (shown with the content)", "area"],
  ["conditions", "Conditions", "area"],
  ["api_cache_limits", "API / caching limits", "area"],
  ["obligations", "Renewal / reporting obligations", "area"],
  ["evidence_url", "Evidence URL (https)", "input"],
  ["evidence_summary", "What the evidence says", "area"],
  ["evidence_checked_on", "Evidence checked on (YYYY-MM-DD)", "input"],
  ["notes", "Notes", "area"],
];
const TRI_FIELDS: Array<[string, string]> = [
  ["commercial_use", "Commercial use"],
  ["local_hosting", "Local hosting"],
  ["modification", "Modification"],
  ["offline_distribution", "Offline distribution"],
  ["derivative_sync", "Derivative / sync use"],
];

const blank = (): Form => ({ source_id: "", asset_type: "text", scope: "all", status: "PERMISSION_REQUIRED", riwayah_id: "", attribution_required: null, verify: false, ...Object.fromEntries(TRI_FIELDS.map(([k]) => [k, "unknown"])) });

/**
 * The content licence registry (admins). Nothing is APPROVED because it is downloadable: APPROVED needs a licence or
 * written-permission reference and evidence, and the database stamps the acting admin as the verifier.
 */
export function LicencesAdmin({ isAdmin }: { isAdmin: boolean }) {
  const locale = useLocale();
  const t = useMemo(() => adminLicencesStrings(locale), [locale]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sources, setSources] = useState<Array<{ id: string; work: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setError(t.notConfigured);
    const [r, s] = await Promise.all([
      c.from("content_licence_registry").select("*").order("work").order("asset_type").order("scope"),
      c.from("sources").select("id, work").order("work"),
    ]);
    if (r.error) setError(r.error.message);
    else setRows((r.data ?? []) as Row[]);
    setSources((s.data ?? []) as Array<{ id: string; work: string }>);
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: string, v: string | boolean | null) => setForm((f) => ({ ...f, [k]: v }));
  const edit = (r: Row) => {
    setEditing(r.permission_id);
    const f: Form = { verify: false };
    for (const [k, v] of Object.entries(r)) f[k] = typeof v === "boolean" || v === null ? v : String(v);
    setForm(f);
    setMsg(null);
  };
  const save = async () => {
    setMsg(null);
    const data: Record<string, unknown> = {};
    for (const k of ["source_id", "asset_type", "scope", "status", "riwayah_id", "attribution_required", "verify", ...TEXT_FIELDS.map(([k]) => k), ...TRI_FIELDS.map(([k]) => k)]) data[k] = form[k] === "" ? null : form[k];
    const res = await fetch("/api/admin/licences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editing ?? undefined, data }) });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setMsg(errMsg(locale, t.failedPrefix, d.error ?? `Request failed (${res.status})`));
    setMsg({ tone: "ok", text: editing ? t.okSaved : t.okAdded });
    setEditing(null);
    setForm(blank());
    await load();
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? (
        <p className="zq-error" role="alert">
          {t.couldNotLoad} {error === t.notConfigured ? error : <ServerText>{error}</ServerText>}
        </p>
      ) : !rows ? (
        <Skeleton height={20} />
      ) : !rows.length ? (
        <EmptyState title={t.noRows} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }} data-testid="licence-rows">
          {rows.map((r) => (
            <li key={r.permission_id} className="pp-card" data-status={r.status}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="zq-eyebrow">
                  {t.assetTypes[r.asset_type] ?? r.asset_type} · {r.scope}
                </span>
                <b>{t.statuses[r.status] ?? r.status.replace("_", " ")}</b>
                <span className={permissionAllowed(r) ? "zq-help" : "zq-licence-pending"}>{permissionAllowed(r) ? t.allowedDisplay : t.notAllowedDisplay}</span>
              </div>
              <p style={{ margin: 0 }}>
                {r.work}
                {r.riwayah_id ? ` · ${riwayahLabel(r.riwayah_id)}` : r.qiraah_riwayah_note ? ` · ${r.qiraah_riwayah_note}` : ""}
              </p>
              {r.conditions ? <p className="zq-meta" style={{ margin: 0 }}>{t.conditionsLabel} {r.conditions}</p> : null}
              <p className="zq-meta" style={{ margin: 0 }}>
                {t.evidenceLabel} {r.evidence_url ? <a href={r.evidence_url} rel="noopener noreferrer" target="_blank">{r.evidence_url}</a> : t.noneLower()}
                {r.evidence_checked_on ? t.readOn(r.evidence_checked_on) : ""} · {r.verified_at ? t.verifiedOn(r.verified_at.slice(0, 10)) : t.notVerified}
              </p>
              {isAdmin ? (
                <div>
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => edit(r)}>
                    {t.edit}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isAdmin ? (
        <form
          className="pp-card"
          style={{ display: "grid", gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 style={{ margin: 0, font: "600 20px/28px var(--font-sans)" }}>{editing ? t.editPermission : t.addPermission}</h2>
          <div className="zq-field">
            <label htmlFor="lic-source">{t.source}</label>
            <select id="lic-source" className="zq-input" value={String(form.source_id ?? "")} onChange={(e) => set("source_id", e.target.value)} required>
              <option value="">{t.chooseSource}</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.work}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="zq-field">
              <label htmlFor="lic-asset">{t.assetType}</label>
              <select id="lic-asset" className="zq-input" value={String(form.asset_type)} onChange={(e) => set("asset_type", e.target.value)}>
                {ASSET_TYPES.map((a) => (
                  <option key={a} value={a}>{t.assetTypes[a] ?? a}</option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="lic-scope">{t.scope}</label>
              <input id="lic-scope" className="zq-input" value={String(form.scope ?? "")} onChange={(e) => set("scope", e.target.value)} />
            </div>
            <div className="zq-field">
              <label htmlFor="lic-status">{t.status}</label>
              <select id="lic-status" className="zq-input" value={String(form.status)} onChange={(e) => set("status", e.target.value)}>
                {PERMISSION_STATUSES.map((s) => (
                  <option key={s} value={s}>{t.statuses[s] ?? s}</option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="lic-riwayah">{t.riwayah}</label>
              <select id="lic-riwayah" className="zq-input" value={String(form.riwayah_id ?? "")} onChange={(e) => set("riwayah_id", e.target.value)}>
                <option value="">{t.noneSeveral}</option>
                {RIWAYAH_IDS.map((r) => (
                  <option key={r} value={r}>
                    {riwayahLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            {TRI_FIELDS.map(([k, label]) => (
              <div className="zq-field" key={k}>
                <label htmlFor={`lic-${k}`}>{t.fields[k] ?? label}</label>
                <select id={`lic-${k}`} className="zq-input" value={String(form[k] ?? "unknown")} onChange={(e) => set(k, e.target.value)}>
                  {TRISTATE.map((s) => (
                    <option key={s} value={s}>
                      {t.tristate[s] ?? s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="zq-field">
              <label htmlFor="lic-attr">{t.attributionRequired}</label>
              <select id="lic-attr" className="zq-input" value={form.attribution_required === null ? "" : String(form.attribution_required)} onChange={(e) => set("attribution_required", e.target.value === "" ? null : e.target.value === "true")}>
                <option value="">{t.notStated}</option>
                <option value="true">{t.yesCap}</option>
                <option value="false">{t.noCap}</option>
              </select>
            </div>
          </div>
          {TEXT_FIELDS.map(([k, label, kind]) => (
            <div className="zq-field" key={k}>
              <label htmlFor={`lic-${k}`}>{t.fields[k] ?? label}</label>
              {kind === "area" ? (
                <textarea id={`lic-${k}`} className="zq-input" rows={3} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
              ) : (
                <input id={`lic-${k}`} className="zq-input" value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
              )}
            </div>
          ))}
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={Boolean(form.verify)} onChange={(e) => set("verify", e.target.checked)} /> {t.verifyCheck}
          </label>
              <Feedback msg={msg} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="zq-btn zq-btn-primary">
              {editing ? t.save : t.add}
            </button>
            {editing ? (
              <button
                type="button"
                className="zq-btn zq-btn-secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(blank());
                }}
              >
                {t.cancel}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="zq-meta">{t.adminOnly}</p>
      )}
    </div>
  );
}
