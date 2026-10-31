/**
 * Automated story checks (docs/STORY_COVERAGE.md): missing Quran references, verse ids outside the surah, duplicate
 * stories, non-prophets labelled prophets, unsupported dates, hadith grading gaps, unlicensed sources, contradictory
 * genealogy, unreviewed translations and broken internal links.
 *
 *   pnpm check:stories                 content files only (event inventory, journey, Quran text); no database needed
 *   pnpm check:stories --db            also the database, through the staff-only RPC story_check_inputs() with the
 *                                      service role (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
 *   pnpm check:stories --json          machine-readable output
 *   pnpm check:stories --strict        warnings fail too (default: only errors fail)
 *
 * Exit code 1 when there is an error (or, with --strict, a warning). The checks only report; they change nothing.
 */
import { createClient } from "@supabase/supabase-js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS, runChecks, summarise, type DbInputs } from "../src/lib/stories/checks";
import { loadContentInputs } from "../src/lib/stories/static-inputs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

async function loadDb(): Promise<DbInputs | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("--db needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; checking the content files only.");
    return null;
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("story_check_inputs");
  if (error) {
    console.error(`could not read the database: ${error.message}`);
    process.exitCode = 2;
    return null;
  }
  return data as DbInputs | null;
}

const db = args.has("--db") ? await loadDb() : null;
const findings = runChecks({ content: loadContentInputs(root, db), db });
const summary = summarise(findings);

if (args.has("--json")) {
  console.log(JSON.stringify({ source: db ? "content+database" : "content", summary, findings }, null, 2));
} else {
  console.log(`Story checks (${db ? "content files and database" : "content files only"})`);
  for (const c of CHECKS) {
    const n = summary.by[c.id];
    console.log(`  ${n.error ? "ERROR  " : n.warning ? "warning" : n.info ? "note   " : "ok     "}  ${c.title}: ${n.error} error(s), ${n.warning} warning(s), ${n.info} note(s)`);
  }
  for (const f of findings) console.log(`\n[${f.severity}] ${f.check}: ${f.subject}\n    ${f.message}`);
  console.log(`\n${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.total - summary.errors - summary.warnings} note(s).`);
}
if (summary.errors > 0 || (args.has("--strict") && summary.warnings > 0)) process.exitCode = 1;
