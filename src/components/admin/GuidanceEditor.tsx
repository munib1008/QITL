"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { englishContent } from "@/lib/i18n/locales";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, TextField } from "@/components/ui/misc";
import { ICON_KEYS } from "@/lib/guidance/topics";
import { useLocale } from "@/lib/i18n/useLocale";
import { adminGuidanceStrings } from "@/lib/i18n/modules/adminGuidance";
import { AdminFeedback as Feedback, errMsg, type AdminMsg } from "./feedback";
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
  const locale = useLocale();
  const g = useMemo(() => adminGuidanceStrings(locale), [locale]);
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [msg, setMsg] = useState<AdminMsg>(null);
  const reload = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from("guidance_topics").select("id, slug, title_en, title_ar, distress, status, guidance_lessons(id, title_en, status)").order("position");
    if (error) setMsg(errMsg(locale, g.failedPrefix, error.message));
    else setTopics((data ?? []) as unknown as TopicRow[]);
  }, [sb, locale, g]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!sb) return <EmptyState title={g.notConfigured} />;
  const done = (error: { message: string } | null, ok: string) => {
    setMsg(error ? errMsg(locale, g.failedPrefix, error.message) : { tone: "ok", text: ok });
    if (!error) void reload();
    return !error;
  };
  const topicSelect = (id: string) => (
    <div className="zq-field">
      <label htmlFor={id}>{g.topic}</label>
      <select id={id} name="topic" className="zq-input" required>
        {(topics ?? []).map((t) => (
          <option key={t.id} value={t.id} {...englishContent(locale)}>
            {t.title_en}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />
      <p className="zq-meta">{g.lead}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {(topics ?? []).map((t) => (
          <li key={t.id} className="pp-card">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <EditorialStatus status={t.status} /> <b>{t.title_en}</b>
              <span lang="ar" dir="rtl">{t.title_ar}</span> <span className="zq-order">/guidance/{t.slug}</span>
              {t.distress ? <span className="zq-soon">{g.distressTopic}</span> : null}
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
              <p className="zq-meta">{g.noLessons}</p>
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
          done(error, g.topicCreated);
        }}
      >
        <h3>{g.newTopic}</h3>
        <TextField label={g.slug} id="gt-slug" name="slug" required pattern="[a-z0-9-]{2,60}" />
        <TextField label={g.title} id="gt-en" name="title_en" required />
        <TextField label={g.arabicTitle} id="gt-ar" name="title_ar" dir="rtl" lang="ar" required />
        <TextField label={g.shortSummary} id="gt-sum" name="summary_en" />
        <div className="zq-field">
          <label htmlFor="gt-icon">{g.icon}</label>
          <select id="gt-icon" name="icon" className="zq-input">
            {ICON_KEYS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input type="checkbox" name="distress" /> {g.distressLabel}
        </label>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{g.createDraftTopic}</button>
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
          if (errors.length) return setMsg(errMsg(locale, g.failedPrefix, errors.join("; ")));
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
          done(null, g.lessonSaved);
        }}
      >
        <h3>{g.addLesson}</h3>
        {topicSelect("gl-topic")}
        <TextField label={g.position} id="gl-pos" name="position" type="number" min={1} defaultValue={1} />
        <TextField label={g.lessonTitle} id="gl-en" name="title_en" required />
        <TextField label={g.lessonTitleAr} id="gl-ar" name="title_ar" dir="rtl" lang="ar" />
        <TextField
          label={g.revelationIds}
          id="gl-rev"
          name="revelation"
          dir="ltr"
          help={g.revelationHelp}
        />
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="gl-sch">{g.scholarlyLabel}</label>
          <textarea id="gl-sch" name="scholarly" className="zq-textarea" dir="ltr" style={{ minHeight: 96 }} />
          <span className="zq-help">{g.scholarlyHelp}</span>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="gl-app">{g.applicationLabel}</label>
          <textarea id="gl-app" name="application_en" className="zq-textarea" style={{ minHeight: 120 }} />
          <span className="zq-help">{g.applicationHelp}</span>
        </div>
        <div className="zq-field" style={{ maxWidth: "none" }}>
          <label htmlFor="gl-app-ar">{g.applicationAr}</label>
          <textarea id="gl-app-ar" name="application_ar" className="zq-textarea" dir="rtl" lang="ar" style={{ minHeight: 80 }} />
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{g.saveLessonDraft}</button>
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
          done(error, g.noteSaved);
        }}
      >
        <h3>{g.safetyNote}</h3>
        {topicSelect("gs-topic")}
        <div className="zq-field">
          <label htmlFor="gs-kind">{g.kind}</label>
          <select id="gs-kind" name="kind" className="zq-input">
            <option value="mental_health">{g.safetyMental}</option>
            <option value="medical">{g.safetyMedical}</option>
            <option value="crisis">{g.safetyCrisis}</option>
            <option value="ruling_referral">{g.safetyMufti}</option>
          </select>
        </div>
        <TextField label={g.noteLabel} id="gs-en" name="body_en" required minLength={10} help={g.noteHelp} />
        <TextField label={g.noteAr} id="gs-ar" name="body_ar" dir="rtl" lang="ar" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{g.saveNoteDraft}</button>
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
          if (!target) return setMsg({ tone: "err", text: g.noTarget(g.targetKinds[kind] ?? kind) });
          const { error } = await sb.from("guidance_links").insert({
            topic_id: String(f.get("topic")),
            target_kind: kind,
            [TARGET_COL[kind]]: (target as { id: string }).id,
            note_en: String(f.get("note_en") || "") || null,
          });
          done(error, g.linkSaved);
        }}
      >
        <h3>{g.relatedHeading}</h3>
        {topicSelect("gk-topic")}
        <div className="zq-field">
          <label htmlFor="gk-kind">{g.kind}</label>
          <select id="gk-kind" name="kind" className="zq-input">
            <option value="person">{g.optPerson}</option>
            <option value="event">{g.optEvent}</option>
            <option value="story">{g.optStory}</option>
            <option value="creation">{g.optCreation}</option>
          </select>
        </div>
        <TextField label={g.itsSlug} id="gk-slug" name="slug" required pattern="[a-z0-9-]+" />
        <TextField label={g.whyRelated} id="gk-note" name="note_en" />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">{g.saveLinkDraft}</button>
        </div>
      </form>
    </div>
  );
}
