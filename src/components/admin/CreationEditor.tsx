"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, EvidenceLabel, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, TextField } from "@/components/ui/misc";
import { CREATION_VISUAL_LABELS } from "@/components/creation/CreationVisual";
import { CATEGORIES, EVIDENCE_CLASSES, EVIDENCE_KIND, FIELD_KEYS, ITEM_KINDS, ITEM_TABLES, VISUAL_KEYS, type EvidenceClass, type ItemKind } from "@/lib/data/creation-types";

/**
 * Creation Atlas editor. Editors write drafts; a scholarly reviewer approves each row in the review queue (entity type
 * 'creation'); the database refuses to publish without an approved claim and an approval ("no evidence, no review,
 * no publish"). Published rows are never edited in place: start a correction from the review queue.
 * Writing rules for editors: paraphrase from cited sources only; where the selected authentic sources say nothing,
 * record the field as "not established" instead of guessing.
 */

type Msg = { tone: "ok" | "err"; text: string } | null;
const sb = () => getBrowserSupabase();

async function setStatus(type: string, id: string, status: "in_review" | "published") {
  const r = await fetch("/api/admin/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType: type, entityId: id, status }) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
}

function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "zq-error" : "zq-help"}>
      {msg.text}
    </p>
  );
}

function StatusActions({ type, id, status, onDone }: { type: string; id: string; status: EditorialState; onDone: (m: Msg) => void }) {
  const run = async (s: "in_review" | "published", ok: string) => {
    try {
      await setStatus(type, id, s);
      onDone({ tone: "ok", text: ok });
    } catch (e) {
      onDone({ tone: "err", text: (e as Error).message });
    }
  };
  return (
    <>
      {status === "draft" || status === "rejected" ? (
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => run("in_review", "Sent for scholarly review.")}>
          Send for review
        </button>
      ) : null}
      {status === "in_review" || status === "approved" || status === "correction" ? (
        <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => run("published", "Published.")}>
          Publish
        </button>
      ) : null}
    </>
  );
}

interface ProfileRow {
  id: string;
  slug: string;
  category_id: string;
  name_en: string;
  name_ar: string;
  classification: string | null;
  status: EditorialState;
  version: number;
}
interface ItemRow {
  id: string;
  kind: ItemKind;
  position: number;
  title: string | null;
  body_md: string;
  known: boolean;
  evidence_class: EvidenceClass;
  claim_id: string | null;
  status: EditorialState;
  field_key?: string;
  question?: string;
  everyday_application?: string | null;
}

const KIND_LABEL: Record<ItemKind, string> = {
  characteristic: "Template field (origin, purpose, nature, …)",
  ability: "Ability",
  limitation: "Limitation",
  interaction: "Quranic event / interaction",
  lesson: "Lesson",
  misconception: "Misconception (question and answer)",
  source_reference: "Source reference",
};

export function CreationEditor({ canEdit }: { canEdit: boolean }) {
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [kind, setKind] = useState<ItemKind>("characteristic");
  const [evidence, setEvidence] = useState<EvidenceClass>("revelation");
  const [editing, setEditing] = useState<ItemRow | null>(null);

  const loadProfiles = useCallback(async () => {
    const c = sb();
    if (!c) return setMsg({ tone: "err", text: "Not configured" });
    const { data, error } = await c.from("creation_profiles").select("id, slug, category_id, name_en, name_ar, classification, status, version").order("name_en");
    if (error) return setMsg({ tone: "err", text: error.message });
    setProfiles((data ?? []) as ProfileRow[]);
  }, []);
  const loadItems = useCallback(async (pid: string) => {
    const c = sb();
    if (!c || !pid) return setItems([]);
    const res = await Promise.all(
      ITEM_KINDS.map((k) =>
        c
          .from(ITEM_TABLES[k])
          .select(`id, position, title, body_md, known, evidence_class, claim_id, status${k === "characteristic" ? ", field_key" : k === "misconception" ? ", question" : k === "lesson" ? ", everyday_application" : ""}`)
          .eq("profile_id", pid)
          .order("position"),
      ),
    );
    setItems(res.flatMap((r, i) => ((r.data ?? []) as unknown as Omit<ItemRow, "kind">[]).map((x) => ({ ...x, kind: ITEM_KINDS[i]! }))));
  }, []);
  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);
  useEffect(() => {
    void loadItems(selected);
  }, [selected, loadItems]);

  const after = (m: Msg) => {
    setMsg(m);
    void loadProfiles();
    void loadItems(selected);
  };
  const profile = profiles?.find((p) => p.id === selected);

  return (
    <div className="cr-admin">
      <Feedback msg={msg} />

      <section aria-labelledby="cra-profiles">
        <h2 id="cra-profiles" className="zq-eyebrow">
          Profiles
        </h2>
        {profiles && !profiles.length ? <EmptyState title="No creation profiles yet." /> : null}
        <ul className="cr-admin-list">
          {(profiles ?? []).map((p) => (
            <li key={p.id} className="cr-admin-row">
              <EditorialStatus status={p.status} />
              <p>
                <b>{p.name_en}</b>{" "}
                <span lang="ar" dir="rtl">
                  {p.name_ar}
                </span>{" "}
                <span className="zq-order">/creation/{p.slug}</span> <span className="zq-meta">v{p.version}</span>
              </p>
              <button type="button" className="zq-btn zq-btn-quiet zq-btn-sm" aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}>
                {selected === p.id ? "Editing" : "Edit entries"}
              </button>
              {canEdit ? <StatusActions type="creation_profile" id={p.id} status={p.status} onDone={after} /> : null}
            </li>
          ))}
        </ul>
      </section>

      {canEdit ? (
        <form
          className="zq-form pp-card"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const g = (k: string) => String(f.get(k) ?? "").trim();
            const c = sb();
            const me = (await c?.auth.getUser())?.data.user?.id;
            const res = await c?.from("creation_profiles").insert({ category_id: g("category"), slug: g("slug"), name_en: g("name_en"), name_ar: g("name_ar"), classification: g("classification") || null, created_by: me });
            if (!res) return setMsg({ tone: "err", text: "Not configured" });
            if (res.error) return setMsg({ tone: "err", text: res.error.message });
            (e.target as HTMLFormElement).reset();
            after({ tone: "ok", text: "Profile created as a draft. Add its entries, then send each one for review." });
          }}
        >
          <h3>New profile</h3>
          <div className="zq-field">
            <label htmlFor="crp-cat">Category</label>
            <select id="crp-cat" name="category" className="zq-input">
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label="Address (slug)"
            id="crp-slug"
            name="slug"
            required
            pattern="[a-z0-9-]{2,60}"
            dir="ltr"
            help="Lowercase letters, numbers and hyphens. A profile whose address is the category (humans, jinn, angels) is that category's overview and feeds the comparison."
          />
          <TextField label="Name (English)" id="crp-en" name="name_en" required />
          <TextField label="Name (Arabic)" id="crp-ar" name="name_ar" required dir="rtl" lang="ar" />
          <TextField label="Classification" id="crp-class" name="classification" help="Leave empty when the sources do not establish it; the page then says so." />
          <div>
            <button type="submit" className="zq-btn zq-btn-primary">
              Create draft profile
            </button>
          </div>
        </form>
      ) : null}

      {profile ? (
        <section aria-labelledby="cra-entries" style={{ display: "grid", gap: 16 }}>
          <h2 id="cra-entries" className="zq-eyebrow">
            Entries of {profile.name_en}
          </h2>
          {!items.length ? <EmptyState title="No entries yet." /> : null}
          <ul className="cr-admin-list">
            {items.map((it) => (
              <li key={it.id} className="cr-admin-row">
                <EditorialStatus status={it.status} />
                <EvidenceLabel kind={EVIDENCE_KIND[it.evidence_class]} />
                <p>
                  <b>
                    {it.kind.replace(/_/g, " ")}
                    {it.field_key ? ` · ${it.field_key.replace(/_/g, " ")}` : ""}
                  </b>{" "}
                  {it.question ? `${it.question} — ` : it.title ? `${it.title} — ` : ""}
                  {it.known ? it.body_md.slice(0, 160) : "Not established by the selected authentic sources."}
                </p>
                {canEdit && it.status !== "published" ? (
                  <button
                    type="button"
                    className="zq-btn zq-btn-quiet zq-btn-sm"
                    onClick={() => {
                      setEditing(it);
                      setKind(it.kind);
                      setEvidence(it.evidence_class);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {canEdit ? <StatusActions type={`creation_${it.kind}`} id={it.id} status={it.status} onDone={after} /> : null}
              </li>
            ))}
          </ul>

          {canEdit ? (
            <form
              key={editing?.id ?? "new"}
              className="zq-form pp-card"
              style={{ maxWidth: 720 }}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const g = (k: string) => String(f.get(k) ?? "").trim();
                const known = evidence !== "not_established";
                const row: Record<string, unknown> = {
                  position: Number(g("position") || 1),
                  title: g("title") || null,
                  body_md: known ? g("body") : "",
                  known,
                  evidence_class: evidence,
                  claim_id: known ? g("claim") : null,
                };
                if (kind === "characteristic") row.field_key = g("field_key");
                if (kind === "misconception") row.question = g("question");
                if (kind === "lesson") row.everyday_application = g("everyday") || null;
                const c = sb();
                if (!c) return setMsg({ tone: "err", text: "Not configured" });
                const me = (await c.auth.getUser()).data.user?.id;
                const res = editing ? await c.from(ITEM_TABLES[kind]).update(row).eq("id", editing.id) : await c.from(ITEM_TABLES[kind]).insert({ ...row, profile_id: profile.id, created_by: me });
                if (res.error) return setMsg({ tone: "err", text: res.error.message });
                setEditing(null);
                (e.target as HTMLFormElement).reset();
                after({ tone: "ok", text: editing ? "Draft updated (its version was raised)." : "Entry saved as a draft. Send it for review when it is ready." });
              }}
            >
              <h3>{editing ? "Edit draft entry" : "Add an entry"}</h3>
              <div className="zq-field">
                <label htmlFor="cre-kind">Kind</label>
                <select id="cre-kind" className="zq-input" value={kind} disabled={Boolean(editing)} onChange={(e) => setKind(e.target.value as ItemKind)}>
                  {ITEM_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              {kind === "characteristic" ? (
                <div className="zq-field">
                  <label htmlFor="cre-field">Template field</label>
                  <select id="cre-field" name="field_key" className="zq-input" defaultValue={editing?.field_key ?? "origin"}>
                    {FIELD_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {kind === "misconception" ? <TextField label="Question" id="cre-q" name="question" required defaultValue={editing?.question ?? ""} /> : null}
              <TextField label="Title (optional)" id="cre-title" name="title" defaultValue={editing?.title ?? ""} />
              <div className="zq-field">
                <label htmlFor="cre-ev">Evidence class</label>
                <select id="cre-ev" className="zq-input" value={evidence} onChange={(e) => setEvidence(e.target.value as EvidenceClass)}>
                  {EVIDENCE_CLASSES.map((k) => (
                    <option key={k} value={k}>
                      {k.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <span className="zq-help">“Not established” records that the selected authentic sources say nothing: no text and no claim are stored.</span>
              </div>
              {evidence !== "not_established" ? (
                <>
                  <div className="zq-field" style={{ maxWidth: "none" }}>
                    <label htmlFor="cre-body">Text (Markdown)</label>
                    <textarea id="cre-body" name="body" className="zq-textarea" required defaultValue={editing?.body_md ?? ""} style={{ minHeight: 160 }} />
                    <span className="zq-help">Paraphrase the cited source; never paste an unlicensed translation.</span>
                  </div>
                  <TextField label="Claim id" id="cre-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" defaultValue={editing?.claim_id ?? ""} help="The approved claim (with its references) this entry rests on." />
                </>
              ) : null}
              {kind === "lesson" ? <TextField label="Everyday application (optional)" id="cre-every" name="everyday" defaultValue={editing?.everyday_application ?? ""} /> : null}
              <TextField label="Position" id="cre-pos" name="position" type="number" min={1} defaultValue={editing?.position ?? 1} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="submit" className="zq-btn zq-btn-primary">
                  {editing ? "Save draft" : "Add draft entry"}
                </button>
                {editing ? (
                  <button type="button" className="zq-btn zq-btn-quiet" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {canEdit ? <LinkedContent profiles={profiles ?? []} onDone={after} /> : null}
    </div>
  );
}

const NODE_KINDS = ["creation", "person", "event", "command", "community", "concept"] as const;

/** Relationships, stories and visual assets: each saved as a draft and reviewed under 'creation'. */
function LinkedContent({ profiles, onDone }: { profiles: ProfileRow[]; onDone: (m: Msg) => void }) {
  const [rows, setRows] = useState<Array<{ id: string; type: string; status: EditorialState; label: string }>>([]);
  const [visualMode, setVisualMode] = useState<"animation" | "asset">("animation");
  const load = useCallback(async () => {
    const c = sb();
    if (!c) return;
    const [r, s, v] = await Promise.all([
      c.from("creation_relationships").select("id, status, from_kind, from_ref, relation, to_kind, to_ref").order("created_at", { ascending: false }).limit(100),
      c.from("creation_stories").select("id, status, slug, title").order("created_at", { ascending: false }).limit(100),
      c.from("creation_visual_assets").select("id, status, kind, animation_key, alt_text").order("created_at", { ascending: false }).limit(100),
    ]);
    setRows([
      ...((r.data ?? []) as Array<{ id: string; status: EditorialState; from_kind: string; from_ref: string; relation: string; to_kind: string; to_ref: string }>).map((x) => ({
        id: x.id,
        type: "creation_relationship",
        status: x.status,
        label: `Relationship: ${x.from_kind}:${x.from_ref} — ${x.relation} → ${x.to_kind}:${x.to_ref}`,
      })),
      ...((s.data ?? []) as Array<{ id: string; status: EditorialState; slug: string; title: string }>).map((x) => ({ id: x.id, type: "creation_story", status: x.status, label: `Story: ${x.title} (${x.slug})` })),
      ...((v.data ?? []) as Array<{ id: string; status: EditorialState; kind: string; animation_key: string | null; alt_text: string }>).map((x) => ({
        id: x.id,
        type: "creation_visual",
        status: x.status,
        label: `Visual (${x.kind}${x.animation_key ? `: ${x.animation_key}` : ""}): ${x.alt_text}`,
      })),
    ]);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const done = (m: Msg) => {
    onDone(m);
    void load();
  };
  const save = async (e: React.FormEvent<HTMLFormElement>, table: string, row: Record<string, unknown>, ok: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await sb()?.from(table).insert(row);
    if (!res) return done({ tone: "err", text: "Not configured" });
    if (res.error) return done({ tone: "err", text: res.error.message });
    form.reset();
    done({ tone: "ok", text: ok });
  };
  const val = (e: React.FormEvent<HTMLFormElement>, k: string) => String(new FormData(e.currentTarget).get(k) ?? "").trim();

  return (
    <section aria-labelledby="cra-linked" style={{ display: "grid", gap: 16 }}>
      <h2 id="cra-linked" className="zq-eyebrow">
        Relationships, stories and visuals
      </h2>
      <ul className="cr-admin-list">
        {rows.map((r) => (
          <li key={r.id} className="cr-admin-row">
            <EditorialStatus status={r.status} />
            <p>{r.label}</p>
            <StatusActions type={r.type} id={r.id} status={r.status} onDone={done} />
          </li>
        ))}
      </ul>

      <form
        className="zq-form pp-card"
        onSubmit={(e) =>
          save(
            e,
            "creation_relationships",
            {
              from_kind: val(e, "from_kind"),
              from_ref: val(e, "from_ref"),
              relation: val(e, "relation"),
              to_kind: val(e, "to_kind"),
              to_ref: val(e, "to_ref"),
              claim_id: val(e, "claim"),
              evidence_class: val(e, "evidence"),
            },
            "Relationship saved as a draft.",
          )
        }
      >
        <h3>Add a relationship</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          For a creation, use its profile address (slug). Every relationship needs an approved claim.
        </p>
        {(["from", "to"] as const).map((side) => (
          <fieldset key={side} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend className="zq-eyebrow">{side === "from" ? "From" : "To"}</legend>
            <div className="zq-field">
              <label htmlFor={`crr-${side}-kind`}>Kind</label>
              <select id={`crr-${side}-kind`} name={`${side}_kind`} className="zq-input">
                {NODE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <TextField label="Reference (slug or id)" id={`crr-${side}-ref`} name={`${side}_ref`} required dir="ltr" />
          </fieldset>
        ))}
        <TextField label="Relation (2–80 characters)" id="crr-rel" name="relation" required minLength={2} maxLength={80} />
        <TextField label="Claim id" id="crr-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="crr-ev">Evidence class</label>
          <select id="crr-ev" name="evidence" className="zq-input">
            {EVIDENCE_CLASSES.filter((k) => k !== "not_established").map((k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Save relationship draft
          </button>
        </div>
      </form>

      <form
        className="zq-form pp-card"
        onSubmit={(e) =>
          save(
            e,
            "creation_stories",
            {
              profile_id: val(e, "profile") || null,
              slug: val(e, "slug"),
              title: val(e, "title"),
              title_ar: val(e, "title_ar") || null,
              summary: val(e, "summary") || null,
              claim_id: val(e, "claim") || null,
              script_id: val(e, "script") || null,
            },
            "Story saved as a draft.",
          )
        }
      >
        <h3>Add a story</h3>
        <div className="zq-field">
          <label htmlFor="crs-profile">Profile</label>
          <select id="crs-profile" name="profile" className="zq-input">
            <option value="">None</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_en}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Address (slug)" id="crs-slug" name="slug" required pattern="[a-z0-9-]{2,60}" dir="ltr" />
        <TextField label="Title" id="crs-title" name="title" required />
        <TextField label="Arabic title" id="crs-ar" name="title_ar" dir="rtl" lang="ar" />
        <TextField label="Summary" id="crs-sum" name="summary" />
        <TextField label="Claim id" id="crs-claim" name="claim" pattern="[0-9a-f-]{36}" dir="ltr" />
        <TextField label="Story script id (narration)" id="crs-script" name="script" pattern="[0-9a-f-]{36}" dir="ltr" help="Optional: the story-engine script that narrates it." />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Save story draft
          </button>
        </div>
      </form>

      <form
        className="zq-form pp-card"
        onSubmit={(e) =>
          save(
            e,
            "creation_visual_assets",
            {
              profile_id: val(e, "profile") || null,
              story_id: val(e, "story") || null,
              kind: val(e, "kind"),
              animation_key: visualMode === "animation" ? val(e, "animation") : null,
              asset_id: visualMode === "asset" ? val(e, "asset") : null,
              alt_text: val(e, "alt"),
            },
            "Visual saved as a draft. It needs a reviewer's approval before it can be published.",
          )
        }
      >
        <h3>Add a visual</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          Abstract, environmental, calligraphic or diagrammatic only. Never a figure of a prophet, an angel, a jinn, Iblis or anything unseen, and nothing frightening.
        </p>
        <div className="zq-field">
          <label htmlFor="crv-profile">Profile</label>
          <select id="crv-profile" name="profile" className="zq-input">
            <option value="">None</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_en}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Story id (optional)" id="crv-story" name="story" pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="crv-kind">Kind</label>
          <select id="crv-kind" name="kind" className="zq-input">
            {["abstract", "environmental", "diagram", "calligraphic"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="crv-mode">Source</label>
          <select id="crv-mode" className="zq-input" value={visualMode} onChange={(e) => setVisualMode(e.target.value as "animation" | "asset")}>
            <option value="animation">Built-in animation</option>
            <option value="asset">Uploaded asset</option>
          </select>
        </div>
        {visualMode === "animation" ? (
          <div className="zq-field">
            <label htmlFor="crv-anim">Animation</label>
            <select id="crv-anim" name="animation" className="zq-input">
              {VISUAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {CREATION_VISUAL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <TextField label="Asset id" id="crv-asset" name="asset" required pattern="[0-9a-f-]{36}" dir="ltr" />
        )}
        <TextField label="Alternative text" id="crv-alt" name="alt" required minLength={3} />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            Save visual draft
          </button>
        </div>
      </form>
    </section>
  );
}
