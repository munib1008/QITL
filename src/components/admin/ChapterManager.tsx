"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { TextField } from "@/components/ui/misc";
import { MODE_FIELDS } from "@/lib/stories/admin-fields";

interface Story {
  id: string;
  slug: string;
  title: string;
  status: EditorialState;
  version: number;
  person_id: string | null;
}
interface Chapter {
  id: string;
  position: number;
  anchor: string;
  title: string;
  status: EditorialState;
  version: number;
  event_id: string | null;
  body_md: string;
  summary_md: string | null;
  deep_md: string | null;
  kids_md: string | null;
  lessons_md: string | null;
  unknowns_md: string | null;
  chapter_claims: Array<{ claim_id: string }>;
}
interface Option {
  id: string;
  label: string;
}

async function setStatus(entityType: "chapter" | "story", entityId: string, status: string, revisionNote?: string) {
  const r = await fetch("/api/admin/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, status, revisionNote }) });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed.");
}

/**
 * Chapter management for a story (admin: Stories). A chapter has an anchor (its own link), its claims (the evidence it
 * rests on), an optional timeline event, and one reviewed text per depth mode: complete story, one-minute summary,
 * deep study, kids and life lessons, plus what the sources do not establish. Nothing is generated: a mode left empty
 * shows "not established" to readers. Publishing is refused by the database unless every claim is approved, a Quran
 * or authentic hadith reference exists, and a scholar approved THIS version; a published chapter is frozen (move it to
 * correction first), and an editor cannot approve their own chapter.
 */
export function ChapterManager() {
  const sb = getBrowserSupabase();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [people, setPeople] = useState<Option[]>([]);
  const [events, setEvents] = useState<Option[]>([]);
  const [storyId, setStoryId] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [linkedEvents, setLinkedEvents] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<Record<string, "approved" | "stale" | "none">>({});
  const [flagged, setFlagged] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const say = (tone: "ok" | "err", text: string) => setMsg({ tone, text });
  const story = stories?.find((s) => s.id === storyId);

  const loadStories = useCallback(async () => {
    if (!sb) return;
    const [s, p, e] = await Promise.all([
      sb.from("stories").select("id, slug, title, status, version, person_id").order("created_at", { ascending: false }),
      sb.from("people").select("id, name_en").order("name_en"),
      sb.from("historical_events").select("id, title").order("title").limit(1000),
    ]);
    setStories((s.data ?? []) as Story[]);
    setPeople(((p.data ?? []) as Array<{ id: string; name_en: string }>).map((x) => ({ id: x.id, label: x.name_en })));
    setEvents(((e.data ?? []) as Array<{ id: string; title: string }>).map((x) => ({ id: x.id, label: x.title })));
  }, [sb]);

  const loadChapters = useCallback(async () => {
    if (!sb || !storyId) return setChapters([]);
    const { data } = await sb
      .from("chapters")
      .select("id, position, anchor, title, status, version, event_id, body_md, summary_md, deep_md, kids_md, lessons_md, unknowns_md, chapter_claims(claim_id)")
      .eq("story_id", storyId)
      .order("position");
    const rows = (data ?? []) as unknown as Chapter[];
    setChapters(rows);
    const ids = rows.map((c) => c.id);
    if (ids.length) {
      const [rv, fl] = await Promise.all([
        sb.from("editorial_reviews").select("entity_id, decision, entity_version, created_at").eq("entity_type", "chapter").in("entity_id", ids).order("created_at", { ascending: false }),
        sb.from("content_dependency_versions").select("dependant_id, reason").eq("dependant_type", "chapter").eq("stale", true).is("cleared_at", null).in("dependant_id", ids),
      ]);
      const r: Record<string, "approved" | "stale" | "none"> = {};
      for (const c of rows) {
        const latest = ((rv.data ?? []) as Array<{ entity_id: string; decision: string; entity_version: number | null }>).find((x) => x.entity_id === c.id);
        r[c.id] = !latest ? "none" : latest.decision === "approved" && latest.entity_version === c.version ? "approved" : "stale";
      }
      setReviewed(r);
      const f: Record<string, string[]> = {};
      for (const x of (fl.data ?? []) as Array<{ dependant_id: string; reason: string | null }>) f[x.dependant_id] = [...(f[x.dependant_id] ?? []), x.reason ?? "A source changed."];
      setFlagged(f);
    }
    const ev = await sb.from("event_stories").select("event_id").eq("story_id", storyId);
    setLinkedEvents(((ev.data ?? []) as Array<{ event_id: string }>).map((x) => x.event_id));
  }, [sb, storyId]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);
  useEffect(() => {
    void loadChapters();
    setEditing(null);
  }, [loadChapters]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      say("ok", ok);
    } catch (e) {
      say("err", (e as Error).message);
    }
    void loadChapters();
    void loadStories();
  };

  const save = async (form: HTMLFormElement) => {
    if (!sb || !story) return;
    const f = new FormData(form);
    const g = (k: string) => String(f.get(k) ?? "").trim();
    const opt = (k: string) => g(k) || null;
    const row = {
      story_id: story.id,
      position: Number(g("position") || 1),
      anchor: g("anchor") || String(Number(g("position") || 1)),
      title: g("title"),
      event_id: opt("event_id"),
      body_md: String(f.get("body_md") ?? ""),
      ...Object.fromEntries(MODE_FIELDS.filter((m) => m.column !== "body_md").map((m) => [m.column, opt(m.column)])),
      unknowns_md: opt("unknowns_md"),
    };
    const claimIds = g("claims").split(/[\s,]+/).filter(Boolean);
    await act(async () => {
      let id = editing?.id;
      if (id) {
        const { error } = await sb.from("chapters").update(row).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await sb.from("chapters").insert(row).select("id").single();
        if (error) throw new Error(error.message);
        id = (data as { id: string }).id;
      }
      const have = new Set((editing?.chapter_claims ?? []).map((c) => c.claim_id));
      const add = claimIds.filter((c) => !have.has(c));
      const drop = [...have].filter((c) => !claimIds.includes(c));
      if (drop.length) {
        const { error } = await sb.from("chapter_claims").delete().eq("chapter_id", id).in("claim_id", drop);
        if (error) throw new Error(error.message);
      }
      if (add.length) {
        const { error } = await sb.from("chapter_claims").insert(add.map((claim_id) => ({ chapter_id: id, claim_id })));
        if (error) throw new Error(error.message);
      }
      setEditing(null);
      form.reset();
    }, editing ? "Chapter saved. A change to a reviewed chapter is a new version and needs a new scholarly review." : "Chapter saved as a draft.");
  };

  const eventLabel = useMemo(() => new Map(events.map((e) => [e.id, e.label])), [events]);
  const editable = (s: EditorialState) => s !== "published";

  return (
    <div style={{ display: "grid", gap: 20 }} data-testid="chapter-manager">
      <div>
        <h2 style={{ font: "500 24px/32px var(--font-display)", margin: 0 }}>Chapters and depth modes</h2>
        <p className="zq-meta">
          Write only what the sources support. A mode left empty shows readers &ldquo;not established&rdquo;; nothing is generated or filled in. Life lessons are shown labelled as educational interpretation.
        </p>
      </div>
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}

      <div className="zq-field">
        <label htmlFor="cm-story">Story</label>
        <select id="cm-story" className="zq-input" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
          <option value="">Choose…</option>
          {(stories ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.status})
            </option>
          ))}
        </select>
      </div>

      {story ? (
        <>
          <section className="pp-card" aria-labelledby="cm-subject">
            <h3 id="cm-subject">About this story</h3>
            <p className="zq-meta" style={{ margin: 0 }}>
              <EditorialStatus status={story.status} /> version {story.version}. The story is told about one person (a prophet or other person) and linked to any events it covers; its chapters can name their own event.
            </p>
            <div className="zq-field">
              <label htmlFor="cm-person">Told about</label>
              <select
                id="cm-person"
                className="zq-input"
                value={story.person_id ?? ""}
                disabled={story.status === "published"}
                onChange={(e) =>
                  void act(async () => {
                    const { error } = await sb!.from("stories").update({ person_id: e.target.value || null }).eq("id", story.id);
                    if (error) throw new Error(error.message);
                  }, "Subject saved.")
                }
              >
                <option value="">No one in particular</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="cm-link-event">Link an event</label>
              <select
                id="cm-link-event"
                className="zq-input"
                value=""
                onChange={(e) =>
                  e.target.value
                    ? void act(async () => {
                        const { error } = await sb!.from("event_stories").insert({ story_id: story.id, event_id: e.target.value });
                        if (error) throw new Error(error.message);
                      }, "Event linked.")
                    : undefined
                }
              >
                <option value="">Choose an event…</option>
                {events.filter((e) => !linkedEvents.includes(e.id)).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
              {linkedEvents.length ? (
                <ul className="zq-help" style={{ margin: 0, paddingInlineStart: 18 }}>
                  {linkedEvents.map((id) => (
                    <li key={id}>
                      {eventLabel.get(id) ?? id}{" "}
                      <button
                        type="button"
                        className="zq-btn zq-btn-quiet zq-btn-sm"
                        onClick={() =>
                          void act(async () => {
                            const { error } = await sb!.from("event_stories").delete().eq("story_id", story.id).eq("event_id", id);
                            if (error) throw new Error(error.message);
                          }, "Event unlinked.")
                        }
                      >
                        Unlink
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {story.status === "draft" || story.status === "correction" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void act(() => setStatus("story", story.id, "in_review"), "Story sent for review.")}>
                  Send story for review
                </button>
              ) : null}
              {story.status === "in_review" || story.status === "approved" ? (
                <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => void act(() => setStatus("story", story.id, "published"), "Story published.")}>
                  Publish story
                </button>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="cm-list">
            <h3 id="cm-list">Chapters of {story.title}</h3>
            {chapters.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {chapters.map((c) => (
                  <li key={c.id} className="pp-card" data-testid="admin-chapter">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <EditorialStatus status={c.status} />
                      <b>
                        {c.position}. {c.title}
                      </b>
                      <span className="zq-order">#chapter-{c.anchor}</span>
                      <span className="zq-meta">
                        v{c.version} ·{" "}
                        {reviewed[c.id] === "approved" ? "scholar-approved (this version)" : reviewed[c.id] === "stale" ? "review is for another version or not an approval" : "not reviewed"}
                        {c.event_id ? ` · event: ${eventLabel.get(c.event_id) ?? c.event_id}` : ""} · {c.chapter_claims.length} claim(s)
                      </span>
                    </div>
                    {flagged[c.id]?.length ? (
                      <p role="note" className="zq-error" data-testid="needs-rereview">
                        Needs re-review: {flagged[c.id]!.join(" ")}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {editable(c.status) ? (
                        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => setEditing(c)}>
                          Edit
                        </button>
                      ) : null}
                      {c.status === "draft" || c.status === "correction" ? (
                        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void act(() => setStatus("chapter", c.id, "in_review"), "Chapter sent for review.")}>
                          Send for review
                        </button>
                      ) : null}
                      {c.status === "in_review" || c.status === "approved" ? (
                        <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => void act(() => setStatus("chapter", c.id, "published"), "Chapter published.")}>
                          Publish chapter
                        </button>
                      ) : null}
                      {c.status === "published" ? (
                        <button
                          type="button"
                          className="zq-btn zq-btn-quiet zq-btn-sm"
                          disabled={note.trim().length < 3}
                          onClick={() => void act(() => setStatus("chapter", c.id, "correction", note.trim()), "Moved to correction. Readers still see the published text until it is corrected and published again.")}
                        >
                          Move to correction (needs the public note below)
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-meta">No chapters yet.</p>
            )}
            <div className="zq-field">
              <label htmlFor="cm-note">Public revision note (for a correction)</label>
              <input id="cm-note" className="zq-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </section>

          <form
            key={editing?.id ?? "new"}
            className="zq-form pp-card"
            style={{ maxWidth: 760 }}
            onSubmit={(e) => {
              e.preventDefault();
              void save(e.currentTarget);
            }}
          >
            <h3>{editing ? `Edit chapter ${editing.position}` : "Add a chapter"}</h3>
            <TextField label="Position" id="cm-pos" name="position" type="number" min={1} required defaultValue={editing?.position ?? chapters.length + 1} />
            <TextField label="Chapter title" id="cm-title" name="title" required defaultValue={editing?.title ?? ""} />
            <TextField label="Link anchor (optional)" id="cm-anchor" name="anchor" pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={editing?.anchor ?? ""} help="Lowercase letters, digits and hyphens. The chapter is linked as /stories/slug#chapter-anchor. Defaults to the position." />
            <div className="zq-field">
              <label htmlFor="cm-event">Timeline event (optional)</label>
              <select id="cm-event" name="event_id" className="zq-input" defaultValue={editing?.event_id ?? ""}>
                <option value="">None</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            {MODE_FIELDS.map((m) => (
              <div className="zq-field" style={{ maxWidth: "none" }} key={m.column}>
                <label htmlFor={`cm-${m.column}`}>{m.label}</label>
                <textarea
                  id={`cm-${m.column}`}
                  name={m.column}
                  className="zq-textarea"
                  style={{ minHeight: m.column === "body_md" ? 220 : 120 }}
                  defaultValue={(editing?.[m.column as keyof Chapter] as string | null) ?? ""}
                  maxLength={m.max}
                />
                <span className="zq-help">{m.help}</span>
              </div>
            ))}
            <div className="zq-field" style={{ maxWidth: "none" }}>
              <label htmlFor="cm-unknowns">What the sources do not establish</label>
              <textarea id="cm-unknowns" name="unknowns_md" className="zq-textarea" style={{ minHeight: 90 }} defaultValue={editing?.unknowns_md ?? ""} maxLength={4000} />
              <span className="zq-help">Listed under &ldquo;Sources and uncertainties&rdquo;. Name what the Quran and the authentic Hadith leave open.</span>
            </div>
            <TextField
              label="Claim ids this chapter rests on"
              id="cm-claims"
              name="claims"
              dir="ltr"
              defaultValue={(editing?.chapter_claims ?? []).map((c) => c.claim_id).join(" ")}
              help="Separate with spaces or commas. Every claim must be approved, at least one needs a Quran or authentic hadith reference, and the verses of the chapter are taken from them."
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="zq-btn zq-btn-primary">
                {editing ? "Save changes" : "Save chapter draft"}
              </button>
              {editing ? (
                <button type="button" className="zq-btn zq-btn-quiet" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
