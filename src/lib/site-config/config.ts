/**
 * Admin-editable site content and module flags: the pure side (no database, no server-only), so the editor screen, the
 * API routes, the menus and the tests share one set of rules. The database enforces the same limits again
 * (migration 20261031002620, validate_site_setting).
 *
 * What this can do, and nothing else:
 *   - replace a home text block per language, with the built-in text as the fallback (nothing changes until an admin edits);
 *   - reorder the Explore sections;
 *   - HIDE a section from the menus. A flag never publishes anything and never bypasses a review guard: it is read only
 *     by the menus below, never by a content query or a policy.
 */
import { safeHref } from "@/components/ui/Markdown";

export type Lang = "en" | "ar" | "ur";
export const LANGS: readonly Lang[] = ["en", "ar", "ur"];

export interface TextKeySpec {
  max: number;
  /** True for a block that may hold paragraph breaks and Markdown links; the rest are one plain line. */
  multiline: boolean;
}

/** The text blocks an administrator may replace, with their limits. Keys are also the database whitelist. */
export const TEXT_KEYS = {
  "home.hero.kicker": { max: 80, multiline: false },
  "home.hero.title": { max: 120, multiline: false },
  "home.hero.lead": { max: 400, multiline: false },
  "home.intro.kicker": { max: 80, multiline: false },
  "home.intro.title": { max: 120, multiline: false },
  "home.intro.body": { max: 800, multiline: true },
} as const satisfies Record<string, TextKeySpec>;
export type TextKey = keyof typeof TEXT_KEYS;
export const TEXT_KEY_LIST = Object.keys(TEXT_KEYS) as TextKey[];
export const isTextKey = (k: string): k is TextKey => Object.prototype.hasOwnProperty.call(TEXT_KEYS, k);

export const ORDER_KEY = "nav.explore.order";
export const NOTE_MIN = 4;
export const NOTE_MAX = 300;

/** Sections that can be reordered but never hidden: the reader, search and the primary Timeline tab. */
export const LOCKED_HREFS: readonly string[] = ["/quran", "/search", "/timeline"];
export const isLocked = (href: string) => LOCKED_HREFS.includes(href);

/** The flag key of a section: "/community/questions" is "module.community_questions". */
export function moduleFlagKey(href: string): string {
  return `module.${href.replace(/^\//, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}
/** A same-site path: lower-case segments, no empty segment, so "//host" and "/a//b" are never accepted. */
export const SITE_PATH = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/;
export const MODULE_FLAG_RE = /^module\.[a-z0-9_]{1,50}$/;

export type TextProblem = "empty" | "too_long" | "html" | "control" | "newline" | "link";

/**
 * Plain text or the small Markdown subset of the existing renderer (src/components/ui/Markdown.tsx). Returns the cleaned
 * text or the first problem. HTML-looking input is refused rather than stripped, so what the admin previews is what is
 * saved; the renderer shows any markup as text and links only through safeHref, so this is a second lock.
 */
export function cleanText(raw: string, spec: TextKeySpec): { ok: true; value: string } | { ok: false; problem: TextProblem } {
  let s = raw.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!spec.multiline && /\n/.test(s)) return { ok: false, problem: "newline" };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)) return { ok: false, problem: "control" };
  if (!spec.multiline) s = s.replace(/[ \t]+/g, " ");
  else s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  if (!s) return { ok: false, problem: "empty" };
  if (s.length > spec.max) return { ok: false, problem: "too_long" };
  if (/<[A-Za-z/!?]/.test(s)) return { ok: false, problem: "html" };
  for (const m of s.matchAll(/\]\(([^)]*)\)/g)) if (safeHref(m[1]!.trim()) === null) return { ok: false, problem: "link" };
  return { ok: true, value: s };
}

export type TextValue = Partial<Record<Lang, string>>;

/** Validate a per-language block (empty strings drop that language). */
export function cleanTextValue(key: TextKey, input: Record<string, unknown>): { ok: true; value: TextValue } | { ok: false; lang: string; problem: TextProblem } {
  const out: TextValue = {};
  for (const lang of LANGS) {
    const raw = input[lang];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const r = cleanText(raw, TEXT_KEYS[key]);
    if (!r.ok) return { ok: false, lang, problem: r.problem };
    out[lang] = r.value;
  }
  return { ok: true, value: out };
}

// ---------- The configuration a page reads ----------

export interface SiteConfig {
  text: Partial<Record<TextKey, TextValue>>;
  /** Section paths in the administrator's order; sections not listed keep their built-in order after these. */
  order: string[] | null;
  /** Flag keys (module.<name>) that are switched off. No row, or enabled, means visible. */
  hidden: string[];
}

export const EMPTY_CONFIG: SiteConfig = { text: {}, order: null, hidden: [] };

export interface SettingRow {
  key: string;
  value: unknown;
}
export interface FlagRow {
  key: string;
  enabled: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Rows from the database to a SiteConfig. Tolerant on purpose: anything malformed is ignored, so a bad row can never
 * break a page or change what is shown beyond its own block; the built-in text is the fallback.
 */
export function parseSiteConfig(settings: readonly SettingRow[], flags: readonly FlagRow[]): SiteConfig {
  const cfg: SiteConfig = { text: {}, order: null, hidden: [] };
  for (const row of settings) {
    if (isTextKey(row.key) && isObj(row.value)) {
      const v: TextValue = {};
      for (const lang of LANGS) {
        const raw = row.value[lang];
        if (typeof raw !== "string") continue;
        const r = cleanText(raw, TEXT_KEYS[row.key]);
        if (r.ok) v[lang] = r.value;
      }
      cfg.text[row.key] = v;
    } else if (row.key === ORDER_KEY && isObj(row.value) && Array.isArray(row.value.hrefs)) {
      cfg.order = row.value.hrefs.filter((h): h is string => typeof h === "string" && SITE_PATH.test(h));
    }
  }
  cfg.hidden = flags.filter((f) => f.enabled === false && MODULE_FLAG_RE.test(f.key)).map((f) => f.key);
  return cfg;
}

/** The text for a block in a language, or the built-in fallback when the administrator has not written that language. */
export function siteText(cfg: SiteConfig, key: TextKey, locale: string, fallback: string): string {
  const v = cfg.text[key]?.[locale as Lang];
  return v && v.trim() ? v : fallback;
}

/**
 * Apply the configuration to a list of menu links: drop hidden sections (never a locked one, and never a link without a
 * path), then order by the administrator's list; sections they did not list follow in their built-in order.
 */
export function applyNav<T extends { href: string | null }>(links: readonly T[], cfg: SiteConfig): T[] {
  const hidden = new Set(cfg.hidden);
  const visible = links.filter((l) => !l.href || isLocked(l.href) || !hidden.has(moduleFlagKey(l.href)));
  if (!cfg.order?.length) return visible;
  const rank = new Map(cfg.order.map((h, i) => [h, i] as const));
  return visible
    .map((l, i) => ({ l, i }))
    .sort((a, b) => {
      const ra = a.l.href !== null && rank.has(a.l.href) ? rank.get(a.l.href)! : Infinity;
      const rb = b.l.href !== null && rank.has(b.l.href) ? rank.get(b.l.href)! : Infinity;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map((x) => x.l);
}
