"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { TextField } from "@/components/ui/misc";
import { AnimationPlayer, ANIMATION_KEYS, ANIMATION_LABELS } from "@/components/story/AnimationPlayer";
import { FACT_KEYS, FACT_TITLE, STEP_ROLES, STEP_TITLE } from "@/lib/data/story-types";
import { useLocale } from "@/lib/i18n/useLocale";
import { englishContent } from "@/lib/i18n/locales";
import { storyStrings } from "@/lib/i18n/modules/story";
import { uiStrings } from "@/lib/i18n/modules/ui";
import { adminStoryStrings } from "@/lib/i18n/modules/adminStory";
import { AdminFeedback as Feedback, errMsg, type AdminMsg } from "./feedback";

interface Stop {
  id: string;
  name: string;
  arabicName: string;
  honorific: string;
}
interface Subject {
  id: string;
  slug: string;
  name: string;
  status: EditorialState;
  type: "person" | "event";
}
interface Row {
  id: string;
  section: string;
  fact_key: string | null;
  step_group: number | null;
  step_role: string | null;
  audience: string;
  title: string | null;
  status: EditorialState;
  body_md: string;
  claim_id: string;
}

const SECTIONS: Array<[string, string]> = [
  ["summary", "Quick understanding (one-minute summary)"],
  ["fact", "A — Introduction fact"],
  ["before_mission", "B — Before the mission"],
  ["calling", "C — The calling and the message"],
  ["step", "D — Challenge step"],
  ["outcome", "E — Outcome of the mission"],
  ["takeaway", "F — Takeaway"],
  ["reflection", "Reflection question"],
  ["scholarly_note", "Scholarly note (full story only)"],
];

/**
 * The encyclopedia's event list from the brief, imported as untitled drafts for editors to source and date.
 * Titles only: no dates, places or claims are created, and nothing is published without review.
 */
const EVENT_DRAFTS: Array<[string, string, "sacred_history" | "prophetic_life"]> = [
  ["people-of-the-cave", "The People of the Cave (Ashab al-Kahf)", "sacred_history"],
  ["dhul-qarnayn", "Dhul-Qarnayn and Yajuj and Majuj", "sacred_history"],
  ["qarun", "Qarun", "sacred_history"],
  ["talut-and-jalut", "Talut and Jalut", "sacred_history"],
  ["queen-of-saba", "The Queen of Saba and Sulayman", "sacred_history"],
  ["people-of-the-elephant", "The People of the Elephant", "prophetic_life"],
  ["rebuilding-of-the-kabah", "The rebuilding of the Ka'bah", "prophetic_life"],
  ["migration-to-madinah", "The migration to Madinah", "prophetic_life"],
  ["battle-of-badr", "The Battle of Badr", "prophetic_life"],
  ["battle-of-uhud", "The Battle of Uhud", "prophetic_life"],
  ["treaty-of-hudaybiyyah", "The Treaty of Hudaybiyyah", "prophetic_life"],
];

async function setStatus(entityType: string, entityId: string, status: string) {
  const r = await fetch("/api/admin/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, status }) });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Failed.");
}

export function StoryEditor({ stops }: { stops: Stop[] }) {
  const sb = getBrowserSupabase();
  const locale = useLocale();
  const t = useMemo(() => adminStoryStrings(locale), [locale]);
  const ss = useMemo(() => storyStrings(locale), [locale]);
  const statusWord = (s: string) => (uiStrings(locale).status as Record<string, string>)[s] ?? s;
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectKey, setSubjectKey] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [section, setSection] = useState("summary");
  const [audience, setAudience] = useState("full");
  const [anim, setAnim] = useState(ANIMATION_KEYS[0]!);
  const [msg, setMsg] = useState<AdminMsg>(null);
  const subject = subjects?.find((s) => `${s.type}:${s.id}` === subjectKey);
  const col = subject?.type === "event" ? "event_id" : "person_id";

  const say = (tone: "ok" | "err", text: string, server?: string) => setMsg(server ? { tone, text, server } : { tone, text });
  const sayErr = (message: string) => {
    const m = errMsg(locale, t.failedPrefix, message, t.notConfigured);
    say("err", m.text, m.server);
  };
  const loadSubjects = useCallback(async () => {
    if (!sb) return;
    const [p, e] = await Promise.all([
      sb.from("people").select("id, slug, name_en, status").order("name_en"),
      sb.from("historical_events").select("id, slug, title, status").in("category", ["sacred_history", "prophetic_life", "islamic_history"]).order("title"),
    ]);
    setSubjects([
      ...((p.data ?? []) as Array<{ id: string; slug: string; name_en: string; status: EditorialState }>).map((x) => ({ id: x.id, slug: x.slug, name: x.name_en, status: x.status, type: "person" as const })),
      ...((e.data ?? []) as Array<{ id: string; slug: string; title: string; status: EditorialState }>).map((x) => ({ id: x.id, slug: x.slug, name: x.title, status: x.status, type: "event" as const })),
    ]);
  }, [sb]);
  const loadRows = useCallback(async () => {
    if (!sb || !subject) return setRows([]);
    const { data } = await sb
      .from("story_sections")
      .select("id, section, fact_key, step_group, step_role, audience, title, status, body_md, claim_id")
      .eq(col, subject.id)
      .order("section")
      .order("position");
    setRows((data ?? []) as Row[]);
  }, [sb, subject, col]);
  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);
  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const missingPeople = stops.filter((s) => !(subjects ?? []).some((p) => p.type === "person" && p.slug === s.id));
  const missingEvents = EVENT_DRAFTS.filter(([slug]) => !(subjects ?? []).some((p) => p.type === "event" && p.slug === slug));
  const fullRows = rows.filter((r) => r.audience === "full" && r.section === section);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <Feedback msg={msg} />

      <section className="pp-card">
        <h3>{t.subjects}</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.subjectsHelp}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {missingPeople.length ? (
            <button
              type="button"
              className="zq-btn zq-btn-secondary"
              onClick={async () => {
                const { error } = (await sb?.from("people").insert(missingPeople.map((s) => ({ slug: s.id, name_en: s.name, name_ar: s.arabicName, honorific: s.honorific || null, kind: "prophet" })))) ?? {
                  error: { message: t.notConfigured },
                };
                if (error) sayErr(error.message);
                else say("ok", t.createdProphets(missingPeople.length));
                void loadSubjects();
              }}
            >
              {t.importProphets(missingPeople.length)}
            </button>
          ) : null}
          {missingEvents.length ? (
            <button
              type="button"
              className="zq-btn zq-btn-secondary"
              onClick={async () => {
                const me = (await sb?.auth.getUser())?.data.user?.id;
                const { error } = (await sb?.from("historical_events").insert(missingEvents.map(([slug, title, category]) => ({ slug, title, category, date_precision: "unknown", created_by: me })))) ?? {
                  error: { message: t.notConfigured },
                };
                if (error) sayErr(error.message);
                else say("ok", t.createdEvents(missingEvents.length));
                void loadSubjects();
              }}
            >
              {t.importEvents(missingEvents.length)}
            </button>
          ) : null}
        </div>
        <div className="zq-field">
          <label htmlFor="se-subject">{t.prophetOrEvent}</label>
          <select id="se-subject" className="zq-input" value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)}>
            <option value="">{t.choose}</option>
            <optgroup label={t.prophets}>
              {(subjects ?? []).filter((s) => s.type === "person").map((s) => (
                <option key={s.id} value={`person:${s.id}`} {...englishContent(locale)}>
                  {s.name} ({statusWord(s.status)})
                </option>
              ))}
            </optgroup>
            <optgroup label={t.events}>
              {(subjects ?? []).filter((s) => s.type === "event").map((s) => (
                <option key={s.id} value={`event:${s.id}`} {...englishContent(locale)}>
                  {s.name} ({statusWord(s.status)})
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </section>

      {subject ? (
        <>
          <section className="pp-card">
            <h3>{t.sectionsOf} {subject.name}</h3>
            {rows.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {rows.map((r) => (
                  <li key={r.id} className="zq-result" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 0" }}>
                    <EditorialStatus status={r.status} />
                    <b>{t.sections[r.section] ?? SECTIONS.find((x) => x[0] === r.section)?.[1] ?? r.section}</b>
                    <span className="zq-meta">
                      {r.fact_key ? (ss.facts[r.fact_key] ?? FACT_TITLE[r.fact_key as keyof typeof FACT_TITLE]) : ""}
                      {r.step_role ? `${ss.challenge(r.step_group ?? 0)} · ${ss.steps[r.step_role] ?? STEP_TITLE[r.step_role as keyof typeof STEP_TITLE]}` : ""} · {t.audiences[r.audience] ?? r.audience}
                    </span>
                    {r.status === "draft" ? (
                      <button
                        type="button"
                        className="zq-btn zq-btn-quiet zq-btn-sm"
                        onClick={async () => {
                          try {
                            await setStatus("story_section", r.id, "in_review");
                            say("ok", t.okSent);
                          } catch (x) {
                            sayErr((x as Error).message);
                          }
                          void loadRows();
                        }}
                      >
                        {t.sendForReview}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-meta">{t.noSections}</p>
            )}
          </section>

          <form
            className="zq-form pp-card"
            style={{ maxWidth: 760 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const g = (k: string) => String(f.get(k) ?? "").trim();
              const base = audience === "full" ? null : rows.find((r) => r.id === g("base"));
              if (audience !== "full" && !base) return say("err", t.chooseFull);
              const known = section !== "fact" || f.get("known") === "on";
              const me = (await sb?.auth.getUser())?.data.user?.id;
              const { error } = (await sb?.from("story_sections").insert({
                [col]: subject.id,
                section,
                fact_key: section === "fact" ? (base?.fact_key ?? g("fact_key")) : null,
                step_group: section === "step" ? (base?.step_group ?? Number(g("step_group") || 1)) : null,
                step_role: section === "step" ? (base?.step_role ?? g("step_role")) : null,
                position: Number(g("position") || 1),
                audience,
                base_section_id: base?.id ?? null,
                title: g("title") || null,
                value_text: section === "fact" && known ? g("value_text") || null : null,
                value_note: section === "fact" ? g("value_note") || null : null,
                known,
                body_md: g("body_md"),
                everyday_example: section === "takeaway" ? g("everyday_example") || null : null,
                claim_id: base?.claim_id ?? g("claim_id"),
                created_by: me,
              })) ?? { error: { message: t.notConfigured } };
              if (error) sayErr(error.message);
              else {
                say("ok", t.okSavedDraft);
                (e.target as HTMLFormElement).reset();
                void loadRows();
              }
            }}
          >
            <h3>{t.writeSection}</h3>
            <div className="zq-field">
              <label htmlFor="se-section">{t.section}</label>
              <select id="se-section" className="zq-input" value={section} onChange={(e) => setSection(e.target.value)}>
                {SECTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {t.sections[k] ?? label}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="se-aud">{t.readingLevel}</label>
              <select id="se-aud" className="zq-input" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="full">{t.levelFull}</option>
                <option value="young">{t.levelYoung}</option>
                <option value="kids">{t.levelKids}</option>
              </select>
              <span className="zq-help">{t.levelHelp}</span>
            </div>
            {audience !== "full" ? (
              <div className="zq-field">
                <label htmlFor="se-base">{t.adaptsFull}</label>
                <select id="se-base" name="base" className="zq-input" required>
                  {fullRows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {(r.title ?? r.fact_key ?? r.step_role ?? r.section) + " — " + r.body_md.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {section === "fact" && audience === "full" ? (
              <div className="zq-field">
                <label htmlFor="se-fact">{t.fact}</label>
                <select id="se-fact" name="fact_key" className="zq-input">
                  {FACT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ss.facts[k] ?? FACT_TITLE[k]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {section === "fact" ? (
              <>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="known" defaultChecked /> {t.knownCheck}
                </label>
                <TextField label={t.valueLabel} id="se-value" name="value_text" maxLength={160} help={t.valueHelp} />
                <TextField label={t.note} id="se-note" name="value_note" maxLength={300} help={t.noteHelp} />
              </>
            ) : null}
            {section === "step" && audience === "full" ? (
              <>
                <TextField label={t.challengeNumber} id="se-group" name="step_group" type="number" min={1} defaultValue="1" />
                <div className="zq-field">
                  <label htmlFor="se-role">{t.step}</label>
                  <select id="se-role" name="step_role" className="zq-input">
                    {STEP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ss.steps[r] ?? STEP_TITLE[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            {["takeaway", "summary", "before_mission", "calling", "outcome", "scholarly_note"].includes(section) ? (
              <TextField label={section === "takeaway" ? t.lesson : t.headingOptional} id="se-title" name="title" maxLength={160} required={section === "takeaway"} />
            ) : null}
            {section !== "fact" ? (
              <div className="zq-field" style={{ maxWidth: "none" }}>
                <label htmlFor="se-body">{section === "takeaway" ? t.meaning : section === "reflection" ? t.question : t.textMd}</label>
                <textarea id="se-body" name="body_md" className="zq-textarea" style={{ minHeight: 160 }} required />
                <span className="zq-help">{t.bodyHelp}</span>
              </div>
            ) : null}
            {section === "takeaway" ? (
              <TextField label={t.everydayExample} id="se-ex" name="everyday_example" required maxLength={1000} />
            ) : null}
            <TextField label={t.position} id="se-pos" name="position" type="number" min={1} defaultValue="1" />
            {audience === "full" ? <TextField label={t.claimRests} id="se-claim" name="claim_id" required pattern="[0-9a-f-]{36}" dir="ltr" /> : null}
            <div>
              <button type="submit" className="zq-btn zq-btn-primary">
                {t.saveDraft}
              </button>
            </div>
          </form>

          <QuizEditor subjectCol={col} subjectId={subject.id} say={say} />

          <form
            className="zq-form pp-card"
            style={{ maxWidth: 760 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const g = (k: string) => String(f.get(k) ?? "").trim();
              const me = (await sb?.auth.getUser())?.data.user?.id;
              const { error } = (await sb?.from("story_media").insert({
                [col]: subject.id,
                role: "animation",
                animation_key: anim,
                caption: g("caption"),
                alt_text: g("alt"),
                claim_id: g("claim"),
                created_by: me,
              })) ?? { error: { message: t.notConfigured } };
              if (error) sayErr(error.message);
              else say("ok", t.animationRegistered);
            }}
          >
            <h3>{t.registerAnimation}</h3>
            <div className="zq-field">
              <label htmlFor="se-anim">{t.animation}</label>
              <select id="se-anim" className="zq-input" value={anim} onChange={(e) => setAnim(e.target.value)}>
                {ANIMATION_KEYS.map((k) => (
                  <option key={k} value={k} {...englishContent(locale)}>
                    {ANIMATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ maxWidth: 420 }}>
              <AnimationPlayer animation={anim} caption={t.preview} alt={ANIMATION_LABELS[anim] ?? anim} />
            </div>
            <TextField label={t.caption} id="se-cap" name="caption" required maxLength={300} />
            <TextField label={t.textAlternative} id="se-alt" name="alt" required maxLength={500} help={t.altHelp} />
            <TextField label={t.animationClaim} id="se-mclaim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
            <div>
              <button type="submit" className="zq-btn zq-btn-secondary">
                {t.registerDraft}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}

function QuizEditor({ subjectCol, subjectId, say }: { subjectCol: string; subjectId: string; say: (tone: "ok" | "err", text: string, server?: string) => void }) {
  const sb = getBrowserSupabase();
  const locale = useLocale();
  const t = useMemo(() => adminStoryStrings(locale), [locale]);
  const sayErr = (message: string) => {
    const m = errMsg(locale, t.failedPrefix, message, t.notConfigured);
    say("err", m.text, m.server);
  };
  const [quizzes, setQuizzes] = useState<Array<{ id: string; title: string; audience: string; status: EditorialState }>>([]);
  const load = useCallback(async () => {
    const { data } = (await sb?.from("story_quizzes").select("id, title, audience, status").eq(subjectCol, subjectId)) ?? { data: null };
    setQuizzes((data ?? []) as typeof quizzes);
  }, [sb, subjectCol, subjectId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="pp-card" style={{ maxWidth: 760 }}>
      <h3>{t.quizzes}</h3>
      <p className="zq-meta" style={{ margin: 0 }}>{t.quizzesHelp}</p>
      <form
        className="zq-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const { error } = (await sb?.from("story_quizzes").insert({ [subjectCol]: subjectId, title: String(f.get("title")), audience: String(f.get("audience")) })) ?? {
            error: { message: t.notConfigured },
          };
          if (error) sayErr(error.message);
          else {
            say("ok", t.quizCreated);
            void load();
          }
        }}
      >
        <TextField label={t.quizTitle} id="qz-title" name="title" required />
        <div className="zq-field">
          <label htmlFor="qz-aud">{t.forAudience}</label>
          <select id="qz-aud" name="audience" className="zq-input" defaultValue="kids">
            <option value="kids">{t.kids}</option>
            <option value="young">{t.youngLearners}</option>
            <option value="full">{t.fullStory}</option>
          </select>
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm">
            {t.createQuiz}
          </button>
        </div>
      </form>
      {quizzes.map((q) => (
        <form
          key={q.id}
          className="zq-form"
          style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const options = String(f.get("options") ?? "")
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);
            const { error } = (await sb?.from("quiz_questions").insert({
              quiz_id: q.id,
              position: Number(f.get("position") || 1),
              prompt: String(f.get("prompt")),
              options,
              correct_index: Number(f.get("correct")) - 1,
              explanation: String(f.get("explanation") || "") || null,
              claim_id: String(f.get("claim")).trim(),
            })) ?? { error: { message: t.notConfigured } };
            if (error) sayErr(error.message);
            else {
              say("ok", t.questionAdded);
              (e.target as HTMLFormElement).reset();
            }
          }}
        >
          <p style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
            <EditorialStatus status={q.status} /> <b>{q.title}</b> <span className="zq-meta">({q.audience})</span>
            {q.status === "draft" ? (
              <button
                type="button"
                className="zq-btn zq-btn-quiet zq-btn-sm"
                onClick={async () => {
                  try {
                    await setStatus("quiz", q.id, "in_review");
                    say("ok", t.quizSent);
                    void load();
                  } catch (x) {
                    sayErr((x as Error).message);
                  }
                }}
              >
                {t.sendForReview}
              </button>
            ) : null}
          </p>
          {q.status === "draft" ? (
            <>
              <TextField label={t.question} id={`qz-p-${q.id}`} name="prompt" required />
              <div className="zq-field" style={{ maxWidth: "none" }}>
                <label htmlFor={`qz-o-${q.id}`}>{t.optionsOnePerLine}</label>
                <textarea id={`qz-o-${q.id}`} name="options" className="zq-textarea" style={{ minHeight: 90 }} required />
              </div>
              <TextField label={t.correctNumber} id={`qz-c-${q.id}`} name="correct" type="number" min={1} max={5} required />
              <TextField label={t.explanationOptional} id={`qz-e-${q.id}`} name="explanation" />
              <TextField label={t.position} id={`qz-n-${q.id}`} name="position" type="number" min={1} defaultValue="1" />
              <TextField label={t.claimId} id={`qz-cl-${q.id}`} name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
              <div>
                <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm">
                  {t.addQuestion}
                </button>
              </div>
            </>
          ) : null}
        </form>
      ))}
    </section>
  );
}
