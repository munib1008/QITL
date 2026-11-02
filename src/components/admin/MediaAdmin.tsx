"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useLocale } from "@/lib/i18n/useLocale";
import { englishContent } from "@/lib/i18n/locales";
import { adminMediaStrings } from "@/lib/i18n/modules/adminMedia";
import { AdminFeedback as Feedback, ServerText, errMsg, type AdminMsg } from "./feedback";
import { MEDIA_CATEGORIES, NON_FIGURATIVE_ITEMS, VIDEO_CONFIRMATION, type MediaMetadata } from "@/lib/media/validate";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, MIN_VIDEO_DESCRIPTION } from "@/lib/media/video";
import { folderOf, type MediaVariant } from "@/lib/media/render";
import { AttachMedia } from "./AttachMedia";

interface AssetRow {
  id: string;
  status: string;
  kind: string;
  category: string;
  alt_text: string;
  alt_text_ar: string | null;
  alt_text_ur: string | null;
  caption_en: string | null;
  caption_ar: string | null;
  caption_ur: string | null;
  credit: string;
  source_id: string;
  permission_id: string | null;
  file_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  published_at: string | null;
  updated_at: string;
}
interface FileRow {
  id: string;
  asset_id: string;
  version: number;
  storage_path: string;
  mime_type: string;
  bytes: number;
  width: number;
  height: number;
  variants: MediaVariant[];
  sanitised: boolean;
  state: string;
  scan_status: string;
  scan_engine: string | null;
  non_figurative_confirmed: boolean;
  created_by: string | null;
  created_at: string;
}
interface SourceRow {
  id: string;
  work: string;
  rights_status: string;
}
interface PermRow {
  permission_id: string;
  source_id: string;
  scope: string;
  status: string;
  allowed: boolean;
}
interface ReviewRow {
  entity_id: string;
  decision: string;
  comment: string | null;
  created_at: string;
}
interface UsageRow {
  asset_id: string;
  module: string;
  entity_type: string;
  entity_id: string;
  role: string;
  status: string | null;
}
interface CleanupItem {
  key: string;
  kind: "file_version" | "orphan_folder";
  path: string;
  reason: string;
}

type Msg = AdminMsg;

function fail(locale: string, t: { failedPrefix: string }, error: unknown, fallback: string): NonNullable<AdminMsg> {
  return error ? errMsg(locale, t.failedPrefix, String(error)) : { tone: "err", text: fallback };
}
type Flags = { isEditor: boolean; isReviewer: boolean; isAdmin: boolean; scannerConfigured: boolean; serviceConfigured: boolean };

const STATUS_FILTERS = ["all", "draft", "in_review", "approved", "published", "correction", "rejected", "archived"] as const;
const EMPTY_META: MediaMetadata = { altText: "", altTextAr: null, altTextUr: null, captionEn: null, captionAr: null, captionUr: null, category: "pattern", kind: "image", credit: "", sourceId: "", permissionId: null };
const ALL_CONFIRMED = Object.fromEntries(NON_FIGURATIVE_ITEMS.map(([k]) => [k, true]));
const VIDEO_CONFIRMED = { ...ALL_CONFIRMED, [VIDEO_CONFIRMATION[0]]: true };
const FILE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/webm,video/mp4,.webm,.mp4";
const isVideoMime = (mime: string) => mime.startsWith("video/");
/** Client-side guess for which form fields to show; the server decides by the file's bytes. */
const looksLikeVideo = (f: File | undefined | null) => Boolean(f && (f.type.startsWith("video/") || /\.(webm|mp4)$/i.test(f.name)));

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

/**
 * The Media Library. Every action goes through /api/admin/media (role check) and the database guards, which refuse
 * anything out of order: a version needs a resolved scan, the non-figurative confirmation and an approving religious
 * review before approval; publishing needs approval and moves the files out of pending/.
 */
export function MediaAdmin(flags: Flags) {
  const sb = getBrowserSupabase();
  const locale = useLocale();
  const t = useMemo(() => adminMediaStrings(locale), [locale]);
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sb) return;
    const [a, s, p] = await Promise.all([
      sb.from("assets").select("id, status, kind, category, alt_text, alt_text_ar, alt_text_ur, caption_en, caption_ar, caption_ur, credit, source_id, permission_id, file_id, created_by, approved_by, published_at, updated_at").order("updated_at", { ascending: false }).limit(200),
      sb.from("sources").select("id, work, rights_status").order("work"),
      sb.from("content_licence_registry").select("permission_id, source_id, scope, status, allowed").eq("asset_type", "image"),
    ]);
    const rows = (a.data ?? []) as AssetRow[];
    setAssets(rows);
    setSources((s.data ?? []) as SourceRow[]);
    setPerms((p.data ?? []) as PermRow[]);
    const ids = rows.map((r) => r.id);
    if (!ids.length) {
      setFiles([]);
      setReviews([]);
      setUsage([]);
      return;
    }
    const [f, u] = await Promise.all([
      sb.from("asset_files").select("id, asset_id, version, storage_path, mime_type, bytes, width, height, variants, sanitised, state, scan_status, scan_engine, non_figurative_confirmed, created_by, created_at").in("asset_id", ids).order("version", { ascending: false }),
      sb.from("asset_usage").select("asset_id, module, entity_type, entity_id, role, status").in("asset_id", ids),
    ]);
    const fileRows = (f.data ?? []) as FileRow[];
    setFiles(fileRows);
    setUsage((u.data ?? []) as UsageRow[]);
    const fids = fileRows.map((x) => x.id);
    const r = fids.length ? await sb.from("editorial_reviews").select("entity_id, decision, comment, created_at").eq("entity_type", "media_file").in("entity_id", fids).order("created_at", { ascending: false }) : { data: [] };
    setReviews((r.data ?? []) as ReviewRow[]);
    // Short-lived signed previews of the smallest rendition (pending/ is private to staff).
    const pv: Record<string, string> = {};
    await Promise.all(
      fileRows
        .filter((x) => x.state === "pending" || x.state === "active")
        .map(async (x) => {
          // A clip previews from its original (it has no renditions); an image from its smallest rendition.
          const v = [...x.variants].sort((m, n) => m.w - n.w)[0];
          if (!v && !isVideoMime(x.mime_type)) return;
          const { data } = await sb.storage.from("media").createSignedUrl(v ? `${folderOf(x.storage_path)}/${v.name}` : x.storage_path, 600);
          if (data?.signedUrl) pv[x.id] = data.signedUrl;
        }),
    );
    setPreviews(pv);
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    const r = await post("/api/admin/media", body);
    setBusy(false);
    setMsg(r.ok ? { tone: "ok", text: done } : fail(locale, t, r.data.error, t.didNotWork));
    if (r.ok) await load();
  };

  if (!sb) return <EmptyState title={t.needsDb} />;
  if (assets === null) return <Skeleton height={120} />;

  const shown = filter === "all" ? assets : assets.filter((a) => a.status === filter);
  const latestReview = (fid: string) => reviews.find((r) => r.entity_id === fid);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {!flags.scannerConfigured ? (
        <p className="zq-help" role="note" data-testid="scanner-note">
          {t.scannerNote()}
        </p>
      ) : !flags.serviceConfigured ? (
        <p className="zq-error" role="note">
          {t.scannerMissingKey}
        </p>
      ) : null}
      <Feedback msg={msg} />

      {flags.isEditor ? <UploadForm sources={sources} perms={perms} onDone={load} setMsg={setMsg} /> : null}

      <section style={{ display: "grid", gap: 12 }} aria-labelledby="media-list-h">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", justifyContent: "space-between" }}>
          <h2 id="media-list-h" style={{ margin: 0 }}>
            {t.library}
          </h2>
          <div className="zq-field">
            <label htmlFor="media-filter">{t.status}</label>
            <select id="media-filter" className="zq-input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {t.statusFilters[s] ?? s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!shown.length ? (
          <EmptyState title={filter === "all" ? t.noItems : t.noItemsFiltered(t.statusFilters[filter] ?? filter.replace("_", " "))} />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 16 }}>
            {shown.map((a) => {
              const versions = files.filter((f) => f.asset_id === a.id);
              const current = versions.find((f) => f.id === a.file_id);
              const newer = versions.filter((f) => f.state === "pending" && f.id !== a.file_id);
              const uses = usage.filter((u) => u.asset_id === a.id);
              const src = sources.find((s) => s.id === a.source_id);
              const perm = perms.find((p) => p.permission_id === a.permission_id);
              return (
                <li key={a.id} className="pp-card" data-status={a.status} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    {current && previews[current.id] && isVideoMime(current.mime_type) ? (
                      // No autoplay, muted, metadata only: a staff preview of a file that is still being reviewed.
                      <video src={previews[current.id]} controls muted playsInline preload="metadata" aria-label={t.previewOf(a.alt_text)} width={240} style={{ maxWidth: "100%", height: "auto", borderRadius: 6, background: "#000" }} data-testid="admin-video-preview" />
                    ) : current && previews[current.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed staff preview, not a public image
                      <img src={previews[current.id]} alt={a.alt_text} width={160} style={{ maxWidth: "100%", height: "auto", borderRadius: 6, background: "var(--surface-2, transparent)" }} />
                    ) : null}
                    <div style={{ display: "grid", gap: 4, minWidth: 0, flex: "1 1 240px" }}>
                      <span className="zq-eyebrow">
                        {t.statusFilters[a.status] ?? a.status.replace("_", " ")} · {t.categories[a.category] ?? a.category} · {current ? `v${current.version} ${current.mime_type} ${current.width}×${current.height}` : t.noFile}
                      </span>
                      <b style={{ overflowWrap: "anywhere" }}>{a.alt_text}</b>
                      <span className="zq-meta">
                        {t.creditLabel} {a.credit} · {t.sourceLabel} {src?.work ?? "?"} ({src?.rights_status ?? "?"}) · {t.licenceLabel} {perm ? `${perm.status}${perm.allowed ? t.allowedSp : t.notAllowedSp}` : src && ["cleared", "public_domain"].includes(src.rights_status) ? t.sourceCleared : t.noLicence}
                      </span>
                      {current ? <FileStatus f={current} review={latestReview(current.id)} /> : null}
                    </div>
                  </div>
                  <Actions a={a} current={current} flags={flags} busy={busy} act={act} />
                  {newer.map((f) => (
                    <div key={f.id} className="pp-card" style={{ display: "grid", gap: 6 }}>
                      <span className="zq-eyebrow">{t.replacementVersion(f.version)}</span>
                      <FileStatus f={f} review={latestReview(f.id)} />
                      <FileActions f={f} flags={flags} busy={busy} act={act} />
                      {flags.isEditor ? (
                        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={busy} onClick={() => act({ action: "activate_version", assetId: a.id, fileId: f.id }, t.versionCurrent(f.version))}>
                          {t.makeCurrent(f.version)}
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {flags.isEditor && ["draft", "in_review", "approved", "published", "correction"].includes(a.status) ? <ReplaceFile assetId={a.id} onDone={load} setMsg={setMsg} /> : null}
                  {flags.isEditor ? <AttachMedia assetId={a.id} t={t as unknown as Record<string, unknown>} setMsg={setMsg} /> : null}
                  <details>
                    <summary>
                      {t.usedIn(uses.length, versions.length)}
                    </summary>
                    {uses.length ? (
                      <ul className="zq-meta">
                        {uses.map((u) => (
                          <li key={`${u.module}:${u.entity_type}:${u.entity_id}:${u.role}`}>
                            {u.module} · {u.entity_type} {u.entity_id} · {u.role}
                            {u.status ? ` · ${u.status}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="zq-meta">{t.notUsed}</p>
                    )}
                    <ul className="zq-meta">
                      {versions.map((f) => (
                        <li key={f.id}>
                          v{f.version} · {t.fileStates[f.state] ?? f.state} · {t.scan[f.scan_status] ?? f.scan_status} · {Math.round(f.bytes / 1024)} KB · {isVideoMime(f.mime_type) ? t.videoStored : t.renditions(f.variants.length)}{f.sanitised ? t.svgSanitised : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {flags.isAdmin ? <Cleanup setMsg={setMsg} onDone={load} /> : null}
    </div>
  );
}

function FileStatus({ f, review }: { f: FileRow; review?: ReviewRow }) {
  const t = adminMediaStrings(useLocale());
  return (
    <span className="zq-meta">
      {t.scan[f.scan_status] ?? f.scan_status} · {f.non_figurative_confirmed ? t.nonFigConfirmed : t.nonFigNot} · {t.religiousReview}{" "}
      {review ? (t.decisions[review.decision] ?? review.decision.replace("_", " ")) : t.noneYet}
      {review?.comment ? ` (“${review.comment}”)` : ""}
    </span>
  );
}

function FileActions({ f, flags, busy, act }: { f: FileRow; flags: Flags; busy: boolean; act: (b: Record<string, unknown>, done: string) => Promise<void> }) {
  const t = adminMediaStrings(useLocale());
  const [clipTick, setClipTick] = useState(false);
  if (f.state !== "pending") return null;
  const clip = isVideoMime(f.mime_type);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {flags.isEditor && !f.non_figurative_confirmed ? (
        <>
          {clip ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={clipTick} onChange={(e) => setClipTick(e.target.checked)} />
              <span>{t.videoConfirm}</span>
            </label>
          ) : null}
          <button
            type="button"
            className="zq-btn zq-btn-secondary zq-btn-sm"
            disabled={busy || (clip && !clipTick)}
            onClick={() => act({ action: "confirm_non_figurative", fileId: f.id, confirmation: clip ? VIDEO_CONFIRMED : ALL_CONFIRMED }, t.nonFigRecorded)}
          >
            {t.confirmNonFig}
          </button>
        </>
      ) : null}
      {flags.isAdmin && (f.scan_status === "not_scanned" || f.scan_status === "failed") ? (
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={busy} onClick={() => act({ action: "acknowledge_scan", fileId: f.id, acknowledgement: "scan skipped" }, t.scanAcked)}>
          {t.ackScan}
        </button>
      ) : null}
      {flags.isEditor && flags.scannerConfigured && (f.scan_status === "not_scanned" || f.scan_status === "failed") ? (
        <button type="button" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={busy} onClick={() => act({ action: "rescan", fileId: f.id }, t.scannedAgain)}>
          {t.scanAgain}
        </button>
      ) : null}
      {flags.isReviewer ? <ReviewButtons fileId={f.id} busy={busy} act={act} /> : null}
    </div>
  );
}

function ReviewButtons({ fileId, busy, act }: { fileId: string; busy: boolean; act: (b: Record<string, unknown>, done: string) => Promise<void> }) {
  const t = adminMediaStrings(useLocale());
  const [comment, setComment] = useState("");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
      <div className="zq-field">
        <label htmlFor={`rev-${fileId}`}>{t.religiousComment}</label>
        <input id={`rev-${fileId}`} className="zq-input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      </div>
      {(["approved", "changes_requested", "rejected"] as const).map((d) => (
        <button key={d} type="button" className={`zq-btn zq-btn-sm ${d === "approved" ? "zq-btn-primary" : "zq-btn-secondary"}`} disabled={busy} onClick={() => act({ action: "review", fileId, decision: d, comment: comment || undefined }, t.reviewRecorded(t.decisions[d] ?? d.replace("_", " ")))}>
          {d === "approved" ? t.approveNonFig : d === "changes_requested" ? t.requestChanges : t.reject}
        </button>
      ))}
    </div>
  );
}

function Actions({ a, current, flags, busy, act }: { a: AssetRow; current?: FileRow; flags: Flags; busy: boolean; act: (b: Record<string, unknown>, done: string) => Promise<void> }) {
  const t = adminMediaStrings(useLocale());
  const btn = (label: string, body: Record<string, unknown>, done: string, primary = false) => (
    <button type="button" className={`zq-btn zq-btn-sm ${primary ? "zq-btn-primary" : "zq-btn-secondary"}`} disabled={busy} onClick={() => act(body, done)}>
      {label}
    </button>
  );
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {current ? <FileActions f={current} flags={flags} busy={busy} act={act} /> : null}
      {flags.isEditor ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["draft", "correction", "rejected"].includes(a.status) ? btn(t.submitReview, { action: "submit", assetId: a.id }, t.okSubmitted) : null}
          {["draft", "in_review", "correction"].includes(a.status) ? btn(t.approve, { action: "approve", assetId: a.id }, t.okApproved, true) : null}
          {a.status === "approved" ? btn(t.publish, { action: "publish", assetId: a.id }, t.okPublished, true) : null}
          {a.status === "published" ? btn(t.moveCorrection, { action: "correction", assetId: a.id }, t.okCorrection) : null}
          {a.status === "published" ? btn(t.withdraw, { action: "withdraw", assetId: a.id }, t.okWithdrawn) : null}
          {["draft", "in_review", "correction"].includes(a.status) ? btn(t.reject, { action: "reject", assetId: a.id }, t.okRejected) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReplaceFile({ assetId, onDone, setMsg }: { assetId: string; onDone: () => Promise<void>; setMsg: (m: Msg) => void }) {
  const locale = useLocale();
  const t = adminMediaStrings(locale);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!(fd.get("file") instanceof File) || !(fd.get("file") as File).size) return setMsg({ tone: "err", text: t.chooseNewFile });
    fd.set("assetId", assetId);
    setBusy(true);
    const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(false);
    setMsg(res.ok ? { tone: "ok", text: t.newVersionUploaded(String(data.version)) } : fail(locale, t, data.error, t.uploadFailed));
    if (res.ok) {
      e.currentTarget?.reset();
      await onDone();
    }
  };
  return (
    <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
      <div className="zq-field">
        <label htmlFor={`replace-${assetId}`}>{t.replaceFile}</label>
        <input id={`replace-${assetId}`} name="file" type="file" accept={FILE_ACCEPT} className="zq-input" />
      </div>
      <button type="submit" className="zq-btn zq-btn-secondary zq-btn-sm" disabled={busy}>
        {t.uploadNewVersion}
      </button>
    </form>
  );
}

function UploadForm({ sources, perms, onDone, setMsg }: { sources: SourceRow[]; perms: PermRow[]; onDone: () => Promise<void>; setMsg: (m: Msg) => void }) {
  const locale = useLocale();
  const t = adminMediaStrings(locale);
  const [meta, setMeta] = useState<MediaMetadata>(EMPTY_META);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const sourcePerms = useMemo(() => perms.filter((p) => p.source_id === meta.sourceId), [perms, meta.sourceId]);
  const set = <K extends keyof MediaMetadata>(k: K, v: MediaMetadata[K]) => setMeta((m) => ({ ...m, [k]: v }));
  const [isVideo, setIsVideo] = useState(false);
  const allConfirmed = NON_FIGURATIVE_ITEMS.every(([k]) => confirmed[k]) && (!isVideo || Boolean(confirmed[VIDEO_CONFIRMATION[0]]));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size) return setMsg({ tone: "err", text: t.chooseUpload });
    if (!allConfirmed) return setMsg({ tone: "err", text: t.tickAll });
    if (isVideo && meta.altText.trim().length < MIN_VIDEO_DESCRIPTION) return setMsg({ tone: "err", text: t.videoNeedsDesc(MIN_VIDEO_DESCRIPTION) });
    if (isVideo && !(meta.captionEn ?? "").trim()) return setMsg({ tone: "err", text: t.videoNeedsCaption });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("metadata", JSON.stringify(meta));
    setBusy(true);
    const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) await post("/api/admin/media", { action: "confirm_non_figurative", fileId: data.fileId, confirmation: data.type === "webm" || data.type === "mp4" ? VIDEO_CONFIRMED : ALL_CONFIRMED });
    setBusy(false);
    if (!res.ok) return setMsg(fail(locale, t, data.error, t.uploadFailed));
    const removed = (data.removed as string[] | undefined)?.length ? t.removedFromSvg((data.removed as string[]).join(", ")) : "";
    setMsg({ tone: "ok", text: t.uploadedDraft(t.scan[String(data.scan)] ?? String(data.scan).replace("_", " "), removed) });
    form.reset();
    setIsVideo(false);
    setMeta(EMPTY_META);
    setConfirmed({});
    await onDone();
  };

  const text = (k: keyof MediaMetadata, label: string, opts: { required?: boolean; lang?: string; area?: boolean } = {}) => (
    <div className="zq-field">
      <label htmlFor={`up-${k}`}>{label}</label>
      {opts.area ? (
        <textarea id={`up-${k}`} className="zq-input" rows={2} maxLength={500} lang={opts.lang} dir={opts.lang && opts.lang !== "en" ? "rtl" : undefined} value={String(meta[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />
      ) : (
        <input id={`up-${k}`} className="zq-input" maxLength={k === "credit" ? 300 : 500} required={opts.required} lang={opts.lang} dir={opts.lang && opts.lang !== "en" ? "rtl" : undefined} value={String(meta[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} />
      )}
    </div>
  );

  return (
    <form className="pp-card" onSubmit={submit} style={{ display: "grid", gap: 12 }} aria-labelledby="media-upload-h">
      <h2 id="media-upload-h" style={{ margin: 0 }}>
        {t.uploadTitle}
      </h2>
      <p className="zq-meta" style={{ margin: 0 }}>
        {t.uploadHelp(Math.round(MAX_VIDEO_BYTES / 1024 / 1024), MAX_VIDEO_SECONDS)}
      </p>
      <div className="zq-field">
        <label htmlFor="up-file">{t.imageOrVideoFile}</label>
        <input id="up-file" name="file" type="file" required accept={FILE_ACCEPT} className="zq-input" onChange={(e) => setIsVideo(looksLikeVideo(e.target.files?.[0]))} />
      </div>
      <div className="zq-grid" style={{ gap: 12 }}>
        {text("altText", isVideo ? t.clipDescription(MIN_VIDEO_DESCRIPTION) : t.altEn, { required: true, area: isVideo })}
        {text("altTextAr", isVideo ? t.descAr : t.altAr, { lang: "ar" })}
        {text("altTextUr", isVideo ? t.descUr : t.altUr, { lang: "ur" })}
        {text("captionEn", isVideo ? t.captionClip : t.captionEn, { area: true })}
        {text("captionAr", t.captionAr, { area: true, lang: "ar" })}
        {text("captionUr", t.captionUr, { area: true, lang: "ur" })}
        <div className="zq-field">
          <label htmlFor="up-category">{t.category}</label>
          <select id="up-category" className="zq-input" value={meta.category} onChange={(e) => set("category", e.target.value as MediaMetadata["category"])}>
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.categories[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        {text("credit", t.creditLine, { required: true })}
        <div className="zq-field">
          <label htmlFor="up-source">{t.source}</label>
          <select id="up-source" className="zq-input" required value={meta.sourceId} onChange={(e) => setMeta((m) => ({ ...m, sourceId: e.target.value, permissionId: null }))}>
            <option value="">{t.chooseDots}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.work} ({s.rights_status})
              </option>
            ))}
          </select>
        </div>
        <div className="zq-field">
          <label htmlFor="up-licence">{t.licenceImage}</label>
          <select id="up-licence" className="zq-input" value={meta.permissionId ?? ""} onChange={(e) => set("permissionId", e.target.value || null)}>
            <option value="">{t.sourceOwnRights}</option>
            {sourcePerms.map((p) => (
              <option key={p.permission_id} value={p.permission_id}>
                {p.scope} · {p.status} {p.allowed ? t.allowed : t.notAllowed}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset style={{ display: "grid", gap: 6, border: "1px solid var(--line, currentColor)", borderRadius: 8, padding: 12 }}>
        <legend>{t.nonFigLegend}</legend>
        {NON_FIGURATIVE_ITEMS.map(([k, label]) => (
          <label key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" checked={Boolean(confirmed[k])} onChange={(e) => setConfirmed((c) => ({ ...c, [k]: e.target.checked }))} />
            <span>{t.confirmItems[k] ?? label}</span>
          </label>
        ))}
        {isVideo ? (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" required data-testid="video-confirmation" checked={Boolean(confirmed[VIDEO_CONFIRMATION[0]])} onChange={(e) => setConfirmed((c) => ({ ...c, [VIDEO_CONFIRMATION[0]]: e.target.checked }))} />
            <span>{t.videoConfirm}</span>
          </label>
        ) : null}
      </fieldset>
      <div>
        <button type="submit" className="zq-btn zq-btn-primary" disabled={busy}>
          {busy ? t.uploading : t.uploadAsDraft}
        </button>
      </div>
    </form>
  );
}

function Cleanup({ setMsg, onDone }: { setMsg: (m: Msg) => void; onDone: () => Promise<void> }) {
  const locale = useLocale();
  const t = adminMediaStrings(locale);
  const [grace, setGrace] = useState(7);
  const [plan, setPlan] = useState<CleanupItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const dry = async () => {
    setBusy(true);
    const r = await post("/api/admin/media/cleanup", { execute: false, graceDays: grace });
    setBusy(false);
    if (!r.ok) return setMsg(fail(locale, t, r.data.error, t.dryRunFailed));
    setPlan(r.data.candidates as CleanupItem[]);
  };
  const run = async () => {
    if (!plan?.length) return;
    setBusy(true);
    const r = await post("/api/admin/media/cleanup", { execute: true, graceDays: grace, confirm: plan.map((p) => p.key) });
    setBusy(false);
    setPlan(null);
    setMsg(r.ok ? { tone: "ok", text: t.removedFailed((r.data.removed as string[]).length, (r.data.failed as string[]).length) } : fail(locale, t, r.data.error, t.cleanupFailed));
    await onDone();
  };
  return (
    <section className="pp-card" style={{ display: "grid", gap: 12 }} aria-labelledby="media-cleanup-h">
      <h2 id="media-cleanup-h" style={{ margin: 0 }}>
        {t.orphaned}
      </h2>
      <p className="zq-meta" style={{ margin: 0 }}>
        {t.orphanedHelp}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
        <div className="zq-field">
          <label htmlFor="cleanup-grace">{t.grace}</label>
          <input id="cleanup-grace" type="number" min={1} max={365} className="zq-input" value={grace} onChange={(e) => setGrace(Math.max(1, Number(e.target.value) || 7))} />
        </div>
        <button type="button" className="zq-btn zq-btn-secondary" disabled={busy} onClick={dry}>
          {t.dryRun}
        </button>
        {plan?.length ? (
          <button type="button" className="zq-btn zq-btn-primary" disabled={busy} onClick={run}>
            {t.removeThese(plan.length)}
          </button>
        ) : null}
      </div>
      {plan ? (
        plan.length ? (
          <ul className="zq-meta">
            {plan.map((p) => (
              <li key={p.key}>
                {p.path} · <ServerText>{p.reason}</ServerText>
              </li>
            ))}
          </ul>
        ) : (
          <p className="zq-help" role="status">
            {t.nothingToClean}
          </p>
        )
      ) : null}
    </section>
  );
}
