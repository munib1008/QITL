import type { NextRequest } from "next/server";
import { dbError, isResponse, requireUser } from "@/lib/api";

/** Download everything the account owns as JSON. Runs as the user, so RLS limits it to their own rows. */
export async function POST(req: NextRequest) {
  const a = await requireUser(req);
  if (isResponse(a)) return a;
  const { data, error } = await a.sb.rpc("export_my_data");
  if (error) return dbError(error);
  const body = JSON.stringify({ account: { id: a.user.id, email: a.user.email, created_at: a.user.created_at }, ...data }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ziq-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
