"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "@/styles/timeline.css";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { TRACK_IDS, type TrackId } from "@/lib/events/tracks";
import { TrackIcon } from "@/components/timeline/TrackIcon";

/**
 * Editorial workspace for the Event Universe: add a draft shell, correct fields, manage verse references, cited
 * identification/order/dating claims and connections, merge two events, and move an event through the workflow. Every
 * action goes through /api/admin/events/universe (editor role) and the database guards; nothing here can publish
 * without approved claims and review.
 */
interface Row {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  track: TrackId;
  category: string;
  status: string;
  ordering_kind: string;
  relative_position: number | null;
  name_source: string;
  dating_method: string | null;
  start_year: number | null;
  end_year: number | null;
  merged_into: string | null;
  event_verse_refs: Array<{ id: string; surah: number; ayah_from: number; ayah_to: number; claim_id: string | null }>;
  event_identifications: Array<{ id: string; kind: string; subject: string; view: string; standing: string; status: string }>;
}

async function call(method: string, body?: unknown, url = "/api/admin/events/universe") {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

const STATUSES: EditorialState[] = ["draft", "in_review", "approved", "published", "correction", "rejected"];
const PAGE = 60;

export function UniverseAdmin({ canEdit, canDate }: { canEdit: boolean; canDate: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setError("Not configured");
    const { data, error: e } = await c
      .from("historical_events")
      .select("id, slug, title, title_ar, track, category, status, ordering_kind, relative_position, name_source, dating_method, start_year, end_year, merged_into, event_verse_refs(id, surah, ayah_from, ayah_to, claim_id), event_identifications(id, kind, subject, view, standing, status)")
      .not("track", "is", null)
      .order("track")
      .order("title")
      .limit(1000);
    if (e) setError(e.message);
    else setRows((data ?? []) as unknown as Row[]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: ok });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };

  const shown = useMemo(() => (rows ?? []).filter((r) => (!track || r.track === track) && (!status || r.status === status) && (!q || `${r.title} ${r.slug}`.toLowerCase().includes(q.toLowerCase()))), [rows, track, status, q]);
  const current = rows?.find((r) => r.id === sel) ?? null;

  if (error) return <p className="zq-error" role="alert">Could not load: {error}</p>;
  if (!rows) return <Skeleton height={24} />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}
      <div className="tl-admin-grid">
        <section aria-labelledby="ua-list" style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <h2 id="ua-list" style={{ font: "500 20px/28px var(--font-display)", margin: 0 }}>
            Inventory ({shown.length} of {rows.length})
          </h2>
          <div className="tl-admin-form">
            <div className="row">
              <label className="zq-field">
                <span>Track</span>
                <select className="zq-input" value={track} onChange={(e) => (setTrack(e.target.value), setLimit(PAGE))}>
                  <option value="">All</option>
                  {TRACK_IDS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="zq-field">
                <span>Status</span>
                <select className="zq-input" value={status} onChange={(e) => (setStatus(e.target.value), setLimit(PAGE))}>
                  <option value="">All</option>
                  {[...STATUSES, "archived"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="zq-field" style={{ flex: 1 }}>
                <span>Search</span>
                <input className="zq-input" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} placeholder="Title or slug" />
              </label>
            </div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {shown.slice(0, limit).map((r) => (
              <li key={r.id}>
                <button type="button" className="tl-admin-row" aria-pressed={sel === r.id} onClick={() => setSel(r.id)}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} data-track={r.track}>
                    <TrackIcon track={r.track} size={16} />
                    <b>{r.title}</b>
                  </span>
                  <span className="zq-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <EditorialStatus status={r.status as EditorialState} />
                    <span>{r.ordering_kind.replace(/_/g, " ")}</span>
                    <span>{r.event_verse_refs.length} refs</span>
                    {r.name_source === "later_tradition" ? <span>name: later tradition</span> : null}
                    {r.merged_into ? <span>merged</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length > limit ? (
            <button type="button" className="zq-btn zq-btn-secondary" onClick={() => setLimit(limit + PAGE)}>
              Show {Math.min(PAGE, shown.length - limit)} more
            </button>
          ) : null}
          {canEdit ? <NewShell onDone={act} /> : null}
        </section>

        <section aria-labelledby="ua-detail" style={{ minWidth: 0 }}>
          {current ? (
            <Detail key={current.id} row={current} all={rows} canEdit={canEdit} canDate={canDate} act={act} />
          ) : (
            <EmptyState title="Choose an event">
              <p>Select an inventory item to correct it, add verses and cited claims, merge it, or move it through review. Drafts are never public.</p>
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>;

function NewShell({ onDone }: { onDone: Act }) {
  const [refs, setRefs] = useState("");
  return (
    <form
      className="tl-admin-form pp-card"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "").trim();
        const parsed = refs
          .split(/[\n;]/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => /^(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?$/.exec(l));
        if (!parsed.length || parsed.some((m) => !m)) return void onDone(() => Promise.reject(new Error("Give references such as 5:27-31, one per line.")), "");
        void onDone(
          () =>
            call("POST", {
              action: "create",
              slug: s("slug"),
              title: s("title"),
              track: s("track"),
              category: s("category"),
              nameSource: s("nameSource"),
              refs: parsed.map((m) => ({ surah: Number(m![1]), from: Number(m![2]), to: Number(m![3] ?? m![2]) })),
            }),
          "Draft shell added. It is not public until reviewed.",
        );
      }}
    >
      <h3 style={{ margin: 0 }}>Add a draft item</h3>
      <p className="zq-meta" style={{ margin: 0 }}>Title, track and verse references only. References are checked against the Quran text.</p>
      <label className="zq-field"><span>Title</span><input name="title" className="zq-input" required minLength={2} maxLength={200} /></label>
      <label className="zq-field"><span>Slug</span><input name="slug" className="zq-input" required pattern="[a-z0-9\-]{2,80}" placeholder="lowercase-with-hyphens" /></label>
      <div className="row">
        <label className="zq-field"><span>Track</span><select name="track" className="zq-input">{TRACK_IDS.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="zq-field"><span>Era</span><select name="category" className="zq-input"><option value="sacred_history">Sacred history</option><option value="prophetic_life">Life of the Prophet</option><option value="islamic_history">Islamic history</option></select></label>
        <label className="zq-field"><span>Names</span><select name="nameSource" className="zq-input"><option value="quran">All in the Quranic text</option><option value="later_tradition">A name from later tradition</option></select></label>
      </div>
      <label className="zq-field"><span>Verses (one range per line)</span><textarea className="zq-input" rows={3} value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="5:27-31" /></label>
      <button type="submit" className="zq-btn zq-btn-primary">Add draft</button>
    </form>
  );
}

function Detail({ row, all, canEdit, canDate, act }: { row: Row; all: Row[]; canEdit: boolean; canDate: boolean; act: Act }) {
  const [kind, setKind] = useState(row.ordering_kind);
  const locked = row.status === "published";
  const others = all.filter((r) => r.id !== row.id && r.track === row.track && !r.merged_into && r.status !== "archived");
  const post = (body: Record<string, unknown>, ok: string) => act(() => call("POST", body), ok);
  const move = (status: string, note?: string) => act(() => call("POST", { entityType: "event", entityId: row.id, status, revisionNote: note }, "/api/admin/status"), `Moved to ${status}.`);
  return (
    <div style={{ display: "grid", gap: 16 }} data-testid="ua-detail">
      <header>
        <h2 id="ua-detail" style={{ font: "500 24px/32px var(--font-display)", margin: 0 }}>{row.title}</h2>
        <p className="zq-meta" style={{ margin: 0, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <EditorialStatus status={row.status as EditorialState} /> <code>{row.slug}</code>
        </p>
      </header>

      {canEdit ? (
        <form
          className="tl-admin-form pp-card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const s = (k: string) => String(f.get(k) ?? "").trim();
            const n = (k: string) => (s(k) === "" ? undefined : Number(s(k)));
            void post(
              {
                action: "update",
                id: row.id,
                title: s("title"),
                track: s("track"),
                category: s("category"),
                nameSource: s("nameSource"),
                orderingKind: s("orderingKind"),
                relativePosition: n("relativePosition"),
                startYear: n("startYear"),
                endYear: n("endYear"),
                datingMethod: s("datingMethod") || undefined,
              },
              "Saved.",
            );
          }}
        >
          <h3 style={{ margin: 0 }}>Correct</h3>
          {locked ? <p className="zq-meta" style={{ margin: 0 }}>Published: track, order and dating are fixed. Start a correction first (below).</p> : null}
          <label className="zq-field"><span>Title</span><input name="title" className="zq-input" defaultValue={row.title} /></label>
          <div className="row">
            <label className="zq-field"><span>Track</span><select name="track" className="zq-input" defaultValue={row.track}>{TRACK_IDS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="zq-field"><span>Era</span><select name="category" className="zq-input" defaultValue={row.category}><option value="sacred_history">Sacred history</option><option value="prophetic_life">Life of the Prophet</option><option value="islamic_history">Islamic history</option></select></label>
            <label className="zq-field"><span>Names</span><select name="nameSource" className="zq-input" defaultValue={row.name_source}><option value="quran">In the Quranic text</option><option value="later_tradition">From later tradition</option></select></label>
          </div>
          <div className="row">
            <label className="zq-field">
              <span>Ordering</span>
              <select name="orderingKind" className="zq-input" value={kind} onChange={(e) => setKind(e.target.value)} disabled={row.track === "parables"}>
                <option value="unassigned">{row.track === "parables" ? "No historical date assigned" : "Order not established"}</option>
                <option value="relative">Relative order (needs a cited ordering claim)</option>
                <option value="disputed">Order disputed (needs two cited views)</option>
                <option value="dated_estimate">Historians&apos; dated estimate (seerah and major events only)</option>
              </select>
            </label>
            {kind === "relative" ? <label className="zq-field"><span>Position in the track (ordering only)</span><input name="relativePosition" type="number" min={0} className="zq-input" defaultValue={row.relative_position ?? ""} required /></label> : null}
          </div>
          {kind === "dated_estimate" ? (
            <div className="row">
              <label className="zq-field"><span>From (CE; BCE as 0 or negative)</span><input name="startYear" type="number" className="zq-input" defaultValue={row.start_year ?? ""} required /></label>
              <label className="zq-field"><span>To (CE)</span><input name="endYear" type="number" className="zq-input" defaultValue={row.end_year ?? ""} /></label>
              <label className="zq-field" style={{ flex: 1 }}><span>Dating method (named in the cited publication)</span><input name="datingMethod" className="zq-input" defaultValue={row.dating_method ?? ""} required minLength={3} /></label>
            </div>
          ) : null}
          <button type="submit" className="zq-btn zq-btn-primary" disabled={locked}>Save</button>
        </form>
      ) : null}

      <section className="pp-card tl-admin-form" aria-labelledby="ua-verses">
        <h3 id="ua-verses" style={{ margin: 0 }}>Verses ({row.event_verse_refs.length})</h3>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {row.event_verse_refs.map((v) => (
            <li key={v.id}>
              <a href={`/quran/${v.surah}#ayah-${v.ayah_from}${v.ayah_to > v.ayah_from ? `-${v.ayah_to}` : ""}`}>
                <span dir="ltr">{v.surah}:{v.ayah_from}{v.ayah_to > v.ayah_from ? `–${v.ayah_to}` : ""}</span>
              </a>{" "}
              <span className="zq-meta">{v.claim_id ? "claim attached" : "no claim yet"}</span>{" "}
              {canEdit && !locked ? <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => post({ action: "remove_verse", id: v.id }, "Reference removed.")}>Remove</button> : null}
            </li>
          ))}
        </ul>
        {canEdit && !locked ? (
          <>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const m = /^(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?$/.exec(String(f.get("ref") ?? "").trim());
                if (!m) return void act(() => Promise.reject(new Error("Use a reference such as 5:27-31.")), "");
                void post({ action: "add_verse", eventId: row.id, ref: { surah: Number(m[1]), from: Number(m[2]), to: Number(m[3] ?? m[2]) } }, "Reference added.");
                e.currentTarget.reset();
              }}
            >
              <label className="zq-field"><span>Add a verse range</span><input name="ref" className="zq-input" placeholder="5:27-31" /></label>
              <button type="submit" className="zq-btn zq-btn-secondary">Add</button>
            </form>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const claimId = String(new FormData(e.currentTarget).get("claimId") ?? "").trim();
                void post({ action: "attach_claim", eventId: row.id, claimId }, "Claim attached to the references without one.");
              }}
            >
              <label className="zq-field" style={{ flex: 1 }}><span>Attach an approved claim (id) as the evidence of the verses</span><input name="claimId" className="zq-input" placeholder="claim id" /></label>
              <button type="submit" className="zq-btn zq-btn-secondary">Attach</button>
            </form>
          </>
        ) : null}
      </section>

      <section className="pp-card tl-admin-form" aria-labelledby="ua-ident">
        <h3 id="ua-ident" style={{ margin: 0 }}>Identification, name, order and dating claims ({row.event_identifications.length})</h3>
        <p className="zq-meta" style={{ margin: 0 }}>A traditional identification or a name the passage does not give is a separate cited claim, never part of the event. A relative order needs one ordering claim, a disputed order two views, a dated estimate a dating claim with a named publication.</p>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {row.event_identifications.map((i) => (
            <li key={i.id}>
              <b>{i.kind}</b> · {i.subject}: {i.view} <span className="zq-meta">({i.standing.replace(/_/g, " ")}, {i.status})</span>
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form
            className="tl-admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const s = (k: string) => String(f.get(k) ?? "").trim();
              const claimId = s("claimId");
              void post(
                {
                  action: "add_identification",
                  eventId: row.id,
                  kind: s("kind"),
                  subject: s("subject"),
                  view: s("view"),
                  standing: s("standing"),
                  ...(claimId ? { claimId } : { claim: { statement: s("statement"), evidence: s("evidence"), references: [{ kind: s("refKind"), sourceId: s("sourceId"), locator: s("locator") }] } }),
                },
                "Claim added as a draft. A scholarly reviewer approves it in the review queue.",
              );
            }}
          >
            <div className="row">
              <label className="zq-field"><span>Kind</span><select name="kind" className="zq-input"><option>identification</option><option>name</option><option>ordering</option><option>dating</option></select></label>
              <label className="zq-field"><span>Standing</span><select name="standing" className="zq-input"><option value="disputed">Disputed</option><option value="widely_held">Widely held</option><option value="minority">Minority view</option><option value="later_tradition">Later tradition</option></select></label>
            </div>
            <label className="zq-field"><span>Subject</span><input name="subject" className="zq-input" required minLength={2} placeholder="What is being identified or ordered" /></label>
            <label className="zq-field"><span>View</span><input name="view" className="zq-input" required minLength={2} placeholder="The view, in neutral words" /></label>
            <label className="zq-field"><span>Existing claim id (or fill the new claim below)</span><input name="claimId" className="zq-input" /></label>
            <label className="zq-field"><span>New claim: statement</span><input name="statement" className="zq-input" /></label>
            <div className="row">
              <label className="zq-field"><span>Evidence class</span><select name="evidence" className="zq-input"><option value="scholar">Scholar</option><option value="hadith">Hadith</option><option value="estimate">Historians&apos; estimate (class C)</option><option value="disputed">Disputed</option><option value="unknown">Unknown</option></select></label>
              <label className="zq-field"><span>Reference</span><select name="refKind" className="zq-input"><option>scholar</option><option>history</option><option>tafsir</option></select></label>
              <label className="zq-field"><span>Source id</span><input name="sourceId" className="zq-input" /></label>
              <label className="zq-field"><span>Locator</span><input name="locator" className="zq-input" placeholder="page, section" /></label>
            </div>
            <button type="submit" className="zq-btn zq-btn-secondary">Add claim</button>
          </form>
        ) : null}
      </section>

      {canEdit ? (
        <section className="pp-card tl-admin-form" aria-labelledby="ua-flow">
          <h3 id="ua-flow" style={{ margin: 0 }}>Workflow</h3>
          <div className="row">
            {row.status === "draft" ? <button type="button" className="zq-btn zq-btn-secondary" onClick={() => move("in_review")}>Send for review</button> : null}
            {row.status !== "published" ? <button type="button" className="zq-btn zq-btn-secondary" onClick={() => move("published")}>Publish</button> : null}
            {row.status === "published" ? (
              <button
                type="button"
                className="zq-btn zq-btn-secondary"
                onClick={() => {
                  const note = window.prompt("Public revision note: what is being corrected and why?") ?? "";
                  if (note.trim().length >= 3) void move("correction", note);
                }}
              >
                Start a correction
              </button>
            ) : null}
          </div>
          <p className="zq-meta" style={{ margin: 0 }}>The scholarly review is recorded in the <Link href="/admin/review">review queue</Link>. The database refuses to publish without approved claims, verse references on approved claims, and the review{canDate ? "; a dated estimate also needs the historical/scientific review" : ""}.</p>
        </section>
      ) : null}

      {canEdit ? (
        <section className="pp-card tl-admin-form" aria-labelledby="ua-merge">
          <h3 id="ua-merge" style={{ margin: 0 }}>Merge</h3>
          <p className="zq-meta" style={{ margin: 0 }}>Two events that are the same: this one is archived and its address redirects to the other. Claims, verse references, identifications and connections move over.</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const targetId = String(f.get("target") ?? "");
              const t = others.find((o) => o.id === targetId);
              if (!t || !window.confirm(`Merge "${row.title}" into "${t.title}"? This archives "${row.title}".`)) return;
              void post({ action: "merge", sourceId: row.id, targetId, reason: String(f.get("reason") ?? "").trim() || undefined }, "Merged. The old address now redirects.");
            }}
          >
            <label className="zq-field" style={{ flex: 1 }}>
              <span>Merge into (same track)</span>
              <select name="target" className="zq-input" required defaultValue="">
                <option value="" disabled>Choose the event to keep</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </label>
            <label className="zq-field" style={{ flex: 1 }}><span>Reason</span><input name="reason" className="zq-input" maxLength={500} /></label>
            <button type="submit" className="zq-btn zq-btn-secondary" disabled={row.status === "archived"}>Merge</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
