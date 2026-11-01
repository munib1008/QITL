"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { TextField } from "@/components/ui/misc";
import { MODE_FIELDS } from "@/lib/stories/admin-fields";
import { englishContent } from "@/lib/i18n/locales";
import { useLocale } from "@/lib/i18n/useLocale";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { adminChapterStrings } from "@/lib/i18n/modules/adminChapter";
import { AdminFeedback as Feedback, ServerText, errMsg, type AdminMsg } from "./feedback";

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
  const locale = useLocale();
  const t = useMemo(() => adminChapterStrings(locale), [locale]);
  const statusWord = (s: string) => (uiStrings(locale).status as Record<string, string>)[s] ?? s;
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
  const [msg, setMsg] = useState<AdminMsg>(null);
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
      for (const x of (fl.data ?? []) as Array<{ dependant_id: string; reason: string | null }>) f[x.dependant_id] = [...(f[x.dependant_id] ?? []), x.reason ?? ""];
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
      setMsg(errMsg(locale, t.failedPrefix, (e as Error).message));
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
    }, editing ? t.okChapterSavedEdit : t.okChapterSaved);
  };

  const eventLabel = useMemo(() => new Map(events.map((e) => [e.id, e.label])), [events]);
  const editable = (s: EditorialState) => s !== "published";

  return (
    <div style={{ display: "grid", gap: 20 }} data-testid="chapter-manager">
      <div>
        <h2 style={{ font: "500 24px/32px var(--font-display)", margin: 0 }}>{t.heading}</h2>
        <p className="zq-meta">
          {t.lead}
        </p>
      </div>
      <Feedback msg={msg} />

      <div className="zq-field">
        <label htmlFor="cm-story">{t.story}</label>
        <select id="cm-story" className="zq-input" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
          <option value="">{t.chooseDots}</option>
          {(stories ?? []).map((s) => (
            <option key={s.id} value={s.id} {...englishContent(locale)}>
              {s.title} ({statusWord(s.status)})
            </option>
          ))}
        </select>
      </div>

      {story ? (
        <>
          <section className="pp-card" aria-labelledby="cm-subject">
            <h3 id="cm-subject">{t.aboutStory}</h3>
            <p className="zq-meta" style={{ margin: 0 }}>
              <EditorialStatus status={story.status} /> {t.versionWord} {story.version}. {t.aboutNote}
            </p>
            <div className="zq-field">
              <label htmlFor="cm-person">{t.toldAbout}</label>
              <select
                id="cm-person"
                className="zq-input"
                value={story.person_id ?? ""}
                disabled={story.status === "published"}
                onChange={(e) =>
                  void act(async () => {
                    const { error } = await sb!.from("stories").update({ person_id: e.target.value || null }).eq("id", story.id);
                    if (error) throw new Error(error.message);
                  }, t.okSubjectSaved)
                }
              >
                <option value="">{t.noOneInParticular}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id} {...englishContent(locale)}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="cm-link-event">{t.linkEvent}</label>
              <select
                id="cm-link-event"
                className="zq-input"
                value=""
                onChange={(e) =>
                  e.target.value
                    ? void act(async () => {
                        const { error } = await sb!.from("event_stories").insert({ story_id: story.id, event_id: e.target.value });
                        if (error) throw new Error(error.message);
                      }, t.okEventLinked)
                    : undefined
                }
              >
                <option value="">{t.chooseEventDots}</option>
                {events.filter((e) => !linkedEvents.includes(e.id)).map((e) => (
                  <option key={e.id} value={e.id} {...englishContent(locale)}>
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
                          }, t.okEventUnlinked)
                        }
                      >
                        {t.unlink}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {story.status === "draft" || story.status === "correction" ? (
                <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void act(() => setStatus("story", story.id, "in_review"), t.okStorySent)}>
                  {t.sendStory}
                </button>
              ) : null}
              {story.status === "in_review" || story.status === "approved" ? (
                <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => void act(() => setStatus("story", story.id, "published"), t.okStoryPublished)}>
                  {t.publishStory}
                </button>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="cm-list">
            <h3 id="cm-list">{t.chaptersOf} <span {...englishContent(locale)}>{story.title}</span></h3>
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
                        {reviewed[c.id] === "approved" ? t.reviewApproved : reviewed[c.id] === "stale" ? t.reviewStale : t.reviewNone}
                        {c.event_id ? t.eventLabel(eventLabel.get(c.event_id) ?? c.event_id) : ""} · {t.claimsCount(c.chapter_claims.length)}
                      </span>
                    </div>
                    {flagged[c.id]?.length ? (
                      <p role="note" className="zq-error" data-testid="needs-rereview">
                        {t.needsRereview} {flagged[c.id]!.map((r, i) => (r ? <ServerText key={i}>{r} </ServerText> : <span key={i}>{t.sourceChanged} </span>))}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {editable(c.status) ? (
                        <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" onClick={() => setEditing(c)}>
                          {t.edit}
                        </button>
                      ) : null}
                      {c.status === "draft" || c.status === "correction" ? (
                        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => void act(() => setStatus("chapter", c.id, "in_review"), t.okChapterSent)}>
                          {t.sendForReview}
                        </button>
                      ) : null}
                      {c.status === "in_review" || c.status === "approved" ? (
                        <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => void act(() => setStatus("chapter", c.id, "published"), t.okChapterPublished)}>
                          {t.publishChapter}
                        </button>
                      ) : null}
                      {c.status === "published" ? (
                        <button
                          type="button"
                          className="zq-btn zq-btn-quiet zq-btn-sm"
                          disabled={note.trim().length < 3}
                          onClick={() => void act(() => setStatus("chapter", c.id, "correction", note.trim()), t.okMovedCorrection)}
                        >
                          {t.moveCorrectionBtn}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-meta">{t.noChapters}</p>
            )}
            <div className="zq-field">
              <label htmlFor="cm-note">{t.revisionNote}</label>
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
            <h3>{editing ? t.editChapterN(editing.position) : t.addChapter}</h3>
            <TextField label={t.position} id="cm-pos" name="position" type="number" min={1} required defaultValue={editing?.position ?? chapters.length + 1} />
            <TextField label={t.chapterTitle} id="cm-title" name="title" required defaultValue={editing?.title ?? ""} />
            <TextField label={t.anchor} id="cm-anchor" name="anchor" pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={editing?.anchor ?? ""} help={t.anchorHelp} />
            <div className="zq-field">
              <label htmlFor="cm-event">{t.timelineEvent}</label>
              <select id="cm-event" name="event_id" className="zq-input" defaultValue={editing?.event_id ?? ""}>
                <option value="">{t.none}</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id} {...englishContent(locale)}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            {MODE_FIELDS.map((m) => (
              <div className="zq-field" style={{ maxWidth: "none" }} key={m.column}>
                <label htmlFor={`cm-${m.column}`}>{t.modeLabels[m.column] ?? m.label}</label>
                <textarea
                  id={`cm-${m.column}`}
                  name={m.column}
                  className="zq-textarea"
                  style={{ minHeight: m.column === "body_md" ? 220 : 120 }}
                  defaultValue={(editing?.[m.column as keyof Chapter] as string | null) ?? ""}
                  maxLength={m.max}
                />
                <span className="zq-help">{t.modeHelps[m.column] ?? m.help}</span>
              </div>
            ))}
            <div className="zq-field" style={{ maxWidth: "none" }}>
              <label htmlFor="cm-unknowns">{t.unknownsLabel}</label>
              <textarea id="cm-unknowns" name="unknowns_md" className="zq-textarea" style={{ minHeight: 90 }} defaultValue={editing?.unknowns_md ?? ""} maxLength={4000} />
              <span className="zq-help">{t.unknownsHelp}</span>
            </div>
            <TextField
              label={t.claimsLabel}
              id="cm-claims"
              name="claims"
              dir="ltr"
              defaultValue={(editing?.chapter_claims ?? []).map((c) => c.claim_id).join(" ")}
              help={t.claimsHelp}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="zq-btn zq-btn-primary">
                {editing ? t.saveChanges : t.saveChapterDraft}
              </button>
              {editing ? (
                <button type="button" className="zq-btn zq-btn-quiet" onClick={() => setEditing(null)}>
                  {t.cancel}
                </button>
              ) : null}
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
