"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "@/styles/timeline.css";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { TRACK_IDS, type TrackId } from "@/lib/events/tracks";
import { englishContent } from "@/lib/i18n/locales";
import { TrackIcon } from "@/components/timeline/TrackIcon";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminUniverseStrings } from "@/lib/i18n/modules/adminUniverse";
import { AdminFeedback as Feedback, ServerText, errMsg, type AdminMsg } from "./feedback";

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

/** A message the screen itself words (already in the interface language), as opposed to one from the server. */
class UiError extends Error {}

const STATUSES: EditorialState[] = ["draft", "in_review", "approved", "published", "correction", "rejected"];
const PAGE = 60;

export function UniverseAdmin({ canEdit, canDate }: { canEdit: boolean; canDate: boolean }) {
  const locale = useLocale();
  const t = useMemo(() => adminUniverseStrings(locale), [locale]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setError(t.notConfigured);
    const { data, error: e } = await c
      .from("historical_events")
      .select("id, slug, title, title_ar, track, category, status, ordering_kind, relative_position, name_source, dating_method, start_year, end_year, merged_into, event_verse_refs(id, surah, ayah_from, ayah_to, claim_id), event_identifications(id, kind, subject, view, standing, status)")
      .not("track", "is", null)
      .order("track")
      .order("title")
      .limit(1000);
    if (e) setError(e.message);
    else setRows((data ?? []) as unknown as Row[]);
  }, [t]);
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
      setMsg(e instanceof UiError ? { tone: "err", text: e.message } : errMsg(locale, t.failedPrefix, (e as Error).message));
    }
  };

  const shown = useMemo(() => (rows ?? []).filter((r) => (!track || r.track === track) && (!status || r.status === status) && (!q || `${r.title} ${r.slug}`.toLowerCase().includes(q.toLowerCase()))), [rows, track, status, q]);
  const current = rows?.find((r) => r.id === sel) ?? null;

  if (error)
    return (
      <p className="zq-error" role="alert">
        {t.couldNotLoad} {error === t.notConfigured ? error : <ServerText>{error}</ServerText>}
      </p>
    );
  if (!rows) return <Skeleton height={24} />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Feedback msg={msg} />
      <div className="tl-admin-grid">
        <section aria-labelledby="ua-list" style={{ display: "grid", gap: 8, minWidth: 0 }}>
          <h2 id="ua-list" style={{ font: "500 20px/28px var(--font-display)", margin: 0 }}>
            {t.inventory(shown.length, rows.length)}
          </h2>
          <div className="tl-admin-form">
            <div className="row">
              <label className="zq-field">
                <span>{t.track}</span>
                <select className="zq-input" value={track} onChange={(e) => (setTrack(e.target.value), setLimit(PAGE))}>
                  <option value="">{t.all}</option>
                  {TRACK_IDS.map((k) => (
                    <option key={k} value={k}>{t.trackNames[k]}</option>
                  ))}
                </select>
              </label>
              <label className="zq-field">
                <span>{t.status}</span>
                <select className="zq-input" value={status} onChange={(e) => (setStatus(e.target.value), setLimit(PAGE))}>
                  <option value="">{t.all}</option>
                  {[...STATUSES, "archived"].map((s) => (
                    <option key={s} value={s}>{t.statusNames[s] ?? s}</option>
                  ))}
                </select>
              </label>
              <label className="zq-field" style={{ flex: 1 }}>
                <span>{t.search}</span>
                <input className="zq-input" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} placeholder={t.titleOrSlug} />
              </label>
            </div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {shown.slice(0, limit).map((r) => (
              <li key={r.id}>
                <button type="button" className="tl-admin-row" aria-pressed={sel === r.id} onClick={() => setSel(r.id)}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} data-track={r.track}>
                    <TrackIcon track={r.track} size={16} />
                    <b {...englishContent(locale)}>{r.title}</b>
                  </span>
                  <span className="zq-meta" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <EditorialStatus status={r.status as EditorialState} />
                    <span>{t.orderKinds[r.ordering_kind] ?? r.ordering_kind.replace(/_/g, " ")}</span>
                    <span>{t.refsCount(r.event_verse_refs.length)}</span>
                    {r.name_source === "later_tradition" ? <span>{t.nameLater}</span> : null}
                    {r.merged_into ? <span>{t.merged}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length > limit ? (
            <button type="button" className="zq-btn zq-btn-secondary" onClick={() => setLimit(limit + PAGE)}>
              {t.showMore(Math.min(PAGE, shown.length - limit))}
            </button>
          ) : null}
          {canEdit ? <NewShell onDone={act} /> : null}
        </section>

        <section aria-labelledby="ua-detail" style={{ minWidth: 0 }}>
          {current ? (
            <Detail key={current.id} row={current} all={rows} canEdit={canEdit} canDate={canDate} act={act} />
          ) : (
            <EmptyState title={t.chooseEvent}>
              <p>{t.chooseEventBody}</p>
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>, ok: string) => Promise<void>;

function NewShell({ onDone }: { onDone: Act }) {
  const t = adminUniverseStrings(useLocale());
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
        if (!parsed.length || parsed.some((m) => !m)) return void onDone(() => Promise.reject(new UiError(t.giveRefs)), "");
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
          t.shellAdded,
        );
      }}
    >
      <h3 style={{ margin: 0 }}>{t.addDraftItem}</h3>
      <p className="zq-meta" style={{ margin: 0 }}>{t.addDraftHelp}</p>
      <label className="zq-field"><span>{t.title}</span><input name="title" className="zq-input" required minLength={2} maxLength={200} /></label>
      <label className="zq-field"><span>{t.slugShort}</span><input name="slug" className="zq-input" required pattern="[a-z0-9\-]{2,80}" placeholder={t.slugPlaceholder} /></label>
      <div className="row">
        <label className="zq-field"><span>{t.track}</span><select name="track" className="zq-input">{TRACK_IDS.map((k) => <option key={k} value={k}>{t.trackNames[k]}</option>)}</select></label>
        <label className="zq-field"><span>{t.era}</span><select name="category" className="zq-input"><option value="sacred_history">{t.eraSacred}</option><option value="prophetic_life">{t.eraProphetic}</option><option value="islamic_history">{t.eraIslamic}</option></select></label>
        <label className="zq-field"><span>{t.names}</span><select name="nameSource" className="zq-input"><option value="quran">{t.namesQuran}</option><option value="later_tradition">{t.namesLater}</option></select></label>
      </div>
      <label className="zq-field"><span>{t.verseRanges}</span><textarea className="zq-input" rows={3} value={refs} onChange={(e) => setRefs(e.target.value)} placeholder="5:27-31" /></label>
      <button type="submit" className="zq-btn zq-btn-primary">{t.addDraft}</button>
    </form>
  );
}

function Detail({ row, all, canEdit, canDate, act }: { row: Row; all: Row[]; canEdit: boolean; canDate: boolean; act: Act }) {
  const locale = useLocale();
  const t = adminUniverseStrings(locale);
  const [kind, setKind] = useState(row.ordering_kind);
  const locked = row.status === "published";
  const others = all.filter((r) => r.id !== row.id && r.track === row.track && !r.merged_into && r.status !== "archived");
  const post = (body: Record<string, unknown>, ok: string) => act(() => call("POST", body), ok);
  const move = (status: string, note?: string) => act(() => call("POST", { entityType: "event", entityId: row.id, status, revisionNote: note }, "/api/admin/status"), t.movedTo(t.statusNames[status] ?? status));
  return (
    <div style={{ display: "grid", gap: 16 }} data-testid="ua-detail">
      <header>
        <h2 id="ua-detail" style={{ font: "500 24px/32px var(--font-display)", margin: 0 }} {...englishContent(locale)}>{row.title}</h2>
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
              t.okSaved,
            );
          }}
        >
          <h3 style={{ margin: 0 }}>{t.correct}</h3>
          {locked ? <p className="zq-meta" style={{ margin: 0 }}>{t.lockedNote}</p> : null}
          <label className="zq-field"><span>{t.title}</span><input name="title" className="zq-input" defaultValue={row.title} /></label>
          <div className="row">
            <label className="zq-field"><span>{t.track}</span><select name="track" className="zq-input" defaultValue={row.track}>{TRACK_IDS.map((k) => <option key={k} value={k}>{t.trackNames[k]}</option>)}</select></label>
            <label className="zq-field"><span>{t.era}</span><select name="category" className="zq-input" defaultValue={row.category}><option value="sacred_history">{t.eraSacred}</option><option value="prophetic_life">{t.eraProphetic}</option><option value="islamic_history">{t.eraIslamic}</option></select></label>
            <label className="zq-field"><span>{t.names}</span><select name="nameSource" className="zq-input" defaultValue={row.name_source}><option value="quran">{t.namesInQuran}</option><option value="later_tradition">{t.namesFromLater}</option></select></label>
          </div>
          <div className="row">
            <label className="zq-field">
              <span>{t.ordering}</span>
              <select name="orderingKind" className="zq-input" value={kind} onChange={(e) => setKind(e.target.value)} disabled={row.track === "parables"}>
                <option value="unassigned">{row.track === "parables" ? t.noHistDate : t.orderNotEstablished}</option>
                <option value="relative">{t.optRelative}</option>
                <option value="disputed">{t.optDisputed}</option>
                <option value="dated_estimate">{t.optDated}</option>
              </select>
            </label>
            {kind === "relative" ? <label className="zq-field"><span>{t.positionInTrack}</span><input name="relativePosition" type="number" min={0} className="zq-input" defaultValue={row.relative_position ?? ""} required /></label> : null}
          </div>
          {kind === "dated_estimate" ? (
            <div className="row">
              <label className="zq-field"><span>{t.fromCe}</span><input name="startYear" type="number" className="zq-input" defaultValue={row.start_year ?? ""} required /></label>
              <label className="zq-field"><span>{t.toCe}</span><input name="endYear" type="number" className="zq-input" defaultValue={row.end_year ?? ""} /></label>
              <label className="zq-field" style={{ flex: 1 }}><span>{t.datingMethod}</span><input name="datingMethod" className="zq-input" defaultValue={row.dating_method ?? ""} required minLength={3} /></label>
            </div>
          ) : null}
          <button type="submit" className="zq-btn zq-btn-primary" disabled={locked}>{t.save}</button>
        </form>
      ) : null}

      <section className="pp-card tl-admin-form" aria-labelledby="ua-verses">
        <h3 id="ua-verses" style={{ margin: 0 }}>{t.versesHeading(row.event_verse_refs.length)}</h3>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {row.event_verse_refs.map((v) => (
            <li key={v.id}>
              <a href={`/quran/${v.surah}#ayah-${v.ayah_from}${v.ayah_to > v.ayah_from ? `-${v.ayah_to}` : ""}`}>
                <span dir="ltr">{v.surah}:{v.ayah_from}{v.ayah_to > v.ayah_from ? `–${v.ayah_to}` : ""}</span>
              </a>{" "}
              <span className="zq-meta">{v.claim_id ? t.claimAttached : t.noClaimYet}</span>{" "}
              {canEdit && !locked ? <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => post({ action: "remove_verse", id: v.id }, t.refRemoved)}>{t.remove}</button> : null}
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
                if (!m) return void act(() => Promise.reject(new UiError(t.useRef)), "");
                void post({ action: "add_verse", eventId: row.id, ref: { surah: Number(m[1]), from: Number(m[2]), to: Number(m[3] ?? m[2]) } }, t.refAdded);
                e.currentTarget.reset();
              }}
            >
              <label className="zq-field"><span>{t.addVerseRange}</span><input name="ref" className="zq-input" placeholder="5:27-31" /></label>
              <button type="submit" className="zq-btn zq-btn-secondary">{t.add}</button>
            </form>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                const claimId = String(new FormData(e.currentTarget).get("claimId") ?? "").trim();
                void post({ action: "attach_claim", eventId: row.id, claimId }, t.claimAttachedOk);
              }}
            >
              <label className="zq-field" style={{ flex: 1 }}><span>{t.attachClaim}</span><input name="claimId" className="zq-input" placeholder={t.claimIdPlaceholder} /></label>
              <button type="submit" className="zq-btn zq-btn-secondary">{t.attach}</button>
            </form>
          </>
        ) : null}
      </section>

      <section className="pp-card tl-admin-form" aria-labelledby="ua-ident">
        <h3 id="ua-ident" style={{ margin: 0 }}>{t.identHeading(row.event_identifications.length)}</h3>
        <p className="zq-meta" style={{ margin: 0 }}>{t.identNote}</p>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {row.event_identifications.map((i) => (
            <li key={i.id}>
              <b>{t.identKinds[i.kind] ?? i.kind}</b> · <span {...englishContent(locale)}>{i.subject}: {i.view}</span> <span className="zq-meta">({t.standings[i.standing] ?? i.standing.replace(/_/g, " ")}, {t.statusNames[i.status] ?? i.status})</span>
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
                t.claimAddedOk,
              );
            }}
          >
            <div className="row">
              <label className="zq-field"><span>{t.kind}</span><select name="kind" className="zq-input"><option value="identification">{t.identKinds.identification}</option><option value="name">{t.identKinds.name}</option><option value="ordering">{t.identKinds.ordering}</option><option value="dating">{t.identKinds.dating}</option></select></label>
              <label className="zq-field"><span>{t.standing}</span><select name="standing" className="zq-input"><option value="disputed">{t.optDisputedCap}</option><option value="widely_held">{t.optWidely}</option><option value="minority">{t.optMinority}</option><option value="later_tradition">{t.optLater}</option></select></label>
            </div>
            <label className="zq-field"><span>{t.subject}</span><input name="subject" className="zq-input" required minLength={2} placeholder={t.subjectPlaceholder} /></label>
            <label className="zq-field"><span>{t.view}</span><input name="view" className="zq-input" required minLength={2} placeholder={t.viewPlaceholder} /></label>
            <label className="zq-field"><span>{t.existingClaim}</span><input name="claimId" className="zq-input" /></label>
            <label className="zq-field"><span>{t.newClaimStatement}</span><input name="statement" className="zq-input" /></label>
            <div className="row">
              <label className="zq-field"><span>{t.evidenceClass}</span><select name="evidence" className="zq-input"><option value="scholar">{t.optScholar}</option><option value="hadith">{t.optHadith}</option><option value="estimate">{t.optEstimate}</option><option value="disputed">{t.optDisputedCap}</option><option value="unknown">{t.optUnknown}</option></select></label>
              <label className="zq-field"><span>{t.reference}</span><select name="refKind" className="zq-input"><option value="scholar">{t.refKinds.scholar}</option><option value="history">{t.refKinds.history}</option><option value="tafsir">{t.refKinds.tafsir}</option></select></label>
              <label className="zq-field"><span>{t.sourceId}</span><input name="sourceId" className="zq-input" /></label>
              <label className="zq-field"><span>{t.locator}</span><input name="locator" className="zq-input" placeholder={t.locatorPlaceholder} /></label>
            </div>
            <button type="submit" className="zq-btn zq-btn-secondary">{t.addClaim}</button>
          </form>
        ) : null}
      </section>

      {canEdit ? (
        <section className="pp-card tl-admin-form" aria-labelledby="ua-flow">
          <h3 id="ua-flow" style={{ margin: 0 }}>{t.workflow}</h3>
          <div className="row">
            {row.status === "draft" ? <button type="button" className="zq-btn zq-btn-secondary" onClick={() => move("in_review")}>{t.sendForReview}</button> : null}
            {row.status !== "published" ? <button type="button" className="zq-btn zq-btn-secondary" onClick={() => move("published")}>{t.publish}</button> : null}
            {row.status === "published" ? (
              <button
                type="button"
                className="zq-btn zq-btn-secondary"
                onClick={() => {
                  const note = window.prompt(t.revisionPrompt) ?? "";
                  if (note.trim().length >= 3) void move("correction", note);
                }}
              >
                {t.startCorrection}
              </button>
            ) : null}
          </div>
          <p className="zq-meta" style={{ margin: 0 }}>{t.flowA} <Link href="/admin/review">{t.flowLink}</Link>{t.flowB}{canDate ? t.flowDated : ""}.</p>
        </section>
      ) : null}

      {canEdit ? (
        <section className="pp-card tl-admin-form" aria-labelledby="ua-merge">
          <h3 id="ua-merge" style={{ margin: 0 }}>{t.merge}</h3>
          <p className="zq-meta" style={{ margin: 0 }}>{t.mergeNote}</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const targetId = String(f.get("target") ?? "");
              const target = others.find((o) => o.id === targetId);
              if (!target || !window.confirm(t.confirmMerge(row.title, target.title))) return;
              void post({ action: "merge", sourceId: row.id, targetId, reason: String(f.get("reason") ?? "").trim() || undefined }, t.mergedOk);
            }}
          >
            <label className="zq-field" style={{ flex: 1 }}>
              <span>{t.mergeInto}</span>
              <select name="target" className="zq-input" required defaultValue="">
                <option value="" disabled>{t.chooseKeep}</option>
                {others.map((o) => <option key={o.id} value={o.id} {...englishContent(locale)}>{o.title}</option>)}
              </select>
            </label>
            <label className="zq-field" style={{ flex: 1 }}><span>{t.reason}</span><input name="reason" className="zq-input" maxLength={500} /></label>
            <button type="submit" className="zq-btn zq-btn-secondary" disabled={row.status === "archived"}>{t.merge}</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
