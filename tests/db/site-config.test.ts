// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Admin-editable site content and module flags (migration 20261031002620): who can write, validation, versions, revision notes,
 * the audit trail, revert, and that a flag can only hide: nothing that decides what is public reads these tables.
 */
let db: Db;
let admin: string, editor: string, plain: string;

const save = (who: string, key: string, value: unknown, note = "Fixture edit note") =>
  db.as<{ v: number }>(who, "select public.save_site_setting($1, $2::jsonb, $3) as v", [key, JSON.stringify(value), note]);
const flag = (who: string, key: string, enabled: boolean, note = "Fixture flag note") =>
  db.as<{ v: number }>(who, "select public.save_feature_flag($1, $2, $3) as v", [key, enabled, note]);

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  admin = await db.createUser("admin@test.local", ["admin"]);
  editor = await db.createUser("editor@test.local", ["editor", "scholarly_reviewer", "moderator"]);
  plain = await db.createUser("plain@test.local");
}, 240_000);

describe("who can write", () => {
  test("only an administrator, and only through the functions: no API role can write the tables directly", async () => {
    await rejects(save(editor, "home.hero.title", { en: "Fixture title" }), /only an administrator/);
    await rejects(save(plain, "home.hero.title", { en: "Fixture title" }), /only an administrator/);
    await rejects(flag(editor, "module.stories", false), /only an administrator/);
    await rejects(db.as(null, "select public.save_site_setting('home.hero.title', '{}'::jsonb, 'anon attempt')"), /permission denied/);
    for (const who of [admin, editor, plain, null]) {
      await rejects(db.as(who, "insert into public.site_settings (key, value, revision_note) values ('home.hero.title', '{}'::jsonb, 'direct')"), /permission denied/);
      await rejects(db.as(who, "update public.site_settings set value = '{}'::jsonb"), /permission denied/);
      await rejects(db.as(who, "delete from public.site_settings"), /permission denied/);
      await rejects(db.as(who, "update public.feature_flags set enabled = false"), /permission denied/);
      await rejects(db.as(who, "insert into public.feature_flags (key, enabled, description) values ('module.x', false, 'direct')"), /permission denied/);
      await rejects(db.as(who, "delete from public.feature_flags"), /permission denied/);
    }
  });

  test("history is readable by an administrator only", async () => {
    await save(admin, "home.hero.title", { en: "Fixture one" });
    expect((await db.as(admin, "select 1 from public.site_config_revisions")).length).toBeGreaterThan(0);
    expect(await db.as(editor, "select 1 from public.site_config_revisions")).toEqual([]);
    expect(await db.as(plain, "select 1 from public.site_config_revisions")).toEqual([]);
    await rejects(db.as(null, "select 1 from public.site_config_revisions"), /permission denied/);
    await rejects(db.as(admin, "insert into public.site_config_revisions (kind, key, version, value, note) values ('flag', 'k', 1, '{}'::jsonb, 'forged')"), /permission denied/);
    await rejects(db.as(admin, "delete from public.site_config_revisions"), /permission denied/);
    await rejects(db.as(admin, "update public.site_config_revisions set note = 'rewritten'"), /permission denied/);
  });
});

describe("validation", () => {
  test("only the known keys; text per language within its limit; no HTML, control characters or script links", async () => {
    await rejects(save(admin, "home.secret", { en: "x" }), /unknown site setting/);
    await rejects(save(admin, "site.anything", { en: "x" }), /unknown site setting/);
    await rejects(save(admin, "home.hero.title", { fr: "Bonjour" }), /en, ar or ur only/);
    await rejects(save(admin, "home.hero.title", "just a string"), /object/);
    await rejects(save(admin, "home.hero.title", { en: 5 }), /must be a string/);
    await rejects(save(admin, "home.hero.title", { en: "" }), /1 to 120/);
    await rejects(save(admin, "home.hero.title", { en: "x".repeat(121) }), /1 to 120/);
    await rejects(save(admin, "home.hero.title", { en: "Hello <script>alert(1)</script>" }), /HTML is not allowed/);
    await rejects(save(admin, "home.hero.title", { en: "<b>bold</b>" }), /HTML is not allowed/);
    await rejects(save(admin, "home.hero.title", { en: "line\nbreak" }), /single line/);
    await rejects(save(admin, "home.hero.lead", { en: "bell\u0007" }), /control characters/);
    await rejects(save(admin, "home.intro.body", { en: "[x](javascript:alert(1))" }), /link is not allowed/);
    await rejects(save(admin, "home.intro.body", { en: "[x]( data:text/html,x)" }), /link is not allowed/);
    // Plain text with a comparison sign is fine; a paragraph break is fine in the intro body only.
    await save(admin, "home.hero.title", { en: "Fixture 3 < 5 and more", ar: "عنوان تجريبي", ur: "تجرباتی عنوان" });
    await save(admin, "home.intro.body", { en: "First paragraph.\n\nSecond, with [a link](/methodology)." });
  });

  test("the Explore order is a list of distinct site paths", async () => {
    await rejects(save(admin, "nav.explore.order", { hrefs: ["https://evil.test/"] }), /site path/);
    await rejects(save(admin, "nav.explore.order", { hrefs: ["//evil.test"] }), /site path/);
    await rejects(save(admin, "nav.explore.order", { hrefs: ["//x"] }), /site path/);
    await rejects(save(admin, "nav.explore.order", { hrefs: ["/a//b"] }), /site path/);
    await rejects(save(admin, "nav.explore.order", { hrefs: ["/stories", "/stories"] }), /listed twice/);
    await rejects(save(admin, "nav.explore.order", { hrefs: Array.from({ length: 41 }, (_, i) => `/p${i}`) }), /at most 40/);
    await rejects(save(admin, "nav.explore.order", { hrefs: ["/stories"], extra: 1 }), /order is/);
    await rejects(save(admin, "nav.explore.order", ["/stories"]), /order is/);
    await save(admin, "nav.explore.order", { hrefs: ["/stories", "/prophets"] });
  });

  test("module flag keys are module.<name> and need a revision note", async () => {
    await rejects(flag(admin, "accounts", false), /module flag key/);
    await rejects(flag(admin, "module.Bad Key", false), /module flag key/);
    await rejects(flag(admin, "module.stories", false, "no"), /revision note/);
    await rejects(flag(admin, "module.stories", false, ""), /revision note/);
    await rejects(save(admin, "home.hero.title", { en: "Fixture" }, "   "), /revision note/);
    await rejects(save(admin, "home.hero.title", { en: "Fixture" }, "n".repeat(301)), /revision note/);
  });
});

describe("versions, audit and revert", () => {
  test("every change bumps the version, is copied to the history and is audited with its note", async () => {
    const key = "home.hero.kicker";
    expect((await save(admin, key, { en: "Fixture kicker A" }, "First wording"))[0]!.v).toBe(1);
    expect((await save(admin, key, { en: "Fixture kicker B" }, "Second wording"))[0]!.v).toBe(2);
    expect((await save(admin, key, { en: "Fixture kicker C" }, "Second wording"))[0]!.v).toBe(3); // the same note twice is fine
    const hist = await db.as<{ version: number; value: { en: string }; note: string; changed_by: string }>(admin, "select version, value, note, changed_by from public.site_config_revisions where kind = 'setting' and key = $1 order by version", [key]);
    expect(hist.map((h) => [h.version, h.value.en, h.changed_by])).toEqual([
      [1, "Fixture kicker A", admin],
      [2, "Fixture kicker B", admin],
      [3, "Fixture kicker C", admin],
    ]);
    const [cur] = await db.admin<{ version: number; updated_by: string }>("select version, updated_by from public.site_settings where key = $1", [key]);
    expect(cur).toEqual({ version: 3, updated_by: admin });
    const log = await db.admin<{ action: string; changes: { version: number; note: string; from: { en: string } | null; to: { en: string } } }>(
      "select action, changes from public.audit_logs where entity_type = 'site_settings' and entity_id = $1 order by id",
      [key],
    );
    expect(log.map((l) => [l.action, l.changes.version, l.changes.note])).toEqual([
      ["insert", 1, "First wording"],
      ["update", 2, "Second wording"],
      ["update", 3, "Second wording"],
    ]);
    expect(log[1]!.changes.from?.en).toBe("Fixture kicker A");
    expect(log[1]!.changes.to.en).toBe("Fixture kicker B");
  });

  test("reverting copies an old version forward as a new version; history is never rewritten", async () => {
    const key = "home.hero.kicker";
    const [r] = await db.as<{ v: number }>(admin, "select public.revert_site_config('setting', $1, 1, 'Back to the first wording') as v", [key]);
    expect(r!.v).toBe(4);
    const [cur] = await db.admin<{ value: { en: string }; revision_note: string }>("select value, revision_note from public.site_settings where key = $1", [key]);
    expect(cur!.value.en).toBe("Fixture kicker A");
    expect(cur!.revision_note).toMatch(/^Reverted to version 1: Back to the first wording/);
    const hist = await db.admin<{ version: number; value: { en: string } }>("select version, value from public.site_config_revisions where key = $1 order by version", [key]);
    expect(hist.map((h) => h.version)).toEqual([1, 2, 3, 4]);
    expect(hist[1]!.value.en).toBe("Fixture kicker B"); // untouched
    await rejects(db.as(admin, "select public.revert_site_config('setting', $1, 99, 'nope')", [key]), /does not exist/);
    await rejects(db.as(editor, "select public.revert_site_config('setting', $1, 1, 'nope')", [key]), /only an administrator/);
  });

  test("flags are versioned, audited and revertible the same way", async () => {
    expect((await flag(admin, "module.stories", false, "Hide while we rework it"))[0]!.v).toBe(1);
    expect((await flag(admin, "module.stories", true, "Back on"))[0]!.v).toBe(2);
    const [r] = await db.as<{ v: number }>(admin, "select public.revert_site_config('flag', 'module.stories', 1, 'Hide it again') as v");
    expect(r!.v).toBe(3);
    const [f] = await db.admin<{ enabled: boolean; version: number }>("select enabled, version from public.feature_flags where key = 'module.stories'");
    expect(f).toEqual({ enabled: false, version: 3 });
    const log = await db.admin<{ action: string }>("select action from public.audit_logs where entity_type = 'feature_flags' and entity_id = 'module.stories' order by id");
    expect(log.map((l) => l.action)).toEqual(["insert", "update", "update"]);
  });

  test("a reverted value is validated again, and nothing is ever deleted", async () => {
    await rejects(db.admin("delete from public.site_settings"), /never deleted/);
    await rejects(db.admin("delete from public.feature_flags"), /never deleted/);
    await rejects(db.admin("update public.site_settings set value = '{\"en\": \"<b>x</b>\"}'::jsonb, revision_note = 'owner bypass attempt' where key = 'home.hero.kicker'"), /HTML is not allowed/);
  });
});

describe("what visitors can read", () => {
  test("anyone reads the whitelisted presentation values and the flags, and nothing else", async () => {
    const rows = await db.as<{ key: string }>(null, "select key from public.site_settings order by key");
    expect(rows.map((r) => r.key)).toEqual(expect.arrayContaining(["home.hero.kicker", "home.hero.title"]));
    expect((await db.as(null, "select key from public.feature_flags where key = 'module.stories'")).length).toBe(1);
    // A key outside home. and nav. would be invisible even if it existed (the guard also refuses to store one).
    await db.admin("alter table public.site_settings disable trigger site_settings_guard");
    await db.admin("insert into public.site_settings (key, value, revision_note) values ('secret.thing', '{}'::jsonb, 'owner')");
    await db.admin("alter table public.site_settings enable trigger site_settings_guard");
    expect(await db.as(null, "select key from public.site_settings where key = 'secret.thing'")).toEqual([]);
    expect(await db.as(plain, "select key from public.site_settings where key = 'secret.thing'")).toEqual([]);
  });
});

describe("flags can only hide: they never publish or bypass a review guard", () => {
  test("no policy, view or function outside the configuration tables reads site_settings or feature_flags", async () => {
    const policies = await db.admin<{ tablename: string; policyname: string }>(
      `select tablename, policyname from pg_policies where schemaname = 'public'
         and tablename not in ('site_settings', 'feature_flags', 'site_config_revisions')
         and (coalesce(qual, '') ~ '(site_settings|feature_flags|site_config)' or coalesce(with_check, '') ~ '(site_settings|feature_flags|site_config)')`,
    );
    expect(policies).toEqual([]);
    const fns = await db.admin<{ proname: string }>(
      `select proname from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~ '(site_settings|feature_flags)'
         and proname not in ('site_config_guard', 'site_config_track', 'save_site_setting', 'save_feature_flag', 'revert_site_config')`,
    );
    expect(fns).toEqual([]);
    const views = await db.admin<{ viewname: string }>("select viewname from pg_views where schemaname = 'public' and definition ~ '(site_settings|feature_flags)'");
    expect(views).toEqual([]);
  });

  test("hiding or showing a module changes nothing about what a visitor may read", async () => {
    const asker = await db.createUser("asker@test.local");
    const [q] = await db.as<{ id: string }>(asker, "insert into public.mufti_questions (asker_id, title, body) values ($1, 'Fixture flagged question', 'A fixture question body long enough.') returning id", [asker]);
    const visible = (who: string | null) => db.as(who, "select id from public.mufti_questions where id = $1", [q!.id]);
    expect(await visible(null)).toEqual([]); // submitted: not public yet
    expect(await visible(plain)).toEqual([]);
    for (const on of [true, false, true]) {
      await flag(admin, "module.community_questions", on, "Fixture toggle");
      expect(await visible(null)).toEqual([]); // enabling a flag publishes nothing
      expect(await visible(plain)).toEqual([]);
      expect((await visible(asker)).length).toBe(1);
    }
    await db.as(editor, "update public.mufti_questions set status = 'accepted' where id = $1", [q!.id]);
    await flag(admin, "module.community_questions", false, "Hidden from menus");
    expect((await visible(null)).length).toBe(1); // hidden from the menu does not make accepted content private either
  });
});
