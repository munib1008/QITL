"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { publishBlockers } from "@/lib/encyclopedia/editor";
import { STORY_KINDS } from "@/lib/encyclopedia/model";

/**
 * Hadith stories: editor and the scholarly (hadith authenticity) review queue. Every action is authorised again by the API
 * routes and by the database (RLS, the publish guard, the reviewer check), so this screen only offers what the role may try.
 * A story has no field for narration text: it points at narrations that already exist in the hadith library.
 */
async function call(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

interface PartRow {
  id: string;
  label: string;
}
interface Story {
  id: string;
  slug: string;
  status: EditorialState;
  version: number;
  kind: string;
  title_en: string;
  title_ar: string | null;
  title_ur: string | null;
  narrator_en: string | null;
  narrator_ar: string | null;
  narrator_ur: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  summary_ur: string | null;
  context_en: string | null;
  context_ar: string | null;
  context_ur: string | null;
  review: { decision: string; stale: boolean } | null;
  parts: { entries: PartRow[]; links: PartRow[]; claims: PartRow[]; lessons: PartRow[] };
  blockers: string[];
}

const cols =
  "id, slug, status, version, kind, title_en, title_ar, title_ur, narrator_en, narrator_ar, narrator_ur, summary_en, summary_ar, summary_ur, context_en, context_ar, context_ur";

export function HadithStoriesAdmin({ canEdit, canReview }: { canEdit: boolean; canReview: boolean }) {
  const [items, setItems] = useState<Story[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const [partFor, setPartFor] = useState<string>("");

  const load = useCallback(async () => {
    const c = getBrowserSupabase();
    if (!c) return setItems([]);
    const [stories, entries, links, claims, lessons, revs] = await Promise.all([
      c.from("hadith_stories").select(cols).neq("status", "archived").order("updated_at", { ascending: false }).limit(300),
      c.from("hadith_story_entries").select("id, story_id, is_primary, grading_id, hadith_gradings(grade), hadith_entries(collection_id, canonical_number)").limit(2000),
      c.from("hadith_story_links").select("id, story_id, target_kind, people(name_en), historical_communities(name_en), historical_events(title), guidance_topics(title_en)").limit(2000),
      c.from("hadith_story_claims").select("id, story_id, evidence_claims(statement)").limit(2000),
      c.from("hadith_story_lessons").select("id, story_id, kind, body_en").limit(2000),
      c.from("hadith_story_reviews").select("story_id, story_version, decision, created_at").order("created_at", { ascending: false }).limit(3000),
    ]);
    type E = { id: string; story_id: string; is_primary: boolean; grading_id: string | null; hadith_gradings: { grade: string } | null; hadith_entries: { collection_id: string; canonical_number: string } | null };
    type L = { id: string; story_id: string; target_kind: string; people: { name_en: string } | null; historical_communities: { name_en: string } | null; historical_events: { title: string } | null; guidance_topics: { title_en: string } | null };
    const latest = new Map<string, { decision: string; story_version: number }>();
    for (const r of (revs.data ?? []) as Array<{ story_id: string; story_version: number; decision: string }>) if (!latest.has(r.story_id)) latest.set(r.story_id, r);
    const by = <T extends { story_id: string }>(rows: T[] | null) => {
      const m = new Map<string, T[]>();
      for (const r of rows ?? []) m.set(r.story_id, [...(m.get(r.story_id) ?? []), r]);
      return m;
    };
    const E = by((entries.data ?? []) as unknown as E[]);
    const L = by((links.data ?? []) as unknown as L[]);
    const C = by((claims.data ?? []) as unknown as Array<{ id: string; story_id: string; evidence_claims: { statement: string } | null }>);
    const Ls = by((lessons.data ?? []) as unknown as Array<{ id: string; story_id: string; kind: string; body_en: string }>);
    const out: Story[] = ((stories.data ?? []) as unknown as Array<Omit<Story, "review" | "parts" | "blockers">>).map((s) => {
      const es = E.get(s.id) ?? [];
      const rev = latest.get(s.id);
      return {
        ...s,
        review: rev ? { decision: rev.decision, stale: rev.story_version !== s.version } : null,
        parts: {
          entries: es.map((e) => ({ id: e.id, label: `${e.hadith_entries?.collection_id ?? "?"} ${e.hadith_entries?.canonical_number ?? ""}${e.is_primary ? " (primary)" : ""}${e.hadith_gradings ? ` · graded ${e.hadith_gradings.grade}` : ""}` })),
          links: (L.get(s.id) ?? []).map((l) => ({ id: l.id, label: `${l.target_kind}: ${l.people?.name_en ?? l.historical_communities?.name_en ?? l.historical_events?.title ?? l.guidance_topics?.title_en ?? "?"}` })),
          claims: (C.get(s.id) ?? []).map((x) => ({ id: x.id, label: (x.evidence_claims?.statement ?? "claim").slice(0, 80) })),
          lessons: (Ls.get(s.id) ?? []).map((x) => ({ id: x.id, label: `${x.kind.replace("_", " ")}: ${x.body_en.slice(0, 60)}` })),
        },
        blockers: publishBlockers({
          narrator: !!s.narrator_en,
          summary: !!s.summary_en,
          kind: s.kind,
          narrations: es.map((e) => ({ primary: e.is_primary, collection: e.hadith_entries?.collection_id ?? "", hasGrading: !!e.grading_id, grade: e.hadith_gradings?.grade ?? null })),
          quranClaims: (C.get(s.id) ?? []).length,
        }),
      };
    });
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
  const status = (s: Story, to: string, revisionNote?: string) => act(() => call("/api/admin/status", { entityType: "hadith_story", entityId: s.id, status: to, revisionNote }), `Status: ${to.replace("_", " ")}.`);
  const review = (s: Story, decision: "approved" | "changes_requested") => {
    const comment = decision === "changes_requested" ? (window.prompt("What needs to change?") ?? "") : undefined;
    if (decision === "changes_requested" && !comment) return;
    void act(() => call("/api/admin/hadith-stories/review", { storyId: s.id, decision, comment }), decision === "approved" ? "Review recorded for this version." : "Changes requested.");
  };
  const reviewText = (s: Story) => (!s.review ? "pending" : s.review.decision === "approved" ? (s.review.stale ? "approved an earlier version, edited since, needs a new review" : "approved (current version)") : s.review.decision.replace(/_/g, " ") + (s.review.stale ? " (earlier version)" : ""));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section className="pp-card" aria-labelledby="hs-rules-h">
        <h3 id="hs-rules-h">Evidence and review rules</h3>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>A story points at narrations already in the hadith library. There is no field for the narration text, and the database refuses a story whose text copies a narration or its licensed translation.</li>
          <li>Allowed sources: Sahih al-Bukhari, Sahih Muslim, and Tirmidhi or Ibn Majah only with an individual grading of sahih or sahih li-ghayrihi by a named grader (choose that grading on the narration).</li>
          <li>Exactly one primary narration. Other wordings are added as variants, each with its own grading; they are never merged.</li>
          <li>A story that clarifies a Quranic story needs a Quran connection: an approved evidence claim with a Quran reference. Verses are never typed here.</li>
          <li>Leave the historical context empty when the narration does not state it: the page then says &ldquo;Not established&rdquo;. Modern application is shown as an educational interpretation, never a ruling.</li>
          <li>The scholarly review (hadith authenticity) is bound to the version. Editing the story or any part afterwards makes the approval stale. The author of the story or of any part cannot review it. A published story is frozen; start a correction to change it.</li>
        </ul>
      </section>

      {canEdit ? <StoryForm key={editing?.id ?? "new"} story={editing} onCancel={() => setEditing(null)} onSaved={(t) => { setEditing(null); void act(async () => undefined, t); }} /> : null}
      {canEdit ? <PartForm stories={(items ?? []).filter((s) => s.status !== "published")} storyId={partFor} setStoryId={setPartFor} onSaved={(t) => act(async () => undefined, t)} /> : null}

      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}
      {!items ? (
        <Skeleton height={20} />
      ) : !items.length ? (
        <EmptyState title="No hadith stories yet." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }} data-testid="hadith-story-queue">
          {items.map((s) => (
            <li key={s.id} className="pp-card">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="zq-eyebrow">Hadith story</span>
                <EditorialStatus status={s.status} />
                <span className="zq-meta">Version {s.version}</span>
              </div>
              <p style={{ margin: 0 }}>
                {s.title_en} <span className="zq-meta">/hadith-stories/{s.slug} · {s.kind.replace(/_/g, " ")}</span>
              </p>
              <p className="zq-meta" style={{ margin: 0 }}>
                Narrations: {s.parts.entries.map((e) => e.label).join("; ") || "none yet"} · links {s.parts.links.length} · Quran connections {s.parts.claims.length} · lessons {s.parts.lessons.length}
              </p>
              <p className="zq-meta" style={{ margin: 0 }} data-pathway="religious">
                Scholarly review: {reviewText(s)}
              </p>
              {s.status !== "published" && s.blockers.length ? (
                <p className="zq-meta" style={{ margin: 0 }} data-testid="blockers">
                  Before publishing: {s.blockers.join("; ")}.
                </p>
              ) : null}
              {canEdit && s.status !== "published" ? (
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {[...s.parts.entries.map((p) => ({ ...p, type: "hadith_story_entry" })), ...s.parts.links.map((p) => ({ ...p, type: "hadith_story_link" })), ...s.parts.claims.map((p) => ({ ...p, type: "hadith_story_claim" })), ...s.parts.lessons.map((p) => ({ ...p, type: "hadith_story_lesson" }))].map((p) => (
                    <li key={p.id} className="zq-meta">
                      {p.label}{" "}
                      <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => act(() => call("/api/admin/hadith-stories", { type: p.type, id: p.id }, "DELETE"), "Part removed (the story is a new version).")}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEdit && s.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => { setEditing(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    Edit
                  </button>
                ) : null}
                {canEdit && s.status === "draft" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(s, "in_review")}>
                    Send for review
                  </button>
                ) : null}
                {canReview && s.status !== "published" ? (
                  <>
                    <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => review(s, "approved")}>
                      Approve (authenticity)
                    </button>
                    <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => review(s, "changes_requested")}>
                      Request changes
                    </button>
                  </>
                ) : null}
                {canEdit && s.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => status(s, "published")}>
                    Publish
                  </button>
                ) : null}
                {canEdit && s.status === "published" ? (
                  <button
                    type="button"
                    className="zq-btn zq-btn-secondary zq-btn-sm"
                    onClick={() => {
                      const note = window.prompt("Public revision note: what is being corrected and why?") ?? "";
                      if (note.trim().length >= 3) void status(s, "correction", note);
                    }}
                  >
                    Start a correction
                  </button>
                ) : null}
                {canEdit && s.status !== "published" ? (
                  <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => status(s, "archived")}>
                    Archive
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

function Field({ id, label, help, area, defaultValue, required, maxLength, lang }: { id: string; label: string; help?: string; area?: boolean; defaultValue?: string | null; required?: boolean; maxLength?: number; lang?: string }) {
  return (
    <div className="zq-field">
      <label htmlFor={`hs-${id}`}>{label}</label>
      {area ? (
        <textarea id={`hs-${id}`} name={id} className="zq-input" rows={4} defaultValue={defaultValue ?? ""} maxLength={maxLength} lang={lang} dir={lang === "ar" || lang === "ur" ? "rtl" : undefined} />
      ) : (
        <input id={`hs-${id}`} name={id} className="zq-input" defaultValue={defaultValue ?? ""} required={required} maxLength={maxLength} lang={lang} dir={lang === "ar" || lang === "ur" ? "rtl" : undefined} />
      )}
      {help ? <p className="zq-help">{help}</p> : null}
    </div>
  );
}

function StoryForm({ story, onSaved, onCancel }: { story: Story | null; onSaved: (text: string) => void; onCancel: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="zq-form pp-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        const form = e.currentTarget;
        const data: Record<string, unknown> = {};
        for (const [k, v] of new FormData(form).entries()) if (v !== "") data[k] = v;
        try {
          await call("/api/admin/hadith-stories", { type: "hadith_story", id: story?.id, data });
          onSaved(story ? "Story saved as a new version. It needs a new review." : "Draft saved. Add its narration, then send it for review.");
          if (!story) form.reset();
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <h3>{story ? `Edit: ${story.title_en}` : "New hadith story"}</h3>
      <p className="zq-help">Write the summary, context and lessons in your own words. Never paste the narration or a translation of it.</p>
      <Field id="slug" label="Address (slug)" required defaultValue={story?.slug} maxLength={80} help="Lower-case letters, digits and hyphens." />
      <div className="zq-field">
        <label htmlFor="hs-kind">Kind of story</label>
        <select id="hs-kind" name="kind" className="zq-input" defaultValue={story?.kind ?? "independent_lesson"}>
          {STORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <Field id="title_en" label="Title (English)" required defaultValue={story?.title_en} maxLength={200} />
      <Field id="title_ar" label="Title (Arabic)" defaultValue={story?.title_ar} maxLength={200} lang="ar" />
      <Field id="title_ur" label="Title (Urdu)" defaultValue={story?.title_ur} maxLength={200} lang="ur" />
      <Field id="narrator_en" label="Narrator (English)" defaultValue={story?.narrator_en} maxLength={200} help="As named in the cited narration." />
      <Field id="narrator_ar" label="Narrator (Arabic)" defaultValue={story?.narrator_ar} maxLength={200} lang="ar" />
      <Field id="narrator_ur" label="Narrator (Urdu)" defaultValue={story?.narrator_ur} maxLength={200} lang="ur" />
      <Field id="summary_en" label="Summary (English)" area defaultValue={story?.summary_en} maxLength={1500} />
      <Field id="summary_ar" label="Summary (Arabic)" area defaultValue={story?.summary_ar} maxLength={1500} lang="ar" />
      <Field id="summary_ur" label="Summary (Urdu)" area defaultValue={story?.summary_ur} maxLength={1500} lang="ur" />
      <Field id="context_en" label="Historical context (English)" area defaultValue={story?.context_en} maxLength={3000} help="Leave empty when the narration does not state it; the page then says Not established." />
      <Field id="context_ar" label="Historical context (Arabic)" area defaultValue={story?.context_ar} maxLength={3000} lang="ar" />
      <Field id="context_ur" label="Historical context (Urdu)" area defaultValue={story?.context_ur} maxLength={3000} lang="ur" />
      {err ? <p role="alert" className="zq-error">{err}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="zq-btn zq-btn-primary">
          {story ? "Save changes" : "Save draft"}
        </button>
        {story ? (
          <button type="button" className="zq-btn zq-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

const COLLECTIONS = ["bukhari", "muslim", "tirmidhi", "ibnmajah"] as const;

function PartForm({ stories, storyId, setStoryId, onSaved }: { stories: Story[]; storyId: string; setStoryId: (id: string) => void; onSaved: (text: string) => void }) {
  const [type, setType] = useState<"entry" | "link" | "claim" | "lesson">("entry");
  const [err, setErr] = useState<string | null>(null);
  const [claims, setClaims] = useState<Array<{ id: string; label: string }>>([]);
  const [found, setFound] = useState<Array<{ id: string; label: string; gradings: Array<{ id: string; label: string }> }>>([]);
  const [target, setTarget] = useState<Array<{ id: string; label: string }>>([]);
  const [targetKind, setTargetKind] = useState("person");

  useEffect(() => {
    const c = getBrowserSupabase();
    if (!c) return;
    void (async () => {
      const { data } = await c.from("evidence_claims").select("id, statement, claim_references(kind)").in("status", ["approved", "published"]).limit(400);
      setClaims(
        ((data ?? []) as unknown as Array<{ id: string; statement: string; claim_references: Array<{ kind: string }> }>)
          .filter((x) => x.claim_references.some((r) => r.kind === "quran"))
          .map((x) => ({ id: x.id, label: x.statement.slice(0, 90) })),
      );
    })();
  }, []);
  useEffect(() => {
    const c = getBrowserSupabase();
    if (!c || type !== "link") return;
    const q =
      targetKind === "person"
        ? c.from("people").select("id, label:name_en").order("name_en")
        : targetKind === "community"
          ? c.from("historical_communities").select("id, label:name_en").order("name_en")
          : targetKind === "event"
            ? c.from("historical_events").select("id, label:title").order("title")
            : c.from("guidance_topics").select("id, label:title_en").order("title_en");
    void q.limit(400).then(({ data }) => setTarget((data ?? []) as unknown as Array<{ id: string; label: string }>));
  }, [type, targetKind]);

  const lookup = async (collection: string, number: string) => {
    const c = getBrowserSupabase();
    if (!c || !number) return setFound([]);
    const { data } = await c.from("hadith_entries").select("id, numbering_system, status, hadith_gradings(id, grader, grade)").eq("collection_id", collection).eq("canonical_number", number).limit(10);
    setFound(
      ((data ?? []) as unknown as Array<{ id: string; numbering_system: string; status: string; hadith_gradings: Array<{ id: string; grader: string; grade: string }> }>).map((h) => ({
        id: h.id,
        label: `${collection} ${number} (${h.numbering_system}, ${h.status})`,
        gradings: h.hadith_gradings.map((g) => ({ id: g.id, label: `${g.grade} · ${g.grader}` })),
      })),
    );
  };

  return (
    <form
      className="zq-form pp-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const data: Record<string, unknown> = { story_id: storyId };
        for (const [k, v] of fd.entries()) if (v !== "" && !["part", "story", "collection", "number"].includes(k)) data[k] = v;
        if (type === "entry") data.is_primary = fd.get("is_primary") === "on";
        try {
          await call("/api/admin/hadith-stories", { type: `hadith_story_${type}`, data });
          onSaved("Part added. The story is now a new version and needs a new review.");
          form.reset();
          setFound([]);
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <h3>Add a part to a draft story</h3>
      <div className="zq-field">
        <label htmlFor="hs-story">Story</label>
        <select id="hs-story" name="story" className="zq-input" value={storyId} onChange={(e) => setStoryId(e.target.value)} required>
          <option value="">Choose…</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title_en}
            </option>
          ))}
        </select>
      </div>
      <div className="zq-field">
        <label htmlFor="hs-part">Part</label>
        <select id="hs-part" name="part" className="zq-input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="entry">Narration (a hadith in the library)</option>
          <option value="link">Link to a person, community, event or theme</option>
          <option value="claim">Quran connection (approved claim)</option>
          <option value="lesson">Lesson or modern application</option>
        </select>
      </div>

      {type === "entry" ? (
        <>
          <div className="zq-field">
            <label htmlFor="hs-collection">Collection</label>
            <select id="hs-collection" name="collection" className="zq-input" defaultValue="bukhari">
              {COLLECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="hs-number">Hadith number</label>
            <input id="hs-number" name="number" className="zq-input" inputMode="numeric" onBlur={(e) => void lookup((document.getElementById("hs-collection") as HTMLSelectElement).value, e.currentTarget.value.trim())} />
            <p className="zq-help">Leave the field to look the narration up in the library. Only narrations already in the library can be used.</p>
          </div>
          <div className="zq-field">
            <label htmlFor="hs-hadith">Narration found</label>
            <select id="hs-hadith" name="hadith_id" className="zq-input" required>
              <option value="">{found.length ? "Choose…" : "None found yet"}</option>
              {found.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="hs-grading">Individual grading relied on</label>
            <select id="hs-grading" name="grading_id" className="zq-input">
              <option value="">None (Bukhari and Muslim only)</option>
              {found.flatMap((h) => h.gradings).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="zq-help">Required for Tirmidhi and Ibn Majah: sahih or sahih li-ghayrihi, by a named grader. A collection is never a grade.</p>
          </div>
          <label className="zq-check">
            <input type="checkbox" name="is_primary" /> This is the primary narration
          </label>
          <div className="zq-field">
            <label htmlFor="hs-variant">Variant label (optional)</label>
            <input id="hs-variant" name="variant_note" className="zq-input" maxLength={300} />
            <p className="zq-help">A short label such as &ldquo;the longer wording&rdquo;. Never the narration text.</p>
          </div>
        </>
      ) : null}

      {type === "link" ? (
        <>
          <div className="zq-field">
            <label htmlFor="hs-tk">Links to</label>
            <select id="hs-tk" name="target_kind" className="zq-input" value={targetKind} onChange={(e) => setTargetKind(e.target.value)}>
              <option value="person">Person</option>
              <option value="community">Community</option>
              <option value="event">Event</option>
              <option value="theme">Theme (Life Guidance topic)</option>
            </select>
          </div>
          <div className="zq-field">
            <label htmlFor="hs-target">Record</label>
            <select id="hs-target" name="target_id" className="zq-input" required>
              <option value="">Choose…</option>
              {target.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      {type === "claim" ? (
        <div className="zq-field">
          <label htmlFor="hs-claim">Approved claim with a Quran reference</label>
          <select id="hs-claim" name="claim_id" className="zq-input" required>
            <option value="">Choose…</option>
            {claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="zq-help">Verses are never typed here: the connection comes from the claim&rsquo;s reviewed references.</p>
        </div>
      ) : null}

      {type === "lesson" ? (
        <>
          <div className="zq-field">
            <label htmlFor="hs-lk">Kind</label>
            <select id="hs-lk" name="kind" className="zq-input">
              <option value="lesson">Lesson</option>
              <option value="modern_application">Modern application (shown as an educational interpretation)</option>
            </select>
          </div>
          <Field id="body_en" label="Text (English)" area required maxLength={1500} />
          <Field id="body_ar" label="Text (Arabic)" area maxLength={1500} lang="ar" />
          <Field id="body_ur" label="Text (Urdu)" area maxLength={1500} lang="ur" />
        </>
      ) : null}

      {err ? <p role="alert" className="zq-error">{err}</p> : null}
      <button type="submit" className="zq-btn zq-btn-primary" disabled={!storyId}>
        Add part
      </button>
    </form>
  );
}
