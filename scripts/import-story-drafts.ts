/**
 * Imports the story drafts (content/stories/*.draft.json) as DRAFT rows. See docs/STORY_DRAFTS.md.
 *
 *   pnpm import:drafts                      DRY RUN (the default): validates the drafts and prints what would be created.
 *                                           Touches no database and needs no key.
 *   pnpm import:drafts yusuf nuh            only these slugs
 *   pnpm import:drafts --db --dry-run       reads the database and prints the plan; writes nothing
 *   pnpm import:drafts --db                 writes. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 *                                           ENVIRONMENT (never read from a file, never printed).
 *   pnpm import:drafts --json               machine-readable report
 *
 * Everything is written with status 'draft'. Nothing is ever approved or published, and no review is ever written; a row
 * that is no longer a draft is left alone. A draft with a validator error or warning is refused (run `pnpm check:drafts`).
 * Re-running is safe: only rows that differ are written. This script has not been run against any Supabase project by
 * its author; running it is a deliberate act of the person who holds the service-role key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StoryDraftSchema, validateStoryDraft, type Issue } from "../src/lib/stories/draft";
import { loadDraftContext, loadDraftFiles } from "../src/lib/stories/draft-load";
import { IMPORT_TABLES, NullStore, importDraft, type Filter, type ImportStore, type ImportTable, type Row } from "../src/lib/stories/draft-import";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const only = args.filter((a) => !a.startsWith("--"));
const useDb = flag("--db");
const apply = useDb && !flag("--dry-run");

class SupabaseStore implements ImportStore {
  constructor(private readonly sb: SupabaseClient) {}
  private t(table: ImportTable) {
    if (!(IMPORT_TABLES as readonly string[]).includes(table)) throw new Error(`table ${table} is not importable`);
    return this.sb.from(table);
  }
  async select(table: ImportTable, filter: Filter): Promise<Row[]> {
    let q = this.t(table).select("*");
    for (const [k, v] of Object.entries(filter)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`select ${table}: ${error.message}`);
    return (data ?? []) as Row[];
  }
  async insert(table: ImportTable, row: Row): Promise<Row> {
    const { data, error } = await this.t(table).insert(row).select().single();
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    return data as Row;
  }
  async update(table: ImportTable, id: string, patch: Row): Promise<void> {
    const { error } = await this.t(table).update(patch).eq("id", id);
    if (error) throw new Error(`update ${table}: ${error.message}`);
  }
  async remove(table: ImportTable, filter: Filter): Promise<void> {
    let q = this.t(table).delete();
    for (const [k, v] of Object.entries(filter)) q = v === null ? q.is(k, null) : q.eq(k, v);
    const { error } = await q;
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  }
}

function makeStore(): ImportStore {
  if (!useDb) return new NullStore();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("--db needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (they are never read from a file).");
    process.exit(2);
  }
  return new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
}

const ctx = loadDraftContext(root);
const files = loadDraftFiles(root).filter((f) => only.length === 0 || only.includes(f.slug));
const reports: unknown[] = [];
let refused = 0;

if (files.length === 0) console.log("No story drafts found in content/stories/ (nothing to import).");
const store = files.length ? makeStore() : new NullStore();
if (useDb && files.length) console.log(apply ? "WRITING draft rows to the database named by NEXT_PUBLIC_SUPABASE_URL." : "Reading the database; writing nothing (--dry-run).");
else if (files.length) console.log("DRY RUN: no database is touched. Add --db to write.");

for (const f of files) {
  const issues: Issue[] = f.parseError ? [{ severity: "error", code: "json", where: "(file)", message: f.parseError }] : validateStoryDraft(f.raw, ctx, { fileSlug: f.slug });
  const blocking = issues.filter((i) => i.severity !== "info");
  if (blocking.length) {
    refused++;
    console.error(`REFUSED ${f.file}: ${blocking.length} validator finding(s); run pnpm check:drafts`);
    continue;
  }
  const draft = StoryDraftSchema.parse(f.raw);
  const report = await importDraft(store, draft, { apply, offline: !useDb });
  reports.push(report);
  if (!flag("--json")) {
    console.log(`\n${f.file}: ${report.counts.created} create, ${report.counts.updated} update, ${report.counts.deleted} delete, ${report.counts.skipped} skip, ${report.counts.warnings} warning(s)`);
    for (const a of report.actions.filter((x) => x.level !== "create" || !useDb)) console.log(`  ${a.level.padEnd(6)} ${a.what}${a.detail ? ` (${a.detail})` : ""}`);
  }
}
if (flag("--json")) console.log(JSON.stringify(reports, null, 2));
if (refused) process.exitCode = 1;
