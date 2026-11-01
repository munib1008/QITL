"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EditorialStatus, EvidenceLabel, type EditorialState } from "@/components/ui/evidence";
import { EmptyState, TextField } from "@/components/ui/misc";
import { CREATION_VISUAL_LABELS } from "@/components/creation/CreationVisual";
import { useLocale } from "@/lib/i18n/useLocale";
import { englishContent } from "@/lib/i18n/locales";
import { creationStrings } from "@/lib/i18n/modules/creation";
import { adminCreationStrings } from "@/lib/i18n/modules/adminCreation";
import { AdminFeedback as Feedback, errMsg, type AdminMsg as Msg } from "./feedback";
import { CATEGORIES, EVIDENCE_CLASSES, EVIDENCE_KIND, FIELD_KEYS, ITEM_KINDS, ITEM_TABLES, VISUAL_KEYS, type EvidenceClass, type ItemKind } from "@/lib/data/creation-types";

/**
 * Creation Atlas editor. Editors write drafts; a scholarly reviewer approves each row in the review queue (entity type
 * 'creation'); the database refuses to publish without an approved claim and an approval ("no evidence, no review,
 * no publish"). Published rows are never edited in place: start a correction from the review queue.
 * Writing rules for editors: paraphrase from cited sources only; where the selected authentic sources say nothing,
 * record the field as "not established" instead of guessing.
 */

const sb = () => getBrowserSupabase();

async function setStatus(type: string, id: string, status: "in_review" | "published") {
  const r = await fetch("/api/admin/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType: type, entityId: id, status }) });
  const d = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
}

function StatusActions({ type, id, status, onDone }: { type: string; id: string; status: EditorialState; onDone: (m: Msg) => void }) {
  const locale = useLocale();
  const t = useMemo(() => adminCreationStrings(locale), [locale]);
  const run = async (s: "in_review" | "published", ok: string) => {
    try {
      await setStatus(type, id, s);
      onDone({ tone: "ok", text: ok });
    } catch (e) {
      onDone(errMsg(locale, t.failedPrefix, (e as Error).message, t.notConfigured));
    }
  };
  return (
    <>
      {status === "draft" || status === "rejected" ? (
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" onClick={() => run("in_review", t.sentScholarly)}>
          {t.sendForReview}
        </button>
      ) : null}
      {status === "in_review" || status === "approved" || status === "correction" ? (
        <button type="button" className="zq-btn zq-btn-primary zq-btn-sm" onClick={() => run("published", t.okPublished)}>
          {t.publish}
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

export function CreationEditor({ canEdit }: { canEdit: boolean }) {
  const locale = useLocale();
  const t = useMemo(() => adminCreationStrings(locale), [locale]);
  const cs = useMemo(() => creationStrings(locale), [locale]);
  const evName = (k: string) => (cs.evidence as Record<string, string>)[k] ?? k.replace(/_/g, " ");
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [kind, setKind] = useState<ItemKind>("characteristic");
  const [evidence, setEvidence] = useState<EvidenceClass>("revelation");
  const [editing, setEditing] = useState<ItemRow | null>(null);

  const loadProfiles = useCallback(async () => {
    const c = sb();
    if (!c) return setMsg({ tone: "err", text: t.notConfigured });
    const { data, error } = await c.from("creation_profiles").select("id, slug, category_id, name_en, name_ar, classification, status, version").order("name_en");
    if (error) return setMsg(errMsg(locale, t.failedPrefix, error.message, t.notConfigured));
    setProfiles((data ?? []) as ProfileRow[]);
  }, [locale, t]);
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
          {t.profiles}
        </h2>
        {profiles && !profiles.length ? <EmptyState title={t.noProfiles} /> : null}
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
                {selected === p.id ? t.editing : t.editEntries}
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
            if (!res) return setMsg({ tone: "err", text: t.notConfigured });
            if (res.error) return setMsg(errMsg(locale, t.failedPrefix, res.error.message, t.notConfigured));
            (e.target as HTMLFormElement).reset();
            after({ tone: "ok", text: t.profileCreated });
          }}
        >
          <h3>{t.newProfile}</h3>
          <div className="zq-field">
            <label htmlFor="crp-cat">{t.category}</label>
            <select id="crp-cat" name="category" className="zq-input">
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "en" ? c.nameEn : c.nameAr}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label={t.slug}
            id="crp-slug"
            name="slug"
            required
            pattern="[a-z0-9-]{2,60}"
            dir="ltr"
            help={t.slugHelp}
          />
          <TextField label={t.nameEn} id="crp-en" name="name_en" required />
          <TextField label={t.nameAr} id="crp-ar" name="name_ar" required dir="rtl" lang="ar" />
          <TextField label={t.classification} id="crp-class" name="classification" help={t.classificationHelp} />
          <div>
            <button type="submit" className="zq-btn zq-btn-primary">
              {t.createDraftProfile}
            </button>
          </div>
        </form>
      ) : null}

      {profile ? (
        <section aria-labelledby="cra-entries" style={{ display: "grid", gap: 16 }}>
          <h2 id="cra-entries" className="zq-eyebrow">
            {t.entriesOf} {profile.name_en}
          </h2>
          {!items.length ? <EmptyState title={t.noEntries} /> : null}
          <ul className="cr-admin-list">
            {items.map((it) => (
              <li key={it.id} className="cr-admin-row">
                <EditorialStatus status={it.status} />
                <EvidenceLabel kind={EVIDENCE_KIND[it.evidence_class]} />
                <p>
                  <b>
                    {t.kindShort[it.kind] ?? it.kind.replace(/_/g, " ")}
                    {it.field_key ? ` · ${t.fieldKeys[it.field_key] ?? it.field_key.replace(/_/g, " ")}` : ""}
                  </b>{" "}
                  {it.question ? `${it.question} — ` : it.title ? `${it.title} — ` : ""}
                  {it.known ? it.body_md.slice(0, 160) : t.notEstablishedSources}
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
                    {t.edit}
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
                if (!c) return setMsg({ tone: "err", text: t.notConfigured });
                const me = (await c.auth.getUser()).data.user?.id;
                const res = editing ? await c.from(ITEM_TABLES[kind]).update(row).eq("id", editing.id) : await c.from(ITEM_TABLES[kind]).insert({ ...row, profile_id: profile.id, created_by: me });
                if (res.error) return setMsg(errMsg(locale, t.failedPrefix, res.error.message, t.notConfigured));
                setEditing(null);
                (e.target as HTMLFormElement).reset();
                after({ tone: "ok", text: editing ? t.draftUpdated : t.entrySaved });
              }}
            >
              <h3>{editing ? t.editDraftEntry : t.addEntry}</h3>
              <div className="zq-field">
                <label htmlFor="cre-kind">{t.kind}</label>
                <select id="cre-kind" className="zq-input" value={kind} disabled={Boolean(editing)} onChange={(e) => setKind(e.target.value as ItemKind)}>
                  {ITEM_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t.kindLong[k] ?? k}
                    </option>
                  ))}
                </select>
              </div>
              {kind === "characteristic" ? (
                <div className="zq-field">
                  <label htmlFor="cre-field">{t.templateField}</label>
                  <select id="cre-field" name="field_key" className="zq-input" defaultValue={editing?.field_key ?? "origin"}>
                    {FIELD_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {t.fieldKeys[k] ?? k.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {kind === "misconception" ? <TextField label={t.question} id="cre-q" name="question" required defaultValue={editing?.question ?? ""} /> : null}
              <TextField label={t.titleOptional} id="cre-title" name="title" defaultValue={editing?.title ?? ""} />
              <div className="zq-field">
                <label htmlFor="cre-ev">{t.evidenceClass}</label>
                <select id="cre-ev" className="zq-input" value={evidence} onChange={(e) => setEvidence(e.target.value as EvidenceClass)}>
                  {EVIDENCE_CLASSES.map((k) => (
                    <option key={k} value={k}>
                      {evName(k)}
                    </option>
                  ))}
                </select>
                <span className="zq-help">{t.notEstablishedHelp}</span>
              </div>
              {evidence !== "not_established" ? (
                <>
                  <div className="zq-field" style={{ maxWidth: "none" }}>
                    <label htmlFor="cre-body">{t.textMd}</label>
                    <textarea id="cre-body" name="body" className="zq-textarea" required defaultValue={editing?.body_md ?? ""} style={{ minHeight: 160 }} />
                    <span className="zq-help">{t.textHelp}</span>
                  </div>
                  <TextField label={t.claimId} id="cre-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" defaultValue={editing?.claim_id ?? ""} help={t.claimHelp} />
                </>
              ) : null}
              {kind === "lesson" ? <TextField label={t.everyday} id="cre-every" name="everyday" defaultValue={editing?.everyday_application ?? ""} /> : null}
              <TextField label={t.position} id="cre-pos" name="position" type="number" min={1} defaultValue={editing?.position ?? 1} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="submit" className="zq-btn zq-btn-primary">
                  {editing ? t.saveDraft : t.addDraftEntry}
                </button>
                {editing ? (
                  <button type="button" className="zq-btn zq-btn-quiet" onClick={() => setEditing(null)}>
                    {t.cancel}
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
  const locale = useLocale();
  const t = useMemo(() => adminCreationStrings(locale), [locale]);
  const cs = useMemo(() => creationStrings(locale), [locale]);
  const evName = (k: string) => (cs.evidence as Record<string, string>)[k] ?? k.replace(/_/g, " ");
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
        label: t.relLabel(`${x.from_kind}:${x.from_ref}`, x.relation, `${x.to_kind}:${x.to_ref}`),
      })),
      ...((s.data ?? []) as Array<{ id: string; status: EditorialState; slug: string; title: string }>).map((x) => ({ id: x.id, type: "creation_story", status: x.status, label: t.storyLabel(x.title, x.slug) })),
      ...((v.data ?? []) as Array<{ id: string; status: EditorialState; kind: string; animation_key: string | null; alt_text: string }>).map((x) => ({
        id: x.id,
        type: "creation_visual",
        status: x.status,
        label: t.visualLabel(`${t.visualKinds[x.kind] ?? x.kind}${x.animation_key ? `: ${x.animation_key}` : ""}`, x.alt_text),
      })),
    ]);
  }, [t]);
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
    if (!res) return done({ tone: "err", text: t.notConfigured });
    if (res.error) return done(errMsg(locale, t.failedPrefix, res.error.message, t.notConfigured));
    form.reset();
    done({ tone: "ok", text: ok });
  };
  const val = (e: React.FormEvent<HTMLFormElement>, k: string) => String(new FormData(e.currentTarget).get(k) ?? "").trim();

  return (
    <section aria-labelledby="cra-linked" style={{ display: "grid", gap: 16 }}>
      <h2 id="cra-linked" className="zq-eyebrow">
        {t.linkedHeading}
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
            t.relSaved,
          )
        }
      >
        <h3>{t.addRelationship}</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.relHelp}
        </p>
        {(["from", "to"] as const).map((side) => (
          <fieldset key={side} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend className="zq-eyebrow">{side === "from" ? t.from : t.to}</legend>
            <div className="zq-field">
              <label htmlFor={`crr-${side}-kind`}>{t.kind}</label>
              <select id={`crr-${side}-kind`} name={`${side}_kind`} className="zq-input">
                {NODE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {(cs.graph.kinds as Record<string, string>)[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
            <TextField label={t.refSlugOrId} id={`crr-${side}-ref`} name={`${side}_ref`} required dir="ltr" />
          </fieldset>
        ))}
        <TextField label={t.relationText} id="crr-rel" name="relation" required minLength={2} maxLength={80} />
        <TextField label={t.claimId} id="crr-claim" name="claim" required pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="crr-ev">{t.evidenceClass}</label>
          <select id="crr-ev" name="evidence" className="zq-input">
            {EVIDENCE_CLASSES.filter((k) => k !== "not_established").map((k) => (
              <option key={k} value={k}>
                {evName(k)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.saveRelDraft}
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
            t.storySaved,
          )
        }
      >
        <h3>{t.addStory}</h3>
        <div className="zq-field">
          <label htmlFor="crs-profile">{t.profile}</label>
          <select id="crs-profile" name="profile" className="zq-input">
            <option value="">{t.none}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_en}
              </option>
            ))}
          </select>
        </div>
        <TextField label={t.slug} id="crs-slug" name="slug" required pattern="[a-z0-9-]{2,60}" dir="ltr" />
        <TextField label={t.title} id="crs-title" name="title" required />
        <TextField label={t.arabicTitle} id="crs-ar" name="title_ar" dir="rtl" lang="ar" />
        <TextField label={t.summary} id="crs-sum" name="summary" />
        <TextField label={t.claimId} id="crs-claim" name="claim" pattern="[0-9a-f-]{36}" dir="ltr" />
        <TextField label={t.scriptId} id="crs-script" name="script" pattern="[0-9a-f-]{36}" dir="ltr" help={t.scriptHelp} />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.saveStoryDraft}
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
            t.visualSaved,
          )
        }
      >
        <h3>{t.addVisual}</h3>
        <p className="zq-meta" style={{ margin: 0 }}>
          {t.visualRule}
        </p>
        <div className="zq-field">
          <label htmlFor="crv-profile">{t.profile}</label>
          <select id="crv-profile" name="profile" className="zq-input">
            <option value="">{t.none}</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_en}
              </option>
            ))}
          </select>
        </div>
        <TextField label={t.storyIdOptional} id="crv-story" name="story" pattern="[0-9a-f-]{36}" dir="ltr" />
        <div className="zq-field">
          <label htmlFor="crv-kind">{t.kind}</label>
          <select id="crv-kind" name="kind" className="zq-input">
            {["abstract", "environmental", "diagram", "calligraphic"].map((k) => (
              <option key={k} value={k}>
                {t.visualKinds[k] ?? k}
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="crv-mode">{t.source}</label>
          <select id="crv-mode" className="zq-input" value={visualMode} onChange={(e) => setVisualMode(e.target.value as "animation" | "asset")}>
            <option value="animation">{t.builtIn}</option>
            <option value="asset">{t.uploaded}</option>
          </select>
        </div>
        {visualMode === "animation" ? (
          <div className="zq-field">
            <label htmlFor="crv-anim">{t.animation}</label>
            <select id="crv-anim" name="animation" className="zq-input">
              {VISUAL_KEYS.map((k) => (
                <option key={k} value={k} {...englishContent(locale)}>
                  {CREATION_VISUAL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <TextField label={t.assetId} id="crv-asset" name="asset" required pattern="[0-9a-f-]{36}" dir="ltr" />
        )}
        <TextField label={t.altText} id="crv-alt" name="alt" required minLength={3} />
        <div>
          <button type="submit" className="zq-btn zq-btn-primary">
            {t.saveVisualDraft}
          </button>
        </div>
      </form>
    </section>
  );
}
