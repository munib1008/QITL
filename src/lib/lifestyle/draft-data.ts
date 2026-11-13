import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ayahArabic } from "@/content/quran";
import { validateLifestyleDraft, type LifestyleDraft } from "@/lib/lifestyle/draft";

const dir = join(process.cwd(), "content", "lifestyle");
let cache: Map<string, LifestyleDraft> | undefined;

/**
 * The "How They Lived" drafts that pass validation against the loaded Quran text. A draft that fails validation is not shown
 * (and the check script reports it). With no Quran text loaded nothing can be validated, so nothing is shown.
 */
export function lifestyleDrafts(): Map<string, LifestyleDraft> {
  if (cache) return cache;
  cache = new Map();
  if (!existsSync(dir)) return cache;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".draft.json")) continue;
    try {
      const r = validateLifestyleDraft(JSON.parse(readFileSync(join(dir, f), "utf8")), (s, a) => ayahArabic(s, a) != null);
      if (r.ok) cache.set(r.draft.slug, r.draft);
    } catch {
      /* a malformed file is simply not shown; scripts/check-lifestyle-drafts.ts reports it */
    }
  }
  return cache;
}

export const lifestyleDraft = (slug: string): LifestyleDraft | undefined => lifestyleDrafts().get(slug);
