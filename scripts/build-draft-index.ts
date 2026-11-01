/**
 * Writes src/generated/story-drafts.json, the data of the "Draft preview" pages (/drafts), from content/stories/*.draft.json.
 *
 *   pnpm drafts:index            write the index
 *   pnpm drafts:index --check    exit 1 when the committed index is stale (writes nothing)
 *
 * Run it after any change to a draft, to docs/STORY_DRAFTS.md (the checklist) or to the validator, and commit the result;
 * tests/unit/draft-preview.test.ts fails while the committed index is stale. Drafts with validator errors are left out
 * and listed. Nothing here touches the database.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { INDEX_PATH, buildDraftIndex, serializeIndex } from "../src/lib/stories/draft-index";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const { index, excluded } = buildDraftIndex(root);
const file = join(root, ...INDEX_PATH);
const next = serializeIndex(index);

for (const e of excluded) console.log(`left out  ${e.file}: ${e.reason}`);
if (check) {
  const current = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== next) {
    console.error("src/generated/story-drafts.json is stale: run `pnpm drafts:index` and commit it.");
    process.exit(1);
  }
  console.log(`Draft preview index is up to date (${index.stories.length} draft(s)).`);
} else {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, next, "utf8");
  console.log(`Wrote ${INDEX_PATH.join("/")}: ${index.stories.length} draft(s), ${Object.keys(index.quran).length} cited ayat.`);
}
