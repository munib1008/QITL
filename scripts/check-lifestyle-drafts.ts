/**
 * Validates the "How They Lived" drafts in content/lifestyle/*.draft.json against the loaded Quran text.
 *
 *   pnpm check:lifestyle            every draft present (none present is fine)
 *   pnpm check:lifestyle nuh        one or more slugs
 *
 * Exit code 1 when any draft has a problem. The check reports; it changes nothing. A draft that passes still needs review.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateLifestyleDraft } from "../src/lib/lifestyle/draft";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const quran = new Set<string>();
for (const line of readFileSync(join(root, "content", "quran", "quran.txt"), "utf8").split("\n")) {
  const [s, a] = line.split("|");
  if (s && a) quran.add(`${s}:${a}`);
}
const dir = join(root, "content", "lifestyle");
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".draft.json") && (only.length === 0 || only.includes(f.replace(".draft.json", "")))) : [];
let bad = 0;
for (const f of files) {
  let r;
  try {
    r = validateLifestyleDraft(JSON.parse(readFileSync(join(dir, f), "utf8")), (s, a) => quran.has(`${s}:${a}`));
  } catch (e) {
    r = { ok: false as const, problems: [{ message: `not valid JSON: ${(e as Error).message}` }] };
  }
  if (!r.ok) {
    bad++;
    console.log(`FAIL ${f}`);
    for (const p of r.problems) console.log(`  ${p.field ? p.field + ": " : ""}${p.message}`);
  } else console.log(`ok   ${f}`);
}
console.log(`${files.length} draft(s), ${bad} with problems`);
process.exit(bad ? 1 : 0);
