import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalCorpusText, parseQuranText, type Corpus } from "./corpus";

/** Node-only loader for scripts and tests: reads content/quran from disk and verifies it against source.json. */
export function loadQuranCorpusFromDisk(root: string = process.cwd()): Corpus {
  const dir = join(root, "content", "quran");
  const raw = readFileSync(join(dir, "quran.txt"));
  const manifest = JSON.parse(readFileSync(join(dir, "source.json"), "utf8")) as { source: string; version: string; sha256: string };
  const fileSha = createHash("sha256").update(raw).digest("hex");
  if (fileSha !== manifest.sha256) throw new Error(`content/quran/quran.txt checksum ${fileSha} does not match source.json ${manifest.sha256}`);
  const verses = parseQuranText(raw.toString("utf8"));
  if (verses.length !== 6236) throw new Error(`corpus has ${verses.length} verses, expected 6236`);
  const contentSha256 = createHash("sha256").update(canonicalCorpusText(verses)).digest("hex");
  return { edition: { source: manifest.source, version: manifest.version, sha256: manifest.sha256, contentSha256 }, verses };
}
