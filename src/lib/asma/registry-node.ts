import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NameDraft } from "./registry";

export interface NamesFile {
  _meta: Record<string, string>;
  names: NameDraft[];
}

export function loadNamesFile(root: string = process.cwd()): NamesFile {
  return JSON.parse(readFileSync(join(root, "content", "asma", "names.draft.json"), "utf8")) as NamesFile;
}
