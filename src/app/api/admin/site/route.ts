import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { dbError, fail, isResponse, json, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/admin";
import { exploreLinks } from "@/lib/nav";
import { cleanTextValue, isLocked, isTextKey, MODULE_FLAG_RE, moduleFlagKey, ORDER_KEY } from "@/lib/site-config/config";
import { SiteEditInput } from "@/lib/site-config/input";
import { SITE_CONFIG_TAG } from "@/lib/site-config/server";

/**
 * Edit the home wording and the menus (administrators only). Writes go through the database functions
 * save_site_setting / save_feature_flag / revert_site_config, which check the role again, validate again, bump the
 * version, keep the revision note and the history, and audit. Flags only hide a section from the menus; nothing here
 * publishes content or touches a review guard.
 */
export async function POST(req: NextRequest) {
  const a = await requireRole(req, "admin");
  if (isResponse(a)) return a;
  const b = await parseBody(req, SiteEditInput);
  if (isResponse(b)) return b;

  if (b.action === "text") {
    if (!isTextKey(b.key)) return fail(422, "invalid", "Unknown text block.");
    const v = cleanTextValue(b.key, b.value);
    if (!v.ok) return fail(422, "invalid", "That text is not allowed.", { lang: v.lang, problem: v.problem });
    const { error } = await a.sb.rpc("save_site_setting", { p_key: b.key, p_value: v.value, p_note: b.note });
    if (error) return dbError(error);
  } else if (b.action === "nav") {
    const known = exploreLinks("en").map((l) => l.href);
    if (b.hrefs.some((h) => !known.includes(h)) || b.hidden.some((h) => !known.includes(h) || isLocked(h))) {
      return fail(422, "invalid", "Unknown or locked section.");
    }
    const [cur, flags] = await Promise.all([
      a.sb.from("site_settings").select("value").eq("key", ORDER_KEY).maybeSingle(),
      a.sb.from("feature_flags").select("key, enabled").like("key", "module.%"),
    ]);
    if (cur.error) return dbError(cur.error);
    if (flags.error) return dbError(flags.error);
    const was = ((cur.data?.value as { hrefs?: string[] } | undefined)?.hrefs ?? null) as string[] | null;
    if (JSON.stringify(was) !== JSON.stringify(b.hrefs)) {
      const { error } = await a.sb.rpc("save_site_setting", { p_key: ORDER_KEY, p_value: { hrefs: b.hrefs }, p_note: b.note });
      if (error) return dbError(error);
    }
    const enabledNow = new Map((flags.data ?? []).map((f: { key: string; enabled: boolean }) => [f.key, f.enabled]));
    for (const href of known) {
      if (isLocked(href)) continue;
      const key = moduleFlagKey(href);
      const want = !b.hidden.includes(href);
      if ((enabledNow.get(key) ?? true) === want) continue;
      const { error } = await a.sb.rpc("save_feature_flag", { p_key: key, p_enabled: want, p_note: b.note });
      if (error) return dbError(error);
    }
  } else {
    const ok = b.kind === "setting" ? isTextKey(b.key) || b.key === ORDER_KEY : MODULE_FLAG_RE.test(b.key);
    if (!ok) return fail(422, "invalid", "Unknown setting.");
    const { error } = await a.sb.rpc("revert_site_config", { p_kind: b.kind, p_key: b.key, p_version: b.version, p_note: b.note });
    if (error) return dbError(error);
  }
  revalidateTag(SITE_CONFIG_TAG);
  return json({ ok: true });
}
