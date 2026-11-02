import { z } from "zod";
import { MAX_DIRECTORY_ROWS } from "./constants";
import type { DirectoryRow } from "./types";

/** Directory filters as they appear in the URL. Unknown or empty values are dropped, never an error. */
export const DirectoryQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().uuid().optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  city: z.string().trim().max(80).optional(),
  mode: z.enum(["online", "in_person", "hybrid"]).optional(),
  language: z.string().regex(/^[a-z]{2,3}$/).optional(),
  price: z.enum(["free", "paid"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]).optional(),
  group: z.enum(["individual", "group"]).optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
});
export type DirectoryFilters = z.infer<typeof DirectoryQuery>;

export const PAGE_SIZE = 12;

export function parseDirectoryQuery(sp: Record<string, string | string[] | undefined>): DirectoryFilters {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DirectoryQuery.shape)) {
    const raw = sp[key];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v === undefined || v === "") continue;
    const one = (DirectoryQuery.shape as Record<string, z.ZodTypeAny>)[key]!.safeParse(v);
    if (one.success) out[key] = one.data;
  }
  return out as DirectoryFilters;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Filter the approved directory rows. A pure function over rows the database already restricted to approved listings.
 * "Online" matches providers offering online or hybrid; "in person" matches in-person or hybrid. "Individual" / "group"
 * match providers offering that (or both). No row carries a private address.
 */
export function filterDirectory(rows: DirectoryRow[], f: DirectoryFilters): DirectoryRow[] {
  const q = f.q ? norm(f.q) : "";
  return rows.filter((r) => {
    if (f.category && !r.category_ids.includes(f.category)) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.city && norm(r.city ?? "") !== norm(f.city)) return false;
    if (f.mode && !(r.modes.includes(f.mode) || (f.mode !== "hybrid" && r.modes.includes("hybrid")))) return false;
    if (f.language && !(r.languages.includes(f.language) || r.teaching_languages.includes(f.language))) return false;
    if (f.price === "free" && !r.has_free) return false;
    if (f.price === "paid" && !r.has_paid) return false;
    if (f.level && !(r.levels.includes(f.level) || r.levels.includes("all_levels"))) return false;
    if (f.group && !(r.group_types.includes(f.group) || r.group_types.includes("both"))) return false;
    if (q && !norm([r.display_name, r.city ?? "", r.short_description ?? "", r.service_area ?? ""].join(" ")).includes(q)) return false;
    return true;
  });
}

export function paginate<T>(rows: T[], page = 1): { items: T[]; pages: number; total: number; page: number } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), pages, total: rows.length, page: p };
}

/** Link to a filter set (page omitted when 1). */
export function directoryHref(f: DirectoryFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `/partners?${s}` : "/partners";
}

export const DIRECTORY_COLUMNS =
  "id, slug, display_name, provider_type, country, city, service_area, languages, short_description, years_experience, approved_at, category_ids, modes, group_types, levels, teaching_languages, has_free, has_paid, service_count";
export const DIRECTORY_LIMIT = MAX_DIRECTORY_ROWS;
