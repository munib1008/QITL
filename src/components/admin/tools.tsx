"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, EvidenceLabel, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton, TextField } from "@/components/ui/misc";
import type { EvidenceKind } from "@/content/journey";
import { loadGuidanceReviewables, type GuidanceReviewKind } from "./guidanceReview";
import { loadCreationReviewables, reviewEntityType, type CreationReviewKind } from "./creation-review";
import { loadQiraatReviewables, type QiraatReviewKind } from "./qiraat-review";
import { loadEventUniverseReviewables, type EventUniverseReviewKind } from "./event-universe-review";
import { useLocale } from "@/lib/i18n/useLocale";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { adminToolsStrings } from "@/lib/i18n/modules/adminTools";
import { AdminFeedback as Feedback, ServerText, errMsg, okMsg, type AdminMsg } from "./feedback";

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
    if (!res) return setError(NC);
    if (res.error) setError(res.error.message);
    else setRows(res.data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, error, reload };
}

function List<T>({ rows, error, empty, render }: { rows: T[] | null; error: string | null; empty: string; render: (r: T) => ReactNode }) {
  const locale = useLocale();
  const t = adminToolsStrings(locale);
  if (error)
    return (
      <p className="zq-error" role="alert">
        {t.couldNotLoad} {error === t.notConfigured ? t.notConfigured : <ServerText>{error}</ServerText>}
      </p>
    );
  if (!rows) return <Skeleton height={20} />;
  if (!rows.length) return <EmptyState title={empty} />;
  return <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>{rows.map(render)}</ul>;
}

const sb = () => getBrowserSupabase();
const NC = "Not configured";
const evLabel = (locale: string, k: string) => (uiStrings(locale).evidence as Record<string, string>)[k] ?? k;

function LoadError({ error }: { error: string }) {
  const t = adminToolsStrings(useLocale());
  return <p className="zq-error">{error === NC ? t.notConfigured : <ServerText>{error}</ServerText>}</p>;
}

/* ---------- Review queue ---------- */

interface Reviewable {
  id: string;
  status: EditorialState;
  label: string;
  kind: "claim" | "event" | "story" | "chapter" | "relationship" | "place_geometry" | "person" | "story_section" | "quiz" | "media" | GuidanceReviewKind | CreationReviewKind | QiraatReviewKind | EventUniverseReviewKind;
  evidence?: EvidenceKind;
  detail?: string;
  /** A historians' dated estimate: it also needs the historical/scientific review. */
  datedEstimate?: boolean;
}

export function ReviewQueue({ canReview, canEdit, canReviewDating = false }: { canReview: boolean; canEdit: boolean; canReviewDating?: boolean }) {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const [items, setItems] = useState<Reviewable[] | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);
  const [history, setHistory] = useState<{ id: string; versions: Array<{ version: number; snapshot: Record<string, unknown>; created_at: string }> } | null>(null);

  const load = useCallback(async () => {
    const c = sb();
    if (!c) return;
    const open = ["draft", "in_review", "approved", "published", "correction", "rejected"];
    const [claims, events, stories, chapters, rels, geoms, people, sections, quizzes, media, guidance] = await Promise.all([
      c.from("evidence_claims").select("id, status, statement, evidence, claim_references(kind, quran_surah, quran_ayah_from, quran_ayah_to, locator)").in("status", open).limit(100),
      // The 159 inventory drafts of the Event Universe are worked on in /admin/events/universe; they join the queue once in review.
      c.from("historical_events").select("id, status, title, date_precision, category, track, ordering_kind").in("status", open).or("track.is.null,status.neq.draft").limit(100),
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
        detail: r.claim_references.map((x) => (x.kind === "quran" ? `Q ${x.quran_surah}:${x.quran_ayah_from}${x.quran_ayah_to ? `–${x.quran_ayah_to}` : ""}` : `${x.kind}: ${x.locator ?? ""}`)).join(" · ") || t.noRefs,
      });
    for (const r of (events.data ?? []) as Array<{ id: string; status: EditorialState; title: string; date_precision: string; category: string; track: string | null; ordering_kind: string | null }>)
      out.push({
        id: r.id,
        status: r.status,
        kind: "event",
        label: r.title,
        detail: r.track ? t.trackDetail(r.track, r.category.replace(/_/g, " "), (r.ordering_kind ?? "").replace(/_/g, " ")) : t.dateDetail(r.category.replace(/_/g, " "), r.date_precision),
        datedEstimate: r.ordering_kind === "dated_estimate",
      });
    for (const r of (stories.data ?? []) as Array<{ id: string; status: EditorialState; title: string }>) out.push({ id: r.id, status: r.status, kind: "story", label: r.title });
    for (const r of (chapters.data ?? []) as unknown as Array<{ id: string; status: EditorialState; title: string; position: number; stories: { title: string } | null }>)
      out.push({ id: r.id, status: r.status, kind: "chapter", label: `${r.stories?.title ?? t.storyWord} · ${r.position}. ${r.title}` });
    for (const r of (rels.data ?? []) as Array<{ id: string; status: EditorialState; kind: string; confidence: EvidenceKind }>)
      out.push({ id: r.id, status: r.status, kind: "relationship", label: r.kind.replace(/_/g, " "), evidence: r.confidence });
    for (const r of (geoms.data ?? []) as unknown as Array<{ id: string; status: EditorialState; precision: string; confidence: EvidenceKind; locations: { name_en: string } | null }>)
      out.push({ id: r.id, status: r.status, kind: "place_geometry", label: `${r.locations?.name_en ?? t.placeWord} · ${r.precision}`, evidence: r.confidence });
    for (const r of (people.data ?? []) as Array<{ id: string; status: EditorialState; name_en: string; name_ar: string; honorific: string | null }>)
      out.push({ id: r.id, status: r.status, kind: "person", label: `${r.name_en} · ${r.name_ar}${r.honorific ? ` ${r.honorific}` : ""}`, detail: t.personDetail });
    for (const r of (sections.data ?? []) as unknown as Array<{ id: string; status: EditorialState; section: string; audience: string; value_text: string | null; known: boolean; body_md: string; people: { name_en: string } | null; historical_events: { title: string } | null }>)
      out.push({
        id: r.id,
        status: r.status,
        kind: "story_section",
        label: `${r.people?.name_en ?? r.historical_events?.title ?? t.storyWord} · ${r.section.replace(/_/g, " ")} · ${r.audience}`,
        detail: r.known ? (r.value_text ?? r.body_md.slice(0, 240)) : t.notEstablished,
      });
    for (const r of (quizzes.data ?? []) as Array<{ id: string; status: EditorialState; title: string; audience: string }>)
      out.push({ id: r.id, status: r.status, kind: "quiz", label: t.quizLabel(r.title, r.audience) });
    for (const r of (media.data ?? []) as Array<{ id: string; status: EditorialState; role: string; animation_key: string | null; caption: string }>)
      out.push({ id: r.id, status: r.status, kind: "media", label: `${r.role}${r.animation_key ? `: ${r.animation_key}` : ""} — ${r.caption}`, detail: t.mediaDetail });
    out.push(...guidance);
    out.push(...(await loadCreationReviewables(c)));
    out.push(...(await loadQiraatReviewables(c)));
    out.push(...(await loadEventUniverseReviewables(c)));
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
      setMsg(errMsg(locale, t.failedPrefix, (e as Error).message, t.notConfigured));
    }
  };
  const statusFor = (kind: Reviewable["kind"]) => (kind === "claim" ? "claim" : kind);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="zq-meta" style={{ margin: 0 }}>
        {t.lttaLeadA} <Link href="/admin/life-through-ages">{t.lttaLink}</Link>. {t.lttaLeadB} <Link href="/admin/shifa">{t.shifaLink}</Link>.
      </p>
      <Feedback msg={msg} />
      <List
        rows={items}
        error={null}
        empty={t.nothingWaiting}
        render={(it) => (
          <li key={it.kind + it.id} className="pp-card">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span className="zq-eyebrow">{t.kinds[it.kind] ?? it.kind}</span>
              <EditorialStatus status={it.status} />
              {it.evidence ? <EvidenceLabel kind={it.evidence} /> : null}
            </div>
            <p style={{ margin: 0 }}>{it.label}</p>
            {it.detail ? <p className="zq-meta" style={{ margin: 0 }}>{it.detail}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {canEdit && it.status === "draft" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => act(() => call("/api/admin/status", "POST", { entityType: statusFor(it.kind), entityId: it.id, status: "in_review" }), t.okSent)}>
                  {t.sendForReview}
                </button>
              ) : null}
              {canReview ? (
                <>
                  <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => act(() => call("/api/admin/review", "POST", { entityType: reviewEntityType(it.kind), entityId: it.id, decision: "approved" }), t.okApproved)}>
                    {t.approve}
                  </button>
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary zq-btn-sm"
                    onClick={() => {
                      const comment = window.prompt(t.promptChanges) ?? "";
                      if (comment) void act(() => call("/api/admin/review", "POST", { entityType: reviewEntityType(it.kind), entityId: it.id, decision: "changes_requested", comment }), t.okChanges);
                    }}
                  >
                    {t.requestChanges}
                  </button>
                </>
              ) : null}
              {canReviewDating && it.datedEstimate ? (
                <button
                  type="button"
                  className="zq-btn zq-btn-primary zq-btn-sm"
                  onClick={() => act(() => call("/api/admin/events/universe/dating-review", "POST", { eventId: it.id, decision: "approved" }), t.okDating)}
                >
                  {t.approveDating}
                </button>
              ) : null}
              {canEdit && it.kind === "claim" && it.status !== "approved" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => act(() => call("/api/admin/status", "POST", { entityType: "claim", entityId: it.id, status: "approved" }), t.okClaim)}>
                  {t.markClaimApproved}
                </button>
              ) : null}
              {canEdit && it.kind !== "claim" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => act(() => call("/api/admin/status", "POST", { entityType: it.kind, entityId: it.id, status: "published" }), t.okPublished)}>
                  {t.publish}
                </button>
              ) : null}
              {canEdit && it.kind !== "claim" && it.status === "published" ? (
                <button
                  type="button"
                  className="zq-btn zq-btn-secondary zq-btn-sm"
                  onClick={() => {
                    const revisionNote = window.prompt(t.promptRevision) ?? "";
                    if (revisionNote.trim().length >= 3)
                      void act(() => call("/api/admin/status", "POST", { entityType: it.kind, entityId: it.id, status: "correction", revisionNote }), t.okCorrection);
                  }}
                >
                  {t.startCorrection}
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
                {t.history}
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
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  if (versions.length < 2) return <p className="zq-meta">{versions.length ? t.onlyVersion(versions[0]!.version) : t.noVersions}</p>;
  const [b, a] = versions as [(typeof versions)[0], (typeof versions)[0]];
  const keys = Object.keys({ ...a.snapshot, ...b.snapshot }).filter((k) => !["updated_at"].includes(k) && JSON.stringify(a.snapshot[k]) !== JSON.stringify(b.snapshot[k]));
  return (
    <div className="zq-tablewrap zq-table-scroll" role="region" aria-label={t.diffLabel(a.version, b.version)} tabIndex={0}>
      <table className="zq-table">
        <caption className="sr-only">{t.diffLabel(a.version, b.version)}</caption>
        <thead>
          <tr>
            <th scope="col">{t.field}</th>
            <th scope="col">{t.versionN(a.version)}</th>
            <th scope="col">{t.versionN(b.version)}</th>
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
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const [msg, setMsg] = useState<AdminMsg>(null);
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
          setMsg(okMsg(t.savedDraft, d.next || undefined));
          (e.target as HTMLFormElement).reset();
        } catch (x) {
          setMsg(errMsg(locale, t.failedPrefix, (x as Error).message, t.notConfigured));
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField label={t.slug} id="slug" name="slug" required pattern="[a-z0-9-]{3,80}" help={t.slugHelp} />
      <TextField label={t.title} id="title" name="title" required />
      <TextField label={t.arabicTitle} id="title_ar" name="title_ar" dir="rtl" lang="ar" />
      <div className="zq-field" style={{ maxWidth: "none" }}>
        <label htmlFor="summary">{t.summary}</label>
        <textarea id="summary" name="summary" className="zq-textarea" />
      </div>
      <div className="zq-field">
        <label htmlFor="category">{t.category}</label>
        <select id="category" name="category" className="zq-input" defaultValue="sacred_history">
          <option value="sacred_history">{t.catSacred}</option>
          <option value="prophetic_life">{t.catProphetic}</option>
          <option value="islamic_history">{t.catIslamic}</option>
          <option value="last_hour_minor">{t.catLastMinor}</option>
          <option value="last_hour_major">{t.catLastMajor}</option>
        </select>
      </div>
      <fieldset className="pp-card" style={{ margin: 0 }}>
        <legend className="zq-eyebrow">{t.date}</legend>
        <div className="zq-field">
          <label htmlFor="date_precision">{t.precision}</label>
          <select id="date_precision" name="date_precision" className="zq-input" defaultValue="unknown">
            <option value="unknown">{t.precUnknown}</option>
            <option value="relative">{t.precRelative}</option>
            <option value="estimated">{t.precEstimated}</option>
            <option value="range">{t.precRange}</option>
            <option value="exact">{t.precExact}</option>
          </select>
          <span className="zq-help">{t.dateHelp}</span>
        </div>
        <TextField label={t.relativeOrder} id="relative_order" name="relative_order" type="number" />
        <TextField label={t.startYear} id="start_year" name="start_year" type="number" />
        <TextField label={t.endYear} id="end_year" name="end_year" type="number" />
      </fieldset>
      <fieldset className="pp-card" style={{ margin: 0 }}>
        <legend className="zq-eyebrow">{t.claimCitations}</legend>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="statement">{t.claimSentence}</label>
          <textarea id="statement" name="statement" className="zq-textarea" required minLength={5} />
        </div>
        <div className="zq-field">
          <label htmlFor="evidence">{t.evidenceKind}</label>
          <select id="evidence" name="evidence" className="zq-input" defaultValue="quran">
            {["quran", "hadith", "scholar", "estimate", "disputed", "unknown"].map((k) => (
              <option key={k} value={k}>
                {evLabel(locale, k)}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="refs">{t.refsOnePerLine}</label>
          <textarea id="refs" name="refs" className="zq-textarea" required dir="ltr" placeholder={"Q 12:4\nhistory | <source id> | vol. 1, p. 10"} />
          <span className="zq-help">{t.refsHelp}</span>
        </div>
      </fieldset>
      <fieldset className="pp-card" style={{ margin: 0 }}>
        <legend className="zq-eyebrow">{t.placeOptional}</legend>
        <div className="zq-field">
          <label htmlFor="location">{t.location}</label>
          <select id="location" name="location" className="zq-input" defaultValue="">
            <option value="">{t.none}</option>
            {(locations ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name_en} ({l.type})
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="place_precision">{t.certainty}</label>
          <select id="place_precision" name="place_precision" className="zq-input" defaultValue="unknown">
            <option value="unknown">{t.placeUnknown}</option>
            <option value="region">{t.placeRegion}</option>
            <option value="hypothesis">{t.placeHypothesis}</option>
          </select>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="polygon">{t.polygonCorners}</label>
          <textarea id="polygon" name="polygon" className="zq-textarea" dir="ltr" placeholder={"38 20\n41 20\n41 23\n38 23"} />
          <span className="zq-help">{t.polygonHelp}</span>
        </div>
        <div className="zq-field">
          <label htmlFor="place_source">{t.regionSource}</label>
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
          {busy ? t.saving : t.saveDraft}
        </button>
      </div>
    </form>
  );
}

/* ---------- Moderation ---------- */

export function ModerationQueue() {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const [reports, setReports] = useState<Array<{ id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string; body?: string | null }> | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);
  const load = useCallback(async () => {
    try {
      const d = (await call("/api/admin/moderate", "GET")) as { reports: Array<{ id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string }> };
      const ids = d.reports.filter((r) => r.target_type === "comment").map((r) => r.target_id);
      const bodies = ids.length ? ((await sb()?.from("comments_public").select("id, body").in("id", ids))?.data ?? []) : [];
      setReports(d.reports.map((r) => ({ ...r, body: (bodies as Array<{ id: string; body: string | null }>).find((b) => b.id === r.target_id)?.body })));
    } catch (e) {
      setMsg(errMsg(locale, t.failedPrefix, (e as Error).message, t.notConfigured));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const decide = async (r: { target_type: string; target_id: string; reason: string }, action: string) => {
    try {
      await call("/api/admin/moderate", "POST", { targetType: r.target_type, targetId: r.target_id, action, reason: r.reason });
      setMsg({ tone: "ok", text: t.done(t.modActions[action] ?? action.replace("_", " ")) });
      await load();
    } catch (e) {
      setMsg(errMsg(locale, t.failedPrefix, (e as Error).message, t.notConfigured));
    }
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Feedback msg={msg} />
      <List
        rows={reports}
        error={null}
        empty={t.noReports}
        render={(r) => (
          <li key={r.id} className="pp-card">
            <p className="zq-eyebrow">
              {t.targetTypes[r.target_type] ?? r.target_type} · {t.reasons[r.reason] ?? r.reason.replace("_", " ")} · {new Date(r.created_at).toLocaleString()}
            </p>
            {r.body ? <blockquote style={{ margin: 0, paddingInlineStart: 12, borderInlineStart: "3px solid var(--hairline)" }}>{r.body}</blockquote> : null}
            {r.details ? <p className="zq-meta" style={{ margin: 0 }}>{t.reporterNote} {r.details}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => decide(r, "hide")}>{t.hide}</button>
              <button type="button" className="zq-btn zq-btn-danger zq-btn-sm" onClick={() => decide(r, "remove")}>{t.remove}</button>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => decide(r, "restore")}>{t.restore}</button>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => decide(r, "dismiss_reports")}>{t.dismissReports}</button>
            </div>
          </li>
        )}
      />
    </div>
  );
}

/* ---------- Corrections ---------- */

export function CorrectionsQueue() {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const [rows, setRows] = useState<Array<{ id: string; entity_type: string; entity_id: string; body: string; evidence: string | null; created_at: string }> | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);
  const load = useCallback(async () => {
    try {
      setRows(((await call("/api/admin/corrections", "GET")) as { corrections: NonNullable<typeof rows> }).corrections);
    } catch (e) {
      setMsg(errMsg(locale, t.failedPrefix, (e as Error).message, t.notConfigured));
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
        empty={t.noCorrections}
        render={(c) => (
          <li key={c.id} className="pp-card">
            <p className="zq-eyebrow">
              {c.entity_type} · {c.entity_id} · {new Date(c.created_at).toLocaleDateString()}
            </p>
            <p style={{ margin: 0 }}>{c.body}</p>
            {c.evidence ? <p className="zq-meta" style={{ margin: 0 }}>{t.evidenceOffered} {c.evidence}</p> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["accepted", "rejected", "duplicate"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`zq-btn zq-btn-sm ${s === "accepted" ? "zq-btn-primary" : "zq-btn-secondary"}`}
                  onClick={async () => {
                    const note = window.prompt(t.resolutionNote(t.corrStatus[s] ?? s));
                    if (!note) return;
                    try {
                      await call("/api/admin/corrections", "PATCH", { id: c.id, status: s, resolutionNote: note });
                      setMsg({ tone: "ok", text: s === "accepted" ? t.okAccepted : t.markedAs(t.corrStatus[s] ?? s) });
                      await load();
                    } catch (e) {
                      setMsg(errMsg(locale, t.failedPrefix, (e as Error).message, t.notConfigured));
                    }
                  }}
                >
                  {s === "accepted" ? t.accept : s === "rejected" ? t.reject : t.duplicate}
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
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const { rows, error, reload } = useRows<{ id: string; type: string; work: string; edition: string | null; rights_status: string; license_url: string | null; verification_status: string }>(() =>
    sb()?.from("sources").select("id, type, work, edition, rights_status, license_url, verification_status").order("work"),
  );
  const [msg, setMsg] = useState<AdminMsg>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      {error ? <LoadError error={error} /> : null}
      <div className="zq-tablewrap zq-table-scroll" role="region" aria-label={t.sourceRegister} tabIndex={0}>
        <table className="zq-table zq-table-cards">
          <caption className="sr-only">{t.sourceRegister}</caption>
          <thead>
            <tr>
              <th scope="col">{t.work}</th>
              <th scope="col">{t.type}</th>
              <th scope="col">{t.rights}</th>
              <th scope="col">{t.verification}</th>
              <th scope="col">{t.id}</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.id}>
                <td data-label={t.work}>
                  {s.work}
                  {s.edition ? ` · ${s.edition}` : ""}
                  {s.license_url ? (
                    <>
                      {" "}
                      <a href={s.license_url} rel="noopener noreferrer" target="_blank">
                        {t.licenceLink}
                      </a>
                    </>
                  ) : null}
                </td>
                <td data-label={t.type}>{s.type}</td>
                <td data-label={t.rights}>
                  <select
                    aria-label={t.rightsStatusOf(s.work)}
                    className="zq-input"
                    defaultValue={s.rights_status}
                    onChange={async (e) => {
                      const { error: err } = (await sb()?.from("sources").update({ rights_status: e.target.value }).eq("id", s.id)) ?? { error: { message: NC } };
                      setMsg(err ? errMsg(locale, t.failedPrefix, err.message, t.notConfigured) : { tone: "ok", text: t.rightsFor(s.work, t.rightsValues[e.target.value] ?? e.target.value) });
                    }}
                  >
                    {["unknown", "requested", "cleared", "denied", "public_domain"].map((v) => (
                      <option key={v} value={v}>
                        {t.rightsValues[v] ?? v}
                      </option>
                    ))}
                  </select>
                </td>
                <td data-label={t.verification}>{s.verification_status}</td>
                <td data-label={t.id} className="zq-order">{s.id.slice(0, 8)}</td>
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
            error: { message: NC },
          };
          setMsg(err ? errMsg(locale, t.failedPrefix, err.message, t.notConfigured) : { tone: "ok", text: t.sourceAdded });
          if (!err) {
            (e.target as HTMLFormElement).reset();
            void reload();
          }
        }}
      >
        <h3>{t.addSource}</h3>
        <div className="zq-field">
          <label htmlFor="src-type">{t.type}</label>
          <select id="src-type" name="type" className="zq-input">
            {["quran_translation", "tafsir", "hadith_collection", "hadith_translation", "hadith_grading", "history", "genealogy", "geography", "map_tiles", "image", "other"].map((k) => (
              <option key={k} value={k}>
                {t.sourceTypes[k] ?? k}
              </option>
            ))}
          </select>
        </div>
        <TextField label={t.work} id="src-work" name="work" required />
        <TextField label={t.edition} id="src-edition" name="edition" />
        <TextField label={t.authorTranslator} id="src-author" name="author" />
        <TextField label={t.sourceUrl} id="src-url" name="source_url" type="url" pattern="https://.*" />
        <TextField label={t.licenceUrl} id="src-lurl" name="license_url" type="url" pattern="https://.*" />
        <TextField label={t.licenceText} id="src-ltext" name="license_text" />
        <TextField label={t.language} id="src-lang" name="language" placeholder="ar" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.addSourceBtn}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Users & roles ---------- */

export function RolesManager() {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const { rows, reload } = useRows<{ user_id: string; role: string; granted_at: string; credential_note: string | null }>(() => sb()?.from("role_assignments").select("user_id, role, granted_at, credential_note").order("granted_at", { ascending: false }));
  const [msg, setMsg] = useState<AdminMsg>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="zq-tablewrap zq-table-scroll" role="region" aria-label={t.roleAssignments} tabIndex={0}>
        <table className="zq-table zq-table-cards">
          <caption className="sr-only">{t.roleAssignments}</caption>
          <thead>
            <tr>
              <th scope="col">{t.userId}</th>
              <th scope="col">{t.role}</th>
              <th scope="col">{t.verificationNote}</th>
              <th scope="col">{t.granted}</th>
              <th scope="col"><span className="sr-only">{t.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.user_id + r.role}>
                <td data-label={t.userId} className="zq-order">{r.user_id}</td>
                <td data-label={t.role}>{t.roles[r.role] ?? r.role.replace("_", " ")}</td>
                <td data-label={t.verificationNote}>{r.credential_note ?? "—"}</td>
                <td data-label={t.granted}>{new Date(r.granted_at).toLocaleDateString()}</td>
                <td data-label={t.actions}>
                  <button
                    type="button"
                    className="zq-btn zq-btn-danger zq-btn-sm"
                    onClick={async () => {
                      if (!window.confirm(t.confirmRevoke(t.roles[r.role] ?? r.role, r.user_id))) return;
                      const { error } = (await sb()?.from("role_assignments").delete().eq("user_id", r.user_id).eq("role", r.role)) ?? { error: { message: NC } };
                      setMsg(error ? errMsg(locale, t.failedPrefix, error.message, t.notConfigured) : { tone: "ok", text: t.revoked });
                      void reload();
                    }}
                  >
                    {t.revoke}
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
          const { error } = (await c?.from("role_assignments").insert({ user_id: String(f.get("user_id")).trim(), role: String(f.get("role")), granted_by: me, credential_note: String(f.get("note") ?? "").trim() || null })) ?? { error: { message: NC } };
          setMsg(error ? errMsg(locale, t.failedPrefix, error.message, t.notConfigured) : { tone: "ok", text: t.roleGranted });
          if (!error) void reload();
        }}
      >
        <h3>{t.grantRole}</h3>
        <TextField label={t.userId} id="role-user" name="user_id" required pattern="[0-9a-f-]{36}" dir="ltr" help={t.userIdHelp} />
        <div className="zq-field">
          <label htmlFor="role-role">{t.role}</label>
          <select id="role-role" name="role" className="zq-input">
            <option value="moderator">{t.roleModerator}</option>
            <option value="editor">{t.roleEditor}</option>
            <option value="scholarly_reviewer">{t.roleScholarly}</option>
            <option value="science_reviewer">{t.roleScience}</option>
            <option value="admin">{t.roleAdmin}</option>
          </select>
        </div>
        <TextField label={t.identityCheck} id="role-note" name="note" maxLength={500} help={t.identityHelp} />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.grantRoleBtn}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Audit trail ---------- */

export function AuditTrail() {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const { rows, error } = useRows<{ id: number; actor: string | null; action: string; entity_type: string; entity_id: string; at: string; changes: Record<string, unknown> | null }>(() =>
    sb()?.from("audit_logs").select("id, actor, action, entity_type, entity_id, at, changes").order("at", { ascending: false }).limit(200),
  );
  if (error) return <LoadError error={error} />;
  return (
    <div className="zq-tablewrap zq-table-scroll" role="region" aria-label={t.auditTrail} tabIndex={0}>
      <table className="zq-table zq-table-cards">
        <caption className="sr-only">{t.auditTrailNewest}</caption>
        <thead>
          <tr>
            <th scope="col">{t.when}</th>
            <th scope="col">{t.who}</th>
            <th scope="col">{t.action}</th>
            <th scope="col">{t.entity}</th>
            <th scope="col">{t.changedFields}</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.id}>
              <td data-label={t.when}>{new Date(r.at).toLocaleString()}</td>
              <td data-label={t.who} className="zq-order">{r.actor?.slice(0, 8) ?? t.system}</td>
              <td data-label={t.action}>{r.action}</td>
              <td data-label={t.entity}>
                {r.entity_type} <span className="zq-order">{r.entity_id.slice(0, 8)}</span>
              </td>
              <td data-label={t.changedFields}>{r.action === "update" && r.changes ? Object.keys(r.changes).join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Stories and genealogy editors ---------- */

export function StoryComposer() {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const { rows: stories, reload } = useRows<{ id: string; slug: string; title: string; status: EditorialState }>(() => sb()?.from("stories").select("id, slug, title, status").order("created_at", { ascending: false }));
  const [msg, setMsg] = useState<AdminMsg>(null);
  const run = async (p: PromiseLike<{ error: { message: string } | null }> | undefined, ok: string) => {
    const res = await p;
    setMsg(!res ? { tone: "err", text: t.notConfigured } : res.error ? errMsg(locale, t.failedPrefix, res.error.message, t.notConfigured) : { tone: "ok", text: ok });
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
          void run(sb()?.from("stories").insert({ slug: String(f.get("slug")), title: String(f.get("title")), title_ar: String(f.get("title_ar") || "") || null, summary: String(f.get("summary")) }), t.storyCreated);
        }}
      >
        <h3>{t.newStory}</h3>
        <TextField label={t.slug} id="st-slug" name="slug" required pattern="[a-z0-9-]+" />
        <TextField label={t.title} id="st-title" name="title" required />
        <TextField label={t.arabicTitle} id="st-ar" name="title_ar" dir="rtl" lang="ar" />
        <TextField label={t.summary} id="st-sum" name="summary" required />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{t.createDraft}</button>
        </div>
      </form>
      <form
        className="zq-form pp-card"
        style={{ maxWidth: 720 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const c = sb();
          if (!c) return setMsg({ tone: "err", text: t.notConfigured });
          const { data, error } = await c.from("chapters").insert({ story_id: String(f.get("story")), position: Number(f.get("position")), title: String(f.get("title")), body_md: String(f.get("body")) }).select("id").single();
          if (error) return setMsg(errMsg(locale, t.failedPrefix, error.message, t.notConfigured));
          const claims = String(f.get("claims") ?? "").split(/[\s,]+/).filter(Boolean);
          if (claims.length) {
            const { error: e2 } = await c.from("chapter_claims").insert(claims.map((claim_id) => ({ chapter_id: data.id, claim_id })));
            if (e2) return setMsg(errMsg(locale, t.failedPrefix, e2.message, t.notConfigured));
          }
          setMsg({ tone: "ok", text: t.chapterSaved });
        }}
      >
        <h3>{t.addChapter}</h3>
        <div className="zq-field">
          <label htmlFor="ch-story">{t.storyWord}</label>
          <select id="ch-story" name="story" className="zq-input" required>
            {(stories ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <TextField label={t.position} id="ch-pos" name="position" type="number" min={1} required />
        <TextField label={t.chapterTitle} id="ch-title" name="title" required />
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="ch-body">{t.chapterText}</label>
          <textarea id="ch-body" name="body" className="zq-textarea" style={{ minHeight: 240 }} />
          <span className="zq-help">{t.chapterHelp}</span>
        </div>
        <TextField label={t.chapterClaims} id="ch-claims" name="claims" dir="ltr" help={t.chapterClaimsHelp} />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{t.saveChapterDraft}</button>
        </div>
      </form>
    </div>
  );
}

export function RelationshipEditor() {
  const locale = useLocale();
  const t = useMemo(() => adminToolsStrings(locale), [locale]);
  const { rows: people, reload } = useRows<{ id: string; slug: string; name_en: string; status: string }>(() => sb()?.from("people").select("id, slug, name_en, status").order("name_en"));
  const [msg, setMsg] = useState<AdminMsg>(null);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const res = await sb()?.from("people").insert({ slug: String(f.get("slug")), name_en: String(f.get("name_en")), name_ar: String(f.get("name_ar")), kind: String(f.get("kind")) });
          setMsg(!res ? { tone: "err", text: t.notConfigured } : res.error ? errMsg(locale, t.failedPrefix, res.error.message, t.notConfigured) : { tone: "ok", text: t.personAdded });
          if (res && !res.error) void reload();
        }}
      >
        <h3>{t.addPerson}</h3>
        <TextField label={t.slug} id="p-slug" name="slug" required pattern="[a-z0-9-]+" />
        <TextField label={t.name} id="p-en" name="name_en" required />
        <TextField label={t.arabicName} id="p-ar" name="name_ar" required dir="rtl" lang="ar" />
        <div className="zq-field">
          <label htmlFor="p-kind">{t.kind}</label>
          <select id="p-kind" name="kind" className="zq-input">
            {["prophet", "companion", "ahl_al_bayt", "scholar", "historical", "other"].map((k) => (
              <option key={k} value={k}>{t.personKinds[k] ?? k.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-secondary">{t.addPersonBtn}</button>
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
          setMsg(!res ? { tone: "err", text: t.notConfigured } : res.error ? errMsg(locale, t.failedPrefix, res.error.message, t.notConfigured) : { tone: "ok", text: t.edgeSaved });
        }}
      >
        <h3>{t.addFamilyLink}</h3>
        <p className="zq-meta" style={{ margin: 0 }}>{t.familyLinkNote}</p>
        {(["from", "to"] as const).map((k) => (
          <div className="zq-field" key={k}>
            <label htmlFor={`r-${k}`}>{k === "from" ? t.from : t.to}</label>
            <select id={`r-${k}`} name={k} className="zq-input" required>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name_en}</option>
              ))}
            </select>
          </div>
        ))}
        <div className="zq-field">
          <label htmlFor="r-kind">{t.relation}</label>
          <select id="r-kind" name="kind" className="zq-input">
            <option value="parent_of">{t.relParent}</option>
            <option value="spouse_of">{t.relSpouse}</option>
            <option value="sibling_of">{t.relSibling}</option>
            <option value="descendant_of">{t.relDescendant}</option>
          </select>
        </div>
        <TextField label={t.claimId} id="r-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="r-conf">{t.confidence}</label>
          <select id="r-conf" name="confidence" className="zq-input">
            {["quran", "hadith", "scholar", "estimate", "disputed", "unknown"].map((k) => (
              <option key={k} value={k}>{evLabel(locale, k)}</option>
            ))}
          </select>
        </div>
        <TextField label={t.competingGroup} id="r-group" name="group" dir="ltr" help={t.competingHelp} />
        <TextField label={t.tradition} id="r-trad" name="tradition" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{t.saveEdgeDraft}</button>
        </div>
      </form>
    </div>
  );
}
