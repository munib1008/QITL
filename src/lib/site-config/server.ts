import "server-only";
import { unstable_cache } from "next/cache";
import { getPublicSupabase } from "@/lib/supabase/server";
import { logWarn } from "@/lib/observability/errors";
import { EMPTY_CONFIG, parseSiteConfig, siteText, type FlagRow, type SettingRow, type SiteConfig, type TextKey } from "./config";

export const SITE_CONFIG_TAG = "site-config";

/**
 * The public configuration, read with the cookie-free anonymous client (RLS lets visitors read only the whitelisted
 * presentation keys and the flags) and cached for 30 s; an administrator's save revalidates the tag at once. Any failure,
 * or no database, gives the empty configuration: every page then shows its built-in text and menus.
 */
const load = unstable_cache(
  async (): Promise<{ settings: SettingRow[]; flags: FlagRow[] }> => {
    const sb = getPublicSupabase();
    if (!sb) return { settings: [], flags: [] };
    const [s, f] = await Promise.all([
      sb.from("site_settings").select("key, value"),
      sb.from("feature_flags").select("key, enabled").like("key", "module.%"),
    ]);
    if (s.error || f.error) {
      logWarn("site_config_unavailable", { code: s.error?.code ?? f.error?.code });
      return { settings: [], flags: [] };
    }
    return { settings: (s.data ?? []) as SettingRow[], flags: (f.data ?? []) as FlagRow[] };
  },
  ["site-config-v1"],
  { revalidate: 30, tags: [SITE_CONFIG_TAG] },
);

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const { settings, flags } = await load();
    return parseSiteConfig(settings, flags);
  } catch {
    return EMPTY_CONFIG;
  }
}

/**
 * Home text overrides for one language. A page passes its built-in strings as fallbacks:
 *   const text = await homeText(locale, { "home.hero.title": t.heroTitle, ... });
 * and reads text["home.hero.title"]. Without an administrator's edit, the result equals the fallbacks.
 */
export async function homeText<K extends TextKey>(locale: string, fallbacks: Record<K, string>): Promise<Record<K, string>> {
  const cfg = await getSiteConfig();
  const out = {} as Record<K, string>;
  for (const k of Object.keys(fallbacks) as K[]) out[k] = siteText(cfg, k, locale, fallbacks[k]);
  return out;
}
