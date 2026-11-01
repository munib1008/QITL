/**
 * Validates the story drafts in content/stories/*.draft.json (schema, verse references, claims, forbidden patterns).
 *
 *   pnpm check:drafts            every draft present (none present is fine)
 *   pnpm check:drafts yusuf      one or more slugs
 *   pnpm check:drafts --json     machine-readable output
 *
 * Exit code 1 when any draft has an error or a warning ("clean" means neither). Information lines never fail. The
 * check reports; it changes nothing. A draft that passes still needs the scholarly review checklist
 * (docs/STORY_DRAFTS.md): this is a gate against the common mistakes, not a review.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateStoryDraft, type Issue } from "../src/lib/stories/draft";
import { loadDraftContext, loadDraftFiles } from "../src/lib/stories/draft-load";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const json = args.includes("--json");
const only = args.filter((a) => !a.startsWith("--"));

const ctx = loadDraftContext(root);
const files = loadDraftFiles(root).filter((f) => only.length === 0 || only.includes(f.slug));
const report: Array<{ file: string; issues: Issue[] }> = files.map((f) => ({
  file: f.file,
  issues: f.parseError ? [{ severity: "error", code: "json", where: "(file)", message: f.parseError }] : validateStoryDraft(f.raw, ctx, { fileSlug: f.slug }),
}));

let bad = 0;
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else if (files.length === 0) {
  console.log("No story drafts found in content/stories/ (nothing to check).");
}
for (const r of report) {
  const e = r.issues.filter((i) => i.severity === "error").length;
  const w = r.issues.filter((i) => i.severity === "warning").length;
  if (e || w) bad++;
  if (!json) {
    console.log(`${e ? "ERROR  " : w ? "warning" : "ok     "}  ${r.file}: ${e} error(s), ${w} warning(s), ${r.issues.length - e - w} note(s)`);
    for (const i of r.issues) console.log(`    [${i.severity}] ${i.code} ${i.where}: ${i.message}`);
  }
}
if (!json && files.length) console.log(bad ? `\n${bad} draft(s) need attention.` : `\n${files.length} draft(s) clean.`);
if (bad) process.exitCode = 1;
if (!json && files.length) console.log("\nTo show drafts in the public Draft preview (/drafts), regenerate the index and commit it: pnpm drafts:index");
