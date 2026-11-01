"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { TextField } from "@/components/ui/misc";
import { EvidenceChip } from "@/components/lineage/EvidenceChip";
import { useLocale } from "@/lib/i18n/useLocale";
import { englishContent } from "@/lib/i18n/locales";
import { adminLineageStrings } from "@/lib/i18n/modules/adminLineage";
import { AdminFeedback as Feedback, ServerText, errMsg, type AdminMsg } from "./feedback";
import { isLineageClass, type LineageClass } from "@/lib/lineage/classes";

/* Admin for the Lineage of Humanity and the scripture witness registry. Arabic and Urdu labels are drafts for translators. */

type Msg = AdminMsg;
const sb = () => getBrowserSupabase();
const NC = "Not configured";

function LoadError({ error }: { error: string }) {
  const ln = adminLineageStrings(useLocale());
  return <p className="zq-error">{error === NC ? ln.notConfigured : <ServerText>{error}</ServerText>}</p>;
}

async function post(url: string, body: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
}

type EntityType = "lineage_gap" | "lineage_node_claim" | "scripture_witness" | "relationship";

/** Workflow buttons for one entry. The database decides whether each is allowed (roles, evidence, no self-review). */
function Workflow({ type, id, status, historical = false, onDone, setMsg }: { type: EntityType; id: string; status: string; historical?: boolean; onDone: () => void; setMsg: (m: Msg) => void }) {
  const locale = useLocale();
  const ln = adminLineageStrings(locale);
  const run = async (label: string, f: () => Promise<void>) => {
    try {
      await f();
      setMsg({ tone: "ok", text: ln.doneLabel(label) });
      onDone();
    } catch (e) {
      setMsg(errMsg(locale, ln.failedPrefix, (e as Error).message));
    }
  };
  const review = (decision: "approved" | "changes_requested") =>
    post(type === "relationship" ? "/api/admin/review" : "/api/admin/lineage", type === "relationship" ? { entityType: "relationship", entityId: id, decision } : { action: "review", entityType: type, entityId: id, decision });
  const setStatus = (s: string, revisionNote?: string) =>
    post(type === "relationship" ? "/api/admin/status" : "/api/admin/lineage", type === "relationship" ? { entityType: "relationship", entityId: id, status: s, revisionNote } : { action: "status", entityType: type, entityId: id, status: s, revisionNote });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {status === "draft" || status === "correction" ? (
        <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => run(ln.wfSent, () => setStatus("in_review"))}>
          {ln.sendToReview}
        </button>
      ) : null}
      <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => run(ln.wfScholarly, () => review("approved"))}>
        {ln.scholarlyApprove}
      </button>
      <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={() => run(ln.wfChanges, () => review("changes_requested"))}>
        {ln.scholarlyChanges}
      </button>
      {historical ? (
        <>
          <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => run(ln.wfHistorical, () => post("/api/admin/lineage", { action: "historical", entityId: id, decision: "approved" }))}>
            {ln.historicalApprove}
          </button>
          <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={() => run(ln.wfHistoricalChanges, () => post("/api/admin/lineage", { action: "historical", entityId: id, decision: "changes_requested" }))}>
            {ln.historicalChanges}
          </button>
        </>
      ) : null}
      {status !== "published" ? (
        <button type="button" className="zq-btn zq-btn-primary ln-btn" onClick={() => run(ln.wfPublished, () => setStatus("published"))}>
          {ln.publish}
        </button>
      ) : (
        <button
          type="button"
          className="zq-btn zq-btn-quiet ln-btn"
          onClick={() => {
            const note = window.prompt(ln.correctionPrompt);
            if (note) void run(ln.wfCorrection, () => setStatus("correction", note));
          }}
        >
          {ln.moveCorrection}
        </button>
      )}
    </div>
  );
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

const CONFIDENCE = ["quran", "hadith", "scholar", "estimate", "disputed", "unknown"];

/** Gap nodes, person claims and the derived evidence class of every family link. */
export function LineageAdmin() {
  const locale = useLocale();
  const ln = useMemo(() => adminLineageStrings(locale), [locale]);
  const statusWord = (s: string) => ln.statusNames[s] ?? s;
  const [msg, setMsg] = useState<Msg>(null);
  const people = useRows<{ id: string; slug: string; name_en: string; status: string }>(() => sb()?.from("people").select("id, slug, name_en, status").order("name_en"));
  const links = useRows<{ id: string; person_from: string; person_to: string; kind: string; status: string; evidence_class: string; tradition: string | null }>(() =>
    sb()?.from("relationship_evidence").select("id, person_from, person_to, kind, status, evidence_class, tradition").in("kind", ["parent_of", "descendant_of"]).order("status"),
  );
  const gaps = useRows<{ id: string; person_from: string; person_to: string; note: string; status: string; claim_id: string }>(() => sb()?.from("lineage_gaps").select("id, person_from, person_to, note, status, claim_id").order("created_at", { ascending: false }));
  const nodeClaims = useRows<{ id: string; person_id: string; aspect: string; status: string; claim_id: string }>(() => sb()?.from("lineage_node_claims").select("id, person_id, aspect, status, claim_id").order("created_at", { ascending: false }));
  const name = (id: string) => people.rows?.find((p) => p.id === id)?.name_en ?? id.slice(0, 8);
  const reloadAll = () => {
    void links.reload();
    void gaps.reload();
    void nodeClaims.reload();
  };
  const personOptions = (people.rows ?? []).map((p) => (
    <option key={p.id} value={p.id} {...englishContent(locale)}>
      {p.name_en} ({statusWord(p.status)})
    </option>
  ));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h2>{ln.familyLinksHeading}</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          {ln.familyLinksNote}
        </p>
        {links.error ? <LoadError error={links.error} /> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(links.rows ?? []).map((l) => (
            <li key={l.id} className="pp-card" data-link={l.id} style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{name(l.person_from)}</b> {l.kind === "parent_of" ? ln.parentOf : ln.descendantOf} <b>{name(l.person_to)}</b> · {statusWord(l.status)}
                {l.tradition ? ` · ${l.tradition}` : ""}
              </span>
              {isLineageClass(l.evidence_class) ? <EvidenceChip cls={l.evidence_class as LineageClass} /> : null}
              <Workflow type="relationship" id={l.id} status={l.status} onDone={reloadAll} setMsg={setMsg} />
            </li>
          ))}
        </ul>
      </section>

      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const conf = String(f.get("confidence"));
          const res = await sb()?.from("lineage_gaps").insert({
            person_from: String(f.get("from")),
            person_to: String(f.get("to")),
            claim_id: String(f.get("claim")).trim(),
            confidence: conf,
            note: String(f.get("note")),
            competing_group: conf === "disputed" && f.get("group") ? String(f.get("group")).trim() : null,
            tradition: String(f.get("tradition") || "") || null,
          });
          setMsg(!res ? { tone: "err", text: ln.notConfigured } : res.error ? errMsg(locale, ln.failedPrefix, res.error.message) : { tone: "ok", text: ln.okGap });
          if (res && !res.error) reloadAll();
        }}
      >
        <h2>{ln.addGap}</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          {ln.gapNote}
        </p>
        {(["from", "to"] as const).map((k) => (
          <div className="zq-field" key={k}>
            <label htmlFor={`gap-${k}`}>{k === "from" ? ln.earlierPerson : ln.laterPerson}</label>
            <select id={`gap-${k}`} name={k} className="zq-input" required>
              {personOptions}
            </select>
          </div>
        ))}
        <TextField label={ln.claimApproved} id="gap-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="gap-conf">{ln.confidenceLabel}</label>
          <select id="gap-conf" name="confidence" className="zq-input" defaultValue="disputed">
            {CONFIDENCE.map((k) => (
              <option key={k} value={k}>{ln.confidence[k] ?? k}</option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="gap-note">{ln.gapNoteLabel}</label>
          <textarea id="gap-note" name="note" className="zq-input" required minLength={10} maxLength={800} rows={3} />
        </div>
        <TextField label={ln.tradition} id="gap-trad" name="tradition" />
        <TextField label={ln.competingAccounts} id="gap-group" name="group" dir="ltr" help={ln.competingHelp} />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {ln.saveGapDraft}
          </button>
        </div>
      </form>

      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h3>{ln.gaps}</h3>
        {gaps.error ? <LoadError error={gaps.error} /> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(gaps.rows ?? []).map((g) => (
            <li key={g.id} className="pp-card" style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{name(g.person_from)}</b> … <b>{name(g.person_to)}</b> · {statusWord(g.status)}
              </span>
              <span className="zq-meta" {...englishContent(locale)}>{g.note}</span>
              <Workflow type="lineage_gap" id={g.id} status={g.status} onDone={reloadAll} setMsg={setMsg} />
            </li>
          ))}
        </ul>
      </section>

      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const res = await sb()?.from("lineage_node_claims").insert({
            person_id: String(f.get("person")),
            aspect: String(f.get("aspect")),
            claim_id: String(f.get("claim")).trim(),
            confidence: String(f.get("confidence")),
            note: String(f.get("note") || "") || null,
          });
          setMsg(!res ? { tone: "err", text: ln.notConfigured } : res.error ? errMsg(locale, ln.failedPrefix, res.error.message) : { tone: "ok", text: ln.okPersonClaim });
          if (res && !res.error) reloadAll();
        }}
      >
        <h2>{ln.addPersonClaim}</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          {ln.personClaimNote}
        </p>
        <div className="zq-field">
          <label htmlFor="nc-person">{ln.person}</label>
          <select id="nc-person" name="person" className="zq-input" required>
            {personOptions}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="nc-aspect">{ln.aspect}</label>
          <select id="nc-aspect" name="aspect" className="zq-input">
            {["identity", "name", "lifespan", "dates"].map((k) => (
              <option key={k} value={k}>{ln.aspects[k] ?? k}</option>
            ))}
          </select>
        </div>
        <TextField label={ln.claimApproved} id="nc-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="nc-conf">{ln.confidenceLabel}</label>
          <select id="nc-conf" name="confidence" className="zq-input" defaultValue="scholar">
            {CONFIDENCE.map((k) => (
              <option key={k} value={k}>{ln.confidence[k] ?? k}</option>
            ))}
          </select>
        </div>
        <TextField label={ln.noteUncertain} id="nc-note" name="note" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {ln.saveClaimDraft}
          </button>
        </div>
      </form>

      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h3>{ln.personClaims}</h3>
        {nodeClaims.error ? <LoadError error={nodeClaims.error} /> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(nodeClaims.rows ?? []).map((n) => (
            <li key={n.id} className="pp-card" style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{name(n.person_id)}</b> · {ln.aspects[n.aspect] ?? n.aspect} · {statusWord(n.status)}
              </span>
              <Workflow type="lineage_node_claim" id={n.id} status={n.status} onDone={reloadAll} setMsg={setMsg} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const LAYERS = ["tawrah", "zabur", "injil"];
const KINDS = ["manuscript_tradition", "manuscript_collection", "translation_tradition", "codex", "papyri"];

/** The scripture witness registry: entries, their two review pathways, and the citation helper. */
export function ScripturesAdmin() {
  const locale = useLocale();
  const ln = useMemo(() => adminLineageStrings(locale), [locale]);
  const statusWord = (s: string) => ln.statusNames[s] ?? s;
  const [msg, setMsg] = useState<Msg>(null);
  const rows = useRows<{ id: string; slug: string; layer: string; kind: string; name_en: string; dating_note: string | null; limitation: string; status: string }>(() =>
    sb()?.from("scripture_witnesses").select("id, slug, layer, kind, name_en, dating_note, limitation, status").order("sort_order"),
  );
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <p className="zq-meta" style={{ margin: 0 }}>
        {ln.scripturesNote}
      </p>
      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const res = await sb()?.from("scripture_witnesses").insert({
            slug: String(f.get("slug")),
            layer: String(f.get("layer")),
            kind: String(f.get("kind")),
            name_en: String(f.get("name")),
            language: String(f.get("language")),
            dating_note: String(f.get("dating") || "").trim() || null,
            what_it_is: String(f.get("what")),
            limitation: String(f.get("limitation")),
          });
          setMsg(!res ? { tone: "err", text: ln.notConfigured } : res.error ? errMsg(locale, ln.failedPrefix, res.error.message) : { tone: "ok", text: ln.okWitness });
          if (res && !res.error) void rows.reload();
        }}
      >
        <h2>{ln.addWitness}</h2>
        <TextField label={ln.slug} id="w-slug" name="slug" required pattern="[a-z0-9-]+" />
        <div className="zq-field">
          <label htmlFor="w-layer">{ln.layer}</label>
          <select id="w-layer" name="layer" className="zq-input">
            {LAYERS.map((k) => (
              <option key={k} value={k}>{ln.layers[k] ?? k}</option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="w-kind">{ln.kind}</label>
          <select id="w-kind" name="kind" className="zq-input">
            {KINDS.map((k) => (
              <option key={k} value={k}>{ln.witnessKinds[k] ?? k}</option>
            ))}
          </select>
        </div>
        <TextField label={ln.name} id="w-name" name="name" required />
        <TextField label={ln.language} id="w-lang" name="language" required />
        <TextField label={ln.datingLabel} id="w-dating" name="dating" />
        <div className="zq-field">
          <label htmlFor="w-what">{ln.whatItIs}</label>
          <textarea id="w-what" name="what" className="zq-input" required minLength={20} maxLength={700} rows={3} />
        </div>
        <div className="zq-field">
          <label htmlFor="w-limit">{ln.limitationLabel}</label>
          <textarea id="w-limit" name="limitation" className="zq-input" required minLength={40} maxLength={700} rows={3} />
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {ln.saveWitnessDraft}
          </button>
        </div>
      </form>

      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h2>{ln.witnesses}</h2>
        {rows.error ? <LoadError error={rows.error} /> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(rows.rows ?? []).map((w) => (
            <li key={w.id} className="pp-card" data-witness={w.slug} style={{ display: "grid", gap: 8 }}>
              <span>
                <b {...englishContent(locale)}>{w.name_en}</b> · {ln.layers[w.layer] ?? w.layer} · {ln.witnessKinds[w.kind] ?? w.kind.replace(/_/g, " ")} · {statusWord(w.status)}
              </span>
              <span className="zq-meta">{ln.datingPrefix} {w.dating_note ? <span {...englishContent(locale)}>{w.dating_note}</span> : ln.notEstablished}</span>
              <span className="zq-meta">{ln.limitationPrefix} <span {...englishContent(locale)}>{w.limitation}</span></span>
              <Workflow type="scripture_witness" id={w.id} status={w.status} historical onDone={() => void rows.reload()} setMsg={setMsg} />
            </li>
          ))}
        </ul>
      </section>

      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const res = await sb()?.from("claim_references").insert({
            claim_id: String(f.get("claim")).trim(),
            kind: "scripture",
            scripture_witness_id: String(f.get("witness")),
            locator: String(f.get("locator")),
            note: String(f.get("note") || "") || null,
          });
          setMsg(!res ? { tone: "err", text: ln.notConfigured } : res.error ? errMsg(locale, ln.failedPrefix, res.error.message) : { tone: "ok", text: ln.okCitation });
        }}
      >
        <h2>{ln.citeWitness}</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          {ln.citeNote}
        </p>
        <TextField label={ln.claimId} id="cite-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="cite-w">{ln.witness}</label>
          <select id="cite-w" name="witness" className="zq-input" required>
            {(rows.rows ?? []).map((w) => (
              <option key={w.id} value={w.id} {...englishContent(locale)}>
                {w.name_en} ({statusWord(w.status)})
              </option>
            ))}
          </select>
        </div>
        <TextField label={ln.exactLocator} id="cite-loc" name="locator" required />
        <TextField label={ln.shortNote} id="cite-note" name="note" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {ln.addCitation}
          </button>
        </div>
      </form>
    </div>
  );
}
