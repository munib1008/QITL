import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

/**
 * In-process Postgres (PGlite + PostGIS) with a minimal stand-in for Supabase's auth schema and API roles,
 * so the real migrations and RLS policies run unmodified in unit tests. Files marked "-- @supabase-only"
 * (storage buckets) are skipped here and covered by the Supabase deployment checklist instead.
 */
const AUTH_STUB = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text unique, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

const dir = join(__dirname, "..", "..", "supabase", "migrations");

export async function createDb(): Promise<Db> {
  const pg = await PGlite.create({ extensions: { postgis, pg_trgm, pgcrypto, unaccent } });
  await pg.exec(AUTH_STUB);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, f), "utf8");
    if (sql.includes("-- @supabase-only")) continue;
    try {
      await pg.exec(sql);
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  await pg.exec("grant all on all tables in schema public to service_role; grant usage on schema public to service_role;");
  // Like Supabase: the API roles resolve extension types and functions from the "extensions" schema.
  await pg.exec(`grant usage on schema extensions to anon, authenticated, service_role;
    alter role anon set search_path = "$user", public, extensions;
    alter role authenticated set search_path = "$user", public, extensions;`);
  return new Db(pg);
}

export class Db {
  constructor(readonly pg: PGlite) {}

  /** Run SQL as the database owner (setup only). */
  async admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec("reset role; set search_path = \"$user\", public, extensions; select set_config('request.jwt.claim.sub', '', false);");
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** Run SQL as a Supabase API role; `user` sets auth.uid(). RLS applies. */
  async as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec("reset role;");
    await this.pg.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await this.pg.exec(`set role ${user ? "authenticated" : "anon"}; set search_path = "$user", public, extensions;`);
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec("reset role;");
    }
  }

  async createUser(email: string, roles: string[] = []): Promise<string> {
    const [u] = await this.admin<{ id: string }>("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
    for (const r of roles) await this.admin("insert into public.role_assignments (user_id, role) values ($1, $2)", [u!.id, r]);
    return u!.id;
  }
}

/** Expect a promise to reject with a message matching re. */
export async function rejects(p: Promise<unknown>, re: RegExp): Promise<void> {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (!re.test(msg)) throw new Error(`expected error matching ${re}, got: ${msg}`);
    return;
  }
  throw new Error(`expected rejection matching ${re}, but it resolved`);
}
