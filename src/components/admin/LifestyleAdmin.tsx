"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { FIELD_KEYS, LIFESPAN_KINDS, LIFESPAN_MEASURES, RECORD_TYPES, requiredPathways, type EvidenceCategory, type Pathway, type RecordType } from "@/lib/lifestyle/model";

/**
 * Life Through the Ages: editor and two-pathway review queue. Every action is authorised again by the API route and
 * by the database (RLS, the publish guard and the reviewer check), so this screen only offers what the role may try.
 */
async function call(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

const TITLE_COL: Partial<Record<RecordType, string>> = {
  lifestyle_era: "name_en",
  lifestyle_community: "name_en",
  lifestyle_profile: "person_slug",
  lifestyle_field: "field_key",
  lifestyle_food: "name_en",
  lifestyle_food_link: "link_kind",
  lifestyle_lifespan: "kind",
  lifestyle_demographic: "title",
  lifestyle_source: "citation",
};
const TYPE_LABEL: Record<RecordType, string> = {
  lifestyle_era: "Era",
  lifestyle_community: "Community",
  lifestyle_profile: "Prophet profile",
  lifestyle_field: "Profile field",
  lifestyle_food: "Food",
  lifestyle_food_link: "Food evidence link",
  lifestyle_occupation: "Occupation",
  lifestyle_housing: "Housing",
  lifestyle_transport: "Transport",
  lifestyle_activity: "Daily activity",
  lifestyle_health: "Health condition",
  lifestyle_lifespan: "Lifespan claim",
  lifestyle_demographic: "Demographic research",
  lifestyle_reconstruction: "Reconstruction (class D)",
  lifestyle_infographic: "Infographic",
  lifestyle_source: "Source reference",
};

interface Item {
  type: RecordType;
  id: string;
  status: EditorialState;
  label: string;
  category: EvidenceCategory | null;
  pathways: Pathway[];
  reviews: Partial<Record<Pathway, string>>;
}

export function LifestyleAdmin({ canEdit, canReligious, canScience }: { canEdit: boolean; canReligious: boolean; canScience: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState<RecordType | "all">("all");

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setItems([]);
    const types = (Object.keys(RECORD_TYPES) as RecordType[]).filter((t) => filter === "all" || t === filter);
    const [rows, revs] = await Promise.all([
      Promise.all(
        types.map(async (type) => {
          const col = TITLE_COL[type] ?? (type === "lifestyle_reconstruction" || type === "lifestyle_infographic" ? "slug" : "title_en");
          const evidence = type === "lifestyle_profile" || type === "lifestyle_source" ? "" : ", evidence_category";
          const { data } = await c.from(RECORD_TYPES[type]).select(`id, status, ${col}${evidence}`).neq("status", "archived").order("updated_at", { ascending: false }).limit(type === "lifestyle_field" ? 60 : 100);
          return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({ type, r, col }));
        }),
      ),
      c.from("lifestyle_reviews").select("entity_id, pathway, decision, created_at").order("created_at", { ascending: false }).limit(1000),
    ]);
    const latest = new Map<string, string>();
    for (const r of (revs.data ?? []) as Array<{ entity_id: string; pathway: Pathway; decision: string }>) {
      const k = `${r.entity_id}:${r.pathway}`;
      if (!latest.has(k)) latest.set(k, r.decision);
    }
    setItems(
      rows.flat().map(({ type, r, col }) => {
        const category = (r.evidence_category as EvidenceCategory | null | undefined) ?? null;
        const id = String(r.id);
        return {
          type,
          id,
          status: r.status as EditorialState,
          label: String(r[col] ?? ""),
          category,
          // Profiles, foods and references also depend on their children; the database computes the final set.
          pathways: type === "lifestyle_profile" || type === "lifestyle_food" || type === "lifestyle_source" ? (["religious", "scientific"] as Pathway[]) : requiredPathways([category]),
          reviews: { religious: latest.get(`${id}:religious`), scientific: latest.get(`${id}:scientific`) },
        };
      }),
    );
  }, [filter]);
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
    void act(() => call("/api/admin/lifestyle/review", { entityType: it.type, entityId: it.id, pathway, decision, comment }), decision === "approved" ? "Review recorded." : "Changes requested.");
  };
  const status = (it: Item, s: string, revisionNote?: string) => act(() => call("/api/admin/status", { entityType: it.type, entityId: it.id, status: s, revisionNote }), `Status: ${s.replace("_", " ")}.`);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="pp-card" aria-labelledby="lta-rules-h">
        <h3 id="lta-rules-h">Evidence and review rules</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>A (Quran) and B (authentic hadith: Bukhari, Muslim, or individually sahih in Tirmidhi / Ibn Majah) need an approved evidence claim and the religious review by a scholarly reviewer.</li>
          <li>C (historical / archaeological / scientific) needs a named publication and citation and the historical/scientific review by a science reviewer.</li>
          <li>D (reconstruction) needs the reconstruction flag and the historical/scientific review; it is always shown apart, never as fact.</li>
          <li>A record mixing classes needs both reviews. Never enter a citation you have not checked against the publication itself.</li>
        </ul>
      </section>

      {canEdit ? <Editor onSaved={(t) => act(async () => undefined, t)} /> : null}

      <div className="zq-field" style={{ maxWidth: 360 }}>
        <label htmlFor="lta-filter">Show</label>
        <select id="lta-filter" className="zq-input" value={filter} onChange={(e) => setFilter(e.target.value as RecordType | "all")}>
          <option value="all">All record types</option>
          {(Object.keys(RECORD_TYPES) as RecordType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}
      {!items ? (
        <Skeleton height={20} />
      ) : !items.length ? (
        <EmptyState title="No Life Through the Ages records yet." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }} data-testid="lta-queue">
          {items.map((it) => (
            <li key={it.type + it.id} className="pp-card">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="zq-eyebrow">{TYPE_LABEL[it.type]}</span>
                <EditorialStatus status={it.status} />
                <span className="zq-meta">Class {it.category ?? "— (not established)"}</span>
              </div>
              <p style={{ margin: 0 }}>{it.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(["religious", "scientific"] as Pathway[]).map((p) => (
                  <span key={p} className="zq-meta" data-pathway={p}>
                    {p === "religious" ? "Religious review" : "Historical/scientific review"}: {it.pathways.includes(p) ? (it.reviews[p]?.replace("_", " ") ?? "pending") : "not required"}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEdit && it.status === "draft" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "in_review")}>
                    Send for review
                  </button>
                ) : null}
                {canReligious && it.pathways.includes("religious") ? (
                  <>
                    <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(it, "religious", "approved")}>
                      Approve (religious)
                    </button>
                    <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(it, "religious", "changes_requested")}>
                      Request changes (religious)
                    </button>
                  </>
                ) : null}
                {canScience && it.pathways.includes("scientific") ? (
                  <>
                    <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(it, "scientific", "approved")}>
                      Approve (historical/scientific)
                    </button>
                    <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(it, "scientific", "changes_requested")}>
                      Request changes (historical/scientific)
                    </button>
                  </>
                ) : null}
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

const EVIDENCE_TYPES: RecordType[] = (Object.keys(RECORD_TYPES) as RecordType[]).filter((t) => t !== "lifestyle_profile" && t !== "lifestyle_source");

function Editor({ onSaved }: { onSaved: (text: string) => void }) {
  const [type, setType] = useState<RecordType>("lifestyle_field");
  const [err, setErr] = useState<string | null>(null);
  const hasEvidence = EVIDENCE_TYPES.includes(type);
  const titled = ["lifestyle_occupation", "lifestyle_housing", "lifestyle_transport", "lifestyle_activity", "lifestyle_health", "lifestyle_reconstruction"].includes(type);
  const named = ["lifestyle_era", "lifestyle_community", "lifestyle_food"].includes(type);
  const f = (id: string, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="zq-field">
      <label htmlFor={`lta-${id}`}>{label}</label>
      <input id={`lta-${id}`} name={id} className="zq-input" {...extra} />
    </div>
  );
  const sel = (id: string, label: string, options: readonly string[], allowEmpty = false) => (
    <div className="zq-field">
      <label htmlFor={`lta-${id}`}>{label}</label>
      <select id={`lta-${id}`} name={id} className="zq-input">
        {allowEmpty ? <option value="">—</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
  const area = (id: string, label: string) => (
    <div className="zq-field">
      <label htmlFor={`lta-${id}`}>{label}</label>
      <textarea id={`lta-${id}`} name={id} className="zq-input" rows={4} />
    </div>
  );
  return (
    <form
      className="zq-form pp-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        const fd = new FormData(e.currentTarget);
        const data: Record<string, unknown> = {};
        for (const [k, v] of fd.entries()) if (k !== "type" && v !== "") data[k] = v;
        for (const k of ["known", "is_reconstruction", "health_claim"]) data[k] = fd.get(k) === "on";
        if (data.position) data.position = Number(data.position);
        if (typeof data.segments === "string") {
          data.segments = (data.segments as string)
            .split("\n")
            .map((l) => l.split("|"))
            .filter((x) => x.length === 2)
            .map(([part, text]) => ({ part: part!.trim(), text: text!.trim() }));
        }
        try {
          await call("/api/admin/lifestyle", { type, data });
          onSaved("Draft saved. Send it for review when it is complete.");
          e.currentTarget.reset();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <h3>New draft record</h3>
      <div className="zq-field">
        <label htmlFor="lta-type">Record type</label>
        <select id="lta-type" name="type" className="zq-input" value={type} onChange={(e) => setType(e.target.value as RecordType)}>
          {(Object.keys(RECORD_TYPES) as RecordType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {type === "lifestyle_profile" ? f("person_slug", "Person slug (journey id)", { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" }) : null}
      {type === "lifestyle_field" ? (
        <>
          {f("profile_id", "Profile id", { required: true, dir: "ltr" })}
          {sel("field_key", "Field", FIELD_KEYS)}
          <label className="zq-check">
            <input type="checkbox" name="known" /> Established by a reviewed source (otherwise “not established”, with no text)
          </label>
          {area("body_md", "Text")}
        </>
      ) : null}
      {named ? (
        <>
          {f("slug", "Slug", { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {f("name_en", "Name (English)", { required: true })}
          {f("name_ar", "Name (Arabic)", { dir: "rtl", lang: "ar" })}
          {area("summary", "Summary")}
        </>
      ) : null}
      {type === "lifestyle_food" ? sel("food_group", "Food group", ["grain", "fruit", "vegetable", "legume", "dairy", "meat", "fish", "honey", "oil", "beverage", "spice", "other"]) : null}
      {titled ? (
        <>
          {f("slug", "Slug", { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {f("title_en", "Title (English)", { required: true })}
          {f("title_ar", "Title (Arabic)", { dir: "rtl", lang: "ar" })}
          {type === "lifestyle_reconstruction" ? (
            <>
              {sel("kind", "Kind", ["day_in_era", "settlement", "diet", "scene", "other"])}
              {area("intro_md", "Introduction")}
              {area("segments", "Parts of the day, one per line as part|text (dawn, morning, midday…; no clock times)")}
              {area("limitations_md", "Limitations")}
            </>
          ) : (
            <>
              {area("body_md", "Text")}
              {sel("comparison_band", "Comparison column", ["ancient", "documented", "contemporary"], true)}
            </>
          )}
          {type === "lifestyle_occupation" ? sel("domain", "Domain", ["farming", "herding", "crafts", "trade", "building", "seafaring", "learning", "household", "other"]) : null}
        </>
      ) : null}
      {type === "lifestyle_food_link" ? (
        <>
          {f("food_id", "Food id", { required: true, dir: "ltr" })}
          {sel("link_kind", "Kind (fixes the class)", ["scripture_mention", "hadith_mention", "archaeological_find", "historical_record", "nutrition_research", "reconstruction"])}
          {area("statement", "Statement")}
          <label className="zq-check">
            <input type="checkbox" name="health_claim" /> Health claim (only modern nutrition research, class C)
          </label>
        </>
      ) : null}
      {type === "lifestyle_lifespan" ? (
        <>
          {sel("kind", "Kind (fixes the class)", LIFESPAN_KINDS)}
          {sel("measure", "Measure", LIFESPAN_MEASURES, true)}
          {area("statement", "Statement")}
          {f("population", "Population")}
          {f("value_years", "Value (years)", { inputMode: "decimal", dir: "ltr" })}
          {f("value_low", "Range low", { inputMode: "decimal", dir: "ltr" })}
          {f("value_high", "Range high", { inputMode: "decimal", dir: "ltr" })}
          {f("value_note", "Note on the value")}
        </>
      ) : null}
      {type === "lifestyle_demographic" ? (
        <>
          {f("title", "Title", { required: true })}
          {sel("metric", "Metric", ["population_size", "life_expectancy_at_birth", "life_expectancy_after_childhood", "mortality", "fertility", "stature", "other"])}
          {f("population", "Population")}
          {f("value", "Value", { inputMode: "decimal", dir: "ltr" })}
          {f("unit", "Unit")}
          {area("method_note", "Method")}
        </>
      ) : null}
      {type === "lifestyle_infographic" ? (
        <>
          {f("slug", "Slug", { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {sel("kind", "Kind", ["diagram", "map", "chart", "landscape", "objects", "pattern"])}
          {f("animation_key", "Scene key", { required: true, dir: "ltr" })}
          {f("alt_text", "Alt text", { required: true })}
          {f("caption", "Caption")}
          <p className="zq-help">Non-figurative only: no person, nothing unseen, nothing presented as a prophet’s possession. The database refuses anything else.</p>
        </>
      ) : null}
      {type === "lifestyle_source" ? (
        <>
          {sel("entity_type", "Record type", Object.keys(RECORD_TYPES))}
          {f("entity_id", "Record id", { required: true, dir: "ltr" })}
          {f("citation", "Citation (as printed in the publication)", { required: true })}
          {f("publication", "Publication")}
          {f("edition", "Edition")}
          {f("locator", "Page / section")}
          {f("url", "URL (https)", { dir: "ltr" })}
        </>
      ) : null}

      {hasEvidence ? (
        <fieldset className="zq-field" style={{ border: "1px solid var(--hairline)", borderRadius: 8, padding: 12 }}>
          <legend>Evidence</legend>
          {sel("evidence_category", "Class", ["A", "B", "C", "D"], type === "lifestyle_field")}
          {f("claim_id", "Approved evidence claim id (A/B)", { dir: "ltr" })}
          {f("primary_citation", "Primary citation (C: required)")}
          {f("publication", "Publication / edition (C: required)")}
          {f("dating_method", "Dating method")}
          {f("geographic_relevance", "Geographic relevance")}
          {sel("confidence", "Confidence", ["high", "moderate", "low", "speculative"], true)}
          {f("language", "Language code", { defaultValue: "en", dir: "ltr" })}
          {area("limitations", "Limitations")}
          <label className="zq-check">
            <input type="checkbox" name="is_reconstruction" /> Reconstruction (class D only)
          </label>
        </fieldset>
      ) : null}
      {err ? (
        <p role="alert" className="zq-error">
          {err}
        </p>
      ) : null}
      <div>
        <button type="submit" className="zq-btn zq-btn-primary">
          Save draft
        </button>
      </div>
    </form>
  );
}
