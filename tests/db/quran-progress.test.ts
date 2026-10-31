// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/** Quran reading progress (migration 20261031002300): owner-only, range-checked, one place per surah, exported. */
let db: Db;
let alice: string, bob: string;

beforeAll(async () => {
  db = await createDb();
  alice = await db.createUser("alice@test.local");
  bob = await db.createUser("bob@test.local");
}, 180_000);

describe("quran_reading_progress", () => {
  test("a reader keeps one place per surah and moves it freely (backwards too)", async () => {
    await db.as(alice, "insert into public.quran_reading_progress (surah, ayah) values (2, 100)");
    await db.as(alice, "insert into public.quran_reading_progress (surah, ayah) values (2, 40) on conflict (user_id, surah) do update set ayah = excluded.ayah");
    const rows = await db.as<{ surah: number; ayah: number; user_id: string }>(alice, "select surah, ayah, user_id from public.quran_reading_progress");
    expect(rows).toEqual([{ surah: 2, ayah: 40, user_id: alice }]);
  });

  test("nobody else can read or change it, and anon sees nothing", async () => {
    expect(await db.as(bob, "select * from public.quran_reading_progress")).toHaveLength(0);
    await db.as(bob, "update public.quran_reading_progress set ayah = 1 where user_id = $1", [alice]);
    expect((await db.as<{ ayah: number }>(alice, "select ayah from public.quran_reading_progress where surah = 2"))[0]!.ayah).toBe(40);
    await rejects(db.as(bob, "insert into public.quran_reading_progress (user_id, surah, ayah) values ($1, 3, 1)", [alice]), /row-level security/);
    await rejects(db.as(null, "select * from public.quran_reading_progress"), /permission denied/);
  });

  test("references out of range are refused", async () => {
    await rejects(db.as(alice, "insert into public.quran_reading_progress (surah, ayah) values (115, 1)"), /check constraint/);
    await rejects(db.as(alice, "insert into public.quran_reading_progress (surah, ayah) values (1, 0)"), /check constraint/);
    await rejects(db.as(alice, "insert into public.quran_reading_progress (surah, ayah) values (2, 287)"), /check constraint/);
  });

  test("the export returns the owner's places only", async () => {
    await db.as(bob, "insert into public.quran_reading_progress (surah, ayah) values (18, 10)");
    const [{ x }] = (await db.as<{ x: Array<{ surah: number; ayah: number }> }>(alice, "select public.export_my_quran_progress() as x")) as [{ x: Array<{ surah: number; ayah: number }> }];
    expect(x.map((r) => [r.surah, r.ayah])).toEqual([[2, 40]]);
    await rejects(db.as(null, "select public.export_my_quran_progress()"), /permission denied/);
  });

  test("deleting the account deletes the places", async () => {
    await db.admin("delete from auth.users where id = $1", [bob]);
    expect(await db.admin("select * from public.quran_reading_progress where user_id = $1", [bob])).toHaveLength(0);
  });
});
