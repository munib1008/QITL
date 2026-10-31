// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Media Library: file versions, scanning, the non-figurative confirmation, religious review, approval (approved_by
 * stamped), publishing, version replacement, cleanup candidates, usage, public rendering, RLS and the storage path rule.
 * Every file below is a fixture row; nothing is uploaded.
 */
let db: Db;
let editor: string, editor2: string, scholar: string, admin: string, alice: string;
let clearedSource: string, pendingSource: string, conditionalPerm: string, blockedPerm: string;

const one = async <T = { id: string }>(p: Promise<T[]>) => (await p)[0]!;
const sha = "a".repeat(64);

async function newAsset(by = editor, source = clearedSource, permission: string | null = null): Promise<{ asset: string; file: string }> {
  const fileId = randomUUID();
  const asset = (
    await one(
      db.as<{ id: string }>(
        by,
        "insert into public.assets (storage_path, kind, alt_text, credit, source_id, permission_id, mime_type, bytes, category) values ($1, 'image', 'A geometric rosette pattern', 'Fixture credit', $2, $3, 'image/png', 100, 'pattern') returning id",
        [`pending/${fileId}/original.png`, source, permission],
      ),
    )
  ).id;
  const file = await addFile(by, asset, fileId);
  await db.as(by, "update public.assets set file_id = $1 where id = $2", [file, asset]);
  return { asset, file };
}

async function addFile(by: string, asset: string, fileId = randomUUID()): Promise<string> {
  return (
    await one(
      db.as<{ id: string }>(
        by,
        "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height, variants) values ($1, $2, 1, $3, 'image/png', 100, $4, 800, 600, $5) returning id",
        [fileId, asset, `pending/${fileId}/original.png`, sha, JSON.stringify([{ w: 640, h: 480, name: "w640.webp", bytes: 50 }])],
      ),
    )
  ).id;
}

const scanClean = (file: string) => db.admin("update public.asset_files set scan_status = 'clean', scan_engine = 'fixture', scanned_at = now() where id = $1", [file]);
const confirm = (by: string, file: string) => db.as(by, "update public.asset_files set non_figurative_confirmed = true where id = $1", [file]);
const review = (by: string, file: string, decision = "approved") =>
  db.as(by, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('media_file', $1, $2, $3)", [file, by, decision]);
const activate = (by: string, file: string) =>
  db.as(by, "update public.asset_files set state = 'active', storage_path = replace(storage_path, 'pending/', 'assets/') where id = $1", [file]);
const setStatus = (by: string, asset: string, status: string) => db.as(by, "update public.assets set status = $1 where id = $2", [status, asset]);

async function readyAndPublish(asset: string, file: string) {
  await scanClean(file);
  await confirm(editor, file);
  await review(scholar, file);
  await setStatus(editor, asset, "approved");
  await activate(editor, file);
  await setStatus(editor, asset, "published");
}

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  editor2 = await db.createUser("editor2@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
  alice = await db.createUser("alice@test.local");
  clearedSource = (await one(db.admin<{ id: string }>("insert into public.sources (type, work, rights_status, attribution) values ('other', 'Fixture cleared images', 'cleared', 'Fixture attribution') returning id"))).id;
  pendingSource = (await one(db.admin<{ id: string }>("insert into public.sources (type, work) values ('other', 'Fixture uncleared images') returning id"))).id;
  conditionalPerm = (
    await one(
      db.as<{ id: string }>(
        admin,
        "insert into public.content_permissions (source_id, asset_type, status, conditions, attribution_text) values ($1, 'image', 'CONDITIONAL', 'fixture conditions', 'Fixture licence attribution') returning id",
        [pendingSource],
      ),
    )
  ).id;
  blockedPerm = (await one(db.as<{ id: string }>(admin, "insert into public.content_permissions (source_id, asset_type, scope, status) values ($1, 'image', 'blocked', 'BLOCKED') returning id", [pendingSource]))).id;
}, 300_000);

describe("upload rows", () => {
  test("a new file version starts pending, unscanned and unconfirmed; authorship is stamped", async () => {
    const { asset, file } = await newAsset();
    const f = await one(db.as<{ state: string; scan_status: string; created_by: string; version: number }>(editor, "select state, scan_status, created_by, version from public.asset_files where id = $1", [file]));
    expect(f).toEqual({ state: "pending", scan_status: "not_scanned", created_by: editor, version: 1 });
    const a = await one(db.as<{ storage_path: string; file_id: string; depicts_person: boolean }>(editor, "select storage_path, file_id, depicts_person from public.assets where id = $1", [asset]));
    expect(a.file_id).toBe(file);
    expect(a.storage_path).toBe(`pending/${file}/original.png`);
    expect(a.depicts_person).toBe(false);
    const id = randomUUID();
    await rejects(
      db.as(editor, "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height, scan_status) values ($1, $2, 1, $3, 'image/png', 1, $4, 1, 1, 'clean')", [id, asset, `pending/${id}/original.png`, sha]),
      /starts pending, unscanned/,
    );
    const id2 = randomUUID();
    await rejects(
      db.as(editor, "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height) values ($1, $2, 1, $3, 'image/png', 1, $4, 1, 1)", [id2, asset, `assets/${id2}/original.png`, sha]),
      /violates check constraint/,
    );
  });

  test("only editors upload; the public never sees drafts or pending files", async () => {
    const { asset, file } = await newAsset();
    await rejects(newAsset(alice), /row-level security|permission denied/);
    expect(await db.as(null, "select id from public.assets where id = $1", [asset])).toEqual([]);
    expect(await db.as(null, "select id from public.asset_files where id = $1", [file])).toEqual([]);
    expect(await db.as(alice, "select id from public.asset_files where id = $1", [file])).toEqual([]);
    expect(await db.as(null, "select id from public.media_public where id = $1", [asset])).toEqual([]);
  });

  test("depicts_person can never be true", async () => {
    const { asset } = await newAsset();
    await rejects(db.as(editor, "update public.assets set depicts_person = true where id = $1", [asset]), /figurative|check constraint/);
  });

  test("a file version is immutable", async () => {
    const { file } = await newAsset();
    await rejects(db.as(editor, "update public.asset_files set sha256 = $2 where id = $1", [file, "b".repeat(64)]), /immutable/);
  });
});

describe("scanning", () => {
  test("editors cannot record a scan result; the server (service role) can", async () => {
    const { file } = await newAsset();
    await rejects(db.as(editor, "update public.asset_files set scan_status = 'clean' where id = $1", [file]), /server scanner only/);
    await rejects(db.as(admin, "update public.asset_files set scan_status = 'clean' where id = $1", [file]), /server scanner only/);
    await scanClean(file);
    expect((await one(db.as<{ scan_status: string }>(editor, "select scan_status from public.asset_files where id = $1", [file]))).scan_status).toBe("clean");
  });

  test("a skipped scan is acknowledged by an admin only, stamped with that admin", async () => {
    const { file } = await newAsset();
    await rejects(db.as(editor, "update public.asset_files set scan_status = 'skipped_acknowledged', scan_ack_by = $2 where id = $1", [file, editor]), /only an admin/);
    await db.as(admin, "update public.asset_files set scan_status = 'skipped_acknowledged', scan_ack_by = $2 where id = $1", [file, editor]);
    const f = await one(db.as<{ scan_ack_by: string; scan_ack_at: string | null }>(admin, "select scan_ack_by, scan_ack_at from public.asset_files where id = $1", [file]));
    expect(f.scan_ack_by).toBe(admin);
    expect(f.scan_ack_at).not.toBeNull();
  });

  test("an infected file cannot be acknowledged or published", async () => {
    const { asset, file } = await newAsset();
    await db.admin("update public.asset_files set scan_status = 'infected', scan_engine = 'fixture', scanned_at = now() where id = $1", [file]);
    await rejects(db.as(admin, "update public.asset_files set scan_status = 'skipped_acknowledged' where id = $1", [file]), /server scanner only/);
    await confirm(editor, file);
    await review(scholar, file);
    await rejects(setStatus(editor, asset, "approved"), /approval needs a scanned file/);
  });
});

describe("approval and publishing guards", () => {
  test("approval needs scan, confirmation and an approving religious review", async () => {
    const { asset, file } = await newAsset();
    await rejects(setStatus(editor, asset, "approved"), /approval needs/);
    await scanClean(file);
    await rejects(setStatus(editor, asset, "approved"), /approval needs/);
    await confirm(editor, file);
    await rejects(setStatus(editor, asset, "approved"), /approval needs/);
    await review(scholar, file, "changes_requested");
    await rejects(setStatus(editor, asset, "approved"), /approval needs/);
    await review(scholar, file);
    await setStatus(editor, asset, "approved");
    const a = await one(db.as<{ approved_by: string; approved_at: string }>(editor, "select approved_by, approved_at from public.assets where id = $1", [asset]));
    expect(a.approved_by).toBe(editor);
  });

  test("the non-figurative confirmation is stamped with the acting editor", async () => {
    const { file } = await newAsset();
    await db.as(editor2, "update public.asset_files set non_figurative_confirmed = true, non_figurative_by = $2 where id = $1", [file, scholar]);
    expect((await one(db.as<{ non_figurative_by: string }>(editor, "select non_figurative_by from public.asset_files where id = $1", [file]))).non_figurative_by).toBe(editor2);
  });

  test("approved_by is never typed in", async () => {
    const { asset } = await newAsset();
    await db.as(editor, "update public.assets set approved_by = $2 where id = $1", [asset, admin]);
    expect((await one(db.as<{ approved_by: string | null }>(editor, "select approved_by from public.assets where id = $1", [asset]))).approved_by).toBeNull();
    const { asset: a2, file } = await newAsset();
    await scanClean(file);
    await confirm(editor, file);
    await review(scholar, file);
    await setStatus(editor, a2, "approved");
    await rejects(db.as(editor, "update public.assets set approved_by = $2 where id = $1", [a2, admin]), /stamped by the database/);
  });

  test("a reviewer cannot review a file they uploaded; non-reviewers cannot review", async () => {
    const { file } = await newAsset(admin);
    await rejects(review(admin, file), /cannot review a file they uploaded/);
    const { file: f2 } = await newAsset();
    await rejects(review(editor2, f2), /scholarly reviewer|row-level security/);
  });

  test("a scholarly reviewer without the editor role cannot approve", async () => {
    const { asset, file } = await newAsset();
    await scanClean(file);
    await confirm(editor, file);
    await review(scholar, file);
    await rejects(setStatus(scholar, asset, "approved"), /only an editor approves/);
  });

  test("publishing needs approval and an active file outside pending/", async () => {
    const { asset, file } = await newAsset();
    await rejects(setStatus(editor, asset, "published"), /approved asset/);
    await scanClean(file);
    await confirm(editor, file);
    await review(scholar, file);
    await rejects(activate(editor, file), /goes public only when/);
    await setStatus(editor, asset, "approved");
    await rejects(setStatus(editor, asset, "published"), /active, reviewed file/);
    await activate(editor, file);
    await setStatus(editor, asset, "published");
    const pub = await one(db.as<{ id: string; storage_path: string; attribution: string }>(null, "select id, storage_path, attribution from public.media_public where id = $1", [asset]));
    expect(pub.storage_path).toBe(`assets/${file}/original.png`);
    expect(pub.attribution).toBe("Fixture attribution");
    expect(await db.as(alice, "select id from public.asset_files where id = $1", [file])).toHaveLength(1);
  });

  test("the licence: an uncleared source needs an allowed image permission of the same source", async () => {
    const { asset, file } = await newAsset(editor, pendingSource);
    await scanClean(file);
    await confirm(editor, file);
    await review(scholar, file);
    await rejects(setStatus(editor, asset, "approved"), /licence is not cleared/);
    await rejects(db.as(editor, "update public.assets set permission_id = $2 where id = $1", [asset, blockedPerm]).then(() => setStatus(editor, asset, "approved")), /licence is not cleared/);
    await db.as(editor, "update public.assets set permission_id = $2 where id = $1", [asset, conditionalPerm]);
    await setStatus(editor, asset, "approved");
    await activate(editor, file);
    await setStatus(editor, asset, "published");
    expect((await one(db.as<{ attribution: string }>(null, "select attribution from public.media_public where id = $1", [asset]))).attribution).toBe("Fixture licence attribution");
    // A permission of another source is refused outright.
    const other = (await one(db.as<{ id: string }>(admin, "insert into public.content_permissions (source_id, asset_type, status, conditions, attribution_text) values ($1, 'image', 'CONDITIONAL', 'c', 'a') returning id", [clearedSource]))).id;
    const { asset: a2 } = await newAsset(editor, pendingSource);
    await rejects(db.as(editor, "update public.assets set permission_id = $2 where id = $1", [a2, other]), /same source/);
  });

  test("a revoked licence hides a published asset from public rendering", async () => {
    const src = (await one(db.admin<{ id: string }>("insert into public.sources (type, work) values ('other', 'Fixture revocable') returning id"))).id;
    const perm = (await one(db.as<{ id: string }>(admin, "insert into public.content_permissions (source_id, asset_type, status, conditions, attribution_text) values ($1, 'image', 'CONDITIONAL', 'c', 'Revocable') returning id", [src]))).id;
    const { asset, file } = await newAsset(editor, src, perm);
    await readyAndPublish(asset, file);
    expect(await db.as(null, "select id from public.media_public where id = $1", [asset])).toHaveLength(1);
    await db.as(admin, "update public.content_permissions set status = 'BLOCKED' where id = $1", [perm]);
    expect(await db.as(null, "select id from public.media_public where id = $1", [asset])).toEqual([]);
  });

  test("a published asset is not edited in place; correction clears the approval", async () => {
    const { asset, file } = await newAsset();
    await readyAndPublish(asset, file);
    await rejects(db.as(editor, "update public.assets set alt_text = 'Changed alt text' where id = $1", [asset]), /cannot be edited in place/);
    await setStatus(editor, asset, "correction");
    expect((await one(db.as<{ approved_by: string | null }>(editor, "select approved_by from public.assets where id = $1", [asset]))).approved_by).toBeNull();
    await db.as(editor, "update public.assets set alt_text = 'Corrected alt text' where id = $1", [asset]);
    await rejects(setStatus(editor, asset, "published"), /approved asset/);
    await setStatus(editor, asset, "approved");
    await setStatus(editor, asset, "published");
  });
});

describe("version replacement", () => {
  test("a new version swaps in only when ready; the old version is superseded and kept", async () => {
    const { asset, file } = await newAsset();
    await readyAndPublish(asset, file);
    const v2 = await addFile(editor2, asset);
    expect((await one(db.as<{ version: number }>(editor, "select version from public.asset_files where id = $1", [v2]))).version).toBe(2);
    await rejects(db.as(editor, "update public.assets set file_id = $2 where id = $1", [asset, v2]), /not ready/);
    await scanClean(v2);
    await confirm(editor2, v2);
    await review(scholar, v2);
    await activate(editor, v2);
    await db.as(editor, "update public.assets set file_id = $2 where id = $1", [asset, v2]);
    const rows = await db.as<{ id: string; state: string; superseded_at: string | null }>(editor, "select id, state, superseded_at from public.asset_files where asset_id = $1 order by version", [asset]);
    expect(rows.map((r) => r.state)).toEqual(["superseded", "active"]);
    expect(rows[0]!.superseded_at).not.toBeNull();
    expect((await one(db.as<{ storage_path: string }>(null, "select storage_path from public.media_public where id = $1", [asset]))).storage_path).toBe(`assets/${v2}/original.png`);
    // The superseded version is no longer public, and the current file cannot be superseded or withdrawn.
    expect(await db.as(null, "select id from public.asset_files where id = $1", [file])).toEqual([]);
    await rejects(db.as(editor, "update public.asset_files set state = 'superseded' where id = $1", [v2]), /current file/);
    await rejects(db.as(editor, "update public.asset_files set state = 'pending', storage_path = replace(storage_path, 'assets/', 'pending/') where id = $1", [v2]), /published asset cannot be withdrawn/);
  });
});

describe("cleanup candidates", () => {
  test("admins only; superseded versions after the grace period, never a current file", async () => {
    const { asset, file } = await newAsset();
    await readyAndPublish(asset, file);
    const v2 = await addFile(editor, asset);
    await scanClean(v2);
    await confirm(editor, v2);
    await review(scholar, v2);
    await activate(editor, v2);
    await db.as(editor, "update public.assets set file_id = $2 where id = $1", [asset, v2]);
    await rejects(db.as(editor, "select * from public.media_cleanup_candidates(0)"), /only an admin/);
    await rejects(db.as(null, "select * from public.media_cleanup_candidates(0)"), /permission denied/);
    expect((await db.as<{ file_id: string }>(admin, "select file_id from public.media_cleanup_candidates(7)")).map((r) => r.file_id)).not.toContain(file);
    await db.admin("update public.asset_files set superseded_at = now() - interval '8 days' where id = $1", [file]);
    const c = await db.as<{ file_id: string; reason: string }>(admin, "select file_id, reason from public.media_cleanup_candidates(7)");
    expect(c.map((r) => r.file_id)).toContain(file);
    expect(c.map((r) => r.file_id)).not.toContain(v2);
    // Removing: admins only, and never the file in use.
    await rejects(db.as(editor, "update public.asset_files set state = 'deleted' where id = $1", [file]), /only an admin/);
    await db.as(admin, "update public.asset_files set state = 'deleted' where id = $1", [file]);
    await rejects(db.as(admin, "update public.asset_files set state = 'deleted' where id = $1", [v2]), /cannot go from active to deleted/);
  });

  test("a rejected asset's files that nothing uses become candidates", async () => {
    const { asset, file } = await newAsset();
    await setStatus(editor, asset, "rejected");
    // updated_at is touched by the guard on every update: age it with the guard off (setup only).
    await db.admin("alter table public.assets disable trigger assets_guard");
    await db.admin("update public.assets set updated_at = now() - interval '30 days' where id = $1", [asset]);
    await db.admin("alter table public.assets enable trigger assets_guard");
    const c = await db.as<{ file_id: string }>(admin, "select file_id from public.media_cleanup_candidates(7)");
    expect(c.map((r) => r.file_id)).toContain(file);
  });
});

describe("usage", () => {
  test("lists where an asset is used across modules", async () => {
    const { asset } = await newAsset();
    await db.as(editor, "insert into public.asset_links (asset_id, entity_type, entity_id) values ($1, 'person', 'fixture-person')", [asset]);
    const lifestyle = await one(db.admin<{ id: string }>("insert into public.lifestyle_infographics (slug, kind, asset_id, alt_text, evidence_category) values ('fixture-graphic', 'pattern', $1, 'Fixture alt text', 'C') returning id", [asset]));
    const u = await db.as<{ module: string; entity_id: string }>(editor, "select module, entity_id from public.asset_usage where asset_id = $1 order by module", [asset]);
    expect(u).toEqual([
      { module: "knowledge", entity_id: "fixture-person" },
      { module: "life_through_ages", entity_id: lifestyle.id },
    ]);
    await rejects(db.as(null, "select * from public.asset_usage"), /permission denied/);
  });
});

describe("storage path rule (media_object_writable)", () => {
  const writable = async (who: string | null, name: string) => (await one(db.as<{ ok: boolean }>(who, "select public.media_object_writable($1) as ok", [name]))).ok;

  test("pending/ only for a pending version, by editors", async () => {
    const { file } = await newAsset();
    expect(await writable(editor, `pending/${file}/original.png`)).toBe(true);
    expect(await writable(editor, `pending/${file}/w640.webp`)).toBe(true);
    expect(await writable(alice, `pending/${file}/original.png`)).toBe(false);
    expect(await writable(null, `pending/${file}/original.png`)).toBe(false);
    expect(await writable(editor, `pending/${randomUUID()}/original.png`)).toBe(false);
    expect(await writable(editor, `pending/${file}/evil.html`)).toBe(false);
    expect(await writable(editor, `pending/${file}/../x/original.png`)).toBe(false);
    expect(await writable(editor, `other/${file}/original.png`)).toBe(false);
  });

  test("assets/ only for a ready version of an approved asset", async () => {
    const { asset, file } = await newAsset();
    expect(await writable(editor, `assets/${file}/original.png`)).toBe(false);
    await scanClean(file);
    await confirm(editor, file);
    await review(scholar, file);
    expect(await writable(editor, `assets/${file}/original.png`)).toBe(false);
    await setStatus(editor, asset, "approved");
    expect(await writable(editor, `assets/${file}/original.png`)).toBe(true);
    expect(await writable(alice, `assets/${file}/original.png`)).toBe(false);
  });
});
