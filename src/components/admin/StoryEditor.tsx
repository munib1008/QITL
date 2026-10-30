"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, type EditorialState } from "@/components/ui/evidence";
import { TextField } from "@/components/ui/misc";
import { AnimationPlayer, ANIMATION_KEYS, ANIMATION_LABELS } from "@/components/story/AnimationPlayer";
import { FACT_KEYS, FACT_TITLE, STEP_ROLES, STEP_TITLE } from "@/lib/data/story-types";

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
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectKey, setSubjectKey] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [section, setSection] = useState("summary");
  const [audience, setAudience] = useState("full");
  const [anim, setAnim] = useState(ANIMATION_KEYS[0]!);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const subject = subjects?.find((s) => `${s.type}:${s.id}` === subjectKey);
  const col = subject?.type === "event" ? "event_id" : "person_id";

  const say = (tone: "ok" | "err", text: string) => setMsg({ tone, text });
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
      {msg ? (
        <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
          {msg.text}
        </p>
      ) : null}

      <section className="pp-card">
        <h3>Subjects</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          Prophets come from the journey content; events from the encyclopedia list. Both are created as drafts with names only — no dates, places or claims —
          and must be reviewed before they are published.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {missingPeople.length ? (
            <button
              type="button"
              className="zq-btn zq-btn-secondary"
              onClick={async () => {
                const { error } = (await sb?.from("people").insert(missingPeople.map((s) => ({ slug: s.id, name_en: s.name, name_ar: s.arabicName, honorific: s.honorific || null, kind: "prophet" })))) ?? {
                  error: { message: "Not configured" },
                };
                if (error) say("err", error.message);
                else say("ok", `Created ${missingPeople.length} draft prophets.`);
                void loadSubjects();
              }}
            >
              Import {missingPeople.length} prophets as drafts
            </button>
          ) : null}
          {missingEvents.length ? (
            <button
              type="button"
              className="zq-btn zq-btn-secondary"
              onClick={async () => {
                const me = (await sb?.auth.getUser())?.data.user?.id;
                const { error } = (await sb?.from("historical_events").insert(missingEvents.map(([slug, title, category]) => ({ slug, title, category, date_precision: "unknown", created_by: me })))) ?? {
                  error: { message: "Not configured" },
                };
                if (error) say("err", error.message);
                else say("ok", `Created ${missingEvents.length} draft events with unknown dates. Add sources, dates and places before review.`);
                void loadSubjects();
              }}
            >
              Import {missingEvents.length} encyclopedia events as drafts
            </button>
          ) : null}
        </div>
        <div className="zq-field">
          <label htmlFor="se-subject">Prophet or event</label>
          <select id="se-subject" className="zq-input" value={subjectKey} onChange={(e) => setSubjectKey(e.target.value)}>
            <option value="">Choose…</option>
            <optgroup label="Prophets">
              {(subjects ?? []).filter((s) => s.type === "person").map((s) => (
                <option key={s.id} value={`person:${s.id}`}>
                  {s.name} ({s.status})
                </option>
              ))}
            </optgroup>
            <optgroup label="Events">
              {(subjects ?? []).filter((s) => s.type === "event").map((s) => (
                <option key={s.id} value={`event:${s.id}`}>
                  {s.name} ({s.status})
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </section>

      {subject ? (
        <>
          <section className="pp-card">
            <h3>Sections of {subject.name}</h3>
            {rows.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {rows.map((r) => (
                  <li key={r.id} className="zq-result" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 0" }}>
                    <EditorialStatus status={r.status} />
                    <b>{SECTIONS.find((x) => x[0] === r.section)?.[1] ?? r.section}</b>
                    <span className="zq-meta">
                      {r.fact_key ? FACT_TITLE[r.fact_key as keyof typeof FACT_TITLE] : ""}
                      {r.step_role ? `Challenge ${r.step_group} · ${STEP_TITLE[r.step_role as keyof typeof STEP_TITLE]}` : ""} · {r.audience}
                    </span>
                    {r.status === "draft" ? (
                      <button
                        type="button"
                        className="zq-btn zq-btn-quiet zq-btn-sm"
                        onClick={async () => {
                          try {
                            await setStatus("story_section", r.id, "in_review");
                            say("ok", "Sent for review.");
                          } catch (x) {
                            say("err", (x as Error).message);
                          }
                          void loadRows();
                        }}
                      >
                        Send for review
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zq-meta">No sections yet.</p>
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
              if (audience !== "full" && !base) return say("err", "Choose the full section this version adapts.");
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
              })) ?? { error: { message: "Not configured" } };
              if (error) say("err", error.message);
              else {
                say("ok", "Saved as a draft.");
                (e.target as HTMLFormElement).reset();
                void loadRows();
              }
            }}
          >
            <h3>Write a section</h3>
            <div className="zq-field">
              <label htmlFor="se-section">Section</label>
              <select id="se-section" className="zq-input" value={section} onChange={(e) => setSection(e.target.value)}>
                {SECTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="zq-field">
              <label htmlFor="se-aud">Reading level</label>
              <select id="se-aud" className="zq-input" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="full">Full story (the reviewed source text)</option>
                <option value="young">Young learners (adapts a full section)</option>
                <option value="kids">Kids (adapts a full section)</option>
              </select>
              <span className="zq-help">Kids and young versions reuse the full section&apos;s claim: one set of reviewed evidence powers every level.</span>
            </div>
            {audience !== "full" ? (
              <div className="zq-field">
                <label htmlFor="se-base">Adapts this full section</label>
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
                <label htmlFor="se-fact">Fact</label>
                <select id="se-fact" name="fact_key" className="zq-input">
                  {FACT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {FACT_TITLE[k]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {section === "fact" ? (
              <>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="known" defaultChecked /> The Quran or the selected authentic Hadith establish this
                </label>
                <TextField label="Value (as the source states it)" id="se-value" name="value_text" maxLength={160} help="Leave empty and untick when not established; the page then says so. Never substitute an estimate." />
                <TextField label="Note" id="se-note" name="value_note" maxLength={300} help="e.g. what the figure does and does not cover." />
              </>
            ) : null}
            {section === "step" && audience === "full" ? (
              <>
                <TextField label="Challenge number" id="se-group" name="step_group" type="number" min={1} defaultValue="1" />
                <div className="zq-field">
                  <label htmlFor="se-role">Step</label>
                  <select id="se-role" name="step_role" className="zq-input">
                    {STEP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {STEP_TITLE[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            {["takeaway", "summary", "before_mission", "calling", "outcome", "scholarly_note"].includes(section) ? (
              <TextField label={section === "takeaway" ? "Lesson" : "Heading (optional)"} id="se-title" name="title" maxLength={160} required={section === "takeaway"} />
            ) : null}
            {section !== "fact" ? (
              <div className="zq-field" style={{ maxWidth: "none" }}>
                <label htmlFor="se-body">{section === "takeaway" ? "Meaning" : section === "reflection" ? "Question" : "Text (Markdown)"}</label>
                <textarea id="se-body" name="body_md" className="zq-textarea" style={{ minHeight: 160 }} required />
                <span className="zq-help">Only what the cited sources support. No invented dialogue, thoughts, motives, ages, places or dates.</span>
              </div>
            ) : null}
            {section === "takeaway" ? (
              <TextField label="Everyday example (shown as an educational application)" id="se-ex" name="everyday_example" required maxLength={1000} />
            ) : null}
            <TextField label="Position" id="se-pos" name="position" type="number" min={1} defaultValue="1" />
            {audience === "full" ? <TextField label="Claim id (the referenced claim this rests on)" id="se-claim" name="claim_id" required pattern="[0-9a-f-]{36}" dir="ltr" /> : null}
            <div>
              <button type="submit" className="zq-btn zq-btn-primary">
                Save draft
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
              })) ?? { error: { message: "Not configured" } };
              if (error) say("err", error.message);
              else say("ok", "Animation registered as a draft. A scholarly reviewer approves it before it appears.");
            }}
          >
            <h3>Register a symbolic animation</h3>
            <div className="zq-field">
              <label htmlFor="se-anim">Animation</label>
              <select id="se-anim" className="zq-input" value={anim} onChange={(e) => setAnim(e.target.value)}>
                {ANIMATION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ANIMATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ maxWidth: 420 }}>
              <AnimationPlayer animation={anim} caption="Preview" alt={ANIMATION_LABELS[anim] ?? anim} />
            </div>
            <TextField label="Caption" id="se-cap" name="caption" required maxLength={300} />
            <TextField label="Text alternative" id="se-alt" name="alt" required maxLength={500} help="Describe what is shown; say that no people are depicted." />
            <TextField label="Claim id the animation illustrates" id="se-mclaim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
            <div>
              <button type="submit" className="zq-btn zq-btn-secondary">
                Register draft
              </button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}

function QuizEditor({ subjectCol, subjectId, say }: { subjectCol: string; subjectId: string; say: (tone: "ok" | "err", text: string) => void }) {
  const sb = getBrowserSupabase();
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
      <h3>Quizzes</h3>
      <p className="zq-meta" style={{ margin: 0 }}>Every question rests on a reviewed claim. No points or rewards are shown to readers.</p>
      <form
        className="zq-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const { error } = (await sb?.from("story_quizzes").insert({ [subjectCol]: subjectId, title: String(f.get("title")), audience: String(f.get("audience")) })) ?? {
            error: { message: "Not configured" },
          };
          if (error) say("err", error.message);
          else {
            say("ok", "Quiz created as a draft.");
            void load();
          }
        }}
      >
        <TextField label="Quiz title" id="qz-title" name="title" required />
        <div className="zq-field">
          <label htmlFor="qz-aud">For</label>
          <select id="qz-aud" name="audience" className="zq-input" defaultValue="kids">
            <option value="kids">Kids</option>
            <option value="young">Young learners</option>
            <option value="full">Full story</option>
          </select>
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm">
            Create quiz
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
            })) ?? { error: { message: "Not configured" } };
            if (error) say("err", error.message);
            else {
              say("ok", "Question added.");
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
                    say("ok", "Quiz sent for review.");
                    void load();
                  } catch (x) {
                    say("err", (x as Error).message);
                  }
                }}
              >
                Send for review
              </button>
            ) : null}
          </p>
          {q.status === "draft" ? (
            <>
              <TextField label="Question" id={`qz-p-${q.id}`} name="prompt" required />
              <div className="zq-field" style={{ maxWidth: "none" }}>
                <label htmlFor={`qz-o-${q.id}`}>Options, one per line (2–5)</label>
                <textarea id={`qz-o-${q.id}`} name="options" className="zq-textarea" style={{ minHeight: 90 }} required />
              </div>
              <TextField label="Correct option number" id={`qz-c-${q.id}`} name="correct" type="number" min={1} max={5} required />
              <TextField label="Explanation (optional)" id={`qz-e-${q.id}`} name="explanation" />
              <TextField label="Position" id={`qz-n-${q.id}`} name="position" type="number" min={1} defaultValue="1" />
              <TextField label="Claim id" id={`qz-cl-${q.id}`} name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
              <div>
                <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm">
                  Add question
                </button>
              </div>
            </>
          ) : null}
        </form>
      ))}
    </section>
  );
}
