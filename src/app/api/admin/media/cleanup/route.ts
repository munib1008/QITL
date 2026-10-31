import type { NextRequest } from "next/server";
import { z } from "zod";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { BUCKET, objectNames } from "@/lib/media/storage";
import type { MediaVariant } from "@/lib/media/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Run = z.object({
  execute: z.boolean().default(false),
  graceDays: z.number().int().min(1).max(365).default(7),
  /** The candidate list a dry run returned; execute removes only these (nothing new slips in between). */
  confirm: z.array(z.string().min(1).max(200)).max(5000).optional(),
});

interface Candidate {
  file_id: string;
  asset_id: string;
  storage_path: string;
  variants: MediaVariant[];
  state: string;
  reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Orphaned-file cleanup (admins only, run by hand). A dry run lists what would go: superseded and rejected file
 * versions past the grace period, files of rejected/archived assets that nothing uses, and storage folders with no
 * file version at all. Execute removes exactly the confirmed list and marks the versions deleted (rows are kept).
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const run = await parseBody(req, Run);
  if (isResponse(run)) return run;
  if (run.execute && !run.confirm) return fail(422, "dry_run_first", "Run a dry run first and confirm its list.");

  const { data, error } = await a.sb.rpc("media_cleanup_candidates", { grace_days: run.graceDays });
  if (error) return dbError(error);
  const candidates = (data ?? []) as Candidate[];

  // Storage folders whose name is not a known file version (uploads that never got a row, or rows long gone).
  const store = a.sb.storage.from(BUCKET);
  const folders: string[] = [];
  for (const root of ["pending", "assets"]) {
    for (let offset = 0; offset < 50_000; offset += 1000) {
      const { data: list, error: lerr } = await store.list(root, { limit: 1000, offset });
      if (lerr) return fail(502, "storage_error", "The media bucket could not be listed.");
      for (const o of list ?? []) if (UUID.test(o.name)) folders.push(`${root}/${o.name}`);
      if (!list || list.length < 1000) break;
    }
  }
  const ids = [...new Set(folders.map((f) => f.split("/")[1]!))];
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rows, error: rerr } = await a.sb.from("asset_files").select("id, storage_path").in("id", ids.slice(i, i + 200));
    if (rerr) return dbError(rerr);
    for (const r of rows ?? []) known.add(`${(r.storage_path as string).split("/")[0]}/${r.id as string}`);
  }
  const deletedIds = new Set(candidates.map((c) => c.file_id));
  const orphanFolders = folders.filter((f) => !known.has(f) && !deletedIds.has(f.split("/")[1]!));

  const plan = [
    ...candidates.map((c) => ({ key: `file:${c.file_id}`, kind: "file_version" as const, fileId: c.file_id, assetId: c.asset_id, path: c.storage_path, reason: c.reason })),
    ...orphanFolders.map((f) => ({ key: `folder:${f}`, kind: "orphan_folder" as const, fileId: null, assetId: null, path: f, reason: "storage folder with no file version" })),
  ];
  if (!run.execute) return json({ dryRun: true, graceDays: run.graceDays, candidates: plan });

  const confirmed = new Set(run.confirm);
  const removed: string[] = [];
  const failed: string[] = [];
  for (const c of candidates) {
    if (!confirmed.has(`file:${c.file_id}`)) continue;
    const { error: rerr } = await store.remove(objectNames(c));
    if (rerr) {
      failed.push(`file:${c.file_id}`);
      continue;
    }
    const { error: uerr } = await a.sb.from("asset_files").update({ state: "deleted" }).eq("id", c.file_id);
    (uerr ? failed : removed).push(`file:${c.file_id}`);
  }
  for (const f of orphanFolders) {
    if (!confirmed.has(`folder:${f}`)) continue;
    const { data: objs } = await store.list(f, { limit: 1000 });
    const names = (objs ?? []).map((o) => `${f}/${o.name}`);
    const { error: rerr } = names.length ? await store.remove(names) : { error: null };
    (rerr ? failed : removed).push(`folder:${f}`);
  }
  return json({ dryRun: false, removed, failed, skipped: [...confirmed].filter((k) => !removed.includes(k) && !failed.includes(k)) });
}
