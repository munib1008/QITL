"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { requiredPathways, RECORD_TYPE_KEYS, type RecordType, type ReviewedType } from "@/lib/shifa/editor";
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

const TYPE_LABEL: Record<RecordType, string> = {
  shifa_topic: "Topic",
  shifa_entry: "Entry",
  shifa_layer: "Evidence layer (A–D)",
  shifa_scholarly_note: "Scholarly note",
  shifa_safety_note: "Safety note",
  shifa_link: "Link",
};
const REVIEWED_LABEL: Record<ReviewedType, string> = { shifa_topic: "Topic", shifa_entry: "Entry", shifa_safety_note: "Safety note", shifa_link: "Link" };
const PATHWAY_LABEL: Record<Pathway, string> = { religious: "Religious review", clinical: "Clinical review" };

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

function reviewText(required: boolean, r?: ReviewState): string {
  if (!required) return "not required";
  if (!r) return "pending";
  if (r.decision === "approved") return r.stale ? "approved an earlier version — edited since, needs a new review" : "approved (current version)";
  return r.decision.replace(/_/g, " ") + (r.stale ? " (earlier version)" : "");
}

export function ShifaAdmin({ canEdit, canReligious, canClinical }: { canEdit: boolean; canReligious: boolean; canClinical: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

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
      out.push({ type: "shifa_topic", id: t.id, status: t.status, version: t.version, label: t.title_en, detail: `/shifa/${t.section.replace(/_/g, "-")}/${t.slug} · ${t.section.replace(/_/g, " ")}`, pathways: requiredPathways({ type: "shifa_topic", section: t.section }), reviews: reviewsFor("shifa_topic", t.id, t.version) });
    for (const e of (entries.data ?? []) as unknown as Array<{ id: string; status: EditorialState; version: number; kind: EntryKind; title_en: string; shifa_topics: { title_en: string; section: ShifaSection } | null; shifa_layers: Array<{ evidence_category: EvidenceCategory }>; shifa_scholarly_notes: Array<{ id: string }> }>) {
      const cats = e.shifa_layers.map((l) => l.evidence_category);
      out.push({
        type: "shifa_entry",
        id: e.id,
        status: e.status,
        version: e.version,
        label: `${e.shifa_topics?.title_en ?? "Topic"} · ${e.title_en}`,
        detail: `${e.kind} · layers ${cats.length ? [...new Set(cats)].sort().join(", ") : "none yet"} · ${e.shifa_scholarly_notes.length} scholarly note(s) · version ${e.version}`,
        pathways: requiredPathways({ type: "shifa_entry", section: e.shifa_topics?.section ?? "quranic_healing", kind: e.kind, categories: cats, scholarlyNotes: e.shifa_scholarly_notes.length }),
        reviews: reviewsFor("shifa_entry", e.id, e.version),
      });
    }
    for (const n of (notes.data ?? []) as unknown as Array<{ id: string; status: EditorialState; version: number; kind: string; body_en: string; shifa_topics: { title_en: string } | null }>)
      out.push({ type: "shifa_safety_note", id: n.id, status: n.status, version: n.version, label: `${n.shifa_topics?.title_en ?? "Topic"} · safety note (${n.kind.replace(/_/g, " ")})`, detail: n.body_en.slice(0, 240), pathways: requiredPathways({ type: "shifa_safety_note", kind: n.kind }), reviews: reviewsFor("shifa_safety_note", n.id, n.version) });
    for (const l of (links.data ?? []) as unknown as Array<{ id: string; status: EditorialState; version: number; target_kind: string; shifa_topics: { title_en: string } | null }>)
      out.push({ type: "shifa_link", id: l.id, status: l.status, version: l.version, label: `${l.shifa_topics?.title_en ?? "Topic"} → ${l.target_kind.replace(/_/g, " ")}`, detail: "A related-reading link; it shows only once the Shifa topic is published.", pathways: ["religious"], reviews: reviewsFor("shifa_link", l.id, l.version) });
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
  const review = (it: Item, pathway: Pathway, decision: "approved" | "changes_requested") => {
    const comment = decision === "changes_requested" ? (window.prompt("What needs to change?") ?? "") : undefined;
    if (decision === "changes_requested" && !comment) return;
    void act(() => call("/api/admin/shifa/review", { entityType: it.type, entityId: it.id, pathway, decision, comment }), decision === "approved" ? "Review recorded for this version." : "Changes requested.");
  };
  const status = (it: Item, s: string, revisionNote?: string) => act(() => call("/api/admin/status", { entityType: it.type, entityId: it.id, status: s, revisionNote }), `Status: ${s.replace("_", " ")}.`);
  const can: Record<Pathway, boolean> = { religious: canReligious, clinical: canClinical };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="pp-card" aria-labelledby="sh-rules-h">
        <h3 id="sh-rules-h">Evidence and review rules</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>A (Quran) and B (authentic hadith: Bukhari, Muslim, or individually sahih in Tirmidhi / Ibn Majah) hold only an approved evidence claim. A mention in scripture is never a treatment claim.</li>
          <li>C (research) is the only layer that may state a health effect. It needs the finding, a named publication, a citation, the study type, the population and stated limits. Never enter a citation you have not checked against the publication itself.</li>
          <li>D (traditional use or hypothesis) is flagged as such, shown apart and never as established.</li>
          <li>No dosage, no “take X for Y”, no promised cure, no personal advice. The editor and the database refuse amounts with units, per-day frequencies and treatment instructions.</li>
          <li>Ruqyah: only the Quran and supplications from the allowed hadith sources; its conditions are scholarly notes with a named scholar and work. No tool that attributes illness to jinn, the evil eye or magic.</li>
          <li>Religious review (scholarly reviewer): A/B, scholarly notes, supplications, Quranic healing, ruqyah, topics, links. Clinical review (science reviewer): C/D, remedies, lifestyle, safety notes, and anything in the remedies and wellbeing sections. Mixed records need both, for the version being published; editing afterwards makes the approval stale.</li>
          <li>A remedy page needs a published general safety note and a published medicines/interactions note. A wellbeing topic needs a published mental-health note and a published crisis note.</li>
          <li>A reviewer never reviews a record they, or the author of any of its layers, wrote.</li>
        </ul>
      </section>

      {canEdit ? <Editor onSaved={(t) => act(async () => undefined, t)} /> : null}

      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}
      {!items ? (
        <Skeleton height={20} />
      ) : !items.length ? (
        <EmptyState title="No Shifa records yet." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }} data-testid="shifa-queue">
          {items.map((it) => (
            <li key={it.type + it.id} className="pp-card">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="zq-eyebrow">{REVIEWED_LABEL[it.type]}</span>
                <EditorialStatus status={it.status} />
                <span className="zq-meta">Version {it.version}</span>
              </div>
              <p style={{ margin: 0 }}>{it.label}</p>
              <p className="zq-meta" style={{ margin: 0 }}>
                {it.detail}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(["religious", "clinical"] as Pathway[]).map((p) => (
                  <span key={p} className="zq-meta" data-pathway={p}>
                    {PATHWAY_LABEL[p]}: {reviewText(it.pathways.includes(p), it.reviews[p])}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEdit && it.status === "draft" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "in_review")}>
                    Send for review
                  </button>
                ) : null}
                {(["religious", "clinical"] as Pathway[]).map((p) =>
                  can[p] && it.pathways.includes(p) ? (
                    <span key={p} style={{ display: "contents" }}>
                      <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(it, p, "approved")}>
                        Approve ({p})
                      </button>
                      <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(it, p, "changes_requested")}>
                        Request changes ({p})
                      </button>
                    </span>
                  ) : null,
                )}
                {canEdit && it.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "published")}>
                    Publish
                  </button>
                ) : null}
                {canEdit && it.status === "published" ? (
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary zq-btn-sm"
                    onClick={() => {
                      const note = window.prompt("Public revision note: what is being corrected and why?") ?? "";
                      if (note.trim().length >= 3) void status(it, "correction", note);
                    }}
                  >
                    Start a correction
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
  const [type, setType] = useState<RecordType>("shifa_topic");
  const [cat, setCat] = useState<EvidenceCategory>("A");
  const [err, setErr] = useState<string | null>(null);
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
      setEntries(((e.data ?? []) as unknown as Array<{ id: string; title_en: string; shifa_topics: { title_en: string } | null }>).map((x) => ({ id: x.id, label: `${x.shifa_topics?.title_en ?? "Topic"} · ${x.title_en}` })));
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
        {allowEmpty ? <option value="">—</option> : <option value="" disabled>Choose…</option>}
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.id;
          const t = typeof o === "string" ? o.replace(/_/g, " ") : o.label;
          return (
            <option key={v} value={v}>
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
          onSaved("Draft saved. Send it for review when it is complete.");
          form.reset();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <h3>New draft record</h3>
      <p className="zq-help">No remedy, claim, dosage, verse, hadith or citation is ever pre-filled. Enter only what you have checked against the source.</p>
      <div className="zq-field">
        <label htmlFor="sh-type">Record type</label>
        <select id="sh-type" name="type" className="zq-input" value={type} onChange={(e) => setType(e.target.value as RecordType)}>
          {RECORD_TYPE_KEYS.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {type === "shifa_topic" ? (
        <>
          {f("slug", "Slug", { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {sel("section", "Section", ["quranic_healing", "ruqyah", "prophetic_remedies", "wellbeing"])}
          {f("title_en", "Title (English). A title is a navigation label, not a claim.", { required: true })}
          {f("title_ar", "Title (Arabic, draft until a translator reviews it)", { dir: "rtl", lang: "ar" })}
          {sel("icon_key", "Abstract icon", ICON_KEYS, true)}
        </>
      ) : null}
      {type === "shifa_entry" ? (
        <>
          {sel("topic_id", "Topic", topics)}
          {f("slug", "Slug", { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {sel("kind", "Kind", ENTRY_KINDS)}
          {f("title_en", "Title (English)", { required: true })}
          {f("title_ar", "Title (Arabic)", { dir: "rtl", lang: "ar" })}
        </>
      ) : null}
      {type === "shifa_layer" ? (
        <>
          {sel("entry_id", "Entry (a draft)", entries)}
          <div className="zq-field">
            <label htmlFor="sh-cat">Layer</label>
            <select id="sh-cat" className="zq-input" value={cat} onChange={(e) => setCat(e.target.value as EvidenceCategory)}>
              <option value="A">A · What the Quran says</option>
              <option value="B">B · What authentic hadith record</option>
              <option value="C">C · What modern research reports</option>
              <option value="D">D · Traditional use or hypothesis (not established)</option>
            </select>
          </div>
          {cat === "A" ? sel("claim_id", "Approved Quran claim", claimOptions("quran"), false, "Create the claim with its verse reference and have a scholarly reviewer approve it first.") : null}
          {cat === "B" ? sel("claim_id", "Approved hadith claim", claimOptions("hadith"), false, "Only Bukhari, Muslim, or a narration individually graded sahih in Tirmidhi or Ibn Majah; the database checks.") : null}
          {cat === "C" ? (
            <>
              {area("finding", "What the research reports", "Report the finding and its direction, including a null result. No instruction, no dosage.")}
              {f("publication", "Publication (journal or report)", { required: true })}
              {f("citation", "Citation", { required: true })}
              {f("url", "Link to the publication (https)", { type: "url", dir: "ltr" })}
              {sel("study_type", "Study type", STUDY_TYPES)}
              {f("population", "Population or subject (people, species, cells)", { required: true })}
              {area("limitations", "Limits of this evidence", "State study size, species or population, what was studied (describe, never recommend), and conflicts of interest. At least 20 characters.")}
              {check("states_health_effect", "This finding reports a health effect")}
            </>
          ) : null}
          {cat === "D" ? (
            <>
              {area("finding", "The traditional use or hypothesis, as a statement of what is said, not of what works")}
              {f("citation", "Historical or traditional source, if any")}
              {check("is_traditional", "Traditional use")}
              {check("is_hypothesis", "Hypothesis")}
            </>
          ) : null}
          {f("language", "Language of the text", { defaultValue: "en", pattern: "[a-z]{2,3}", dir: "ltr" })}
        </>
      ) : null}
      {type === "shifa_scholarly_note" ? (
        <>
          {sel("entry_id", "Entry (a draft)", entries)}
          {sel("claim_id", "Approved scholarly claim", claimOptions("scholar"), false, "The conditions of a permissible ruqyah are scholarly claims, not editor opinion.")}
          {f("scholar_name", "Scholar (named)", { required: true })}
          {f("work_title", "Work", { required: true })}
          {f("locator", "Volume / page / section")}
        </>
      ) : null}
      {type === "shifa_safety_note" ? (
        <>
          {sel("topic_id", "Topic", topics)}
          {sel("entry_id", "Entry (optional)", entries, true)}
          {sel("kind", "Kind", SAFETY_KINDS)}
          {area("body_en", "Note (English)", "Safety wording only. No dosage.")}
          {area("body_ar", "Note (Arabic, draft until reviewed)")}
        </>
      ) : null}
      {type === "shifa_link" ? (
        <>
          {sel("topic_id", "Shifa topic", topics)}
          {sel("entry_id", "Entry (optional)", entries, true)}
          <div className="zq-field">
            <label htmlFor="sh-target-kind">Links to</label>
            <select id="sh-target-kind" name="target_kind" className="zq-input" value={targetKind} onChange={(e) => setTargetKind(e.target.value)}>
              {["guidance_topic", "person", "event", "story", "food"].map((k) => (
                <option key={k} value={k}>
                  {k.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          {targetKind === "guidance_topic" ? sel("target_id", "Life Guidance topic", guidance) : null}
          {targetKind === "person" ? sel("target_id", "Person (e.g. Ayyub: the story stays in the stories module)", people) : null}
          {["event", "story", "food"].includes(targetKind) ? f("target_id", `${targetKind} id`, { required: true, dir: "ltr" }) : null}
        </>
      ) : null}
      {type !== "shifa_link" ? f("position", "Order", { type: "number", min: 1, max: 500, defaultValue: type === "shifa_topic" ? 100 : 1 }) : f("position", "Order", { type: "number", min: 1, max: 500, defaultValue: 1 })}
      {err ? (
        <p role="alert" className="zq-error">
          {err}
        </p>
      ) : null}
      <button type="submit" className="zq-btn zq-btn-primary">
        Save draft
      </button>
    </form>
  );
}
