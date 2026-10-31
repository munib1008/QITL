/**
 * Loads the story drafts and everything the draft validator needs from the repository (Node only).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ayahCounts, loadQuran } from "@/lib/events/verify";
import type { AnchorFixtures, DraftContext, InventoryItem } from "./draft";

export const DRAFT_DIR = ["content", "stories"] as const;
export const ANCHOR_DIR = ["tests", "fixtures"] as const;

const EMPTY: AnchorFixtures = { names: {}, numbers: {}, guarded: {}, common_capitalised: [], opening_words: [], tradition_names: [], titles_ar: {} };

/**
 * The anchor fixtures are tests/fixtures/story-anchors.json plus every tests/fixtures/story-anchors.<batch>.json
 * (each batch of stories adds its own file, so parallel branches never edit the same one). Objects are merged,
 * lists are unioned; a name given twice with different anchors is an error.
 */
export function loadAnchorFixtures(root = process.cwd()): AnchorFixtures {
  const dir = join(root, ...ANCHOR_DIR);
  const files = readdirSync(dir).filter((f) => /^story-anchors(\..+)?\.json$/.test(f)).sort();
  const out: AnchorFixtures = JSON.parse(JSON.stringify(EMPTY));
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8")) as Partial<AnchorFixtures>;
    for (const k of ["names", "numbers", "guarded", "titles_ar"] as const) {
      for (const [a, b] of Object.entries(j[k] ?? {})) {
        if (out[k][a] !== undefined && out[k][a] !== b) throw new Error(`${f}: ${k}.${a} is given twice with different anchors`);
        out[k][a] = b;
      }
    }
    for (const k of ["common_capitalised", "opening_words", "tradition_names"] as const) out[k] = [...new Set([...out[k], ...(j[k] ?? [])])];
  }
  return out;
}

export function loadDraftContext(root = process.cwd()): DraftContext {
  const inv = JSON.parse(readFileSync(join(root, "content", "events", "inventory.draft.json"), "utf8")) as { items: InventoryItem[] };
  const quran = loadQuran(root);
  return { quran, ayahCounts: ayahCounts(quran), inventory: inv.items, anchors: loadAnchorFixtures(root) };
}

export interface DraftFile {
  file: string;
  slug: string;
  raw: unknown;
  parseError?: string;
}

/** Every content/stories/<slug>.draft.json present (none is fine). */
export function loadDraftFiles(root = process.cwd()): DraftFile[] {
  const dir = join(root, ...DRAFT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".draft.json"))
    .sort()
    .map((f) => {
      const slug = f.replace(/\.draft\.json$/, "");
      try {
        return { file: f, slug, raw: JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown };
      } catch (e) {
        return { file: f, slug, raw: null, parseError: (e as Error).message };
      }
    });
}
