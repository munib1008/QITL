/**
 * Validates the Creation Atlas profile drafts (content/creation) and the Life Guidance lesson drafts (content/guidance)
 * against the loaded Quran text.
 *
 *   pnpm check:sourced                  every draft present (none present is fine)
 *   pnpm check:sourced creation angels  one kind, optionally some slugs
 *
 * Exit code 1 when any draft has a problem. The check reports; it changes nothing. A draft that passes still needs review.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCreationDraft, validateGuidanceDraft } from "../src/lib/sourced/kinds";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const kinds = (args[0] === "creation" || args[0] === "guidance" ? [args[0]] : ["creation", "guidance"]) as Array<"creation" | "guidance">;
const slugs = args[0] === "creation" || args[0] === "guidance" ? args.slice(1) : args;
const quran = new Set<string>();
for (const line of readFileSync(join(root, "content", "quran", "quran.txt"), "utf8").split("\n")) {
  const [s, a] = line.split("|");
  if (s && a) quran.add(`${s}:${a}`);
}
const has = (s: number, a: number) => quran.has(`${s}:${a}`);
let bad = 0;
let total = 0;
for (const kind of kinds) {
  const dir = join(root, "content", kind);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".draft.json") && (slugs.length === 0 || slugs.includes(f.replace(".draft.json", "")))) : [];
  for (const f of files) {
    total++;
    let r;
    try {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf8"));
      r = kind === "creation" ? validateCreationDraft(raw, has) : validateGuidanceDraft(raw, has);
    } catch (e) {
      r = { ok: false as const, problems: [{ message: `not valid JSON: ${(e as Error).message}` }] };
    }
    if (!r.ok) {
      bad++;
      console.log(`FAIL ${kind}/${f}`);
      for (const p of r.problems) console.log(`  ${p.field ? p.field + ": " : ""}${p.message}`);
    } else console.log(`ok   ${kind}/${f}`);
  }
}
console.log(`${total} draft(s), ${bad} with problems`);
process.exit(bad ? 1 : 0);
