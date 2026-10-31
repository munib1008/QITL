// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Media Library: video clips (WebM / MP4). Clips reuse the image workflow unchanged (scan, non-figurative confirmation,
 * religious review, approval stamp, publish guards, no self-review); these tests prove the new type rules and that the
 * old gates still hold for a clip. Every file is a fixture row; nothing is uploaded.
 */
let db: Db;
let editor: string, scholar: string, alice: string;
let clearedSource: string;

const one = async <T = { id: string }>(p: Promise<T[]>) => (await p)[0]!;
const sha = "c".repeat(64);
const DESC = "A slow pan across a desert horizon at dusk, no people";

interface ClipOpts {
  mime?: string;
  ext?: string;
  kind?: string;
  alt?: string;
  caption?: string | null;
  bytes?: number;
  by?: string;
}

async function newClip(o: ClipOpts = {}): Promise<{ asset: string; file: string }> {
  const { mime = "video/webm", ext = "webm", kind = "video", alt = DESC, caption = "A desert horizon", bytes = 500_000, by = editor } = o;
  const fileId = randomUUID();
  const asset = (
    await one(
      db.as<{ id: string }>(
        by,
        "insert into public.assets (storage_path, kind, alt_text, caption_en, credit, source_id, mime_type, bytes, category) values ($1, $2, $3, $4, 'Fixture credit', $5, $6, $7, 'landscape') returning id",
        [`pending/${fileId}/original.${ext}`, kind, alt, caption, clearedSource, mime, bytes],
      ),
    )
  ).id;
  const file = (
    await one(
      db.as<{ id: string }>(
        by,
        "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height, variants) values ($1, $2, 1, $3, $4, $5, $6, 640, 360, '[]') returning id",
        [fileId, asset, `pending/${fileId}/original.${ext}`, mime, bytes, sha],
      ),
    )
  ).id;
  await db.as(by, "update public.assets set file_id = $1 where id = $2", [file, asset]);
  return { asset, file };
}

const scanClean = (file: string) => db.admin("update public.asset_files set scan_status = 'clean', scan_engine = 'fixture', scanned_at = now() where id = $1", [file]);
const confirm = (file: string) => db.as(editor, "update public.asset_files set non_figurative_confirmed = true where id = $1", [file]);
const review = (file: string, decision = "approved") =>
  db.as(scholar, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('media_file', $1, $2, $3)", [file, scholar, decision]);
const setStatus = (asset: string, status: string) => db.as(editor, "update public.assets set status = $1 where id = $2", [status, asset]);
const activate = (file: string) => db.as(editor, "update public.asset_files set state = 'active', storage_path = replace(storage_path, 'pending/', 'assets/') where id = $1", [file]);

beforeAll(async () => {
  db = await createDb();
  editor = await db.createUser("editor@test.local", ["editor"]);
  scholar = await db.createUser("scholar@test.local", ["scholarly_reviewer"]);
  alice = await db.createUser("alice@test.local");
  clearedSource = (await one(db.admin<{ id: string }>("insert into public.sources (type, work, rights_status, attribution) values ('other', 'Fixture cleared clips', 'cleared', 'Fixture attribution') returning id"))).id;
}, 300_000);

describe("video clips", () => {
  test("a WebM and an MP4 clip can be created as drafts, pending, unscanned and unconfirmed", async () => {
    for (const [mime, ext] of [
      ["video/webm", "webm"],
      ["video/mp4", "mp4"],
    ] as const) {
      const { asset, file } = await newClip({ mime, ext });
      const f = await one(
        db.as<{ state: string; scan_status: string; non_figurative_confirmed: boolean; mime_type: string }>(editor, "select state, scan_status, non_figurative_confirmed, mime_type from public.asset_files where id = $1", [file]),
      );
      expect(f).toEqual({ state: "pending", scan_status: "not_scanned", non_figurative_confirmed: false, mime_type: mime });
      const a = await one(db.as<{ kind: string; status: string; storage_path: string }>(editor, "select kind, status, storage_path from public.assets where id = $1", [asset]));
      expect(a).toEqual({ kind: "video", status: "draft", storage_path: `pending/${file}/original.${ext}` });
    }
  });

  test("only editors upload a clip", async () => {
    await rejects(newClip({ by: alice }), /row-level security|permission denied/);
  });

  test("a type outside the list is refused by the assets and file tables", async () => {
    await rejects(newClip({ mime: "video/ogg", ext: "ogv" }), /violates check constraint/);
    await rejects(newClip({ mime: "video/quicktime", ext: "mov" }), /violates check constraint/);
    await rejects(newClip({ mime: "video/x-matroska", ext: "mkv" }), /violates check constraint/);
    await rejects(newClip({ mime: "audio/mpeg", ext: "mp3", kind: "image" }), /violates check constraint/);
    // The extension must match the type.
    await rejects(newClip({ mime: "video/webm", ext: "mp4" }), /violates check constraint/);
    await rejects(newClip({ mime: "video/mp4", ext: "webm" }), /violates check constraint/);
    // A file row alone is checked too.
    const { asset } = await newClip();
    const id = randomUUID();
    await rejects(
      db.as(editor, "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height) values ($1, $2, 1, $3, 'video/ogg', 10, $4, 10, 10)", [id, asset, `pending/${id}/original.ogv`, sha]),
      /violates check constraint/,
    );
  });

  test("a clip over 8 MB is refused; an image keeps its 10 MB rule", async () => {
    await rejects(newClip({ bytes: 8 * 1024 * 1024 + 1 }), /violates check constraint/);
    await newClip({ bytes: 8 * 1024 * 1024 });
    const fileId = randomUUID();
    const asset = (
      await one(
        db.as<{ id: string }>(
          editor,
          "insert into public.assets (storage_path, kind, alt_text, credit, source_id, mime_type, bytes, category) values ($1, 'image', 'A big picture', 'Fixture credit', $2, 'image/png', $3, 'pattern') returning id",
          [`pending/${fileId}/original.png`, clearedSource, 10 * 1024 * 1024],
        ),
      )
    ).id;
    await db.as(editor, "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height) values ($1, $2, 1, $3, 'image/png', $4, $5, 800, 600)", [
      fileId,
      asset,
      `pending/${fileId}/original.png`,
      10 * 1024 * 1024,
      sha,
    ]);
  });

  test("a clip carries no renditions", async () => {
    const { asset } = await newClip();
    const id = randomUUID();
    await rejects(
      db.as(editor, "insert into public.asset_files (id, asset_id, version, storage_path, mime_type, bytes, sha256, width, height, variants) values ($1, $2, 1, $3, 'video/webm', 10, $4, 10, 10, $5)", [
        id,
        asset,
        `pending/${id}/original.webm`,
        sha,
        JSON.stringify([{ w: 320, h: 180, name: "w320.webp" }]),
      ]),
      /violates check constraint/,
    );
  });

  test("a clip needs a real description and a caption (more than an image needs for alt text)", async () => {
    await rejects(newClip({ alt: "Desert" }), /violates check constraint/);
    await rejects(newClip({ caption: null }), /violates check constraint/);
    await rejects(newClip({ caption: "  " }), /violates check constraint/);
    // They cannot be removed afterwards either.
    const { asset } = await newClip();
    await rejects(db.as(editor, "update public.assets set alt_text = 'Short' where id = $1", [asset]), /violates check constraint/);
    await rejects(db.as(editor, "update public.assets set caption_en = null where id = $1", [asset]), /violates check constraint/);
    // An image still needs only 3 characters of alt text.
    const fileId = randomUUID();
    await db.as(editor, "insert into public.assets (storage_path, kind, alt_text, credit, source_id, mime_type, bytes, category) values ($1, 'image', 'abc', 'Fixture credit', $2, 'image/png', 10, 'pattern')", [
      `pending/${fileId}/original.png`,
      clearedSource,
    ]);
  });

  test("a video asset and an image asset cannot swap kind", async () => {
    const { asset } = await newClip();
    await rejects(db.as(editor, "update public.assets set kind = 'image' where id = $1", [asset]), /violates check constraint/);
    await rejects(newClip({ kind: "image" }), /violates check constraint/);
  });

  test("anon and signed-in readers never see a draft clip, its file or the public view", async () => {
    const { asset, file } = await newClip();
    expect(await db.as(null, "select id from public.assets where id = $1", [asset])).toEqual([]);
    expect(await db.as(null, "select id from public.asset_files where id = $1", [file])).toEqual([]);
    expect(await db.as(null, "select id from public.media_public where id = $1", [asset])).toEqual([]);
    expect(await db.as(alice, "select id from public.assets where id = $1", [asset])).toEqual([]);
    expect(await db.as(alice, "select id from public.asset_files where id = $1", [file])).toEqual([]);
  });

  test("a clip cannot be approved or published without scan, confirmation and an approving review", async () => {
    const { asset, file } = await newClip();
    await rejects(setStatus(asset, "published"), /publishing needs an approved asset/);
    await rejects(setStatus(asset, "approved"), /approval needs/);
    await scanClean(file);
    await rejects(setStatus(asset, "approved"), /approval needs/);
    await confirm(file);
    await rejects(setStatus(asset, "approved"), /approval needs/);
    await review(file, "changes_requested");
    await rejects(setStatus(asset, "approved"), /approval needs/);
    await rejects(activate(file), /goes public only when/);
  });

  test("a reviewer cannot review a clip they uploaded", async () => {
    const admin = await db.createUser("admin-v@test.local", ["admin"]);
    const { file } = await newClip({ by: admin });
    await rejects(
      db.as(admin, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('media_file', $1, $2, 'approved')", [file, admin]),
      /cannot review a file they uploaded/,
    );
  });

  test("the full path publishes a clip; only then is it public, with its type", async () => {
    const { asset, file } = await newClip({ mime: "video/mp4", ext: "mp4" });
    await scanClean(file);
    await confirm(file);
    await review(file);
    await setStatus(asset, "approved");
    await activate(file);
    await setStatus(asset, "published");
    const pub = await one(
      db.as<{ kind: string; mime_type: string; storage_path: string; alt_text: string; caption_en: string; credit: string; variants: unknown[] }>(
        null,
        "select kind, mime_type, storage_path, alt_text, caption_en, credit, variants from public.media_public where id = $1",
        [asset],
      ),
    );
    expect(pub.kind).toBe("video");
    expect(pub.mime_type).toBe("video/mp4");
    expect(pub.storage_path).toBe(`assets/${file}/original.mp4`);
    expect(pub.alt_text).toBe(DESC);
    expect(pub.caption_en).toBe("A desert horizon");
    expect(pub.credit).toBe("Fixture credit");
    expect(pub.variants).toEqual([]);
    // The published clip cannot be edited in place.
    await rejects(db.as(editor, "update public.assets set alt_text = $2 where id = $1", [asset, DESC + " and more words"]), /cannot be edited in place/);
  });

  test("the storage path rule accepts the clip names and still refuses others", async () => {
    const { file } = await newClip();
    const ok = (name: string) => db.as<{ ok: boolean }>(editor, "select public.media_object_writable($1) as ok", [name]).then((r) => r[0]!.ok);
    expect(await ok(`pending/${file}/original.webm`)).toBe(true);
    expect(await ok(`pending/${file}/original.mp4`)).toBe(true);
    expect(await ok(`pending/${file}/original.mov`)).toBe(false);
    expect(await ok(`pending/${file}/original.mkv`)).toBe(false);
    expect(await ok(`pending/${file}/w320.webm`)).toBe(false);
    expect(await ok(`assets/${file}/original.webm`)).toBe(false); // not ready
  });
});
