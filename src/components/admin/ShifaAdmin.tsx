"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { requiredPathways, RECORD_TYPE_KEYS, type RecordType, type ReviewedType } from "@/lib/shifa/editor";
import { useLocale } from "@/lib/i18n/useLocale";
import { englishContent } from "@/lib/i18n/locales";
import { shifaStrings } from "@/lib/i18n/modules/shifa";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { adminShifaStrings } from "@/lib/i18n/modules/adminShifa";
import { AdminFeedback as Feedback, errMsg, type AdminMsg } from "./feedback";
import { ENTRY_KINDS, ICON_KEYS, SAFETY_KINDS, STUDY_TYPES, type EntryKind, type EvidenceCategory, type Pathway, type ShifaSection } from "@/lib/shifa/model";

/**
 * Shifa: editor and two-pathway review queue. Every action is authorised again by the API routes and by the database
 * (RLS, the publish guard and the reviewer check), so this screen only offers what the role may try. Both review
 * pathways are always visible on every record, with whether each is required, pending, approved for the current version,
 * or stale because the record was edited after the approval.
 */
async function call(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}


interface ReviewState {
  decision: string;
  stale: boolean;
}
interface Item {
  type: ReviewedType;
  id: string;
  status: EditorialState;
  label: string;
  detail: string;
  version: number;
  pathways: Pathway[];
  reviews: Partial<Record<Pathway, ReviewState>>;
}

export function ShifaAdmin({ canEdit, canReligious, canClinical }: { canEdit: boolean; canReligious: boolean; canClinical: boolean }) {
  const locale = useLocale();
  const sh = useMemo(() => adminShifaStrings(locale), [locale]);
  const sf = useMemo(() => shifaStrings(locale), [locale]);
  const statusWord = (s: string) => (uiStrings(locale).status as Record<string, string>)[s] ?? s.replace("_", " ");
  const sectionName = (s: string) => (sf.sections as Record<string, { title: string }>)[s]?.title ?? s.replace(/_/g, " ");
  const noteKind = (k: string) => (sf.safety.noteKinds as Record<string, string>)[k] ?? k.replace(/_/g, " ");
  const reviewText = (required: boolean, r?: ReviewState): string => {
    if (!required) return sh.notRequired;
    if (!r) return sh.pending;
    if (r.decision === "approved") return r.stale ? sh.approvedStale : sh.approvedCurrent;
    return (sh.decisions[r.decision] ?? r.decision.replace(/_/g, " ")) + (r.stale ? sh.earlierVersion : "");
  };
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setItems([]);
    const [topics, entries, notes, links, revs] = await Promise.all([
      c.from("shifa_topics").select("id, status, version, slug, section, title_en").neq("status", "archived").order("section").order("position").limit(200),
      c.from("shifa_entries").select("id, status, version, kind, title_en, shifa_topics(title_en, section), shifa_layers(evidence_category), shifa_scholarly_notes(id)").neq("status", "archived").order("updated_at", { ascending: false }).limit(300),
      c.from("shifa_safety_notes").select("id, status, version, kind, body_en, shifa_topics(title_en)").neq("status", "archived").limit(200),
      c.from("shifa_links").select("id, status, version, target_kind, shifa_topics(title_en)").neq("status", "archived").limit(200),
      c.from("shifa_reviews").select("entity_type, entity_id, entity_version, pathway, decision").order("created_at", { ascending: false }).limit(3000),
    ]);
    const latest = new Map<string, { decision: string; entity_version: number }>();
    for (const r of (revs.data ?? []) as Array<{ entity_type: string; entity_id: string; entity_version: number; pathway: Pathway; decision: string }>) {
      const k = `${r.entity_type}:${r.entity_id}:${r.pathway}`;
      if (!latest.has(k)) latest.set(k, r);
    }
    const reviewsFor = (type: ReviewedType, id: string, version: number): Partial<Record<Pathway, ReviewState>> => {
      const out: Partial<Record<Pathway, ReviewState>> = {};
      for (const p of ["religious", "clinical"] as Pathway[]) {
        const r = latest.get(`${type}:${id}:${p}`);
        if (r) out[p] = { decision: r.decision, stale: r.entity_version !== version };
      }
      return out;
    };
    const out: Item[] = [];
    for (const t of (topics.data ?? []) as Array<{ id: string; status: EditorialState; version: number; slug: string; section: ShifaSection; title_en: string }>)
      out.push({ type: "shifa_topic", id: t.id, status: t.status, version: t.version, label: t.title_en, detail: sh.topicDetail(`/shifa/${t.section.replace(/_/g, "-")}/${t.slug}`, sectionName(t.section)), pathways: requiredPathways({ type: "shifa_topic", section: t.section }), reviews: reviewsFor("shifa_topic", t.id, t.version) });
    for (const e of (entries.data ?? []) as unknown as Array<{ id: string; status: EditorialState; version: number; kind: EntryKind; title_en: string; shifa_topics: { title_en: string; section: ShifaSection } | null; shifa_layers: Array<{ evidence_category: EvidenceCategory }>; shifa_scholarly_notes: Array<{ id: string }> }>) {
      const cats = e.shifa_layers.map((l) => l.evidence_category);
      out.push({
        type: "shifa_entry",
        id: e.id,
        status: e.status,
        version: e.version,
        label: `${e.shifa_topics?.title_en ?? sh.topicWord} · ${e.title_en}`,
        detail: sh.entryDetail((sf.entryKinds as Record<string, string>)[e.kind] ?? e.kind, cats.length ? [...new Set(cats)].sort().join(", ") : sh.noneYet, e.shifa_scholarly_notes.length, e.version),
        pathways: requiredPathways({ type: "shifa_entry", section: e.shifa_topics?.section ?? "quranic_healing", kind: e.kind, categories: cats, scholarlyNotes: e.shifa_scholarly_notes.length }),
        reviews: reviewsFor("shifa_entry", e.id, e.version),
      });
    }
    for (const n of (notes.data ?? []) as unknown as Array<{ id: string; status: EditorialState; version: number; kind: string; body_en: string; shifa_topics: { title_en: string } | null }>)
      out.push({ type: "shifa_safety_note", id: n.id, status: n.status, version: n.version, label: sh.safetyNoteLabel(n.shifa_topics?.title_en ?? sh.topicWord, noteKind(n.kind)), detail: n.body_en.slice(0, 240), pathways: requiredPathways({ type: "shifa_safety_note", kind: n.kind }), reviews: reviewsFor("shifa_safety_note", n.id, n.version) });
    for (const l of (links.data ?? []) as unknown as Array<{ id: string; status: EditorialState; version: number; target_kind: string; shifa_topics: { title_en: string } | null }>)
      out.push({ type: "shifa_link", id: l.id, status: l.status, version: l.version, label: `${l.shifa_topics?.title_en ?? sh.topicWord} → ${sh.targetKinds[l.target_kind] ?? l.target_kind.replace(/_/g, " ")}`, detail: sh.linkDetail, pathways: ["religious"], reviews: reviewsFor("shifa_link", l.id, l.version) });
    setItems(out);
  }, [sh, sf]);
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
      setMsg(errMsg(locale, sh.failedPrefix, (e as Error).message));
    }
  };
  const review = (it: Item, pathway: Pathway, decision: "approved" | "changes_requested") => {
    const comment = decision === "changes_requested" ? (window.prompt(sh.promptChanges) ?? "") : undefined;
    if (decision === "changes_requested" && !comment) return;
    void act(() => call("/api/admin/shifa/review", { entityType: it.type, entityId: it.id, pathway, decision, comment }), decision === "approved" ? sh.okReviewVersion : sh.okChanges);
  };
  const status = (it: Item, s: string, revisionNote?: string) => act(() => call("/api/admin/status", { entityType: it.type, entityId: it.id, status: s, revisionNote }), sh.okStatus(statusWord(s)));
  const can: Record<Pathway, boolean> = { religious: canReligious, clinical: canClinical };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="pp-card" aria-labelledby="sh-rules-h">
        <h3 id="sh-rules-h">{sh.rulesHeading}</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>{sh.rule1}</li>
          <li>{sh.rule2}</li>
          <li>{sh.rule3}</li>
          <li>{sh.rule4}</li>
          <li>{sh.rule5}</li>
          <li>{sh.rule6}</li>
          <li>{sh.rule7}</li>
          <li>{sh.rule8}</li>
        </ul>
      </section>

      {canEdit ? <Editor onSaved={(text) => act(async () => undefined, text)} /> : null}

      <Feedback msg={msg} />
      {!items ? (
        <Skeleton height={20} />
      ) : !items.length ? (
        <EmptyState title={sh.noRecords} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }} data-testid="shifa-queue">
          {items.map((it) => (
            <li key={it.type + it.id} className="pp-card">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="zq-eyebrow">{sh.recordTypes[it.type]}</span>
                <EditorialStatus status={it.status} />
                <span className="zq-meta">{sh.versionN(it.version)}</span>
              </div>
              <p style={{ margin: 0 }} {...englishContent(locale)}>{it.label}</p>
              <p className="zq-meta" style={{ margin: 0 }}>
                {it.detail}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(["religious", "clinical"] as Pathway[]).map((p) => (
                  <span key={p} className="zq-meta" data-pathway={p}>
                    {sh.pathwayLabels[p]}: {reviewText(it.pathways.includes(p), it.reviews[p])}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEdit && it.status === "draft" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "in_review")}>
                    {sh.sendForReview}
                  </button>
                ) : null}
                {(["religious", "clinical"] as Pathway[]).map((p) =>
                  can[p] && it.pathways.includes(p) ? (
                    <span key={p} style={{ display: "contents" }}>
                      <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(it, p, "approved")}>
                        {sh.approveP(sh.pathways[p]!)}
                      </button>
                      <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(it, p, "changes_requested")}>
                        {sh.changesP(sh.pathways[p]!)}
                      </button>
                    </span>
                  ) : null,
                )}
                {canEdit && it.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "published")}>
                    {sh.publish}
                  </button>
                ) : null}
                {canEdit && it.status === "published" ? (
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary zq-btn-sm"
                    onClick={() => {
                      const note = window.prompt(sh.revisionPrompt) ?? "";
                      if (note.trim().length >= 3) void status(it, "correction", note);
                    }}
                  >
                    {sh.startCorrection}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Editor ---------- */

interface Ref {
  id: string;
  label: string;
}

function Editor({ onSaved }: { onSaved: (text: string) => void }) {
  const locale = useLocale();
  const sh = useMemo(() => adminShifaStrings(locale), [locale]);
  const sf = useMemo(() => shifaStrings(locale), [locale]);
  const optLabel = (o: string): string =>
    (sf.sections as Record<string, { title: string }>)[o]?.title ?? (sf.entryKinds as Record<string, string>)[o] ?? (sf.safety.noteKinds as Record<string, string>)[o] ?? (sf.research.studyTypes as Record<string, string>)[o] ?? o.replace(/_/g, " ");
  const [type, setType] = useState<RecordType>("shifa_topic");
  const [cat, setCat] = useState<EvidenceCategory>("A");
  const [err, setErr] = useState<AdminMsg>(null);
  const [topics, setTopics] = useState<Ref[]>([]);
  const [entries, setEntries] = useState<Ref[]>([]);
  const [claims, setClaims] = useState<Array<Ref & { evidence: string }>>([]);
  const [people, setPeople] = useState<Ref[]>([]);
  const [guidance, setGuidance] = useState<Ref[]>([]);
  const [targetKind, setTargetKind] = useState("guidance_topic");

  useEffect(() => {
    const c = getBrowserSupabase();
    if (!c) return;
    void (async () => {
      const [t, e, cl, p, g] = await Promise.all([
        c.from("shifa_topics").select("id, title_en").order("title_en").limit(200),
        c.from("shifa_entries").select("id, title_en, shifa_topics(title_en)").neq("status", "published").order("updated_at", { ascending: false }).limit(300),
        c.from("evidence_claims").select("id, statement, evidence").in("status", ["approved", "published"]).limit(400),
        c.from("people").select("id, name_en").order("name_en").limit(300),
        c.from("guidance_topics").select("id, title_en").order("title_en").limit(100),
      ]);
      setTopics(((t.data ?? []) as Array<{ id: string; title_en: string }>).map((x) => ({ id: x.id, label: x.title_en })));
      setEntries(((e.data ?? []) as unknown as Array<{ id: string; title_en: string; shifa_topics: { title_en: string } | null }>).map((x) => ({ id: x.id, label: `${x.shifa_topics?.title_en ?? sh.topicWord} · ${x.title_en}` })));
      setClaims(((cl.data ?? []) as Array<{ id: string; statement: string; evidence: string }>).map((x) => ({ id: x.id, label: x.statement.slice(0, 90), evidence: x.evidence })));
      setPeople(((p.data ?? []) as Array<{ id: string; name_en: string }>).map((x) => ({ id: x.id, label: x.name_en })));
      setGuidance(((g.data ?? []) as Array<{ id: string; title_en: string }>).map((x) => ({ id: x.id, label: x.title_en })));
    })();
  }, []);

  const f = (id: string, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>, help?: string) => (
    <div className="zq-field">
      <label htmlFor={`sh-${id}`}>{label}</label>
      <input id={`sh-${id}`} name={id} className="zq-input" {...extra} />
      {help ? <p className="zq-help">{help}</p> : null}
    </div>
  );
  const area = (id: string, label: string, help?: string) => (
    <div className="zq-field">
      <label htmlFor={`sh-${id}`}>{label}</label>
      <textarea id={`sh-${id}`} name={id} className="zq-input" rows={4} />
      {help ? <p className="zq-help">{help}</p> : null}
    </div>
  );
  const sel = (id: string, label: string, options: ReadonlyArray<string | Ref>, allowEmpty = false, help?: string) => (
    <div className="zq-field">
      <label htmlFor={`sh-${id}`}>{label}</label>
      <select id={`sh-${id}`} name={id} className="zq-input" required={!allowEmpty}>
        {allowEmpty ? <option value="">—</option> : <option value="" disabled>{sh.chooseDots}</option>}
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.id;
          const t = typeof o === "string" ? optLabel(o) : o.label;
          return (
            <option key={v} value={v} {...(typeof o === "string" ? {} : englishContent(locale))}>
              {t}
            </option>
          );
        })}
      </select>
      {help ? <p className="zq-help">{help}</p> : null}
    </div>
  );
  const check = (id: string, label: string) => (
    <label className="zq-check">
      <input type="checkbox" name={id} /> {label}
    </label>
  );
  const claimOptions = (evidence: string) => claims.filter((c) => c.evidence === evidence);

  return (
    <form
      className="zq-form pp-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const data: Record<string, unknown> = {};
        for (const [k, v] of fd.entries()) if (k !== "type" && v !== "") data[k] = v;
        for (const k of ["states_health_effect", "is_traditional", "is_hypothesis"]) if (type === "shifa_layer") data[k] = fd.get(k) === "on";
        if (data.position) data.position = Number(data.position);
        if (type === "shifa_layer") data.evidence_category = cat;
        try {
          await call("/api/admin/shifa", { type, data });
          onSaved(sh.okDraftSaved);
          form.reset();
        } catch (x) {
          setErr(errMsg(locale, sh.failedPrefix, (x as Error).message));
        }
      }}
    >
      <h3>{sh.newDraft}</h3>
      <p className="zq-help">{sh.noPrefill}</p>
      <div className="zq-field">
        <label htmlFor="sh-type">{sh.recordType}</label>
        <select id="sh-type" name="type" className="zq-input" value={type} onChange={(e) => setType(e.target.value as RecordType)}>
          {RECORD_TYPE_KEYS.map((t) => (
            <option key={t} value={t}>
              {sh.recordTypes[t]}
            </option>
          ))}
        </select>
      </div>

      {type === "shifa_topic" ? (
        <>
          {f("slug", sh.slugShort, { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {sel("section", sh.section, ["quranic_healing", "ruqyah", "prophetic_remedies", "wellbeing"])}
          {f("title_en", sh.titleNav, { required: true })}
          {f("title_ar", sh.titleArDraft, { dir: "rtl", lang: "ar" })}
          {sel("icon_key", sh.abstractIcon, ICON_KEYS, true)}
        </>
      ) : null}
      {type === "shifa_entry" ? (
        <>
          {sel("topic_id", sh.topicWord, topics)}
          {f("slug", sh.slugShort, { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {sel("kind", sh.kind, ENTRY_KINDS)}
          {f("title_en", sh.titleEn, { required: true })}
          {f("title_ar", sh.titleAr, { dir: "rtl", lang: "ar" })}
        </>
      ) : null}
      {type === "shifa_layer" ? (
        <>
          {sel("entry_id", sh.entryDraft, entries)}
          <div className="zq-field">
            <label htmlFor="sh-cat">{sh.layer}</label>
            <select id="sh-cat" className="zq-input" value={cat} onChange={(e) => setCat(e.target.value as EvidenceCategory)}>
              <option value="A">{sf.layers.A.name}</option>
              <option value="B">{sf.layers.B.name}</option>
              <option value="C">{sf.layers.C.name}</option>
              <option value="D">{sf.layers.D.name}</option>
            </select>
          </div>
          {cat === "A" ? sel("claim_id", sh.approvedQuranClaim, claimOptions("quran"), false, sh.quranClaimHelp) : null}
          {cat === "B" ? sel("claim_id", sh.approvedHadithClaim, claimOptions("hadith"), false, sh.hadithClaimHelp) : null}
          {cat === "C" ? (
            <>
              {area("finding", sh.finding, sh.findingHelp)}
              {f("publication", sh.publication, { required: true })}
              {f("citation", sh.citation, { required: true })}
              {f("url", sh.publicationLink, { type: "url", dir: "ltr" })}
              {sel("study_type", sh.studyType, STUDY_TYPES)}
              {f("population", sh.population, { required: true })}
              {area("limitations", sh.limits, sh.limitsHelp)}
              {check("states_health_effect", sh.healthEffectCheck)}
            </>
          ) : null}
          {cat === "D" ? (
            <>
              {area("finding", sh.traditionalStatement)}
              {f("citation", sh.traditionalSource)}
              {check("is_traditional", sh.traditionalCheck)}
              {check("is_hypothesis", sh.hypothesisCheck)}
            </>
          ) : null}
          {f("language", sh.languageOfText, { defaultValue: "en", pattern: "[a-z]{2,3}", dir: "ltr" })}
        </>
      ) : null}
      {type === "shifa_scholarly_note" ? (
        <>
          {sel("entry_id", sh.entryDraft, entries)}
          {sel("claim_id", sh.approvedScholarlyClaim, claimOptions("scholar"), false, sh.scholarlyClaimHelp)}
          {f("scholar_name", sh.scholarNamed, { required: true })}
          {f("work_title", sh.work, { required: true })}
          {f("locator", sh.locator)}
        </>
      ) : null}
      {type === "shifa_safety_note" ? (
        <>
          {sel("topic_id", sh.topicWord, topics)}
          {sel("entry_id", sh.entryOptional, entries, true)}
          {sel("kind", sh.kind, SAFETY_KINDS)}
          {area("body_en", sh.noteEn, sh.noteEnHelp)}
          {area("body_ar", sh.noteArDraft)}
        </>
      ) : null}
      {type === "shifa_link" ? (
        <>
          {sel("topic_id", sh.shifaTopic, topics)}
          {sel("entry_id", sh.entryOptional, entries, true)}
          <div className="zq-field">
            <label htmlFor="sh-target-kind">{sh.linksTo}</label>
            <select id="sh-target-kind" name="target_kind" className="zq-input" value={targetKind} onChange={(e) => setTargetKind(e.target.value)}>
              {["guidance_topic", "person", "event", "story", "food"].map((k) => (
                <option key={k} value={k}>
                  {sh.targetKinds[k] ?? k.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          {targetKind === "guidance_topic" ? sel("target_id", sh.lifeGuidanceTopic, guidance) : null}
          {targetKind === "person" ? sel("target_id", sh.personAyyub, people) : null}
          {["event", "story", "food"].includes(targetKind) ? f("target_id", sh.idOfKind(sh.targetKinds[targetKind] ?? targetKind), { required: true, dir: "ltr" }) : null}
        </>
      ) : null}
      {type !== "shifa_link" ? f("position", sh.order, { type: "number", min: 1, max: 500, defaultValue: type === "shifa_topic" ? 100 : 1 }) : f("position", sh.order, { type: "number", min: 1, max: 500, defaultValue: 1 })}
      <Feedback msg={err} />
      <button type="submit" className="zq-btn zq-btn-primary">
        {sh.saveDraft}
      </button>
    </form>
  );
}
