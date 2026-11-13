import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ayahArabic } from "@/content/quran";
import { validateCreationDraft, validateGuidanceDraft, type CreationDraft, type GuidanceDraft } from "./kinds";

const hasAyah = (s: number, a: number) => ayahArabic(s, a) != null;

function load<T extends { slug: string }>(dirName: string, validate: (i: unknown, h: typeof hasAyah) => { ok: boolean; draft?: T }): Map<string, T> {
  const out = new Map<string, T>();
  const dir = join(process.cwd(), "content", dirName);
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".draft.json")) continue;
    try {
      const r = validate(JSON.parse(readFileSync(join(dir, f), "utf8")), hasAyah);
      if (r.ok && r.draft) out.set(r.draft.slug, r.draft);
    } catch {
      /* a malformed file is not shown; scripts/check-sourced-drafts.ts reports it */
    }
  }
  return out;
}

let creation: Map<string, CreationDraft> | undefined;
let guidance: Map<string, GuidanceDraft> | undefined;

/** Creation Atlas profile drafts that pass validation against the loaded Quran text. */
export const creationDrafts = () => (creation ??= load<CreationDraft>("creation", validateCreationDraft as never));
/** Life Guidance lesson drafts that pass validation. */
export const guidanceDrafts = () => (guidance ??= load<GuidanceDraft>("guidance", validateGuidanceDraft as never));
