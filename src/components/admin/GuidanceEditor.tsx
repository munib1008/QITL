"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, TextField } from "@/components/ui/misc";
import { ICON_KEYS } from "@/lib/guidance/topics";
import { parseRevelationIds, parseScholarLines } from "@/lib/guidance/editor";

interface TopicRow {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  distress: boolean;
  status: EditorialState;
  guidance_lessons: Array<{ id: string; title_en: string; status: EditorialState }>;
}

const TARGET_TABLE = { person: "people", event: "historical_events", story: "stories", creation: "creation_profiles" } as const;
const TARGET_COL = { person: "person_id", event: "event_id", story: "story_id", creation: "creation_id" } as const;

/**
 * Life Guidance editor. Editors write topics, lessons (from approved claims), related links and safety notes as drafts;
 * everything is sent for scholarly review from the review queue and publishes only when the database guards pass.
 * Readers never get generated advice: lesson text here is written by editors from approved sources.
 */
export function GuidanceEditor() {
  const sb = getBrowserSupabase();
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const reload = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("guidance_topics").select("id, slug, title_en, title_ar, distress, status, guidance_lessons(id, title_en, status)").order("position");
    if (error) setMsg({ tone: "err", text: error.message });
    else setTopics((data ?? []) as unknown as TopicRow[]);
  }, [sb]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!sb) return <EmptyState title="Not configured" />;
  const done = (error: { message: string } | null, ok: string) => {
    setMsg(error ? { tone: "err", text: error.message } : { tone: "ok", text: ok });
    if (!error) void reload();
    return !error;
  };
  const topicSelect = (id: string) => (
    <div className="zq-field">
      <label htmlFor={id}>Topic</label>
      <select id={id} name="topic" className="zq-input" required>
        {(topics ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.title_en}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}
      <p className="zq-meta">
        A lesson keeps three layers apart: revelation (approved Quran / authentic-hadith claims), scholarly explanation (approved claims of class
        &ldquo;Scholarly interpretation&rdquo;, each with a named scholar and work) and the everyday application, which the page labels as QITL&rsquo;s
        educational suggestion. Nothing is a personal ruling; send rulings to the Mufti Q&amp;A.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {(topics ?? []).map((t) => (
          <li key={t.id} className="pp-card">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <EditorialStatus status={t.status} /> <b>{t.title_en}</b>
              <span lang="ar" dir="rtl">{t.title_ar}</span> <span className="zq-order">/guidance/{t.slug}</span>
              {t.distress ? <span className="zq-soon">distress topic</span> : null}
            </div>
            {t.guidance_lessons.length ? (
              <ul style={{ margin: 0 }}>
                {t.guidance_lessons.map((l) => (
                  <li key={l.id}>
                    {l.title_en} · <EditorialStatus status={l.status} /> <span className="zq-order">{l.id.slice(0, 8)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-meta">No lessons yet.</p>
            )}
          </li>
        ))}
      </ul>

      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const { error } = await sb.from("guidance_topics").insert({
            slug: String(f.get("slug")),
            title_en: String(f.get("title_en")),
            title_ar: String(f.get("title_ar")),
            summary_en: String(f.get("summary_en") || "") || null,
            icon_key: String(f.get("icon")),
            distress: f.get("distress") === "on",
          });
          done(error, "Topic created as a draft.");
        }}
      >
        <h3>New topic</h3>
        <TextField label="Address (slug)" id="gt-slug" name="slug" required pattern="[a-z0-9-]{2,60}" />
        <TextField label="Title" id="gt-en" name="title_en" required />
        <TextField label="Arabic title" id="gt-ar" name="title_ar" dir="rtl" lang="ar" required />
        <TextField label="Short summary (optional)" id="gt-sum" name="summary_en" />
        <div className="zq-field">
          <label htmlFor="gt-icon">Icon</label>
          <select id="gt-icon" name="icon" className="zq-input">
            {ICON_KEYS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" name="distress" /> Distress topic (shows medical / mental-health help and needs a reviewed safety note)
        </label>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Create draft topic</button>
        </div>
      </form>

      <form
        className="zq-form pp-card"
        style={{ maxWidth: 760 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const rev = parseRevelationIds(String(f.get("revelation") ?? ""));
          const sch = parseScholarLines(String(f.get("scholarly") ?? ""));
          const errors = [...rev.errors, ...sch.errors];
          if (errors.length) return setMsg({ tone: "err", text: errors.join("; ") });
          const { data, error } = await sb
            .from("guidance_lessons")
            .insert({
              topic_id: String(f.get("topic")),
              position: Number(f.get("position") || 1),
              title_en: String(f.get("title_en")),
              title_ar: String(f.get("title_ar") || "") || null,
              application_en: String(f.get("application_en") ?? ""),
              application_ar: String(f.get("application_ar") || "") || null,
            })
            .select("id")
            .single();
          if (error) return done(error, "");
          const rows = [...rev.rows, ...sch.rows].map((r) => ({ ...r, lesson_id: data.id }));
          if (rows.length) {
            const { error: e2 } = await sb.from("guidance_lesson_claims").insert(rows);
            if (e2) return done(e2, "");
          }
          done(null, "Lesson saved as a draft with its claims. Send it for review from the review queue.");
        }}
      >
        <h3>Add a lesson</h3>
        {topicSelect("gl-topic")}
        <TextField label="Position" id="gl-pos" name="position" type="number" min={1} defaultValue={1} />
        <TextField label="Lesson title" id="gl-en" name="title_en" required />
        <TextField label="Arabic lesson title (optional)" id="gl-ar" name="title_ar" dir="rtl" lang="ar" />
        <TextField
          label="1. Revelation: claim ids"
          id="gl-rev"
          name="revelation"
          dir="ltr"
          help="Approved claims citing only Quran verses or hadith with a recorded authentic grading. Separate with spaces or commas."
        />
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="gl-sch">2. Scholarly explanation: one per line, &ldquo;claim id | scholar | work | locator&rdquo;</label>
          <textarea id="gl-sch" name="scholarly" className="zq-textarea" dir="ltr" style={{ minHeight: 96 }} />
          <span className="zq-help">Approved claims of class &ldquo;Scholarly interpretation&rdquo;. Name the scholar and the work every time.</span>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="gl-app">3. Everyday application (QITL&rsquo;s educational suggestion)</label>
          <textarea id="gl-app" name="application_en" className="zq-textarea" style={{ minHeight: 120 }} />
          <span className="zq-help">A suggestion for reflection, labelled as QITL&rsquo;s on the page. Never a ruling, diagnosis or treatment.</span>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="gl-app-ar">Arabic application (optional)</label>
          <textarea id="gl-app-ar" name="application_ar" className="zq-textarea" dir="rtl" lang="ar" style={{ minHeight: 80 }} />
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Save lesson draft</button>
        </div>
      </form>

      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const { error } = await sb.from("guidance_safety_notes").insert({
            topic_id: String(f.get("topic")),
            kind: String(f.get("kind")),
            body_en: String(f.get("body_en")),
            body_ar: String(f.get("body_ar") || "") || null,
          });
          done(error, "Safety note saved as a draft.");
        }}
      >
        <h3>Safety note</h3>
        {topicSelect("gs-topic")}
        <div className="zq-field">
          <label htmlFor="gs-kind">Kind</label>
          <select id="gs-kind" name="kind" className="zq-input">
            <option value="mental_health">Mental health</option>
            <option value="medical">Medical</option>
            <option value="crisis">Crisis services</option>
            <option value="ruling_referral">Refer to a mufti</option>
          </select>
        </div>
        <TextField label="Note" id="gs-en" name="body_en" required minLength={10} help="Plain, non-religious guidance: who to speak to, and local emergency services in a crisis." />
        <TextField label="Arabic note (optional)" id="gs-ar" name="body_ar" dir="rtl" lang="ar" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Save note draft</button>
        </div>
      </form>

      <form
        className="zq-form pp-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const kind = String(f.get("kind")) as keyof typeof TARGET_TABLE;
          const { data: target, error: e1 } = await sb.from(TARGET_TABLE[kind]).select("id").eq("slug", String(f.get("slug"))).maybeSingle();
          if (e1) return done(e1, "");
          if (!target) return setMsg({ tone: "err", text: `No ${kind} with that address.` });
          const { error } = await sb.from("guidance_links").insert({
            topic_id: String(f.get("topic")),
            target_kind: kind,
            [TARGET_COL[kind]]: (target as { id: string }).id,
            note_en: String(f.get("note_en") || "") || null,
          });
          done(error, "Related link saved as a draft.");
        }}
      >
        <h3>Related prophet, event, story or creation profile</h3>
        {topicSelect("gk-topic")}
        <div className="zq-field">
          <label htmlFor="gk-kind">Kind</label>
          <select id="gk-kind" name="kind" className="zq-input">
            <option value="person">Prophet / person</option>
            <option value="event">Event</option>
            <option value="story">Story</option>
            <option value="creation">Creation profile</option>
          </select>
        </div>
        <TextField label="Its address (slug)" id="gk-slug" name="slug" required pattern="[a-z0-9-]+" />
        <TextField label="Why it is related (optional)" id="gk-note" name="note_en" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">Save link draft</button>
        </div>
      </form>
    </div>
  );
}
