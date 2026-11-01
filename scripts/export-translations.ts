/**
 * Exports every interface string with its English source and the current Arabic and Urdu DRAFT, for translators.
 *
 *   pnpm i18n:export     writes docs/translation/qitl-strings.csv (UTF-8 with BOM, opens in Excel and Google Sheets)
 *
 * Columns: module, file, key, english, arabic_draft, urdu_draft, arabic_final, urdu_final, notes. The *_final and notes columns
 * are for the translator. Strings that are computed by a function are exported with sample arguments (3, 7, 9) so the
 * sentence shape is visible; the translator keeps the placeholders' meaning. The export changes nothing in the application:
 * a translator's corrections are applied by editing the strings files (docs/I18N.md lists the glossary).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STRING_FILES } from "../src/lib/i18n/registry";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function leaves(o: unknown, prefix = ""): Array<[string, string]> {
  if (typeof o === "string") return [[prefix, o]];
  if (typeof o === "function") {
    try {
      return [[`${prefix}()`, String((o as (...a: unknown[]) => unknown)(3, 7, 9))]];
    } catch {
      return [];
    }
  }
  if (typeof o !== "object" || o === null) return [];
  return Object.entries(o).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const csv = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, "\n")}"`;
const rows: string[] = [["module", "file", "key", "english", "arabic_draft", "urdu_draft", "arabic_final", "urdu_final", "notes"].join(",")];
let count = 0;
for (const f of STRING_FILES) {
  const en = leaves(f.get("en"));
  const ar = new Map(leaves(f.get("ar")));
  const ur = new Map(leaves(f.get("ur")));
  for (const [key, english] of en) {
    rows.push([f.module, f.file, key, english, ar.get(key) ?? "", ur.get(key) ?? "", "", "", ""].map(csv).join(","));
    count++;
  }
}
const dir = join(root, "docs", "translation");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "qitl-strings.csv"), "﻿" + rows.join("\r\n"), "utf8");
console.log(`Wrote docs/translation/qitl-strings.csv: ${count} strings from ${STRING_FILES.length} files.`);
