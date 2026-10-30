import type { NextRequest } from "next/server";
import { dbError, isResponse, json, parseBody, requireUser } from "@/lib/api";
import { DreamPrefsInput } from "@/lib/dreams";

export async function GET(req: NextRequest) {
  const a = await requireUser(req, { mutation: false });
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.from("dream_privacy_preferences").select("retention_days").eq("user_id", a.user.id).maybeSingle();
  if (error) return dbError(error);
  return json({ retentionDays: (data as { retention_days: number } | null)?.retention_days ?? 90 });
}

/** Retention for new requests: 30, 90, 180 or 365 days. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const b = await parseBody(req, DreamPrefsInput);
  if (isResponse(b)) return b;
  const { error } = await a.sb
    .from("dream_privacy_preferences")
    .upsert({ user_id: a.user.id, retention_days: b.retentionDays, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return dbError(error);
  return json({ retentionDays: b.retentionDays });
}
