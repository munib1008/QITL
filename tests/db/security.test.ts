// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, rejects, type Db } from "./harness";

/**
 * Security sweep over EVERY table of the public schema (docs/SECURITY.md), on a database that replays Supabase's own
 * default privileges (every new table granted to anon and authenticated), so a module that forgets to revoke is caught:
 *
 *   1. grants: anon can write nothing; no API role can TRUNCATE or write through a view; every write verb granted to
 *      authenticated is backed by a policy.
 *   2. visibility: for every SELECT policy, a draft / someone-else's row (a synthetic row: status 'draft' or the like,
 *      every id random) is invisible to anon and to a signed-in user without staff roles, unless the table is listed
 *      below as public by design. A new table fails here until it is classified.
 *   3. roles: no role can grant itself (or anyone) a role, change one, or verify / qualify itself; no function callable
 *      through the API writes role_assignments.
 *   4. self-approval: a reviewer never reviews their own work, in every module; every review type maps to its author.
 *   5. retention and throttling: the pg_cron schedule is a no-op without pg_cron; the purge and throttle functions work.
 * Fixture text is a labelled placeholder, never religious text.
 */

let db: Db;
let plain: string, other: string, editorReviewer: string, reviewer: string, admin: string;

beforeAll(async () => {
  db = await createDb({ supabaseDefaults: true });
  plain = await db.createUser("plain@test.local");
  other = await db.createUser("other@test.local");
  editorReviewer = await db.createUser("both@test.local", ["editor", "scholarly_reviewer"]);
  reviewer = await db.createUser("reviewer@test.local", ["scholarly_reviewer"]);
  admin = await db.createUser("admin@test.local", ["admin"]);
}, 240_000);

const API_ROLES = ["anon", "authenticated"] as const;

/**
 * Tables any visitor may read whatever the row (catalogue, reference and link tables, public profiles), each with the
 * reason it is safe. Everything else must hide a draft or another person's row.
 */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  approximate_polygon_constraints: "geometry rules, no content",
  hadith_collections: "catalogue",
  hadith_books: "catalogue",
  hadith_chapters: "catalogue",
  quran_surahs: "verified source text catalogue",
  quran_verses: "verified source text (Tanzil), immutable",
  sources: "bibliographic catalogue",
  source_versions: "checksums of imported sources",
  content_versions: "version history of published entities",
  content_permissions: "licence registry, metadata only (no copyrighted text); admins write",
  profiles: "public display names; private fields are owner-only columns",
  claim_references: "link table, follows its claim",
  person_aliases: "link table, follows its person",
  event_people: "link table",
  event_places: "link table",
  event_relationships: "link table",
  event_claims: "link table",
  chapter_claims: "link table",
  event_stories: "link table",
  taggings: "link table",
  asset_links: "link table",
  topics: "taxonomy",
  event_universe_stats: "per-track counts only (published, under review); no titles or content",
  encyclopedia_stats: "counts only (published, under review) of hadith stories, people and communities; no titles or content",
  translator_profiles: "translator biographies",
  translation_editions: "edition catalogue; the text itself is licence-gated",
  riwayat: "reference catalogue of riwayat",
  creation_categories: "taxonomy",
  lifestyle_record_types: "module registry",
  quran_text_editions: "edition registry metadata, no text",
  feature_flags: "public switches for unbuilt features; admins write",
  site_settings: "public site configuration (no secrets are stored here); admins write",
  reactions: "public reaction counts on visible comments, like the comments themselves",
  search_index: "only published entities are ever indexed (index_* triggers delete on unpublish)",
  story_publication_versions: "snapshots written only when a script is published",
};

/** A value that is not public in any module: drafts, submissions, pending QA. */
const DRAFT_STATUS = "draft";

interface Col {
  name: string;
  type: string;
}

async function columns(table: string): Promise<Col[]> {
  return db.admin<Col>(
    `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
     from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = $1 and a.attnum > 0 and not a.attisdropped order by a.attnum`,
    [table],
  );
}

/** A synthetic row: status-like columns set to a draft value, uuids random (owned by nobody here), the rest NULL. */
function syntheticRow(table: string, cols: Col[]): string {
  const vals = cols.map((c) => {
    let v = "null";
    if (c.type === "uuid") v = "gen_random_uuid()";
    else if (/^(status|review_status)$/.test(c.name) && /text|character/.test(c.type)) v = `'${DRAFT_STATUS}'`;
    else if (c.type === "boolean" && /^(public|published|is_public|active)$/.test(c.name)) v = "false";
    // Not approved, verified or published by anyone yet.
    if (/^(approved|verified|reviewed|published|qualified|dream_qualified)_(by|at)$/.test(c.name)) v = "null";
    return `${v}::${c.type} as "${c.name}"`;
  });
  return `(select ${vals.join(", ")}) as "${table}"`;
}

async function tables(kinds = "'r','p'"): Promise<string[]> {
  const rows = await db.admin<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in (${kinds})
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e') order by 1`,
  );
  return rows.map((r) => r.relname);
}

describe("1. grants: least privilege on every table", () => {
  test("every table has row level security enabled and forced", async () => {
    const rows = await db.admin<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r','p') and (not c.relrowsecurity or not c.relforcerowsecurity)
         and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  test("anon holds no write privilege anywhere, and no API role can TRUNCATE", async () => {
    const bad: string[] = [];
    for (const t of await tables("'r','p','v','m'")) {
      for (const role of API_ROLES) {
        const [r] = await db.admin<{ w: boolean; tr: boolean }>(
          `select has_table_privilege($1, format('public.%I', $2::text), 'INSERT, UPDATE, DELETE') as w,
                  has_table_privilege($1, format('public.%I', $2::text), 'TRUNCATE') as tr`,
          [role, t],
        );
        if (role === "anon" && r!.w) bad.push(`${t}: anon can write`);
        if (r!.tr) bad.push(`${t}: ${role} can truncate`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("anon really is refused: insert, update and delete on every table fail with permission denied", async () => {
    const bad: string[] = [];
    for (const t of await tables()) {
      const [col] = await db.admin<{ c: string }>(
        `select a.attname as c from pg_attribute a join pg_class k on k.oid = a.attrelid join pg_namespace n on n.oid = k.relnamespace
         where n.nspname = 'public' and k.relname = $1 and a.attnum > 0 and not a.attisdropped and a.attidentity = '' and a.attgenerated = '' order by a.attnum limit 1`,
        [t],
      );
      const c = col!.c;
      for (const sql of [`insert into public."${t}" default values`, `update public."${t}" set "${c}" = "${c}" where false`, `delete from public."${t}" where false`]) {
        try {
          await db.as(null, sql);
          bad.push(`${t}: ${sql.split(" ")[0]} allowed`);
        } catch (e) {
          if (!/permission denied/.test((e as Error).message)) bad.push(`${t}: ${(e as Error).message}`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  test("no API role can write through a view", async () => {
    const bad: string[] = [];
    for (const v of await tables("'v','m'"))
      for (const role of API_ROLES) {
        const [r] = await db.admin<{ w: boolean }>(`select has_table_privilege($1, format('public.%I', $2::text), 'INSERT, UPDATE, DELETE') as w`, [role, v]);
        if (r!.w) bad.push(`${v}: ${role}`);
      }
    expect(bad).toEqual([]);
  });

  test("views run with the caller's rights (security_invoker), so RLS applies through them", async () => {
    const rows = await db.admin<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'v' and not coalesce(c.reloptions::text like '%security_invoker=true%', false)
         and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  test("every write verb granted to authenticated is backed by a policy", async () => {
    const bad: string[] = [];
    for (const t of await tables())
      for (const verb of ["INSERT", "UPDATE", "DELETE"]) {
        const [r] = await db.admin<{ granted: boolean; policy: boolean }>(
          `select has_table_privilege('authenticated', format('public.%I', $1::text), $2) as granted,
                  exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = $1 and p.cmd in ($2, 'ALL')
                          and p.roles && array['authenticated', 'public']::name[]) as policy`,
          [t, verb],
        );
        if (r!.granted && !r!.policy) bad.push(`${t}: ${verb}`);
      }
    expect(bad).toEqual([]);
  });

  test("upserted tables keep both their insert and update paths (the grants sweep must not break them)", async () => {
    for (const t of ["reading_progress", "story_playback_progress", "story_playback_preferences", "private_notes", "dream_privacy_preferences", "scene_claim_references"]) {
      const [r] = await db.admin<{ i: boolean; u: boolean }>(
        `select has_table_privilege('authenticated', format('public.%I', $1::text), 'INSERT') as i, has_table_privilege('authenticated', format('public.%I', $1::text), 'UPDATE') as u`,
        [t],
      );
      expect({ t, ...r }).toEqual({ t, i: true, u: true });
    }
  });

  test("no SECURITY DEFINER function is callable by anon unless it only answers a yes/no visibility question", async () => {
    const rows = await db.admin<{ proname: string; ret: string }>(
      `select p.proname, format_type(p.prorettype, null) as ret from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')`,
    );
    // Visibility helpers used inside policies return booleans; unsubscribe() takes an unguessable token.
    expect(rows.filter((r) => r.ret !== "boolean" && r.proname !== "unsubscribe").map((r) => r.proname)).toEqual([]);
    // The licence-gated edition text is never readable through a definer function.
    const [r] = await db.admin<{ ok: boolean }>("select has_function_privilege('authenticated', 'public.quran_edition_ayah(uuid, smallint, smallint)', 'execute') as ok");
    expect(r!.ok).toBe(false);
  });
});

describe("2. visibility: drafts and other people's rows stay hidden", () => {
  test("every SELECT policy hides a synthetic draft / someone-else's row from anon and from a non-staff user", async () => {
    const policies = await db.admin<{ tablename: string; policyname: string; roles: string[] | string; qual: string | null }>(
      `select tablename, policyname, roles::text[] as roles, qual from pg_policies
       where schemaname = 'public' and cmd in ('SELECT', 'ALL') and permissive = 'PERMISSIVE' order by tablename, policyname`,
    );
    const leaks: string[] = [];
    const colCache = new Map<string, Col[]>();
    for (const p of policies) {
      if (PUBLIC_BY_DESIGN[p.tablename] !== undefined) continue;
      const roles = Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, "").split(",");
      if (!colCache.has(p.tablename)) colCache.set(p.tablename, await columns(p.tablename));
      const from = syntheticRow(p.tablename, colCache.get(p.tablename)!);
      const qual = p.qual ?? "true";
      for (const [who, uid] of [["anon", null], ["user", plain]] as const) {
        if (!roles.includes("public") && !roles.includes(who === "anon" ? "anon" : "authenticated")) continue;
        try {
          const [r] = await db.as<{ visible: boolean | null }>(uid, `select (${qual}) as visible from ${from}`);
          if (r?.visible === true) leaks.push(`${p.tablename}.${p.policyname} shows a draft/foreign row to ${who}`);
        } catch (e) {
          // Anon may lack SELECT on the table itself: then nothing is visible, which is the point.
          if (!/permission denied/.test((e as Error).message)) leaks.push(`${p.tablename}.${p.policyname}: ${(e as Error).message}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  }, 180_000);

  test("the public-by-design list names only tables that exist", async () => {
    const all = new Set(await tables());
    const stale = Object.keys(PUBLIC_BY_DESIGN).filter((t) => PUBLIC_BY_DESIGN[t] && !all.has(t));
    expect(stale).toEqual([]);
  });

  test("personal tables are unreadable by anon at the grant level", async () => {
    const personal = [
      "bookmarks", "reading_progress", "private_notes", "saved_collections", "saved_collection_items", "notifications",
      "notification_prefs", "legal_acceptances", "data_jobs", "user_blocks", "reports", "appeals", "role_assignments",
      "rate_limit_events", "audit_logs", "story_playback_progress", "story_playback_preferences", "dream_requests",
      "dream_request_consents", "dream_request_status_history", "dream_privacy_preferences", "dream_second_opinions",
      "mufti_question_follows", "translation_comparisons",
    ];
    const readable: string[] = [];
    for (const t of personal) {
      const [r] = await db.admin<{ ok: boolean | null }>(`select case when to_regclass(format('public.%I', $1::text)) is null then null else has_table_privilege('anon', format('public.%I', $1::text), 'SELECT') end as ok`, [t]);
      if (r!.ok) readable.push(t);
    }
    expect(readable).toEqual([]);
  });

  test("real rows: a non-staff user and anon see no draft guidance topic, interpretation or creation profile", async () => {
    const [topic] = await db.as<{ id: string }>(editorReviewer, "insert into public.guidance_topics (slug, title_en, title_ar) values ('sec-draft-topic', 'Fixture topic', 'x x') returning id");
    const [exp] = await db.as<{ id: string }>(
      editorReviewer,
      "insert into public.interpretation_explanations (surah_id, ayah_from, ayah_to, language, title, body_md, origin, created_by) values (1, 1, 1, 'en', 'Fixture', 'Fixture draft', 'human', $1) returning id",
      [editorReviewer],
    );
    const [prof] = await db.as<{ id: string }>(editorReviewer, "insert into public.creation_profiles (category_id, slug, name_en, name_ar) values ('angels', 'sec-angels', 'Fixture', 'x') returning id");
    for (const [table, id] of [["guidance_topics", topic!.id], ["interpretation_explanations", exp!.id], ["creation_profiles", prof!.id]] as const) {
      expect(await db.as(plain, `select id from public.${table} where id = $1`, [id])).toHaveLength(0);
      expect(await db.as(null, `select id from public.${table} where id = $1`, [id])).toHaveLength(0);
      expect(await db.as(editorReviewer, `select id from public.${table} where id = $1`, [id])).toHaveLength(1);
    }
  });
});

describe("3. roles: nobody grants themselves a role", () => {
  test("a user with any non-admin role cannot grant a role to themselves or to anyone", async () => {
    const roles = (await db.admin<{ r: string }>("select unnest(enum_range(null::public.app_role))::text as r")).map((x) => x.r).filter((r) => r !== "user");
    for (const held of roles.filter((r) => r !== "admin")) {
      const u = await db.createUser(`holds-${held}@test.local`, [held]);
      for (const wanted of roles) {
        await rejects(db.as(u, "insert into public.role_assignments (user_id, role, granted_by) values ($1, $2::public.app_role, $1)", [u, wanted]), /row-level security|permission denied|duplicate key/);
        await rejects(db.as(u, "insert into public.role_assignments (user_id, role, granted_by) values ($1, $2::public.app_role, $3)", [other, wanted, u]), /row-level security|permission denied/);
      }
      await rejects(db.as(u, "update public.role_assignments set role = 'admin' where user_id = $1", [u]), /permission denied/);
      // Deleting their own role (or anyone's) changes nothing.
      await db.as(u, "delete from public.role_assignments where user_id = $1", [u]).catch(() => undefined);
      expect(await db.admin("select 1 from public.role_assignments where user_id = $1 and role = $2::public.app_role", [u, held])).toHaveLength(1);
    }
  }, 120_000);

  test("a signed-in user without roles cannot grant one", async () => {
    await rejects(db.as(plain, "insert into public.role_assignments (user_id, role, granted_by) values ($1, 'admin', $1)", [plain]), /row-level security|permission denied/);
  });

  test("an admin grants only in their own name and cannot revoke their own admin role", async () => {
    await rejects(db.as(admin, "insert into public.role_assignments (user_id, role, granted_by) values ($1, 'editor', $2)", [plain, other]), /row-level security/);
    await db.as(admin, "delete from public.role_assignments where user_id = $1 and role = 'admin'", [admin]);
    expect(await db.admin("select 1 from public.role_assignments where user_id = $1 and role = 'admin'", [admin])).toHaveLength(1);
  });

  test("no function callable through the API writes role_assignments", async () => {
    const rows = await db.admin<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
         and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
         and p.prosrc ~* '(insert\\s+into|update|delete\\s+from)\\s+(public\\.)?role_assignments'`,
    );
    expect(rows).toEqual([]);
  });

  test("a mufti cannot verify themselves or grant themselves the dream qualification", async () => {
    const m = await db.createUser("self-mufti@test.local", ["mufti"]);
    await rejects(db.as(m, "insert into public.mufti_profiles (user_id, display_name, credentials_md, verified_at) values ($1, 'x', 'y', now())", [m]), /row-level security/);
    await db.as(m, "insert into public.mufti_profiles (user_id, display_name, credentials_md) values ($1, 'Fixture', 'Fixture credentials')", [m]);
    await rejects(db.as(m, "update public.mufti_profiles set verified_at = now() where user_id = $1", [m]), /row-level security|only an admin/);
    await rejects(db.as(m, "update public.mufti_profiles set dream_qualified_by = $1, dream_qualified_at = now() where user_id = $1", [m]), /row-level security|admin|verified/);
    const [p] = await db.admin<{ verified_at: string | null; dream_qualified_at: string | null }>("select verified_at, dream_qualified_at from public.mufti_profiles where user_id = $1", [m]);
    expect(p).toEqual({ verified_at: null, dream_qualified_at: null });
  });

  test("only an admin approves a content permission", async () => {
    const [before] = await db.admin<{ id: string; status: string }>("select id, status from public.content_permissions where status <> 'APPROVED' limit 1");
    await db.as(editorReviewer, "update public.content_permissions set status = 'APPROVED' where id = $1", [before!.id]).catch(() => undefined);
    const [after] = await db.admin<{ status: string }>("select status from public.content_permissions where id = $1", [before!.id]);
    expect(after!.status).toBe(before!.status);
  });
});

describe("4. no self-approval, in every module", () => {
  test("every review type maps to its author's table, or has no author column by design", async () => {
    const NO_AUTHOR_COLUMN = new Set(["chapter", "person", "qiraat_reader", "qiraat_riwayah"]);
    const rows = await db.admin<{ type: string }>(
      "select t.type from public.review_entity_types t where not exists (select 1 from public.review_entity_authors a where a.entity_type = t.type) order by 1",
    );
    expect(rows.map((r) => r.type).filter((t) => !NO_AUTHOR_COLUMN.has(t))).toEqual([]);
    // Each mapping points at a real uuid id and a real author column.
    const broken = await db.admin<{ entity_type: string; table_name: string }>(
      `select a.entity_type, a.table_name from public.review_entity_authors a
       where not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = a.table_name and c.column_name = a.author_column)
          or not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = a.table_name and c.column_name = 'id' and c.data_type = 'uuid')`,
    );
    expect(broken).toEqual([]);
  });

  async function selfReview(type: string, id: string) {
    return db.as(editorReviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ($1, $2, $3, 'approved')", [type, id, editorReviewer]);
  }

  test("an editor who is also a reviewer cannot approve their own guidance topic, lesson, interpretation, script or creation entry", async () => {
    const [topic] = await db.as<{ id: string }>(editorReviewer, "insert into public.guidance_topics (slug, title_en, title_ar) values ('sec-self-topic', 'Fixture topic', 'x x') returning id");
    const [lesson] = await db.as<{ id: string }>(editorReviewer, "insert into public.guidance_lessons (topic_id, title_en, application_en) values ($1, 'Fixture lesson', 'Fixture application text') returning id", [topic!.id]);
    const [exp] = await db.as<{ id: string }>(
      editorReviewer,
      "insert into public.interpretation_explanations (surah_id, ayah_from, ayah_to, language, title, body_md, origin, created_by) values (1, 1, 1, 'en', 'Fixture', 'Fixture draft', 'human', $1) returning id",
      [editorReviewer],
    );
    const [prof] = await db.as<{ id: string }>(editorReviewer, "insert into public.creation_profiles (category_id, slug, name_en, name_ar) values ('jinn', 'sec-self-jinn', 'Fixture', 'x') returning id");
    const [person] = await db.as<{ id: string }>(editorReviewer, "insert into public.people (slug, name_en, name_ar, kind) values ('sec-fixture', 'Fixture', 'x', 'prophet') returning id");
    const [script] = await db.as<{ id: string }>(editorReviewer, "insert into public.story_scripts (person_id, title, origin, created_by) values ($1, 'Fixture script', 'human', $2) returning id", [person!.id, editorReviewer]);

    for (const [type, id] of [["guidance_topic", topic!.id], ["guidance_lesson", lesson!.id], ["interpretation", exp!.id], ["creation", prof!.id], ["story_script", script!.id]] as const)
      await rejects(selfReview(type, id), /cannot review their own/);

    // Another reviewer may.
    await db.as(reviewer, "insert into public.editorial_reviews (entity_type, entity_id, reviewer_id, decision) values ('guidance_topic', $1, $2, 'changes_requested')", [topic!.id, reviewer]);
  });

  test("the author column is stamped by the database: not left empty, not someone else, not changed later", async () => {
    const [t1] = await db.as<{ created_by: string }>(editorReviewer, "insert into public.guidance_topics (slug, title_en, title_ar) values ('sec-stamp-1', 'Fixture', 'x x') returning created_by");
    expect(t1!.created_by).toBe(editorReviewer);
    const [t2] = await db.as<{ id: string; created_by: string }>(editorReviewer, "insert into public.guidance_topics (slug, title_en, title_ar, created_by) values ('sec-stamp-2', 'Fixture', 'x x', $1) returning id, created_by", [reviewer]);
    expect(t2!.created_by).toBe(editorReviewer);
    await db.as(editorReviewer, "update public.guidance_topics set created_by = null where id = $1", [t2!.id]);
    expect((await db.admin<{ created_by: string }>("select created_by from public.guidance_topics where id = $1", [t2!.id]))[0]!.created_by).toBe(editorReviewer);
    const triggers = await db.admin<{ n: number }>("select count(*)::int as n from pg_trigger where tgname = 'a0_stamp_author'");
    expect(triggers[0]!.n).toBeGreaterThan(20);
  });

  test("an author cannot sign the substantive checks on their own interpretation", async () => {
    const [exp] = await db.as<{ id: string }>(
      editorReviewer,
      "insert into public.interpretation_explanations (surah_id, ayah_from, ayah_to, language, title, body_md, origin, created_by) values (1, 3, 3, 'en', 'Fixture', 'Fixture draft', 'human', $1) returning id",
      [editorReviewer],
    );
    await rejects(
      db.as(editorReviewer, "insert into public.interpretation_reviews (explanation_id, explanation_version, check_key, passed, reviewer_id) values ($1, 1, 'sunni_scholarly', true, $2)", [exp!.id, editorReviewer]),
      /cannot sign checks on their own/,
    );
  });

  test("the translation self-review guard and the approver stamp are installed", async () => {
    const triggers = await db.admin<{ tgname: string }>(
      "select tgname from pg_trigger where tgname in ('translation_reviews_not_self', 'interpretation_reviews_not_self', 'editorial_reviews_no_self_review', 'narration_audio_stamp_approver', 'scene_ambient_audio_stamp_approver') order by 1",
    );
    expect(triggers.map((t) => t.tgname)).toEqual([
      "editorial_reviews_no_self_review",
      "interpretation_reviews_not_self",
      "narration_audio_stamp_approver",
      "scene_ambient_audio_stamp_approver",
      "translation_reviews_not_self",
    ]);
  });
});

describe("5. retention and throttling", () => {
  test("the pg_cron schedule is a no-op where pg_cron is unavailable (this database)", async () => {
    const [r] = await db.admin<{ cron: string | null }>("select to_regnamespace('cron')::text as cron");
    expect(r!.cron).toBeNull();
  });

  test("purge_expired_dream_requests is callable by the service role only", async () => {
    const [r] = await db.admin<{ anon: boolean; auth: boolean; svc: boolean }>(
      `select has_function_privilege('anon', 'public.purge_expired_dream_requests()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.purge_expired_dream_requests()', 'execute') as auth,
              has_function_privilege('service_role', 'public.purge_expired_dream_requests()', 'execute') as svc`,
    );
    expect(r).toEqual({ anon: false, auth: false, svc: true });
    const [n] = await db.admin<{ n: number }>("select public.purge_expired_dream_requests() as n");
    expect(n!.n).toBeGreaterThanOrEqual(0);
  });

  test("purge_rate_limit_events deletes only entries older than two days", async () => {
    await db.admin("insert into public.rate_limit_events (user_id, action, at) values ($1, 'test', now() - interval '3 days'), ($1, 'test', now())", [plain]);
    const [n] = await db.admin<{ n: number }>("select public.purge_rate_limit_events() as n");
    expect(n!.n).toBe(1);
    expect(await db.admin("select 1 from public.rate_limit_events where user_id = $1 and action = 'test'", [plain])).toHaveLength(1);
  });

  test("throttle_action limits a user per minute, refuses unknown actions and anon", async () => {
    for (let i = 0; i < 3; i++) await db.as(other, "select public.throttle_action('export')");
    await rejects(db.as(other, "select public.throttle_action('export')"), /rate_limited/);
    await rejects(db.as(other, "select public.throttle_action('anything')"), /unknown throttle action/);
    await rejects(db.as(null, "select public.throttle_action('export')"), /permission denied/);
    // The raw throttle stays internal.
    await rejects(db.as(other, "select public.throttle('export', 1000, 1000)"), /permission denied/);
  });
});
