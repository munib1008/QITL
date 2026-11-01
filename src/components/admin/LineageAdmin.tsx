"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { TextField } from "@/components/ui/misc";
import { EvidenceChip } from "@/components/lineage/EvidenceChip";
import { isLineageClass, type LineageClass } from "@/lib/lineage/classes";

/* Admin for the Lineage of Humanity and the scripture witness registry. English-only like the other editors. */

type Msg = { tone: "ok" | "err"; text: string } | null;
const sb = () => getBrowserSupabase();

async function post(url: string, body: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
}

function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
      {msg.text}
    </p>
  );
}

type EntityType = "lineage_gap" | "lineage_node_claim" | "scripture_witness" | "relationship";

/** Workflow buttons for one entry. The database decides whether each is allowed (roles, evidence, no self-review). */
function Workflow({ type, id, status, historical = false, onDone, setMsg }: { type: EntityType; id: string; status: string; historical?: boolean; onDone: () => void; setMsg: (m: Msg) => void }) {
  const run = async (label: string, f: () => Promise<void>) => {
    try {
      await f();
      setMsg({ tone: "ok", text: `${label}: done.` });
      onDone();
    } catch (e) {
      setMsg({ tone: "err", text: (e as Error).message });
    }
  };
  const review = (decision: "approved" | "changes_requested") =>
    post(type === "relationship" ? "/api/admin/review" : "/api/admin/lineage", type === "relationship" ? { entityType: "relationship", entityId: id, decision } : { action: "review", entityType: type, entityId: id, decision });
  const setStatus = (s: string, revisionNote?: string) =>
    post(type === "relationship" ? "/api/admin/status" : "/api/admin/lineage", type === "relationship" ? { entityType: "relationship", entityId: id, status: s, revisionNote } : { action: "status", entityType: type, entityId: id, status: s, revisionNote });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {status === "draft" || status === "correction" ? (
        <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => run("Sent to review", () => setStatus("in_review"))}>
          Send to review
        </button>
      ) : null}
      <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => run("Scholarly approval", () => review("approved"))}>
        Scholarly: approve
      </button>
      <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={() => run("Changes requested", () => review("changes_requested"))}>
        Scholarly: request changes
      </button>
      {historical ? (
        <>
          <button type="button" className="zq-btn zq-btn-secondary ln-btn" onClick={() => run("Historical approval", () => post("/api/admin/lineage", { action: "historical", entityId: id, decision: "approved" }))}>
            Historical: approve
          </button>
          <button type="button" className="zq-btn zq-btn-quiet ln-btn" onClick={() => run("Historical changes requested", () => post("/api/admin/lineage", { action: "historical", entityId: id, decision: "changes_requested" }))}>
            Historical: request changes
          </button>
        </>
      ) : null}
      {status !== "published" ? (
        <button type="button" className="zq-btn zq-btn-primary ln-btn" onClick={() => run("Published", () => setStatus("published"))}>
          Publish
        </button>
      ) : (
        <button
          type="button"
          className="zq-btn zq-btn-quiet ln-btn"
          onClick={() => {
            const note = window.prompt("Public revision note for this correction:");
            if (note) void run("Moved to correction", () => setStatus("correction", note));
          }}
        >
          Move to correction
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

const CONFIDENCE = ["quran", "hadith", "scholar", "estimate", "disputed", "unknown"];

/** Gap nodes, person claims and the derived evidence class of every family link. */
export function LineageAdmin() {
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
    <option key={p.id} value={p.id}>
      {p.name_en} ({p.status})
    </option>
  ));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h2>Family links in the lineage: derived evidence class</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          The class is derived from each link&apos;s claim and references. It cannot be set by hand: change the claim or its references to change it. A claim labelled Quran or hadith that does not cite a verse or a narration reads as unknown.
        </p>
        {links.error ? <p className="zq-error">{links.error}</p> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(links.rows ?? []).map((l) => (
            <li key={l.id} className="pp-card" data-link={l.id} style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{name(l.person_from)}</b> {l.kind === "parent_of" ? "parent of" : "descendant of"} <b>{name(l.person_to)}</b> · {l.status}
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
          setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: "Gap saved as a draft. It is published only after its claim is approved and a scholar reviews it." });
          if (res && !res.error) reloadAll();
        }}
      >
        <h2>Add a gap: undocumented intermediate generations</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          A gap says that the sources do not document the generations between two people, or that traditions differ. It carries no count and no invented names. The note is required, for example: “Traditional genealogies differ; exact chain not authenticated.”
        </p>
        {(["from", "to"] as const).map((k) => (
          <div className="zq-field" key={k}>
            <label htmlFor={`gap-${k}`}>{k === "from" ? "Earlier person (ancestor)" : "Later person (descendant)"}</label>
            <select id={`gap-${k}`} name={k} className="zq-input" required>
              {personOptions}
            </select>
          </div>
        ))}
        <TextField label="Claim id (approved, with references)" id="gap-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="gap-conf">Confidence</label>
          <select id="gap-conf" name="confidence" className="zq-input" defaultValue="disputed">
            {CONFIDENCE.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="gap-note">Note (what the sources say, 10 to 800 characters)</label>
          <textarea id="gap-note" name="note" className="zq-input" required minLength={10} maxLength={800} rows={3} />
        </div>
        <TextField label="Tradition or school" id="gap-trad" name="tradition" />
        <TextField label="Competing-accounts group id (disputed only)" id="gap-group" name="group" dir="ltr" help="Give competing accounts of the same stretch the same group id so they are shown together." />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Save gap draft
          </button>
        </div>
      </form>

      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h3>Gaps</h3>
        {gaps.error ? <p className="zq-error">{gaps.error}</p> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(gaps.rows ?? []).map((g) => (
            <li key={g.id} className="pp-card" style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{name(g.person_from)}</b> … <b>{name(g.person_to)}</b> · {g.status}
              </span>
              <span className="zq-meta">{g.note}</span>
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
          setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: "Person claim saved as a draft." });
          if (res && !res.error) reloadAll();
        }}
      >
        <h2>Add a claim about a person</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          Identity, name, lifespan or dates, only as a cited claim. Where there is no claim the page reads “Not established”; nothing is estimated.
        </p>
        <div className="zq-field">
          <label htmlFor="nc-person">Person</label>
          <select id="nc-person" name="person" className="zq-input" required>
            {personOptions}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="nc-aspect">Aspect</label>
          <select id="nc-aspect" name="aspect" className="zq-input">
            {["identity", "name", "lifespan", "dates"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <TextField label="Claim id (approved, with references)" id="nc-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="nc-conf">Confidence</label>
          <select id="nc-conf" name="confidence" className="zq-input" defaultValue="scholar">
            {CONFIDENCE.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <TextField label="Note: what is uncertain (optional)" id="nc-note" name="note" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Save claim draft
          </button>
        </div>
      </form>

      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h3>Person claims</h3>
        {nodeClaims.error ? <p className="zq-error">{nodeClaims.error}</p> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(nodeClaims.rows ?? []).map((n) => (
            <li key={n.id} className="pp-card" style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{name(n.person_id)}</b> · {n.aspect} · {n.status}
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
  const [msg, setMsg] = useState<Msg>(null);
  const rows = useRows<{ id: string; slug: string; layer: string; kind: string; name_en: string; dating_note: string | null; limitation: string; status: string }>(() =>
    sb()?.from("scripture_witnesses").select("id, slug, layer, kind, name_en, dating_note, limitation, status").order("sort_order"),
  );
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <p className="zq-meta" style={{ margin: 0 }}>
        Comparative research, not authentication. An entry needs a scholarly review and a historical review before it is published. A limitation is mandatory. Never enter scripture text here: describe, date broadly or leave the dating empty (“Not established”), and say what the witness cannot show. Never call a surviving manuscript the original Tawrah, Zabur or Injil.
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
          setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: "Witness saved as a draft." });
          if (res && !res.error) void rows.reload();
        }}
      >
        <h2>Add a witness</h2>
        <TextField label="Address (slug)" id="w-slug" name="slug" required pattern="[a-z0-9-]+" />
        <div className="zq-field">
          <label htmlFor="w-layer">Layer</label>
          <select id="w-layer" name="layer" className="zq-input">
            {LAYERS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="w-kind">Kind</label>
          <select id="w-kind" name="kind" className="zq-input">
            {KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <TextField label="Name" id="w-name" name="name" required />
        <TextField label="Language" id="w-lang" name="language" required />
        <TextField label="Dating: a broad scholarly range, or leave empty for “Not established”" id="w-dating" name="dating" />
        <div className="zq-field">
          <label htmlFor="w-what">What it is (20 to 700 characters, no scripture text)</label>
          <textarea id="w-what" name="what" className="zq-input" required minLength={20} maxLength={700} rows={3} />
        </div>
        <div className="zq-field">
          <label htmlFor="w-limit">Limitation (required, 40 to 700 characters)</label>
          <textarea id="w-limit" name="limitation" className="zq-input" required minLength={40} maxLength={700} rows={3} />
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Save witness draft
          </button>
        </div>
      </form>

      <section className="pp-card" style={{ display: "grid", gap: 8 }}>
        <h2>Witnesses</h2>
        {rows.error ? <p className="zq-error">{rows.error}</p> : null}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {(rows.rows ?? []).map((w) => (
            <li key={w.id} className="pp-card" data-witness={w.slug} style={{ display: "grid", gap: 8 }}>
              <span>
                <b>{w.name_en}</b> · {w.layer} · {w.kind.replace(/_/g, " ")} · {w.status}
              </span>
              <span className="zq-meta">Dating: {w.dating_note ?? "Not established"}</span>
              <span className="zq-meta">Limitation: {w.limitation}</span>
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
          setMsg(!res ? { tone: "err", text: "Not configured" } : res.error ? { tone: "err", text: res.error.message } : { tone: "ok", text: "Citation added. A claim that cites a witness is approved only when the witness is published." });
        }}
      >
        <h2>Cite a witness in a claim</h2>
        <p className="zq-meta" style={{ margin: 0 }}>
          Needs an exact locator (book, chapter and verse, or folio; it must contain a number). Add only a pointer: never paste the text of the passage. The claim then shows as “Ancient biblical manuscripts” (an earlier-scripture textual witness, not independently authenticated Islamic revelation).
        </p>
        <TextField label="Claim id" id="cite-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="cite-w">Witness</label>
          <select id="cite-w" name="witness" className="zq-input" required>
            {(rows.rows ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name_en} ({w.status})
              </option>
            ))}
          </select>
        </div>
        <TextField label="Exact locator (for example: book, chapter:verse, or folio)" id="cite-loc" name="locator" required />
        <TextField label="Short note (optional, no quotation)" id="cite-note" name="note" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Add citation
          </button>
        </div>
      </form>
    </div>
  );
}
