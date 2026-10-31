"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { RIWAYAH_IDS, VARIANT_KINDS, permissionAllowed, riwayahLabel, type PermissionStatus } from "@/lib/qiraat/model";
import type { EditorKind } from "@/lib/qiraat/editor";

type Opt = { value: string; label: string };
interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "area" | "select" | "checkbox";
  options?: Opt[];
  required?: boolean;
  help?: string;
}

async function call(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

/** A small generic form: one field list per editor kind, posted to /api/admin/qiraat. */
function KindForm({ kind, title, fields, onSaved, initial }: { kind: EditorKind; title: string; fields: Field[]; onSaved: () => void; initial?: Record<string, unknown> }) {
  const [v, setV] = useState<Record<string, unknown>>(initial ?? {});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const id = (k: string) => `q-${kind}-${k}`;
  return (
    <form
      className="pp-card"
      style={{ display: "grid", gap: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        const data = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x]));
        try {
          await call("/api/admin/qiraat", "POST", { kind, data });
          setMsg({ tone: "ok", text: "Saved as a draft." });
          setV(initial ?? {});
          onSaved();
        } catch (err) {
          setMsg({ tone: "err", text: (err as Error).message });
        }
      }}
    >
      <h3 style={{ margin: 0, font: "600 17px/24px var(--font-sans)" }}>{title}</h3>
      {fields.map((f) => (
        <div className="zq-field" key={f.key}>
          {f.type === "checkbox" ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={Boolean(v[f.key])} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} /> {f.label}
            </label>
          ) : (
            <>
              <label htmlFor={id(f.key)}>{f.label}</label>
              {f.type === "select" ? (
                <select id={id(f.key)} className="zq-input" required={f.required} value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                  <option value="">Choose…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "area" ? (
                <textarea id={id(f.key)} className="zq-input" rows={3} required={f.required} value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
              ) : (
                <input
                  id={id(f.key)}
                  className="zq-input"
                  type={f.type === "number" ? "number" : "text"}
                  required={f.required}
                  value={String(v[f.key] ?? "")}
                  onChange={(e) => setV({ ...v, [f.key]: f.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value })}
                />
              )}
            </>
          )}
          {f.help ? <span className="zq-help">{f.help}</span> : null}
        </div>
      ))}
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}
      <div>
        <button type="submit" className="zq-btn zq-btn-primary zq-btn-sm">
          Save draft
        </button>
      </div>
    </form>
  );
}

interface Data {
  variants: Array<{ id: string; status: EditorialState; surah: number; ayah: number; word_position: number; kind: string; qiraat_variant_readings: Array<{ id: string; riwayah_id: string; reading_text: string }>; qiraat_variant_claims: Array<{ claim_id: string }> }>;
  routes: Array<{ id: string; status: EditorialState; riwayah_id: string; name_translit: string }>;
  misconceptions: Array<{ id: string; status: EditorialState; question: string }>;
  reciters: Array<{ id: string; status: EditorialState; name_translit: string; name_ar: string | null }>;
  recordings: Array<{ id: string; status: EditorialState; riwayah_id: string; surah: number | null; url: string; is_comparison: boolean; reciters: { name_translit: string } | null }>;
  editions: Array<{ id: string; riwayah_id: string; title: string; content_permissions: { status: PermissionStatus; attribution_text: string | null } | null }>;
  claims: Array<{ id: string; statement: string; status: string }>;
  permissions: Array<{ id: string; source_id: string; scope: string; status: PermissionStatus; attribution_text: string | null; riwayah_id: string | null; sources: { work: string } | null }>;
  sources: Array<{ id: string; work: string }>;
  readers: Array<{ id: string; position: number; name_ar: string; name_translit: string; status: EditorialState }>;
  riwayat: Array<{ id: string; qiraah_id: string; position: number; name_ar: string; name_translit: string; status: EditorialState }>;
}

const riwayahOpts: Opt[] = RIWAYAH_IDS.map((r) => ({ value: r, label: riwayahLabel(r) }));

/**
 * Qira'at editors: variants (readings copied from a licensed edition, explanation claims), transmission routes,
 * misconceptions, reciters and recordings (permission-gated). Everything is saved as a draft; review and publishing go
 * through the review queue, and the database refuses anything its rules do not allow.
 */
export function QiraatAdmin({ canEdit, canReview }: { canEdit: boolean; canReview: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setError("Not configured");
    const [variants, routes, misconceptions, reciters, recordings, editions, claims, permissions, sources, readers, riwayat] = await Promise.all([
      c.from("qiraat_variants").select("id, status, surah, ayah, word_position, kind, qiraat_variant_readings(id, riwayah_id, reading_text), qiraat_variant_claims(claim_id)").order("surah").limit(200),
      c.from("transmission_routes").select("id, status, riwayah_id, name_translit").limit(200),
      c.from("qiraat_misconceptions").select("id, status, question").order("position").limit(200),
      c.from("reciters").select("id, status, name_translit, name_ar").limit(200),
      c.from("audio_recordings").select("id, status, riwayah_id, surah, url, is_comparison, reciters(name_translit)").limit(200),
      c.from("quran_text_editions").select("id, riwayah_id, title, content_permissions(status, attribution_text)"),
      c.from("evidence_claims").select("id, statement, status").in("status", ["approved", "published"]).limit(300),
      c.from("content_permissions").select("id, source_id, scope, status, attribution_text, riwayah_id, sources(work)").eq("asset_type", "recording"),
      c.from("sources").select("id, work").order("work"),
      c.from("qiraat").select("id, position, name_ar, name_translit, status").order("position"),
      c.from("riwayat").select("id, qiraah_id, position, name_ar, name_translit, status").order("position"),
    ]);
    const err = [variants, routes, misconceptions, reciters, recordings, editions, claims, permissions, sources, readers, riwayat].find((x) => x.error)?.error;
    if (err) return setError(err.message);
    setD({
      variants: (variants.data ?? []) as unknown as Data["variants"],
      routes: (routes.data ?? []) as Data["routes"],
      misconceptions: (misconceptions.data ?? []) as Data["misconceptions"],
      reciters: (reciters.data ?? []) as Data["reciters"],
      recordings: (recordings.data ?? []) as unknown as Data["recordings"],
      editions: (editions.data ?? []) as unknown as Data["editions"],
      claims: (claims.data ?? []) as Data["claims"],
      permissions: (permissions.data ?? []) as unknown as Data["permissions"],
      sources: (sources.data ?? []) as Data["sources"],
      readers: (readers.data ?? []) as Data["readers"],
      riwayat: (riwayat.data ?? []) as Data["riwayat"],
    });
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <p className="zq-error" role="alert">
        Could not load: {error}
      </p>
    );
  if (!d) return <Skeleton height={20} />;

  const editionOpts: Opt[] = d.editions.map((e) => ({ value: e.id, label: `${e.title} (${riwayahLabel(e.riwayah_id)})${permissionAllowed(e.content_permissions) ? "" : " — licence does not allow use"}` }));
  const claimOpts: Opt[] = d.claims.map((c) => ({ value: c.id, label: c.statement.slice(0, 120) }));
  const variantOpts: Opt[] = d.variants.filter((v) => v.status !== "published").map((v) => ({ value: v.id, label: `Q ${v.surah}:${v.ayah} word ${v.word_position} (${v.kind})` }));
  const permOpts: Opt[] = d.permissions.map((p) => ({
    value: p.id,
    label: `${p.sources?.work ?? "Source"} · ${p.scope} · ${p.status}${permissionAllowed(p) ? "" : " — not allowed for display yet"}`,
  }));
  const remove = async (body: unknown) => {
    setMsg(null);
    try {
      await call("/api/admin/qiraat", "DELETE", body);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const refAct = async (body: Record<string, unknown>) => {
    setMsg(null);
    try {
      await call("/api/admin/qiraat/reference", "POST", body);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const refRow = (kind: "reader" | "riwayah", r: { id: string; name_ar: string; name_translit: string; status: EditorialState }) => (
    <li key={kind + r.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span>
        {r.name_translit}{" "}
        <span lang="ar" dir="rtl">
          {r.name_ar}
        </span>
      </span>
      <EditorialStatus status={r.status} />
      {canReview && r.status !== "published" ? (
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => refAct({ action: "review", kind, id: r.id, decision: "approved" })}>
          Approve name
        </button>
      ) : null}
      {canEdit && r.status !== "published" ? (
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => refAct({ action: "status", kind, id: r.id, status: "published" })}>
          Publish
        </button>
      ) : null}
    </li>
  );

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={{ display: "grid", gap: 12 }} aria-labelledby="qa-ref-h">
        <h2 id="qa-ref-h" style={{ margin: 0 }}>
          Readers and transmitters
        </h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          Names only, seeded as drafts. A scholarly reviewer checks each name; it is published after that approval.
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {d.readers.map((r) => (
            <li key={r.id}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                {refRow("reader", r)}
                <li>
                  <ul style={{ margin: 0, display: "grid", gap: 4 }}>{d.riwayat.filter((w) => w.qiraah_id === r.id).map((w) => refRow("riwayah", w))}</ul>
                </li>
              </ul>
            </li>
          ))}
        </ul>
      </section>
      {msg ? (
        <p className="zq-error" role="alert">
          {msg}
        </p>
      ) : null}
      <section style={{ display: "grid", gap: 12 }} aria-labelledby="qa-var-h">
        <h2 id="qa-var-h" style={{ margin: 0 }}>
          Variants
        </h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          A reading is copied exactly from a licensed text edition of its riwayah; the database refuses text not found in that edition&apos;s ayah. Publishing needs two riwayat, approved
          explanation claims and a scholarly approval. Only Hafs (Tanzil) is licensed today, so no comparison can be completed yet.
        </p>
        {d.variants.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {d.variants.map((v) => (
              <li key={v.id} className="pp-card">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="zq-eyebrow">
                    Q {v.surah}:{v.ayah} · word {v.word_position} · {v.kind}
                  </span>
                  <EditorialStatus status={v.status} />
                </div>
                <ul style={{ margin: 0 }}>
                  {v.qiraat_variant_readings.map((r) => (
                    <li key={r.id}>
                      {riwayahLabel(r.riwayah_id)}:{" "}
                      <span lang="ar" dir="rtl">
                        {r.reading_text}
                      </span>{" "}
                      {canEdit && v.status !== "published" ? (
                        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => remove({ kind: "reading", id: r.id })}>
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="zq-meta" style={{ margin: 0 }}>
                  {v.qiraat_variant_claims.length} explanation claim(s)
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No variants yet." />
        )}
        {canEdit ? (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <KindForm
              kind="variant"
              title="New variant"
              onSaved={load}
              fields={[
                { key: "surah", label: "Surah", type: "number", required: true },
                { key: "ayah", label: "Ayah", type: "number", required: true },
                { key: "word_position", label: "Word position", type: "number", required: true },
                { key: "kind", label: "Kind", type: "select", required: true, options: VARIANT_KINDS.map((k) => ({ value: k, label: k.replace("_", " ") })) },
                { key: "editor_note", label: "Editor note (internal)", type: "area" },
              ]}
            />
            <KindForm
              kind="reading"
              title="Add a reading"
              onSaved={load}
              fields={[
                { key: "variant_id", label: "Variant", type: "select", required: true, options: variantOpts },
                { key: "riwayah_id", label: "Riwayah", type: "select", required: true, options: riwayahOpts },
                { key: "edition_id", label: "Text edition", type: "select", required: true, options: editionOpts },
                { key: "reading_text", label: "Reading (copy from the edition, never type)", required: true },
              ]}
            />
            <KindForm
              kind="variant_claim"
              title="Link an explanation claim"
              onSaved={load}
              fields={[
                { key: "variant_id", label: "Variant", type: "select", required: true, options: variantOpts },
                { key: "claim_id", label: "Approved claim", type: "select", required: true, options: claimOpts, help: "Only approved claims are listed. Write and review claims in the review queue." },
              ]}
            />
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 12 }} aria-labelledby="qa-routes-h">
        <h2 id="qa-routes-h" style={{ margin: 0 }}>
          Transmission routes (turuq)
        </h2>
        {d.routes.length ? (
          <ul style={{ margin: 0 }}>
            {d.routes.map((r) => (
              <li key={r.id}>
                {riwayahLabel(r.riwayah_id)} · {r.name_translit} <EditorialStatus status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No routes yet. Each route is entered with its citation." />
        )}
        {canEdit ? (
          <KindForm
            kind="route"
            title="New route"
            onSaved={load}
            fields={[
              { key: "riwayah_id", label: "Riwayah", type: "select", required: true, options: riwayahOpts },
              { key: "name_translit", label: "Route name (transliteration)", required: true },
              { key: "name_ar", label: "Route name (Arabic)" },
              { key: "description", label: "Description", type: "area" },
              { key: "claim_id", label: "Evidence claim", type: "select", options: claimOpts },
              { key: "source_id", label: "or a source", type: "select", options: d.sources.map((s) => ({ value: s.id, label: s.work })) },
              { key: "locator", label: "Locator in that source (volume, page)" },
            ]}
          />
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 12 }} aria-labelledby="qa-mis-h">
        <h2 id="qa-mis-h" style={{ margin: 0 }}>
          Misconceptions
        </h2>
        {d.misconceptions.length ? (
          <ul style={{ margin: 0 }}>
            {d.misconceptions.map((m) => (
              <li key={m.id}>
                {m.question} <EditorialStatus status={m.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No misconceptions yet." />
        )}
        {canEdit ? (
          <KindForm
            kind="misconception"
            title="New misconception"
            onSaved={load}
            fields={[
              { key: "question", label: "Question", required: true },
              { key: "claim_id", label: "Answering claim (approved)", type: "select", required: true, options: claimOpts },
              { key: "position", label: "Position", type: "number" },
            ]}
          />
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 12 }} aria-labelledby="qa-rec-h">
        <h2 id="qa-rec-h" style={{ margin: 0 }}>
          Reciters and recordings
        </h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          Names only for reciters. A recording needs the recording permission of its source for its riwayah; it is public only when that permission allows display, a scholarly reviewer approved it
          and its riwayah matches the text it is shown with (a mismatch only as an explained educational comparison).
        </p>
        {d.reciters.length ? (
          <ul style={{ margin: 0 }}>
            {d.reciters.map((r) => (
              <li key={r.id}>
                {r.name_translit} {r.name_ar ? <span lang="ar" dir="rtl">{r.name_ar}</span> : null} <EditorialStatus status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No reciters yet." />
        )}
        {d.recordings.length ? (
          <ul style={{ margin: 0 }}>
            {d.recordings.map((r) => (
              <li key={r.id}>
                {r.reciters?.name_translit ?? "Reciter"} · {riwayahLabel(r.riwayah_id)} · {r.surah ? `Surah ${r.surah}` : "whole Quran"}
                {r.is_comparison ? " · comparison" : ""} <EditorialStatus status={r.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No recordings yet." />
        )}
        {canEdit ? (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <KindForm
              kind="reciter"
              title="New reciter"
              onSaved={load}
              fields={[
                { key: "name_translit", label: "Name (transliteration)", required: true },
                { key: "name_ar", label: "Name (Arabic)" },
              ]}
            />
            <KindForm
              kind="recording"
              title="New recording"
              onSaved={load}
              initial={{ url_kind: "file", is_comparison: false }}
              fields={[
                { key: "reciter_id", label: "Reciter", type: "select", required: true, options: d.reciters.map((r) => ({ value: r.id, label: r.name_translit })) },
                { key: "riwayah_id", label: "Riwayah", type: "select", required: true, options: riwayahOpts },
                { key: "permission_id", label: "Recording permission", type: "select", required: true, options: permOpts },
                { key: "source_id", label: "Source (must match the permission's)", type: "select", required: true, options: d.sources.map((s) => ({ value: s.id, label: s.work })) },
                { key: "surah", label: "Surah (empty for a whole-Quran stream)", type: "number" },
                { key: "url", label: "File or stream URL (https)", required: true },
                { key: "url_kind", label: "URL kind", type: "select", options: [{ value: "file", label: "file" }, { value: "stream", label: "stream" }] },
                { key: "shown_with_edition_id", label: "Shown with text edition", type: "select", options: editionOpts },
                { key: "is_comparison", label: "Educational comparison (different riwayah from the text)", type: "checkbox" },
                { key: "comparison_note", label: "Why this comparison is shown", type: "area" },
              ]}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
