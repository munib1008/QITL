"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { TextField } from "@/components/ui/misc";

interface Stop {
  id: string;
  name: string;
  arabicName: string;
  honorific: string;
}
interface Person {
  id: string;
  slug: string;
  name_en: string;
  status: EditorialState;
}
interface Section {
  id: string;
  kind: string;
  depth: string;
  value_text: string | null;
  known: boolean;
  status: EditorialState;
  position: number;
}

const KINDS: Array<[string, string, "overview" | "narrative" | "study", boolean]> = [
  ["overview", "In thirty seconds", "overview", false],
  ["time_among_people", "Fact: time among his people", "overview", true],
  ["lifespan", "Fact: total lifespan", "overview", true],
  ["people_addressed", "Fact: people addressed", "overview", true],
  ["outcome", "Fact: outcome", "overview", true],
  ["situation", "Narrative: the situation", "narrative", false],
  ["challenge", "Narrative: the challenge", "narrative", false],
  ["what_happened", "Narrative: what happened", "narrative", false],
  ["lessons", "Narrative: what can we learn?", "narrative", false],
  ["study", "Study: source-based detail", "study", false],
];

/** Editors: create draft people from the journey, then write profile sections, each resting on a claim. */
export function ProfileEditor({ stops }: { stops: Stop[] }) {
  const sb = getBrowserSupabase();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [personId, setPersonId] = useState<string>("");
  const [sections, setSections] = useState<Section[]>([]);
  const [kind, setKind] = useState("overview");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const isFact = KINDS.find((k) => k[0] === kind)?.[3] ?? false;

  const loadPeople = useCallback(async () => {
    const { data } = (await sb?.from("people").select("id, slug, name_en, status").order("name_en")) ?? { data: null };
    setPeople((data ?? []) as Person[]);
  }, [sb]);
  const loadSections = useCallback(async (pid: string) => {
    if (!pid) return setSections([]);
    const { data } = (await sb?.from("profile_sections").select("id, kind, depth, value_text, known, status, position").eq("person_id", pid).order("kind")) ?? { data: null };
    setSections((data ?? []) as Section[]);
  }, [sb]);
  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);
  useEffect(() => {
    void loadSections(personId);
  }, [personId, loadSections]);

  const missing = stops.filter((s) => !(people ?? []).some((p) => p.slug === s.id));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}

      <section className="pp-card">
        <h3>People from the journey</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          {people == null
            ? "Loading…"
            : missing.length
              ? `${missing.length} prophets on the journey have no person record yet. Importing creates drafts with the names, Arabic names and honorifics from the journey content; each must be reviewed before it is published.`
              : "Every prophet on the journey has a person record."}
        </p>
        {missing.length ? (
          <div>
            <button
              type="button"
              className="zq-btn zq-btn-secondary"
              onClick={async () => {
                const rows = missing.map((s) => ({ slug: s.id, name_en: s.name, name_ar: s.arabicName, honorific: s.honorific || null, kind: "prophet" }));
                const { error } = (await sb?.from("people").insert(rows)) ?? { error: { message: "Not configured" } };
                setMsg(error ? { tone: "err", text: error.message } : { tone: "ok", text: `Created ${rows.length} draft people. Send them for review from the review queue.` });
                void loadPeople();
              }}
            >
              Import {missing.length} as drafts
            </button>
          </div>
        ) : null}
      </section>

      <section className="pp-card">
        <h3>Profile sections</h3>
        <div className="zq-field">
          <label htmlFor="pe-person">Prophet</label>
          <select id="pe-person" className="zq-input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Choose…</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_en} ({p.status})
              </option>
            ))}
          </select>
        </div>
        {personId ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {KINDS.map(([k, label]) => {
              const s = sections.filter((x) => x.kind === k);
              return (
                <li key={k} className="zq-result" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 0" }}>
                  <b style={{ minWidth: 220 }}>{label}</b>
                  {s.length ? s.map((x) => <EditorialStatus key={x.id} status={x.status} />) : <span className="zq-meta">Not written</span>}
                  {s
                    .filter((x) => x.status === "draft")
                    .map((x) => (
                      <button
                        key={`r-${x.id}`}
                        type="button"
                        className="zq-btn zq-btn-quiet zq-btn-sm"
                        onClick={async () => {
                          const r = await fetch("/api/admin/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType: "profile_section", entityId: x.id, status: "in_review" }) });
                          setMsg(r.ok ? { tone: "ok", text: "Sent for review." } : { tone: "err", text: ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed." });
                          void loadSections(personId);
                        }}
                      >
                        Send for review
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {personId ? (
        <form
          className="zq-form pp-card"
          style={{ maxWidth: 720 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const g = (k: string) => String(f.get(k) ?? "").trim();
            const meta = KINDS.find((x) => x[0] === kind)!;
            const known = !isFact || f.get("known") === "on";
            const me = (await sb?.auth.getUser())?.data.user?.id;
            const { error } = (await sb?.from("profile_sections").insert({
              person_id: personId,
              kind,
              depth: meta[2],
              position: Number(g("position") || 1),
              value_text: isFact && known ? g("value_text") || null : null,
              value_note: isFact ? g("value_note") || null : null,
              known,
              body_md: g("body_md"),
              claim_id: g("claim_id"),
              created_by: me,
            })) ?? { error: { message: "Not configured" } };
            setMsg(error ? { tone: "err", text: error.message } : { tone: "ok", text: "Saved as a draft." });
            if (!error) {
              (e.target as HTMLFormElement).reset();
              void loadSections(personId);
            }
          }}
        >
          <h3>Write a section</h3>
          <div className="zq-field">
            <label htmlFor="pe-kind">Section</label>
            <select id="pe-kind" className="zq-input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {isFact ? (
            <>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="known" defaultChecked /> The sources establish this
              </label>
              <TextField label="Value (as the source states it)" id="pe-value" name="value_text" maxLength={120} help="Leave empty and untick the box when the sources do not establish it; the page then says “Not established”." />
              <TextField label="Note" id="pe-note" name="value_note" maxLength={300} help="A qualifier, e.g. what the figure does and does not cover." />
            </>
          ) : (
            <div className="zq-field" style={{ maxWidth: "none" }}>
              <label htmlFor="pe-body">Text (Markdown)</label>
              <textarea id="pe-body" name="body_md" className="zq-textarea" style={{ minHeight: 200 }} required />
              <span className="zq-help">Paraphrase from the cited sources; never paste an unlicensed translation. Lessons are scholarly reflection and must cite their source.</span>
            </div>
          )}
          <TextField label="Position" id="pe-pos" name="position" type="number" min={1} defaultValue="1" />
          <TextField label="Claim id (the referenced claim this section rests on)" id="pe-claim" name="claim_id" required pattern="[0-9a-f-]{36}" dir="ltr" />
          <div>
            <button type="submit" className="zq-btn zq-btn-primary">
              Save draft
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
