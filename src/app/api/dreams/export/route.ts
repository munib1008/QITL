import type { NextRequest } from "next/server";
import { dbError, dbThrottle, isResponse, requireUser } from "@/lib/api";

/** Download the caller's own dream data as JSON (requests, consents, history, second opinions, released answers). */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const throttled = await dbThrottle(a.sb, "export");
  if (throttled) return throttled;
  const { data, error } = await a.sb.rpc("export_my_dream_data");
  if (error) return dbError(error);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="qitl-dreams-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
