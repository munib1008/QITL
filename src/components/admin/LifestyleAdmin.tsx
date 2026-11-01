"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useLocale } from "@/lib/i18n/useLocale";
import { lifestyleStrings } from "@/lib/i18n/modules/lifestyle";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { adminLifestyleStrings } from "@/lib/i18n/modules/adminLifestyle";
import { AdminFeedback as Feedback, ServerText, errMsg, type AdminMsg } from "./feedback";
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
  const locale = useLocale();
  const tx = useMemo(() => adminLifestyleStrings(locale), [locale]);
  const statusWord = (s: string) => (uiStrings(locale).status as Record<string, string>)[s] ?? s.replace("_", " ");
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);
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
      setMsg(errMsg(locale, tx.failedPrefix, (e as Error).message));
    }
  };
  const review = (it: Item, pathway: Pathway, decision: "approved" | "changes_requested") => {
    const comment = decision === "changes_requested" ? (window.prompt(tx.whatChanges) ?? "") : undefined;
    if (decision === "changes_requested" && !comment) return;
    void act(() => call("/api/admin/lifestyle/review", { entityType: it.type, entityId: it.id, pathway, decision, comment }), decision === "approved" ? tx.okReview : tx.okChanges);
  };
  const status = (it: Item, s: string, revisionNote?: string) => act(() => call("/api/admin/status", { entityType: it.type, entityId: it.id, status: s, revisionNote }), tx.statusSet(statusWord(s)));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="pp-card" aria-labelledby="lta-rules-h">
        <h3 id="lta-rules-h">{tx.rulesHeading}</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>{tx.rule1}</li>
          <li>{tx.rule2}</li>
          <li>{tx.rule3}</li>
          <li>{tx.rule4}</li>
        </ul>
      </section>

      {canEdit ? <Editor onSaved={(text) => act(async () => undefined, text)} /> : null}

      <div className="zq-field" style={{ maxWidth: 360 }}>
        <label htmlFor="lta-filter">{tx.show}</label>
        <select id="lta-filter" className="zq-input" value={filter} onChange={(e) => setFilter(e.target.value as RecordType | "all")}>
          <option value="all">{tx.allTypes}</option>
          {(Object.keys(RECORD_TYPES) as RecordType[]).map((t) => (
            <option key={t} value={t}>
              {tx.types[t]}
            </option>
          ))}
        </select>
      </div>
      <Feedback msg={msg} />
      {!items ? (
        <Skeleton height={20} />
      ) : !items.length ? (
        <EmptyState title={tx.noRecords} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }} data-testid="lta-queue">
          {items.map((it) => (
            <li key={it.type + it.id} className="pp-card">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="zq-eyebrow">{tx.types[it.type]}</span>
                <EditorialStatus status={it.status} />
                <span className="zq-meta">{tx.classWord} {it.category ?? tx.classNone}</span>
              </div>
              <p style={{ margin: 0 }}>{it.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(["religious", "scientific"] as Pathway[]).map((p) => (
                  <span key={p} className="zq-meta" data-pathway={p}>
                    {p === "religious" ? tx.religiousReview : tx.scienceReview}: {it.pathways.includes(p) ? (it.reviews[p] ? (tx.decisions[it.reviews[p]!] ?? it.reviews[p]!.replace("_", " ")) : tx.pending) : tx.notRequired}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEdit && it.status === "draft" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "in_review")}>
                    {tx.sendForReview}
                  </button>
                ) : null}
                {canReligious && it.pathways.includes("religious") ? (
                  <>
                    <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(it, "religious", "approved")}>
                      {tx.approveReligious}
                    </button>
                    <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(it, "religious", "changes_requested")}>
                      {tx.changesReligious}
                    </button>
                  </>
                ) : null}
                {canScience && it.pathways.includes("scientific") ? (
                  <>
                    <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(it, "scientific", "approved")}>
                      {tx.approveScience}
                    </button>
                    <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(it, "scientific", "changes_requested")}>
                      {tx.changesScience}
                    </button>
                  </>
                ) : null}
                {canEdit && it.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(it, "published")}>
                    {tx.publish}
                  </button>
                ) : null}
                {canEdit && it.status === "published" ? (
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary zq-btn-sm"
                    onClick={() => {
                      const note = window.prompt(tx.revisionPrompt) ?? "";
                      if (note.trim().length >= 3) void status(it, "correction", note);
                    }}
                  >
                    {tx.startCorrection}
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
  const locale = useLocale();
  const tx = useMemo(() => adminLifestyleStrings(locale), [locale]);
  const lf = useMemo(() => lifestyleStrings(locale), [locale]);
  const optLabel = (o: string) => tx.opt[o] ?? (lf.fields as Record<string, string>)[o] ?? tx.types[o] ?? o.replace(/_/g, " ");
  const [type, setType] = useState<RecordType>("lifestyle_field");
  const [err, setErr] = useState<AdminMsg>(null);
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
            {optLabel(o)}
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
          onSaved(tx.draftSaved);
          e.currentTarget.reset();
        } catch (x) {
          setErr(errMsg(locale, tx.failedPrefix, (x as Error).message));
        }
      }}
    >
      <h3>{tx.newDraftRecord}</h3>
      <div className="zq-field">
        <label htmlFor="lta-type">{tx.recordType}</label>
        <select id="lta-type" name="type" className="zq-input" value={type} onChange={(e) => setType(e.target.value as RecordType)}>
          {(Object.keys(RECORD_TYPES) as RecordType[]).map((t) => (
            <option key={t} value={t}>
              {tx.types[t]}
            </option>
          ))}
        </select>
      </div>

      {type === "lifestyle_profile" ? f("person_slug", tx.personSlug, { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" }) : null}
      {type === "lifestyle_field" ? (
        <>
          {f("profile_id", tx.profileId, { required: true, dir: "ltr" })}
          {sel("field_key", tx.fieldLabel, FIELD_KEYS)}
          <label className="zq-check">
            <input type="checkbox" name="known" /> {tx.knownCheck}
          </label>
          {area("body_md", tx.textLabel)}
        </>
      ) : null}
      {named ? (
        <>
          {f("slug", tx.slugShort, { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {f("name_en", tx.nameEn, { required: true })}
          {f("name_ar", tx.nameAr, { dir: "rtl", lang: "ar" })}
          {area("summary", tx.summary)}
        </>
      ) : null}
      {type === "lifestyle_food" ? sel("food_group", tx.foodGroup, ["grain", "fruit", "vegetable", "legume", "dairy", "meat", "fish", "honey", "oil", "beverage", "spice", "other"]) : null}
      {titled ? (
        <>
          {f("slug", tx.slugShort, { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {f("title_en", tx.titleEn, { required: true })}
          {f("title_ar", tx.titleAr, { dir: "rtl", lang: "ar" })}
          {type === "lifestyle_reconstruction" ? (
            <>
              {sel("kind", tx.kind, ["day_in_era", "settlement", "diet", "scene", "other"])}
              {area("intro_md", tx.introduction)}
              {area("segments", tx.segmentsLabel)}
              {area("limitations_md", tx.limitationsMd)}
            </>
          ) : (
            <>
              {area("body_md", tx.textLabel)}
              {sel("comparison_band", tx.comparisonColumn, ["ancient", "documented", "contemporary"], true)}
            </>
          )}
          {type === "lifestyle_occupation" ? sel("domain", tx.domain, ["farming", "herding", "crafts", "trade", "building", "seafaring", "learning", "household", "other"]) : null}
        </>
      ) : null}
      {type === "lifestyle_food_link" ? (
        <>
          {f("food_id", tx.foodId, { required: true, dir: "ltr" })}
          {sel("link_kind", tx.kindFixesClass, ["scripture_mention", "hadith_mention", "archaeological_find", "historical_record", "nutrition_research", "reconstruction"])}
          {area("statement", tx.statement)}
          <label className="zq-check">
            <input type="checkbox" name="health_claim" /> {tx.healthClaim}
          </label>
        </>
      ) : null}
      {type === "lifestyle_lifespan" ? (
        <>
          {sel("kind", tx.kindFixesClass, LIFESPAN_KINDS)}
          {sel("measure", tx.measure, LIFESPAN_MEASURES, true)}
          {area("statement", tx.statement)}
          {f("population", tx.population)}
          {f("value_years", tx.valueYears, { inputMode: "decimal", dir: "ltr" })}
          {f("value_low", tx.rangeLow, { inputMode: "decimal", dir: "ltr" })}
          {f("value_high", tx.rangeHigh, { inputMode: "decimal", dir: "ltr" })}
          {f("value_note", tx.valueNote)}
        </>
      ) : null}
      {type === "lifestyle_demographic" ? (
        <>
          {f("title", tx.title, { required: true })}
          {sel("metric", tx.metric, ["population_size", "life_expectancy_at_birth", "life_expectancy_after_childhood", "mortality", "fertility", "stature", "other"])}
          {f("population", tx.population)}
          {f("value", tx.value, { inputMode: "decimal", dir: "ltr" })}
          {f("unit", tx.unit)}
          {area("method_note", tx.method)}
        </>
      ) : null}
      {type === "lifestyle_infographic" ? (
        <>
          {f("slug", tx.slugShort, { required: true, pattern: "[a-z0-9-]{2,60}", dir: "ltr" })}
          {sel("kind", tx.kind, ["diagram", "map", "chart", "landscape", "objects", "pattern"])}
          {f("animation_key", tx.sceneKey, { required: true, dir: "ltr" })}
          {f("alt_text", tx.altText, { required: true })}
          {f("caption", tx.caption)}
          <p className="zq-help">{tx.infographicNote}</p>
        </>
      ) : null}
      {type === "lifestyle_source" ? (
        <>
          {sel("entity_type", tx.recordType, Object.keys(RECORD_TYPES))}
          {f("entity_id", tx.recordId, { required: true, dir: "ltr" })}
          {f("citation", tx.citationPrinted, { required: true })}
          {f("publication", tx.publication)}
          {f("edition", tx.edition)}
          {f("locator", tx.pageSection)}
          {f("url", tx.urlHttps, { dir: "ltr" })}
        </>
      ) : null}

      {hasEvidence ? (
        <fieldset className="zq-field" style={{ border: "1px solid var(--hairline)", borderRadius: 8, padding: 12 }}>
          <legend>{tx.evidenceLegend}</legend>
          {sel("evidence_category", tx.classWord, ["A", "B", "C", "D"], type === "lifestyle_field")}
          {f("claim_id", tx.approvedClaimId, { dir: "ltr" })}
          {f("primary_citation", tx.primaryCitation)}
          {f("publication", tx.publicationEdition)}
          {f("dating_method", tx.datingMethod)}
          {f("geographic_relevance", tx.geoRelevance)}
          {sel("confidence", tx.confidence, ["high", "moderate", "low", "speculative"], true)}
          {f("language", tx.languageCode, { defaultValue: "en", dir: "ltr" })}
          {area("limitations", tx.limitationsMd)}
          <label className="zq-check">
            <input type="checkbox" name="is_reconstruction" /> {tx.reconstructionCheck}
          </label>
        </fieldset>
      ) : null}
      <Feedback msg={err} />
      <div>
        <button type="submit" className="zq-btn zq-btn-primary">
          {tx.saveDraft}
        </button>
      </div>
    </form>
  );
}
