import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

/** One-click unsubscribe from digest emails: RFC 8058 POST, and a plain GET link. No sign-in needed. */
async function handle(req: NextRequest) {
  const token = z.string().uuid().safeParse(req.nextUrl.searchParams.get("token"));
  const sb = await getServerSupabase();
  let ok = false;
  if (token.success && sb) {
    const { data } = await sb.rpc("unsubscribe", { token: token.data });
    ok = data === true;
  }
  return NextResponse.redirect(new URL(`/account/unsubscribed?ok=${ok ? 1 : 0}`, req.url), 303);
}

export const GET = handle;
export const POST = handle;
