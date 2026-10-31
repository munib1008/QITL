"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, EvidenceLabel, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton, TextField } from "@/components/ui/misc";
import type { EvidenceKind } from "@/content/journey";
import { loadGuidanceReviewables, type GuidanceReviewKind } from "./guidanceReview";
import { loadCreationReviewables, reviewEntityType, type CreationReviewKind } from "./creation-review";

/* ---------- shared ---------- */

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = (await r.json().catch(() => ({}))) as { error?: string; issues?: unknown };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

function useRows<T>(load: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }> | undefined) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const res = await load();
    if (!res) return setError("Not configured");
    if (res.error) setError(res.error.message);
    else setRows(res.data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, error, reload };
}

function Feedback({ msg }: { msg: { tone: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
      {msg.text}
    </p>
  );
}

function List<T>({ rows, error, empty, render }: { rows: T[] | null; error: string | null; empty: string; render: (r: T) => ReactNode }) {
  if (error) return <p className="zq-error" role="alert">Could not load: {error}</p>;
  if (!rows) return <Skeleton height={20} />;
  if (!rows.length) return <EmptyState title={empty} />;
  return <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>{rows.map(render)}</ul>;
}

const sb = () => getBrowserSupabase();

/* ---------- Review queue ---------- */

interface Reviewable {
  id: string;
  status: EditorialState;
  label: string;
  kind: "claim" | "event" | "story" | "chapter" | "relationship" | "place_geometry" | "person" | "story_section" | "quiz" | "media" | GuidanceReviewKind | CreationReviewKind;
  evidence?: EvidenceKind;
  detail?: string;
}

export function ReviewQueue({ canReview, canEdit }: { canReview: boolean; canEdit: boolean }) {
  const [items, setItems] = useState<Reviewable[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [history, setHistory] = useState<{ id: string; versions: Array<{ version: number; snapshot: Record<string, unknown>; created_at: string }> } | null>(null);

  const load = useCallback(async () => {
    const c = sb();
    if (!c) return;
    const open = ["draft", "in_review", "approved", "published", "correction", "rejected"];
    const [claims, events, stories, chapters, rels, geoms, people, sections, quizzes, media, guidance] = await Promise.all([
      c.from("evidence_claims").select("id, status, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator)").in("status", open).limit(100),
      c.from("historical_events").select("id, status, title, date_precision, category").in("status", open).limit(100),
      c.from("stories").select("id, status, title").in("status", open).limit(100),
      c.from("chapters").select("id, status, title, position, stories(title)").in("status", open).limit(100),
      c.from("relationships").select("id, status, kind, confidence").in("status", open).limit(100),
      c.from("place_geometries").select("id, status, precision, confidence, locations(name_en)").in("status", open).limit(100),
      c.from("people").select("id, status, name_en, name_ar, honorific").in("status", open).limit(200),
      c.from("story_sections").select("id, status, section, audience, value_text, known, body_md, people(name_en), historical_events(title)").in("status", open).limit(300),
      c.from("story_quizzes").select("id, status, title, audience").in("status", open).limit(100),
      c.from("story_media").select("id, status, role, animation_key, caption").in("status", open).limit(100),
      loadGuidanceReviewables(c, open),
    ]);
    const out: Reviewable[] = [];
    for (const r of (claims.data ?? []) as Array<{ id: string; status: EditorialState; statement: string; evidence: EvidenceKind; claim_references: Array<{ kind: string; quran_surah: number | null; quran_ayah_from: number | null; quran_ayah_to: number | null; locator: string | null }> }>)
      out.push({
        id: r.id,
        status: r.status,
        kind: "claim",
        label: r.statement,
        evidence: r.evidence,
        detail: r.claim_references.map((x) => (x.kind === "quran" ? `Q ${x.quran_surah}:${x.quran_ayah_from}${x.quran_ayah_to ? `–${x.quran_ayah_to}` : ""}` : `${x.kind}: ${x.locator ?? ""}`)).join(" · ") || "No references",
      });
    for (const r of (events.data ?? []) as Array<{ id: string; status: EditorialState; title: string; date_precision: string; category: string }>)
      out.push({ id: r.id, status: r.status, kind: "event", label: r.title, detail: `${r.category.replace(/_/g, " ")} · date ${r.date_precision}` });
    for (const r of (stories.data ?? []) as Array<{ id: string; status: EditorialState; title: string }>) out.push({ id: r.id, status: r.status, kind: "story", label: r.title });
    for (const r of (chapters.data ?? []) as unknown as Array<{ id: string; status: EditorialState; title: string; position: number; stories: { title: string } | null }>)
      out.push({ id: r.id, status: r.status, kind: "chapter", label: `${r.stories?.title ?? "Story"} · ${r.position}. ${r.title}` });
    for (const r of (rels.data ?? []) as Array<{ id: string; status: EditorialState; kind: string; confidence: EvidenceKind }>)
      out.push({ id: r.id, status: r.status, kind: "relationship", label: r.kind.replace(/_/g, " "), evidence: r.confidence });
    for (const r of (geoms.data ?? []) as unknown as Array<{ id: string; status: EditorialState; precision: string; confidence: EvidenceKind; locations: { name_en: string } | null }>)
      out.push({ id: r.id, status: r.status, kind: "place_geometry", label: `${r.locations?.name_en ?? "Place"} · ${r.precision}`, evidence: r.confidence });
    for (const r of (people.data ?? []) as Array<{ id: string; status: EditorialState; name_en: string; name_ar: string; honorific: string | null }>)
      out.push({ id: r.id, status: r.status, kind: "person", label: `${r.name_en} · ${r.name_ar}${r.honorific ? ` ${r.honorific}` : ""}`, detail: "Person record: check the name, Arabic name and honorific" });
    for (const r of (sections.data ?? []) as unknown as Array<{ id: string; status: EditorialState; section: string; audience: string; value_text: string | null; known: boolean; body_md: string; people: { name_en: string } | null; historical_events: { title: string } | null }>)
      out.push({
        id: r.id,
        status: r.status,
        kind: "story_section",
        label: `${r.people?.name_en ?? r.historical_events?.title ?? "Story"} · ${r.section.replace(/_/g, " ")} · ${r.audience}`,
        detail: r.known ? (r.value_text ?? r.body_md.slice(0, 240)) : "Not established",
      });
    for (const r of (quizzes.data ?? []) as Array<{ id: string; status: EditorialState; title: string; audience: string }>)
      out.push({ id: r.id, status: r.status, kind: "quiz", label: `Quiz: ${r.title} (${r.audience})` });
    for (const r of (media.data ?? []) as Array<{ id: string; status: EditorialState; role: string; animation_key: string | null; caption: string }>)
      out.push({ id: r.id, status: r.status, kind: "media", label: `${r.role}${r.animation_key ? `: ${r.animation_key}` : ""} — ${r.caption}`, detail: "Publishing media also needs an approver: use Publish after approval." });
    out.push(...guidance);
    out.push(...(await loadCreationReviewables(c)));
    setItems(out);
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
  const statusFor = (kind: Reviewable["kind"]) => (kind === "claim" ? "claim" : kind);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="zq-meta" style={{ margin: 0 }}>
        Life Through the Ages records have two review pathways (religious and historical/scientific): review them in{" "}
        <Link href="/admin/life-through-ages">its own queue</Link>.
      </p>
      <Feedback msg={msg} />
      <List
        rows={items}
        error={null}
        empty="Nothing is waiting."
        render={(it) => (
          <li key={it.kind + it.id} className="pp-card">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span className="zq-eyebrow">{it.kind}</span>
              <EditorialStatus status={it.status} />
              {it.evidence ? <EvidenceLabel kind={it.evidence} /> : null}
            </div>
            <p style={{ margin: 0 }}>{it.label}</p>
            {it.detail ? <p className="zq-meta" style={{ margin: 0 }}>{it.detail}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {canEdit && it.status === "draft" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => act(() => call("/api/admin/status", "POST", { entityType: statusFor(it.kind), entityId: it.id, status: "in_review" }), "Sent for review.")}>
                  Send for review
                </button>
              ) : null}
              {canReview ? (
                <>
                  <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => act(() => call("/api/admin/review", "POST", { entityType: reviewEntityType(it.kind), entityId: it.id, decision: "approved" }), "Approved.")}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary zq-btn-sm"
                    onClick={() => {
                      const comment = window.prompt("What needs to change?") ?? "";
                      if (comment) void act(() => call("/api/admin/review", "POST", { entityType: reviewEntityType(it.kind), entityId: it.id, decision: "changes_requested", comment }), "Changes requested.");
                    }}
                  >
                    Request changes
                  </button>
                </>
              ) : null}
              {canEdit && it.kind === "claim" && it.status !== "approved" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => act(() => call("/api/admin/status", "POST", { entityType: "claim", entityId: it.id, status: "approved" }), "Claim approved for use.")}>
                  Mark claim approved
                </button>
              ) : null}
              {canEdit && it.kind !== "claim" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => act(() => call("/api/admin/status", "POST", { entityType: it.kind, entityId: it.id, status: "published" }), "Published.")}>
                  Publish
                </button>
              ) : null}
              {canEdit && it.kind !== "claim" && it.status === "published" ? (
                <button
                  type="button"
                  className="zq-btn zq-btn-secondary zq-btn-sm"
                  onClick={() => {
                    const revisionNote = window.prompt("Public revision note: what is being corrected and why?") ?? "";
                    if (revisionNote.trim().length >= 3)
                      void act(() => call("/api/admin/status", "POST", { entityType: it.kind, entityId: it.id, status: "correction", revisionNote }), "Marked for correction with a public revision note.");
                  }}
                >
                  Start a correction
                </button>
              ) : null}
              <button
                type="button"
                className="zq-btn zq-btn-quiet zq-btn-sm"
                onClick={async () => {
                  const { data } = (await sb()?.from("content_versions").select("version, snapshot, created_at").eq("entity_id", it.id).order("version", { ascending: false }).limit(2)) ?? { data: null };
                  setHistory({ id: it.id, versions: (data ?? []) as Array<{ version: number; snapshot: Record<string, unknown>; created_at: string }> });
                }}
              >
                History
              </button>
            </div>
            {history?.id === it.id ? <VersionDiff versions={history.versions} /> : null}
          </li>
        )}
      />
    </div>
  );
}

/** The fields that changed between the two latest published versions. */
export function VersionDiff({ versions }: { versions: Array<{ version: number; snapshot: Record<string, unknown>; created_at: string }> }) {
  if (versions.length < 2) return <p className="zq-meta">{versions.length ? `Only version ${versions[0]!.version} exists.` : "No published versions yet."}</p>;
  const [b, a] = versions as [(typeof versions)[0], (typeof versions)[0]];
  const keys = Object.keys({ ...a.snapshot, ...b.snapshot }).filter((k) => !["updated_at"].includes(k) && JSON.stringify(a.snapshot[k]) !== JSON.stringify(b.snapshot[k]));
  return (
    <div className="zq-tablewrap zq-table-scroll" role="region" aria-label={`Changes from version ${a.version} to ${b.version}`} tabIndex={0}>
      <table className="zq-table">
        <caption className="sr-only">Changes from version {a.version} to {b.version}</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Version {a.version}</th>
            <th scope="col">Version {b.version}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td><del>{String(a.snapshot[k] ?? "")}</del></td>
              <td><ins>{String(b.snapshot[k] ?? "")}</ins></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- New event (flow D) ---------- */

export function NewEventForm() {
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { rows: locations } = useRows<{ id: string; name_en: string; type: string }>(() => sb()?.from("locations").select("id, name_en, type").order("name_en"));
  const { rows: sources } = useRows<{ id: string; work: string; rights_status: string }>(() => sb()?.from("sources").select("id, work, rights_status").order("work"));

  return (
    <form
      className="zq-form"
      style={{ maxWidth: 640 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "").trim();
        const refs = s("refs")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const q = /^Q\s*(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?$/.exec(l);
            if (q) return { kind: "quran", surah: Number(q[1]), from: Number(q[2]), to: q[3] ? Number(q[3]) : undefined };
            const [kind, sourceId, ...loc] = l.split("|").map((x) => x.trim());
            return { kind, sourceId, locator: loc.join("|") };
          });
        const precision = s("place_precision");
        let polygon: Array<[number, number]> | undefined;
        if (precision !== "unknown" && s("polygon")) {
          polygon = s("polygon")
            .split(/\n|;/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => p.split(/[ ,]+/).map(Number) as [number, number]);
          if (polygon.length && JSON.stringify(polygon[0]) !== JSON.stringify(polygon[polygon.length - 1])) polygon.push(polygon[0]!);
        }
        const body = {
          slug: s("slug"),
          title: s("title"),
          titleAr: s("title_ar") || undefined,
          summary: s("summary") || undefined,
          category: s("category"),
          datePrecision: s("date_precision"),
          relativeOrder: s("relative_order") ? Number(s("relative_order")) : undefined,
          startYear: s("start_year") ? Number(s("start_year")) : undefined,
          endYear: s("end_year") ? Number(s("end_year")) : undefined,
          claim: { statement: s("statement"), evidence: s("evidence"), references: refs },
          place: s("location") ? { locationId: s("location"), precision, polygon, sourceId: s("place_source") || undefined } : undefined,
        };
        setBusy(true);
        setMsg(null);
        try {
          const d = (await call("/api/admin/events", "POST", body)) as { next?: string };
          setMsg({ tone: "ok", text: `Saved as a draft. ${d.next ?? ""}` });
          (e.target as HTMLFormElement).reset();
        } catch (x) {
          setMsg({ tone: "err", text: (x as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField label="Address (slug)" id="slug" name="slug" required pattern="[a-z0-9-]{3,80}" help="Lowercase letters, numbers and hyphens." />
      <TextField label="Title" id="title" name="title" required />
      <TextField label="Arabic title" id="title_ar" name="title_ar" dir="rtl" lang="ar" />
      <div className="zq-field" style={{ maxWidth: "none" }}>
        <label htmlFor="summary">Summary</label>
        <textarea id="summary" name="summary" className="zq-textarea" />
      </div>
      <div className="zq-field">
        <label htmlFor="category">Category</label>
        <select id="category" name="category" className="zq-input" defaultValue="sacred_history">
          <option value="sacred_history">Sacred history (before recorded chronology)</option>
          <option value="prophetic_life">Life of the Prophet ﷺ</option>
          <option value="islamic_history">Islamic history</option>
          <option value="last_hour_minor">Last Hour: minor sign</option>
          <option value="last_hour_major">Last Hour: major sign</option>
        </select>
      </div>
      <fieldset className="pp-card" style={{ margin: 0 }}>
        <legend className="zq-eyebrow">Date</legend>
        <div className="zq-field">
          <label htmlFor="date_precision">Precision</label>
          <select id="date_precision" name="date_precision" className="zq-input" defaultValue="unknown">
            <option value="unknown">Unknown — no date</option>
            <option value="relative">Relative order only — no years</option>
            <option value="estimated">Historians&apos; estimate (range)</option>
            <option value="range">Sourced range</option>
            <option value="exact">Exact year (primary source)</option>
          </select>
          <span className="zq-help">Sacred history and the Last Hour take no years. The database refuses a year where none is known.</span>
        </div>
        <TextField label="Relative order (for relative dates)" id="relative_order" name="relative_order" type="number" />
        <TextField label="Start year (astronomical: 1 BCE = 0, 2 BCE = −1)" id="start_year" name="start_year" type="number" />
        <TextField label="End year" id="end_year" name="end_year" type="number" />
      </fieldset>
      <fieldset className="pp-card" style={{ margin: 0 }}>
        <legend className="zq-eyebrow">Claim and citations</legend>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="statement">Claim (the sentence this event rests on)</label>
          <textarea id="statement" name="statement" className="zq-textarea" required minLength={5} />
        </div>
        <div className="zq-field">
          <label htmlFor="evidence">Evidence kind</label>
          <select id="evidence" name="evidence" className="zq-input" defaultValue="quran">
            {["quran", "hadith", "scholar", "estimate", "disputed", "unknown"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="refs">References, one per line</label>
          <textarea id="refs" name="refs" className="zq-textarea" required dir="ltr" placeholder={"Q 12:4\nhistory | <source id> | vol. 1, p. 10"} />
          <span className="zq-help">Quran as “Q surah:ayah[–ayah]”, checked against the verified text. Other sources as “kind | source id | locator”.</span>
        </div>
      </fieldset>
      <fieldset className="pp-card" style={{ margin: 0 }}>
        <legend className="zq-eyebrow">Place (optional)</legend>
        <div className="zq-field">
          <label htmlFor="location">Location</label>
          <select id="location" name="location" className="zq-input" defaultValue="">
            <option value="">None</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name_en} ({l.type})
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="place_precision">Certainty</label>
          <select id="place_precision" name="place_precision" className="zq-input" defaultValue="unknown">
            <option value="unknown">Unknown — list it, never place it</option>
            <option value="region">Approximate region (polygon)</option>
            <option value="hypothesis">Historical hypothesis (polygon)</option>
          </select>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="polygon">Polygon corners, one “longitude latitude” per line</label>
          <textarea id="polygon" name="polygon" className="zq-textarea" dir="ltr" placeholder={"38 20\n41 20\n41 23\n38 23"} />
          <span className="zq-help">The database rejects regions too small to be honest about uncertainty.</span>
        </div>
        <div className="zq-field">
          <label htmlFor="place_source">Source for the region</label>
          <select id="place_source" name="place_source" className="zq-input" defaultValue="">
            <option value="">—</option>
            {(sources ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.work} ({s.rights_status})
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <Feedback msg={msg} />
      <div>
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Saving" : "Save draft"}
        </button>
      </div>
    </form>
  );
}

/* ---------- Moderation ---------- */

export function ModerationQueue() {
  const [reports, setReports] = useState<Array<{ id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string; body?: string | null }> | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const d = (await call("/api/admin/moderate", "GET")) as { reports: Array<{ id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string }> };
      const ids = d.reports.filter((r) => r.target_type === "comment").map((r) => r.target_id);
      const bodies = ids.length ? ((await sb()?.from("comments_public").select("id, body").in("id", ids))?.data ?? []) : [];
      setReports(d.reports.map((r) => ({ ...r, body: (bodies as Array<{ id: string; body: string | null }>).find((b) => b.id === r.target_id)?.body })));
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async (r: { target_type: string; target_id: string; reason: string }, action: string) => {
    try {
      await call("/api/admin/moderate", "POST", { targetType: r.target_type, targetId: r.target_id, action, reason: r.reason });
      setMsg({ tone: "ok", text: `Done: ${action.replace("_", " ")}.` });
      await load();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Feedback msg={msg} />
      <List
        rows={reports}
        error={null}
        empty="No open reports."
        render={(r) => (
          <li key={r.id} className="pp-card">
            <p className="zq-eyebrow">
              {r.target_type} · {r.reason.replace("_", " ")} · {new Date(r.created_at).toLocaleString()}
            </p>
            {r.body ? <blockquote style={{ margin: 0, paddingInlineStart: 12, borderInlineStart: "3px solid var(--hairline)" }}>{r.body}</blockquote> : null}
            {r.details ? <p className="zq-meta" style={{ margin: 0 }}>Reporter&apos;s note: {r.details}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => decide(r, "hide")}>Hide</button>
              <button type="button" className="zq-btn zq-btn-danger zq-btn-sm" onClick={() => decide(r, "remove")}>Remove</button>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => decide(r, "restore")}>Restore</button>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => decide(r, "dismiss_reports")}>Dismiss reports</button>
            </div>
          </li>
        )}
      />
    </div>
  );
}

/* ---------- Corrections ---------- */

export function CorrectionsQueue() {
  const [rows, setRows] = useState<Array<{ id: string; entity_type: string; entity_id: string; body: string; evidence: string | null; created_at: string }> | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(((await call("/api/admin/corrections", "GET")) as { corrections: NonNullable<typeof rows> }).corrections);
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Feedback msg={msg} />
      <List
        rows={rows}
        error={null}
        empty="No open correction requests."
        render={(c) => (
          <li key={c.id} className="pp-card">
            <p className="zq-eyebrow">
              {c.entity_type} · {c.entity_id} · {new Date(c.created_at).toLocaleDateString()}
            </p>
            <p style={{ margin: 0 }}>{c.body}</p>
            {c.evidence ? <p className="zq-meta" style={{ margin: 0 }}>Evidence offered: {c.evidence}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["accepted", "rejected", "duplicate"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`zq-btn zq-btn-sm ${s === "accepted" ? "zq-btn-primary" : "zq-btn-secondary"}`}
                  onClick={async () => {
                    const note = window.prompt(`Resolution note (${s})`);
                    if (!note) return;
                    try {
                      await call("/api/admin/corrections", "PATCH", { id: c.id, status: s, resolutionNote: note });
                      setMsg({ tone: "ok", text: s === "accepted" ? "Accepted. Correct the content from the review queue with a public revision note." : `Marked ${s}.` });
                      await load();
                    } catch (e) {
                      setMsg({ tone: "err", text: (e as Error).message });
                    }
                  }}
                >
                  {s === "accepted" ? "Accept" : s === "rejected" ? "Reject" : "Duplicate"}
                </button>
              ))}
            </div>
          </li>
        )}
      />
    </div>
  );
}

/* ---------- Sources & licences ---------- */

export function SourcesRegister() {
  const { rows, error, reload } = useRows<{ id: string; type: string; work: string; edition: string | null; rights_status: string; license_url: string | null; verification_status: string }>(() =>
    sb()?.from("sources").select("id, type, work, edition, rights_status, license_url, verification_status").order("work"),
  );
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      {error ? <p className="zq-error">{error}</p> : null}
      <div className="zq-tablewrap zq-table-scroll" role="region" aria-label="Source and licence register" tabIndex={0}>
        <table className="zq-table zq-table-cards">
          <caption className="sr-only">Source and licence register</caption>
          <thead>
            <tr>
              <th scope="col">Work</th>
              <th scope="col">Type</th>
              <th scope="col">Rights</th>
              <th scope="col">Verification</th>
              <th scope="col">Id</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.id}>
                <td data-label="Work">
                  {s.work}
                  {s.edition ? ` · ${s.edition}` : ""}
                  {s.license_url ? (
                    <>
                      {" "}
                      <a href={s.license_url} rel="noopener noreferrer" target="_blank">
                        licence
                      </a>
                    </>
                  ) : null}
                </td>
                <td data-label="Type">{s.type}</td>
                <td data-label="Rights">
                  <select
                    aria-label={`Rights status of ${s.work}`}
                    className="zq-input"
                    defaultValue={s.rights_status}
                    onChange={async (e) => {
                      const { error: err } = (await sb()?.from("sources").update({ rights_status: e.target.value }).eq("id", s.id)) ?? { error: { message: "Not configured" } };
                      setMsg(err ? { tone: "err", text: err.message } : { tone: "ok", text: `Rights for ${s.work}: ${e.target.value}` });
                    }}
                  >
                    {["unknown", "requested", "cleared", "denied", "public_domain"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td data-label="Verification">{s.verification_status}</td>
                <td data-label="Id" className="zq-order">{s.id.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Feedback msg={msg} />
      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const g = (k: string) => String(f.get(k) ?? "").trim() || null;
          const { error: err } = (await sb()?.from("sources").insert({ type: g("type"), work: g("work"), edition: g("edition"), author: g("author"), source_url: g("source_url"), license_url: g("license_url"), license_text: g("license_text"), language: g("language") ?? "ar" })) ?? {
            error: { message: "Not configured" },
          };
          setMsg(err ? { tone: "err", text: err.message } : { tone: "ok", text: "Source added with rights “unknown”. Clear the rights before anything from it is shown." });
          if (!err) {
            (e.target as HTMLFormElement).reset();
            void reload();
          }
        }}
      >
        <h3>Add a source</h3>
        <div className="zq-field">
          <label htmlFor="src-type">Type</label>
          <select id="src-type" name="type" className="zq-input">
            {["quran_translation", "tafsir", "hadith_collection", "hadith_translation", "hadith_grading", "history", "genealogy", "geography", "map_tiles", "image", "other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Work" id="src-work" name="work" required />
        <TextField label="Edition" id="src-edition" name="edition" />
        <TextField label="Author / translator" id="src-author" name="author" />
        <TextField label="Source URL (https)" id="src-url" name="source_url" type="url" pattern="https://.*" />
        <TextField label="Licence URL (https)" id="src-lurl" name="license_url" type="url" pattern="https://.*" />
        <TextField label="Licence text" id="src-ltext" name="license_text" />
        <TextField label="Language" id="src-lang" name="language" placeholder="ar" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Add source
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Users & roles ---------- */

export function RolesManager() {
  const { rows, reload } = useRows<{ user_id: string; role: string; granted_at: string; credential_note: string | null }>(() => sb()?.from("role_assignments").select("user_id, role, granted_at, credential_note").order("granted_at", { ascending: false }));
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="zq-tablewrap zq-table-scroll" role="region" aria-label="Role assignments" tabIndex={0}>
        <table className="zq-table zq-table-cards">
          <caption className="sr-only">Role assignments</caption>
          <thead>
            <tr>
              <th scope="col">User id</th>
              <th scope="col">Role</th>
              <th scope="col">Verification note</th>
              <th scope="col">Granted</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.user_id + r.role}>
                <td data-label="User id" className="zq-order">{r.user_id}</td>
                <td data-label="Role">{r.role.replace("_", " ")}</td>
                <td data-label="Verification note">{r.credential_note ?? "—"}</td>
                <td data-label="Granted">{new Date(r.granted_at).toLocaleDateString()}</td>
                <td data-label="Actions">
                  <button
                    type="button"
                    className="zq-btn zq-btn-danger zq-btn-sm"
                    onClick={async () => {
                      if (!window.confirm(`Revoke ${r.role} from ${r.user_id}?`)) return;
                      const { error } = (await sb()?.from("role_assignments").delete().eq("user_id", r.user_id).eq("role", r.role)) ?? { error: { message: "Not configured" } };
                      setMsg(error ? { tone: "err", text: error.message } : { tone: "ok", text: "Revoked." });
                      void reload();
                    }}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Feedback msg={msg} />
      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const c = sb();
          const me = (await c?.auth.getUser())?.data.user?.id;
          const { error } = (await c?.from("role_assignments").insert({ user_id: String(f.get("user_id")).trim(), role: String(f.get("role")), granted_by: me, credential_note: String(f.get("note") ?? "").trim() || null })) ?? { error: { message: "Not configured" } };
          setMsg(error ? { tone: "err", text: error.message } : { tone: "ok", text: "Role granted and recorded in the audit trail." });
          if (!error) void reload();
        }}
      >
        <h3>Grant a role</h3>
        <TextField label="User id" id="role-user" name="user_id" required pattern="[0-9a-f-]{36}" dir="ltr" help="The user's account id (from their export or support request)." />
        <div className="zq-field">
          <label htmlFor="role-role">Role</label>
          <select id="role-role" name="role" className="zq-input">
            <option value="moderator">Moderator</option>
            <option value="editor">Editor</option>
            <option value="scholarly_reviewer">Scholarly reviewer</option>
            <option value="science_reviewer">Science reviewer (historical / scientific)</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <TextField label="Identity and credential check" id="role-note" name="note" maxLength={500} help="How identity (and, for reviewers, credentials) were verified by hand. Required practice for reviewers." />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Grant role
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Audit trail ---------- */

export function AuditTrail() {
  const { rows, error } = useRows<{ id: number; actor: string | null; action: string; entity_type: string; entity_id: string; at: string; changes: Record<string, unknown> | null }>(() =>
    sb()?.from("audit_logs").select("id, actor, action, entity_type, entity_id, at, changes").order("at", { ascending: false }).limit(200),
  );
  if (error) return <p className="zq-error">{error}</p>;
  return (
    <div className="zq-tablewrap zq-table-scroll" role="region" aria-label="Audit trail" tabIndex={0}>
      <table className="zq-table zq-table-cards">
        <caption className="sr-only">Audit trail, newest first</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            <th scope="col">Action</th>
            <th scope="col">Entity</th>
            <th scope="col">Changed fields</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.id}>
              <td data-label="When">{new Date(r.at).toLocaleString()}</td>
              <td data-label="Who" className="zq-order">{r.actor?.slice(0, 8) ?? "system"}</td>
              <td data-label="Action">{r.action}</td>
              <td data-label="Entity">
                {r.entity_type} <span className="zq-order">{r.entity_id.slice(0, 8)}</span>
              </td>
              <td data-label="Changed fields">{r.action === "update" && r.changes ? Object.keys(r.changes).join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Stories and genealogy editors ---------- */

export function StoryComposer() {
  const { rows: stories, reload } = useRows<{ id: string; slug: string; title: string; status: EditorialState }>(() => sb()?.from("stories").select("id, slug, title, status").order("created_at", { ascending: false }));
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const run = async (p: PromiseLike<{ error: { message: string } | null }> | undefined, ok: string) => {
    const res = await p;
    setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: ok });
    if (res && !res.error) void reload();
  };
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {(stories ?? []).map((s) => (
          <li key={s.id} className="zq-result" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <EditorialStatus status={s.status} /> <b>{s.title}</b> <span className="zq-order">/{s.slug}</span> <span className="zq-order">{s.id.slice(0, 8)}</span>
          </li>
        ))}
      </ul>
      <form
        className="zq-form pp-card"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(sb()?.from("stories").insert({ slug: String(f.get("slug")), title: String(f.get("title")), title_ar: String(f.get("title_ar") || "") || null, summary: String(f.get("summary")) }), "Story created as a draft.");
        }}
      >
        <h3>New story</h3>
        <TextField label="Address (slug)" id="st-slug" name="slug" required pattern="[a-z0-9-]+" />
        <TextField label="Title" id="st-title" name="title" required />
        <TextField label="Arabic title" id="st-ar" name="title_ar" dir="rtl" lang="ar" />
        <TextField label="Summary" id="st-sum" name="summary" required />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Create draft</button>
        </div>
      </form>
      <form
        className="zq-form pp-card"
        style={{ maxWidth: 720 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const c = sb();
          if (!c) return setMsg({ tone: "err", text: "Not configured" });
          const { data, error } = await c.from("chapters").insert({ story_id: String(f.get("story")), position: Number(f.get("position")), title: String(f.get("title")), body_md: String(f.get("body")) }).select("id").single();
          if (error) return setMsg({ tone: "err", text: error.message });
          const claims = String(f.get("claims") ?? "").split(/[\s,]+/).filter(Boolean);
          if (claims.length) {
            const { error: e2 } = await c.from("chapter_claims").insert(claims.map((claim_id) => ({ chapter_id: data.id, claim_id })));
            if (e2) return setMsg({ tone: "err", text: e2.message });
          }
          setMsg({ tone: "ok", text: "Chapter saved as a draft with its claims. Send it for review from the review queue." });
        }}
      >
        <h3>Add a chapter</h3>
        <div className="zq-field">
          <label htmlFor="ch-story">Story</label>
          <select id="ch-story" name="story" className="zq-input" required>
            {(stories ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <TextField label="Position" id="ch-pos" name="position" type="number" min={1} required />
        <TextField label="Chapter title" id="ch-title" name="title" required />
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="ch-body">Text (Markdown: paragraphs, ## headings, lists, **bold**, [links](/path))</label>
          <textarea id="ch-body" name="body" className="zq-textarea" style={{ minHeight: 240 }} />
          <span className="zq-help">Paraphrase; never paste an unlicensed translation. Every claim in the text must be one of the claims listed below.</span>
        </div>
        <TextField label="Claim ids supporting this chapter" id="ch-claims" name="claims" dir="ltr" help="Separate with spaces or commas. A chapter cannot be published without approved claims." />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Save chapter draft</button>
        </div>
      </form>
    </div>
  );
}

export function RelationshipEditor() {
  const { rows: people, reload } = useRows<{ id: string; slug: string; name_en: string; status: string }>(() => sb()?.from("people").select("id, slug, name_en, status").order("name_en"));
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const res = await sb()?.from("people").insert({ slug: String(f.get("slug")), name_en: String(f.get("name_en")), name_ar: String(f.get("name_ar")), kind: String(f.get("kind")) });
          setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: "Person added as a draft." });
          if (res && !res.error) void reload();
        }}
      >
        <h3>Add a person</h3>
        <TextField label="Address (slug)" id="p-slug" name="slug" required pattern="[a-z0-9-]+" />
        <TextField label="Name" id="p-en" name="name_en" required />
        <TextField label="Arabic name" id="p-ar" name="name_ar" required dir="rtl" lang="ar" />
        <div className="zq-field">
          <label htmlFor="p-kind">Kind</label>
          <select id="p-kind" name="kind" className="zq-input">
            {["prophet", "companion", "ahl_al_bayt", "scholar", "historical", "other"].map((k) => (
              <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-secondary">Add person</button>
        </div>
      </form>
      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const c = sb();
          const me = (await c?.auth.getUser())?.data.user?.id;
          const conf = String(f.get("confidence"));
          const res = await c?.from("relationships").insert({
            person_from: String(f.get("from")),
            person_to: String(f.get("to")),
            kind: String(f.get("kind")),
            claim_id: String(f.get("claim")).trim(),
            confidence: conf,
            competing_group: conf === "disputed" && f.get("group") ? String(f.get("group")).trim() : null,
            tradition: String(f.get("tradition") || "") || null,
            created_by: me,
          });
          setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: "Edge saved as a draft. It is published only after its claim is approved." });
        }}
      >
        <h3>Add a family link</h3>
        <p className="zq-meta" style={{ margin: 0 }}>Every link needs a claim with references. Links are never derived from text automatically.</p>
        {(["from", "to"] as const).map((k) => (
          <div className="zq-field" key={k}>
            <label htmlFor={`r-${k}`}>{k === "from" ? "From" : "To"}</label>
            <select id={`r-${k}`} name={k} className="zq-input" required>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name_en}</option>
              ))}
            </select>
          </div>
        ))}
        <div className="zq-field">
          <label htmlFor="r-kind">Relation</label>
          <select id="r-kind" name="kind" className="zq-input">
            <option value="parent_of">parent of</option>
            <option value="spouse_of">spouse of</option>
            <option value="sibling_of">sibling of</option>
            <option value="descendant_of">descendant of (generations not established)</option>
          </select>
        </div>
        <TextField label="Claim id" id="r-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="r-conf">Confidence</label>
          <select id="r-conf" name="confidence" className="zq-input">
            {["quran", "hadith", "scholar", "estimate", "disputed", "unknown"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <TextField label="Competing-lines group id (disputed only)" id="r-group" name="group" dir="ltr" help="Give competing lines the same group id so they are shown together." />
        <TextField label="Tradition or school" id="r-trad" name="tradition" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Save edge draft</button>
        </div>
      </form>
    </div>
  );
}
