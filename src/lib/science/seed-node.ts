import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadQuranCorpusFromDisk } from "@/lib/asma/corpus-node";
import { loadSeed, type DraftTopic, type RawSeed } from "./seed";

/** Node-only: read content/science/topics.draft.json and check it against the pinned Quran corpus on disk. */
export function loadSeedFromDisk(root: string = process.cwd()): DraftTopic[] {
  const raw = JSON.parse(readFileSync(join(root, "content", "science", "topics.draft.json"), "utf8")) as RawSeed;
  const corpus = loadQuranCorpusFromDisk(root);
  const byRef = new Map(corpus.verses.map((v) => [`${v.surah}:${v.ayah}`, v.text]));
  return loadSeed(raw, (s, a) => byRef.get(`${s}:${a}`) ?? null);
}
